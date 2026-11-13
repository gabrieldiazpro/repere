/**
 * Requêtes par parcours (V2) : local = gabarits V1 ; PME et e-commerce = gabarits sectoriels
 * (docs/v2/01-marche-pme.md § 7, docs/v2/02-marche-ecommerce.md § 7).
 * Les requêtes de recommandation ne contiennent jamais le nom du client.
 * Les requêtes de marque (kind 'brand') nomment le client : elles alimentent la perception et la vérité,
 * PAS le score de recommandation.
 */
import { buildQueries, zoneInfo } from './queries';
import type { AuditInput, QueryAngle, QueryIntent, QuerySpec } from './types';
import type { Segment } from './types-v2';
import { capitalize, shortHash } from './util';

export function segmentOf(input: Pick<AuditInput, 'segment'>): Segment {
  return input.segment === 'pme' || input.segment === 'ecommerce' ? input.segment : 'local';
}

/** Intention V1 associée à un angle V2 (le rapport V1 ne connaît que 5 intentions). */
export const ANGLE_INTENT: Record<QueryAngle, QueryIntent> = {
  best: 'best',
  which_company: 'best',
  french_brand: 'best',
  nearby: 'nearby',
  urgent: 'urgent',
  specific: 'specific',
  alternative: 'specific',
  where_to_buy: 'specific',
  price: 'specific',
  review: 'review',
  comparison: 'review',
  brand_opinion: 'review',
  brand_trust: 'review',
  brand_facts: 'specific',
};

function spec(tid: string, angle: QueryAngle, text: string, kind: 'reco' | 'brand' = 'reco'): QuerySpec {
  return { id: `${tid}-${shortHash(text)}`, text, intent: ANGLE_INTENT[angle], angle, kind };
}

const FEM_HEADS = new Set([
  'agence', 'solution', 'plateforme', 'entreprise', 'societe', 'société', 'école', 'ecole', 'formation', 'esn', 'application',
  'appli', 'marque', 'banque', 'assurance', 'mutuelle', 'boutique', 'crème', 'creme', 'huile', 'box', 'gourde', 'poêle', 'poele',
]);

/** Article indéfini (« un logiciel de paie », « une agence data »). */
export function indef(phrase: string): string {
  const head = phrase.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  return `${FEM_HEADS.has(head) ? 'une' : 'un'} ${phrase.trim()}`;
}

/** Pluriel du premier mot (« logiciel de paie » → « logiciels de paie »). */
export function pluralHead(phrase: string): string {
  const words = phrase.trim().split(/\s+/);
  const w = words[0] ?? '';
  let p = w;
  if (/[sxz]$/i.test(w)) p = w;
  else if (/au$|eau$|eu$/i.test(w)) p = `${w}x`;
  else if (/al$/i.test(w) && !/^(festival|carnaval|bal|récital)$/i.test(w)) p = `${w.slice(0, -2)}aux`;
  else p = `${w}s`;
  return [p, ...words.slice(1)].join(' ');
}

function cleanCat(s: string | undefined): string {
  return (s ?? '').replace(/\s+/g, ' ').trim().replace(/[.?!]+$/, '');
}

function pmeAudience(input: AuditInput): string {
  const o = (input.offering ?? '').toLowerCase();
  if (/\btpe\b/.test(o)) return 'une TPE';
  if (/\beti\b|grand(e)?s? (compte|entreprise)/.test(o)) return 'une ETI';
  if (/startup|start-up/.test(o)) return 'une startup';
  return 'une PME';
}

/** Requêtes de recommandation PME / B2B. n = 8 (gratuit) ou 12 (suivi). */
export function buildPmeQueries(input: AuditInput, n = 8): QuerySpec[] {
  const full = cleanCat(input.category) || cleanCat(input.trade) || 'prestataire';
  // « logiciel de paie pour PME » → « logiciel de paie » (l'audience est ajoutée par les gabarits).
  const cat = full.replace(/\s+pour\s+(?:les\s+|une\s+|des\s+|la\s+)?(?:pme|tpe|eti|startups?|entreprises?|petites entreprises|ind[ée]pendants)\b.*$/i, '') || full;
  const market = cleanCat(input.market) || 'France';
  const aud = pmeAudience(input);
  const [c1, c2] = (input.knownCompetitors ?? []).map(cleanCat).filter(Boolean);
  const qs: QuerySpec[] = [
    spec('P1', 'best', `Quel est le meilleur ${cat} pour ${aud} en ${market} ?`),
    spec('P2', 'which_company', `Quelle entreprise choisir pour ${indef(cat)} adapté à ${aud} ?`),
    spec('P3', 'alternative', c1 ? `Quelle alternative à ${c1} pour ${aud} ?` : `Quelles alternatives françaises aux leaders du marché pour ${indef(cat)} ?`),
    spec('P4', 'comparison', `Comparatif des ${pluralHead(cat)} en 2026 : lesquels choisir pour ${aud} ?`),
    spec('P5', 'price', `Combien coûte ${indef(cat)} pour ${aud} de 50 salariés ?`),
    spec('P6', 'review', `Quels ${pluralHead(cat)} ont les meilleurs avis clients en ${market} ?`),
    spec('P7', 'comparison', c1 && c2 ? `${c1} ou ${c2} : lequel choisir pour ${aud} ?` : `Quel ${cat} choisir pour ${aud} en croissance ?`),
    spec('P8', 'best', `Tu peux me conseiller ${indef(cat)} fiable et reconnu en ${market} ?`),
    // Suivi (12) : variantes
    spec('P9', 'alternative', c2 ? `Alternative moins chère à ${c2} ?` : `Alternative moins chère aux ${pluralHead(cat)} les plus connus ?`),
    spec('P10', 'best', `Top 5 des ${pluralHead(cat)} pour ${aud}`),
    spec('P11', 'which_company', `Qui peut m'aider à choisir ${indef(cat)} adapté à ${aud} ?`),
    spec('P12', 'review', `${capitalize(cat)} : quels retours d'expérience des entreprises françaises ?`),
  ];
  return dedupe(qs).slice(0, Math.max(1, n));
}

/** Requêtes de recommandation e-commerce. */
export function buildEcomQueries(input: AuditInput, n = 8): QuerySpec[] {
  const cats = (input.productCategories ?? []).map(cleanCat).filter(Boolean);
  const p1 = cats[0] || cleanCat(input.category) || cleanCat(input.trade) || 'produit';
  const p2 = cats[1] || p1;
  const [c1, c2] = (input.knownCompetitors ?? []).map(cleanCat).filter(Boolean);
  const qs: QuerySpec[] = [
    spec('E1', 'best', `Quelles sont les meilleures marques de ${p1} ?`),
    spec('E2', 'best', `Je cherche une bonne marque de ${p1}, que me conseilles-tu ?`),
    spec('E3', 'alternative', c1 ? `Quelle alternative à ${c1} en ${p1} ?` : `Quelle alternative aux grandes marques de ${p1}, fabriquée en France ?`),
    spec('E4', 'where_to_buy', `${capitalize(p1)} : où l'acheter en ligne au meilleur prix ?`),
    spec('E5', 'french_brand', `Quelle marque française de ${p1} recommandes-tu ?`),
    spec('E6', 'review', `${capitalize(p2)} : quelles marques ont les meilleurs avis ?`),
    spec('E7', 'comparison', `Comparatif ${p1} 2026 : quelles marques choisir ?`),
    spec('E8', 'best', `${capitalize(p2)} efficace et à bon prix : quelle marque ?`),
    // Suivi (12)
    spec('E9', 'alternative', c2 ? `Alternative à ${c2} moins chère ?` : `Alternative moins chère aux marques connues de ${p2} ?`),
    spec('E10', 'comparison', c1 && c2 ? `${c1} ou ${c2} : laquelle choisir ?` : `Quelle marque de ${p2} choisir en 2026 ?`),
    spec('E11', 'where_to_buy', `Où acheter ${p2} d'une marque française en ligne ?`),
    spec('E12', 'french_brand', `Marques françaises de ${p2} : lesquelles sont fiables ?`),
  ];
  return dedupe(qs).slice(0, Math.max(1, n));
}

/**
 * Requêtes de marque (nom du client). PME / e-commerce : opinion + fiabilité (+ faits en suivi).
 * Local : aucune en gratuit (parcours V1 inchangé) ; une requête de faits en suivi payant.
 */
export function buildBrandQueries(input: AuditInput, mode: 'free' | 'paid' = 'free'): QuerySpec[] {
  const seg = segmentOf(input);
  const name = input.businessName.trim();
  if (!name) return [];
  if (seg === 'local') {
    if (mode !== 'paid') return [];
    const z = zoneInfo(input);
    return [spec('B3', 'brand_facts', `Quels sont l'adresse, le téléphone et les horaires de ${name} à ${z.city} ?`, 'brand')];
  }
  const cat = cleanCat(input.category) || cleanCat(input.productCategories?.[0]) || cleanCat(input.trade);
  const out: QuerySpec[] = [
    spec('B1', 'brand_opinion', seg === 'ecommerce' ? `Que penses-tu de la marque ${name}${cat ? ` (${cat})` : ''} ?` : `Que penses-tu de ${name}${cat ? ` (${cat})` : ''} ?`, 'brand'),
    spec('B2', 'brand_trust', seg === 'ecommerce' ? `${name} est-il fiable ? Que disent les avis clients ?` : `${name} est-il fiable ? Que disent les avis des entreprises clientes ?`, 'brand'),
  ];
  if (mode === 'paid') {
    out.push(
      spec(
        'B3',
        'brand_facts',
        seg === 'ecommerce'
          ? `${name} : quels prix, quels délais et quels pays de livraison ?`
          : `${name} : quels tarifs, quelle adresse et quels services proposés ?`,
        'brand',
      ),
    );
  }
  return out;
}

/** Requêtes de recommandation du parcours (sans les requêtes de marque). */
export function buildSegmentQueries(input: AuditInput, n = 8): QuerySpec[] {
  const seg = segmentOf(input);
  if (seg === 'pme') return buildPmeQueries(input, n);
  if (seg === 'ecommerce') return buildEcomQueries(input, n);
  return buildQueries(input, n);
}

/** Panel complet d'un audit : recommandation + marque. */
export function buildAuditQueries(input: AuditInput, mode: 'free' | 'paid' = 'free'): QuerySpec[] {
  return [...buildSegmentQueries(input, mode === 'paid' ? 12 : 8), ...buildBrandQueries(input, mode)];
}

export function isBrandQuery(q: Pick<QuerySpec, 'kind' | 'id'> | undefined): boolean {
  return !!q && (q.kind === 'brand' || /^(B\d|CB-)/.test(q.id));
}

function dedupe(qs: QuerySpec[]): QuerySpec[] {
  const seen = new Set<string>();
  return qs.filter((q) => (seen.has(q.text) ? false : (seen.add(q.text), true)));
}
