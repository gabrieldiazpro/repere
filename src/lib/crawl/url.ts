/**
 * Normalisation et classement des URL du crawl (pur, sans réseau).
 */

/** Paramètres de suivi retirés avant déduplication. */
const TRACKING = /^(utm_[a-z_]+|gclid|gclsrc|dclid|gbraid|wbraid|fbclid|msclkid|yclid|mc_cid|mc_eid|_ga|_gl|_hsenc|_hsmi|hsa_[a-z]+|igshid|srsltid|ref_src|mkt_tok|oly_anon_id|oly_enc_id|vero_id|wickedid|s_kwcid|_kx)$/i;

/** Extensions qui ne sont pas des pages HTML (on ne les met pas dans la file des pages). */
const NON_HTML_EXT = /\.(jpe?g|png|gif|webp|avif|svg|ico|bmp|tiff?|pdf|zip|rar|7z|gz|tgz|tar|mp[34]|m4[av]|mov|avi|webm|ogg|wav|flac|woff2?|ttf|otf|eot|css|js|mjs|json|xml|txt|csv|xlsx?|docx?|pptx?|odt|ods|exe|dmg|apk|rss|atom)$/i;

/**
 * Normalise une URL pour la déduplication : schéma et hôte en minuscules, port par défaut retiré, fragment retiré,
 * paramètres de suivi retirés, paramètres restants triés. Le chemin est conservé tel quel (« /a » ≠ « /a/ »).
 * Renvoie null pour ce qui n'est pas http(s).
 */
export function normalizeUrl(href: string, base?: string): string | null {
  let u: URL;
  try {
    u = base ? new URL(href.trim(), base) : new URL(href.trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  u.hash = '';
  u.hostname = u.hostname.toLowerCase().replace(/\.$/, '');
  if ((u.protocol === 'http:' && u.port === '80') || (u.protocol === 'https:' && u.port === '443')) u.port = '';
  if (u.search) {
    const kept = [...u.searchParams.entries()].filter(([k]) => !TRACKING.test(k));
    kept.sort(([a, av], [b, bv]) => (a === b ? av.localeCompare(bv) : a.localeCompare(b)));
    const sp = new URLSearchParams(kept);
    u.search = sp.toString() ? `?${sp.toString()}` : '';
  }
  if (!u.pathname) u.pathname = '/';
  return u.toString();
}

/**
 * Saisie utilisateur → URL de départ : schéma https ajouté s'il manque, slash final pour la racine,
 * fragment et paramètres de suivi retirés. `schemeGiven` dit si l'utilisateur a écrit le schéma lui-même.
 */
export function normalizeStartUrl(input: string): { url: string; schemeGiven: boolean } | null {
  const s = String(input ?? '').trim();
  if (!s || s.length > 2048) return null;
  const schemeGiven = /^[a-z][a-z0-9+.-]*:\/\//i.test(s);
  const url = normalizeUrl(schemeGiven ? s : `https://${s.replace(/^\/+/, '')}`);
  return url ? { url, schemeGiven } : null;
}

/** Hôte « de base » d'un site : sans « www. ». */
export function baseHost(host: string): string {
  return host.toLowerCase().replace(/\.$/, '').replace(/^www\./, '');
}

/** Une URL appartient-elle au site ? Même hôte (avec ou sans www), ou sous-domaine si `includeSubdomains`. */
export function isInternal(url: string, siteHost: string, includeSubdomains = false): boolean {
  let h: string;
  try {
    h = baseHost(new URL(url).hostname);
  } catch {
    return false;
  }
  const b = baseHost(siteHost);
  return h === b || (includeSubdomains && h.endsWith(`.${b}`));
}

export function looksLikeHtmlUrl(url: string): boolean {
  try {
    return !NON_HTML_EXT.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

/** Section d'une URL = premier segment du chemin (« /blog/x » → « blog »), « / » pour la racine. */
export function sectionOf(url: string): string {
  try {
    const seg = new URL(url).pathname.split('/').filter(Boolean)[0];
    return seg ? seg.toLowerCase() : '/';
  } catch {
    return '/';
  }
}

/** Échantillon équilibré : tour à tour une URL de chaque section, jusqu'à `max`. Ordre d'origine conservé par section. */
export function balancedSample(urls: string[], max: number): string[] {
  if (urls.length <= max) return [...urls];
  const groups = new Map<string, string[]>();
  for (const u of urls) {
    const k = sectionOf(u);
    const g = groups.get(k);
    if (g) g.push(u);
    else groups.set(k, [u]);
  }
  const lists = [...groups.values()];
  const out: string[] = [];
  for (let i = 0; out.length < max; i++) {
    let any = false;
    for (const l of lists) {
      if (i < l.length) {
        any = true;
        out.push(l[i]);
        if (out.length >= max) break;
      }
    }
    if (!any) break;
  }
  return out;
}
