/**
 * Pilier SOURCES (docs/v2/03-sources.md) : collecte des citations, agrégation par domaine,
 * présence du client et des concurrents (niveau 0, sans réseau), score d'opportunité et top 10.
 */
import { buildVariants, norm, normName, splitSegments, type NameVariants } from '../detect';
import { PROVIDER_LABELS, type AuditInput, type ProviderAnswer, type ProviderId, type QuerySpec, type RawSource } from '../types';
import type {
  DomainStat,
  Presence,
  Segment,
  SourceCategory,
  SourceCitation,
  SourceOpportunity,
  SourcesReport,
} from '../types-v2';
import type { UrlStat } from '../types-v3';
import {
  CATEGORY_LABEL,
  SECTOR_FALLBACKS,
  classifyDomain,
  isGeminiRedirect,
  normalizeUrl,
  tableEntry,
  DOC_CATEGORY,
  type ClassifyContext,
} from './classify';

export * from './classify';

/* ------------------------------------------------------------------ */
/* Types internes                                                      */
/* ------------------------------------------------------------------ */

/** Citation enrichie (sur-ensemble de SourceCitation du contrat). */
export interface CollectedCitation extends SourceCitation {
  urlNorm: string;
  host: string;
  label: string;
  howTo?: string;
  snippet?: string;
  kind: RawSource['kind'];
  intent?: string;
  angle?: string;
  /** entités (client = '__client__' ou nom de concurrent) nommées dans le passage qui porte la citation */
  supports: string[];
  clientPresent: boolean;
  competitorsPresent: string[];
  /** concurrent propriétaire du domaine (category = 'concurrent') */
  competitor?: string;
}

export interface SourcesContext {
  segment?: Segment;
  queries?: QuerySpec[];
  /** noms canoniques des concurrents (sinon : input.knownCompetitors) */
  competitors?: string[];
  competitorDomains?: Map<string, string>;
  /** date de mesure affichée dans la note */
  measuredAt?: string;
  /** présence vérifiée (niveau 1 déclaratif ou niveau 2 HTTP), par domaine ; prime sur l'inférence */
  presenceOverrides?: Map<string, { client: Presence; competitors?: Record<string, Presence> }>;
}

export const CLIENT_KEY = '__client__';

const PROVIDER_LABEL: Record<ProviderId, string> = PROVIDER_LABELS;

/* ------------------------------------------------------------------ */
/* Détection de noms dans un texte                                     */
/* ------------------------------------------------------------------ */

function hasWord(hay: string, needle: string): boolean {
  return !!needle && ` ${hay} `.includes(` ${needle} `);
}

/** Le client est-il nommé dans ce texte (titre, extrait, slug d'URL) ? */
export function clientNamedIn(text: string, v: NameVariants): boolean {
  const n = norm(text);
  if (!n) return false;
  const vs = [v.full, v.prefixed, ...v.alts];
  if (!v.ambiguous || v.core.length >= 6) vs.push(v.core);
  if (vs.some((x) => x && x.length >= 3 && hasWord(n, x))) return true;
  if (v.domain && n.includes(norm(v.domain))) return true;
  const compactV = v.full.replace(/\s+/g, '');
  return compactV.length >= 6 && n.replace(/\s+/g, '').includes(compactV);
}

export function competitorNamedIn(text: string, name: string): boolean {
  const n = norm(text);
  const c = normName(name);
  if (!n || !c || c.length < 3) return false;
  if (hasWord(n, c)) return true;
  const compactC = c.replace(/\s+/g, '');
  return compactC.length >= 6 && n.replace(/\s+/g, '').includes(compactC);
}

/** URL écrites dans le texte (liens markdown et URL nues). */
export function extractInlineUrls(text: string): string[] {
  const out = new Set<string>();
  const re = /\bhttps?:\/\/[^\s)\]>"'«»]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.add(m[0].replace(/[.,;:!?]+$/, ''));
  return [...out];
}

/* ------------------------------------------------------------------ */
/* Collecte                                                            */
/* ------------------------------------------------------------------ */

const akey = (a: { provider: string; queryId: string; run: number }) => `${a.provider}|${a.queryId}|${a.run}`;

/** Réponses retenues pour le pilier Sources : sans erreur, hors Gemini (CGU), hors démo si des réponses réelles existent. */
export function sourceAnswers(answers: ProviderAnswer[]): ProviderAnswer[] {
  const anyReal = answers.some((a) => !a.demo && !a.error);
  return answers.filter((a) => !a.error && a.provider !== 'gemini' && (!anyReal || !a.demo));
}

function rawSourcesOf(a: ProviderAnswer): RawSource[] {
  const base: RawSource[] = a.sources?.length ? a.sources : a.citations.map((url, i) => ({ url, kind: 'cited' as const, order: i + 1 }));
  const inline = extractInlineUrls(a.text).map((url) => ({ url, kind: 'inline' as const }));
  const all = [...base, ...inline];
  // On ne compte que les sources citées ; à défaut, les consultées (comportement V1).
  const cited = all.filter((s) => s.kind !== 'retrieved');
  return cited.length ? cited : all.map((s) => ({ ...s, kind: 'cited' as const }));
}

export interface CollectContext {
  input: AuditInput;
  variants: NameVariants;
  competitors: string[];
  classify: ClassifyContext;
  queries: Map<string, QuerySpec>;
}

export function collectCitations(answer: ProviderAnswer, c: CollectContext): CollectedCitation[] {
  if (answer.error || answer.provider === 'gemini') return [];
  const segs = splitSegments(answer.text);
  const segAt = (idx: number) => {
    let found = segs[0];
    for (const s of segs) if (s.start <= idx) found = s;
    return found;
  };
  const q = c.queries.get(answer.queryId);
  const byUrl = new Map<string, CollectedCitation>();
  const raws = rawSourcesOf(answer).sort((x, y) => (x.order ?? 999) - (y.order ?? 999));
  for (const r of raws) {
    if (isGeminiRedirect(r.url)) continue;
    const n = normalizeUrl(r.url);
    if (!n || byUrl.has(n.urlNorm)) continue;
    const cls = classifyDomain(r.url, { ...c.classify, title: r.title, snippet: r.snippet });
    const seg = r.startIndex != null && segs.length ? segAt(r.startIndex) : null;
    const supports: string[] = [];
    if (seg) {
      if (clientNamedIn(seg.text, c.variants)) supports.push(CLIENT_KEY);
      for (const comp of c.competitors) if (competitorNamedIn(seg.text, comp)) supports.push(comp);
    }
    let slug = n.path;
    try {
      slug = decodeURIComponent(n.path);
    } catch {
      /* chemin non décodable */
    }
    const evidence = [r.title ?? '', r.snippet ?? '', slug.replace(/[-_/]/g, ' ')].join(' ');
    const clientPresent = cls.category === 'client' || clientNamedIn(evidence, c.variants) || supports.includes(CLIENT_KEY);
    const competitorsPresent = c.competitors.filter(
      (comp) => cls.competitor === comp || competitorNamedIn(evidence, comp) || supports.includes(comp),
    );
    byUrl.set(n.urlNorm, {
      url: r.url,
      urlNorm: n.urlNorm,
      host: n.host,
      domain: n.domain,
      title: r.title,
      snippet: r.snippet,
      provider: answer.provider,
      queryId: answer.queryId,
      run: answer.run,
      position: 0,
      category: cls.category,
      label: cls.label,
      howTo: cls.howTo,
      kind: r.kind,
      intent: q?.intent,
      angle: q?.angle,
      supports,
      clientPresent,
      competitorsPresent,
      competitor: cls.competitor,
      _start: r.startIndex,
      _order: r.order,
    } as CollectedCitation & { _start?: number; _order?: number });
  }
  // Position (§ 3.3) : ordre des start_index, sinon ordre fourni par l'API, sinon ordre d'arrivée.
  const list = [...byUrl.values()] as (CollectedCitation & { _start?: number; _order?: number })[];
  list
    .map((x, i) => ({ x, k: x._start ?? (x._order != null ? 1e6 + x._order : 2e6 + i) }))
    .sort((a, b) => a.k - b.k)
    .forEach(({ x }, i) => (x.position = i + 1));
  return list.map(({ _start, _order, ...rest }) => {
    void _start;
    void _order;
    return rest;
  });
}

/* ------------------------------------------------------------------ */
/* Agrégation (§ 6.1)                                                  */
/* ------------------------------------------------------------------ */

export interface DomainAgg {
  stat: DomainStat;
  citedAnswers: number;
  citedRate: number;
  providerCoverage: number;
  topPositions: number;
  avgPosition: number | null;
  intents: string[];
  angles: string[];
  howTo?: string;
  sampleQueries: string[];
}

export function aggregateDomains(cits: CollectedCitation[], answersWithSources: number, providersWithSources: number): DomainAgg[] {
  const groups = new Map<string, CollectedCitation[]>();
  for (const c of cits) {
    const arr = groups.get(c.domain);
    if (arr) arr.push(c);
    else groups.set(c.domain, [c]);
  }
  const total = cits.length;
  const out: DomainAgg[] = [];
  for (const [domain, cs] of groups) {
    const first = cs[0];
    const answers = new Set(cs.map(akey));
    const providers = [...new Set(cs.map((c) => c.provider))];
    const urlCount = new Map<string, number>();
    for (const c of cs) urlCount.set(c.urlNorm, (urlCount.get(c.urlNorm) ?? 0) + 1);
    const positions = cs.map((c) => c.position).filter((p) => p > 0);
    const topByAnswer = new Set(cs.filter((c) => c.position > 0 && c.position <= 2).map(akey));
    const clientPresent = cs.some((c) => c.clientPresent);
    const comps = [...new Set(cs.flatMap((c) => c.competitorsPresent))];
    const hasEvidence = cs.some((c) => c.title || c.snippet || c.supports.length);
    const clientPresence: Presence =
      first.category === 'client' || clientPresent ? 'present' : comps.length && hasEvidence ? 'absent' : 'unknown';
    const cat: SourceCategory = cs.some((c) => c.category === 'client') ? 'client' : first.category;
    out.push({
      stat: {
        domain,
        label: first.label,
        category: cat,
        citations: cs.length,
        citationShare: total ? cs.length / total : 0,
        providers,
        queries: [...new Set(cs.map((c) => c.queryId))],
        clientPresence,
        competitorsPresent: first.category === 'concurrent' ? comps.filter((x) => x !== first.competitor) : comps,
        sampleUrls: [...urlCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([u]) => u),
      },
      citedAnswers: answers.size,
      citedRate: answersWithSources ? answers.size / answersWithSources : 0,
      providerCoverage: providersWithSources ? providers.length / providersWithSources : 0,
      topPositions: topByAnswer.size,
      avgPosition: positions.length ? positions.reduce((a, b) => a + b, 0) / positions.length : null,
      intents: [...new Set(cs.map((c) => c.intent).filter((x): x is string => !!x))],
      angles: [...new Set(cs.map((c) => c.angle).filter((x): x is string => !!x))],
      howTo: cs.find((c) => c.howTo)?.howTo,
      sampleQueries: [...new Set(cs.map((c) => c.queryId))],
    });
  }
  return out.sort((a, b) => b.stat.citations - a.stat.citations || a.stat.domain.localeCompare(b.stat.domain));
}

/* ------------------------------------------------------------------ */
/* Opportunités (§ 6.2 – 6.4)                                          */
/* ------------------------------------------------------------------ */

type WCat = Exclude<SourceCategory, never>;
export const CATEGORY_WEIGHT: Record<Segment, Record<WCat, number>> = {
  local: { annuaire: 1, avis: 1, media_national: 0.5, media_local: 0.9, comparatif: 0.7, forum: 0.5, marketplace: 0.3, reseau_social: 0.6, concurrent: 0, client: 0, wikipedia: 0.2, institutionnel: 0.4, autre: 0.3 },
  pme: { annuaire: 0.6, avis: 0.9, media_national: 0.8, media_local: 0.4, comparatif: 1, forum: 0.8, marketplace: 0.4, reseau_social: 0.7, concurrent: 0, client: 0, wikipedia: 0.5, institutionnel: 0.4, autre: 0.3 },
  ecommerce: { annuaire: 0.3, avis: 0.9, media_national: 0.8, media_local: 0.3, comparatif: 1, forum: 0.9, marketplace: 1, reseau_social: 0.8, concurrent: 0, client: 0, wikipedia: 0.4, institutionnel: 0.2, autre: 0.3 },
};

export const FEASIBILITY: Record<SourceCategory, number> = {
  annuaire: 1, avis: 0.8, reseau_social: 0.9, marketplace: 0.6, forum: 0.5, comparatif: 0.4, media_local: 0.4,
  institutionnel: 0.3, autre: 0.3, media_national: 0.15, wikipedia: 0.05, concurrent: 0, client: 0,
};

export const ABSENCE = { gap: 1, gapUnknown: 0.8, absent: 0.85, unknown: 0.6, present: 0 } as const;

/** Intentions / angles prioritaires par segment (× 1,15). */
const PRIORITY: Record<Segment, string[]> = {
  local: ['best', 'nearby'],
  pme: ['comparison', 'alternative'],
  ecommerce: ['comparison', 'alternative'],
};

const PAID_RE = /payant|commission|abonnement|\bCPC\b|au clic|leads? payants?|mise en relation payante|au lead/i;
const UNCERTAIN_RE = /qualification|qualiopi|\bRGE\b|certifi|ordre|labellis|candidature|sélecti|selecti|inscrits|registre/i;

interface CategoryAction {
  verb: string;
  steps: string[];
}

export const CATEGORY_ACTIONS: Record<SourceCategory, CategoryAction> = {
  annuaire: {
    verb: "S'inscrire sur",
    steps: [
      'Créez ou revendiquez votre fiche (gratuite le plus souvent).',
      'Reprenez exactement le même nom, la même adresse et le même téléphone que sur votre site et Google.',
      'Complétez catégories, services, horaires, photos et lien vers votre site.',
    ],
  },
  avis: {
    verb: 'Obtenir des avis sur',
    steps: [
      'Revendiquez votre page entreprise.',
      'Demandez un avis à chaque client réel, sans filtrage ni contrepartie (QR code, e-mail après la prestation).',
      'Répondez à tous les avis, positifs comme négatifs.',
    ],
  },
  comparatif: {
    verb: 'Être ajouté au comparatif',
    steps: [
      "Contactez l'auteur avec un argumentaire factuel (prix, différences, preuves).",
      'Sur les plateformes à profil (Capterra, Appvizer, AlternativeTo), créez le profil et collectez des avis.',
      'Proposez un accès ou un produit de test si pertinent ; toute place payante doit être signalée « sponsorisé ».',
    ],
  },
  media_local: {
    verb: 'Proposer un sujet à',
    steps: [
      "Trouvez un angle d'actualité locale (ouverture, anniversaire, recrutement, événement, chiffre).",
      'Rédigez un communiqué court avec des photos.',
      'Envoyez-le au journaliste de la rubrique de votre ville (sans garantie de publication).',
    ],
  },
  media_national: {
    verb: 'Proposer une expertise à',
    steps: [
      "Repérez l'auteur de la page citée.",
      "Proposez une donnée exclusive ou un avis d'expert.",
      "Diffusez un communiqué seulement s'il y a une vraie actualité (sans garantie de publication).",
    ],
  },
  forum: {
    verb: 'Répondre sur',
    steps: [
      'Utilisez un compte identifié (« je travaille chez… »).',
      "Apportez des réponses utiles, sans lien dans un premier temps.",
      'Respectez les règles du forum : jamais de faux comptes ni de votes achetés (Repéré rédige un brouillon, vous publiez).',
    ],
  },
  marketplace: {
    verb: 'Vous référencer sur',
    steps: [
      'Ouvrez un compte vendeur après avoir calculé votre marge (commissions).',
      'Publiez des fiches complètes : titres explicites, attributs, photos, GTIN.',
      'Collectez des avis acheteurs réels.',
    ],
  },
  reseau_social: {
    verb: 'Compléter votre présence sur',
    steps: [
      'Profil professionnel complet : nom, adresse, catégorie, lien vers le site.',
      'Publiez 4 contenus utiles par mois.',
      "Sur YouTube et LinkedIn, privilégiez les contenus d'expertise.",
    ],
  },
  wikipedia: {
    verb: 'Vérifier votre admissibilité à',
    steps: [
      "Vérifiez les critères d'admissibilité (sources secondaires indépendantes).",
      'Si admissible, passez par la page de discussion en déclarant votre conflit d’intérêts.',
      'Sinon, visez Wikidata ou les médias ; ne rédigez jamais votre propre page.',
    ],
  },
  institutionnel: {
    verb: 'Vous faire référencer par',
    steps: [
      "Vérifiez votre éligibilité réelle (RGE, Qualiopi, CCI, CMA, office de tourisme…).",
      'Constituez le dossier.',
      'Mettez à jour la fiche officielle.',
    ],
  },
  autre: {
    verb: 'Analyser',
    steps: ['Lisez la page citée.', 'Identifiez qui y est mentionné et pourquoi.', 'Décidez au cas par cas (contact, contenu équivalent sur votre site).'],
  },
  concurrent: { verb: 'Analyser', steps: [] },
  client: { verb: 'Consolider', steps: [] },
};

export function howToFor(category: SourceCategory, howToGetListed?: string): string[] {
  const steps = [...CATEGORY_ACTIONS[category].steps];
  if (howToGetListed) steps[0] = howToGetListed;
  return steps.slice(0, 3);
}

function listFr(xs: string[]): string {
  if (xs.length <= 1) return xs.join('');
  return `${xs.slice(0, -1).join(', ')} et ${xs[xs.length - 1]}`;
}

function pct(x: number): string {
  return `${Math.round(x * 100)} %`;
}

export interface ScoredOpportunity extends SourceOpportunity {
  factors: { F: number; W: number; A: number; X: number };
  gap: boolean;
  fallback?: boolean;
}

/** Enseignes et revendeurs multimarques : on y entre par un acheteur (des mois), pas par une inscription. */
export const RETAILER_DOMAIN_RE =
  /(^|\.)(sephora|nocibe|marionnaud|notino|lookfantastic|fnac|darty|boulanger|decathlon|leroymerlin|castorama|laredoute|galerieslafayette|printemps|carrefour|auchan|monoprix|intermarche|conforama|but|maisonsdumonde|greenweez|lafourche|naturalia|biocoop|cocooncenter|easyparapharmacie|pharmacie-lafayette|pharma-gdd|mademoiselle-bio|oh-my-cream|nature-et-decouvertes|natureetdecouvertes|kiabi|ldlc|cultura|jardiland|truffaut|botanic)\.[a-z.]+$/;

/**
 * Canal de vente (marketplace ou revendeur) : ce n'est pas un annuaire. Revendeur → dossier acheteur, effort L ;
 * marketplace → compte vendeur (frais, logistique), effort M au minimum.
 */
export function sellingChannel(domain: string, label: string): { kind: 'retailer' | 'marketplace'; action: string; effort: 'M' | 'L'; howTo: string[] } {
  if (RETAILER_DOMAIN_RE.test(domain.toLowerCase())) {
    return {
      kind: 'retailer',
      action: `Préparer un dossier acheteur pour ${label}`,
      effort: 'L',
      howTo: [
        `Une enseigne comme ${label} référence des marques par ses acheteurs : comptez plusieurs mois, sans garantie.`,
        'Préparez une fiche marque d’une page : faits vérifiés, labels, prix publics, points de vente actuels, chiffres de vente si vous acceptez de les partager.',
        'Trouvez le bon interlocuteur (salon professionnel, programme « nouvelles marques », agent commercial) avant d’envoyer quoi que ce soit.',
      ],
    };
  }
  return {
    kind: 'marketplace',
    action: `Étudier la vente sur ${label} (compte vendeur)`,
    effort: 'M',
    howTo: [
      `${label} est un canal de vente, pas un annuaire : compte vendeur, commissions et abonnement, logistique (expédition par vous ou par la plateforme).`,
      'Calculez votre marge après frais avant d’ouvrir le compte.',
      'Si vous y allez : fiches complètes (titre explicite, attributs, photos, GTIN) et avis acheteurs réels.',
    ],
  };
}

export function scoreOpportunity(
  agg: DomainAgg,
  segment: Segment,
  answersWithSources: number,
  queryText: (id: string) => string | undefined,
): ScoredOpportunity | null {
  const s = agg.stat;
  if (s.category === 'client' || s.category === 'concurrent') return null;
  let F = 0.7 * Math.sqrt(Math.min(1, agg.citedRate / 0.3)) + 0.3 * agg.providerCoverage;
  if (agg.citedAnswers < 2) F *= 0.5;
  if (agg.topPositions >= 2) F = Math.min(1, F + 0.1);
  let W = CATEGORY_WEIGHT[segment][s.category] ?? 0.3;
  const prio = PRIORITY[segment];
  if ([...agg.intents, ...agg.angles].some((i) => prio.includes(i))) W = Math.min(1, W * 1.15);
  const comps = s.competitorsPresent;
  const A =
    s.clientPresence === 'present'
      ? ABSENCE.present
      : comps.length && s.clientPresence === 'absent'
        ? ABSENCE.gap
        : comps.length
          ? ABSENCE.gapUnknown
          : s.clientPresence === 'absent'
            ? ABSENCE.absent
            : ABSENCE.unknown;
  const howTo = agg.howTo ?? tableEntry(s.domain)?.howToGetListed;
  let X = FEASIBILITY[s.category] * (howTo ? 1.1 : 1) * (howTo && PAID_RE.test(howTo) ? 0.7 : 1);
  if (s.category === 'wikipedia' || s.category === 'institutionnel' || (howTo && UNCERTAIN_RE.test(howTo))) X *= 0.5;
  X = Math.min(1, X);
  const score = Math.round(100 * F * W * A * X);
  if (score <= 0) return null;
  const effort: SourceOpportunity['effort'] = X >= 0.8 ? 'S' : X >= 0.4 ? 'M' : 'L';
  const providers = listFr(s.providers.map((p) => PROVIDER_LABEL[p]));
  const q = agg.sampleQueries.map(queryText).find(Boolean);
  let why = `Cité dans ${agg.citedAnswers} réponse${agg.citedAnswers > 1 ? 's' : ''} sur ${answersWithSources} (${pct(agg.citedRate)}), par ${providers}`;
  if (agg.avgPosition != null && agg.avgPosition <= 2.5) why += ', souvent parmi les premières sources';
  why += q ? `, notamment pour « ${q} ».` : '.';
  if (comps.length) {
    const names = listFr(comps.slice(0, 3));
    why += ` ${names} ${comps.length > 1 ? 'y apparaissent' : 'y apparaît'}`;
    why += s.clientPresence === 'absent' ? ' ; pas vous.' : ' ; votre présence reste à vérifier.';
  } else if (s.clientPresence === 'unknown') {
    why += ` Présence à vérifier : cherchez votre nom sur ${s.label}.`;
  }
  const sell = s.category === 'marketplace' ? sellingChannel(s.domain, s.label) : null;
  return {
    domain: s.domain,
    label: s.label,
    category: s.category,
    score,
    why,
    action: sell?.action ?? `${CATEGORY_ACTIONS[s.category].verb} ${s.label}`,
    howTo: sell?.howTo ?? howToFor(s.category, howTo),
    effort: sell?.effort ?? effort,
    impact: 1,
    competitorsPresent: comps,
    factors: { F, W, A, X },
    gap: comps.length > 0 && s.clientPresence !== 'present',
  };
}

function fallbackOpportunity(domain: string, segment: Segment): ScoredOpportunity | null {
  const e = tableEntry(domain);
  if (!e) return null;
  const category = DOC_CATEGORY[e.category] ?? 'autre';
  const W = CATEGORY_WEIGHT[segment][category] ?? 0.3;
  let X = FEASIBILITY[category] * (e.howToGetListed ? 1.1 : 1) * (e.howToGetListed && PAID_RE.test(e.howToGetListed) ? 0.7 : 1);
  X = Math.min(1, X);
  const F = 0.15;
  const A = ABSENCE.unknown;
  const score = Math.max(1, Math.round(100 * F * W * A * X));
  return {
    domain,
    label: e.label,
    category,
    score,
    why: `Source de référence pour votre secteur, non citée dans cet audit : recommandée pour renforcer votre présence.`,
    action: (category === 'marketplace' ? sellingChannel(domain, e.label)?.action : undefined) ?? `${CATEGORY_ACTIONS[category].verb} ${e.label}`,
    howTo: (category === 'marketplace' ? sellingChannel(domain, e.label)?.howTo : undefined) ?? howToFor(category, e.howToGetListed),
    effort: (category === 'marketplace' ? sellingChannel(domain, e.label)?.effort : undefined) ?? (X >= 0.8 ? 'S' : X >= 0.4 ? 'M' : 'L'),
    impact: 1,
    competitorsPresent: [],
    factors: { F, W, A, X },
    gap: false,
    fallback: true,
  };
}

/** Sélection du top 10 (§ 7.1) : diversité, victoire rapide, compléments sectoriels, impact en tertiles. */
export function pickTop10(opps: ScoredOpportunity[], segment: Segment, max = 10, seenDomains: Set<string> = new Set()): ScoredOpportunity[] {
  const sorted = [...opps].sort((a, b) => b.score - a.score || a.domain.localeCompare(b.domain));
  const out: ScoredOpportunity[] = [];
  const perCat = new Map<SourceCategory, number>();
  const doms = new Set<string>();
  for (const o of sorted) {
    if (out.length >= max) break;
    if (doms.has(o.domain) || (perCat.get(o.category) ?? 0) >= 3) continue;
    out.push(o);
    doms.add(o.domain);
    perCat.set(o.category, (perCat.get(o.category) ?? 0) + 1);
  }
  if (out.length >= 3 && !out.slice(0, 3).some((o) => o.effort === 'S')) {
    const idx = out.findIndex((o, i) => i >= 3 && o.effort === 'S');
    if (idx > 0) {
      const [q] = out.splice(idx, 1);
      out.splice(2, 0, q);
    }
  }
  // Impact : tertiles de F × W (minimum 2 étoiles si gap).
  const fw = out.map((o) => o.factors.F * o.factors.W).sort((a, b) => a - b);
  const t1 = fw[Math.floor(fw.length / 3)] ?? 0;
  const t2 = fw[Math.floor((2 * fw.length) / 3)] ?? 0;
  for (const o of out) {
    const v = o.factors.F * o.factors.W;
    let impact: 1 | 2 | 3 = v >= t2 && fw.length > 1 ? 3 : v >= t1 && fw.length > 1 ? 2 : fw.length === 1 ? 3 : 1;
    if (o.gap && impact < 2) impact = 2;
    o.impact = impact;
  }
  for (const d of SECTOR_FALLBACKS[segment]) {
    if (out.length >= max) break;
    if (doms.has(d) || seenDomains.has(d)) continue;
    const f = fallbackOpportunity(d, segment);
    if (f) {
      out.push(f);
      doms.add(d);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Citations URL par URL (V3)                                          */
/* ------------------------------------------------------------------ */

/**
 * Agrégat URL par URL : une ligne par URL normalisée, avec IA, questions, nombre de citations (une par réponse),
 * meilleure position et présence du client et des concurrents sur la page. Trié par citations décroissantes.
 */
export function aggregateUrls(
  cits: CollectedCitation[],
  overrides?: SourcesContext['presenceOverrides'],
  max = 300,
): UrlStat[] {
  const groups = new Map<string, CollectedCitation[]>();
  for (const c of cits) {
    const arr = groups.get(c.urlNorm);
    if (arr) arr.push(c);
    else groups.set(c.urlNorm, [c]);
  }
  const out: UrlStat[] = [];
  for (const cs of groups.values()) {
    const first = cs[0];
    const positions = cs.map((c) => c.position).filter((p) => p > 0);
    const o = overrides?.get(first.domain);
    const extra = Object.entries(o?.competitors ?? {}).filter(([, p]) => p === 'present').map(([n]) => n);
    out.push({
      url: first.url,
      title: cs.find((c) => c.title)?.title,
      domain: first.domain,
      category: first.category,
      providers: [...new Set(cs.map((c) => c.provider))],
      queries: [...new Set(cs.map((c) => c.queryId))],
      citations: new Set(cs.map(akey)).size,
      bestPosition: positions.length ? Math.min(...positions) : null,
      clientPresent: first.category === 'client' || cs.some((c) => c.clientPresent) || o?.client === 'present',
      competitorsPresent: [...new Set([...cs.flatMap((c) => c.competitorsPresent), ...extra])],
    });
  }
  return out
    .sort((a, b) => b.citations - a.citations || (a.bestPosition ?? 99) - (b.bestPosition ?? 99) || a.url.localeCompare(b.url))
    .slice(0, max);
}

/* ------------------------------------------------------------------ */
/* Rapport                                                             */
/* ------------------------------------------------------------------ */

export interface SourcesAnalysis {
  report: SourcesReport;
  citations: CollectedCitation[];
  aggs: DomainAgg[];
  opportunities: ScoredOpportunity[];
  answersWithSources: number;
}

function defaultCompetitors(input: AuditInput, ctx: SourcesContext): string[] {
  return [...new Set([...(ctx.competitors ?? []), ...(input.knownCompetitors ?? [])].filter(Boolean))];
}

export function analyzeSources(answers: ProviderAnswer[], input: AuditInput, ctx: SourcesContext = {}): SourcesAnalysis {
  const segment: Segment = ctx.segment ?? input.segment ?? 'local';
  const variants = buildVariants(input);
  const competitors = defaultCompetitors(input, ctx);
  const queries = new Map((ctx.queries ?? []).map((q) => [q.id, q]));
  const pool = sourceAnswers(answers).filter((a) => queries.get(a.queryId)?.kind !== 'brand');
  const collect: CollectContext = {
    input,
    variants,
    competitors,
    queries,
    classify: { clientDomain: variants.domain, clientName: input.businessName, competitors, competitorDomains: ctx.competitorDomains },
  };
  const perAnswer = pool.map((a) => collectCitations(a, collect));
  const citations = perAnswer.flat();
  const answersWithSources = perAnswer.filter((c) => c.length > 0).length;
  const providersWithSources = new Set(pool.filter((_, i) => perAnswer[i].length > 0).map((a) => a.provider)).size;
  const aggs = aggregateDomains(citations, answersWithSources, providersWithSources);
  for (const a of aggs) {
    const o = ctx.presenceOverrides?.get(a.stat.domain);
    if (!o) continue;
    if (o.client !== 'unknown' && a.stat.category !== 'client') a.stat.clientPresence = o.client;
    const extra = Object.entries(o.competitors ?? {}).filter(([, p]) => p === 'present').map(([n]) => n);
    a.stat.competitorsPresent = [...new Set([...a.stat.competitorsPresent, ...extra])];
  }
  const qText = (id: string) => queries.get(id)?.text;
  const scored = aggs
    .map((a) => scoreOpportunity(a, segment, answersWithSources, qText))
    .filter((x): x is ScoredOpportunity => !!x);
  const top = pickTop10(scored, segment, 10, new Set(aggs.map((a) => a.stat.domain)));
  const byCategory: Partial<Record<SourceCategory, number>> = {};
  for (const c of citations) byCategory[c.category] = (byCategory[c.category] ?? 0) + 1;
  const date = new Date(ctx.measuredAt ?? Date.now()).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' });
  const usedGemini = answers.some((a) => a.provider === 'gemini' && !a.error);
  const notes: string[] = [];
  const grounded = [...new Set(pool.map((a) => a.provider))].map((p) => PROVIDER_LABEL[p]);
  const groundedList = grounded.length ? listFr(grounded) : 'ChatGPT, Perplexity et Claude';
  notes.push(`Sources relevées via les API officielles de ${groundedList} le ${date}.`);
  if (usedGemini) notes.push("Gemini est interrogé sans ancrage : il n'apporte pas de sources (utilisé pour la perception et la vérité).");
  if (!citations.length) notes.push('Aucune source citée dans cet audit : les compléments sont des sources de référence du secteur.');
  notes.push("Les sources citées varient d'un mois à l'autre : elles indiquent une tendance, sans garantie.");
  const report: SourcesReport = {
    totalCitations: citations.length,
    domains: aggs.map((a) => a.stat),
    byCategory,
    opportunities: top.map(({ factors, gap, fallback, ...o }) => {
      void factors;
      void gap;
      void fallback;
      return o;
    }),
    clientCitedCount: citations.filter((c) => c.category === 'client').length,
    note: notes.join(' '),
    urls: aggregateUrls(citations, ctx.presenceOverrides),
  };
  return { report, citations, aggs, opportunities: top, answersWithSources };
}

/** Contrat V2 : rapport Sources à partir des réponses (sans réseau). */
export function buildSourcesReport(answers: ProviderAnswer[], input: AuditInput, ctx: SourcesContext = {}): SourcesReport {
  return analyzeSources(answers, input, ctx).report;
}

export { CATEGORY_LABEL as SOURCE_CATEGORY_LABEL };
