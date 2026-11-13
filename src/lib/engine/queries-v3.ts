/**
 * Questions V3 : questions personnalisées (texte, tags, thème, intention) qui remplacent ou complètent les gabarits,
 * et thème + étiquettes sur CHAQUE question d'un audit (gabarits compris) pour la grille thème × IA.
 */
import { buildVariants, norm } from './detect';
import { ANGLE_INTENT, buildAuditQueries, isBrandQuery, segmentOf } from './queries-v2';
import { templateOf } from './queries';
import { clientNamedIn } from './sources';
import type { AuditInput, QueryAngle, QueryIntent, QuerySpec } from './types';
import type { CustomQuery } from './types-v3';
import { shortHash } from './util';

const INTENTS: QueryIntent[] = ['best', 'nearby', 'urgent', 'specific', 'review'];
const ANGLES = Object.keys(ANGLE_INTENT) as QueryAngle[];

/** Libellé de thème par angle (gabarits et questions sans thème). */
export const THEME_LABEL: Record<QueryAngle, string> = {
  best: 'Meilleur choix',
  which_company: 'Meilleur choix',
  french_brand: 'Marque française',
  nearby: 'Proximité',
  urgent: 'Urgence et disponibilité',
  specific: 'Services précis',
  alternative: 'Alternatives',
  where_to_buy: 'Où acheter',
  price: 'Prix',
  review: 'Avis et réputation',
  comparison: 'Comparatifs',
  brand_opinion: 'Vérification de la marque',
  brand_trust: 'Vérification de la marque',
  brand_facts: 'Vérification de la marque',
};

/** Angle des gabarits locaux V1 (T1–T10) qui n'en portent pas. */
const LOCAL_TEMPLATE_ANGLE: Record<string, QueryAngle> = {
  T1: 'best', T1g: 'best', T2: 'best', T3: 'nearby', T4: 'nearby', T5: 'urgent', T6: 'urgent', T7: 'specific', T8: 'specific', T9: 'review', T9g: 'review', T10: 'review',
};

/** Angle déduit du texte d'une question (sans accents ; ordre = priorité). */
export function inferAngle(text: string): QueryAngle {
  const n = ` ${norm(text)} `;
  if (/compar| vs | versus |lequel choisir|laquelle choisir|lesquels choisir|ou bien /.test(n)) return 'comparison';
  if (/alternative|a la place de|remplacer|equivalent a /.test(n)) return 'alternative';
  if (/ prix | tarif|combien|cout | couts | budget|pas cher|moins cher/.test(n)) return 'price';
  if (/ou acheter|ou commander|acheter en ligne|en ligne au meilleur/.test(n)) return 'where_to_buy';
  if (/marque francaise|made in france|fabrique en france|fabrication francaise/.test(n)) return 'french_brand';
  if (/ avis |fiable|confiance|bien note|reputation|retours d experience/.test(n)) return 'review';
  if (/urgent|urgence|rapidement|ce soir|aujourd hui|dimanche|samedi| 24h | 24 24 |disponible/.test(n)) return 'urgent';
  if (/ pres de |proche| a cote |autour de|pas loin|dans mon quartier/.test(n)) return 'nearby';
  if (/meilleur| top |conseill|recommand|quel |quelle |quels |quelles /.test(n)) return 'best';
  return 'specific';
}

/** Angle effectif d'une question (champ `angle`, gabarit local, sinon déduit du texte). */
export function angleOf(q: Pick<QuerySpec, 'id' | 'text' | 'angle'>): QueryAngle {
  return q.angle ?? LOCAL_TEMPLATE_ANGLE[templateOf(q.id)] ?? inferAngle(q.text);
}

/** Thème d'une question : son `theme`, sinon le libellé de son angle. */
export function themeOf(q: Pick<QuerySpec, 'id' | 'text' | 'angle' | 'theme'>): string {
  const t = q.theme?.replace(/\s+/g, ' ').trim();
  return t || THEME_LABEL[angleOf(q)];
}

function cleanTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return [...new Set(tags.filter((t): t is string => typeof t === 'string').map((t) => t.replace(/\s+/g, ' ').trim().toLowerCase()).filter(Boolean))].slice(0, 20);
}

/** QuerySpec déjà formée : gabarit (T1-…, P3-…, E5-…, B1-…) ou question personnalisée déjà normalisée (suivi figé). */
function isQuerySpec(q: QuerySpec | CustomQuery): q is QuerySpec {
  if (typeof q.id !== 'string' || !q.id || !(INTENTS as string[]).includes(String(q.intent))) return false;
  return (q as QuerySpec).custom === true || /^(T\d+g?|P\d+|E\d+|B\d+)-/.test(q.id) || !!(q as QuerySpec).angle;
}

/**
 * Normalise une question personnalisée : id stable (`C-xxxx`, `CB-xxxx` si elle nomme l'entreprise), intention V1,
 * angle, thème, étiquettes (« personnalisée » + celles du client). Texte vide → null.
 */
export function normalizeCustomQuery(q: CustomQuery, input: AuditInput): QuerySpec | null {
  const text = String(q.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 400);
  if (text.length < 3) return null;
  const raw = typeof q.intent === 'string' ? q.intent.trim() : '';
  let angle: QueryAngle;
  let intent: QueryIntent;
  if ((ANGLES as string[]).includes(raw)) {
    angle = raw as QueryAngle;
    intent = ANGLE_INTENT[angle];
  } else if ((INTENTS as string[]).includes(raw)) {
    intent = raw as QueryIntent;
    const inferred = inferAngle(text);
    angle = ANGLE_INTENT[inferred] === intent ? inferred : (intent as QueryAngle);
  } else {
    angle = inferAngle(text);
    intent = ANGLE_INTENT[angle];
  }
  const brand = q.kind ? q.kind === 'brand' : clientNamedIn(text, buildVariants(input));
  if (brand && !angle.startsWith('brand_')) angle = 'brand_opinion';
  const id = q.id?.trim() || `${brand ? 'CB' : 'C'}-${shortHash(norm(text))}`;
  const tags = cleanTags(q.tags);
  return {
    id,
    text,
    intent,
    angle,
    kind: brand ? 'brand' : 'reco',
    theme: q.theme?.replace(/\s+/g, ' ').trim() || THEME_LABEL[angle],
    tags: [...new Set(['personnalisée', ...tags])],
    custom: true,
  };
}

/** Remplit `theme` et `tags` d'une question (gabarit ou figée) sans toucher au reste. */
export function withTheme(q: QuerySpec, input: AuditInput): QuerySpec {
  const angle = angleOf(q);
  const base = q.custom ? ['personnalisée'] : isBrandQuery(q) ? ['vérification'] : ['gabarit'];
  return {
    ...q,
    theme: themeOf({ ...q, angle }),
    tags: [...new Set([...base, ...cleanTags(q.tags), segmentOf(input), angle])],
  };
}

/**
 * Questions d'un audit. Sans `custom` : gabarits du parcours. `mode` 'replace' (défaut) : les questions fournies
 * remplacent les gabarits ; 'append' : elles s'ajoutent aux gabarits (doublons de texte retirés, gabarit prioritaire).
 * Chaque QuerySpec renvoyée porte `theme` et `tags`.
 */
export function resolveAuditQueries(
  input: AuditInput,
  auditMode: 'free' | 'paid' = 'free',
  custom?: (QuerySpec | CustomQuery)[],
  mode: 'replace' | 'append' = 'replace',
): QuerySpec[] {
  const provided = (custom ?? [])
    .map((q) => (isQuerySpec(q) ? withTheme(q, input) : normalizeCustomQuery(q, input)))
    .filter((q): q is QuerySpec => !!q);
  const base = !provided.length || mode === 'append' ? buildAuditQueries(input, auditMode).map((q) => withTheme(q, input)) : [];
  const seenText = new Set<string>();
  const seenId = new Set<string>();
  const out: QuerySpec[] = [];
  for (const q of [...base, ...provided]) {
    const k = norm(q.text);
    if (seenText.has(k)) continue;
    let id = q.id;
    for (let i = 2; seenId.has(id); i++) id = `${q.id}-${i}`;
    seenText.add(k);
    seenId.add(id);
    out.push(id === q.id ? q : { ...q, id });
  }
  return out;
}
