/**
 * Section « Contenu citable au niveau du passage ».
 * Découpe le contenu principal de chaque page en passages (section titrée, 40–300 mots visés), puis note chaque passage
 * sur les critères documentés (docs/v5/geo-methode.md § 3) : autonomie, chiffre, date, source, réponse directe, longueur,
 * entités. C'est une heuristique de rédaction, pas une mesure de ce que citent les IA.
 */
import { sentences, wordCount } from '@/lib/siteaudit/html';
import type { GeoFinding, GeoSection, Passage, PassageCriterion, PassageRewrite, ScoredPassage } from './types';
import { clip, effDepth, finding, isExternal, overlap, plural, section, stableId, type GeoPage } from './util';

const CAT = 'geo.contenu';

export const QUESTION_RE = /\?\s*$|^(comment|pourquoi|quel(le)?s?|combien|qu['’]est[- ]ce|que faire|quand|où|faut-il|peut-on|est-ce|dois-je|qui |à quoi|a quoi)/i;
export const PRONOUN_START = /^(il|elle|ils|elles|cela|ceci|ça|ce|cette|ces|celui-ci|celle-ci|on|lui|leur|y|en)\b/i;
export const FLUFF_START = /^(bienvenue|découvrez|decouvrez|vous cherchez|vous recherchez|depuis toujours|n['’]hésitez|nous sommes heureux|chez nous|lorem ipsum|notre passion|leader|n°\s?1|numéro un)/i;
export const NUMBER_FACT =
  /\b\d[\d\s.,]*\s?(%|€|euros?|eur\b|km|m²|m2|kg|g\b|ans?\b|mois\b|jours?\b|semaines?\b|heures?\b|h\b|min\b|minutes?\b|clients?|personnes|salariés|avis|étoiles|°|cm|mm|l\b|litres?|kwh|w\b|places|chantiers|interventions|commandes|produits|références)|\b\d+[.,]\d+\b|\b\d{2,}\s?(à|-)\s?\d{2,}\b|\b\d{1,3}(?:[\s\u202f]\d{3})*\s+(?!(?:et|à|de|du|des|en|au|aux|le|la|les|pour|sur)\b)[a-zà-ÿ]{4,}/i;
const MONTHS = 'janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre';
export const DATE_RE = new RegExp(
  `\\b\\d{1,2}(er)?\\s+(${MONTHS})\\s+(19|20)\\d{2}\\b|\\b\\d{1,2}/\\d{1,2}/(19|20)\\d{2}\\b|\\b(19|20)\\d{2}-\\d{2}-\\d{2}\\b|\\b(${MONTHS})\\s+(19|20)\\d{2}\\b|\\b(en|depuis|année|au)\\s+(19|20)\\d{2}\\b|\\bmis(e)? à jour\\b`,
  'i',
);
export const SOURCE_RE = /\b(selon|d['’]après|source\s*:|sources\s*:|étude|enquête|rapport|données de|chiffres de|insee|ademe|anses|ministère|légifrance|legifrance|service-public|norme|nf\s?[a-z]?\s?\d|dtu\s?\d|iso\s?\d|article\s+[lr]?\.?\s?\d)/i;
export const DEFINITION_RE = /^[A-ZÀ-Ý«“"][^.?!,;:]{2,60}?\s(est|sont|désigne|désignent|signifie|correspond à|consiste à|se définit comme|permet de|coûte|coûtent|dure|contient|contiennent)\s(un|une|le|la|les|l['’]|des|du|de|d['’]|à|en|entre|environ|\d)/;
const ANSWER_START = /^(oui|non|comptez|il faut|en moyenne|le prix|les prix|le tarif|le délai|la durée|nous intervenons|nous livrons|vous pouvez|en général|généralement|entre \d|à partir de|de \d)/i;
const QUOTE_RE = /[«“"][^»”"]{12,}[»”"]\s*(,|—|–|-)?\s*(explique|précise|indique|selon|affirme|souligne|rappelle)?/;

export const MIN_WORDS = 25;
const TARGET_MAX = 300;

/* ------------------------------------------------------------------ */
/* Découpe                                                             */
/* ------------------------------------------------------------------ */

function hrefs(html: string): string[] {
  return [...html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]);
}

/** Passages du contenu principal d'une page. */
export function extractPassages(p: GeoPage): Passage[] {
  if (!p.parsed) return [];
  const blocks = p.parsed.blocks;
  const total = blocks.reduce((s, b) => s + b.text.length, 0) || 1;
  const out: Passage[] = [];
  let heading: string | undefined;
  let buf: { text: string; html: string }[] = [];
  let startChars = 0;
  let seenChars = 0;
  const flush = () => {
    if (!buf.length) return;
    // Sous-découpe des sections trop longues, au fil des paragraphes.
    let chunk: { text: string; html: string }[] = [];
    let chunkStart = startChars;
    let acc = startChars;
    const emit = () => {
      const text = chunk.map((c) => c.text).join(' ').replace(/\s+/g, ' ').trim();
      const words = wordCount(text);
      if (words >= MIN_WORDS) {
        const ext = chunk.flatMap((c) => hrefs(c.html)).filter((h) => isExternal(h, p.url)).length;
        out.push({
          id: stableId(p.url, text.slice(0, 200)),
          url: p.url,
          heading,
          headingIsQuestion: !!heading && QUESTION_RE.test(heading),
          text,
          words,
          position: Math.min(1, chunkStart / total),
          depth: effDepth(p.page.depth),
          externalLinks: ext,
        });
      }
      chunk = [];
    };
    for (const b of buf) {
      const w = wordCount(chunk.map((c) => c.text).join(' '));
      if (w + wordCount(b.text) > TARGET_MAX && w >= 40) {
        emit();
        chunkStart = acc;
      }
      chunk.push(b);
      acc += b.text.length;
    }
    emit();
    buf = [];
  };
  for (const b of blocks) {
    if (/^h[1-6]$/.test(b.tag)) {
      flush();
      heading = b.text;
      startChars = seenChars;
    } else {
      if (!buf.length) startChars = seenChars;
      buf.push({ text: b.text, html: b.html });
    }
    seenChars += b.text.length;
  }
  flush();
  return out;
}

/* ------------------------------------------------------------------ */
/* Notation                                                            */
/* ------------------------------------------------------------------ */

export const CRITERIA_POINTS: Record<PassageCriterion, number> = { autonome: 20, chiffre: 15, date: 10, source: 15, reponse: 20, longueur: 10, entites: 10 };

export const CRITERIA_LABELS: Record<PassageCriterion, string> = {
  autonome: 'ne se comprend pas seul (pronom ou formule creuse en tête)',
  chiffre: 'aucun chiffre précis (prix, délai, quantité, pourcentage)',
  date: 'aucune date',
  source: 'aucune source citée ni citation attribuée',
  reponse: 'pas de réponse directe en première phrase',
  longueur: 'longueur hors de la plage utile (40–300 mots, 20 sous une question)',
  entites: 'peu de noms propres (marque, lieu, produit, norme)',
};

function properNouns(text: string): number {
  // Mots à majuscule hors début de phrase, sigles, et normes (NF, DTU, RGE…).
  let n = 0;
  for (const s of sentences(text)) {
    const words = s.split(/\s+/).slice(1);
    for (const w of words) if (/^[A-ZÀ-Ý][\p{L}'’-]{1,}/u.test(w) || /^[A-Z]{2,}\d*$/.test(w)) n++;
  }
  return n;
}

export function scorePassage(p: Passage, brand?: string | null): ScoredPassage {
  const sents = sentences(p.text);
  const first = sents[0] ?? p.text;
  const firstWords = wordCount(first);
  const brandHit = !!brand && brand.length >= 3 && p.text.toLowerCase().includes(brand.toLowerCase());
  const criteria: Record<PassageCriterion, boolean> = {
    autonome: !PRONOUN_START.test(first.trim()) && !FLUFF_START.test(first.trim()) && firstWords >= 5,
    chiffre: NUMBER_FACT.test(p.text),
    date: DATE_RE.test(p.text),
    source: p.externalLinks > 0 || SOURCE_RE.test(p.text) || QUOTE_RE.test(p.text),
    reponse:
      (p.headingIsQuestion && firstWords <= 45 && (overlap(p.heading ?? '', first) >= 0.25 || ANSWER_START.test(first) || NUMBER_FACT.test(first))) ||
      DEFINITION_RE.test(first),
    // Réponse courte sous un titre-question : 20 mots suffisent (Microsoft recommande 1 à 2 phrases).
    longueur: p.words >= (p.headingIsQuestion ? 20 : 40) && p.words <= TARGET_MAX,
    entites: brandHit || properNouns(p.text) >= 2,
  };
  const score = (Object.keys(criteria) as PassageCriterion[]).reduce((s, k) => s + (criteria[k] ? CRITERIA_POINTS[k] : 0), 0);
  const missing = (Object.keys(criteria) as PassageCriterion[]).filter((k) => !criteria[k]).map((k) => CRITERIA_LABELS[k]);
  return { ...p, score, criteria, missing };
}

/* ------------------------------------------------------------------ */
/* Section                                                             */
/* ------------------------------------------------------------------ */

export const CITABLE_MIN = 70;
export const REWRITE_MAX = 45;

export interface PassagesResult {
  section: GeoSection;
  all: ScoredPassage[];
  top: ScoredPassage[];
  toRewrite: ScoredPassage[];
}

/** Passages répétés sur plusieurs pages (bandeaux, encarts) : exclus de l'analyse. */
function dropBoilerplate(ps: Passage[]): Passage[] {
  const count = new Map<string, number>();
  for (const p of ps) count.set(p.text, (count.get(p.text) ?? 0) + 1);
  const seen = new Set<string>();
  return ps.filter((p) => {
    if ((count.get(p.text) ?? 0) >= 3) return false;
    if (seen.has(p.text)) return false;
    seen.add(p.text);
    return true;
  });
}

export function auditPassages(
  pages: GeoPage[],
  brand: string | null,
  deterministicRewrite: (p: ScoredPassage) => PassageRewrite,
  rewrites: Record<string, PassageRewrite> = {},
): PassagesResult {
  const all = dropBoilerplate(pages.flatMap(extractPassages)).map((p) => scorePassage(p, brand));
  const findings: GeoFinding[] = [];
  const withHtml = pages.filter((p) => p.parsed);
  const citable = all.filter((p) => p.score >= CITABLE_MIN);
  const top = [...citable].sort((a, b) => b.score - a.score || a.depth - b.depth || a.position - b.position).slice(0, 10);
  const weak = all.filter((p) => p.score <= REWRITE_MAX && p.words >= 40);
  const toRewrite = [...weak].sort((a, b) => a.depth - b.depth || a.position - b.position || a.score - b.score).slice(0, 10);

  if (withHtml.length && !all.length) {
    findings.push(
      finding({
        id: 'geo.passages.none',
        category: CAT,
        severity: 'high',
        title: 'Aucun passage de texte exploitable (25 mots ou plus) dans le contenu de vos pages',
        why: 'Les IA citent des passages : sans paragraphes de texte lisibles dans le HTML, elles n’ont rien à reprendre de votre site.',
        fix: 'Rédigez sur vos pages principales des paragraphes de 40 à 300 mots qui répondent aux questions de vos clients (prix, délais, zone, garanties).',
        affected: withHtml.slice(0, 20).map((p) => ({ url: p.url, detail: `${p.page.wordCount} mots` })),
        affectedCount: withHtml.length,
        impact: 3,
        effort: 2,
        evidenceLevel: 'probable',
      }),
    );
  }

  if (all.length >= 3 && weak.length / all.length > 0.5) {
    const items = toRewrite.map((p) => rewrites[p.id] ?? deterministicRewrite(p));
    findings.push(
      finding({
        id: 'geo.passages.weak',
        category: CAT,
        severity: 'medium',
        title: `${plural(weak.length, 'passage sur', 'passages sur')} ${all.length} sont peu citables (score ≤ ${REWRITE_MAX}/100)`,
        why: 'Une IA reprend plus volontiers un passage qui se comprend seul, répond directement et contient des faits précis (chiffres, dates, sources) : c’est ce qu’a mesuré l’étude GEO (KDD 2024).',
        fix: 'Réécrivez en priorité les passages listés (pages principales, haut de page) : réponse en première phrase, sujet nommé, chiffres et sources. Des réécritures sont proposées, sans fait inventé.',
        affected: weak.slice(0, 200).map((p) => ({ url: p.url, detail: `${p.score}/100 — ${p.heading ? `« ${clip(p.heading, 60)} » : ` : ''}${p.missing.slice(0, 3).join(', ')}` })),
        affectedCount: weak.length,
        impact: 2,
        effort: 2,
        evidenceLevel: 'demontre',
        autoFix: { kind: 'rewrite', payload: { items: items.map((r) => ({ url: r.url, passageId: r.passageId, before: r.before, value: r.after, mode: r.mode, notes: r.notes })) } },
      }),
    );
  }

  if (all.length >= 5) {
    const numbers = all.filter((p) => p.criteria.chiffre).length / all.length;
    if (numbers < 0.2) {
      findings.push(
        finding({
          id: 'geo.passages.no_numbers',
          category: CAT,
          severity: 'medium',
          title: `Seuls ${Math.round(numbers * 100)} % de vos passages contiennent un chiffre précis`,
          why: 'Ajouter des statistiques précises a augmenté de 31 % la visibilité d’une source dans les réponses d’un moteur génératif (étude GEO, KDD 2024).',
          fix: 'Ajoutez les chiffres que vous connaissez : prix « à partir de », délais, années d’expérience, nombre de clients ou de chantiers, garanties en années.',
          affected: all.filter((p) => !p.criteria.chiffre).slice(0, 200).map((p) => ({ url: p.url, detail: p.heading ? clip(p.heading, 80) : clip(p.text, 80) })),
          affectedCount: all.filter((p) => !p.criteria.chiffre).length,
          impact: 2,
          effort: 2,
          evidenceLevel: 'demontre',
        }),
      );
    }
    const sourced = all.filter((p) => p.criteria.source).length / all.length;
    if (sourced < 0.05 && pages.some((p) => p.page.wordCount >= 400)) {
      findings.push(
        finding({
          id: 'geo.passages.no_sources',
          category: CAT,
          severity: 'low',
          title: 'Vos contenus ne citent presque jamais de source ni de citation attribuée',
          why: 'Citer ses sources (+27 %) et ajouter des citations attribuées (+41 %) sont les méthodes les plus efficaces mesurées par l’étude GEO (KDD 2024).',
          fix: 'Sur vos guides et pages de conseil, citez la norme, l’organisme ou l’étude sur laquelle vous vous appuyez (avec lien), et des propos attribués (client, expert, dirigeant).',
          affected: pages.filter((p) => p.page.wordCount >= 400).slice(0, 50).map((p) => ({ url: p.url })),
          impact: 2,
          effort: 2,
          evidenceLevel: 'demontre',
        }),
      );
    }
    const qHeads = all.filter((p) => p.headingIsQuestion);
    const indirect = qHeads.filter((p) => !p.criteria.reponse);
    if (qHeads.length >= 2 && indirect.length / qHeads.length > 0.5) {
      findings.push(
        finding({
          id: 'geo.passages.indirect_answers',
          category: CAT,
          severity: 'medium',
          title: `${plural(indirect.length, 'question de vos pages n’a', 'questions de vos pages n’ont')} pas de réponse directe en première phrase`,
          why: 'Microsoft recommande une réponse concise en une ou deux phrases sous chaque question ; les passages cités par ChatGPT sont plus souvent définitoires et placés tôt.',
          fix: 'Sous chaque titre-question, commencez par la réponse (« Comptez 90 à 150 € pour… »), puis détaillez.',
          affected: indirect.map((p) => ({ url: p.url, detail: clip(p.heading ?? '', 100) })),
          impact: 2,
          effort: 1,
          evidenceLevel: 'probable',
        }),
      );
    }
  }

  // Pages principales sans aucun passage citable.
  const keyPages = withHtml.filter((p) => effDepth(p.page.depth) <= 1 && p.page.wordCount >= 150);
  const keyNoCitable = keyPages.filter((p) => !all.some((x) => x.url === p.url && x.score >= 60));
  if (keyPages.length >= 2 && keyNoCitable.length / keyPages.length > 0.5) {
    findings.push(
      finding({
        id: 'geo.passages.key_pages',
        category: CAT,
        severity: 'medium',
        title: `${plural(keyNoCitable.length, 'page principale n’a', 'pages principales n’ont')} aucun passage vraiment citable (score ≥ 60)`,
        why: 'Les citations viennent surtout du premier tiers des pages (44 % pour ChatGPT selon une analyse de 18 000 citations) : vos pages d’accueil et de service doivent porter l’essentiel dès le haut.',
        fix: 'En haut de chaque page de service, placez un paragraphe qui dit qui vous êtes, ce que vous faites, où, à quel prix et avec quelles garanties.',
        affected: keyNoCitable.map((p) => ({ url: p.url })),
        impact: 2,
        effort: 2,
        evidenceLevel: 'probable',
      }),
    );
  }

  const avg = all.length ? Math.round(all.reduce((s, p) => s + p.score, 0) / all.length) : 0;
  const note = withHtml.length
    ? `${plural(all.length, 'passage analysé', 'passages analysés')} sur ${plural(withHtml.length, 'page', 'pages')} ; ${citable.length} citables (≥ ${CITABLE_MIN}/100), score moyen ${avg}/100. Heuristique de rédaction, pas une mesure des citations.`
    : 'Aucun HTML conservé par l’exploration : passages non analysés.';
  return { section: section('passages', 'Contenu citable (passages)', 25, findings, note, withHtml.length > 0), all, top, toRewrite };
}
