/**
 * Texte des questions : normalisation, similarité (dédoublonnage), classement par intention, validation.
 * Tout est déterministe (aucun appel réseau, aucun LLM).
 */
import type { PromptIntent } from './types';
import { PROMPT_INTENTS } from './types';

export const MIN_LEN = 5;
export const MAX_LEN = 200;
export const MAX_TAGS = 10;
export const MAX_TAG_LEN = 30;
export const MAX_THEME_LEN = 60;
/** seuil de Jaccard au-delà duquel deux questions sont considérées comme des doublons */
export const SIMILARITY_THRESHOLD = 0.8;

const STOP = new Set([
  'a', 'au', 'aux', 'avec', 'ce', 'ces', 'cette', 'dans', 'de', 'des', 'du', 'd', 'en', 'et', 'est', 'il', 'je', 'j',
  'la', 'le', 'les', 'l', 'leur', 'ma', 'me', 'mes', 'mon', 'ne', 'ou', 'par', 'pas', 'pour', 'qu', 'que', 'qui', 'quel',
  'quelle', 'quels', 'quelles', 'sa', 'se', 'ses', 'son', 'sur', 'ta', 'te', 'tes', 'toi', 'ton', 'tu', 'un', 'une', 'vos',
  'votre', 'vous', 'y', 'c', 's', 'moi', 'on', 'nous', 'est-ce', 'peux', 'peut', 'me', 'm',
]);

export function fold(s: string): string {
  return s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}

/** Forme canonique d'une question : minuscules, sans accents ni ponctuation, espaces simples. */
export function normalizeQuestion(s: string): string {
  return fold(String(s ?? ''))
    .toLowerCase()
    .replace(/&/g, ' et ')
    .replace(/['’`]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stem(w: string): string {
  if (w.length > 4 && /(s|x)$/.test(w)) return w.slice(0, -1);
  return w;
}

/** Mots porteurs de sens (sans mots vides), racinisés grossièrement (pluriels). */
export function contentTokens(s: string): string[] {
  return normalizeQuestion(s)
    .split(' ')
    .filter((w) => w && !STOP.has(w))
    .map(stem);
}

export function jaccard(a: string, b: string): number {
  const A = new Set(contentTokens(a));
  const B = new Set(contentTokens(b));
  if (!A.size && !B.size) return 1;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

/**
 * Deux questions sont des doublons si leur forme canonique est identique, ou si leur similarité est ≥ 0,8 ET
 * qu'elles portent la même intention (« meilleur plombier » et « plombier le mieux noté » ne sont pas des doublons :
 * l'une demande une recommandation, l'autre des avis).
 */
export function isDuplicate(a: string, b: string): boolean {
  const na = normalizeQuestion(a);
  const nb = normalizeQuestion(b);
  if (na === nb) return true;
  return jaccard(na, nb) >= SIMILARITY_THRESHOLD && classifyIntent(na) === classifyIntent(nb);
}

/** Premier texte de `pool` dont `text` est un doublon (ou null). */
export function findDuplicate<T extends { text: string }>(text: string, pool: readonly T[]): T | null {
  for (const p of pool) if (isDuplicate(text, p.text)) return p;
  return null;
}

/** Retire les doublons d'une liste (premier gardé). */
export function dedupeTexts<T extends { text: string }>(items: readonly T[], against: readonly { text: string }[] = []): T[] {
  const kept: T[] = [];
  for (const it of items) {
    if (findDuplicate(it.text, against) || findDuplicate(it.text, kept)) continue;
    kept.push(it);
  }
  return kept;
}

/**
 * Intention d'une question saisie librement (règles ordonnées, la première qui s'applique gagne).
 * `brandNames` : noms du client ; si l'un d'eux figure dans la question → « marque ».
 */
export function classifyIntent(text: string, brandNames: string[] = []): PromptIntent {
  const n = ` ${normalizeQuestion(text)} `;
  for (const b of brandNames) {
    const nb = normalizeQuestion(b);
    if (nb.length >= 3 && n.includes(` ${nb} `)) return 'marque';
  }
  if (/ (alternative|alternatives|a la place|remplacer|remplacant|equivalent) /.test(n)) return 'alternative';
  if (/ (comparatif|comparer|comparaison|versus|vs) /.test(n) || / ou .+ (lequel|laquelle|lesquels|lesquelles) /.test(n)) return 'comparatif';
  if (/ (avis|fiable|fiables|retours?|note|notes|notees?|recommande par|reputation) /.test(n)) return 'avis';
  if (/ (combien|prix|tarif|tarifs|cout|coute|coutent|devis|budget) /.test(n)) return 'prix';
  if (/ (ou acheter|acheter|commander|en ligne|livraison|boutique) /.test(n)) return 'achat';
  if (/ (urgent|urgence|rapidement|vite|ce soir|maintenant|24h|24 24|dimanche|samedi|tout de suite|nuit) /.test(n)) return 'urgence';
  if (/ (pres de|proche|pas loin|autour de|a cote|quartier|chez moi) /.test(n)) return 'proximite';
  if (/ (qui fait|qui propose|specialise|specialisee|specialiste|qui peut|qui installe|qui repare) /.test(n)) return 'service';
  return 'recommandation';
}

export function isIntent(v: unknown): v is PromptIntent {
  return typeof v === 'string' && (PROMPT_INTENTS as readonly string[]).includes(v);
}

export type TextCheck = { ok: true; text: string } | { ok: false; error: string };

/** Validation d'une question : 5 à 200 caractères, pas d'URL, pas de caractères de contrôle. */
export function validateText(raw: unknown): TextCheck {
  if (typeof raw !== 'string') return { ok: false, error: 'La question doit être un texte.' };
  // eslint-disable-next-line no-control-regex
  const text = raw.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (text.length < MIN_LEN) return { ok: false, error: `La question doit faire au moins ${MIN_LEN} caractères.` };
  if (text.length > MAX_LEN) return { ok: false, error: `La question doit faire au plus ${MAX_LEN} caractères.` };
  if (/https?:\/\/|www\.[a-z0-9-]+\.[a-z]/i.test(text)) return { ok: false, error: 'Pas de lien dans une question : écrivez-la comme un client la poserait.' };
  if (!/[a-zà-ÿ]{2,}/i.test(text)) return { ok: false, error: 'La question doit contenir des mots.' };
  return { ok: true, text };
}

/** Tags : minuscules, sans doublons, 10 au plus, 30 caractères chacun. */
export function cleanTags(raw: unknown): string[] {
  const arr = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(/[|,;]/) : [];
  const out: string[] = [];
  for (const t of arr) {
    if (typeof t !== 'string') continue;
    // eslint-disable-next-line no-control-regex
    const v = t.replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, MAX_TAG_LEN);
    if (v && !out.includes(v)) out.push(v);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

export function cleanTheme(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  // eslint-disable-next-line no-control-regex
  const v = raw.replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_THEME_LEN);
  return v || undefined;
}

/** Tags proposés par défaut (docs/v3/09-audit-app.md, amélioration n° 1). */
export const SUGGESTED_TAGS = ['marque', 'prix', 'urgence', 'comparatif'] as const;

/** Tags dérivés de l'intention (ajoutés aux questions générées). */
export function tagsForIntent(intent: PromptIntent): string[] {
  switch (intent) {
    case 'marque':
      return ['marque'];
    case 'prix':
      return ['prix'];
    case 'urgence':
      return ['urgence'];
    case 'comparatif':
    case 'alternative':
      return ['comparatif'];
    default:
      return [];
  }
}
