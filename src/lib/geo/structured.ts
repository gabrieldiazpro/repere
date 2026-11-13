/**
 * Section « Données structurées utiles aux IA » : Product + Offer (boutique), Article, FAQPage visible, erreurs,
 * et concordance balisage / texte visible (exigée par Google). L'entité (Organization/LocalBusiness) est traitée
 * dans entity.ts. Rien n'est inventé : les blocs proposés reprennent les valeurs de la page.
 */
import { extractProduct, suggestedProductJsonLd } from '@/lib/siteaudit/product';
import { typesOf } from '@/lib/siteaudit/jsonld';
import type { GeoFinding, GeoSection, GeoSiteType } from './types';
import { isArticlePage } from './entity';
import { QUESTION_RE } from './passages';
import { clip, finding, plural, section, str, type GeoPage, type JsonNode } from './util';

const CAT = 'geo.donnees';

const PRODUCT_URL = /\/(produits?|products?|p|boutique\/[^/]+|shop\/[^/]+|article|item)\/[^/]+/i;

export function isProductPage(p: GeoPage): boolean {
  if (p.types.has('Product') || p.types.has('ProductGroup')) return true;
  if ((p.page.openGraph?.['og:type'] ?? '').toLowerCase() === 'product' || p.page.openGraph?.['product:price:amount']) return true;
  return PRODUCT_URL.test(p.path) && /(ajouter au panier|add to cart|en stock|rupture)/i.test(p.parsed?.bodyText ?? '');
}

function faqQuestions(n: JsonNode): string[] {
  const me = n.mainEntity;
  const list = Array.isArray(me) ? me : me ? [me] : [];
  return list.map((q) => str((q as JsonNode)?.name)).filter((x): x is string => !!x);
}

export function auditStructured(pages: GeoPage[], siteType: GeoSiteType): GeoSection {
  const findings: GeoFinding[] = [];
  const withHtml = pages.filter((p) => p.parsed);

  /* --- erreurs de syntaxe -------------------------------------------- */
  const errs = pages.filter((p) => p.page.jsonLdErrors.length);
  if (errs.length) {
    findings.push(
      finding({
        id: 'geo.donnees.syntax',
        category: CAT,
        severity: 'medium',
        title: `${plural(errs.length, 'page contient', 'pages contiennent')} un bloc JSON-LD illisible`,
        why: 'Un bloc mal formé est ignoré en entier : les informations qu’il porte sont perdues pour les machines.',
        fix: 'Corrigez la syntaxe (virgule, guillemet, accolade) ; testez le bloc avec un validateur.',
        affected: errs.map((p) => ({ url: p.url, detail: clip(p.page.jsonLdErrors[0], 120) })),
        impact: 2,
        effort: 1,
        evidenceLevel: 'demontre',
      }),
    );
  }

  /* --- produits ------------------------------------------------------- */
  const products = withHtml.filter(isProductPage);
  const noProductLd = products.filter((p) => !p.nodes.some((n) => typesOf(n).includes('Product') && n.offers));
  if (noProductLd.length) {
    const sample = noProductLd[0];
    let suggestion: unknown = null;
    try {
      suggestion = sample.parsed ? suggestedProductJsonLd(extractProduct(sample.parsed).data, sample.url) : null;
    } catch {
      suggestion = null;
    }
    findings.push(
      finding({
        id: 'geo.donnees.product',
        category: CAT,
        severity: siteType === 'ecommerce' ? 'high' : 'medium',
        title: `${plural(noProductLd.length, 'fiche produit n’a', 'fiches produit n’ont')} pas de balisage Product avec prix et disponibilité`,
        why: 'Prix, disponibilité, marque et identifiants (GTIN) balisés sont lus sans ambiguïté par les moteurs ; Google indique que ses données marchandes aident les produits à apparaître dans les réponses IA.',
        fix: 'Ajoutez un bloc Product (name, brand, gtin ou sku, image, offers avec price, priceCurrency, availability) sur chaque fiche, avec les valeurs affichées.',
        affected: noProductLd.map((p) => ({ url: p.url })),
        impact: 3,
        effort: 2,
        evidenceLevel: 'probable',
        ...(suggestion ? { autoFix: { kind: 'jsonld', payload: { url: sample.url, value: suggestion, note: 'Exemple construit avec les seules valeurs trouvées sur la première fiche ; à généraliser dans le gabarit produit.' } } } : {}),
      }),
    );
  }

  /* --- articles ------------------------------------------------------- */
  const articles = withHtml.filter((p) => isArticlePage(p));
  const noArticleLd = articles.filter((p) => ![...p.types].some((t) => /Article|BlogPosting|Report/.test(t)));
  if (noArticleLd.length >= 2) {
    findings.push(
      finding({
        id: 'geo.donnees.article',
        category: CAT,
        severity: 'low',
        title: `${plural(noArticleLd.length, 'article n’est pas balisé', 'articles ne sont pas balisés')} (Article / BlogPosting)`,
        why: 'Le balisage Article déclare l’auteur, l’éditeur et les dates : il rend le contenu vérifiable pour les machines.',
        fix: 'Ajoutez un bloc BlogPosting avec headline, author, publisher, datePublished et dateModified.',
        affected: noArticleLd.map((p) => ({ url: p.url })),
        impact: 1,
        effort: 1,
        evidenceLevel: 'hypothese',
      }),
    );
  }

  /* --- FAQ visibles non balisées, FAQ balisées non visibles ----------- */
  const faqVisible = withHtml.filter((p) => p.page.headings.filter((h) => h.level >= 2 && QUESTION_RE.test(h.text)).length >= 3 && !p.types.has('FAQPage'));
  if (faqVisible.length) {
    findings.push(
      finding({
        id: 'geo.donnees.faq_unmarked',
        category: CAT,
        severity: 'low',
        title: `${plural(faqVisible.length, 'page a', 'pages ont')} des questions-réponses visibles sans balisage FAQPage`,
        why: 'Google n’affiche plus ces extraits que pour quelques sites officiels, mais le balisage rend la structure question → réponse explicite pour les autres moteurs.',
        fix: 'Ajoutez un bloc FAQPage reprenant mot pour mot les questions et réponses visibles.',
        affected: faqVisible.map((p) => ({ url: p.url })),
        impact: 1,
        effort: 1,
        evidenceLevel: 'hypothese',
      }),
    );
  }
  const faqHidden: { url: string; detail: string }[] = [];
  for (const p of withHtml) {
    const text = (p.parsed?.bodyText ?? '').toLowerCase();
    for (const n of p.nodes.filter((x) => typesOf(x).includes('FAQPage'))) {
      const qs = faqQuestions(n);
      const missing = qs.filter((q) => !text.includes(q.toLowerCase().replace(/\s+/g, ' ').slice(0, 60)));
      if (qs.length && missing.length / qs.length > 0.5) faqHidden.push({ url: p.url, detail: `${missing.length}/${qs.length} questions balisées absentes du texte` });
    }
  }
  if (faqHidden.length) {
    findings.push(
      finding({
        id: 'geo.donnees.faq_not_visible',
        category: CAT,
        severity: 'medium',
        title: `${plural(faqHidden.length, 'page balise', 'pages balisent')} une FAQ qui n’est pas affichée`,
        why: 'Google exige que les données structurées reflètent le contenu visible ; un balisage sans texte correspondant peut être ignoré ou sanctionné.',
        fix: 'Affichez les questions et réponses sur la page, ou retirez le bloc FAQPage.',
        affected: faqHidden,
        impact: 2,
        effort: 1,
        evidenceLevel: 'demontre',
      }),
    );
  }

  /* --- prix balisé absent de la page ---------------------------------- */
  const priceMismatch: { url: string; detail: string }[] = [];
  for (const p of products) {
    const text = (p.parsed?.bodyText ?? '').replace(/[\s  ]/g, '');
    for (const n of p.nodes.filter((x) => typesOf(x).includes('Offer'))) {
      const price = str(n.price);
      if (!price) continue;
      const num = Number(price.replace(',', '.'));
      if (!Number.isFinite(num)) continue;
      const variants = [num.toFixed(2).replace('.', ','), num.toFixed(2), String(num).replace('.', ','), String(num)];
      if (!variants.some((v) => text.includes(v))) priceMismatch.push({ url: p.url, detail: `prix balisé ${price}` });
    }
  }
  if (priceMismatch.length) {
    findings.push(
      finding({
        id: 'geo.donnees.price_mismatch',
        category: CAT,
        severity: 'medium',
        title: `${plural(priceMismatch.length, 'fiche produit balise', 'fiches produit balisent')} un prix qui n’apparaît pas sur la page`,
        why: 'Un prix balisé différent du prix affiché est une source classique de prix faux dans les réponses des IA.',
        fix: 'Faites générer le balisage par le même champ que le prix affiché (gabarit produit).',
        affected: priceMismatch,
        impact: 2,
        effort: 1,
        evidenceLevel: 'probable',
      }),
    );
  }

  const typed = pages.filter((p) => p.types.size).length;
  const note = `${plural(typed, 'page porte', 'pages portent')} des données structurées ; ${plural(products.length, 'fiche produit', 'fiches produit')}, ${plural(articles.length, 'article', 'articles')} détectés. Google ne les exige pas pour ses fonctions IA ; elles lèvent les ambiguïtés.`;
  return section('donnees', 'Données structurées utiles aux IA', 10, findings, note, withHtml.length > 0);
}
