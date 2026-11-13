/**
 * POST /api/v5/analysis — analyse publique en 60 s, en flux NDJSON (une ligne JSON par événement).
 *
 * Corps : { url, pro: true, brand?, siteType?, city?, email?, hp? }
 * - `pro` obligatoire (service réservé aux professionnels, comme l'audit gratuit).
 * - Limites : IP (heure + jour), domaine analysé (heure), plafonds globaux ; cache 10 min par domaine.
 * - Anti-SSRF : l'adresse est validée ici (forme) puis à chaque requête par le crawl (DNS, IP, redirections).
 * - Aucune clé d'IA côté client ; plafond d'appels IA par analyse (ANALYSIS_MAX_AI_CALLS).
 * Lignes émises : les `AnalysisEvent` de runFullAnalysis, puis { type: 'saved', id, url, token, emailed? } (lien signé ;
 * `emailed` si le lien a été envoyé à l'e-mail saisi).
 */
import { z } from 'zod';
import { isAdminRequest } from '@/lib/adminAuth';
import { DAY_MS, HOUR_MS, getClientIp, rateLimit } from '@/lib/ratelimit';
import { SafeFetchError } from '@/lib/siteaudit/fetch';
import {
  analysisDomain,
  analysisRouteOverrides,
  cachedAnalysis,
  issueToken,
  previousAnalysis,
  runFullAnalysis,
  saveAnalysis,
  type AnalysisEvent,
  type FullAnalysis,
} from '@/lib/analysis';
import { emailHash } from '@/lib/analysis/store';
import { sendAnalysisReportEmail } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const num = (k: string, d: number) => {
  const n = Number(process.env[k]);
  return Number.isFinite(n) && n > 0 ? n : d;
};
const limits = () => ({
  ipHour: num('ANALYSIS_RATE_LIMIT_PER_HOUR', 6),
  ipDay: num('ANALYSIS_RATE_LIMIT_PER_DAY', 15),
  domainHour: num('ANALYSIS_PER_DOMAIN_PER_HOUR', 4),
  globalHour: num('ANALYSIS_GLOBAL_PER_HOUR', 120),
  globalDay: num('ANALYSIS_GLOBAL_PER_DAY', 600),
});

const PRO_MSG = 'Repéré est réservé aux professionnels : cochez cette case si vous agissez pour votre activité.';
const NO_LINK = /(https?:\/\/|www\.|@)/i;
const SAFE_TEXT = /^[\p{L}\p{N} '’\-&/().,!+°]+$/u;
const empty = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);
const text = (max: number, msg: string) =>
  z.preprocess(empty, z.string().trim().min(2, { error: msg }).max(max, { error: msg }).refine((v) => !NO_LINK.test(v) && SAFE_TEXT.test(v), { error: msg }).optional());

const Body = z.object({
  url: z.string({ error: 'Indiquez l’adresse de votre site.' }).trim().min(4, { error: 'Indiquez l’adresse de votre site.' }).max(300),
  pro: z.literal(true, { error: PRO_MSG }),
  brand: text(80, 'Indiquez seulement le nom de votre marque.'),
  city: text(60, 'Indiquez seulement le nom de la ville.'),
  siteType: z.preprocess(empty, z.enum(['local', 'pme', 'ecommerce']).optional()),
  email: z.preprocess(empty, z.email({ error: 'Cette adresse e-mail semble incomplète.' }).max(200).optional()),
  /** relancer l'analyse même si une analyse de moins de 10 min existe */
  fresh: z.boolean().optional(),
  hp: z.string().optional(),
});

function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });
}

/**
 * Envoi du lien du rapport à l'adresse saisie (facultatif). Type « service » : la liste d'opposition (désinscription)
 * s'applique ; au plus 3 envois par adresse et par jour (anti-abus d'un formulaire public). ANALYSIS_EMAIL_REPORT=0 coupe
 * l'envoi. Sans RESEND_API_KEY, l'e-mail est journalisé (démo). Ne bloque jamais le flux.
 */
async function mailReport(email: string | undefined, a: FullAnalysis, url: string): Promise<'sent' | 'skipped'> {
  if (!email || process.env.ANALYSIS_EMAIL_REPORT === '0') return 'skipped';
  try {
    const rl = await rateLimit('analysis-email-d', emailHash(email), 3, DAY_MS, { failClosed: true });
    if (!rl.ok) return 'skipped';
    const r = await sendAnalysisReportEmail(
      email,
      {
        brand: a.detected.brand || a.input.brand || a.crawl?.finalOrigin || a.input.url,
        url: a.crawl?.finalOrigin || a.input.url,
        verdict: a.verdict,
        scores: a.scores,
        priorities: a.priorities,
        demo: a.demo,
        partial: a.partial,
      },
      url,
    );
    return r.status === 'sent' || r.status === 'logged' ? 'sent' : 'skipped';
  } catch (e) {
    console.error('[api/v5/analysis] envoi du rapport impossible', e);
    return 'skipped';
  }
}

const tooMany = (msg: string, retry: number) => json({ error: msg }, 429, { 'Retry-After': String(retry) });

export async function POST(req: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json({ error: 'Requête invalide.' }, 400);
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const i of parsed.error.issues) {
      const k = String(i.path[0] ?? 'form');
      fields[k] ??= i.message;
    }
    return json({ error: Object.values(fields)[0], fields }, 400);
  }
  const body = parsed.data;
  if (body.hp) return json({ error: 'Requête invalide.' }, 400);

  let domain: string;
  try {
    domain = analysisDomain(body.url);
  } catch (e) {
    const msg = e instanceof SafeFetchError ? e.message : 'Cette adresse de site ne semble pas valide.';
    return json({ error: msg, fields: { url: msg } }, 400);
  }

  // ---- Limites de débit (avant tout travail) ----
  const L = limits();
  if (!isAdminRequest(req)) {
    const ip = getClientIp(req);
    const h = await rateLimit('analysis-ip-h', ip, L.ipHour, HOUR_MS, { failClosed: true });
    const d = h.ok ? await rateLimit('analysis-ip-d', ip, L.ipDay, DAY_MS, { failClosed: true }) : h;
    if (!h.ok || !d.ok) return tooMany('Vous avez lancé plusieurs analyses récemment. Réessayez un peu plus tard.', (h.ok ? d : h).retryAfter);
  }

  // ---- Cache 10 min par domaine ----
  if (!body.fresh) {
    const hit = await cachedAnalysis(domain).catch(() => null);
    if (hit) {
      const tok = await issueToken(hit.analysis.id, body.email);
      return stream(async function* () {
        yield { type: 'cached', id: hit.analysis.id, at: hit.analysis.createdAt };
        yield { type: 'result', seq: 1, t: 0, analysis: hit.analysis } satisfies AnalysisEvent;
        if (tok) {
          const mailed = await mailReport(body.email, hit.analysis, tok.url);
          yield { type: 'saved', id: hit.analysis.id, url: tok.url, token: tok.token, ...(mailed === 'sent' ? { emailed: true } : {}) };
        }
      });
    }
  }

  const dl = await rateLimit('analysis-domain-h', domain, L.domainHour, HOUR_MS, { failClosed: true });
  if (!dl.ok) return tooMany('Ce site a déjà été analysé plusieurs fois dans l’heure. Réessayez plus tard.', dl.retryAfter);
  const gh = await rateLimit('analysis-global-h', 'all', L.globalHour, HOUR_MS, { failClosed: true });
  const gd = gh.ok ? await rateLimit('analysis-global-d', 'all', L.globalDay, DAY_MS, { failClosed: true }) : gh;
  if (!gh.ok || !gd.ok) return json({ error: 'Beaucoup d’analyses en ce moment. Réessayez dans une heure.' }, 503, { 'Retry-After': '3600' });

  const previous = await previousAnalysis(domain).catch(() => null);
  const ac = new AbortController();
  req.signal?.addEventListener('abort', () => ac.abort());
  const events = runFullAnalysis(
    { url: body.url, brand: body.brand, siteType: body.siteType, city: body.city },
    { ...analysisRouteOverrides(), previous, signal: ac.signal },
  );
  return stream(async function* () {
    let result: FullAnalysis | null = null;
    for await (const e of events) {
      if (e.type === 'result') result = e.analysis;
      yield e;
    }
    if (result) {
      try {
        const saved = await saveAnalysis(result, { domain, email: body.email });
        const mailed = await mailReport(body.email, result, saved.url);
        yield { type: 'saved', id: result.id, url: saved.url, token: saved.token, ...(mailed === 'sent' ? { emailed: true } : {}) };
      } catch (err) {
        console.error('[api/v5/analysis] sauvegarde impossible', err);
        yield { type: 'error', message: 'Analyse terminée, mais nous n’avons pas pu l’enregistrer : le lien de partage n’est pas disponible.' };
      }
    }
  }, () => ac.abort());
}

function stream(gen: () => AsyncGenerator<unknown>, onCancel?: () => void): Response {
  const enc = new TextEncoder();
  const it = gen();
  const rs = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await it.next();
        if (done) controller.close();
        else controller.enqueue(enc.encode(`${JSON.stringify(value)}\n`));
      } catch (e) {
        console.error('[api/v5/analysis] flux interrompu', e);
        controller.enqueue(enc.encode(`${JSON.stringify({ type: 'error', message: 'L’analyse a été interrompue. Réessayez dans un instant.' })}\n`));
        controller.close();
      }
    },
    cancel() {
      onCancel?.();
      void it.return(undefined);
    },
  });
  return new Response(rs, {
    status: 200,
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' },
  });
}
