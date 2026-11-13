/** Sections « Maillage interne et pages orphelines » et « Liens cassés ». */
import { SRC } from '../sources';
import type { AuditCtx, CheckDef, CrawledPage } from '../types';
import { isNoindex, norm, pl, sameSite } from '../util';
import { hitItems, hitPages, inlinkCount, pageAt } from './helpers';

const GENERIC_ANCHOR = /^(cliquez ici|cliquer ici|ici|en savoir plus|savoir plus|lire la suite|lire plus|voir plus|plus|suite|d[ée]couvrir|voir|lien|cet article|click here|here|read more|learn more|more|>>|»|→)$/i;

/** Liens internes vers une page crawlée en erreur 4xx (sans redirection préalable). */
function brokenTargets(ctx: AuditCtx, withChain: boolean): Map<CrawledPage, string[]> {
  const m = new Map<CrawledPage, string[]>();
  for (const l of ctx.internalLinks) {
    const t = pageAt(ctx, l.to);
    if (!t || t.status < 400 || t.status >= 500) continue;
    if (withChain !== t.redirectChain.length > 0) continue;
    const arr = m.get(t) ?? [];
    if (!arr.includes(l.from)) arr.push(l.from);
    m.set(t, arr);
  }
  return m;
}

/** Destination proposée pour un lien cassé : le parent existant le plus proche, sinon l'accueil. */
function nearestParent(ctx: AuditCtx, url: string): string {
  try {
    const u = new URL(url);
    const segs = u.pathname.split('/').filter(Boolean);
    while (segs.length > 1) {
      segs.pop();
      for (const cand of [`${ctx.origin}/${segs.join('/')}/`, `${ctx.origin}/${segs.join('/')}`]) {
        const p = pageAt(ctx, cand);
        if (p && p.status === 200 && p.isIndexable) return p.finalUrl;
      }
    }
  } catch {
    /* adresse invalide : accueil */
  }
  return `${ctx.origin}/`;
}

export const MAILLAGE: CheckDef[] = [
  {
    id: 'seo.link.orphans', section: 'maillage', category: 'liens', severity: 'medium', impact: 2, effort: 2, scope: 'page',
    label: 'Pages orphelines (dans le sitemap, jamais liées)',
    title: (n) => `${pl(n, 'page du sitemap n’est liée', 'pages du sitemap ne sont liées')} depuis aucune autre page (orphelines)`,
    why: 'Une page que rien ne relie est vue comme sans importance : visiteurs et moteurs la trouvent à peine.',
    fix: 'Liez chaque page utile depuis au moins une page proche (catégorie, service parent, article connexe).',
    source: SRC.links,
    run: (ctx) => {
      // CRAWL marque depth = -1 les pages vues seulement dans le sitemap (aucun lien trouvé vers elles).
      const flagged = ctx.html.filter((p) => p.depth === -1 && p.isIndexable && p !== ctx.home);
      if (ctx.crawl.truncated || !ctx.sitemapSet.size) return hitItems(flagged.map((p) => ({ url: p.finalUrl })));
      const home = norm(ctx.home?.finalUrl ?? '');
      const items: { url: string }[] = flagged.map((p) => ({ url: p.finalUrl }));
      const done = new Set(items.map((i) => norm(i.url)));
      for (const u of ctx.sitemapSet) {
        if (u === home || !u.startsWith(`${ctx.origin}/`)) continue;
        const p = pageAt(ctx, u);
        if (p && (p.status !== 200 || !p.isIndexable)) continue;
        const linked = (ctx.inlinks.get(u)?.length ?? 0) > 0 || (p ? inlinkCount(ctx, p) > 0 : false);
        if (!linked && !done.has(u)) items.push({ url: u });
      }
      return hitItems(items);
    },
  },
  {
    id: 'seo.link.dead_end', section: 'maillage', category: 'liens', severity: 'low', impact: 1, effort: 1, scope: 'page',
    label: 'Pages sans aucun lien interne sortant',
    title: (n) => `${pl(n, 'page ne contient', 'pages ne contiennent')} aucun lien vers le reste du site`,
    why: 'Ces impasses bloquent la navigation des visiteurs et des robots.',
    fix: 'Ajoutez le menu, un fil d’Ariane ou des liens vers les pages liées.',
    source: SRC.links,
    run: (ctx) => hitPages(ctx.html.filter((p) => p.internalLinks === 0 && !p.renderHints.likelyClientRendered)),
  },
  {
    id: 'seo.link.weak_inlinks', section: 'maillage', category: 'liens', severity: 'low', impact: 1, effort: 1, scope: 'page',
    label: 'Pages recevant un seul lien interne',
    title: (n) => `${pl(n, 'page indexable ne reçoit', 'pages indexables ne reçoivent')} qu’un seul lien interne`,
    why: 'Le nombre de liens internes indique à Google l’importance d’une page ; un seul lien, c’est peu.',
    fix: 'Ajoutez des liens contextuels depuis les pages qui parlent du même sujet.',
    source: SRC.links,
    run: (ctx) => (ctx.indexable.length < 5 ? null : hitPages(ctx.indexable.filter((p) => p !== ctx.home && inlinkCount(ctx, p) === 1))),
  },
  {
    id: 'seo.link.nofollow_internal', section: 'maillage', category: 'liens', severity: 'low', impact: 1, effort: 1, scope: 'page',
    label: 'Liens internes en nofollow',
    title: (n) => `${pl(n, 'page contient', 'pages contiennent')} des liens internes en nofollow`,
    why: 'Mettre « nofollow » sur vos propres liens freine la découverte et la valorisation de vos pages.',
    fix: 'Retirez rel="nofollow" des liens entre vos pages (gardez-le pour les liens sponsorisés externes).',
    source: SRC.links,
    run: (ctx) => {
      const by = new Map<string, number>();
      for (const l of ctx.internalLinks) if (l.rel.map((r) => r.toLowerCase()).includes('nofollow')) by.set(l.from, (by.get(l.from) ?? 0) + 1);
      return hitItems([...by.entries()].map(([url, n]) => ({ url, detail: `${n} lien(s)` })));
    },
  },
  {
    id: 'seo.link.empty_anchor', section: 'maillage', category: 'liens', severity: 'low', impact: 1, effort: 1, scope: 'page',
    label: 'Liens internes sans texte',
    title: (n) => `${pl(n, 'page contient', 'pages contiennent')} des liens sans texte (ni texte alternatif)`,
    why: 'Le texte du lien explique à Google et aux lecteurs d’écran ce qu’on trouve derrière.',
    fix: 'Donnez un texte à chaque lien (ou un texte alternatif à l’image cliquable, ou un aria-label).',
    source: SRC.links,
    run: (ctx) => {
      const home = norm(`${ctx.origin}/`);
      const by = new Map<string, number>();
      for (const l of ctx.internalLinks) if (!l.anchor.trim() && norm(l.to) !== home) by.set(l.from, (by.get(l.from) ?? 0) + 1);
      return hitItems([...by.entries()].map(([url, n]) => ({ url, detail: `${n} lien(s)` })));
    },
  },
  {
    id: 'seo.link.generic_anchor', section: 'maillage', category: 'liens', severity: 'low', impact: 1, effort: 1, scope: 'page',
    label: 'Ancres non descriptives (« cliquez ici »)',
    title: (n) => `${pl(n, 'page utilise', 'pages utilisent')} des liens « cliquez ici » / « en savoir plus »`,
    why: 'Ces textes ne disent rien de la page visée ; un texte descriptif aide Google à la comprendre.',
    fix: 'Remplacez par le sujet de la page liée (ex. « nos tarifs de ramonage »).',
    source: SRC.links,
    run: (ctx) => {
      const by = new Map<string, string[]>();
      for (const l of ctx.internalLinks) if (GENERIC_ANCHOR.test(l.anchor.trim())) by.set(l.from, [...(by.get(l.from) ?? []), l.anchor.trim()]);
      return hitItems([...by.entries()].map(([url, a]) => ({ url, detail: `${a.length} lien(s) : « ${a[0]} »` })));
    },
  },
  {
    id: 'seo.link.too_many', section: 'maillage', category: 'liens', severity: 'low', impact: 1, effort: 2, scope: 'page',
    label: 'Trop de liens internes sur une page',
    title: (n) => `${pl(n, 'page contient', 'pages contiennent')} plus de 250 liens internes`,
    why: 'Au-delà, chaque lien pèse peu et la page devient difficile à parcourir.',
    fix: 'Allégez les méga-menus et pieds de page ; gardez les liens vraiment utiles.',
    source: SRC.links,
    run: (ctx) => hitPages(ctx.html.filter((p) => p.internalLinks > 250), (p) => `${p.internalLinks} liens`),
  },
  {
    id: 'seo.link.many_external', section: 'maillage', category: 'liens', severity: 'low', impact: 1, effort: 1, scope: 'page',
    label: 'Beaucoup de liens externes',
    title: (n) => `${pl(n, 'page contient', 'pages contiennent')} plus de 100 liens vers d’autres sites`,
    why: 'Un très grand nombre de liens sortants peut ressembler à une page de liens sans valeur propre.',
    fix: 'Gardez les liens externes utiles au lecteur ; marquez les liens sponsorisés en rel="sponsored".',
    source: SRC.spam,
    run: (ctx) => hitPages(ctx.html.filter((p) => p.externalLinks > 100), (p) => `${p.externalLinks} liens`),
  },
  {
    id: 'seo.link.javascript', section: 'maillage', category: 'liens', severity: 'medium', impact: 2, effort: 2, scope: 'page',
    label: 'Liens en JavaScript (non explorables)',
    title: (n) => `${pl(n, 'page utilise', 'pages utilisent')} des liens en JavaScript que Google ne suit pas`,
    why: 'Google ne suit que les liens <a href="…"> ; les liens « javascript: » ou sur des boutons sont invisibles pour lui.',
    fix: 'Utilisez de vrais liens <a href="/page"> pour la navigation.',
    source: SRC.links,
    run: (ctx) => hitPages(ctx.html.filter((p) => !!p.html && /<a\b[^>]*href\s*=\s*["']\s*javascript:(?!\s*void\(0\)\s*;?\s*["'])/i.test(p.html))),
  },
  {
    id: 'seo.link.to_noindex', section: 'maillage', category: 'liens', severity: 'low', impact: 1, effort: 1, scope: 'page',
    label: 'Liens internes vers des pages noindex',
    title: (n) => `${pl(n, 'page exclue de Google (noindex) reçoit', 'pages exclues de Google (noindex) reçoivent')} beaucoup de liens internes`,
    why: 'Vous dirigez visiteurs et robots vers des pages que vous excluez vous-même : vérifiez la cohérence.',
    fix: 'Rendez ces pages indexables si elles sont importantes, ou réduisez les liens vers elles.',
    source: SRC.blockIndexing,
    run: (ctx) => hitPages(ctx.html.filter((p) => isNoindex(p) && inlinkCount(ctx, p) >= 3 && !/panier|cart|compte|account|login|connexion|mentions|cgv|cgu|confidentialit|privacy|cookie/i.test(p.finalUrl)), (p) => `${inlinkCount(ctx, p)} liens reçus`),
  },
];

export const LIENS: CheckDef[] = [
  {
    id: 'seo.broken.internal', section: 'liens', category: 'liens', severity: 'high', impact: 3, effort: 1, scope: 'page',
    label: 'Liens internes cassés (404)',
    title: (n) => `${pl(n, 'page liée depuis votre site n’existe', 'pages liées depuis votre site n’existent')} pas (erreur 404)`,
    why: 'Les liens cassés frustrent les visiteurs et gaspillent l’exploration de Google.',
    fix: 'Corrigez les liens, ou redirigez en 301 l’adresse disparue vers la page la plus proche (nous la proposons).',
    source: SRC.httpErrors,
    run: (ctx) => {
      const m = brokenTargets(ctx, false);
      const items = [...m.entries()].map(([t, from]) => ({ url: t.url, detail: `HTTP ${t.status}, lié depuis ${from.length} page(s) dont ${from[0]}` }));
      return hitItems(items, { base: Math.max(1, ctx.pages.length), autoFix: { kind: 'redirect', payload: { items: [...m.keys()].map((t) => ({ from: t.url, to: nearestParent(ctx, t.url), status: 301, review: true })) } } });
    },
  },
  {
    id: 'seo.broken.redirect_to_error', section: 'liens', category: 'liens', severity: 'high', impact: 2, effort: 1, scope: 'page',
    label: 'Redirections vers une page en erreur',
    title: (n) => `${pl(n, 'lien interne redirige', 'liens internes redirigent')} vers une page en erreur`,
    why: 'La redirection mène à une impasse : le visiteur et Google tombent sur une erreur.',
    fix: 'Corrigez la redirection vers une page existante, ou le lien d’origine.',
    source: SRC.redirects,
    run: (ctx) => {
      const m = brokenTargets(ctx, true);
      return hitItems([...m.entries()].map(([t, from]) => ({ url: t.url, detail: `→ ${t.finalUrl} (HTTP ${t.status}), lié depuis ${from.length} page(s)` })), { base: Math.max(1, ctx.pages.length) });
    },
  },
  {
    id: 'seo.broken.dev_links', section: 'liens', category: 'liens', severity: 'medium', impact: 2, effort: 1, scope: 'page',
    label: 'Liens vers un site de test ou localhost',
    title: (n) => `${pl(n, 'page contient', 'pages contiennent')} des liens vers un site de test ou « localhost »`,
    why: 'Ces liens ne fonctionnent pas pour vos visiteurs et révèlent votre environnement de développement.',
    fix: 'Remplacez ces adresses par celles du site en ligne.',
    source: SRC.links,
    run: (ctx) => {
      const re = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|[^/]*\.(local|test|localhost)(:\d+)?\/|(staging|preprod|recette|dev|test)[.-][^/]+)/i;
      const by = new Map<string, string[]>();
      for (const l of ctx.crawl.links) if (re.test(l.to) && !sameSite(l.to, ctx.origin)) by.set(l.from, [...(by.get(l.from) ?? []), l.to]);
      return hitItems([...by.entries()].map(([url, t]) => ({ url, detail: t[0] })));
    },
  },
  {
    id: 'seo.broken.malformed_href', section: 'liens', category: 'liens', severity: 'low', impact: 1, effort: 1, scope: 'page',
    label: 'Liens mal formés',
    title: (n) => `${pl(n, 'page contient', 'pages contiennent')} des liens mal écrits (« http//… », « www.… » sans https)`,
    why: 'Ces liens mènent à une page d’erreur sur votre propre site.',
    fix: 'Corrigez l’adresse (https://www.…).',
    source: SRC.links,
    run: (ctx) => hitPages(ctx.html.filter((p) => !!p.html && /<a\b[^>]*href\s*=\s*["']\s*(https?\/\/|https?:\/(?!\/)|www\.|htps?:)/i.test(p.html))),
  },
  {
    id: 'seo.broken.internal_5xx_linked', section: 'liens', category: 'liens', severity: 'medium', impact: 2, effort: 2, scope: 'page',
    label: 'Liens vers des pages en erreur serveur',
    title: (n) => `${pl(n, 'page liée renvoie', 'pages liées renvoient')} une erreur serveur (5xx)`,
    why: 'Vos visiteurs cliquent vers une page en panne.',
    fix: 'Réparez ces pages (voir les erreurs serveur) ou retirez temporairement les liens.',
    source: SRC.httpErrors,
    run: (ctx) => {
      const set = new Set<CrawledPage>();
      for (const l of ctx.internalLinks) {
        const t = pageAt(ctx, l.to);
        if (t && t.status >= 500) set.add(t);
      }
      return hitPages([...set], (p) => `HTTP ${p.status}, ${inlinkCount(ctx, p)} lien(s) reçu(s)`, { base: Math.max(1, ctx.pages.length) });
    },
  },
  {
    id: 'seo.broken.external', section: 'liens', category: 'liens', severity: 'medium', impact: 1, effort: 1, scope: 'page',
    label: 'Liens externes cassés',
    title: (n) => `${pl(n, 'lien vers un autre site est cassé', 'liens vers d’autres sites sont cassés')}`,
    why: 'Envoyer vos visiteurs vers une page morte nuit à la confiance et à la qualité perçue de la page.',
    fix: 'Remplacez ces liens par une source à jour ou retirez-les.',
    source: SRC.links,
    run: (ctx) => {
      const items: { url: string; detail?: string }[] = [];
      const checked = [...ctx.linkChecks.values()].filter((c) => c.kind === 'link');
      for (const c of checked) {
        if (c.blockedByRobots || (c.status > 0 && c.status < 400) || c.status === 401 || c.status === 403 || c.status === 429 || c.status === 999) continue;
        const from = ctx.crawl.links.find((l) => !l.internal && norm(l.to) === norm(c.url))?.from;
        items.push({ url: c.url, detail: `${c.status ? `HTTP ${c.status}` : c.error ?? 'injoignable'}${from ? `, lié depuis ${from}` : ''}` });
      }
      return hitItems(items, { base: Math.max(1, checked.length) });
    },
  },
];
