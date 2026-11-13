/** Section « Données structurées » : validation contre les exigences Google, types manquants, avis auto-attribués. */
import { proposeBreadcrumb, proposeEntityJsonLd } from '../autofix';
import { LOCAL_SUBTYPES, validateNodes, type SdIssue } from '../schema';
import { SRC } from '../sources';
import type { AuditCtx, CheckDef, CrawledPage } from '../types';
import { pl, typesOf } from '../util';
import { hitItems, hitPages, hitSite, pathDepth } from './helpers';

const sec = 'donnees' as const;
const cat = 'balisage';

const cache = new WeakMap<CrawledPage, { types: string[]; issues: SdIssue[] }>();
export function sdOf(p: CrawledPage): { types: string[]; issues: SdIssue[] } {
  let v = cache.get(p);
  if (!v) {
    v = validateNodes(p.jsonLd);
    cache.set(p, v);
  }
  return v;
}

export function siteTypes(ctx: AuditCtx): Set<string> {
  const s = new Set<string>();
  for (const p of ctx.html) for (const t of sdOf(p).types) s.add(t);
  return s;
}

function issuesHit(ctx: AuditCtx, level: SdIssue['level'] | SdIssue['level'][], filter: (i: SdIssue) => boolean = () => true) {
  const levels = Array.isArray(level) ? level : [level];
  const items: { url: string; detail?: string }[] = [];
  for (const p of ctx.html) {
    const iss = sdOf(p).issues.filter((i) => levels.includes(i.level) && filter(i));
    if (iss.length) items.push({ url: p.finalUrl, detail: [...new Set(iss.map((i) => i.message))].slice(0, 4).join(' ; ') });
  }
  return items;
}

export const isLocalType = (t: string) => LOCAL_SUBTYPES.has(t);
const ENTITY = (t: string) => t === 'Organization' || t === 'OnlineStore' || t === 'OnlineBusiness' || t === 'Corporation' || t === 'NGO' || isLocalType(t);

export const DONNEES: CheckDef[] = [
  {
    id: 'seo.sd.parse_errors', section: sec, category: cat, severity: 'high', impact: 2, effort: 1, scope: 'page',
    label: 'JSON-LD illisible (erreur de syntaxe)',
    title: (n) => `${pl(n, 'page contient', 'pages contiennent')} des données structurées illisibles (erreur de syntaxe)`,
    why: 'Un bloc JSON-LD mal formé est entièrement ignoré par Google et les IA.',
    fix: 'Corrigez la syntaxe (virgule en trop, guillemets) et testez avec le test des résultats enrichis de Google.',
    source: SRC.sdIntro,
    run: (ctx) => hitPages(ctx.html.filter((p) => p.jsonLdErrors.length > 0), (p) => p.jsonLdErrors[0]),
  },
  {
    id: 'seo.sd.none', section: sec, category: cat, severity: 'low', impact: 2, effort: 1, scope: 'site',
    label: 'Aucune donnée structurée',
    title: () => 'Votre site ne contient aucune donnée structurée (schema.org)',
    why: 'Les données structurées décrivent sans ambiguïté qui vous êtes et ce que vous proposez, à Google comme aux IA.',
    fix: 'Ajoutez au moins le bloc décrivant votre entreprise (nous le générons à partir de votre site).',
    source: SRC.sdIntro,
    run: (ctx) => (ctx.html.some((p) => p.jsonLd.length > 0) ? null : hitSite(ctx)),
  },
  {
    id: 'seo.sd.entity_missing', section: sec, category: cat, severity: 'medium', impact: 2, effort: 1, scope: 'site', types: ['pme', 'ecommerce'],
    label: 'Organisation non décrite (Organization)',
    title: () => 'Votre entreprise n’est pas décrite en données structurées (Organization)',
    why: 'Le balisage Organization aide Google à afficher votre logo, vos coordonnées et à relier vos profils sociaux.',
    fix: 'Ajoutez un bloc Organization sur la page d’accueil (nom, logo, adresse, téléphone, réseaux).',
    source: SRC.sdOrg,
    run: (ctx) => {
      if ([...siteTypes(ctx)].some(ENTITY)) return null;
      const jsonld = proposeEntityJsonLd(ctx, ctx.siteType === 'ecommerce' ? 'Organization' : 'Organization');
      return hitSite(ctx, undefined, { autoFix: { kind: 'jsonld', payload: { items: [{ url: ctx.home?.finalUrl ?? `${ctx.origin}/`, type: 'Organization', jsonld }] } } });
    },
  },
  {
    id: 'seo.sd.localbusiness_missing', section: sec, category: cat, severity: 'high', impact: 3, effort: 1, scope: 'site', types: ['local'],
    label: 'Établissement non décrit (LocalBusiness)',
    title: () => 'Votre établissement n’est pas décrit en données structurées (LocalBusiness)',
    why: 'C’est la carte d’identité machine de votre commerce : nom, adresse, téléphone, horaires — lue par Google et par les IA.',
    fix: 'Ajoutez un bloc LocalBusiness (ou un sous-type précis : Bakery, Plumber…) sur l’accueil et la page contact.',
    source: SRC.sdLocal,
    run: (ctx) => {
      if ([...siteTypes(ctx)].some(isLocalType)) return null;
      return hitSite(ctx, undefined, { autoFix: { kind: 'jsonld', payload: { items: [{ url: ctx.home?.finalUrl ?? `${ctx.origin}/`, type: 'LocalBusiness', jsonld: proposeEntityJsonLd(ctx, 'LocalBusiness') }] } } });
    },
  },
  {
    id: 'seo.sd.required_missing', section: sec, category: cat, severity: 'high', impact: 2, effort: 1, scope: 'page',
    label: 'Propriétés obligatoires Google manquantes',
    title: (n) => `${pl(n, 'page a', 'pages ont')} des données structurées incomplètes (propriétés obligatoires manquantes)`,
    why: 'Sans les propriétés obligatoires, la page n’est pas éligible aux résultats enrichis (prix, étoiles, fil d’Ariane…).',
    fix: 'Complétez les propriétés indiquées, en reprenant les informations visibles sur la page.',
    source: SRC.sdGallery,
    run: (ctx) => hitItems(issuesHit(ctx, 'required', (i) => i.type !== 'FAQPage')),
  },
  {
    id: 'seo.sd.invalid_values', section: sec, category: cat, severity: 'medium', impact: 2, effort: 1, scope: 'page',
    label: 'Valeurs invalides (dates, prix, devise, disponibilité, note)',
    title: (n) => `${pl(n, 'page contient', 'pages contiennent')} des valeurs mal formatées dans les données structurées`,
    why: 'Prix avec « € », date en « 12/03/2025 » ou disponibilité en texte libre : Google rejette la donnée.',
    fix: 'Utilisez les formats attendus : prix « 19.90 », devise « EUR », dates AAAA-MM-JJ, disponibilité https://schema.org/InStock.',
    source: SRC.sdPolicies,
    run: (ctx) => hitItems(issuesHit(ctx, 'invalid')),
  },
  {
    id: 'seo.sd.context', section: sec, category: cat, severity: 'high', impact: 2, effort: 1, scope: 'page',
    label: '@context schema.org absent',
    title: (n) => `${pl(n, 'page a', 'pages ont')} des données structurées sans @context schema.org`,
    why: 'Sans @context, le vocabulaire n’est pas reconnu : le bloc est ignoré.',
    fix: 'Ajoutez "@context": "https://schema.org" en tête de chaque bloc JSON-LD.',
    source: SRC.sdIntro,
    run: (ctx) => hitItems(issuesHit(ctx, 'context')),
  },
  {
    id: 'seo.sd.recommended_missing', section: sec, category: cat, severity: 'low', impact: 1, effort: 1, scope: 'page',
    label: 'Propriétés recommandées manquantes',
    title: (n) => `${pl(n, 'page peut', 'pages peuvent')} enrichir leurs données structurées (propriétés recommandées)`,
    why: 'Les propriétés recommandées (horaires, téléphone, marque, GTIN…) rendent l’information plus complète et plus citable.',
    fix: 'Ajoutez les propriétés listées quand l’information existe.',
    source: SRC.sdGallery,
    run: (ctx) => hitItems(issuesHit(ctx, 'recommended')),
  },
  {
    id: 'seo.sd.self_serving_reviews', section: sec, category: cat, severity: 'medium', impact: 1, effort: 1, scope: 'page',
    label: 'Avis auto-attribués',
    title: (n) => `${pl(n, 'page affiche', 'pages affichent')} des avis balisés sur votre propre entreprise`,
    why: 'Google n’affiche pas d’étoiles pour les avis qu’une entreprise publie sur elle-même (LocalBusiness/Organization) ; en abuser peut valoir une action manuelle.',
    fix: 'Retirez aggregateRating/review du bloc entreprise ; gardez-les pour des produits, et laissez les avis vivre sur votre fiche Google.',
    source: SRC.sdReview,
    run: (ctx) => hitItems(issuesHit(ctx, 'self_serving')),
  },
  {
    id: 'seo.sd.deprecated', section: sec, category: cat, severity: 'info', impact: 1, effort: 1, scope: 'page',
    label: 'Types abandonnés par Google',
    title: (n) => `${pl(n, 'page utilise', 'pages utilisent')} des types de données structurées que Google n’exploite plus`,
    why: 'Sans danger, mais n’attendez plus d’affichage enrichi de ces balisages (ils peuvent rester utiles aux IA).',
    fix: 'Rien d’urgent : ne comptez pas sur eux pour Google ; concentrez-vous sur les types pris en charge.',
    source: SRC.sdDeprecations2025,
    run: (ctx) => hitItems(issuesHit(ctx, 'deprecated', (i) => i.type !== 'FAQPage')),
  },
  {
    id: 'seo.sd.faq_no_rich', section: sec, category: cat, severity: 'info', impact: 1, effort: 1, scope: 'site',
    label: 'FAQPage : plus de résultat enrichi Google (mai 2026)',
    title: () => 'Vos FAQ balisées ne s’affichent plus en résultats enrichis Google (fin du format en mai 2026)',
    why: 'Google a retiré l’affichage des FAQ le 7 mai 2026. Le balisage reste inoffensif et aide les IA à extraire vos réponses.',
    fix: 'Gardez le balisage s’il est juste ; ne l’ajoutez plus pour Google seul.',
    source: SRC.faqRemoved2026,
    run: (ctx) => {
      const ps = ctx.html.filter((p) => sdOf(p).types.includes('FAQPage'));
      return ps.length ? { items: ps.map((p) => ({ url: p.finalUrl })) } : null;
    },
  },
  {
    id: 'seo.sd.sitelinks_searchbox', section: sec, category: cat, severity: 'info', impact: 1, effort: 1, scope: 'site',
    label: 'Balisage « champ de recherche » (retiré par Google)',
    title: () => 'Votre balisage « champ de recherche dans Google » (SearchAction) n’est plus utilisé',
    why: 'Google a supprimé ce champ de recherche des résultats en novembre 2024.',
    fix: 'Vous pouvez retirer potentialAction/SearchAction ; ce n’est pas une erreur.',
    source: SRC.sitelinksSearchBox,
    run: (ctx) => {
      const ps = ctx.html.filter((p) => JSON.stringify(p.jsonLd).includes('SearchAction'));
      return ps.length ? { items: ps.slice(0, 1).map((p) => ({ url: p.finalUrl })) } : null;
    },
  },
  {
    id: 'seo.sd.breadcrumb_missing', section: sec, category: cat, severity: 'low', impact: 1, effort: 1, scope: 'page', types: ['pme', 'ecommerce'],
    label: 'Fil d’Ariane non balisé',
    title: (n) => `${pl(n, 'page profonde n’a', 'pages profondes n’ont')} pas de fil d’Ariane balisé (BreadcrumbList)`,
    why: 'Le fil d’Ariane balisé remplace l’adresse brute par un chemin lisible dans Google et clarifie la structure du site.',
    fix: 'Activez le fil d’Ariane balisé de votre thème ou extension SEO (nous le générons page par page).',
    source: SRC.sdBreadcrumb,
    run: (ctx) => {
      const ps = ctx.indexable.filter((p) => pathDepth(p.finalUrl) >= 2 && !sdOf(p).types.includes('BreadcrumbList'));
      return hitPages(ps, undefined, { autoFix: { kind: 'jsonld', payload: { items: ps.slice(0, 200).map((p) => ({ url: p.finalUrl, type: 'BreadcrumbList', jsonld: proposeBreadcrumb(ctx, p) })) } } });
    },
  },
  {
    id: 'seo.sd.article_missing', section: sec, category: cat, severity: 'low', impact: 1, effort: 1, scope: 'page',
    label: 'Articles de blog non balisés (Article)',
    title: (n) => `${pl(n, 'article de blog n’est pas balisé', 'articles de blog ne sont pas balisés')} (Article / BlogPosting)`,
    why: 'Le balisage Article précise auteur et dates : un signal de fraîcheur et d’expertise pour Google et les IA.',
    fix: 'Ajoutez Article/BlogPosting avec headline, author, datePublished, dateModified, image.',
    source: SRC.sdArticle,
    run: (ctx) => hitPages(ctx.indexable.filter((p) => /\/(blog|actualites?|actus?|news|conseils|articles?|magazine|guides?)\/[^/]+/i.test(new URL(p.finalUrl).pathname) && p.wordCount >= 300 && !sdOf(p).types.some((t) => /Article|BlogPosting|NewsArticle/.test(t)))),
  },
  {
    id: 'seo.sd.content_mismatch', section: sec, category: cat, severity: 'medium', impact: 2, effort: 1, scope: 'page',
    label: 'Données structurées absentes du contenu visible',
    title: (n) => `${pl(n, 'page annonce', 'pages annoncent')} en données structurées un prix ou un téléphone absent de la page`,
    why: 'Google exige que les données structurées reflètent le contenu visible ; sinon il les ignore (voire sanctionne).',
    fix: 'Alignez le balisage sur ce qui est affiché (prix, téléphone), ou affichez l’information.',
    source: SRC.sdPolicies,
    run: (ctx) => {
      const items: { url: string; detail?: string }[] = [];
      for (const p of ctx.html) {
        if (!p.html) continue;
        const text = ctx.text(p).replace(/\s+/g, '');
        for (const n of ctx.nodes(p)) {
          const t = typesOf(n);
          if (t.includes('Offer') && (typeof n.price === 'number' || typeof n.price === 'string')) {
            const v = Number(String(n.price));
            if (!Number.isFinite(v) || v <= 0) continue;
            const forms = [v.toFixed(2), v.toFixed(2).replace('.', ','), String(v), String(v).replace('.', ',')];
            if (!forms.some((f) => text.includes(f))) items.push({ url: p.finalUrl, detail: `prix ${String(n.price)} non visible` });
          }
          if (typeof n.telephone === 'string' && (isLocalType(t[0] ?? '') || t.includes('Organization'))) {
            const d = n.telephone.replace(/\D/g, '').replace(/^33/, '0');
            const tail = d.slice(-9);
            if (tail.length === 9 && !text.replace(/\D/g, '').includes(tail)) items.push({ url: p.finalUrl, detail: `téléphone ${n.telephone} non visible` });
          }
        }
      }
      const dedup = new Map(items.map((i) => [i.url + i.detail, i]));
      return hitItems([...dedup.values()]);
    },
  },
];
