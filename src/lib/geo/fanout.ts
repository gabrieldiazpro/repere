/**
 * Couverture des questions : « query fan-out ».
 * Google décrit le fait que ses fonctions IA lancent plusieurs recherches liées par sous-thème. On décompose les questions
 * clients en sous-questions (fournisseur d'IA configuré, sinon gabarits par type de site, étiquetés), puis on cherche
 * pour chacune le meilleur passage du site : couverte, partielle ou absente.
 */
import type { FactsInput, FanOutFacet, FanOutResult, GeoFinding, GeoSection, GeoSiteType, ScoredPassage, SubQuestion, SubQuestionCoverage } from './types';
import { generateJsonLd } from '@/lib/siteaudit/jsonld';
import { clip, finding, overlap, plural, section, stableId } from './util';
import { parseJson, withTimeout, type GeoLlm } from './llm';

const CAT = 'geo.questions';

/** Mots qui signalent qu'un passage traite la facette, et preuve qu'il y répond (chiffre, liste…). */
const FACETS: Record<FanOutFacet, { lex: RegExp; proof?: RegExp; label: string }> = {
  prix: { lex: /(prix|tarif|co[uû]t|combien|devis|€|euros?|forfait|à partir de)/i, proof: /(\d[\d\s.,]*\s?(€|euros?|eur\b|ht\b|ttc\b))|(€\s?\d)|sur devis|devis gratuit/i, label: 'Prix' },
  delai: { lex: /(délai|delai|sous \d|dans les \d|rapide|combien de temps|durée|jours?|heures?|semaines?)/i, proof: /\b\d+\s?(h\b|heures?|jours?|semaines?|min|minutes?)|24\s?h|48\s?h|le jour même/i, label: 'Délais' },
  zone: { lex: /(zone|secteur|intervenons|intervient|déplacement|alentours|communes?|départements?|région|livrons|livraison en|partout en)/i, proof: /\b\d{2,5}\b|[A-ZÀ-Ý][\p{L}-]+(,\s*[A-ZÀ-Ý][\p{L}-]+){1,}/u, label: 'Zone desservie' },
  urgence: { lex: /(urgence|urgent|24\s?h|7\s?j|7\/7|dimanche|week-end|soir|nuit|jours fériés)/i, label: 'Urgences' },
  horaires: { lex: /(horaires?|ouvert|ouverture|fermé|lundi|mardi|samedi|dimanche|\d{1,2}\s?h\s?\d{0,2}\s?[-–à]\s?\d{1,2}\s?h)/i, proof: /\d{1,2}\s?h/i, label: 'Horaires' },
  contact: { lex: /(contact|appelez|téléphone|joindre|écrivez|formulaire|e-mail|email|rendez-vous)/i, proof: /(\d{2}[\s.]?){5}|@/i, label: 'Contact' },
  garanties: { lex: /(garantie|garanti|assurance|décennale|certifi|label|rge|qualibat|qualifelec|norme|agréé|agrément|iso\s?\d)/i, label: 'Garanties et certifications' },
  avis: { lex: /(avis|témoignages?|clients satisfaits|note|étoiles|recommand|google|trustpilot)/i, proof: /\d([.,]\d)?\s?\/\s?5|\d+\s?avis|★/i, label: 'Avis clients' },
  choix: { lex: /(choisir|critères|comparer|bien choisir|conseils?|quel .* choisir|que vérifier)/i, label: 'Comment choisir' },
  etapes: { lex: /(étapes?|déroul|processus|méthode|comment ça marche|d['’]abord|ensuite|enfin|1\.|première étape)/i, label: 'Déroulé' },
  cible: { lex: /(pour qui|destiné|s['’]adresse|clients?|entreprises|particuliers|professionnels|tpe|pme|secteurs?)/i, label: 'À qui s’adresse l’offre' },
  references: { lex: /(références?|clients?|cas client|étude de cas|ils nous font confiance|réalisations|portfolio|projets)/i, label: 'Références' },
  comparaison: { lex: /(versus|vs\.?|comparé|comparaison|différence|alternative|plutôt que|contrairement|avantages?)/i, label: 'Comparaison' },
  livraison: { lex: /(livraison|livré|expédi|colis|frais de port|transporteur|retrait|click)/i, proof: /\b\d+\s?(jours?|h\b|heures?|€)|offerte|gratuite/i, label: 'Livraison' },
  retours: { lex: /(retour|rembours|échange|rétractation|satisfait ou remboursé)/i, proof: /\b\d+\s?jours?/i, label: 'Retours' },
  caracteristiques: { lex: /(composition|matière|matériau|dimensions?|taille|poids|caractéristiques|fiche technique|ingrédients|fabriqué)/i, proof: /\d/, label: 'Caractéristiques' },
  paiement: { lex: /(paiement|payer|carte bancaire|cb\b|paypal|virement|en \d+ fois|chèque)/i, label: 'Paiement' },
  origine: { lex: /(origine|fabriqué en|made in|provenance|produit en|local|artisanal)/i, label: 'Origine, fabrication' },
  autre: { lex: /$^/, label: 'Autre' },
};

const TEMPLATES: Record<GeoSiteType, { facet: FanOutFacet; q: string }[]> = {
  local: [
    { facet: 'prix', q: 'Combien coûte {service} {ville} ?' },
    { facet: 'delai', q: 'En combien de temps {sujet} peut-il intervenir ?' },
    { facet: 'zone', q: 'Dans quelles communes {sujet} intervient-il ?' },
    { facet: 'urgence', q: '{sujet} intervient-il en urgence, le soir ou le week-end ?' },
    { facet: 'horaires', q: 'Quels sont les horaires de {sujet} ?' },
    { facet: 'contact', q: 'Comment contacter {sujet} ?' },
    { facet: 'garanties', q: '{sujet} est-il assuré ou certifié ?' },
    { facet: 'avis', q: 'Que disent les avis clients sur {sujet} ?' },
    { facet: 'choix', q: 'Comment choisir {unmetier} {ville} ?' },
    { facet: 'etapes', q: 'Comment se déroule une prestation de {sujet} ?' },
  ],
  pme: [
    { facet: 'prix', q: 'Quels sont les tarifs de {sujet} ?' },
    { facet: 'cible', q: 'À quelles entreprises s’adresse {sujet} ?' },
    { facet: 'references', q: 'Quels clients ou références {sujet} peut-il citer ?' },
    { facet: 'etapes', q: 'Comment se déroule la mise en place avec {sujet} ?' },
    { facet: 'delai', q: 'Quels sont les délais de mise en place avec {sujet} ?' },
    { facet: 'comparaison', q: 'Quelles différences entre {sujet} et ses concurrents ?' },
    { facet: 'garanties', q: 'Quelles certifications ou garanties propose {sujet} ?' },
    { facet: 'zone', q: 'Où est basé {sujet} et quelles zones couvre-t-il ?' },
    { facet: 'avis', q: 'Que disent les clients de {sujet} ?' },
    { facet: 'contact', q: 'Comment obtenir un devis ou une démonstration de {sujet} ?' },
  ],
  ecommerce: [
    { facet: 'prix', q: 'Quels sont les prix des produits de {sujet} ?' },
    { facet: 'livraison', q: 'Quels sont les délais et frais de livraison de {sujet} ?' },
    { facet: 'retours', q: 'Comment retourner un produit acheté chez {sujet} ?' },
    { facet: 'caracteristiques', q: 'De quoi sont faits les produits de {sujet} ?' },
    { facet: 'origine', q: 'Où sont fabriqués les produits de {sujet} ?' },
    { facet: 'avis', q: 'Que disent les avis clients sur {sujet} ?' },
    { facet: 'paiement', q: 'Quels moyens de paiement accepte {sujet} ?' },
    { facet: 'garanties', q: 'Quelle garantie offre {sujet} sur ses produits ?' },
    { facet: 'choix', q: 'Comment choisir le bon produit chez {sujet} ?' },
    { facet: 'comparaison', q: '{sujet} ou une autre marque : quelles différences ?' },
  ],
};

export interface FanOutSeedContext {
  siteType: GeoSiteType;
  brand?: string | null;
  trade?: string;
  city?: string;
}

export function defaultSeeds(ctx: FanOutSeedContext): string[] {
  const sujet = ctx.brand || 'votre entreprise';
  const trade = ctx.trade?.trim();
  const ville = ctx.city ? ` à ${ctx.city}` : '';
  if (ctx.siteType === 'local') return [trade ? `Quel ${trade} choisir${ville} ?` : `Que propose ${sujet}${ville} ?`];
  if (ctx.siteType === 'ecommerce') return [trade ? `Où acheter ${trade} en ligne ?` : `Que vend ${sujet} ?`];
  return [trade ? `Quel prestataire de ${trade} choisir ?` : `Que propose ${sujet} ?`];
}

/** Sous-questions par gabarits (sans IA). */
export function templateFanOut(seeds: string[], ctx: FanOutSeedContext): SubQuestion[] {
  const sujet = ctx.brand || 'cette entreprise';
  const trade = ctx.trade?.trim();
  const service = trade ? `l’intervention d’un ${trade}` : `une prestation de ${sujet}`;
  const unmetier = trade ? `un ${trade}` : 'un prestataire';
  const ville = ctx.city ? `à ${ctx.city}` : '';
  const seed = seeds[0] ?? defaultSeeds(ctx)[0];
  return TEMPLATES[ctx.siteType].map((t) => {
    const question = t.q
      .replace('{sujet}', sujet)
      .replace('{service}', service)
      .replace('{unmetier}', unmetier)
      .replace('{ville}', ville)
      .replace(/\s+\?/, ' ?')
      .replace(/\s{2,}/g, ' ')
      .replace(/^./, (c) => c.toUpperCase());
    return { id: stableId('fo', question), question, facet: t.facet, seed, source: 'modele' as const };
  });
}

const FACET_KEYS = Object.keys(FACETS) as FanOutFacet[];

/** Facette d'une sous-question libre (IA) d'après son texte. */
export function guessFacet(q: string): FanOutFacet {
  for (const f of FACET_KEYS) if (f !== 'autre' && FACETS[f].lex.test(q)) return f;
  return 'autre';
}

/** Sous-questions générées par le fournisseur d'IA ; repli sur les gabarits. Ne lève jamais. */
export async function generateFanOut(seeds: string[], ctx: FanOutSeedContext, llm: GeoLlm | null, timeoutMs = 20_000): Promise<SubQuestion[]> {
  const base = seeds.length ? seeds : defaultSeeds(ctx);
  if (!llm) return templateFanOut(base, ctx);
  const system = [
    'Tu simules la décomposition (« query fan-out ») qu’un moteur de réponse IA fait d’une question en recherches plus précises.',
    'Pour chaque question, donne 6 à 10 sous-questions concrètes, en français, que le moteur chercherait pour répondre :',
    'prix, délais, zone, garanties, avis, comparaison, étapes, critères de choix… selon le sujet. Pas de doublons, pas de marques inventées.',
    `Facettes possibles : ${FACET_KEYS.join(', ')}.`,
    'Réponds en JSON : {"items": [{"seed": "question d’origine", "question": "sous-question", "facet": "prix"}]}',
  ].join(' ');
  const user = JSON.stringify({ questions: base.slice(0, 5), entreprise: ctx.brand ?? undefined, activite: ctx.trade, ville: ctx.city, type_de_site: ctx.siteType });
  try {
    const out = parseJson<{ items?: { seed?: unknown; question?: unknown; facet?: unknown }[] }>(await withTimeout(llm.completeJson(system, user), timeoutMs));
    const seen = new Set<string>();
    const items: SubQuestion[] = [];
    for (const it of out?.items ?? []) {
      const q = typeof it.question === 'string' ? it.question.replace(/\s+/g, ' ').trim() : '';
      if (q.length < 8 || q.length > 200 || seen.has(q.toLowerCase())) continue;
      seen.add(q.toLowerCase());
      const facet = typeof it.facet === 'string' && (FACET_KEYS as string[]).includes(it.facet) ? (it.facet as FanOutFacet) : guessFacet(q);
      const seed = typeof it.seed === 'string' && it.seed.trim() ? it.seed.trim() : base[0];
      items.push({ id: stableId('fo', q), question: q, facet, seed, source: 'ia' });
      if (items.length >= 40) break;
    }
    return items.length >= 3 ? items : templateFanOut(base, ctx);
  } catch {
    return templateFanOut(base, ctx);
  }
}

/* ------------------------------------------------------------------ */
/* Couverture                                                          */
/* ------------------------------------------------------------------ */

export function coverageOf(sq: SubQuestion, passages: ScoredPassage[], brand?: string | null): SubQuestionCoverage {
  const spec = FACETS[sq.facet];
  // Les mots de la marque ne doivent pas suffire à « couvrir » une question.
  const qText = brand ? sq.question.replace(new RegExp(brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ') : sq.question;
  let best: { p: ScoredPassage; m: number; status: SubQuestionCoverage['status'] } | null = null;
  for (const p of passages) {
    const hay = `${p.heading ?? ''} ${p.text}`;
    const kw = overlap(qText, hay);
    let status: SubQuestionCoverage['status'] = 'absente';
    let m = kw;
    if (sq.facet !== 'autre') {
      const lex = spec.lex.test(hay);
      const headingLex = !!p.heading && spec.lex.test(p.heading);
      const proof = spec.proof ? spec.proof.test(p.text) : true;
      if ((lex && proof && (headingLex || kw >= 0.2)) || (headingLex && proof)) status = 'couverte';
      else if (lex) status = 'partielle';
      m = Math.max(kw, status === 'couverte' ? 0.8 : status === 'partielle' ? 0.4 : 0);
    } else {
      status = kw >= 0.6 ? 'couverte' : kw >= 0.35 ? 'partielle' : 'absente';
    }
    const rank = (s: SubQuestionCoverage['status']) => (s === 'couverte' ? 2 : s === 'partielle' ? 1 : 0);
    if (!best || rank(status) > rank(best.status) || (rank(status) === rank(best.status) && m > best.m)) best = { p, m, status };
  }
  return {
    ...sq,
    status: best?.status ?? 'absente',
    match: Math.round((best?.m ?? 0) * 100) / 100,
    ...(best && best.status !== 'absente' ? { bestUrl: best.p.url, bestPassageId: best.p.id } : {}),
  };
}

/** Réponse de brouillon tirée de la fiche de vérité (sinon à compléter). */
function draftAnswer(facet: FanOutFacet, facts: FactsInput): { answer: string; from: 'fiche' | 'a_completer' } {
  const map: Partial<Record<FanOutFacet, string | undefined>> = {
    prix: facts.prix,
    zone: facts.zone,
    horaires: facts.horaires,
    contact: facts.telephone,
    garanties: facts.certifications,
    livraison: facts.livraison,
    retours: facts.retours,
    references: facts.clients,
    caracteristiques: facts.ingredients ?? facts.produits,
    cible: facts.services,
  };
  const v = map[facet]?.trim();
  return v ? { answer: v, from: 'fiche' } : { answer: '[à compléter]', from: 'a_completer' };
}

export interface QuestionsResult {
  section: GeoSection;
  fanOut: FanOutResult;
}

export function auditQuestions(subs: SubQuestion[], seeds: string[], passages: ScoredPassage[], opts: { brand?: string | null; facts?: FactsInput; homeUrl: string; hasHtml: boolean }): QuestionsResult {
  const items = subs.map((s) => coverageOf(s, passages, opts.brand));
  const covered = items.filter((i) => i.status === 'couverte').length;
  const partial = items.filter((i) => i.status === 'partielle').length;
  const missingItems = items.filter((i) => i.status === 'absente');
  const source: FanOutResult['source'] = subs.some((s) => s.source === 'ia') ? 'ia' : 'modele';
  const fanOut: FanOutResult = {
    source,
    seeds,
    items,
    covered,
    partial,
    missing: missingItems.length,
    note:
      source === 'ia'
        ? 'Sous-questions générées par le fournisseur d’IA configuré : une simulation de la décomposition faite par les moteurs, pas leurs requêtes réelles.'
        : 'Démonstration : sous-questions issues de gabarits par type de site (aucune IA appelée). Connectez un fournisseur d’IA pour une décomposition adaptée à vos questions.',
  };
  const findings: GeoFinding[] = [];
  if (opts.hasHtml && items.length) {
    const missingShare = missingItems.length / items.length;
    if (missingItems.length) {
      const faq = missingItems.slice(0, 12).map((i) => ({ question: i.question, ...draftAnswer(i.facet, opts.facts ?? {}) }));
      const ready = faq.filter((f) => f.from === 'fiche');
      const jsonld = ready.length ? generateJsonLd('FAQPage', { url: opts.homeUrl, faq: ready.map((f) => ({ q: f.question, a: f.answer })) }) : null;
      findings.push(
        finding({
          id: 'geo.questions.uncovered',
          category: CAT,
          severity: missingShare >= 0.6 ? 'high' : missingShare >= 0.3 ? 'medium' : 'low',
          title: `${plural(missingItems.length, 'sous-question', 'sous-questions')} sur ${items.length} que les IA explorent ne trouvent aucune réponse sur votre site`,
          why: 'Pour répondre, les moteurs d’IA lancent plusieurs recherches par sous-thème (prix, délais, zone, garanties…). Une sous-question sans réponse sur votre site est une occasion laissée à une autre source.',
          fix: 'Répondez à ces questions sur vos pages existantes (section ou FAQ visible), en 1 à 3 phrases factuelles chacune. N’en faites pas des pages en série : Google le considère comme un abus.',
          affected: missingItems.map((i) => ({ url: opts.homeUrl, detail: `${FACETS[i.facet].label} — ${i.question}` })),
          impact: 2,
          effort: 2,
          evidenceLevel: 'probable',
          evidence: fanOut.note,
          autoFix: {
            kind: 'faq',
            payload: {
              url: opts.homeUrl,
              value: faq,
              ...(jsonld ? { jsonld: jsonld.jsonld } : {}),
              notes: ['Réponses « [à compléter] » : à rédiger par vous ; seules les réponses issues de votre fiche sont pré-remplies.', 'La FAQ doit être visible sur la page ; le balisage FAQPage ne reprend que les réponses validées.'],
            },
          },
        }),
      );
    }
    const partials = items.filter((i) => i.status === 'partielle');
    if (partials.length >= 3 && partials.length / items.length >= 0.3) {
      findings.push(
        finding({
          id: 'geo.questions.partial',
          category: CAT,
          severity: 'low',
          title: `${plural(partials.length, 'sous-question est', 'sous-questions sont')} abordée(s) sans réponse précise`,
          why: 'Le sujet est évoqué, mais sans le fait attendu (un prix, un délai, une liste de communes…) : une IA préférera une source qui le donne.',
          fix: 'Complétez les passages concernés avec le fait précis attendu.',
          affected: partials.map((i) => ({ url: i.bestUrl ?? opts.homeUrl, detail: `${FACETS[i.facet].label} — ${clip(i.question, 100)}` })),
          impact: 1,
          effort: 1,
          evidenceLevel: 'probable',
        }),
      );
    }
  }
  const note = `${items.length} sous-questions (${source === 'ia' ? 'IA' : 'gabarits, démo'}) : ${covered} couvertes, ${partial} partielles, ${missingItems.length} sans réponse.`;
  return { section: section('questions', 'Couverture des questions (fan-out)', 15, findings, note, opts.hasHtml && items.length > 0), fanOut };
}
