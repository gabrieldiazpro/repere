/** Section « Indexation et exploration » : robots.txt, sitemaps, directives noindex, rendu, profondeur. */
import { disallowedPaths, isAllowed, parseRobots } from '@/lib/siteaudit/robots';
import { proposeRobots, proposeSitemap } from '../autofix';
import { SRC } from '../sources';
import type { CheckDef } from '../types';
import { hostOf, isNoindex, norm, pl, robotsDirectives } from '../util';
import { hitItems, hitPages, hitSite, inlinkCount, inSitemap, isUtility, pageAt } from './helpers';

const sec = 'indexation' as const;
const cat = 'indexation';

function robotsParsed(text?: string) {
  return text ? parseRobots(text) : null;
}

export const INDEXATION: CheckDef[] = [
  {
    id: 'seo.robots.blocks_all', section: sec, category: cat, severity: 'critical', impact: 3, effort: 1, scope: 'site',
    label: 'robots.txt bloque tout le site pour Google',
    title: () => 'Votre fichier robots.txt interdit à Google d’explorer le site',
    why: 'Avec « Disallow: / », Google ne peut plus lire vos pages : elles disparaissent peu à peu des résultats ou s’affichent sans description.',
    fix: 'Retirez la ligne « Disallow: / » du robots.txt (souvent un réglage « décourager les moteurs » resté actif après la mise en ligne).',
    source: SRC.robotsSpec,
    run: (ctx) => {
      const r = ctx.crawl.robots;
      if (!r || r.status !== 200) return null;
      const parsed = robotsParsed(r.text);
      if (!parsed || isAllowed(parsed, 'Googlebot', '/')) return null;
      return hitSite(ctx, r.url, { evidence: 'Disallow: / pour Googlebot', autoFix: { kind: 'robots', payload: proposeRobots(ctx, { unblockAll: true, addSitemap: true }) } });
    },
  },
  {
    id: 'seo.robots.server_error', section: sec, category: cat, severity: 'critical', impact: 3, effort: 2, scope: 'site',
    label: 'robots.txt en erreur serveur (5xx)',
    title: () => 'Votre robots.txt répond par une erreur serveur',
    why: 'Quand robots.txt renvoie une erreur 5xx, Google suspend l’exploration de tout le site par prudence.',
    fix: 'Faites répondre /robots.txt en 200 (même vide) ou en 404 s’il n’existe pas. Vérifiez l’hébergeur ou le pare-feu.',
    source: SRC.robotsSpec,
    run: (ctx) => (ctx.crawl.robots && ctx.crawl.robots.status >= 500 ? hitSite(ctx, ctx.crawl.robots.url, { evidence: `HTTP ${ctx.crawl.robots.status}` }) : null),
  },
  {
    id: 'seo.robots.missing', section: sec, category: cat, severity: 'low', impact: 1, effort: 1, scope: 'site',
    label: 'robots.txt absent',
    title: () => 'Votre site n’a pas de fichier robots.txt',
    why: 'Ce n’est pas bloquant (Google explore tout), mais robots.txt est l’endroit standard pour indiquer votre sitemap.',
    fix: 'Créez un robots.txt minimal (« User-agent: * », « Allow: / ») avec la ligne « Sitemap: » vers votre plan de site.',
    source: SRC.robots,
    run: (ctx) => {
      const r = ctx.crawl.robots;
      if (r && r.status !== 404 && r.status !== 410) return null;
      return hitSite(ctx, r?.url, { autoFix: { kind: 'robots', payload: proposeRobots(ctx, { addSitemap: true }) } });
    },
  },
  {
    id: 'seo.robots.no_sitemap', section: sec, category: cat, severity: 'low', impact: 1, effort: 1, scope: 'site',
    label: 'robots.txt sans ligne Sitemap',
    title: () => 'Votre robots.txt n’indique pas votre plan de site (sitemap)',
    why: 'La ligne « Sitemap: » aide tous les moteurs (Google, Bing, robots des IA) à trouver vos pages, même sans Search Console.',
    fix: 'Ajoutez « Sitemap: https://votre-site/sitemap.xml » à la fin du robots.txt.',
    source: SRC.sitemap,
    run: (ctx) => {
      const r = ctx.crawl.robots;
      if (!r || r.status !== 200 || r.sitemaps.length) return null;
      return hitSite(ctx, r.url, { autoFix: { kind: 'robots', payload: proposeRobots(ctx, { addSitemap: true }) } });
    },
  },
  {
    id: 'seo.robots.blocks_resources', section: sec, category: cat, severity: 'medium', impact: 2, effort: 1, scope: 'site',
    label: 'robots.txt bloque CSS/JS',
    title: () => 'Votre robots.txt bloque des fichiers CSS ou JavaScript',
    why: 'Google affiche vos pages comme un navigateur ; sans CSS/JS il peut mal comprendre la mise en page mobile et le contenu.',
    fix: 'Retirez les règles Disallow qui visent les dossiers de styles et scripts (ex. /wp-includes/, /assets/, *.js, *.css).',
    source: SRC.js,
    run: (ctx) => {
      const r = ctx.crawl.robots;
      const parsed = r?.status === 200 ? robotsParsed(r.text) : null;
      if (!parsed) return null;
      const bad = disallowedPaths(parsed, 'Googlebot').filter((p) => /\.css|\.js|wp-includes|\/assets|\/static|\/_next|\/js\/|\/css\//i.test(p));
      return bad.length ? hitSite(ctx, bad.join(', '), { evidence: bad.join(' ; '), autoFix: { kind: 'robots', payload: proposeRobots(ctx, { unblockAssets: true }) } }) : null;
    },
  },
  {
    id: 'seo.sitemap.missing', section: sec, category: cat, severity: 'medium', impact: 2, effort: 1, scope: 'site',
    label: 'Aucun sitemap XML',
    title: () => 'Aucun plan de site (sitemap XML) trouvé',
    why: 'Le sitemap liste vos pages importantes : Google et Bing les découvrent plus vite, surtout les pages peu liées.',
    fix: 'Activez le sitemap de votre CMS (WordPress, Shopify, Wix le font) ou publiez celui que nous proposons, puis déclarez-le dans Search Console.',
    source: SRC.sitemap,
    run: (ctx) => {
      if (ctx.crawl.sitemaps.some((s) => s.status === 200) || ctx.crawl.sitemapUrls.length) return null;
      return hitSite(ctx, undefined, { autoFix: { kind: 'sitemap', payload: proposeSitemap(ctx) } });
    },
  },
  {
    id: 'seo.sitemap.error', section: sec, category: cat, severity: 'high', impact: 2, effort: 1, scope: 'site',
    label: 'Sitemap inaccessible ou invalide',
    title: (n) => `${pl(n, 'sitemap est inaccessible ou invalide', 'sitemaps sont inaccessibles ou invalides')}`,
    why: 'Un sitemap en erreur est ignoré : les moteurs perdent la liste de vos pages.',
    fix: 'Corrigez l’adresse ou le format du sitemap (XML valide, statut 200), puis renvoyez-le dans Search Console.',
    source: SRC.sitemap,
    run: (ctx) => hitItems(ctx.crawl.sitemaps.filter((s) => s.status !== 200 || s.errors.length).map((s) => ({ url: s.url, detail: s.status !== 200 ? `HTTP ${s.status}` : s.errors.slice(0, 2).join(' ; ') }))),
  },
  {
    id: 'seo.sitemap.too_big', section: sec, category: cat, severity: 'medium', impact: 1, effort: 1, scope: 'site',
    label: 'Sitemap de plus de 50 000 URL',
    title: () => 'Un sitemap dépasse 50 000 adresses',
    why: 'Au-delà de 50 000 URL (ou 50 Mo), un sitemap n’est pas lu en entier.',
    fix: 'Découpez-le en plusieurs fichiers réunis par un index de sitemaps.',
    source: SRC.sitemap,
    run: (ctx) => hitItems(ctx.crawl.sitemaps.filter((s) => s.urlCount > 50_000).map((s) => ({ url: s.url, detail: `${s.urlCount} URL` }))),
  },
  {
    id: 'seo.sitemap.non_indexable', section: sec, category: cat, severity: 'medium', impact: 2, effort: 1, scope: 'page',
    label: 'Sitemap : pages non indexables',
    title: (n) => `${pl(n, 'page du sitemap n’est pas indexable', 'pages du sitemap ne sont pas indexables')} (noindex ou canonique ailleurs)`,
    why: 'Le sitemap doit ne lister que les pages que vous voulez voir dans Google ; sinon vous envoyez des signaux contradictoires.',
    fix: 'Retirez ces adresses du sitemap, ou rendez-les indexables si elles doivent apparaître.',
    source: SRC.sitemap,
    run: (ctx) => hitPages(ctx.html.filter((p) => !p.isIndexable && p.redirectChain.length === 0 && inSitemap(ctx, p)), (p) => (isNoindex(p) ? 'noindex' : p.canonical ? `canonique → ${p.canonical}` : 'non indexable'), { autoFix: { kind: 'sitemap', payload: proposeSitemap(ctx) } }),
  },
  {
    id: 'seo.sitemap.broken', section: sec, category: cat, severity: 'high', impact: 2, effort: 1, scope: 'page',
    label: 'Sitemap : pages en erreur',
    title: (n) => `${pl(n, 'adresse du sitemap renvoie', 'adresses du sitemap renvoient')} une erreur`,
    why: 'Des URL en erreur dans le sitemap gaspillent l’exploration et font douter Google de la fiabilité du fichier.',
    fix: 'Retirez-les du sitemap ou rétablissez les pages (ou redirigez-les en 301 vers la page la plus proche).',
    source: SRC.sitemap,
    run: (ctx) => hitPages(ctx.pages.filter((p) => p.status >= 400 && inSitemap(ctx, p)), (p) => `HTTP ${p.status}`, { autoFix: { kind: 'sitemap', payload: proposeSitemap(ctx) } }),
  },
  {
    id: 'seo.sitemap.redirects', section: sec, category: cat, severity: 'low', impact: 1, effort: 1, scope: 'page',
    label: 'Sitemap : adresses redirigées',
    title: (n) => `${pl(n, 'adresse du sitemap est redirigée', 'adresses du sitemap sont redirigées')}`,
    why: 'Le sitemap doit contenir l’adresse finale de chaque page, pas une adresse qui redirige.',
    fix: 'Remplacez ces URL par leur destination finale.',
    source: SRC.sitemap,
    run: (ctx) => hitItems(ctx.pages.filter((p) => p.redirectChain.length > 0 && p.status < 400 && inSitemap(ctx, p)).map((p) => ({ url: p.url, detail: `→ ${p.finalUrl}` })), { autoFix: { kind: 'sitemap', payload: proposeSitemap(ctx) } }),
  },
  {
    id: 'seo.sitemap.other_host', section: sec, category: cat, severity: 'medium', impact: 1, effort: 1, scope: 'site',
    label: 'Sitemap : URL d’un autre domaine ou protocole',
    title: (n) => `${pl(n, 'adresse du sitemap pointe', 'adresses du sitemap pointent')} vers un autre domaine ou en http`,
    why: 'Un sitemap ne peut déclarer que des pages de son propre domaine et protocole ; les autres sont ignorées.',
    fix: 'Régénérez le sitemap avec l’adresse officielle du site (https et avec/sans www comme le site).',
    source: SRC.sitemapOverview,
    run: (ctx) => {
      const prefix = `${ctx.origin}/`;
      const bad = ctx.crawl.sitemapUrls.filter((u) => !(norm(u) ?? '').startsWith(prefix));
      return bad.length ? { items: bad.map((u) => ({ url: u })), evidence: `attendu : ${prefix}…` } : null;
    },
  },
  {
    id: 'seo.sitemap.missing_pages', section: sec, category: cat, severity: 'low', impact: 1, effort: 1, scope: 'page',
    label: 'Pages indexables absentes du sitemap',
    title: (n) => `${pl(n, 'page indexable n’est pas', 'pages indexables ne sont pas')} dans le sitemap`,
    why: 'Les pages hors sitemap sont découvertes plus lentement et considérées comme moins importantes.',
    fix: 'Ajoutez-les au sitemap (ou vérifiez qu’elles doivent vraiment être indexées).',
    source: SRC.sitemapOverview,
    run: (ctx) => {
      if (!ctx.sitemapSet.size) return null;
      return hitPages(ctx.indexable.filter((p) => !inSitemap(ctx, p)), undefined, { autoFix: { kind: 'sitemap', payload: proposeSitemap(ctx) } });
    },
  },
  {
    id: 'seo.index.home_noindex', section: sec, category: cat, severity: 'critical', impact: 3, effort: 1, scope: 'site',
    label: 'Page d’accueil exclue de Google',
    title: () => 'Votre page d’accueil interdit son indexation (noindex)',
    why: 'Votre page la plus importante est exclue de Google : vous êtes introuvable sur votre propre nom.',
    fix: 'Retirez « noindex » de la balise meta robots (ou de l’en-tête X-Robots-Tag) de la page d’accueil.',
    source: SRC.blockIndexing,
    run: (ctx) => (ctx.home && isNoindex(ctx.home) ? hitSite(ctx, robotsDirectives(ctx.home).join(', '), { autoFix: { kind: 'meta.robots', payload: { items: [{ url: ctx.home.finalUrl, value: 'index, follow' }] } } }) : null),
  },
  {
    id: 'seo.index.noindex', section: sec, category: cat, severity: 'low', impact: 2, effort: 1, scope: 'page',
    label: 'Pages en noindex (à vérifier)',
    title: (n) => `${pl(n, 'page est exclue', 'pages sont exclues')} de Google par une balise noindex`,
    why: 'Parfois voulu, souvent un oubli (réglage de thème, page dupliquée). Ces pages n’apparaîtront jamais dans Google.',
    fix: 'Vérifiez la liste : retirez « noindex » des pages qui doivent être trouvées.',
    source: SRC.blockIndexing,
    run: (ctx) => hitPages(ctx.html.filter((p) => p !== ctx.home && /noindex|none/i.test(p.metaRobots ?? '') && !isUtility(p)), (p) => p.metaRobots),
  },
  {
    id: 'seo.index.xrobots_noindex', section: sec, category: cat, severity: 'medium', impact: 2, effort: 2, scope: 'page',
    label: 'noindex envoyé par l’en-tête HTTP',
    title: (n) => `${pl(n, 'page est exclue', 'pages sont exclues')} par l’en-tête serveur X-Robots-Tag`,
    why: 'Cette consigne est invisible dans la page : elle vient souvent d’un réglage serveur oublié (préproduction).',
    fix: 'Retirez « noindex » de l’en-tête X-Robots-Tag dans la configuration du serveur ou de l’hébergeur.',
    source: SRC.robotsMeta,
    run: (ctx) => hitPages(ctx.html.filter((p) => /noindex|none/i.test(p.headers['x-robots-tag'] ?? '') && !isUtility(p)), (p) => p.headers['x-robots-tag']),
  },
  {
    id: 'seo.index.nofollow', section: sec, category: cat, severity: 'medium', impact: 2, effort: 1, scope: 'page',
    label: 'Pages en nofollow',
    title: (n) => `${pl(n, 'page demande', 'pages demandent')} à Google de ne suivre aucun lien (nofollow)`,
    why: 'Google ne suit pas les liens de ces pages : les pages liées sont moins bien découvertes et moins valorisées.',
    fix: 'Retirez « nofollow » de la balise meta robots (gardez « index, follow »).',
    source: SRC.robotsMeta,
    run: (ctx) => hitPages(ctx.html.filter((p) => robotsDirectives(p).includes('nofollow') && !isUtility(p)), (p) => robotsDirectives(p).join(', ')),
  },
  {
    id: 'seo.index.nosnippet', section: sec, category: cat, severity: 'medium', impact: 2, effort: 1, scope: 'page',
    label: 'Extraits interdits (nosnippet)',
    title: (n) => `${pl(n, 'page interdit', 'pages interdisent')} l’affichage d’un extrait (nosnippet / max-snippet:0)`,
    why: 'Sans extrait, votre résultat est moins attractif et les réponses générées par l’IA de Google ne peuvent pas vous citer.',
    fix: 'Retirez « nosnippet » / « max-snippet:0 » sauf contrainte légale.',
    source: SRC.robotsMeta,
    run: (ctx) => hitPages(ctx.html.filter((p) => robotsDirectives(p).some((d) => d === 'nosnippet' || /^max-snippet\s*:\s*0$/.test(d))), (p) => robotsDirectives(p).join(', ')),
  },
  {
    id: 'seo.index.unavailable_after', section: sec, category: cat, severity: 'low', impact: 1, effort: 1, scope: 'page',
    label: 'Directive unavailable_after',
    title: (n) => `${pl(n, 'page a', 'pages ont')} une date d’expiration pour Google (unavailable_after)`,
    why: 'Après cette date, Google retirera la page de ses résultats.',
    fix: 'Vérifiez que c’est voulu ; sinon retirez la directive.',
    source: SRC.robotsMeta,
    run: (ctx) => hitPages(ctx.html.filter((p) => robotsDirectives(p).some((d) => d.startsWith('unavailable_after'))), (p) => robotsDirectives(p).find((d) => d.startsWith('unavailable_after'))),
  },
  {
    id: 'seo.index.blocked_in_sitemap', section: sec, category: cat, severity: 'medium', impact: 2, effort: 1, scope: 'page',
    label: 'Pages du sitemap bloquées par robots.txt',
    title: (n) => `${pl(n, 'page du sitemap est bloquée', 'pages du sitemap sont bloquées')} par robots.txt`,
    why: 'Vous demandez à Google d’indexer une page tout en lui interdisant de la lire : elle s’affichera sans description, ou pas du tout.',
    fix: 'Choisissez : soit autorisez l’exploration dans robots.txt, soit retirez la page du sitemap.',
    source: SRC.robots,
    run: (ctx) => hitPages(ctx.pages.filter((p) => p.blockedByRobots && inSitemap(ctx, p))),
  },
  {
    id: 'seo.index.blocked_linked', section: sec, category: cat, severity: 'low', impact: 1, effort: 1, scope: 'page',
    label: 'Pages liées mais bloquées par robots.txt',
    title: (n) => `${pl(n, 'page liée depuis votre site est bloquée', 'pages liées depuis votre site sont bloquées')} par robots.txt`,
    why: 'Google peut indexer l’adresse sans pouvoir lire la page (« aucune information disponible »).',
    fix: 'Si la page doit être absente de Google, autorisez son exploration et mettez « noindex » ; sinon débloquez-la.',
    source: SRC.blockIndexing,
    run: (ctx) => hitPages(ctx.pages.filter((p) => p.blockedByRobots && !inSitemap(ctx, p) && !isUtility(p) && inlinkCount(ctx, p) > 0)),
  },
  {
    id: 'seo.index.client_rendered', section: sec, category: cat, severity: 'high', impact: 3, effort: 3, scope: 'page',
    label: 'Contenu généré uniquement en JavaScript',
    title: (n) => `${pl(n, 'page affiche', 'pages affichent')} leur contenu seulement après exécution du JavaScript`,
    why: 'Google rend le JavaScript avec retard et pas toujours en entier ; la plupart des robots des IA ne l’exécutent pas du tout.',
    fix: 'Servez le texte principal dans le HTML initial (rendu côté serveur, pré-rendu ou génération statique).',
    source: SRC.js,
    run: (ctx) => hitPages(ctx.html.filter((p) => p.renderHints.likelyClientRendered), (p) => `${p.wordCount} mots lisibles sans JavaScript`),
  },
  {
    id: 'seo.index.low_indexable_ratio', section: sec, category: cat, severity: 'medium', impact: 2, effort: 2, scope: 'site',
    label: 'Moins de la moitié des pages indexables',
    title: () => 'Moins de la moitié des pages explorées sont indexables',
    why: 'Beaucoup de pages exclues, redirigées ou dupliquées diluent l’exploration de Google au détriment des pages utiles.',
    fix: 'Repérez les familles d’URL non indexables (filtres, paramètres, doublons) et cessez de les lier ou bloquez leur exploration.',
    source: SRC.canonical,
    run: (ctx) => {
      const n = ctx.html.length;
      if (n < 10) return null;
      const r = ctx.indexable.length / n;
      return r < 0.5 ? hitSite(ctx, undefined, { evidence: `${ctx.indexable.length} indexables sur ${n} pages HTML (${Math.round(r * 100)} %)` }) : null;
    },
  },
  {
    id: 'seo.index.deep_pages', section: sec, category: cat, severity: 'medium', impact: 2, effort: 2, scope: 'page',
    label: 'Pages à plus de 3 clics de l’accueil',
    title: (n) => `${pl(n, 'page est', 'pages sont')} à plus de 3 clics de l’accueil`,
    why: 'Plus une page est profonde, moins Google la visite et moins il la juge importante.',
    fix: 'Liez ces pages depuis le menu, des pages catégories ou des blocs « à voir aussi ».',
    source: SRC.links,
    run: (ctx) => hitPages(ctx.indexable.filter((p) => p.depth > 3), (p) => `profondeur ${p.depth}`),
  },
  {
    id: 'seo.index.crawl_errors', section: sec, category: cat, severity: 'medium', impact: 2, effort: 2, scope: 'site',
    label: 'Adresses sans réponse',
    title: (n) => `${pl(n, 'adresse n’a pas répondu', 'adresses n’ont pas répondu')} pendant l’exploration`,
    why: 'Des délais dépassés ou des connexions refusées empêchent aussi Google de lire ces pages.',
    fix: 'Vérifiez l’hébergement (lenteurs, pare-feu trop strict, limites de requêtes) pour ces adresses.',
    source: SRC.httpErrors,
    run: (ctx) => hitItems(ctx.crawl.errors.filter((e) => hostOf(e.url).replace(/^www\./, '') === ctx.host.replace(/^www\./, '')).map((e) => ({ url: e.url, detail: e.error }))),
  },
  {
    id: 'seo.index.truncated', section: sec, category: cat, severity: 'info', impact: 1, effort: 1, scope: 'site',
    label: 'Exploration partielle',
    title: () => 'Exploration partielle : nous avons atteint la limite de pages ou de temps',
    why: 'Les constats portent sur les pages explorées ; certains (pages orphelines notamment) sont donc prudents.',
    fix: 'Lancez une exploration complète depuis votre espace pour couvrir tout le site.',
    source: SRC.sitemapOverview,
    run: (ctx) => (ctx.crawl.truncated ? hitSite(ctx, `${ctx.pages.length} pages explorées`) : null),
  },
  {
    id: 'seo.index.home_unreachable', section: sec, category: cat, severity: 'critical', impact: 3, effort: 2, scope: 'site',
    label: 'Page d’accueil inaccessible',
    title: () => 'Votre page d’accueil n’est pas accessible',
    why: 'Sans page d’accueil lisible, ni Google ni les IA ne peuvent comprendre ni parcourir votre site.',
    fix: 'Rétablissez la page d’accueil (statut 200) et vérifiez l’hébergement.',
    source: SRC.httpErrors,
    run: (ctx) => {
      const h = pageAt(ctx, ctx.crawl.startUrl) ?? ctx.pages[0];
      if (!h) return hitSite(ctx, 'aucune page récupérée');
      return h.status >= 400 || h.blockedByRobots ? hitSite(ctx, h.blockedByRobots ? 'bloquée par robots.txt' : `HTTP ${h.status}`) : null;
    },
  },
];
