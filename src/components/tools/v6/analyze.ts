/**
 * Analyse des outils V6 à partir d'une page déjà récupérée (aucun réseau ici) : title et meta, indexabilité,
 * redirections, en-têtes HTTP, hreflang, Open Graph, liens, sitemap. Réutilise l'extraction du crawl
 * (src/lib/crawl/extract.ts) et le lecteur RFC 9309 (src/lib/siteaudit/robots.ts). Côté serveur uniquement.
 */
import { extractPage, hasNoindex } from '@/lib/crawl/extract';
import { parseSitemap } from '@/lib/crawl/sitemap';
import { decide, parseRobots } from '@/lib/siteaudit/robots';
import { decodeEntities, parseAttrs, stripTags, tags } from '@/lib/siteaudit/html';
import { check, count, hreflangCode, lastmodIssue, pl, serpPreview, titleDescriptionChecks, worst } from './pure';
import type {
  HeaderGroup,
  HeaderRow,
  HeadersReport,
  Hop,
  HreflangEntry,
  HreflangReport,
  IndexReport,
  LinkRow,
  LinksReport,
  MetaReport,
  OgImageCheck,
  OgReport,
  RedirectReport,
  RedirectVariant,
  SitemapReport,
  V6Check,
  Verdict,
} from './types';

/** Page récupérée (par CrawlFetcher, ou construite pour les exemples et les tests). */
export interface PageFetch {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  chain: Hop[];
  headers: Record<string, string>;
  html: string | null;
  fetchMs: number;
  error?: string;
  errorCode?: string;
}

const now = () => new Date().toISOString();
const host = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return u;
  }
};
const sameUrl = (a: string, b: string) => {
  const n = (u: string) => {
    try {
      const x = new URL(u);
      x.hash = '';
      return `${x.protocol}//${x.hostname.replace(/^www\./, '')}${x.pathname.replace(/\/+$/, '') || '/'}${x.search}`;
    } catch {
      return u;
    }
  };
  return n(a) === n(b);
};

function verdictOf(checks: V6Check[], titles: Record<'ok' | 'warn' | 'fail', string>, text?: string): Verdict {
  const tone = worst(checks);
  const f = count(checks, 'fail');
  const w = count(checks, 'warn');
  return {
    tone,
    title: titles[tone],
    text: text ?? (tone === 'ok' ? 'Aucun point bloquant.' : [f ? pl(f, 'point à corriger', 'points à corriger') : '', w ? pl(w, 'point à améliorer', 'points à améliorer') : ''].filter(Boolean).join(', ') + '.'),
  };
}

/* ------------------------------------------------------------------ */
/* Title et meta description                                           */
/* ------------------------------------------------------------------ */

export function analyzeMeta(p: PageFetch): MetaReport {
  const html = p.html ?? '';
  const ex = extractPage(html, p.finalUrl);
  const head = /<head\b[^>]*>([\s\S]*?)<\/head>/i.exec(html.replace(/<!--[\s\S]*?-->/g, ''))?.[1] ?? html;
  const titleCount = (head.replace(/<svg\b[\s\S]*?<\/svg>/gi, '').match(/<title\b/gi) ?? []).length;
  const descriptionCount = tags(head, 'meta').filter((t) => (t.attrs.name ?? '').toLowerCase() === 'description').length;
  const title = ex.title ?? null;
  const description = ex.metaDescription ? decodeEntities(ex.metaDescription).replace(/\s+/g, ' ').trim() : null;
  const checks = titleDescriptionChecks(title ?? '', description ?? '');
  if (titleCount > 1) checks.push(check('title.multiple', `${titleCount} balises <title> dans la page`, 'warn', 'Google n’en retient qu’une, pas forcément celle que vous voulez.', 'Gardez une seule balise <title> dans le <head> (souvent un doublon entre le thème et une extension SEO).'));
  if (descriptionCount > 1) checks.push(check('desc.multiple', `${descriptionCount} meta descriptions`, 'warn', 'Plusieurs balises description se contredisent.', 'Supprimez le doublon (thème ou extension SEO).'));
  const h1 = ex.h1.filter(Boolean);
  if (!h1.length) checks.push(check('h1.missing', 'Pas de titre H1 visible dans le HTML', 'warn', 'Le H1 annonce le sujet de la page au visiteur ; Google s’en sert aussi pour réécrire les titres.', 'Ajoutez un H1 qui reprend l’idée du title, en phrase naturelle.'));
  else if (h1.length > 1) checks.push(check('h1.multiple', `${h1.length} titres H1`, 'ok', `${h1.slice(0, 3).map((x) => `« ${x.slice(0, 60)} »`).join(', ')}. Plusieurs H1 sont tolérés, un seul reste plus clair.`, '', true));
  else checks.push(check('h1.ok', 'Un titre H1', 'ok', `« ${h1[0].slice(0, 120)} »`));
  if (p.status >= 400) checks.unshift(check('http', `La page répond ${p.status}`, 'fail', 'Une page en erreur ne s’affiche pas dans Google, quel que soit son titre.', 'Corrigez l’adresse ou rétablissez la page.'));
  const verdict = verdictOf(checks, {
    ok: 'Titre et description prêts pour Google',
    warn: 'Titre et description à retoucher',
    fail: title ? 'Titre ou description à corriger' : 'Cette page n’a pas de titre',
  });
  return {
    url: p.requestedUrl,
    finalUrl: p.finalUrl,
    status: p.status,
    verdict,
    checks,
    checkedAt: now(),
    title,
    titleCount,
    description,
    descriptionCount,
    h1,
    lang: ex.lang ?? null,
    serp: serpPreview({ title: title ?? '', description: description ?? '', url: p.finalUrl, pageText: stripTags(html.replace(/<head\b[\s\S]*?<\/head>/i, '').replace(/<(script|style|nav|header|footer)\b[\s\S]*?<\/\1>/gi, ' ')) }),
  };
}

/* ------------------------------------------------------------------ */
/* Indexabilité                                                        */
/* ------------------------------------------------------------------ */

export interface RobotsFile {
  url: string;
  status: number;
  text?: string;
}

export function analyzeIndex(p: PageFetch, robots: RobotsFile | null): IndexReport {
  const html = p.html ?? '';
  const isHtml = /html/i.test(p.headers['content-type'] ?? 'text/html');
  const ex = html && isHtml ? extractPage(html, p.finalUrl) : null;
  const xr = p.headers['x-robots-tag'] ?? null;
  const metaRobots = ex?.metaRobots ?? null;
  const canonical = ex?.canonical ?? null;
  const checks: V6Check[] = [];
  const blockers: string[] = [];

  // 1. Réponse HTTP
  if (p.status >= 200 && p.status < 300) checks.push(check('status', `La page répond ${p.status}`, 'ok', 'Réponse normale.'));
  else {
    checks.push(check('status', `La page répond ${p.status || 'sans code'}`, 'fail', p.status >= 500 ? 'Erreur du serveur : Google réessaie, puis retire la page.' : p.status === 404 || p.status === 410 ? 'Page introuvable : elle ne peut pas être indexée.' : 'Code de réponse inattendu.', 'Rétablissez la page ou redirigez-la (301) vers son équivalent.'));
    blockers.push(`elle répond ${p.status}`);
  }
  if (p.chain.length) checks.push(check('redirect', `Redirigée ${pl(p.chain.length, 'fois', 'fois')} vers ${p.finalUrl}`, 'warn', 'Google indexe la page d’arrivée, pas l’adresse testée.', 'Dans vos liens et votre sitemap, utilisez directement l’adresse finale.'));

  // 2. robots.txt (Googlebot et Bingbot)
  let allowedGoogle = true;
  let allowedBing = true;
  let rule: string | null = null;
  const found = !!robots && robots.status >= 200 && robots.status < 300 && typeof robots.text === 'string';
  if (found) {
    const parsed = parseRobots(robots!.text!);
    const u = new URL(p.finalUrl);
    const path = u.pathname + u.search;
    const g = decide(parsed, 'Googlebot', path);
    const b = decide(parsed, 'Bingbot', path);
    allowedGoogle = g.allowed;
    allowedBing = b.allowed;
    rule = g.rule ? `${g.rule.allow ? 'Allow' : 'Disallow'}: ${g.rule.path}` : null;
    if (!allowedGoogle) {
      checks.push(check('robots', 'Le robots.txt interdit cette page à Googlebot', 'fail', `Règle « ${rule} ». Google ne lit pas la page ; il peut tout de même afficher l’adresse seule si d’autres sites y renvoient.`, 'Retirez ou précisez cette règle Disallow. Pour retirer une page de Google, utilisez plutôt noindex en laissant la page accessible.'));
      blockers.push('le robots.txt la bloque');
    } else checks.push(check('robots', 'Le robots.txt autorise Googlebot', 'ok', rule ? `Règle décisive : « ${rule} ».` : 'Aucune règle ne vise cette page.'));
    if (!allowedBing && allowedGoogle) checks.push(check('robots.bing', 'Le robots.txt bloque Bingbot', 'warn', 'Bing alimente aussi Copilot et d’autres assistants.', 'Vérifiez le groupe « User-agent: Bingbot ».'));
  } else if (robots && robots.status >= 500) {
    checks.push(check('robots', `robots.txt en erreur (${robots.status})`, 'fail', 'Quand le robots.txt répond une erreur serveur, Google peut suspendre l’exploration du site.', 'Faites répondre /robots.txt en 200 (ou 404 s’il n’existe pas).'));
    blockers.push('le robots.txt est en erreur');
  } else checks.push(check('robots', 'Pas de robots.txt : rien n’est interdit', 'ok', 'Sans fichier, tous les robots peuvent lire le site.'));

  // 3. noindex
  const metaNo = hasNoindex(metaRobots ?? undefined, undefined);
  const headerNo = hasNoindex(undefined, xr ?? undefined);
  if (metaNo) {
    checks.push(check('meta-robots', 'Balise meta robots « noindex »', 'fail', `Valeur : « ${metaRobots} ». Google retire la page de ses résultats.`, 'Retirez noindex de la balise <meta name="robots"> si la page doit apparaître (souvent une case « décourager les moteurs » laissée cochée).'));
    blockers.push('elle porte noindex');
  } else checks.push(check('meta-robots', metaRobots ? `Meta robots : « ${metaRobots} »` : 'Pas de meta robots bloquante', 'ok', 'Aucune consigne noindex dans le HTML.'));
  if (headerNo) {
    checks.push(check('x-robots', 'En-tête X-Robots-Tag « noindex »', 'fail', `Valeur : « ${xr} ». Consigne envoyée par le serveur, invisible dans le code de la page.`, 'Retirez cet en-tête dans la configuration du serveur ou du CDN.'));
    blockers.push('le serveur envoie X-Robots-Tag: noindex');
  } else if (xr) checks.push(check('x-robots', `X-Robots-Tag : « ${xr} »`, 'ok', 'Pas de noindex.', '', true));
  if (/\bnofollow\b/i.test(`${metaRobots ?? ''} ${xr ?? ''}`)) checks.push(check('nofollow', 'Consigne nofollow', 'warn', 'Google ne suit pas les liens de cette page.', 'Retirez nofollow sauf raison précise.'));

  // 4. canonical
  if (!isHtml) checks.push(check('type', `Contenu non HTML (${p.headers['content-type'] ?? 'inconnu'})`, 'ok', 'Les PDF et images peuvent être indexés ; les balises HTML ne s’appliquent pas.', '', true));
  else if (!canonical) checks.push(check('canonical', 'Pas de balise canonical', 'warn', 'Sans canonical, Google choisit seul l’adresse de référence entre les variantes (paramètres, www, majuscules).', 'Ajoutez <link rel="canonical" href="adresse-de-la-page"> pointant vers la page elle-même.'));
  else if (sameUrl(canonical, p.finalUrl)) checks.push(check('canonical', 'Canonical vers la page elle-même', 'ok', canonical));
  else {
    checks.push(check('canonical', 'La canonical désigne une autre page', 'warn', `${canonical}. Google indexera probablement cette autre adresse à la place de celle-ci.`, 'Si cette page doit apparaître, faites pointer la canonical vers elle-même.'));
  }

  const hard = blockers.length > 0;
  const soft = !hard && (checks.some((c) => c.id === 'canonical' && c.status === 'warn' && canonical) || p.chain.length > 0);
  const indexable: IndexReport['indexable'] = hard ? 'no' : soft ? 'maybe' : 'yes';
  const verdict: Verdict =
    indexable === 'no'
      ? { tone: 'fail', title: `Google ne peut pas indexer cette page : ${blockers[0]}`, text: blockers.length > 1 ? `Autres blocages : ${blockers.slice(1).join(', ')}.` : 'Corrigez ce point, puis demandez une nouvelle indexation dans la Search Console.' }
      : indexable === 'maybe'
        ? { tone: 'warn', title: 'Page indexable, mais Google indexera sans doute une autre adresse', text: p.chain.length ? 'L’adresse testée redirige.' : 'La canonical désigne une autre page.' }
        : { tone: worst(checks), title: 'Rien n’empêche Google d’indexer cette page', text: 'Indexable ne veut pas dire indexée : la Search Console dit si elle l’est réellement.' };
  return {
    url: p.requestedUrl,
    finalUrl: p.finalUrl,
    status: p.status,
    verdict,
    checks,
    checkedAt: now(),
    indexable,
    chain: p.chain,
    metaRobots,
    xRobotsTag: xr,
    canonical,
    robots: { url: robots?.url ?? '', found, allowedGoogle, allowedBing, rule },
  };
}

/* ------------------------------------------------------------------ */
/* Redirections                                                        */
/* ------------------------------------------------------------------ */

export interface ChainResult {
  start: string;
  chain: Hop[];
  final: Hop;
  error?: string;
  errorCode?: string;
}

const TEMP = new Set([302, 303, 307]);

export function analyzeRedirects(main: ChainResult, variants: ChainResult[] = []): RedirectReport {
  const checks: V6Check[] = [];
  const loop = main.errorCode === 'redirect_loop';
  const hops = main.chain.length;
  if (loop) checks.push(check('loop', 'Boucle de redirection', 'fail', `Les adresses se renvoient l’une à l’autre : ${main.chain.map((h) => h.url).slice(0, 4).join(' → ')}. Ni les visiteurs ni Google n’atteignent la page.`, 'Corrigez la règle en cause (souvent une redirection http→https combinée à une redirection www en sens inverse, ou une extension de redirection en conflit).'));
  else if (main.errorCode === 'too_many_redirects') checks.push(check('hops', 'Plus de 5 redirections enchaînées', 'fail', 'Google arrête de suivre une chaîne trop longue.', 'Faites pointer la première adresse directement vers la page finale.'));
  else if (main.error) checks.push(check('error', 'La chaîne n’a pas pu être suivie jusqu’au bout', 'fail', main.error, 'Vérifiez que l’adresse s’ouvre dans un navigateur.'));
  else if (hops === 0) checks.push(check('hops', 'Aucune redirection', 'ok', 'L’adresse répond directement.'));
  else if (hops === 1) checks.push(check('hops', 'Une seule redirection', 'ok', 'C’est l’idéal quand une page a changé d’adresse.'));
  else checks.push(check('hops', `${hops} redirections enchaînées`, hops >= 4 ? 'fail' : 'warn', 'Chaque saut ralentit la page et dilue un peu les signaux transmis.', 'Remplacez la chaîne par une redirection unique de la première adresse vers la dernière.'));
  const temps = main.chain.filter((h) => TEMP.has(h.status));
  if (temps.length && !loop) checks.push(check('temp', `${pl(temps.length, 'redirection temporaire', 'redirections temporaires')} (${[...new Set(temps.map((t) => t.status))].join(', ')})`, 'warn', 'Une redirection 302 ou 307 dit à Google que l’ancienne adresse reviendra : il peut continuer à l’afficher.', 'Pour un changement définitif, utilisez une redirection 301 (ou 308).'));
  if (!loop && !main.error) {
    const f = main.final.status;
    if (f >= 200 && f < 300) checks.push(check('final', `Page finale : ${f}`, 'ok', main.final.url));
    else checks.push(check('final', `La page finale répond ${f}`, 'fail', `${main.final.url} : la redirection aboutit à une erreur.`, 'Faites pointer la redirection vers une page qui existe.'));
  }
  const firstHttp = main.start.startsWith('http://');
  if (!loop && main.final.url.startsWith('http://')) checks.push(check('https', 'La page finale n’est pas en HTTPS', 'fail', 'Navigateurs et moteurs signalent les sites sans HTTPS comme non sécurisés.', 'Activez un certificat (souvent gratuit chez l’hébergeur) et redirigez http vers https.'));
  else if (firstHttp && hops > 0 && !loop) checks.push(check('https', 'http redirigé vers https', 'ok', 'La version non sécurisée renvoie bien vers HTTPS.'));

  // Variantes http/https × www/sans www : elles doivent toutes aboutir à la même adresse.
  const vrows: RedirectVariant[] = variants.map((v) => ({ start: v.start, final: v.final.url, status: v.final.status, hops: v.chain.length, ...(v.error ? { error: v.error } : {}) }));
  if (vrows.length) {
    const okRows = vrows.filter((v) => !v.error && v.status >= 200 && v.status < 300);
    const finals = new Set(okRows.map((v) => v.final.replace(/\/$/, '')));
    const broken = vrows.filter((v) => v.error || v.status >= 400);
    if (broken.length) checks.push(check('variants.broken', `${pl(broken.length, 'variante ne répond pas', 'variantes ne répondent pas')} correctement`, 'warn', broken.map((b) => `${b.start} : ${b.error ?? b.status}`).join(' ; '), 'Configurez votre domaine pour que chaque variante (avec et sans www, http et https) redirige vers l’adresse principale.'));
    if (finals.size > 1) checks.push(check('variants.split', `Les variantes aboutissent à ${finals.size} adresses différentes`, 'warn', [...finals].join(' ; '), 'Choisissez une adresse principale (avec ou sans www, en https) et redirigez toutes les autres vers elle en 301 : sinon Google peut voir deux sites.'));
    else if (finals.size === 1 && !broken.length) checks.push(check('variants.ok', 'Les 4 variantes de l’adresse mènent à la même page', 'ok', [...finals][0]));
  }

  const tone = worst(checks);
  const verdict: Verdict = loop
    ? { tone: 'fail', title: 'Boucle de redirection : la page est inaccessible', text: 'Ni les visiteurs ni Google ne peuvent l’ouvrir.' }
    : {
        tone,
        title:
          tone === 'fail'
            ? 'Cette redirection aboutit à une erreur'
            : hops === 0
              ? tone === 'ok'
                ? 'Pas de redirection : l’adresse répond directement'
                : 'L’adresse répond directement, mais ses variantes sont à revoir'
              : tone === 'ok'
                ? `Redirection propre : ${pl(hops, 'saut', 'sauts')} vers une page qui répond`
                : `Redirection à simplifier : ${pl(hops, 'saut', 'sauts')}`,
        text: `${main.start} → ${main.final.url} (${main.final.status}).`,
      };
  return { url: main.start, verdict, checks, chain: main.chain, final: main.final, loop, error: main.error ?? null, variants: vrows, checkedAt: now() };
}

/** Les 4 variantes d'une adresse (http/https, avec/sans www), en gardant chemin et paramètres. */
export function urlVariants(url: string): string[] {
  const u = new URL(url);
  const bare = u.hostname.replace(/^www\./, '');
  if (/^\d+\.\d+\.\d+\.\d+$/.test(bare) || bare.split('.').length > 2 && !u.hostname.startsWith('www.')) {
    // Sous-domaine autre que www (boutique.exemple.fr) : seulement http et https.
    return ['https:', 'http:'].map((p) => `${p}//${u.hostname}${u.pathname}${u.search}`);
  }
  const out: string[] = [];
  for (const p of ['https:', 'http:']) for (const h of [bare, `www.${bare}`]) out.push(`${p}//${h}${u.pathname}${u.search}`);
  return out;
}

/* ------------------------------------------------------------------ */
/* En-têtes HTTP                                                       */
/* ------------------------------------------------------------------ */

const GROUP: Record<string, HeaderGroup> = {
  'x-robots-tag': 'indexation', link: 'indexation', 'content-language': 'indexation',
  'cache-control': 'cache', expires: 'cache', etag: 'cache', 'last-modified': 'cache', age: 'cache', vary: 'cache', pragma: 'cache',
  'strict-transport-security': 'securite', 'content-security-policy': 'securite', 'content-security-policy-report-only': 'securite',
  'x-content-type-options': 'securite', 'x-frame-options': 'securite', 'referrer-policy': 'securite', 'permissions-policy': 'securite',
  'cross-origin-opener-policy': 'securite', 'set-cookie': 'securite',
  'content-type': 'contenu', 'content-encoding': 'contenu', 'content-length': 'contenu', 'transfer-encoding': 'contenu',
  server: 'serveur', 'x-powered-by': 'serveur', via: 'serveur', 'x-cache': 'serveur', 'cf-cache-status': 'serveur', 'x-served-by': 'serveur',
};
const GROUP_ORDER: HeaderGroup[] = ['indexation', 'cache', 'securite', 'contenu', 'serveur', 'autre'];

export function headerRows(headers: Record<string, string>): HeaderRow[] {
  return Object.entries(headers)
    .map(([name, value]) => ({
      name: name.toLowerCase(),
      // Les cookies peuvent contenir des identifiants : jamais affichés.
      value: name.toLowerCase() === 'set-cookie' ? `présent (${value.split(/,(?=\s*[^;,=\s]+=)/).length} cookie(s), valeur masquée)` : value.slice(0, 600),
      group: GROUP[name.toLowerCase()] ?? 'autre',
    }))
    .sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) || a.name.localeCompare(b.name));
}

export function analyzeHeaders(p: PageFetch): HeadersReport {
  const h = p.headers;
  const checks: V6Check[] = [];
  const https = p.finalUrl.startsWith('https://');
  const ct = h['content-type'] ?? '';
  const isHtml = /html/i.test(ct);
  if (p.status >= 200 && p.status < 300) checks.push(check('status', `Statut ${p.status}`, 'ok', p.chain.length ? `Après ${pl(p.chain.length, 'redirection', 'redirections')}.` : 'Réponse directe.'));
  else checks.push(check('status', `Statut ${p.status}`, 'fail', 'La page ne répond pas normalement.', 'Rétablissez la page ou corrigez l’adresse.'));
  if (!https) checks.push(check('https', 'Page servie sans HTTPS', 'fail', 'Les navigateurs affichent « Non sécurisé ».', 'Activez HTTPS et redirigez http vers https.'));
  const xr = h['x-robots-tag'];
  if (xr && hasNoindex(undefined, xr)) checks.push(check('x-robots', `X-Robots-Tag : « ${xr} »`, 'fail', 'Le serveur demande aux moteurs de ne pas indexer cette page.', 'Retirez cet en-tête si la page doit apparaître dans Google.'));
  else if (xr) checks.push(check('x-robots', `X-Robots-Tag : « ${xr} »`, 'ok', 'Pas de noindex.', '', true));
  if (!ct) checks.push(check('ctype', 'Pas de Content-Type', 'warn', 'Le navigateur doit deviner le type de contenu.', 'Envoyez « Content-Type: text/html; charset=utf-8 ».'));
  else if (isHtml && !/charset=/i.test(ct)) checks.push(check('ctype', 'Encodage non déclaré dans Content-Type', 'warn', `« ${ct} » : les accents peuvent mal s’afficher si la page ne le déclare pas non plus.`, 'Ajoutez « ; charset=utf-8 ».'));
  else checks.push(check('ctype', `Content-Type : ${ct}`, 'ok', 'Type et encodage déclarés.'));
  const enc = h['content-encoding'];
  if (isHtml && !enc) checks.push(check('gzip', 'Page non compressée', 'warn', 'Sans gzip ni brotli, la page pèse plusieurs fois plus lourd sur le réseau.', 'Activez la compression gzip ou brotli (une option chez la plupart des hébergeurs et CDN).'));
  else if (enc) checks.push(check('gzip', `Compression ${enc}`, 'ok', 'La page voyage compressée.'));
  const cc = h['cache-control'];
  if (!cc && !h.expires) checks.push(check('cache', 'Pas de consigne de cache', 'warn', 'Navigateurs et CDN ne savent pas combien de temps garder la page.', 'Définissez Cache-Control (ex. « public, max-age=300 » pour une page qui change peu, « no-cache » pour une page dynamique).'));
  else checks.push(check('cache', `Cache-Control : ${cc ?? `Expires ${h.expires}`}`, 'ok', /no-store/i.test(cc ?? '') ? 'Page jamais mise en cache : normal pour une page personnalisée, plus lent pour une page vitrine.' : 'Consigne de cache présente.'));
  if (https) {
    const hsts = h['strict-transport-security'];
    if (!hsts) checks.push(check('hsts', 'Pas de HSTS', 'warn', 'Sans Strict-Transport-Security, la première visite peut passer en http non chiffré.', 'Ajoutez « Strict-Transport-Security: max-age=31536000 » une fois HTTPS stable sur tout le domaine.'));
    else checks.push(check('hsts', 'HSTS activé', 'ok', hsts));
  }
  if ((h['x-content-type-options'] ?? '').toLowerCase() !== 'nosniff') checks.push(check('nosniff', 'X-Content-Type-Options absent', 'warn', 'Le navigateur peut réinterpréter un fichier (risque d’exécution de script).', 'Ajoutez « X-Content-Type-Options: nosniff ».'));
  else checks.push(check('nosniff', 'X-Content-Type-Options : nosniff', 'ok', 'Protection active.'));
  const csp = h['content-security-policy'] ?? '';
  const frame = h['x-frame-options'] || /frame-ancestors/i.test(csp);
  if (!frame) checks.push(check('frame', 'Page intégrable dans un autre site', 'warn', 'Sans X-Frame-Options ni frame-ancestors, un site tiers peut afficher votre page dans un cadre (détournement de clic).', "Ajoutez « X-Frame-Options: SAMEORIGIN » ou « Content-Security-Policy: frame-ancestors 'self' »."));
  else checks.push(check('frame', 'Intégration par des sites tiers limitée', 'ok', String(h['x-frame-options'] ?? 'frame-ancestors')));
  if (!csp) checks.push(check('csp', 'Pas de Content-Security-Policy', 'warn', 'La politique de sécurité du contenu limite les scripts injectés. Fréquente sur les gros sites, rare sur les petits.', 'Commencez par « Content-Security-Policy-Report-Only » pour observer sans rien casser.'));
  else checks.push(check('csp', 'Content-Security-Policy présente', 'ok', csp.slice(0, 160)));
  if (!h['referrer-policy']) checks.push(check('referrer', 'Pas de Referrer-Policy', 'ok', 'Le navigateur applique sa valeur par défaut (strict-origin-when-cross-origin), généralement suffisante.', 'Facultatif : « Referrer-Policy: strict-origin-when-cross-origin ».', true));
  const versionLeak = [h.server, h['x-powered-by']].filter((v): v is string => !!v && /\d+\.\d+/.test(v));
  if (versionLeak.length) checks.push(check('version', 'Le serveur annonce sa version', 'warn', `« ${versionLeak.join(' ; ')} » : une information utile aux attaques automatisées.`, 'Masquez le numéro de version (server_tokens off, expose_php Off…).'));
  const verdict = verdictOf(checks, {
    ok: 'En-têtes HTTP propres : rien ne bloque Google',
    warn: xr && hasNoindex(undefined, xr) ? 'Le serveur demande de ne pas indexer cette page' : 'En-têtes corrects, quelques protections manquent',
    fail: xr && hasNoindex(undefined, xr) ? 'Le serveur demande de ne pas indexer cette page' : 'En-têtes HTTP à corriger',
  });
  return { url: p.requestedUrl, finalUrl: p.finalUrl, status: p.status, verdict, checks, checkedAt: now(), chain: p.chain, headers: headerRows(h), fetchMs: p.fetchMs };
}

/* ------------------------------------------------------------------ */
/* hreflang                                                            */
/* ------------------------------------------------------------------ */

export interface AlternatePage {
  href: string;
  status: number;
  /** hreflang déclarés par la page alternative (href absolus). */
  hreflang: { lang: string; href: string }[];
}

export function hreflangOf(html: string, url: string): { lang: string; href: string }[] {
  return extractPage(html, url).hreflang;
}

export function analyzeHreflang(p: PageFetch, alternates: AlternatePage[] = []): HreflangReport {
  const ex = extractPage(p.html ?? '', p.finalUrl);
  const checks: V6Check[] = [];
  const byHref = new Map(alternates.map((a) => [a.href, a]));
  const entries: HreflangEntry[] = ex.hreflang.map((h) => {
    const v = hreflangCode(h.lang);
    const alt = byHref.get(h.href);
    const self = sameUrl(h.href, p.finalUrl);
    const returnLink = self ? true : alt ? alt.status >= 200 && alt.status < 300 && alt.hreflang.some((x) => sameUrl(x.href, p.finalUrl)) : null;
    return { lang: h.lang, href: h.href, valid: v.valid, ...(v.issue ? { issue: v.issue } : {}), returnLink, ...(alt ? { targetStatus: alt.status } : {}) };
  });
  if (!entries.length) {
    checks.push(check('none', 'Aucune balise hreflang', 'ok', 'Normal pour un site en une seule langue. Pour un site multilingue, chaque version doit lister toutes les autres.', '', true));
    return {
      url: p.requestedUrl,
      finalUrl: p.finalUrl,
      status: p.status,
      verdict: { tone: 'ok', title: 'Pas de hreflang : rien à corriger si le site est en une seule langue', text: 'S’il existe d’autres versions linguistiques, déclarez-les (balises <link rel="alternate" hreflang>).' },
      checks,
      checkedAt: now(),
      entries,
      canonical: ex.canonical ?? null,
      lang: ex.lang ?? null,
      checkedAlternates: 0,
    };
  }
  const invalid = entries.filter((e) => !e.valid);
  if (invalid.length) checks.push(check('codes', `${pl(invalid.length, 'code invalide', 'codes invalides')}`, 'fail', invalid.map((e) => e.issue).join(' '), 'Utilisez langue ISO 639-1 puis, au besoin, pays ISO 3166-1 : fr, fr-BE, en-GB, x-default.'));
  else checks.push(check('codes', 'Tous les codes de langue sont valides', 'ok', entries.map((e) => e.lang).join(', ')));
  const counts = new Map<string, Set<string>>();
  for (const e of entries) counts.set(e.lang.toLowerCase(), (counts.get(e.lang.toLowerCase()) ?? new Set()).add(e.href));
  const dup = [...counts.entries()].filter(([, s]) => s.size > 1).map(([l]) => l);
  if (dup.length) checks.push(check('dup', `Même code pour plusieurs adresses : ${dup.join(', ')}`, 'fail', 'Google ne sait pas laquelle afficher et peut ignorer l’ensemble.', 'Une seule adresse par code de langue.'));
  const self = entries.some((e) => sameUrl(e.href, p.finalUrl));
  if (!self) checks.push(check('self', 'La page ne se cite pas elle-même', 'fail', 'Chaque version doit inclure une balise hreflang vers sa propre adresse.', `Ajoutez <link rel="alternate" hreflang="${ex.lang ?? 'fr'}" href="${p.finalUrl}">.`));
  else checks.push(check('self', 'La page se cite elle-même', 'ok', 'Balise d’auto-référence présente.'));
  if (!entries.some((e) => e.lang.toLowerCase() === 'x-default')) checks.push(check('xdefault', 'Pas de x-default', 'warn', 'x-default indique la page à montrer aux visiteurs dont la langue n’est pas prévue.', 'Ajoutez hreflang="x-default" vers votre page de choix de langue ou votre version principale.'));
  else checks.push(check('xdefault', 'x-default présent', 'ok', entries.find((e) => e.lang.toLowerCase() === 'x-default')!.href));
  const rel = entries.filter((e) => !/^https?:\/\//i.test(e.href));
  if (rel.length) checks.push(check('abs', 'Adresses relatives', 'fail', rel.map((e) => e.href).join(', '), 'Les adresses hreflang doivent être complètes (https://…).'));
  const checkedAlternates = entries.filter((e) => e.returnLink !== null && !sameUrl(e.href, p.finalUrl)).length;
  const noReturn = entries.filter((e) => e.returnLink === false);
  if (noReturn.length) checks.push(check('return', `${pl(noReturn.length, 'version ne renvoie pas', 'versions ne renvoient pas')} vers cette page`, 'fail', noReturn.map((e) => `${e.lang} : ${e.href}${e.targetStatus && e.targetStatus >= 300 ? ` (répond ${e.targetStatus})` : ''}`).join(' ; '), 'Les balises doivent être réciproques : chaque version liste toutes les autres, y compris celle-ci. Sans retour, Google ignore le lien.'));
  else if (checkedAlternates) checks.push(check('return', `Liens de retour vérifiés sur ${pl(checkedAlternates, 'version', 'versions')}`, 'ok', 'Chaque version vérifiée renvoie bien vers cette page.'));
  if (ex.canonical && !sameUrl(ex.canonical, p.finalUrl)) checks.push(check('canonical', 'La canonical désigne une autre page', 'warn', `${ex.canonical} : Google peut ignorer les hreflang d’une page qui se déclare copie d’une autre.`, 'Chaque version linguistique doit avoir une canonical vers elle-même.'));
  const verdict = verdictOf(checks, {
    ok: `hreflang en ordre : ${pl(entries.length, 'version déclarée', 'versions déclarées')}`,
    warn: `hreflang presque en ordre : ${pl(entries.length, 'version', 'versions')}`,
    fail: 'hreflang à corriger : Google risque d’ignorer ces balises',
  });
  return { url: p.requestedUrl, finalUrl: p.finalUrl, status: p.status, verdict, checks, checkedAt: now(), entries, canonical: ex.canonical ?? null, lang: ex.lang ?? null, checkedAlternates };
}

/* ------------------------------------------------------------------ */
/* Open Graph                                                          */
/* ------------------------------------------------------------------ */

export function ogTags(html: string): { og: Record<string, string>; twitter: Record<string, string> } {
  const og: Record<string, string> = {};
  const twitter: Record<string, string> = {};
  const clean = html.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ');
  for (const m of clean.matchAll(/<meta\b([^>]*)>/gi)) {
    const a = parseAttrs(m[1]);
    const k = (a.property ?? a.name ?? '').toLowerCase().trim();
    const v = (a.content ?? '').trim();
    if (!v) continue;
    if (k.startsWith('og:') && !(k in og)) og[k] = v;
    if (k.startsWith('twitter:') && !(k in twitter)) twitter[k] = v;
  }
  return { og, twitter };
}

export function analyzeOg(p: PageFetch, image: OgImageCheck | null = null): OgReport {
  const html = p.html ?? '';
  const ex = extractPage(html, p.finalUrl);
  const { og, twitter } = ogTags(html);
  const checks: V6Check[] = [];
  const req = (k: string, label: string, fix: string, fallback?: string | null) => {
    if (og[k]) checks.push(check(k, `${label} : « ${og[k].slice(0, 90)} »`, 'ok', `Balise ${k}.`));
    else checks.push(check(k, `${label} absent`, k === 'og:image' ? 'fail' : 'warn', fallback ? `Les réseaux prendront « ${fallback.slice(0, 90)} » à la place, s’ils le font.` : 'Les réseaux sociaux et messageries afficheront un aperçu incomplet.', fix));
  };
  req('og:title', 'Titre de partage', 'Ajoutez <meta property="og:title" content="…"> (souvent le title sans le nom de marque).', ex.title);
  req('og:description', 'Description de partage', 'Ajoutez <meta property="og:description" content="…"> (une ou deux phrases).', ex.metaDescription);
  req('og:image', 'Image de partage', 'Ajoutez <meta property="og:image" content="https://…/partage.jpg"> : 1200 × 630 pixels, moins de 5 Mo, JPEG ou PNG.');
  let imageUrl: string | null = null;
  if (og['og:image']) {
    try {
      imageUrl = new URL(og['og:image'], p.finalUrl).toString();
    } catch {
      imageUrl = null;
    }
    if (!/^https?:\/\//i.test(og['og:image'])) checks.push(check('og:image.abs', 'Adresse d’image relative', 'warn', `« ${og['og:image']} » : certains réseaux exigent une adresse complète.`, `Écrivez l’adresse complète : ${imageUrl ?? 'https://…'}.`));
    if (image) {
      if (image.error || image.status < 200 || image.status >= 300) checks.push(check('og:image.status', `L’image ne s’ouvre pas (${image.error ?? image.status})`, 'fail', image.url, 'Vérifiez que le fichier existe et qu’il est accessible publiquement.'));
      else if (image.contentType && !/^image\//i.test(image.contentType)) checks.push(check('og:image.type', `L’adresse ne renvoie pas une image (${image.contentType})`, 'fail', image.url, 'Indiquez l’adresse directe du fichier image.'));
      else checks.push(check('og:image.status', 'L’image répond', 'ok', `${image.contentType ?? 'type inconnu'}, statut ${image.status}.`));
    }
    const w = Number(og['og:image:width']);
    const hgt = Number(og['og:image:height']);
    if (w && hgt && (w < 600 || hgt < 315)) checks.push(check('og:image.size', `Image petite (${w} × ${hgt})`, 'warn', 'Sous 600 × 315 pixels, l’aperçu s’affiche en vignette au lieu d’une grande image.', 'Utilisez 1200 × 630 pixels.'));
    if (!og['og:image:alt']) checks.push(check('og:image:alt', 'Pas de texte alternatif pour l’image', 'ok', 'og:image:alt aide les personnes malvoyantes.', 'Ajoutez <meta property="og:image:alt" content="…">.', true));
  }
  if (!og['og:url']) checks.push(check('og:url', 'og:url absent', 'warn', 'Les partages d’une même page avec et sans paramètres se comptent séparément.', `Ajoutez <meta property="og:url" content="${p.finalUrl}">.`));
  else if (!sameUrl(og['og:url'], p.finalUrl) && !(ex.canonical && sameUrl(og['og:url'], ex.canonical))) checks.push(check('og:url', 'og:url désigne une autre page', 'warn', og['og:url'], 'og:url doit correspondre à la canonical de la page.'));
  if (!og['og:type']) checks.push(check('og:type', 'og:type absent', 'ok', 'Valeur par défaut : website.', 'Facultatif : « website » pour l’accueil, « article » pour un article.', true));
  if (!og['og:site_name']) checks.push(check('og:site_name', 'Nom du site absent', 'ok', 'Certains réseaux affichent le nom du site au-dessus du titre.', 'Ajoutez <meta property="og:site_name" content="Votre marque">.', true));
  if (!og['og:locale']) checks.push(check('og:locale', 'og:locale absent', 'ok', 'Valeur par défaut : en_US.', 'Ajoutez <meta property="og:locale" content="fr_FR">.', true));
  if (!twitter['twitter:card']) checks.push(check('twitter:card', 'Pas de twitter:card', 'ok', 'X (Twitter) reprend les balises Open Graph, mais affiche une petite vignette sans cette balise.', 'Ajoutez <meta name="twitter:card" content="summary_large_image">.', true));
  const verdict = verdictOf(checks, {
    ok: 'Aperçu de partage complet : titre, description et image',
    warn: 'Aperçu de partage incomplet',
    fail: og['og:image'] ? 'L’image de partage ne s’affichera pas' : 'Partagée, cette page s’affichera sans image',
  });
  return {
    url: p.requestedUrl,
    finalUrl: p.finalUrl,
    status: p.status,
    verdict,
    checks,
    checkedAt: now(),
    og,
    twitter,
    preview: {
      title: og['og:title'] ?? twitter['twitter:title'] ?? ex.title ?? host(p.finalUrl),
      description: og['og:description'] ?? twitter['twitter:description'] ?? ex.metaDescription ?? '',
      image: imageUrl ?? (twitter['twitter:image'] ? new URL(twitter['twitter:image'], p.finalUrl).toString() : null),
      siteName: og['og:site_name'] ?? host(p.finalUrl),
      host: host(p.finalUrl),
    },
    image,
  };
}

/* ------------------------------------------------------------------ */
/* Liens d'une page                                                    */
/* ------------------------------------------------------------------ */

const GENERIC = /^(cliquez ici|cliquer ici|ici|en savoir plus|lire la suite|voir plus|plus|suite|lien|découvrir|read more|click here|more|here)$/i;

export function pageLinks(p: PageFetch): LinkRow[] {
  const ex = extractPage(p.html ?? '', p.finalUrl);
  const site = host(p.finalUrl);
  const seen = new Set<string>();
  const rows: LinkRow[] = [];
  for (const l of ex.links) {
    const key = `${l.to}|${l.anchor}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ href: l.to, anchor: l.anchor, internal: host(l.to) === site, rel: l.rel });
    if (rows.length >= 500) break;
  }
  return rows;
}

/** Adresses à vérifier : internes d'abord, dédoublonnées, plafonnées. */
export function linksToCheck(rows: LinkRow[], max = 30): string[] {
  const uniq = [...new Set([...rows.filter((r) => r.internal), ...rows.filter((r) => !r.internal)].map((r) => r.href.replace(/#.*$/, '')))];
  return uniq.slice(0, max);
}

export function analyzeLinks(p: PageFetch, rows: LinkRow[], statuses: Map<string, { status: number; error?: string }>): LinksReport {
  const links = rows.map((r) => {
    const s = statuses.get(r.href.replace(/#.*$/, ''));
    return s ? { ...r, status: s.status, ...(s.error ? { error: s.error } : {}) } : r;
  });
  const internal = links.filter((l) => l.internal).length;
  const relCount = (k: string) => links.filter((l) => l.rel.includes(k)).length;
  const nofollow = relCount('nofollow');
  const checkedRows = [...new Map(links.filter((l) => l.status !== undefined).map((l) => [l.href.replace(/#.*$/, ''), l])).values()];
  const broken = checkedRows.filter((l) => l.status === 0 || (l.status ?? 0) >= 400);
  const checks: V6Check[] = [];
  if (!links.length) checks.push(check('none', 'Aucun lien dans le HTML', 'fail', 'Sans lien, Google ne découvre pas vos autres pages depuis celle-ci. Les menus construits en JavaScript ne comptent pas toujours.', 'Ajoutez des liens HTML <a href> vers vos pages principales.'));
  else if (!internal) checks.push(check('internal', 'Aucun lien interne', 'warn', 'La page ne renvoie vers aucune autre page de votre site.', 'Ajoutez des liens vers vos services, produits ou articles proches.'));
  else checks.push(check('internal', `${pl(internal, 'lien interne', 'liens internes')}`, 'ok', 'Google peut découvrir vos autres pages depuis celle-ci.'));
  if (broken.length) checks.push(check('broken', `${pl(broken.length, 'lien cassé', 'liens cassés')} sur ${checkedRows.length} vérifiés`, 'fail', broken.slice(0, 6).map((b) => `${b.href} (${b.status || b.error || 'injoignable'})`).join(' ; '), 'Corrigez l’adresse ou retirez le lien ; pour une page supprimée, redirigez-la en 301.'));
  else if (checkedRows.length) checks.push(check('broken', `Aucun lien cassé sur ${checkedRows.length} vérifiés`, 'ok', 'Toutes les adresses testées répondent.'));
  const redirected = checkedRows.filter((l) => (l.status ?? 0) >= 300 && (l.status ?? 0) < 400);
  if (redirected.length) checks.push(check('redirected', `${pl(redirected.length, 'lien passe', 'liens passent')} par une redirection`, 'warn', redirected.slice(0, 4).map((r) => r.href).join(' ; '), 'Remplacez-les par l’adresse finale.'));
  const internalNofollow = links.filter((l) => l.internal && l.rel.includes('nofollow')).length;
  if (internalNofollow) checks.push(check('nofollow.internal', `${pl(internalNofollow, 'lien interne', 'liens internes')} en nofollow`, 'warn', 'Vous demandez à Google de ne pas suivre des liens vers votre propre site.', 'Retirez rel="nofollow" des liens internes.'));
  const generic = links.filter((l) => GENERIC.test(l.anchor.trim()));
  if (generic.length) checks.push(check('anchors.generic', `${pl(generic.length, 'ancre vague', 'ancres vagues')} (« ${generic[0].anchor} »…)`, 'warn', 'Une ancre comme « cliquez ici » ne dit ni à Google ni au visiteur ce qu’il trouvera.', 'Écrivez le sujet de la page cible : « nos tarifs de dépannage » plutôt que « en savoir plus ».'));
  const empty = links.filter((l) => !l.anchor.trim());
  if (empty.length) checks.push(check('anchors.empty', `${pl(empty.length, 'lien sans texte', 'liens sans texte')}`, 'warn', 'Lien sur une icône ou une image sans texte alternatif : illisible pour Google et les lecteurs d’écran.', 'Ajoutez un texte, un attribut alt à l’image ou un aria-label.'));
  if (p.finalUrl.startsWith('https://')) {
    const http = links.filter((l) => l.href.startsWith('http://') && l.internal);
    if (http.length) checks.push(check('http', `${pl(http.length, 'lien interne', 'liens internes')} en http://`, 'warn', 'Chaque clic passe par une redirection vers https.', 'Écrivez vos liens en https://.'));
  }
  const notChecked = linksToCheck(rows, 10_000).length - checkedRows.length;
  if (notChecked > 0) checks.push(check('limit', `${pl(notChecked, 'adresse non vérifiée', 'adresses non vérifiées')}`, 'ok', 'Les 30 premières adresses (internes d’abord) sont testées, pour rester rapide et poli avec les sites visés.', 'L’analyse complète vérifie les liens de tout le site.', true));
  const verdict: Verdict = {
    tone: worst(checks),
    title: broken.length ? `${pl(broken.length, 'lien cassé', 'liens cassés')} sur cette page` : !links.length ? 'Aucun lien lisible sur cette page' : worst(checks) === 'ok' ? `${pl(links.length, 'lien', 'liens')}, aucun cassé` : `${pl(links.length, 'lien', 'liens')}, aucun cassé, quelques ancres à revoir`,
    text: `${internal} internes, ${links.length - internal} externes, ${nofollow} en nofollow.`,
  };
  return {
    url: p.requestedUrl,
    finalUrl: p.finalUrl,
    status: p.status,
    verdict,
    checks,
    checkedAt: now(),
    total: links.length,
    internal,
    external: links.length - internal,
    nofollow,
    sponsored: relCount('sponsored'),
    ugc: relCount('ugc'),
    checked: checkedRows.length,
    broken: broken.length,
    links,
  };
}

/* ------------------------------------------------------------------ */
/* Sitemap                                                             */
/* ------------------------------------------------------------------ */

export interface SitemapFetch {
  url: string;
  source: SitemapReport['source'];
  status: number;
  contentType: string;
  text: string;
  bytes: number;
  truncated: boolean;
  declaredInRobots: boolean;
  error?: string;
}

export function sitemapEntries(text: string): { loc: string; lastmod?: string }[] {
  const out: { loc: string; lastmod?: string }[] = [];
  for (const m of text.matchAll(/<(url|sitemap)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const loc = /<loc\b[^>]*>([\s\S]*?)<\/loc>/i.exec(m[2])?.[1];
    if (!loc) continue;
    const lastmod = /<lastmod\b[^>]*>([\s\S]*?)<\/lastmod>/i.exec(m[2])?.[1]?.trim();
    out.push({ loc: decodeEntities(loc.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')).trim(), ...(lastmod ? { lastmod } : {}) });
  }
  return out;
}

export function analyzeSitemap(
  f: SitemapFetch,
  sample: SitemapReport['sample'] = [],
  children: SitemapReport['children'] = [],
  nowMs = Date.now(),
): SitemapReport {
  const checks: V6Check[] = [];
  const base = { url: f.url, source: f.source, status: f.status, bytes: f.bytes, truncated: f.truncated, declaredInRobots: f.declaredInRobots, sample, children, checkedAt: now() };
  if (f.error || f.status < 200 || f.status >= 300) {
    checks.push(check('status', f.error ? `Sitemap injoignable : ${f.error}` : `Le sitemap répond ${f.status}`, 'fail', f.url, f.source === 'default' ? 'Aucun sitemap trouvé à l’adresse habituelle ni dans le robots.txt. Créez-en un (la plupart des CMS le font) et déclarez-le dans le robots.txt et la Search Console.' : 'Vérifiez l’adresse du sitemap.'));
    return { ...base, verdict: { tone: 'fail', title: f.source === 'default' ? 'Aucun sitemap trouvé' : 'Le sitemap ne s’ouvre pas', text: 'Google découvre alors vos pages seulement par les liens.' }, checks, kind: 'missing', urlCount: 0, lastmodCount: 0 };
  }
  const parsed = parseSitemap(f.text);
  const entries: { loc: string; lastmod?: string }[] = parsed.kind === 'text' ? parsed.locs.map((loc) => ({ loc })) : parsed.kind === 'html' ? [] : sitemapEntries(f.text);
  checks.push(check('status', `Sitemap accessible (${f.status})`, 'ok', f.url));
  if (parsed.kind === 'unknown' || parsed.kind === 'html') {
    checks.push(check('format', 'Format non reconnu', 'fail', 'Ni <urlset>, ni <sitemapindex>, ni liste d’adresses texte. Souvent une page HTML (erreur 404 déguisée) à la place du fichier.', 'Servez un fichier XML au format sitemaps.org.'));
  } else {
    checks.push(check('format', parsed.kind === 'index' ? `Index de sitemaps : ${pl(entries.length, 'fichier', 'fichiers')}` : parsed.kind === 'text' ? `Sitemap texte : ${pl(entries.length, 'adresse', 'adresses')}` : `${pl(entries.length, 'adresse', 'adresses')} déclarées`, entries.length ? 'ok' : 'warn', parsed.kind === 'index' ? 'Un fichier qui liste d’autres sitemaps.' : 'Format reconnu.', 'Le sitemap est vide : vérifiez la configuration de votre CMS.'));
    if (parsed.kind !== 'text' && !/xmlns\s*=\s*["']https?:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9["']/i.test(f.text)) checks.push(check('ns', 'Espace de noms sitemaps.org absent', 'warn', 'Google tolère souvent l’oubli, d’autres moteurs moins.', 'Ajoutez xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" à la balise racine.'));
    if (parsed.kind !== 'text' && !/xml/i.test(f.contentType)) checks.push(check('ctype', `Servi en « ${f.contentType || 'type inconnu'} »`, 'warn', 'Un sitemap XML devrait être servi en application/xml ou text/xml.', 'Corrigez le type de contenu côté serveur.'));
  }
  if (parsed.incomplete) checks.push(check('incomplete', 'Fichier XML incomplet', 'warn', 'La balise de fin manque : le fichier est coupé ou mal formé, une partie des adresses peut être ignorée.', 'Régénérez le sitemap et vérifiez qu’il se termine par </urlset> ou </sitemapindex>.'));
  if (entries.length > 50_000) checks.push(check('max', `${entries.length} adresses : plus de 50 000`, 'fail', 'Limite du protocole : Google ignore les adresses au-delà.', 'Découpez en plusieurs fichiers réunis dans un index.'));
  if (f.truncated) checks.push(check('size', 'Fichier de plus de 2 Mo, lu en partie', 'ok', 'Les contrôles portent sur le début du fichier. La limite du protocole est 50 Mo décompressés.', '', true));
  const bad = entries.filter((e) => !/^https?:\/\//i.test(e.loc));
  if (bad.length) checks.push(check('abs', `${pl(bad.length, 'adresse incomplète', 'adresses incomplètes')}`, 'fail', bad.slice(0, 3).map((b) => b.loc).join(' ; '), 'Chaque <loc> doit être une adresse complète (https://…).'));
  let sitemapHost = '';
  try {
    sitemapHost = new URL(f.url).hostname;
  } catch {
    /* ignoré */
  }
  const foreign = entries.filter((e) => {
    try {
      return new URL(e.loc).hostname !== sitemapHost;
    } catch {
      return false;
    }
  });
  if (foreign.length && parsed.kind !== 'index') checks.push(check('host', `${pl(foreign.length, 'adresse', 'adresses')} sur un autre domaine`, 'warn', `${foreign[0].loc}… Un sitemap ne peut lister que les adresses de son propre hôte (sauf déclaration croisée dans le robots.txt).`, 'Listez uniquement les pages de ce domaine, avec la même forme (www ou non, https).'));
  const dups = entries.length - new Set(entries.map((e) => e.loc)).size;
  if (dups) checks.push(check('dups', `${pl(dups, 'adresse en double', 'adresses en double')}`, 'warn', 'Les doublons ne gênent pas Google mais signalent un sitemap mal généré.', 'Dédoublonnez.'));
  const withLastmod = entries.filter((e) => e.lastmod);
  const badLastmod = withLastmod.filter((e) => lastmodIssue(e.lastmod!, nowMs));
  if (parsed.kind !== 'text' && entries.length) {
    if (badLastmod.length) checks.push(check('lastmod', `${pl(badLastmod.length, 'date lastmod invalide', 'dates lastmod invalides')}`, 'warn', `${badLastmod[0].lastmod} : format W3C attendu (2026-11-15 ou 2026-11-15T10:00:00+01:00), jamais dans le futur.`, 'Google n’utilise lastmod que s’il est exact : corrigez ou retirez-le.'));
    else if (!withLastmod.length) checks.push(check('lastmod', 'Aucune date lastmod', 'ok', 'Facultatif, mais une date exacte aide Google à repasser sur les pages modifiées.', 'Si votre CMS le permet, renseignez la date de dernière modification réelle.', true));
    else checks.push(check('lastmod', `Dates lastmod valides (${withLastmod.length})`, 'ok', 'Format W3C, aucune date future.'));
  }
  if (!f.declaredInRobots) checks.push(check('robots', 'Sitemap non déclaré dans le robots.txt', 'warn', 'Les moteurs le trouvent plus vite quand il y est déclaré.', `Ajoutez la ligne « Sitemap: ${f.url} » au robots.txt (et déclarez-le dans la Search Console).`));
  else checks.push(check('robots', 'Déclaré dans le robots.txt', 'ok', 'Ligne Sitemap présente.'));
  if (sample.length) {
    const errs = sample.filter((s) => s.error || s.status === 0 || s.status >= 400);
    const redir = sample.filter((s) => s.status >= 300 && s.status < 400);
    if (errs.length) checks.push(check('sample.err', `${errs.length} adresse(s) sur ${sample.length} testées en erreur`, 'fail', errs.slice(0, 3).map((e) => `${e.url} (${e.error ?? e.status})`).join(' ; '), 'Retirez du sitemap les pages supprimées, ou rétablissez-les.'));
    if (redir.length) checks.push(check('sample.redir', `${redir.length} adresse(s) sur ${sample.length} redirigent`, 'warn', redir.slice(0, 3).map((e) => e.url).join(' ; '), 'Un sitemap ne doit lister que des adresses finales (statut 200).'));
    if (!errs.length && !redir.length) checks.push(check('sample.ok', `${sample.length} adresses testées : toutes répondent 200`, 'ok', 'Échantillon pris au début du sitemap.'));
  }
  const urlCount = parsed.kind === 'index' ? children.reduce((a, c) => a + (c.urlCount ?? 0), 0) : entries.length;
  const verdict = verdictOf(checks, {
    ok: parsed.kind === 'index' ? `Index de sitemaps valide : ${pl(entries.length, 'fichier', 'fichiers')}` : `Sitemap valide : ${pl(entries.length, 'adresse', 'adresses')}`,
    warn: 'Sitemap lisible, avec des points à améliorer',
    fail: parsed.kind === 'unknown' || parsed.kind === 'html' ? 'Ce fichier n’est pas un sitemap lisible' : 'Sitemap à corriger',
  });
  return { ...base, verdict, checks, kind: parsed.kind, urlCount, lastmodCount: withLastmod.length };
}
