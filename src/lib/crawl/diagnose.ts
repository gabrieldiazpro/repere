/**
 * Diagnostic d'accès d'une exploration (ROBUSTESSE V6) : ce que le robot a pu lire et, sinon, pourquoi.
 * Pur. L'analyse (src/lib/analysis/access.ts) en tire un état, un message en français et la marche à suivre ;
 * quand rien n'est lisible, aucun score n'est calculé (on ne note pas un site qu'on n'a pas vu).
 */
import type { AccessNoteCode, AccessState, CrawlDiagnosis, CrawledPage, SiteCrawl } from './types';

/** Défis anti-robots (pare-feu applicatif, CDN) reconnaissables dans une réponse. */
const CHALLENGE_BODY =
  /(cf-chl-|\/cdn-cgi\/challenge-platform|<title>just a moment\.\.\.<\/title>|attention required! \| cloudflare|cf-browser-verification|captcha-delivery\.com|geo\.captcha-delivery|px-captcha|perimeterx|_incapsula_resource|incapsula incident|sucuri website firewall|access denied \| [^<]* used cloudflare|verify you are human|vérifiez que vous êtes humain|vérification de sécurité|ddos-guard|aws-waf-token|awswaf)/i;

/** Nom du pare-feu ou du service anti-robots qui a répondu, ou null. */
export function firewallOf(status: number, headers: Record<string, string>, body?: string): string | null {
  const server = `${headers.server ?? ''} ${headers['x-cdn'] ?? ''}`.toLowerCase();
  const text = (body ?? '').slice(0, 30_000);
  const challenge = CHALLENGE_BODY.exec(text)?.[0]?.toLowerCase() ?? '';
  if (headers['cf-mitigated'] || (challenge && /cf-|cloudflare|just a moment|challenge-platform/.test(challenge))) return 'Cloudflare';
  if (headers['x-datadome'] || /captcha-delivery|datadome/.test(challenge)) return 'DataDome';
  if (/px-captcha|perimeterx/.test(challenge)) return 'HUMAN (PerimeterX)';
  if (/incapsula/.test(challenge) || headers['x-iinfo']) return 'Imperva (Incapsula)';
  if (/sucuri/.test(challenge) || headers['x-sucuri-id']) return 'Sucuri';
  if (/ddos-guard/.test(challenge) || /ddos-guard/.test(server)) return 'DDoS-Guard';
  if (/awswaf|aws-waf/.test(challenge)) return 'AWS WAF';
  if (challenge) return 'un service anti-robots';
  if ((status === 403 || status === 429 || status === 503) && /cloudflare|akamai|sucuri|imperva|incapsula|datadome/.test(server)) {
    const m = /cloudflare|akamai|sucuri|imperva|incapsula|datadome/.exec(server)![0];
    return m.charAt(0).toUpperCase() + m.slice(1);
  }
  return null;
}

const PARKED =
  /(this domain (is|may be) for sale|domain (is )?for sale|buy this domain|ce (nom de )?domaine (est|peut être) à vendre|nom de domaine à vendre|domaine en vente|sedoparking\.com|parkingcrew\.net|bodis\.com|dan\.com\/buy|afternic\.com|this domain (has been|is) (parked|registered)|domain parked|parked free, courtesy of|ce domaine a été réservé)/i;
const MAINTENANCE = /(maintenance|en travaux|bientôt de retour|we'?ll be back|under construction|site en construction|coming soon|ouverture prochaine)/i;

export interface CrawlSignals {
  /** code d'erreur de la page d'accueil (fetcher) */
  entryErrorCode?: string;
  entryError?: string;
  /** en-têtes et statut de la dernière réponse de la page d'accueil */
  entryHeaders?: Record<string, string>;
  entryStatus?: number;
  entryBody?: string;
  robots?: { errorCode?: string; status: number; isHtml?: boolean; blocksSome?: boolean };
  rateLimited?: { count: number; retryAfterS?: number; stopped: boolean };
  firewall?: { name: string; count: number; stopped: boolean };
  binaryPages?: number;
  hugePages?: number;
  trapSkipped?: number;
  slowPages?: number;
}

const retryAfterOf = (h?: Record<string, string>): number | undefined => {
  const v = h?.['retry-after'];
  if (!v) return undefined;
  const n = Number(v);
  if (Number.isFinite(n) && n >= 0) return Math.round(n);
  const d = Date.parse(v);
  return Number.isFinite(d) ? Math.max(0, Math.round((d - Date.now()) / 1000)) : undefined;
};

const isOkHtml = (p: CrawledPage) => p.status === 200 && !p.blockedByRobots && /html/i.test(p.contentType ?? 'text/html') && (p.wordCount > 0 || p.headings.length > 0 || p.internalLinks > 0 || (p.title ?? '') !== '');

export function diagnoseCrawl(c: SiteCrawl, sig: CrawlSignals): CrawlDiagnosis {
  const notes: CrawlDiagnosis['notes'] = [];
  const note = (code: AccessNoteCode, detail?: string) => {
    if (!notes.some((n) => n.code === code)) notes.push({ code, ...(detail ? { detail } : {}) });
  };
  const home = c.pages[0];
  const homeStatus = home?.status ?? sig.entryStatus ?? 0;
  const read = c.pages.filter(isOkHtml);
  const pagesRead = read.length;

  // ---- Signaux secondaires ----
  if (sig.robots?.errorCode === 'timeout') note('robots_timeout');
  else if (sig.robots && sig.robots.status === 0 && sig.robots.errorCode) note('robots_unreachable');
  if (sig.robots && sig.robots.status >= 500) note('robots_server_error', String(sig.robots.status));
  if (sig.robots?.isHtml) note('robots_html');
  if (sig.robots?.blocksSome) note('robots_blocks_some');
  try {
    const a = new URL(c.startUrl).hostname.replace(/^www\./, '');
    const b = new URL(c.finalOrigin).hostname.replace(/^www\./, '');
    if (a !== b) note('moved', new URL(c.finalOrigin).hostname);
    if (c.finalOrigin.startsWith('http:')) note('http_only');
  } catch {
    /* URL invalide : ignoré */
  }
  const homeChain = home?.redirectChain ?? [];
  const js = homeChain.find((h) => h.via === 'js');
  if (js) note('js_redirect', home.finalUrl);
  if (homeChain.some((h) => h.via === 'meta-refresh') || c.pages.some((p) => p.redirectChain.some((h) => h.via === 'meta-refresh'))) note('meta_refresh');
  if (c.pages.some((p) => p.redirectChain.some((h) => h.via === 'cookie'))) note('cookie_required');
  if (sig.rateLimited?.count) note('rate_limited_partial', String(sig.rateLimited.count));
  if (sig.firewall?.count) note('firewall_partial', sig.firewall.name);
  if (sig.slowPages) note('slow_pages', String(sig.slowPages));
  if (sig.hugePages) note('huge_page', String(sig.hugePages));
  if (sig.binaryPages) note('binary_pages', String(sig.binaryPages));
  if (sig.trapSkipped) note('url_traps', String(sig.trapSkipped));
  const jsPages = read.filter((p) => p.renderHints.likelyClientRendered && !p.rendered);
  if (jsPages.length) note('js_pages', String(jsPages.length));
  if (c.pages.some((p) => p.rendered)) note('rendered', String(c.pages.filter((p) => p.rendered).length));

  // ---- État principal ----
  let state: AccessState = 'ok';
  let firewall: string | undefined;
  let retryAfterS: number | undefined;
  const homeFw = home ? firewallOf(home.status, home.headers, sig.entryBody) : sig.entryHeaders ? firewallOf(sig.entryStatus ?? 0, sig.entryHeaders, sig.entryBody) : null;
  const body = sig.entryBody ?? '';
  const code = sig.entryErrorCode;

  if (!home) {
    state = code === 'timeout' ? 'timeout' : code === 'dns' ? 'dns' : code === 'redirect_loop' ? 'redirect_loop' : code === 'too_many_redirects' ? 'too_many_redirects' : 'unreachable';
  } else if (home.blockedByRobots) state = 'blocked_robots';
  else if (code === 'redirect_loop') state = sig.entryHeaders?.['set-cookie'] ? 'cookie_loop' : 'redirect_loop';
  else if (code === 'too_many_redirects') state = 'too_many_redirects';
  else if (homeFw) {
    state = 'blocked_firewall';
    firewall = homeFw;
  } else if (homeStatus === 429) {
    state = 'rate_limited';
    retryAfterS = retryAfterOf(home.headers);
  } else if (homeStatus === 401 || homeStatus === 407) state = 'auth_required';
  else if (homeStatus === 503 || (homeStatus >= 500 && MAINTENANCE.test(home.title ?? ''))) {
    state = MAINTENANCE.test(`${home.title ?? ''} ${body.slice(0, 5000)}`) || home.headers['retry-after'] ? 'maintenance' : 'server_error';
    retryAfterS = retryAfterOf(home.headers);
  } else if (homeStatus >= 500) state = 'server_error';
  else if (homeStatus === 403 && pagesRead === 0) {
    state = 'blocked_firewall';
    firewall = firewallOf(403, home.headers, body) ?? undefined;
  } else if (homeStatus >= 400 && pagesRead === 0) state = 'http_error';
  else if (homeStatus >= 300 && homeStatus < 400 && pagesRead === 0) state = 'unreachable';
  else if (/\/password\/?$/.test(new URL(home.finalUrl).pathname) && /shopify/i.test(JSON.stringify(home.headers) + body.slice(0, 20_000))) state = 'password_protected';
  else if (homeStatus === 200 && PARKED.test(`${home.title ?? ''} ${body.slice(0, 30_000)}`) && pagesRead <= 1) state = 'parked';
  else if (homeStatus === 200 && !/html/i.test(home.contentType ?? 'text/html')) state = pagesRead ? 'ok' : 'not_html';
  else if (homeStatus === 200 && sig.binaryPages && pagesRead === 0) state = 'not_html';
  else if (home.renderHints.likelyClientRendered && !home.rendered) state = 'js_only';
  else if (pagesRead === 0) state = 'empty';

  // Exploration arrêtée en route par une limitation ou un pare-feu : l'état reste lisible, la note le dit.
  if (state === 'ok' && sig.rateLimited?.stopped && pagesRead <= 1) {
    state = 'rate_limited';
    retryAfterS = sig.rateLimited.retryAfterS;
  }
  if (state === 'ok' && sig.firewall?.stopped && pagesRead <= 1) {
    state = 'blocked_firewall';
    firewall = sig.firewall.name;
  }

  const readable = pagesRead > 0 && !['blocked_robots', 'blocked_firewall', 'parked', 'password_protected', 'auth_required', 'maintenance', 'not_html'].includes(state);
  return {
    state,
    readable,
    pagesRead,
    homeStatus,
    ...(retryAfterS !== undefined ? { retryAfterS } : {}),
    ...(firewall ? { firewall } : {}),
    notes,
  };
}
