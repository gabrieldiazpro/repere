/** Section « E-commerce » : facettes, tri, pagination, variantes, fiches produit, ruptures, recherche interne, panier. */
import { isAllowed, parseRobots } from '@/lib/siteaudit/robots';
import { proposeRobots } from '../autofix';
import { SRC } from '../sources';
import type { AuditCtx, CheckDef, CrawledPage } from '../types';
import { CART_PATH, FACET_PARAMS, isNoindex, norm, PAGE_PARAMS, pl, SEARCH_PATH, typesOf, VARIANT_PARAMS } from '../util';
import { siteHasPage } from './contenu';
import { sdOf } from './donnees';
import { hitPages, hitSite } from './helpers';

const sec = 'ecommerce' as const;
const cat = 'ecommerce';
const E: ['ecommerce'] = ['ecommerce'];

function params(url: string): string[] {
  try {
    return [...new URL(url).searchParams.keys()];
  } catch {
    return [];
  }
}
const isFacet = (url: string) => params(url).some((k) => FACET_PARAMS.test(k) && !/^q$/i.test(k));
const pageNum = (url: string): number | null => {
  try {
    const u = new URL(url);
    for (const [k, v] of u.searchParams) if (PAGE_PARAMS.test(k) && /^\d+$/.test(v)) return Number(v);
    const m = /\/page\/(\d+)\/?$/i.exec(u.pathname);
    return m ? Number(m[1]) : null;
  } catch {
    return null;
  }
};
function stripParams(url: string, re: RegExp): string {
  const u = new URL(url);
  for (const k of [...u.searchParams.keys()]) if (re.test(k)) u.searchParams.delete(k);
  return u.toString();
}

function offersOf(ctx: AuditCtx, p: CrawledPage): Record<string, unknown>[] {
  return ctx.nodes(p).filter((n) => typesOf(n).some((t) => t === 'Offer' || t === 'AggregateOffer'));
}

const isCategory = (p: CrawledPage) => /\/(categorie|category|categories|collections?|c|rayon|univers|product-category|boutique|shop)\/[^/?]+/i.test(new URL(p.finalUrl).pathname) && !/\/products?\//i.test(p.finalUrl);

export const ECOMMERCE: CheckDef[] = [
  {
    id: 'seo.ecom.facets_indexable', section: sec, category: cat, severity: 'high', impact: 3, effort: 2, scope: 'page', types: E,
    label: 'Pages de filtres (facettes) indexables',
    title: (n) => `${pl(n, 'page de filtre (couleur, taille, prix, tri…) est indexable', 'pages de filtres (couleur, taille, prix, tri…) sont indexables')}`,
    why: 'Chaque combinaison de filtres crée une page quasi identique : Google s’y perd et explore moins vos vraies fiches produits.',
    fix: 'Mettez une canonical vers la catégorie sans filtre (ou noindex), et bloquez l’exploration des paramètres de filtre dans robots.txt.',
    source: SRC.faceted,
    run: (ctx) => {
      const ps = ctx.indexable.filter((p) => isFacet(p.finalUrl));
      return hitPages(ps, (p) => params(p.finalUrl).join(', '), { autoFix: { kind: 'canonical', payload: { items: ps.map((p) => ({ url: p.finalUrl, href: stripParams(p.finalUrl, FACET_PARAMS) })) } } });
    },
  },
  {
    id: 'seo.ecom.facets_crawlable', section: sec, category: cat, severity: 'medium', impact: 2, effort: 1, scope: 'site', types: E,
    label: 'Filtres explorables sans limite',
    title: () => 'Les robots peuvent explorer vos combinaisons de filtres sans limite',
    why: 'Les filtres génèrent des milliers d’adresses : le temps d’exploration de Google part dans ces doublons.',
    fix: 'Ajoutez dans robots.txt des règles « Disallow » pour les paramètres de filtre et de tri (nous les proposons).',
    source: SRC.faceted,
    run: (ctx) => {
      const facetUrls = [...new Set([...ctx.pages.map((p) => p.url), ...ctx.internalLinks.map((l) => l.to)].filter(isFacet))];
      if (facetUrls.length < 5) return null;
      const parsed = ctx.crawl.robots?.status === 200 && ctx.crawl.robots.text ? parseRobots(ctx.crawl.robots.text) : null;
      const open = facetUrls.filter((u) => {
        if (!parsed) return true;
        const x = new URL(u);
        return isAllowed(parsed, 'Googlebot', x.pathname + x.search);
      });
      if (open.length < 5) return null;
      const keys = [...new Set(open.flatMap(params).filter((k) => FACET_PARAMS.test(k) && !/^q$/i.test(k)))].slice(0, 8);
      return hitSite(ctx, `${open.length} adresses de filtres explorables (paramètres : ${keys.join(', ')})`, { autoFix: { kind: 'robots', payload: proposeRobots(ctx, { disallowFacets: keys }) } });
    },
  },
  {
    id: 'seo.ecom.pagination_canonical', section: sec, category: cat, severity: 'medium', impact: 2, effort: 1, scope: 'page', types: E,
    label: 'Pagination canonicalisée vers la page 1',
    title: (n) => `${pl(n, 'page de pagination (page 2, 3…) renvoie', 'pages de pagination (page 2, 3…) renvoient')} sa canonical vers la page 1`,
    why: 'Google recommande que chaque page de liste soit sa propre référence ; sinon les produits des pages suivantes sont moins bien découverts.',
    fix: 'Donnez à chaque page paginée une canonical vers elle-même et des liens <a href> entre pages.',
    source: SRC.pagination,
    run: (ctx) => {
      const ps = ctx.html.filter((p) => (pageNum(p.finalUrl) ?? 1) > 1 && !!p.canonical && norm(p.canonical, p.finalUrl) !== norm(p.finalUrl) && pageNum(norm(p.canonical, p.finalUrl) ?? '') === null);
      return hitPages(ps, (p) => `→ ${p.canonical}`, { autoFix: { kind: 'canonical', payload: { items: ps.map((p) => ({ url: p.finalUrl, href: p.finalUrl })) } } });
    },
  },
  {
    id: 'seo.ecom.pagination_noindex', section: sec, category: cat, severity: 'low', impact: 1, effort: 1, scope: 'page', types: E,
    label: 'Pagination en noindex',
    title: (n) => `${pl(n, 'page de pagination est', 'pages de pagination sont')} en noindex`,
    why: 'À la longue, Google cesse de suivre les liens des pages en noindex : les produits qui n’y figurent que là deviennent difficiles à trouver.',
    fix: 'Laissez les pages paginées indexables (titre précisant « page 2 ») ou liez les produits autrement.',
    source: SRC.pagination,
    run: (ctx) => hitPages(ctx.html.filter((p) => (pageNum(p.finalUrl) ?? 1) > 1 && isNoindex(p))),
  },
  {
    id: 'seo.ecom.variants_indexable', section: sec, category: cat, severity: 'medium', impact: 2, effort: 1, scope: 'page', types: E,
    label: 'Variantes de produit indexées séparément',
    title: (n) => `${pl(n, 'variante de produit (?variant=…) est indexable', 'variantes de produit (?variant=…) sont indexables')} séparément`,
    why: 'Les variantes (taille, couleur) sur des adresses à paramètre dupliquent la fiche produit.',
    fix: 'Canonical des variantes vers la fiche principale, ou balisage ProductGroup avec hasVariant si chaque variante mérite sa page.',
    source: SRC.ecomVariants,
    run: (ctx) => {
      const ps = ctx.indexable.filter((p) => params(p.finalUrl).some((k) => VARIANT_PARAMS.test(k)) && !sdOf(p).types.includes('ProductGroup'));
      return hitPages(ps, undefined, { autoFix: { kind: 'canonical', payload: { items: ps.map((p) => ({ url: p.finalUrl, href: stripParams(p.finalUrl, VARIANT_PARAMS) })) } } });
    },
  },
  {
    id: 'seo.ecom.product_schema_missing', section: sec, category: 'balisage', severity: 'high', impact: 3, effort: 1, scope: 'page', types: E,
    label: 'Fiches produit sans balisage Product',
    title: (n) => `${pl(n, 'fiche produit n’a', 'fiches produit n’ont')} pas de données structurées Product`,
    why: 'Sans balisage Product, pas de prix, de stock ni d’étoiles dans Google, ni dans l’onglet Shopping gratuit.',
    fix: 'Activez le balisage produit de votre plateforme (Shopify, WooCommerce, PrestaShop le proposent) : nom, image, prix, devise, disponibilité.',
    source: SRC.sdMerchant,
    run: (ctx) => hitPages(ctx.indexable.filter((p) => ctx.isProduct(p) && !sdOf(p).types.some((t) => t === 'Product' || t === 'ProductGroup'))),
  },
  {
    id: 'seo.ecom.product_thin', section: sec, category: 'contenu', severity: 'medium', impact: 2, effort: 2, scope: 'page', types: E,
    label: 'Fiches produit pauvres (< 150 mots)',
    title: (n) => `${pl(n, 'fiche produit contient', 'fiches produit contiennent')} moins de 150 mots`,
    why: 'Une fiche avec deux lignes ne répond pas aux questions (matière, taille, usage, entretien) et ressemble à toutes les autres.',
    fix: 'Rédigez une description propre : bénéfices, caractéristiques, conseils, questions fréquentes.',
    source: SRC.helpful,
    run: (ctx) => hitPages(ctx.indexable.filter((p) => ctx.isProduct(p) && p.wordCount < 150), (p) => `${p.wordCount} mots`),
  },
  {
    id: 'seo.ecom.product_dup_description', section: sec, category: 'contenu', severity: 'medium', impact: 2, effort: 2, scope: 'page', types: E,
    label: 'Descriptions produit recopiées',
    title: (n) => `${pl(n, 'fiche produit partage', 'fiches produit partagent')} la même description qu’une autre`,
    why: 'Des fiches identiques (souvent le texte du fabricant) se concurrencent et n’apportent rien de plus que les autres vendeurs.',
    fix: 'Personnalisez au moins le premier paragraphe et la meta description de chaque fiche.',
    source: SRC.helpful,
    run: (ctx) => {
      const m = new Map<string, CrawledPage[]>();
      for (const p of ctx.indexable.filter((x) => ctx.isProduct(x))) {
        const n = ctx.nodes(p).find((x) => typesOf(x).includes('Product'));
        const d = (typeof n?.description === 'string' ? n.description : p.metaDescription ?? '').trim().toLowerCase();
        if (d.length >= 40) m.set(d, [...(m.get(d) ?? []), p]);
      }
      const dups = [...m.values()].filter((g) => g.length > 1).flat();
      return hitPages(dups);
    },
  },
  {
    id: 'seo.ecom.product_no_image', section: sec, category: cat, severity: 'high', impact: 2, effort: 1, scope: 'page', types: E,
    label: 'Fiches produit sans image',
    title: (n) => `${pl(n, 'fiche produit n’a', 'fiches produit n’ont')} aucune image`,
    why: 'Sans image, pas de fiche marchand dans Google ni d’affichage dans Google Images ou Shopping.',
    fix: 'Ajoutez au moins une photo nette du produit (et son texte alternatif).',
    source: SRC.sdMerchant,
    run: (ctx) => hitPages(ctx.indexable.filter((p) => ctx.isProduct(p) && p.images.length === 0 && !ctx.nodes(p).some((n) => typesOf(n).includes('Product') && n.image))),
  },
  {
    id: 'seo.ecom.price_not_visible', section: sec, category: cat, severity: 'medium', impact: 2, effort: 1, scope: 'page', types: E,
    label: 'Fiches produit sans prix lisible',
    title: (n) => `${pl(n, 'fiche produit n’affiche', 'fiches produit n’affichent')} aucun prix lisible dans le HTML`,
    why: 'Si le prix n’apparaît qu’après exécution de scripts, robots et IA ne le voient pas.',
    fix: 'Affichez le prix dans le HTML initial et dans le balisage Offer.',
    source: SRC.sdMerchant,
    run: (ctx) => hitPages(ctx.indexable.filter((p) => ctx.isProduct(p) && !/\d+(?:[.,]\d{2})?\s?(€|eur\b)|€\s?\d/i.test(ctx.text(p)) && !offersOf(ctx, p).length)),
  },
  {
    id: 'seo.ecom.out_of_stock', section: sec, category: cat, severity: 'info', impact: 1, effort: 1, scope: 'page', types: E,
    label: 'Produits en rupture (information)',
    title: (n) => `${pl(n, 'produit est indiqué', 'produits sont indiqués')} en rupture de stock`,
    why: 'Gardez ces pages en ligne (statut 200) avec des alternatives si le produit revient ; 404/410 ou redirection s’il est définitivement arrêté.',
    fix: 'Ajoutez un bloc « produits similaires » et l’option « prévenez-moi » ; retirez-les du sitemap s’ils sont arrêtés.',
    source: SRC.ecomUrl,
    run: (ctx) => hitPages(ctx.html.filter((p) => offersOf(ctx, p).some((o) => /OutOfStock|SoldOut|Discontinued/i.test(String(o.availability ?? ''))))),
  },
  {
    id: 'seo.ecom.out_of_stock_noindex', section: sec, category: cat, severity: 'low', impact: 1, effort: 1, scope: 'page', types: E,
    label: 'Produits en rupture passés en noindex',
    title: (n) => `${pl(n, 'produit en rupture est', 'produits en rupture sont')} retirés de Google (noindex)`,
    why: 'Une rupture temporaire ne justifie pas de perdre le positionnement acquis par la fiche.',
    fix: 'Laissez la fiche indexable pendant une rupture temporaire, avec la mention « en rupture » et des alternatives.',
    source: SRC.ecomUrl,
    run: (ctx) => hitPages(ctx.html.filter((p) => isNoindex(p) && offersOf(ctx, p).some((o) => /OutOfStock|BackOrder/i.test(String(o.availability ?? ''))))),
  },
  {
    id: 'seo.ecom.no_return_shipping', section: sec, category: cat, severity: 'low', impact: 1, effort: 1, scope: 'site', types: E,
    label: 'Livraison et retours non balisés',
    title: () => 'Vos conditions de livraison et de retour ne sont pas balisées',
    why: 'Google peut afficher frais de port et délai de retour dans les résultats ; c’est un argument de clic.',
    fix: 'Déclarez shippingDetails et hasMerchantReturnPolicy (dans les offres ou une fois dans Organization), ou dans Merchant Center.',
    source: SRC.sdReturn,
    run: (ctx) => {
      const products = ctx.html.filter((p) => sdOf(p).types.includes('Product'));
      if (!products.length) return null;
      const json = ctx.html.map((p) => JSON.stringify(p.jsonLd)).join(' ');
      return /hasMerchantReturnPolicy|shippingDetails/.test(json) ? null : hitSite(ctx);
    },
  },
  {
    id: 'seo.ecom.category_thin', section: sec, category: 'contenu', severity: 'low', impact: 2, effort: 2, scope: 'page', types: E,
    label: 'Catégories sans texte d’introduction',
    title: (n) => `${pl(n, 'page catégorie n’a', 'pages catégories n’ont')} presque pas de texte propre`,
    why: 'Les catégories sont vos pages les mieux placées sur les recherches génériques (« chaussures de randonnée femme ») ; quelques phrases utiles font la différence.',
    fix: 'Ajoutez 80 à 150 mots utiles en haut ou en bas de la catégorie (conseils de choix, guide des tailles).',
    source: SRC.ecomUrl,
    run: (ctx) => hitPages(ctx.indexable.filter((p) => isCategory(p) && !isFacet(p.finalUrl) && p.wordCount < 150), (p) => `${p.wordCount} mots`),
  },
  {
    id: 'seo.ecom.search_indexable', section: sec, category: cat, severity: 'medium', impact: 2, effort: 1, scope: 'page', types: E,
    label: 'Résultats de recherche interne indexables',
    title: (n) => `${pl(n, 'page de résultats de recherche interne est indexable', 'pages de résultats de recherche interne sont indexables')}`,
    why: 'Google déconseille d’indexer vos pages de recherche : contenu faible et infinité d’adresses.',
    fix: 'Ajoutez noindex aux pages de résultats de recherche et bloquez-les dans robots.txt.',
    source: SRC.spam,
    run: (ctx) => {
      const ps = ctx.indexable.filter((p) => SEARCH_PATH.test(p.finalUrl));
      return hitPages(ps, undefined, { autoFix: { kind: 'meta.robots', payload: { items: ps.map((p) => ({ url: p.finalUrl, value: 'noindex, follow' })) } } });
    },
  },
  {
    id: 'seo.ecom.cart_indexable', section: sec, category: cat, severity: 'medium', impact: 1, effort: 1, scope: 'page', types: E,
    label: 'Panier, compte ou commande indexables',
    title: (n) => `${pl(n, 'page de panier, compte ou commande est indexable', 'pages de panier, compte ou commande sont indexables')}`,
    why: 'Ces pages n’ont rien à faire dans Google et consomment de l’exploration.',
    fix: 'Ajoutez noindex à ces pages (la plupart des plateformes ont l’option).',
    source: SRC.blockIndexing,
    run: (ctx) => {
      const ps = ctx.indexable.filter((p) => CART_PATH.test(new URL(p.finalUrl).pathname));
      return hitPages(ps, undefined, { autoFix: { kind: 'meta.robots', payload: { items: ps.map((p) => ({ url: p.finalUrl, value: 'noindex, follow' })) } } });
    },
  },
  {
    id: 'seo.ecom.cgv_missing', section: sec, category: 'contenu', severity: 'medium', impact: 2, effort: 1, scope: 'site', types: E,
    label: 'CGV introuvables',
    title: () => 'Aucune page de conditions générales de vente (CGV) trouvée',
    why: 'Les CGV sont obligatoires pour la vente en ligne aux particuliers en France, et rassurent avant l’achat.',
    fix: 'Publiez vos CGV (livraison, rétractation de 14 jours, garanties) et liez-les en pied de page.',
    source: SRC.cgv,
    run: (ctx) => (siteHasPage(ctx, /cgv|conditions-generales-de-vente|conditions-de-vente|terms-of-sale/i, /cgv|conditions g[ée]n[ée]rales de vente|conditions de vente/i) ? null : hitSite(ctx)),
  },
  {
    id: 'seo.ecom.product_no_breadcrumb', section: sec, category: 'balisage', severity: 'low', impact: 1, effort: 1, scope: 'page', types: E,
    label: 'Fiches produit sans fil d’Ariane balisé',
    title: (n) => `${pl(n, 'fiche produit n’a', 'fiches produit n’ont')} pas de fil d’Ariane balisé`,
    why: 'Le fil d’Ariane rattache la fiche à sa catégorie, pour Google comme pour le visiteur.',
    fix: 'Activez le fil d’Ariane balisé (BreadcrumbList) sur les fiches produit.',
    source: SRC.sdBreadcrumb,
    run: (ctx) => hitPages(ctx.indexable.filter((p) => ctx.isProduct(p) && !sdOf(p).types.includes('BreadcrumbList'))),
  },
  {
    id: 'seo.ecom.sort_links', section: sec, category: cat, severity: 'low', impact: 1, effort: 1, scope: 'site', types: E,
    label: 'Liens de tri en clair',
    title: () => 'Vos listes produits proposent des liens de tri explorables (?sort=, ?orderby=)',
    why: 'Chaque ordre de tri duplique la catégorie entière.',
    fix: 'Passez le tri en formulaire/bouton ou ajoutez rel="nofollow" et une canonical vers la catégorie.',
    source: SRC.faceted,
    run: (ctx) => {
      const n = new Set(ctx.internalLinks.filter((l) => params(l.to).some((k) => /^(sort|sort_by|orderby|order|tri|dir|product_list_order)$/i.test(k)) && !l.rel.includes('nofollow')).map((l) => l.to)).size;
      return n >= 3 ? hitSite(ctx, `${n} adresses de tri liées`) : null;
    },
  },
];
