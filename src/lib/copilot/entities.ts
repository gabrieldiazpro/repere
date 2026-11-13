/**
 * Entités du copilote : normalisation, correction des fautes de frappe, correspondance floue.
 * Tout est déterministe (aucun appel réseau) : sert au routeur du mode démo ET à la validation des
 * arguments d'outils en mode LLM (le nom de concurrent proposé par le modèle est rapproché des données).
 */
import type { ProviderId } from '@/lib/engine';
import type { AiEngine, BrandFactField } from '@/lib/engine/types-v2';

/** Minuscules, sans accents, apostrophes et tirets réduits à des espaces simples. */
export function norm(s: string): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’'`´]/g, ' ')
    .replace(/[-_/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Clé de comparaison d'un nom : lettres et chiffres seulement. */
export const fold = (s: string) => norm(s).replace(/[^a-z0-9]/g, '');

/** Distance de Damerau-Levenshtein (transpositions adjacentes comprises), bornée. */
export function editDistance(a: string, b: string, max = 3): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      rowMin = Math.min(rowMin, d[i][j]);
    }
    if (rowMin > max) return max + 1;
  }
  return d[a.length][b.length];
}

/** Similarité 0–1 entre deux chaînes normalisées. */
export function similarity(a: string, b: string): number {
  const x = fold(a);
  const y = fold(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const max = Math.max(x.length, y.length);
  return 1 - editDistance(x, y, Math.ceil(max / 2)) / max;
}

// ---------------------------------------------------------------------------
// Correction des fautes de frappe (vocabulaire du copilote)
// ---------------------------------------------------------------------------

const VOCAB = [
  'concurrent', 'concurrents', 'classement', 'classe', 'visites', 'visiteurs', 'trafic', 'ventes', 'commandes', 'source', 'sources',
  'question', 'questions', 'perplexity', 'chatgpt', 'gemini', 'claude', 'mistral', 'copilot', 'comparatif', 'comparer', 'compare',
  'erreur', 'erreurs', 'robots', 'article', 'articles', 'semaine', 'trimestre', 'janvier', 'fevrier', 'avril', 'juillet', 'septembre',
  'octobre', 'novembre', 'decembre', 'score', 'position', 'recommande', 'recommandee', 'pourquoi', 'combien', 'exporte', 'exporter',
  'citable', 'citations', 'avis', 'reponds', 'reponse', 'priorite', 'premier', 'tarifs', 'composition', 'livraison', 'dimanche',
  'ouvert', 'description', 'fiche', 'google', 'progresse', 'absent', 'absents', 'journaliste', 'shopping', 'chiffre', 'affaires',
  'conversions', 'appels', 'clients', 'merci', 'devant', 'baisse', 'monte', 'augmente', 'explique', 'semaines', 'produits', 'produit',
  'opportunite', 'opportunites', 'perception', 'reputation', 'horaires', 'adresse', 'telephone', 'ingredients', 'shampoing',
  'deodorant', 'plombier', 'logiciel', 'urgence', 'redige', 'ecris', 'prepare', 'comite', 'direction', 'concurrence', 'meilleur',
  'meilleure', 'taches', 'tache', 'faire', 'minutes', 'quelle', 'quelles', 'quels', 'quel', 'combientieme', 'visibilite', 'mentionne',
  'visitent', 'passent', 'devrions', 'ecrire', 'sommes', 'corriger', 'fiches', 'citent', 'clientes', 'client', 'visite', 'baisser',
  'monter', 'proposition', 'propose', 'suivre', 'suivi', 'ajoute', 'ajouter', 'comment', 'contre', 'votre', 'notre', 'pages', 'blogs',
];
const VOCAB_SET = new Set(VOCAB);
/** Formes fautives fréquentes, corrigées avant toute règle. */
const FIXES: [RegExp, string][] = [
  [/\bchat ?g ?t ?p\b|\bchagpt\b|\bchatgtp\b|\bchat gpt\b|\bchatgp\b|\bchtgpt\b|\bgpt\b/g, 'chatgpt'],
  [/\bperplexit[eyi]*\b|\bperpl[eix]+t[yi]\b|\bperpelxity\b|\bperplexi\b|\bperplex\b/g, 'perplexity'],
  [/\bgem[ie]n[iy]?\b|\bgemnini\b|\bgemeni\b|\bbard\b/g, 'gemini'],
  [/\ble chat\b(?! gpt)/g, 'mistral'],
  [/\bconcurent(s?)\b|\bconcurant(s?)\b|\bconcurrant(s?)\b/g, 'concurrent$1$2$3'],
  [/\btrafique?\b|\btraffic\b/g, 'trafic'],
  [/\bclassment\b|\bclasement\b/g, 'classement'],
  [/\bstp\b|\bsvp\b|\bs il (te|vous) plait\b/g, ' '],
];

/** Corrige les fautes de frappe d'une question normalisée (mots de 5 lettres et plus). */
export function correctTypos(q: string): string {
  let s = norm(q);
  for (const [re, by] of FIXES) s = s.replace(re, by);
  return s
    .split(' ')
    .map((w) => {
      if (w.length < 5 || VOCAB_SET.has(w) || /\d/.test(w)) return w;
      const max = w.length >= 8 ? 2 : 1;
      let best: string | null = null;
      let bestD = max + 1;
      for (const v of VOCAB) {
        if (Math.abs(v.length - w.length) > max || v[0] !== w[0]) continue;
        const dd = editDistance(w, v, max);
        if (dd < bestD) {
          bestD = dd;
          best = v;
        }
      }
      return best && bestD <= max ? best : w;
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// IA nommée
// ---------------------------------------------------------------------------

export type EngineName = ProviderId | 'mistral' | 'copilot';

export const ENGINE_LABEL: Record<EngineName | AiEngine, string> = {
  chatgpt: 'ChatGPT',
  perplexity: 'Perplexity',
  gemini: 'Gemini',
  claude: 'Claude',
  mistral: 'Mistral (Le Chat)',
  copilot: 'Copilot',
  other_ai: 'autres IA',
};

/** IA citée dans la question (après correction des fautes). */
export function providersIn(question: string): EngineName[] {
  const q = correctTypos(question);
  const out: EngineName[] = [];
  if (/\bchatgpt\b|\bopenai\b/.test(q)) out.push('chatgpt');
  if (/\bperplexity\b/.test(q)) out.push('perplexity');
  if (/\bgemini\b/.test(q) || (/\bgoogle\b/.test(q) && /\b(ia|gemini|assistant)\b/.test(q) && !/fiche google|google business|avis google/.test(q))) out.push('gemini');
  if (/\bclaude\b|\banthropic\b/.test(q)) out.push('claude');
  if (/\bmistral\b/.test(q)) out.push('mistral');
  if (/\bcopilot\b|\bbing chat\b/.test(q)) out.push('copilot');
  return out;
}

export function providerIn(question: string): EngineName | null {
  return providersIn(question)[0] ?? null;
}

// ---------------------------------------------------------------------------
// Périodes
// ---------------------------------------------------------------------------

const MONTHS = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];

export interface PeriodEntity {
  /** mois cités (0–11), dans l'ordre de la question */
  months: number[];
  year?: number;
  kind: 'months' | 'last_month' | 'quarter' | 'since_start' | 'days' | null;
  /** nombre de jours (trafic) */
  days?: number;
}

export function periodIn(question: string): PeriodEntity {
  const q = correctTypos(question);
  const months: number[] = [];
  for (const m of q.matchAll(/\b(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)\b/g)) {
    const i = MONTHS.indexOf(m[1]);
    if (!months.includes(i)) months.push(i);
  }
  const year = Number(/\b(20\d\d)\b/.exec(q)?.[1]) || undefined;
  const days = /\b(\d{1,3}) (derniers )?jours\b/.exec(q);
  if (months.length) return { months, year, kind: 'months' };
  if (days) return { months, kind: 'days', days: Number(days[1]) };
  if (/\b(cette semaine|7 jours|derniere semaine|semaine derniere)\b/.test(q) && /(visite|trafic|vente|commande|appel)/.test(q)) return { months, kind: 'days', days: 7 };
  if (/\b(trimestre|3 mois|trois mois|90 jours)\b/.test(q)) return { months, kind: 'quarter', days: 90 };
  if (/\b(depuis le debut|depuis le premier audit|depuis juin|depuis le depart|depuis que)\b/.test(q)) return { months, kind: 'since_start' };
  if (/\b(mois dernier|dernier mois|le mois passe|depuis un mois|sur un mois|ce mois ci|ce mois)\b/.test(q)) return { months, kind: 'last_month', days: 30 };
  return { months, kind: null };
}

export const monthLabel = (i: number) => ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'][i];

// ---------------------------------------------------------------------------
// Noms (concurrents, produits, questions)
// ---------------------------------------------------------------------------

/** Mots trop génériques pour identifier seuls un acteur. */
const GENERIC = new Set(['atelier', 'maison', 'plomberie', 'ets', 'fils', 'savonnerie', 'societe', 'groupe', 'cabinet', 'les', 'des', 'and', 'paris', 'lyon', 'france', 'solide', 'paie', 'sos']);

export interface NameMatch {
  name: string;
  score: number;
  /** autres candidats aussi proches (nom partiel ambigu) */
  ambiguous: string[];
}

/** Rapproche un nom saisi (ou une question entière) d'une liste de noms connus. */
export function matchName(text: string, candidates: string[], opts: { threshold?: number; exclude?: string[] } = {}): NameMatch | null {
  const threshold = opts.threshold ?? 0.8;
  const excl = new Set((opts.exclude ?? []).map(fold));
  const qn = ` ${norm(text).replace(/[^a-z0-9& ]/g, ' ').replace(/\s+/g, ' ')} `;
  const qTokens = qn.trim().split(' ').filter(Boolean);
  const uniq = [...new Set(candidates.filter((c) => c && !excl.has(fold(c))))];
  const scored: { name: string; score: number }[] = [];
  for (const c of uniq) {
    const cn = norm(c).replace(/[^a-z0-9& ]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!cn) continue;
    if (qn.includes(` ${cn} `)) {
      scored.push({ name: c, score: 1 });
      continue;
    }
    // fenêtre glissante de même longueur (fautes de frappe : « Savonerie Alba », « Paylo » / « Payloo »)
    const n = cn.split(' ').length;
    let best = 0;
    for (let i = 0; i + n <= qTokens.length; i++) best = Math.max(best, similarity(qTokens.slice(i, i + n).join(' '), cn));
    if (best >= threshold) {
      scored.push({ name: c, score: best });
      continue;
    }
    // nom partiel distinctif (« Henry » pour « Atelier Henry »)
    const distinct = cn.split(' ').filter((t) => t.length >= 4 && !GENERIC.has(t));
    const hit = distinct.some((t) => qTokens.some((w) => w === t || (t.length >= 6 && editDistance(w, t, 1) <= 1)));
    if (hit) scored.push({ name: c, score: 0.7 });
  }
  if (!scored.length) return null;
  scored.sort((a, b) => b.score - a.score);
  const top = scored[0];
  return { name: top.name, score: top.score, ambiguous: scored.filter((s) => s !== top && s.score === top.score).map((s) => s.name) };
}

const STOP_CAPS = new Set(
  'Pourquoi Quel Quelle Quels Quelles Est Sont Que Qui Comment Combien Écris Ecris Rédige Redige Prépare Prepare Fais Donne Dis Réponds Reponds Compare Exporte Ajoute Merci Bonjour Je Nous On Mon Ma Mes Notre Nos Tu Vous Il Elle Ils Le La Les Un Une Des Et Ou Mais Page Pour Sur Dans Avec Sans Entre Depuis ChatGPT Perplexity Gemini Claude Mistral Copilot Google IA FAQ CSV Shopping Lundi Mardi Mercredi Jeudi Vendredi Samedi Dimanche Paris Lyon France'.split(
    ' ',
  ),
);

/** Nom propre inconnu cité dans la question (« Pourquoi Lamazuna est recommandé… » → « Lamazuna »). */
export function unknownProperName(question: string, known: string[]): string | null {
  const knownF = new Set(known.map(fold));
  const re = /(?:^|[\s«"“(])([A-ZÀ-Ý][\w&'’.-]*(?:\s+(?:&\s+)?[A-ZÀ-Ý][\w&'’.-]*)*)/g;
  for (const m of question.matchAll(re)) {
    const words = m[1].split(/\s+/).filter((w) => !STOP_CAPS.has(w.replace(/[’'].*$/, '')));
    if (!words.length) continue;
    const cand = words.join(' ').replace(/[.,;:!?]+$/, '');
    const startsSentence = m.index === 0 && words.length === m[1].split(/\s+/).length && words.length === 1 && /^(Pourquoi|Quel)/.test(m[1]);
    if (startsSentence || cand.length < 3) continue;
    if (knownF.has(fold(cand))) continue;
    return cand;
  }
  return null;
}

/** Texte entre guillemets (« … », "…", “…”). */
export function quotedText(question: string): string | null {
  const m = question.match(/[«"“]\s*([\s\S]+?)\s*[»"”]/);
  return m ? m[1].trim() : null;
}

const STOPWORDS = new Set(
  'le la les un une des de du d l a au aux en et ou pour par sur dans avec sans que qui quoi quel quelle quels quelles est sont ce cet cette ces mon ma mes notre nos votre vos je tu il nous vous on pas plus tres bien chez the question questions cite citent url urls exactes exacte exact liens lien pour la est-ce dit disent'.split(
    ' ',
  ),
);

const stem = (w: string) => w.slice(0, 5);

/** Rapproche une formulation libre (« plombier urgence ») des questions de l'audit. Renvoie l'index ou -1. */
export function matchQuery(text: string, queries: string[]): { index: number; score: number } {
  const words = correctTypos(text)
    .split(' ')
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
  if (!words.length) return { index: -1, score: 0 };
  let best = -1;
  let bestScore = 0;
  let tie = false;
  queries.forEach((q, i) => {
    const qs = new Set(norm(q).split(' ').filter((w) => w.length >= 3).map(stem));
    const score = words.reduce((s, w) => s + (qs.has(stem(w)) ? (w.length >= 6 ? 1.2 : 1) : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      best = i;
      tie = false;
    } else if (score === bestScore && score > 0) tie = true;
  });
  return { index: tie && bestScore < 2 ? -1 : best, score: bestScore };
}

// ---------------------------------------------------------------------------
// Sujets de la fiche de vérité
// ---------------------------------------------------------------------------

export interface FactTopic {
  field: BrandFactField;
  /** mots à chercher dans les réponses des IA (normalisés) */
  keywords: string[];
  label: string;
}

const TOPICS: { re: RegExp; topic: FactTopic }[] = [
  { re: /dimanche/, topic: { field: 'horaires', keywords: ['dimanche', '7j/7', '7 j/7', '7/7', '7 jours sur 7', 'week end', 'weekend', 'tous les jours'], label: 'ouverture le dimanche' } },
  { re: /samedi|week end|weekend/, topic: { field: 'horaires', keywords: ['samedi', 'week end', 'weekend', '7j/7', '7 j/7'], label: 'ouverture le week-end' } },
  { re: /\bsoir\b|\bnuit\b|24 ?h|ferie/, topic: { field: 'horaires', keywords: ['soir', 'nuit', '24h', '24 h', '24/24', 'ferie', '7j/7', '7 j/7'], label: 'horaires élargis' } },
  { re: /horaire|ouvert|ferme|heure/, topic: { field: 'horaires', keywords: ['horaire', 'ouvert', 'lundi', 'samedi', 'dimanche', ' h '], label: 'horaires' } },
  { re: /composition|ingredient|inci|sulfate|silicone|naturel/, topic: { field: 'ingredients', keywords: ['ingredient', 'composition', 'inci', 'sulfate', 'silicone', 'naturel', 'formule'], label: 'composition' } },
  { re: /label|certifi|bio\b|vegan|ecocert|cosmos/, topic: { field: 'certifications', keywords: ['bio', 'vegan', 'ecocert', 'cosmos', 'label', 'certifi'], label: 'labels et certifications' } },
  { re: /livr|expedi|belgique|frais de port/, topic: { field: 'livraison', keywords: ['livraison', 'livre', 'expedi', 'belgique', 'offerte'], label: 'livraison' } },
  { re: /retour|rembours/, topic: { field: 'retours', keywords: ['retour', 'rembours'], label: 'retours' } },
  { re: /telephone|numero|appeler/, topic: { field: 'telephone', keywords: ['telephone', '01 ', '02 ', '03 ', '04 ', '05 ', '06 ', '07 ', '09 '], label: 'téléphone' } },
  { re: /adresse|situe|ou est/, topic: { field: 'adresse', keywords: ['adresse', 'rue', 'avenue'], label: 'adresse' } },
  { re: /prix|tarif|cout|cher|euro/, topic: { field: 'prix', keywords: ['prix', 'tarif', '€', 'euro', 'cher', 'abordable'], label: 'prix' } },
  { re: /zone|secteur|interven|quartier|arrondissement/, topic: { field: 'zone', keywords: ['zone', 'intervient', 'arrondissement', 'secteur'], label: 'zone' } },
  { re: /dirige|fondateur|patron|gerant|ceo/, topic: { field: 'dirigeant', keywords: ['dirig', 'fond', 'gerant'], label: 'dirigeant' } },
  { re: /cree|creation|fonde|depuis quand|annee/, topic: { field: 'creation', keywords: ['cree', 'creation', 'fonde', 'depuis'], label: 'année de création' } },
  { re: /\bstatut\b|ferme definitivement|toujours ouvert|en activite|existe encore/, topic: { field: 'statut', keywords: ['ferme', 'activite', 'ouvert'], label: 'statut' } },
];

export function factTopicIn(question: string): FactTopic | null {
  const q = correctTypos(question);
  return TOPICS.find((t) => t.re.test(q))?.topic ?? null;
}
