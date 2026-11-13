/**
 * Attribution « première page / UTM » : partie pure, utilisable dans le navigateur (aucun accès au stockage).
 * Voir src/lib/roi/attribution.ts.
 */
/** Origine d'une visite, telle qu'envoyée par le navigateur (champs courts, tous facultatifs). */
export interface Attribution {
  /** utm_source / utm_medium / utm_campaign */
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  /** chemin de la première page vue sur le site (sans paramètres) */
  landing?: string;
  /** domaine du site d'où venait la première page (referrer), sans chemin */
  referrerHost?: string;
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TOKEN_RE = /^[A-Za-z0-9 ._\-+]{1,60}$/;
const HOST_RE = /^[a-z0-9.-]{1,120}$/;
const PATH_RE = /^\/[A-Za-z0-9/_\-.~%]{0,199}$/;

function token(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim().slice(0, 60);
  return t && TOKEN_RE.test(t) ? t.toLowerCase() : undefined;
}

function path(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const p = v.split(/[?#]/)[0].slice(0, 200);
  return PATH_RE.test(p) ? p : undefined;
}

function host(v: unknown): string | undefined {
  if (typeof v !== 'string' || !v) return undefined;
  let h = v.trim().toLowerCase();
  try {
    if (/^https?:\/\//.test(h)) h = new URL(h).hostname;
  } catch {
    return undefined;
  }
  h = h.replace(/^www\./, '');
  return HOST_RE.test(h) ? h : undefined;
}

/** Valide une origine reçue d'un formulaire public (tout champ invalide est ignoré). Null si rien d'utile. */
export function sanitizeAttribution(raw: unknown): Attribution | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const a: Attribution = {};
  const s = token(o.utmSource);
  const m = token(o.utmMedium);
  const c = token(o.utmCampaign);
  const l = path(o.landing);
  const r = host(o.referrerHost);
  if (s) a.utmSource = s;
  if (m) a.utmMedium = m;
  if (c) a.utmCampaign = c;
  if (l) a.landing = l;
  if (r) a.referrerHost = r;
  return Object.keys(a).length ? a : null;
}

/**
 * Origine lue dans une adresse et un referrer (pur ; utilisé côté navigateur à la première page vue).
 * `selfHost` : domaine du site, pour ne pas compter la navigation interne comme une source.
 */
export function attributionFromLocation(input: { href: string; referrer?: string | null; selfHost?: string | null }): Attribution | null {
  let u: URL;
  try {
    u = new URL(input.href);
  } catch {
    return null;
  }
  const q = u.searchParams;
  const ref = host(input.referrer ?? '');
  const self = host(input.selfHost ?? u.hostname);
  return sanitizeAttribution({
    utmSource: q.get('utm_source') ?? undefined,
    utmMedium: q.get('utm_medium') ?? undefined,
    utmCampaign: q.get('utm_campaign') ?? undefined,
    landing: u.pathname,
    referrerHost: ref && ref !== self ? ref : undefined,
  });
}

/** Paramètres UTM des liens sortant d'un baromètre (vers l'audit, l'analyse ou l'inscription). */
export const BAROMETRE_UTM = { source: 'repere', medium: 'barometre' } as const;

export function barometreUtm(slug: string): string {
  return `utm_source=${BAROMETRE_UTM.source}&utm_medium=${BAROMETRE_UTM.medium}&utm_campaign=${encodeURIComponent(slug)}`;
}

/** Slug du baromètre d'origine : première page /barometre/<slug>, ou UTM medium=barometre (campagne = slug). */
export function barometreOf(a: Attribution | null | undefined): string | null {
  if (!a) return null;
  const m = a.landing?.match(/^\/barometre\/([a-z0-9-]+)(?:\/|$)/);
  if (m && SLUG_RE.test(m[1])) return m[1];
  if (a.landing === '/barometre' || a.landing === '/barometre/') return 'index';
  if (a.utmMedium === BAROMETRE_UTM.medium) return a.utmCampaign && SLUG_RE.test(a.utmCampaign) ? a.utmCampaign : 'index';
  return null;
}

