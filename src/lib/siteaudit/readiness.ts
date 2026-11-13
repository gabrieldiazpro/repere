/**
 * Audit « prêt pour les IA » d'une page (/100). Uniquement des signaux techniques lisibles sans navigateur :
 * ce score ne mesure pas ce que disent les IA (c'est le rôle de l'audit Repéré).
 */
import { SafeFetchError, normalizeInputUrl, safeFetch, tryFetch, type SafeFetchOptions, type SafeResponse } from './fetch';
import { parseHtml, wordCount, type ParsedPage } from './html';
import { allNodes, typesOf, validateBlocks } from './jsonld';
import { analyzeRobots } from './robotsAudit';
import type { Check, CheckStatus, ReadinessReport, RenderReport, RobotsReport, ScoredReport } from './types';

export const LLMS_NOTE =
  'Information seulement (0 point) : Google a déclaré ne pas utiliser llms.txt ; certains assistants le liraient ; aucun effet démontré sur les citations. Il ne contrôle pas l’entraînement (c’est le rôle de robots.txt).';

export const READINESS_LIMITS = [
  'Analyse du HTML initial, sans exécuter JavaScript : c’est ce que lisent la plupart des robots IA. Nous ne comparons pas au rendu d’un navigateur.',
  'Ces signaux techniques ne disent pas si les IA vous citent : l’audit Repéré mesure les réponses réelles.',
  'Le temps de réponse est mesuré depuis notre serveur, une seule fois : il varie selon le moment et le lieu.',
];

/** Points par contrôle (total 100 ; llms.txt compte 0). */
export const WEIGHTS: Record<string, number> = {
  status: 8,
  https: 8,
  robots: 14,
  indexable: 6,
  render: 14,
  title: 5,
  meta_description: 5,
  h1: 5,
  jsonld: 9,
  sitemap: 6,
  canonical: 4,
  lang: 3,
  html_weight: 4,
  response_time: 5,
  open_graph: 4,
  llms_txt: 0,
};

export function mkCheck(id: string, label: string, status: CheckStatus, detail: string, fix: string, maxPoints: number, extra: Partial<Check> = {}): Check {
  const points = status === 'ok' ? maxPoints : status === 'warn' ? Math.round(maxPoints / 2) : 0;
  return { id, label, status, detail, fix: status === 'ok' ? '' : fix, points, maxPoints, ...extra };
}

/** Score sur 100 et correctifs priorisés. */
export function finalize(checks: Check[]): ScoredReport {
  const max = checks.reduce((a, c) => a + (c.informational ? 0 : c.maxPoints), 0);
  const got = checks.reduce((a, c) => a + (c.informational ? 0 : c.points), 0);
  const score = max ? Math.round((got / max) * 100) : 0;
  const fixes = checks
    .filter((c) => c.status !== 'ok' && c.fix && !c.informational)
    .map((c) => ({ id: c.id, label: c.label, fix: c.fix, impact: c.maxPoints - c.points }))
    .sort((a, b) => b.impact - a.impact);
  return { score, checks, fixes };
}

/* ------------------------------------------------------------------ */
/* Rendu sans JavaScript                                               */
/* ------------------------------------------------------------------ */

const EMPTY_ROOTS: [RegExp, string][] = [
  [/<div[^>]+id=["']root["'][^>]*>\s*<\/div>/i, 'div#root (React)'],
  [/<div[^>]+id=["']__next["'][^>]*>\s*<\/div>/i, 'div#__next (Next.js sans rendu serveur)'],
  [/<div[^>]+id=["']app["'][^>]*>\s*<\/div>/i, 'div#app (Vue)'],
  [/<div[^>]+id=["']__nuxt["'][^>]*>\s*<\/div>/i, 'div#__nuxt (Nuxt)'],
  [/<app-root[^>]*>\s*<\/app-root>/i, 'app-root (Angular)'],
  [/<div[^>]+id=["']svelte["'][^>]*>\s*<\/div>/i, 'div#svelte'],
];

const FRAMEWORKS: [RegExp, string][] = [
  [/__NEXT_DATA__|\/_next\/static\//, 'Next.js'],
  [/data-reactroot|react-dom|\/static\/js\/main\.[a-f0-9]+\.js/i, 'React'],
  [/__NUXT__|\/_nuxt\//, 'Nuxt'],
  [/ng-version=|<app-root/i, 'Angular'],
  [/data-v-[a-f0-9]{6,}|vue(\.runtime)?(\.global)?(\.prod)?\.js/i, 'Vue'],
  [/__sveltekit|svelte-[a-z0-9]{5,}/i, 'Svelte'],
  [/wix\.com|wixstatic/i, 'Wix'],
  [/wp-content|wp-includes/i, 'WordPress'],
  [/cdn\.shopify\.com|Shopify\.theme/i, 'Shopify'],
  [/squarespace/i, 'Squarespace'],
  [/webflow/i, 'Webflow'],
  [/gatsby/i, 'Gatsby'],
];

export function renderReport(page: ParsedPage, htmlBytes: number): RenderReport {
  const words = wordCount(page.bodyText);
  const textBytes = Buffer.byteLength(page.bodyText, 'utf8');
  const textRatio = htmlBytes ? Math.min(1, textBytes / htmlBytes) : 0;
  const emptyRoot = EMPTY_ROOTS.find(([re]) => re.test(page.clean))?.[1] ?? null;
  const frameworks = FRAMEWORKS.filter(([re]) => re.test(page.raw)).map(([, n]) => n);
  const hasH1 = page.headings.some((h) => h.level === 1 && h.text.length > 0);
  let verdict: RenderReport['verdict'] = 'lisible';
  if (words < 50 || (emptyRoot && words < 150)) verdict = 'quasi_vide';
  else if (words < 200 || !hasH1 || (textRatio < 0.02 && words < 400)) verdict = 'partiel';
  return {
    verdict,
    words,
    textRatio: Math.round(textRatio * 1000) / 1000,
    hasH1,
    hasMain: page.hasMainLandmark,
    hasTitle: !!page.title,
    hasMetaDescription: !!page.metaDescription,
    hasJsonLd: page.jsonLdRaw.length > 0,
    noscriptWords: wordCount(page.noscriptText),
    emptyRoot,
    frameworks,
    preview: page.mainText.slice(0, 600),
    headings: page.headings.slice(0, 30),
    limit: READINESS_LIMITS[0],
  };
}

/* ------------------------------------------------------------------ */
/* Contrôles (purs)                                                    */
/* ------------------------------------------------------------------ */

export interface PageSnapshot {
  url: string;
  finalUrl: string;
  status: number;
  headers: Record<string, string>;
  body: string;
  bytes: number;
  truncated: boolean;
  /** Temps de réponse HTTP de la page (ms). */
  responseMs: number;
}

export interface ReadinessExtras {
  robots: RobotsReport | null;
  sitemap: { found: boolean; url: string | null };
  llms: { found: boolean; url: string };
}

export function snapshotOf(res: SafeResponse): PageSnapshot {
  return { url: res.url, finalUrl: res.finalUrl, status: res.status, headers: res.headers, body: res.body, bytes: res.bytes, truncated: res.truncated, responseMs: res.transportMs ?? res.elapsedMs };
}

const kb = (n: number) => `${Math.round(n / 1024)} Ko`;

export function readinessChecks(snap: PageSnapshot, page: ParsedPage, render: RenderReport, x: ReadinessExtras): Check[] {
  const W = WEIGHTS;
  const checks: Check[] = [];
  const final = new URL(snap.finalUrl);

  // Statut HTTP
  checks.push(
    snap.status >= 200 && snap.status < 300
      ? mkCheck('status', 'Page accessible', 'ok', `Réponse HTTP ${snap.status}.`, '', W.status)
      : mkCheck('status', 'Page accessible', 'fail', `Réponse HTTP ${snap.status} : un robot ne lira pas cette page.`, 'Corrigez l’erreur serveur ou l’adresse, puis relancez l’analyse.', W.status),
  );

  // HTTPS
  checks.push(
    final.protocol === 'https:'
      ? mkCheck('https', 'HTTPS', 'ok', 'La page est servie en HTTPS.', '', W.https)
      : mkCheck('https', 'HTTPS', 'fail', 'La page est servie en HTTP non chiffré.', 'Activez un certificat (gratuit chez la plupart des hébergeurs) et redirigez HTTP vers HTTPS.', W.https),
  );

  // Robots IA
  const r = x.robots;
  if (!r) checks.push(mkCheck('robots', 'Accès des robots IA (robots.txt)', 'warn', 'robots.txt non analysé.', 'Relancez l’analyse ; vérifiez que /robots.txt répond.', W.robots, { task: 'robots' }));
  else if (r.summary.searchBlocked.length)
    checks.push(mkCheck('robots', 'Accès des robots IA (robots.txt)', 'fail', `Robots de recherche bloqués : ${r.summary.searchBlocked.join(', ')}. Votre site ne peut pas être cité par ces IA.`, 'Autorisez ces robots dans robots.txt (profil proposé par l’outil Robots IA).', W.robots, { task: 'robots' }));
  else if (r.unreachable)
    checks.push(mkCheck('robots', 'Accès des robots IA (robots.txt)', 'warn', `robots.txt injoignable (${r.httpStatus ?? 'pas de réponse'}) : les robots respectueux considèrent alors le site entièrement interdit.`, 'Faites répondre /robots.txt (200 avec un fichier, ou 404 si vous n’en voulez pas).', W.robots, { task: 'robots' }));
  else if (r.summary.userBlocked.length)
    checks.push(mkCheck('robots', 'Accès des robots IA (robots.txt)', 'warn', `Robots de lecture à la demande bloqués : ${r.summary.userBlocked.join(', ')}.`, 'Autorisez-les si vous voulez que vos pages soient lues quand un utilisateur les demande.', W.robots, { task: 'robots' }));
  else
    checks.push(
      mkCheck(
        'robots',
        'Accès des robots IA (robots.txt)',
        'ok',
        r.summary.trainingBlocked.length
          ? `Robots de recherche autorisés. Entraînement bloqué pour ${r.summary.trainingBlocked.join(', ')} (choix légitime).`
          : r.found
            ? 'Robots de recherche et de lecture autorisés.'
            : 'Pas de robots.txt : tout est permis par défaut.',
        '',
        W.robots,
      ),
    );

  // Indexable
  const xr = (snap.headers['x-robots-tag'] ?? '').toLowerCase();
  const mr = (page.metaRobots ?? '').toLowerCase();
  const noindex = /noindex|none/.test(mr) || /noindex|none/.test(xr);
  const nosnippet = /nosnippet|max-snippet:\s*0/.test(mr) || /nosnippet|max-snippet:\s*0/.test(xr);
  checks.push(
    noindex
      ? mkCheck('indexable', 'Page indexable', 'fail', `Directive « noindex » trouvée (${mr ? 'meta robots' : 'en-tête X-Robots-Tag'}).`, 'Retirez « noindex » si cette page doit être trouvée et citée.', W.indexable)
      : nosnippet
        ? mkCheck('indexable', 'Page indexable', 'warn', 'Directive « nosnippet » : les moteurs ne peuvent pas reprendre d’extrait de la page.', 'Retirez « nosnippet » (ou « max-snippet:0 ») pour permettre les citations.', W.indexable)
        : mkCheck('indexable', 'Page indexable', 'ok', 'Aucune directive noindex ni nosnippet.', '', W.indexable),
  );

  // Rendu sans JS
  const rd =
    render.verdict === 'lisible'
      ? `${render.words} mots lisibles sans JavaScript.`
      : render.verdict === 'partiel'
        ? `Seulement ${render.words} mots lisibles sans JavaScript${render.hasH1 ? '' : ', pas de titre H1'}.`
        : `Page quasi vide sans JavaScript (${render.words} mots${render.emptyRoot ? `, racine vide ${render.emptyRoot}` : ''}) : un robot IA ne voit presque rien.`;
  checks.push(
    mkCheck('render', 'Lisible sans JavaScript', render.verdict === 'lisible' ? 'ok' : render.verdict === 'partiel' ? 'warn' : 'fail', rd, 'Servez le contenu dans le HTML initial (rendu serveur ou génération statique), ou publiez une page de réponses lisible par les IA.', W.render, { task: 'faq_page' }),
  );

  // Title
  const t = page.title;
  checks.push(
    !t
      ? mkCheck('title', 'Balise title', 'fail', 'Aucune balise <title>.', 'Ajoutez un titre unique de 30 à 65 caractères : ce que vous faites + où.', W.title)
      : t.length < 15 || t.length > 70
        ? mkCheck('title', 'Balise title', 'warn', `Titre de ${t.length} caractères : « ${t.slice(0, 90)} ».`, 'Visez 30 à 65 caractères, avec votre activité et votre ville ou votre produit.', W.title)
        : mkCheck('title', 'Balise title', 'ok', `« ${t} »`, '', W.title),
  );

  // Meta description
  const d = page.metaDescription?.trim() ?? '';
  checks.push(
    !d
      ? mkCheck('meta_description', 'Meta description', 'fail', 'Aucune meta description.', 'Ajoutez une description de 120 à 160 caractères qui répond à « qui, quoi, où ».', W.meta_description)
      : d.length < 50 || d.length > 180
        ? mkCheck('meta_description', 'Meta description', 'warn', `Description de ${d.length} caractères.`, 'Visez 120 à 160 caractères.', W.meta_description)
        : mkCheck('meta_description', 'Meta description', 'ok', `${d.length} caractères.`, '', W.meta_description),
  );

  // H1
  const h1s = page.headings.filter((h) => h.level === 1 && h.text);
  checks.push(
    !h1s.length
      ? mkCheck('h1', 'Titre principal (H1)', 'fail', 'Aucun titre H1 dans le HTML initial.', 'Ajoutez un seul H1 qui dit clairement le sujet de la page.', W.h1)
      : h1s.length > 1
        ? mkCheck('h1', 'Titre principal (H1)', 'warn', `${h1s.length} titres H1.`, 'Gardez un seul H1 ; passez les autres en H2.', W.h1)
        : mkCheck('h1', 'Titre principal (H1)', 'ok', `« ${h1s[0].text.slice(0, 120)} »`, '', W.h1),
  );

  // JSON-LD
  const v = validateBlocks(page.jsonLdRaw, page);
  const types = [...new Set(v.blocks.flatMap((b) => b.types))];
  checks.push(
    !v.blocks.length
      ? mkCheck('jsonld', 'Données structurées (JSON-LD)', 'fail', v.microdataTypes.length ? `Pas de JSON-LD (microdonnées : ${v.microdataTypes.join(', ')}).` : 'Aucune donnée structurée JSON-LD.', 'Ajoutez un bloc JSON-LD (LocalBusiness, Organization ou Product) : générateur Repéré, ou JSON-LD servi par Repéré.', W.jsonld, { task: 'jsonld' })
      : v.errors.length
        ? mkCheck('jsonld', 'Données structurées (JSON-LD)', 'warn', `${v.blocks.length} bloc(s) (${types.join(', ') || 'sans type'}), ${v.errors.length} erreur(s) : ${v.errors[0]}`, 'Corrigez les erreurs signalées par le validateur JSON-LD.', W.jsonld, { task: 'jsonld' })
        : mkCheck('jsonld', 'Données structurées (JSON-LD)', 'ok', `${v.blocks.length} bloc(s) valide(s) : ${types.slice(0, 8).join(', ')}.`, '', W.jsonld),
  );

  // Sitemap
  checks.push(
    x.sitemap.found
      ? mkCheck('sitemap', 'Plan du site (sitemap)', 'ok', `Sitemap trouvé : ${x.sitemap.url}.`, '', W.sitemap)
      : mkCheck('sitemap', 'Plan du site (sitemap)', 'fail', 'Aucun sitemap trouvé (robots.txt, /sitemap.xml, /sitemap_index.xml).', 'Publiez un sitemap.xml et déclarez-le dans robots.txt (ligne « Sitemap: »).', W.sitemap),
  );

  // Canonical
  let canonAbs: string | null = null;
  try {
    canonAbs = page.canonical ? new URL(page.canonical, snap.finalUrl).toString() : null;
  } catch {
    canonAbs = null;
  }
  const strip = (s: string) => s.replace(/[?#].*$/, '').replace(/\/$/, '');
  checks.push(
    !page.canonical
      ? mkCheck('canonical', 'URL canonique', 'warn', 'Pas de balise canonical.', 'Ajoutez <link rel="canonical" href="…"> avec l’adresse de référence de la page.', W.canonical)
      : canonAbs && strip(canonAbs) !== strip(snap.finalUrl)
        ? mkCheck('canonical', 'URL canonique', 'warn', `La canonique pointe ailleurs : ${canonAbs}.`, 'Vérifiez que c’est voulu : les moteurs retiendront l’autre adresse.', W.canonical)
        : mkCheck('canonical', 'URL canonique', 'ok', 'Canonique présente et cohérente.', '', W.canonical),
  );

  // Lang
  checks.push(
    page.lang
      ? mkCheck('lang', 'Langue déclarée', 'ok', `lang="${page.lang}".`, '', W.lang)
      : mkCheck('lang', 'Langue déclarée', 'fail', 'Aucun attribut lang sur <html>.', 'Ajoutez <html lang="fr">.', W.lang),
  );

  // Poids HTML
  checks.push(
    snap.truncated || snap.bytes > 1_500_000
      ? mkCheck('html_weight', 'Poids du HTML', 'fail', `HTML de ${kb(snap.bytes)}${snap.truncated ? ' ou plus (lecture arrêtée à 2 Mo)' : ''}.`, 'Allégez le HTML initial (scripts et styles en fichiers séparés, données inutiles retirées).', W.html_weight)
      : snap.bytes > 500_000
        ? mkCheck('html_weight', 'Poids du HTML', 'warn', `HTML de ${kb(snap.bytes)}.`, 'Visez moins de 500 Ko de HTML initial.', W.html_weight)
        : mkCheck('html_weight', 'Poids du HTML', 'ok', `HTML de ${kb(snap.bytes)}.`, '', W.html_weight),
  );

  // Temps de réponse
  const ms = snap.responseMs;
  checks.push(
    ms <= 800
      ? mkCheck('response_time', 'Temps de réponse', 'ok', `${ms} ms (mesure unique depuis notre serveur).`, '', W.response_time)
      : ms <= 2000
        ? mkCheck('response_time', 'Temps de réponse', 'warn', `${ms} ms (mesure unique depuis notre serveur).`, 'Activez un cache de page ou un CDN ; certains robots abandonnent les pages lentes.', W.response_time)
        : mkCheck('response_time', 'Temps de réponse', 'fail', `${ms} ms (mesure unique depuis notre serveur).`, 'Activez un cache de page ou un CDN ; certains robots abandonnent les pages lentes.', W.response_time),
  );

  // Open Graph
  const ogKeys = ['og:title', 'og:description', 'og:image'].filter((k) => page.og[k]);
  checks.push(
    ogKeys.length === 3
      ? mkCheck('open_graph', 'Open Graph', 'ok', 'og:title, og:description et og:image présents.', '', W.open_graph)
      : mkCheck('open_graph', 'Open Graph', ogKeys.length ? 'warn' : 'fail', ogKeys.length ? `Présents : ${ogKeys.join(', ')}.` : 'Aucune balise Open Graph.', 'Ajoutez og:title, og:description et og:image (aperçus de partage, lus par certains assistants).', W.open_graph),
  );

  // llms.txt (information)
  checks.push(
    mkCheck('llms_txt', 'llms.txt (information)', x.llms.found ? 'ok' : 'warn', x.llms.found ? `Fichier trouvé : ${x.llms.url}. ${LLMS_NOTE}` : `Aucun llms.txt. ${LLMS_NOTE}`, 'Facultatif : générateur llms.txt de Repéré.', 0, { informational: true }),
  );

  return checks;
}

/** Rapport à partir d'une page déjà récupérée (pur, pour les tests et l'app). */
export function readinessFromSnapshot(snap: PageSnapshot, x: ReadinessExtras): ReadinessReport {
  const page = parseHtml(snap.body);
  const render = renderReport(page, snap.bytes);
  const checks = readinessChecks(snap, page, render, x);
  const scored = finalize(checks);
  // Plafonds : un défaut bloquant ne doit pas être compensé par des détails (score honnête).
  const st = (id: string) => checks.find((c) => c.id === id)?.status;
  const caps: [boolean, number, string][] = [
    [st('status') === 'fail', 20, 'Page inaccessible : score plafonné à 20.'],
    [st('indexable') === 'fail', 30, 'Page en « noindex » : score plafonné à 30.'],
    [render.verdict === 'quasi_vide', 40, 'Page quasi vide sans JavaScript : score plafonné à 40.'],
    [st('robots') === 'fail', 50, 'Robots de recherche IA bloqués : score plafonné à 50.'],
  ];
  const cap = caps.find(([on, max]) => on && scored.score > max);
  if (cap) scored.score = cap[1];
  const types = [...new Set(page.jsonLdRaw.flatMap((raw) => { try { return allNodes(JSON.parse(raw)).flatMap(typesOf); } catch { return []; } }))];
  return {
    ...scored,
    url: snap.url,
    finalUrl: snap.finalUrl,
    httpStatus: snap.status,
    fetchedAt: new Date().toISOString(),
    elapsedMs: snap.responseMs,
    htmlBytes: snap.bytes,
    words: render.words,
    robots: x.robots,
    render,
    sitemap: x.sitemap,
    jsonLdTypes: types,
    llmsTxt: { found: x.llms.found, url: x.llms.url, note: LLMS_NOTE },
    limits: READINESS_LIMITS,
    ...(cap ? { cap: cap[2] } : {}),
  };
}

function isXmlSitemap(r: SafeResponse | null): boolean {
  return !!r && r.status >= 200 && r.status < 300 && /<(urlset|sitemapindex)\b/i.test(r.body.slice(0, 5000));
}

/** Cherche un sitemap : lignes Sitemap du robots.txt (même site), puis emplacements usuels. */
export async function findSitemap(origin: string, declared: string[], opts: SafeFetchOptions = {}): Promise<{ found: boolean; url: string | null }> {
  const candidates = [...declared.slice(0, 3), `${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`];
  for (const c of [...new Set(candidates)]) {
    const r = await tryFetch(c, { ...opts, accept: 'application/xml,text/xml;q=0.9,*/*;q=0.5' });
    if (isXmlSitemap(r)) return { found: true, url: c };
  }
  return { found: false, url: declared[0] ?? null };
}

export async function findLlmsTxt(origin: string, opts: SafeFetchOptions = {}): Promise<{ found: boolean; url: string; body: string | null }> {
  const url = `${origin}/llms.txt`;
  const r = await tryFetch(url, { ...opts, accept: 'text/plain,text/markdown;q=0.9,*/*;q=0.5' });
  const ok = !!r && r.status >= 200 && r.status < 300 && !/text\/html/i.test(r.contentType) && !/^\s*<(!doctype|html)/i.test(r.body.slice(0, 200)) && r.body.trim().length > 0;
  return { found: ok, url, body: ok && r ? r.body : null };
}

/** Audit d'une URL qui renvoie aussi le HTML lu (réutilisé par la citabilité et le comparateur). */
export async function auditPage(input: string, opts: SafeFetchOptions = {}): Promise<{ readiness: ReadinessReport; html: string; finalUrl: string }> {
  const u = normalizeInputUrl(input);
  const res = await safeFetch(u, opts);
  const origin = new URL(res.finalUrl).origin;
  const robots = await analyzeRobots(res.finalUrl, opts).catch((e) => {
    if (e instanceof SafeFetchError && e.code.startsWith('blocked')) throw e;
    return null;
  });
  const host = (h: string) => h.replace(/^www\./, '');
  const sameOrigin = (robots?.sitemaps ?? []).filter((s) => {
    try {
      return host(new URL(s).hostname) === host(new URL(origin).hostname);
    } catch {
      return false;
    }
  });
  const [sitemap, llms] = await Promise.all([findSitemap(origin, sameOrigin, opts), findLlmsTxt(origin, opts)]);
  return { readiness: readinessFromSnapshot(snapshotOf(res), { robots, sitemap: { found: sitemap.found, url: sitemap.url }, llms: { found: llms.found, url: llms.url } }), html: res.body, finalUrl: res.finalUrl };
}

/** Audit complet d'une URL. Lève SafeFetchError (adresse refusée, injoignable, robots.txt qui nous interdit). */
export async function auditReadiness(input: string, opts: SafeFetchOptions = {}): Promise<ReadinessReport> {
  return (await auditPage(input, opts)).readiness;
}

/** Extrait de page pour d'autres modules (suggestions de questions…) : titre, description, titres. */
export async function fetchPageSnapshot(url: string, opts: SafeFetchOptions = {}): Promise<{ url: string; title?: string; description?: string; headings: string[]; text: string } | null> {
  try {
    const res = await safeFetch(url, opts);
    if (res.status < 200 || res.status >= 300) return null;
    const p = parseHtml(res.body);
    return { url: res.finalUrl, title: p.title || undefined, description: p.metaDescription ?? undefined, headings: p.headings.map((h) => h.text).filter(Boolean).slice(0, 40), text: p.mainText.slice(0, 5000) };
  } catch {
    return null;
  }
}
