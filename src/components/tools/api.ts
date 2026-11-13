/**
 * Adaptateur client des endpoints AUDIT-SITE (src/app/api/tools/**, enveloppe src/lib/siteaudit/api.ts).
 * Réponse réelle : succès `{ ok: true, data }` ; échec `{ ok: false, error: string, code?: string }` avec un statut HTTP.
 * Aucune dépendance serveur : seuls des types sont importés de @/lib/siteaudit.
 */
import type {
  CheckStatus,
  CitabilityReport,
  CompareReport,
  JsonLdValidation,
  ProductReport,
  ReadinessReport,
  RobotsReport,
} from '@/lib/siteaudit/types';
import type { GenerateResult, GenerateType } from '@/lib/siteaudit/jsonld';
import type { LlmsResult } from '@/lib/siteaudit/llms';
import type { ReviewLinkResult } from '@/lib/siteaudit/reviewLink';

export type { CheckStatus };

export type ErrorKind = 'invalid' | 'unreachable' | 'limit' | 'blocked' | 'network' | 'unknown';

export interface ToolError {
  kind: ErrorKind;
  message: string;
  /** Conseil pour s'en sortir (affiché sous le message). */
  hint: string;
}

export type Outcome<T> = { ok: true; data: T } | { ok: false; error: ToolError };

/** Chemins des endpoints et formes de réponse (contrat docs/v3/12-CONTRATS-V3.md). */
export interface Endpoints {
  '/api/tools/robots': { body: { url: string; path?: string }; data: RobotsReport };
  '/api/tools/readiness': { body: { url: string }; data: ReadinessReport };
  '/api/tools/citability': { body: { url?: string; html?: string; question?: string }; data: CitabilityReport };
  '/api/tools/jsonld/validate': { body: { url?: string; jsonld?: string }; data: JsonLdValidation };
  '/api/tools/jsonld/generate': { body: { type: GenerateType; fields: Record<string, unknown> }; data: GenerateResult };
  '/api/tools/llms': { body: { url: string }; data: LlmsResult };
  '/api/tools/product': { body: { url: string }; data: ProductReport };
  '/api/tools/compare': { body: { url: string; competitorUrl: string }; data: CompareReport };
  '/api/tools/review-link': { body: { placeId?: string; name?: string; city?: string; color?: string }; data: ReviewLinkResult };
}
export type EndpointPath = keyof Endpoints;

/* ------------------------------------------------------------------ */
/* Validation d'URL côté navigateur (le serveur revérifie : SSRF, etc.) */
/* ------------------------------------------------------------------ */

export function normalizeUrl(input: string): { ok: true; url: string } | { ok: false; message: string } {
  let s = input.trim();
  if (!s) return { ok: false, message: 'Indiquez l’adresse du site, par exemple votre-commerce.fr.' };
  if (/\s/.test(s)) return { ok: false, message: 'Une adresse web ne contient pas d’espace. Vérifiez la saisie.' };
  if (/^[a-z][a-z0-9+.-]*:/i.test(s) && !/^https?:\/\//i.test(s)) {
    return { ok: false, message: 'Seules les adresses http et https peuvent être analysées.' };
  }
  if (!/^https?:\/\//i.test(s)) s = `https://${s.replace(/^\/+/, '')}`;
  try {
    const u = new URL(s);
    const h = u.hostname.toLowerCase();
    if (!h.includes('.') || h.endsWith('.')) return { ok: false, message: 'Cette adresse semble incomplète : il manque l’extension (.fr, .com…).' };
    if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h) || h.startsWith('[')) {
      return { ok: false, message: 'Seuls les sites publics peuvent être analysés.' };
    }
    u.hash = '';
    return { ok: true, url: u.toString() };
  } catch {
    return { ok: false, message: 'Cette adresse n’est pas valide. Exemple attendu : https://votre-commerce.fr' };
  }
}

export const hostOf = (url: string | null | undefined): string => {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

/* ------------------------------------------------------------------ */
/* Erreurs                                                             */
/* ------------------------------------------------------------------ */

const DEFAULTS: Record<ErrorKind, { message: string; hint: string }> = {
  invalid: { message: 'Cette adresse ne peut pas être analysée.', hint: 'Vérifiez-la, par exemple https://votre-commerce.fr, puis relancez.' },
  unreachable: { message: 'Le site ne répond pas.', hint: 'Ouvrez l’adresse dans votre navigateur pour vérifier qu’elle fonctionne, puis relancez.' },
  limit: { message: 'Limite d’analyses gratuites atteinte pour cette heure.', hint: 'Les outils sont limités par connexion pour éviter les abus. Réessayez dans une heure.' },
  blocked: { message: 'Le site refuse notre robot d’analyse.', hint: 'Si votre robots.txt bloque les robots, il bloque probablement aussi ceux des IA : testez-le avec le vérificateur robots.txt.' },
  network: { message: 'La connexion a été interrompue.', hint: 'Vérifiez votre réseau, puis relancez.' },
  unknown: { message: 'L’analyse n’a pas abouti.', hint: 'Réessayez dans quelques minutes.' },
};

/** Classe une erreur à partir du statut HTTP et du code renvoyé par l'API. */
export function kindFrom(status: number, code = ''): ErrorKind {
  const c = code.toLowerCase();
  if (status === 429 || c === 'rate_limited') return 'limit';
  if (c === 'robots_disallowed' || status === 403) return 'blocked';
  if (['timeout', 'dns', 'network', 'too_many_redirects'].includes(c) || [502, 503, 504, 408].includes(status)) return 'unreachable';
  if (c === 'invalid_url' || c.startsWith('blocked') || c === 'bad_request' || c === 'too_large' || status === 400 || status === 413 || status === 422) return 'invalid';
  return 'unknown';
}

/** Construit l'erreur affichée : le message serveur (déjà en français) prime, avec un conseil adapté. */
export function toolError(status: number, code: string, serverMessage: string): ToolError {
  const kind = kindFrom(status, code);
  const d = DEFAULTS[kind];
  // Les messages zod (« Requête invalide (url : …) ») sont techniques : on garde le message par défaut.
  const usable = serverMessage && !/^Requête invalide/.test(serverMessage) && kind !== 'unknown';
  return { kind, message: usable ? serverMessage : d.message, hint: d.hint };
}

export function localError(message: string, kind: ErrorKind = 'invalid'): ToolError {
  return { kind, message, hint: DEFAULTS[kind].hint };
}

/* ------------------------------------------------------------------ */
/* Appel                                                               */
/* ------------------------------------------------------------------ */

export async function callTool<P extends EndpointPath>(
  path: P,
  body: Endpoints[P]['body'],
  opts: { signal?: AbortSignal } = {},
): Promise<Outcome<Endpoints[P]['data']>> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: opts.signal,
    });
  } catch (e) {
    if ((e as { name?: string })?.name === 'AbortError') throw e;
    return { ok: false, error: { kind: 'network', ...DEFAULTS.network } };
  }
  const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: unknown; error?: unknown; code?: unknown } | null;
  if (res.ok && json && json.ok !== false && json.data !== undefined) {
    return { ok: true, data: json.data as Endpoints[P]['data'] };
  }
  const message = typeof json?.error === 'string' ? json.error : '';
  const code = typeof json?.code === 'string' ? json.code : '';
  return { ok: false, error: toolError(res.ok ? 500 : res.status, code, message) };
}

/* ------------------------------------------------------------------ */
/* Partage par ?url=                                                   */
/* ------------------------------------------------------------------ */

/** Lit les paramètres de partage de l'adresse courante (côté navigateur seulement). */
export function readShareParams(search: string): Record<string, string> {
  const out: Record<string, string> = {};
  const p = new URLSearchParams(search);
  for (const k of ['url', 'concurrent', 'placeid', 'nom', 'ville', 'mode']) {
    const v = p.get(k);
    if (v && v.length <= 2048) out[k] = v;
  }
  return out;
}

/** Adresse partageable d'un résultat. */
export function shareHref(origin: string, path: string, params: Record<string, string | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  const s = q.toString();
  return `${origin}${path}${s ? `?${s}` : ''}`;
}

/** Met à jour l'adresse sans recharger la page (résultat partageable). */
export function replaceShareParams(params: Record<string, string | undefined>): void {
  if (typeof window === 'undefined') return;
  const href = shareHref(window.location.origin, window.location.pathname, params);
  window.history.replaceState(window.history.state, '', href);
}

/* ------------------------------------------------------------------ */
/* Statuts                                                             */
/* ------------------------------------------------------------------ */

export const STATUS_LABEL: Record<CheckStatus, string> = { ok: 'Réussi', warn: 'À améliorer', fail: 'À corriger' };
const ORDER: Record<CheckStatus, number> = { fail: 0, warn: 1, ok: 2 };

/** Contrôles à corriger d'abord, puis par points perdus décroissants. */
export function sortChecks<T extends { status: CheckStatus; points?: number; maxPoints?: number; informational?: boolean }>(checks: T[]): T[] {
  return [...checks].sort((a, b) => {
    const s = ORDER[a.status] - ORDER[b.status];
    if (s) return s;
    if (!!a.informational !== !!b.informational) return a.informational ? 1 : -1;
    const la = (a.maxPoints ?? 0) - (a.points ?? 0);
    const lb = (b.maxPoints ?? 0) - (b.points ?? 0);
    return lb - la;
  });
}

/** Tranche d'un score technique (pas un score de visibilité IA). */
export function scoreBand(score: number): { label: string; tone: 'ok' | 'warn' | 'fail' } {
  if (score >= 70) return { label: 'Base solide', tone: 'ok' };
  if (score >= 40) return { label: 'Lecture partielle', tone: 'warn' };
  return { label: 'Lecture difficile', tone: 'fail' };
}

/* ------------------------------------------------------------------ */
/* Surlignage des extraits citables                                    */
/* ------------------------------------------------------------------ */

export type Segment = { text: string; mark: boolean };

/** Découpe un texte en segments surlignés là où apparaissent les extraits (sans chevauchement). */
export function highlight(text: string, extracts: string[]): Segment[] {
  const ranges: [number, number][] = [];
  for (const e of extracts) {
    const needle = e.trim();
    if (needle.length < 12) continue;
    const i = text.indexOf(needle);
    if (i >= 0 && !ranges.some(([a, b]) => i < b && i + needle.length > a)) ranges.push([i, i + needle.length]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const out: Segment[] = [];
  let pos = 0;
  for (const [a, b] of ranges) {
    if (a > pos) out.push({ text: text.slice(pos, a), mark: false });
    out.push({ text: text.slice(a, b), mark: true });
    pos = b;
  }
  if (pos < text.length) out.push({ text: text.slice(pos), mark: false });
  return out;
}

/** Fichier téléchargeable à partir d'un texte (SVG, llms.txt, robots.txt). */
export function downloadText(filename: string, content: string, type = 'text/plain;charset=utf-8'): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ------------------------------------------------------------------ */
/* Texte collé (outil de citabilité)                                   */
/* ------------------------------------------------------------------ */

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Un texte brut devient du HTML simple : lignes « # Titre » ou finissant par « ? » courtes = titres, « - » = listes. */
export function textToHtml(input: string): string {
  if (/<\s*(p|h[1-6]|ul|ol|li|div|article|section|main|table|br)\b/i.test(input)) return input;
  const blocks = input.replace(/\r\n?/g, '\n').split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  let first = true;
  return blocks
    .map((b) => {
      const lines = b.split('\n').map((l) => l.trim()).filter(Boolean);
      if (lines.every((l) => /^[-*•]\s+/.test(l))) return `<ul>${lines.map((l) => `<li>${escapeHtml(l.replace(/^[-*•]\s+/, ''))}</li>`).join('')}</ul>`;
      const one = lines.join(' ');
      const heading = /^#{1,3}\s+/.test(one) || (lines.length === 1 && one.length <= 110 && (/\?$/.test(one) || !/[.!:;]$/.test(one)));
      if (heading) {
        const tag = first ? 'h1' : 'h2';
        first = false;
        return `<${tag}>${escapeHtml(one.replace(/^#{1,3}\s+/, ''))}</${tag}>`;
      }
      first = false;
      return `<p>${escapeHtml(one)}</p>`;
    })
    .join('\n');
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', eacute: 'é', egrave: 'è', agrave: 'à' };

/** Texte lisible d'un HTML (blocs séparés par des sauts de ligne), pour l'affichage avec surlignage. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<\/(p|h[1-6]|li|div|tr|section|article|details|summary|blockquote)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === '#') {
        const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(n) ? String.fromCodePoint(n) : m;
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
