import { recordAttribution, sanitizeAttribution } from '@/lib/roi/attribution';
import { NextResponse, after } from 'next/server';
import { z } from 'zod';
import { runAudit, type AuditInput, type AuditResult } from '@/lib/engine';
import type { AuditInputV2 } from '@/lib/engine/types-v2';
import { listAuditsForBusiness, saveAudit, saveLead } from '@/lib/db';
import { getEntitlements } from '@/lib/entitlements';
import { MIN_INTERVAL_MS, isAuditDue, periodKey } from '@/lib/jobs/platform';
import { HttpError } from '@/lib/auth/roles';
import { sendReportEmail } from '@/lib/email';
import { DAY_MS, HOUR_MS, getClientIp, rateLimit } from '@/lib/ratelimit';
import { isAdminRequest } from '@/lib/adminAuth';
import { REGULATED_TRADE_MESSAGE, isRegulatedTrade } from '@/lib/regulated';
import { requireBusiness, toResponse } from '@/lib/auth';
import { enqueue } from '@/lib/jobs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** Les IA répondent en 10–40 s ; plafond Vercel Hobby = 60 s. */
export const maxDuration = 60;

const AUDIT_TIMEOUT_MS = 55_000;
const LIMIT_PER_DAY = Number(process.env.AUDIT_RATE_LIMIT_PER_DAY || 5);
/** Plafonds globaux (qa/securite.md C1), admin compris : 300/jour ≈ 170 € au pire. */
const GLOBAL_PER_DAY = Number(process.env.AUDIT_GLOBAL_PER_DAY || 300);
const GLOBAL_PER_HOUR = Number(process.env.AUDIT_GLOBAL_PER_HOUR || 60);
/** Audits demandés pour une même adresse e-mail par jour. */
const PER_EMAIL_PER_DAY = Number(process.env.AUDIT_PER_EMAIL_PER_DAY || 3);
/** E-mails de rapport envoyés par jour, toutes adresses confondues (qa/securite.md E3). */
const EMAIL_GLOBAL_PER_DAY = Number(process.env.EMAIL_GLOBAL_PER_DAY || 200);

/** Ni URL, ni domaine, ni e-mail dans les champs texte : ils sont repris dans l'e-mail et le rapport (E3/M2). */
const NO_LINK = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(?:fr|com|net|org|io|ly|xyz|info|be|ch|eu|co)\b|@)/i;
const SAFE_TEXT = /^[\p{L}\p{N} '’\-&/().,!+°]+$/u;
const PLAIN = { error: 'Indiquez seulement le nom, sans adresse web, e-mail ni caractères spéciaux.' };

const emptyToUndef = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);
const WEBSITE_RE = /^(https?:\/\/)?([a-z0-9À-ɏ-]+\.)+[a-z]{2,}(:\d+)?(\/\S*)?$/i;

function safeText(max: number, message: string) {
  return z.string().trim().min(2, { error: message }).max(max, { error: message }).refine((v) => !NO_LINK.test(v) && SAFE_TEXT.test(v), { error: message });
}
/** Liste : accepte un tableau ou une chaîne séparée par des virgules ; retire les vides. */
function cleanList(v: unknown): unknown {
  const arr = Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[,;\n]/) : v;
  if (!Array.isArray(arr)) return arr;
  const out = arr.map((x) => (typeof x === 'string' ? x.trim() : x)).filter((x) => x !== '' && x != null);
  return out.length ? out : undefined;
}

/**
 * Parcours PME / e-commerce : le moteur V1 attend `trade` et `city`. On les déduit du secteur
 * (ou des catégories produits) et du marché, avant validation, pour garder un seul schéma.
 */
function normalizeV2(json: unknown): unknown {
  if (!json || typeof json !== 'object') return json;
  const b = { ...(json as Record<string, unknown>) };
  const seg = b.segment;
  if (seg !== 'pme' && seg !== 'ecommerce') return b;
  const str = (x: unknown) => (typeof x === 'string' ? x.trim() : '');
  const cats = cleanList(b.productCategories);
  const firstCat = Array.isArray(cats) ? str(cats[0]) : '';
  if (!str(b.trade)) {
    const t = seg === 'pme' ? str(b.category) : firstCat || str(b.category);
    if (t) b.trade = t.slice(0, 60);
  }
  if (!str(b.city)) b.city = str(b.market) || 'France';
  return b;
}

const AuditBody = z.object({
  businessName: z
    .string({ error: 'Indiquez le nom de votre commerce pour que nous puissions le chercher.' })
    .trim()
    .min(1, { error: 'Indiquez le nom de votre commerce pour que nous puissions le chercher.' })
    .max(120)
    .refine((v) => !NO_LINK.test(v) && SAFE_TEXT.test(v), PLAIN),
  trade: z
    .string({ error: 'Indiquez votre métier, par exemple « plombier » ou « pizzeria ».' })
    .trim()
    .min(2, { error: 'Indiquez votre métier, par exemple « plombier » ou « pizzeria ».' })
    .max(60)
    .refine((v) => !NO_LINK.test(v) && SAFE_TEXT.test(v), { error: 'Indiquez seulement votre métier, par exemple « plombier ».' })
    // Professions réglementées non couvertes (qa/ARBITRAGES.md n° 8) : refus poli, avant tout appel payant.
    .refine((v) => !isRegulatedTrade(v), { error: REGULATED_TRADE_MESSAGE }),
  city: z
    .string({ error: 'Indiquez la ville où se trouve votre commerce.' })
    .trim()
    .min(2, { error: 'Indiquez la ville où se trouve votre commerce.' })
    .max(60)
    .refine((v) => !NO_LINK.test(v) && SAFE_TEXT.test(v), { error: 'Indiquez seulement le nom de la ville.' }),
  district: z.preprocess(
    emptyToUndef,
    z
      .string()
      .trim()
      .max(60)
      .refine((v) => !NO_LINK.test(v) && SAFE_TEXT.test(v), { error: 'Indiquez seulement le quartier ou l’arrondissement.' })
      .optional(),
  ),
  website: z.preprocess(
    emptyToUndef,
    z
      .string()
      .trim()
      .max(200)
      .regex(WEBSITE_RE, { error: 'Cette adresse de site ne semble pas valide. Vous pouvez aussi laisser le champ vide.' })
      .optional(),
  ),
  email: z.preprocess(
    emptyToUndef,
    z
      .email({ error: 'Cette adresse e-mail semble incomplète. Vérifiez-la, par exemple vous@exemple.fr.' })
      .max(200)
      .optional(),
  ),
  // ---- V2 (agent RAPPORT, autorisation exceptionnelle : schéma d'entrée uniquement) ----
  /** Parcours : local (défaut), pme, ecommerce. */
  segment: z.preprocess(emptyToUndef, z.enum(['local', 'pme', 'ecommerce']).optional()),
  /** PME : secteur ou catégorie d'offre (« logiciel de paie pour PME »). */
  category: z.preprocess(emptyToUndef, safeText(80, 'Indiquez seulement votre secteur, par exemple « logiciel de paie pour PME ».').optional()),
  /** PME / e-commerce : l'offre en une phrase. */
  offering: z.preprocess(emptyToUndef, safeText(200, 'Décrivez votre offre en une phrase, sans adresse web ni e-mail.').optional()),
  /** E-commerce : 1 à 3 catégories produits. */
  productCategories: z.preprocess(
    cleanList,
    z.array(safeText(60, 'Indiquez seulement des catégories de produits, par exemple « crème solaire bio ».')).max(3).optional(),
  ),
  /** Concurrents connus (facultatif). */
  knownCompetitors: z.preprocess(cleanList, z.array(safeText(80, 'Indiquez seulement le nom de vos concurrents.')).max(5).optional()),
  /** PME / e-commerce : marché (« France » ou une ville). */
  market: z.preprocess(emptyToUndef, safeText(60, 'Indiquez « France » ou le nom d’une ville.').optional()),
  /** Case d'information sur le traitement de l'audit (ce n'est PAS un consentement marketing).
   *  Booléen libre : l'admin (AuditButton) et scripts/batch-audit.ts envoient consent:false. */
  consent: z.boolean().optional().default(false),
  /** Case facultative, non pré-cochée : recevoir nos conseils par e-mail (seul consentement marketing). */
  marketingConsent: z.boolean().optional().default(false),
  /** Pot de miel anti-robot : doit rester vide. */
  hp: z.string().optional(),
});

function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const k = String(issue.path[0] ?? 'form');
    if (!out[k]) out[k] = issue.message;
  }
  return out;
}

const FREQ_LABEL = { monthly: 'par mois', weekly: 'par semaine', daily: 'par jour' } as const;

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  // Nouvelle mesure d'un espace client ({ businessId }) : passe par la file (audit.run, questions suivies et IA de
  // l'offre) et renvoie `jobId`, suivi par GET /api/jobs/[id]. Une mesure par période de l'offre.
  const businessId = (json as { businessId?: unknown } | null)?.businessId;
  if (typeof businessId === 'string' && businessId) {
    try {
      const { business } = await requireBusiness(req, businessId, { write: true });
      // Une mesure par période de l'offre (Découverte : 1 par mois, décision 2 ; Essentiel PME : 1 par semaine…),
      // appliquée côté serveur (E1 de qa/v3/securite-v3.md). Exception : le tout premier audit (lancé à l'inscription,
      // avant le choix des questions) peut être suivi d'une mesure sur les questions choisies au démarrage.
      const ent = getEntitlements(business);
      const audits = await listAuditsForBusiness(businessId).catch(() => []);
      const times = audits.map((a) => Date.parse(a.createdAt)).filter(Number.isFinite).sort((a, b) => b - a);
      const now = new Date();
      const lastAt = times[0];
      if (lastAt !== undefined && audits.length > 1 && !isAuditDue(ent.frequency, new Date(lastAt).toISOString(), now)) {
        const next = new Date(lastAt + MIN_INTERVAL_MS[ent.frequency]).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Europe/Paris' });
        throw new HttpError(
          402,
          `Votre offre comprend une mesure ${FREQ_LABEL[ent.frequency]} : prochaine mesure possible le ${next}.${ent.tier === 'decouverte' ? ' Passez à Essentiel pour mesurer plus souvent.' : ''}`,
          'quota_exceeded',
        );
      }
      const { id } = await enqueue('audit.run', { businessId, trigger: 'manual' }, { businessId, dedupeKey: `audit.run:${businessId}:${periodKey(ent.frequency, now)}:${audits.length > 1 ? 'p' : 'first'}` });
      return NextResponse.json({ jobId: id }, { status: 202 });
    } catch (e) {
      return toResponse(e, 'api/audit');
    }
  }

  const parsed = AuditBody.safeParse(normalizeV2(json));
  if (!parsed.success) {
    const fields = fieldErrors(parsed.error);
    return NextResponse.json({ error: Object.values(fields)[0], fields }, { status: 400 });
  }
  const body = parsed.data;
  if (body.hp) return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });

  // L'admin et les scripts de prospection (x-admin-token) ne sont pas limités par IP (mais bien par les plafonds globaux).
  const rl = isAdminRequest(req)
    ? { ok: true, remaining: LIMIT_PER_DAY, retryAfter: 0 }
    : await rateLimit('audit', getClientIp(req), LIMIT_PER_DAY, DAY_MS, { failClosed: true });
  if (!rl.ok) {
    return NextResponse.json(
      {
        error:
          'Vous avez déjà lancé plusieurs audits aujourd’hui. Réessayez demain, ou retrouvez vos rapports dans votre boîte mail.',
      },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } },
    );
  }

  if (body.email) {
    const re = await rateLimit('audit-email', body.email.toLowerCase(), PER_EMAIL_PER_DAY, DAY_MS, { failClosed: true });
    if (!re.ok) {
      return NextResponse.json(
        { error: 'Plusieurs audits ont déjà été demandés pour cette adresse aujourd’hui. Réessayez demain.' },
        { status: 429, headers: { 'Retry-After': String(re.retryAfter) } },
      );
    }
  }
  const gh = await rateLimit('audit-global-h', 'all', GLOBAL_PER_HOUR, HOUR_MS, { failClosed: true });
  const gd = gh.ok ? await rateLimit('audit-global-d', 'all', GLOBAL_PER_DAY, DAY_MS, { failClosed: true }) : gh;
  if (!gh.ok || !gd.ok) {
    console.error('[api/audit] plafond global atteint', { hour: gh.ok, day: gd.ok });
    return NextResponse.json(
      { error: 'Beaucoup de demandes en ce moment. Réessayez dans une heure : vos informations sont conservées.' },
      { status: 503, headers: { 'Retry-After': '3600' } },
    );
  }

  const segment = body.segment ?? 'local';
  if (segment === 'ecommerce' && !body.productCategories?.length) {
    const msg = 'Indiquez au moins une catégorie de produits, par exemple « crème solaire bio ».';
    return NextResponse.json({ error: msg, fields: { productCategories: msg } }, { status: 400 });
  }
  if (segment === 'pme' && !body.category) {
    const msg = 'Indiquez votre secteur, par exemple « logiciel de paie pour PME ».';
    return NextResponse.json({ error: msg, fields: { category: msg } }, { status: 400 });
  }
  const v2: AuditInputV2 =
    segment === 'local'
      ? { segment, ...(body.knownCompetitors ? { knownCompetitors: body.knownCompetitors } : {}) }
      : {
          segment,
          category: body.category,
          offering: body.offering,
          productCategories: body.productCategories,
          knownCompetitors: body.knownCompetitors,
          market: body.market ?? 'France',
        };
  const input: AuditInput & AuditInputV2 = {
    ...v2,
    businessName: body.businessName,
    trade: body.trade,
    city: body.city,
    district: segment === 'local' ? body.district : undefined,
    website: body.website,
    // pas d'e-mail dans le résultat : il n'est stocké que dans `leads` (le rapport est public par lien, E2)
  };

  let result: AuditResult;
  try {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ac = new AbortController();
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        ac.abort(); // plus aucun appel payant après le délai
        reject(new Error('timeout'));
      }, AUDIT_TIMEOUT_MS);
    });
    try {
      result = await Promise.race([runAudit(input, { mode: 'free', signal: ac.signal }), timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  } catch (e) {
    console.error('[api/audit] échec de l’audit', e);
    const isTimeout = e instanceof Error && e.message === 'timeout';
    return NextResponse.json(
      {
        error: isTimeout
          ? 'Les IA sont un peu lentes aujourd’hui. Réessayez dans quelques minutes : vos informations sont conservées.'
          : 'Nous n’avons pas pu terminer votre audit. Ce n’est pas de votre faute. Réessayez dans quelques minutes : vos informations sont conservées.',
      },
      { status: isTimeout ? 504 : 500 },
    );
  }

  try {
    await saveAudit(result, { trigger: 'free' });
    // Origine de la visite (ROI des baromètres, /admin/roi) : validée, sans cookie, jamais bloquante.
    await recordAttribution('audit', result.id, sanitizeAttribution((json as { attribution?: unknown } | null)?.attribution));
  } catch (e) {
    console.error('[api/audit] sauvegarde impossible', e);
    return NextResponse.json(
      { error: 'Nous n’avons pas pu enregistrer votre audit. Réessayez dans quelques minutes.' },
      { status: 500 },
    );
  }

  // E-mail fourni : enregistrement du lead (consentement marketing = case cochée) + envoi du rapport demandé.
  if (body.email) {
    const email = body.email;
    after(async () => {
      try {
        await saveLead({
          email,
          businessName: input.businessName,
          trade: input.trade,
          city: input.city,
          district: input.district,
          auditId: result.id,
          consent: body.marketingConsent,
          source: 'site',
        });
      } catch (e) {
        console.error('[api/audit] lead non enregistré', e);
      }
      // Plafond global d'envoi : au-delà, le rapport reste consultable en ligne, sans e-mail.
      const quota = await rateLimit('email-global-d', 'all', EMAIL_GLOBAL_PER_DAY, DAY_MS, { failClosed: true });
      if (!quota.ok) {
        console.error('[api/audit] plafond quotidien d’e-mails atteint : rapport non envoyé', result.id);
        return;
      }
      let pdf: Buffer | null = null;
      try {
        const mod = await import('@/lib/pdf/Report');
        pdf = await mod.renderReportPdf(result);
      } catch (e) {
        console.warn('[api/audit] PDF non généré, e-mail sans pièce jointe', e);
      }
      const sent = await sendReportEmail(email, result, { pdf });
      if (sent.status === 'error') console.error('[api/audit] e-mail non envoyé', sent.error);
    });
  }

  return NextResponse.json({ id: result.id, score: result.score, demo: result.demo }, { status: 201 });
}
