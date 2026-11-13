/**
 * Adaptateurs V2 du rapport (purs, sans React) — utilisés par la page /rapport et le PDF.
 *
 * Le moteur V2 (ENGINE) remplit `sources`, `perception`, `gaps`, `benchmark`, `factCheck`.
 * Tant qu'un champ manque (audit V1 stocké, moteur pas encore à jour), on le dérive ici, de façon
 * prudente et étiquetée (`derived: true`), à partir des réponses brutes déjà présentes dans l'audit.
 * Les livrables « Ce qu'on fait pour vous » sont générés localement (gabarits) tant que
 * `generateTasks` (module EXECUTION) n'est pas branché : voir `previewTasks`.
 */
import { auditStats } from '@/lib/digest/stats';
import type { ActionItem, AuditInput, AuditResult, ProviderAnswer, ProviderId } from '@/lib/engine/types';
import { generateTasks } from '@/lib/execution/tasks';
import type { AuditV2, BrandFacts } from '@/lib/execution/types';
import type {
  AuditInputV2,
  AuditResultV2Ext,
  BenchmarkPosition,
  BrandClaim,
  BrandQuote,
  CompetitorGap,
  DomainStat,
  ExecTask,
  FactCheckReport,
  PerceptionReport,
  Presence,
  Segment,
  Sentiment,
  SourceCategory,
  SourceOpportunity,
  SourcesReport,
} from '@/lib/engine/types-v2';

export type ReportResult = Omit<AuditResult, 'input'> & AuditResultV2Ext & { input: AuditInput & AuditInputV2 };

/* ------------------------------------------------------------------ */
/* Parcours et vocabulaire                                             */
/* ------------------------------------------------------------------ */

export function segmentOf(r: ReportResult): Segment {
  const s = r.segment ?? r.input.segment;
  return s === 'pme' || s === 'ecommerce' ? s : 'local';
}

export interface SegmentWords {
  /** « votre commerce » / « votre entreprise » / « votre marque » */
  you: string;
  /** pluriel des acteurs comparés */
  actors: string;
  /** libellé court du parcours */
  label: string;
  /** objet de la recherche (« plombier à Paris 11e », « logiciel de paie pour PME ») */
  topic: string;
  /** client final (« vos clients », « vos acheteurs ») */
  buyers: string;
}

export function topicOf(r: ReportResult): string {
  const seg = segmentOf(r);
  if (seg === 'pme') return (r.input.category || r.input.trade || '').trim();
  if (seg === 'ecommerce') return (r.input.productCategories?.filter(Boolean).join(', ') || r.input.category || r.input.trade || '').trim();
  const d = r.input.district?.trim();
  const where = d ? (/^\d/.test(d) ? `${r.input.city} ${d}` : d) : r.input.city;
  return `${r.input.trade} à ${where}`;
}

export function wordsFor(r: ReportResult): SegmentWords {
  const seg = segmentOf(r);
  if (seg === 'pme') return { you: 'votre entreprise', actors: 'acteurs', label: 'PME et services B2B', topic: topicOf(r), buyers: 'vos acheteurs' };
  if (seg === 'ecommerce') return { you: 'votre marque', actors: 'marques', label: 'E-commerce', topic: topicOf(r), buyers: 'vos acheteurs' };
  return { you: 'votre commerce', actors: 'professionnels', label: 'Commerce local', topic: topicOf(r), buyers: 'vos clients' };
}

export function marketOf(r: ReportResult): string {
  const seg = segmentOf(r);
  if (seg === 'local') return [r.input.district, r.input.city].filter(Boolean).join(', ');
  return (r.input.market || r.input.city || 'France').trim();
}

/* ------------------------------------------------------------------ */
/* Utilitaires                                                         */
/* ------------------------------------------------------------------ */

const DIRECTORY_NAMES = /^(pages ?jaunes|google|google maps|yelp|tripadvisor|doctolib|the ?fork|la ?fourchette|treatwell|planity|facebook|instagram|houzz|trustpilot|leboncoin|wikip[ée]dia|uber eats|deliveroo|amazon|capterra|g2|appvizer|reddit|linkedin|youtube)\b/i;
export const isPlatformName = (n: string) => DIRECTORY_NAMES.test(n.trim());

export function domainOf(url: string): string {
  let h = String(url || '').trim().toLowerCase();
  h = h.replace(/^[a-z][a-z0-9+.-]*:\/\//, '').replace(/^www\d?\./, '');
  h = h.split(/[/?#:]/)[0];
  const labels = h.split('.').filter(Boolean);
  if (labels.length <= 2) return labels.join('.');
  const two = labels.slice(-2).join('.');
  if (/^(co|com|org|gouv|asso|net)\.[a-z]{2}$/.test(two)) return labels.slice(-3).join('.');
  return two;
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const slug = (s: string) => fold(s).replace(/[^a-z0-9]+/g, '');

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h;
}

export function ordinal(n: number): string {
  return n === 1 ? '1ᵉʳ' : `${n}ᵉ`;
}

function validAnswers(r: ReportResult): ProviderAnswer[] {
  return (r.answers ?? []).filter((a) => !a.error && a.text);
}

/** La réponse cite-t-elle le client ? (mêmes mentions que le moteur quand disponibles) */
function answerMentions(r: ReportResult, a: ProviderAnswer): boolean {
  const m = r.mentions?.find((x) => x.provider === a.provider && x.queryId === a.queryId && x.run === a.run);
  if (m) return m.mentioned;
  return slug(a.text).includes(slug(r.input.businessName));
}

function competitorsIn(r: ReportResult, a: ProviderAnswer): string[] {
  const m = r.mentions?.find((x) => x.provider === a.provider && x.queryId === a.queryId && x.run === a.run);
  if (m) return m.competitors;
  return (r.competitors ?? []).map((c) => c.name).filter((n) => slug(a.text).includes(slug(n)));
}

/* ------------------------------------------------------------------ */
/* Benchmark « 4ᵉ sur 12 »                                             */
/* ------------------------------------------------------------------ */

export function benchmarkOf(r: ReportResult): BenchmarkPosition & { derived: boolean; gapToNext: number | null; next: string | null } {
  // Même calcul que l'espace client, le digest et le copilote (src/lib/digest/stats.ts).
  const st = auditStats(r);
  const next = st.ahead;
  return { rank: st.rank, of: st.of, label: st.label, derived: !r.benchmark, gapToNext: next ? next.mentions - st.citations : null, next: next?.name ?? null };
}

/* ------------------------------------------------------------------ */
/* Phrase choc                                                         */
/* ------------------------------------------------------------------ */

const PROVIDER_LABEL: Record<ProviderId, string> = { chatgpt: 'ChatGPT', perplexity: 'Perplexity', gemini: 'Gemini', claude: 'Claude', mistral: 'Mistral (Le Chat)' };

export function shockLine(r: ReportResult): string {
  const name = r.input.businessName;
  const order: ProviderId[] = ['chatgpt', 'gemini', 'perplexity', 'claude', 'mistral'];
  const qText = (id: string) => r.queries.find((q) => q.id === id)?.text ?? '';
  const misses = (r.mentions ?? [])
    .filter((m) => !m.mentioned && m.competitors.some((c) => !isPlatformName(c)))
    .sort((a, b) => order.indexOf(a.provider) - order.indexOf(b.provider));
  const bench = benchmarkOf(r);
  if (misses.length && r.score < 70) {
    const m = misses[0];
    const who = m.competitors.filter((c) => !isPlatformName(c)).slice(0, 2);
    // Le texte vient des questions saisies : espaces insécables avant la ponctuation haute.
    const q = qText(m.queryId).replace(/ ([:;?!])/g, '\u00a0$1');
    return `Quand on demande à ${PROVIDER_LABEL[m.provider]} «\u00a0${q}\u00a0», il recommande ${who.join(' et ')}. Pas ${name}.`;
  }
  if (bench.rank === 1) return `${name} est l'acteur le plus cité par les IA sur ces questions. L'enjeu : garder cette place.`;
  if (bench.next) return `${bench.next} est cité juste devant vous${bench.gapToNext ? `, avec ${bench.gapToNext} mention${bench.gapToNext > 1 ? 's' : ''} de plus` : ''}.`;
  return `Les IA vous citent dans ${Math.round((r.mentionRate ?? 0) * 100)} % des réponses analysées.`;
}

/* ------------------------------------------------------------------ */
/* Sources                                                             */
/* ------------------------------------------------------------------ */

export const CATEGORY_LABEL: Record<SourceCategory, string> = {
  annuaire: 'Annuaire',
  avis: "Plateforme d'avis",
  media_national: 'Média national',
  media_local: 'Média local',
  comparatif: 'Comparatif',
  forum: 'Forum',
  marketplace: 'Marketplace',
  reseau_social: 'Réseau social',
  concurrent: 'Site concurrent',
  client: 'Votre site',
  wikipedia: 'Encyclopédie',
  institutionnel: 'Institutionnel',
  autre: 'Autre',
};

/** Table minimale de repli (le moteur V2 a la sienne, plus complète : engine/data/domains.json). */
const KNOWN: Record<string, { label: string; category: SourceCategory }> = {
  'pagesjaunes.fr': { label: 'PagesJaunes', category: 'annuaire' },
  'google.com': { label: 'Google Maps', category: 'annuaire' },
  'google.fr': { label: 'Google Maps', category: 'annuaire' },
  'yelp.fr': { label: 'Yelp', category: 'avis' },
  'yelp.com': { label: 'Yelp', category: 'avis' },
  'tripadvisor.fr': { label: 'Tripadvisor', category: 'avis' },
  'thefork.fr': { label: 'TheFork', category: 'avis' },
  'trustpilot.com': { label: 'Trustpilot', category: 'avis' },
  'avis-verifies.com': { label: 'Avis Vérifiés', category: 'avis' },
  'g2.com': { label: 'G2', category: 'avis' },
  'capterra.fr': { label: 'Capterra', category: 'comparatif' },
  'capterra.com': { label: 'Capterra', category: 'comparatif' },
  'appvizer.fr': { label: 'Appvizer', category: 'comparatif' },
  'getapp.fr': { label: 'GetApp', category: 'comparatif' },
  'lesnumeriques.com': { label: 'Les Numériques', category: 'comparatif' },
  'quechoisir.org': { label: 'Que Choisir', category: 'comparatif' },
  'alternativeto.net': { label: 'AlternativeTo', category: 'comparatif' },
  'journaldunet.com': { label: 'JDN', category: 'media_national' },
  'lesechos.fr': { label: 'Les Échos', category: 'media_national' },
  'leparisien.fr': { label: 'Le Parisien', category: 'media_local' },
  'actu.fr': { label: 'Actu.fr', category: 'media_local' },
  'ouest-france.fr': { label: 'Ouest-France', category: 'media_local' },
  'reddit.com': { label: 'Reddit', category: 'forum' },
  'quora.com': { label: 'Quora', category: 'forum' },
  'commentcamarche.net': { label: 'CommentÇaMarche', category: 'forum' },
  'amazon.fr': { label: 'Amazon', category: 'marketplace' },
  'cdiscount.com': { label: 'Cdiscount', category: 'marketplace' },
  'malt.fr': { label: 'Malt', category: 'marketplace' },
  'facebook.com': { label: 'Facebook', category: 'reseau_social' },
  'instagram.com': { label: 'Instagram', category: 'reseau_social' },
  'linkedin.com': { label: 'LinkedIn', category: 'reseau_social' },
  'youtube.com': { label: 'YouTube', category: 'reseau_social' },
  'wikipedia.org': { label: 'Wikipédia', category: 'wikipedia' },
  'service-public.fr': { label: 'Service-Public.fr', category: 'institutionnel' },
};

/** Sources de référence par parcours, pour compléter quand l'audit en cite moins de 10. */
const REFERENCE: Record<Segment, string[]> = {
  local: ['google.com', 'pagesjaunes.fr', 'yelp.fr', 'facebook.com', 'actu.fr', 'instagram.com', 'tripadvisor.fr', 'trustpilot.com', 'reddit.com', 'leparisien.fr'],
  pme: ['capterra.fr', 'g2.com', 'appvizer.fr', 'linkedin.com', 'journaldunet.com', 'trustpilot.com', 'getapp.fr', 'reddit.com', 'alternativeto.net', 'lesechos.fr'],
  ecommerce: ['amazon.fr', 'trustpilot.com', 'reddit.com', 'lesnumeriques.com', 'avis-verifies.com', 'instagram.com', 'youtube.com', 'quechoisir.org', 'cdiscount.com', 'facebook.com'],
};

const WEIGHT: Record<Segment, Partial<Record<SourceCategory, number>>> = {
  local: { annuaire: 1, avis: 1, media_national: 0.5, media_local: 0.9, comparatif: 0.7, forum: 0.5, marketplace: 0.3, reseau_social: 0.6, wikipedia: 0.2, institutionnel: 0.4, autre: 0.3 },
  pme: { annuaire: 0.6, avis: 0.9, media_national: 0.8, media_local: 0.4, comparatif: 1, forum: 0.8, marketplace: 0.4, reseau_social: 0.7, wikipedia: 0.5, institutionnel: 0.4, autre: 0.3 },
  ecommerce: { annuaire: 0.3, avis: 0.9, media_national: 0.8, media_local: 0.3, comparatif: 1, forum: 0.9, marketplace: 1, reseau_social: 0.8, wikipedia: 0.4, institutionnel: 0.2, autre: 0.3 },
};

const FEAS: Partial<Record<SourceCategory, number>> = {
  annuaire: 1, avis: 0.8, comparatif: 0.4, media_local: 0.4, media_national: 0.15, forum: 0.5, marketplace: 0.6, reseau_social: 0.9, wikipedia: 0.05, institutionnel: 0.3, autre: 0.3,
};

function classify(domain: string, r: ReportResult): { label: string; category: SourceCategory } {
  const own = r.input.website ? domainOf(r.input.website) : '';
  if (own && domain === own) return { label: 'Votre site', category: 'client' };
  if (KNOWN[domain]) return KNOWN[domain];
  const base = domain.split('.')[0];
  if ((r.competitors ?? []).some((c) => slug(c.name) && (slug(c.name).includes(slug(base)) || slug(base).includes(slug(c.name)))))
    return { label: domain, category: 'concurrent' };
  if (/avis|review/.test(domain)) return { label: domain, category: 'avis' };
  if (/annuaire|pages|guide/.test(domain)) return { label: domain, category: 'annuaire' };
  if (/forum/.test(domain)) return { label: domain, category: 'forum' };
  if (/compar|meilleur|top|classement/.test(domain)) return { label: domain, category: 'comparatif' };
  return { label: domain, category: 'autre' };
}

export function actionFor(category: SourceCategory, label: string): { action: string; howTo: string[]; effort: 'S' | 'M' | 'L' } {
  switch (category) {
    case 'annuaire':
      return { action: `S'inscrire sur ${label}`, effort: 'S', howTo: ['Créez ou revendiquez votre fiche gratuite.', 'Nom, adresse et téléphone identiques à votre site et à Google.', 'Ajoutez services, horaires, photos et le lien vers votre site.'] };
    case 'avis':
      return { action: `Obtenir des avis sur ${label}`, effort: 'M', howTo: ['Revendiquez votre page.', 'Demandez un avis à chaque client réel, sans filtrage ni contrepartie.', 'Répondez à tous les avis.'] };
    case 'comparatif':
      return { action: `Être ajouté au comparatif ${label}`, effort: 'M', howTo: ["Créez votre profil s'il s'agit d'une plateforme (Capterra, Appvizer…).", "Écrivez à l'auteur avec des faits : prix, différences, preuves.", 'Collectez des avis de vrais clients sur le profil.'] };
    case 'media_local':
      return { action: `Proposer un sujet à ${label}`, effort: 'L', howTo: ["Trouvez un angle d'actualité locale.", 'Préparez un communiqué court avec photos.', 'Envoyez-le au journaliste de la rubrique.'] };
    case 'media_national':
      return { action: `Proposer une expertise à ${label}`, effort: 'L', howTo: ["Repérez l'auteur de la page citée.", 'Proposez une donnée exclusive ou un avis d’expert.', 'Relancez une fois, sans insister.'] };
    case 'forum':
      return { action: `Répondre utilement sur ${label}`, effort: 'M', howTo: ['Compte identifié, à votre nom.', 'Réponses utiles, sans lien au début.', 'Respectez les règles du forum : jamais de faux comptes.'] };
    case 'marketplace':
      return { action: `Se référencer sur ${label}`, effort: 'M', howTo: ['Ouvrez un compte vendeur après calcul de marge.', 'Fiches complètes : titres explicites, attributs, photos.', 'Sollicitez les avis acheteurs.'] };
    case 'reseau_social':
      return { action: `Compléter votre présence sur ${label}`, effort: 'S', howTo: ['Profil pro : nom, catégorie, lien vers le site.', '4 publications utiles par mois.', 'Répondez aux commentaires.'] };
    case 'wikipedia':
      return { action: 'Vérifier votre admissibilité à Wikipédia', effort: 'L', howTo: ['Vérifiez les critères (sources indépendantes).', 'Ne rédigez jamais votre propre page.', 'Sinon, visez Wikidata ou les médias.'] };
    case 'institutionnel':
      return { action: `Vous faire référencer par ${label}`, effort: 'L', howTo: ["Vérifiez votre éligibilité.", 'Constituez le dossier.', 'Mettez à jour la fiche officielle.'] };
    default:
      return { action: `Analyser ${label}`, effort: 'M', howTo: ['Lisez la page citée.', 'Repérez qui y figure et pourquoi.', 'Décidez au cas par cas.'] };
  }
}

export interface SourceCard extends SourceOpportunity {
  presence: Presence;
  citations: number;
  citedAnswers: number;
  totalAnswers: number;
  providers: ProviderId[];
  /** recommandée pour le secteur, non citée dans cet audit */
  reference: boolean;
}

export interface SourcesView {
  report: SourcesReport;
  cards: SourceCard[];
  derived: boolean;
  /** réponses avec au moins une source (ChatGPT, Perplexity, Claude) */
  groundedAnswers: number;
  clientCitedAnswers: number;
}

export const GEMINI_NOTE = 'Gemini : pas de sources disponibles via API. Ses réponses servent à mesurer ce qu’il dit de vous, pas les sites qu’il lit.';

function deriveSources(r: ReportResult): SourcesReport {
  const seg = segmentOf(r);
  const answers = validAnswers(r).filter((a) => a.provider !== 'gemini');
  const comps = (r.competitors ?? []).filter((c) => !isPlatformName(c.name)).slice(0, 10).map((c) => c.name);
  const map = new Map<string, DomainStat & { answers: Set<string>; firstPos: number }>();
  let total = 0;
  let clientCited = 0;
  for (const a of answers) {
    const youHere = answerMentions(r, a);
    const compsHere = competitorsIn(r, a).filter((c) => comps.includes(c));
    const seen = new Set<string>();
    (a.citations ?? []).forEach((url, i) => {
      const d = domainOf(url);
      if (!d || seen.has(d)) return;
      seen.add(d);
      total++;
      const cls = classify(d, r);
      if (cls.category === 'client') clientCited++;
      let st = map.get(d);
      if (!st) {
        st = {
          domain: d, label: cls.label, category: cls.category, citations: 0, citationShare: 0, providers: [], queries: [],
          clientPresence: 'unknown', competitorsPresent: [], sampleUrls: [], answers: new Set(), firstPos: 99,
        };
        map.set(d, st);
      }
      st.citations++;
      st.answers.add(`${a.provider}:${a.queryId}:${a.run}`);
      st.firstPos = Math.min(st.firstPos, i + 1);
      if (!st.providers.includes(a.provider)) st.providers.push(a.provider);
      if (!st.queries.includes(a.queryId)) st.queries.push(a.queryId);
      if (st.sampleUrls.length < 3 && !st.sampleUrls.includes(url)) st.sampleUrls.push(url);
      if (youHere) st.clientPresence = 'present';
      for (const c of compsHere) if (!st.competitorsPresent.includes(c)) st.competitorsPresent.push(c);
    });
  }
  const domains = [...map.values()].sort((a, b) => b.citations - a.citations);
  for (const d of domains) {
    d.citationShare = total ? d.citations / total : 0;
    if (d.category === 'client') d.clientPresence = 'present';
    // Sans preuve dans les réponses : absent si des concurrents y sont, inconnu sinon (le client confirme).
    else if (d.clientPresence !== 'present') d.clientPresence = d.competitorsPresent.length ? 'absent' : 'unknown';
  }
  const byCategory: Partial<Record<SourceCategory, number>> = {};
  for (const d of domains) byCategory[d.category] = (byCategory[d.category] ?? 0) + d.citations;

  const nAns = answers.length || 1;
  const nProv = new Set(answers.map((a) => a.provider)).size || 1;
  const opps: SourceOpportunity[] = domains
    .filter((d) => d.category !== 'client' && d.category !== 'concurrent')
    .map((d) => {
      const citedRate = d.answers.size / nAns;
      let F = 0.7 * Math.sqrt(Math.min(1, citedRate / 0.3)) + 0.3 * (d.providers.length / nProv);
      if (d.answers.size < 2) F *= 0.5;
      if (d.firstPos <= 2) F = Math.min(1, F + 0.1);
      const W = WEIGHT[seg][d.category] ?? 0.3;
      const A = d.clientPresence === 'present' ? 0.25 : d.competitorsPresent.length ? 1 : d.clientPresence === 'absent' ? 0.85 : 0.6;
      const X = FEAS[d.category] ?? 0.3;
      const score = Math.round(100 * F * W * A * Math.max(0.35, X));
      const act = actionFor(d.category, d.label);
      const provs = d.providers.map((p) => PROVIDER_LABEL[p]).join(' et ');
      const gap = d.competitorsPresent.length
        ? ` ${d.competitorsPresent.slice(0, 2).join(' et ')} ${d.competitorsPresent.length > 1 ? 'y sont' : 'y est'} ; ${d.clientPresence === 'present' ? 'vous aussi' : 'pas vous'}.`
        : '';
      return {
        domain: d.domain, label: d.label, category: d.category, score,
        why: `Cité dans ${d.answers.size} réponse${d.answers.size > 1 ? 's' : ''} sur ${answers.length}, par ${provs}.${gap}`,
        action: act.action, howTo: act.howTo, effort: act.effort,
        impact: (F * W >= 0.6 ? 3 : F * W >= 0.3 ? 2 : d.competitorsPresent.length ? 2 : 1) as 1 | 2 | 3,
        competitorsPresent: d.competitorsPresent,
      };
    })
    .sort((a, b) => b.score - a.score);
  // Diversité : au plus 3 par catégorie.
  const perCat = new Map<SourceCategory, number>();
  const top: SourceOpportunity[] = [];
  for (const o of opps) {
    const n = perCat.get(o.category) ?? 0;
    if (n >= 3) continue;
    perCat.set(o.category, n + 1);
    top.push(o);
    if (top.length >= 10) break;
  }
  const clean: DomainStat[] = domains.map(({ answers: _a, firstPos: _f, ...d }) => d);
  return {
    totalCitations: total,
    domains: clean,
    byCategory,
    opportunities: top,
    clientCitedCount: clientCited,
    note: GEMINI_NOTE,
  };
}

export function sourcesOf(r: ReportResult): SourcesView {
  const seg = segmentOf(r);
  const derived = !r.sources;
  const report = r.sources ?? deriveSources(r);
  const grounded = validAnswers(r).filter((a) => a.provider !== 'gemini' && (a.citations?.length ?? 0) > 0);
  const own = r.input.website ? domainOf(r.input.website) : '';
  const clientCitedAnswers = own ? grounded.filter((a) => a.citations.some((u) => domainOf(u) === own)).length : 0;
  const stat = new Map(report.domains.map((d) => [d.domain, d]));
  const cards: SourceCard[] = report.opportunities.slice(0, 10).map((o) => {
    const d = stat.get(o.domain);
    return {
      ...o,
      presence: d?.clientPresence ?? 'unknown',
      citations: d?.citations ?? 0,
      citedAnswers: d?.citations ?? 0,
      totalAnswers: grounded.length,
      providers: d?.providers ?? [],
      reference: false,
    };
  });
  if (cards.length < 10) {
    for (const dom of REFERENCE[seg]) {
      if (cards.length >= 10) break;
      if (cards.some((c) => c.domain === dom) || dom === own) continue;
      const k = KNOWN[dom] ?? { label: dom, category: 'autre' as SourceCategory };
      const act = actionFor(k.category, k.label);
      cards.push({
        domain: dom, label: k.label, category: k.category, score: 0,
        why: 'Source de référence pour votre secteur, non citée dans cet échantillon de réponses.',
        action: act.action, howTo: act.howTo, effort: act.effort, impact: 1, competitorsPresent: [],
        presence: 'unknown', citations: 0, citedAnswers: 0, totalAnswers: grounded.length, providers: [], reference: true,
      });
    }
  }
  return { report, cards, derived, groundedAnswers: grounded.length, clientCitedAnswers };
}

/* ------------------------------------------------------------------ */
/* Perception : verbatims, sentiment, affirmations                     */
/* ------------------------------------------------------------------ */

const POS = /(très bons? avis|excellent|recommand|apprécié|sérieu|fiable|réactif|rapide|qualité|sympathique|efficace|intuiti|complet|reconnu|leader|populaire|bien noté|top)/i;
const NEG = /(cher|lent|mauvais|plainte|déçu|problème|retard|limité|négatif|critiqu|peu de|manque|difficile|arnaque|fermé)/i;
const THEMES: [RegExp, string][] = [
  [/avis|noté|note/i, 'avis clients'],
  [/prix|tarif|cher|abordable|devis/i, 'prix'],
  [/rapide|réactif|délai|disponib|urgence/i, 'réactivité'],
  [/accueil|sympathique|service client|support/i, 'accueil et support'],
  [/qualité|sérieu|fiable|professionnel/i, 'qualité'],
  [/livraison|expédi/i, 'livraison'],
  [/simple|intuiti|facile|ergonom/i, 'simplicité'],
  [/complet|fonctionnalit|intégration|api/i, 'fonctionnalités'],
];

function sentencesWith(text: string, name: string): string[] {
  const parts = text.replace(/\*\*/g, '').split(/(?<=[.!?])\s+|\n+/);
  const n = slug(name);
  return parts.map((p) => p.replace(/^[\s*\-•\d.]+/, '').trim()).filter((p) => p.length > 12 && slug(p).includes(n));
}

function sentimentOf(s: string): Sentiment {
  const pos = POS.test(s);
  const neg = NEG.test(s);
  if (neg && !pos) return 'negatif';
  if (pos && !neg) return 'positif';
  return 'neutre';
}

export interface PerceptionView extends PerceptionReport {
  derived: boolean;
  mentionsAnalysed: number;
}

export function perceptionOf(r: ReportResult): PerceptionView {
  if (r.perception) return { ...r.perception, derived: false, mentionsAnalysed: r.perception.quotes.length };
  const qText = (id: string) => r.queries.find((q) => q.id === id)?.text ?? '';
  const all: BrandQuote[] = [];
  const seen = new Set<string>();
  for (const a of validAnswers(r)) {
    for (const s of sentencesWith(a.text, r.input.businessName)) {
      const key = slug(s);
      if (seen.has(key)) continue;
      seen.add(key);
      all.push({ provider: a.provider, query: qText(a.queryId), text: s.slice(0, 400), sentiment: sentimentOf(s), at: a.at ?? r.measuredAt ?? r.createdAt });
    }
  }
  const n = all.length || 1;
  const sentiment = {
    positif: all.filter((q) => q.sentiment === 'positif').length / n,
    neutre: all.filter((q) => q.sentiment === 'neutre').length / n,
    negatif: all.filter((q) => q.sentiment === 'negatif').length / n,
  };
  const themeCount = new Map<string, number>();
  for (const q of all) for (const [re, t] of THEMES) if (re.test(q.text)) themeCount.set(t, (themeCount.get(t) ?? 0) + 1);
  const themes = [...themeCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([t]) => t);
  // Variété : une citation par IA d'abord, puis le reste.
  const quotes: BrandQuote[] = [];
  const byProv = new Set<ProviderId>();
  for (const q of all) if (!byProv.has(q.provider)) { byProv.add(q.provider); quotes.push(q); }
  for (const q of all) if (quotes.length < 6 && !quotes.includes(q)) quotes.push(q);
  return { quotes: quotes.slice(0, 6), sentiment, themes, claims: deriveClaims(r), derived: true, mentionsAnalysed: all.length };
}

const CLAIM_PATTERNS: { field: BrandClaim['field']; re: RegExp }[] = [
  { field: 'telephone', re: /(?:\+33\s?|0)[1-9](?:[\s.-]?\d{2}){4}/ },
  { field: 'adresse', re: /\b\d{1,4}(?:\s?(?:bis|ter))?,?\s(?:rue|avenue|av\.|boulevard|bd|place|quai|impasse|allée|chemin)\s[^,.;\n]{3,40}/i },
  { field: 'horaires', re: /(ouvert|ferm[ée])[^.;\n]{0,50}(\d{1,2}\s?h|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|24\s?h)/i },
  { field: 'prix', re: /(\d+[\s,.]?\d*\s?(?:€|euros?)(?:\s?(?:HT|TTC|\/mois|par mois|par salarié))?)/i },
  { field: 'creation', re: /(fond[ée]e?|créée?|depuis)\s(?:en\s)?(19|20)\d{2}/i },
  { field: 'livraison', re: /livr(?:e|aison)[^.;\n]{0,60}/i },
  { field: 'zone', re: /(intervient|livre|disponible)\s(?:dans|sur|en)\s[^.;\n]{3,40}/i },
];

function deriveClaims(r: ReportResult): BrandClaim[] {
  const out: BrandClaim[] = [];
  const seen = new Set<string>();
  for (const a of validAnswers(r)) {
    for (const s of sentencesWith(a.text, r.input.businessName)) {
      for (const p of CLAIM_PATTERNS) {
        const m = s.match(p.re);
        if (!m) continue;
        const key = `${p.field}:${slug(m[0])}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ field: p.field, value: m[0].trim(), provider: a.provider, quote: s.slice(0, 300) });
      }
    }
  }
  if (out.length) return out.slice(0, 6);
  // Aucune donnée factuelle repérée : on montre ce que les IA affirment de vous, à vérifier.
  for (const a of validAnswers(r)) {
    for (const s of sentencesWith(a.text, r.input.businessName)) {
      const after = s.split(/[—–:]/).slice(1).join(' ').trim() || s;
      const key = slug(after);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ field: 'autre', value: after.slice(0, 140), provider: a.provider, quote: s.slice(0, 300) });
      if (out.length >= 4) return out;
    }
  }
  return out;
}

export const FIELD_LABEL: Record<BrandClaim['field'], string> = {
  adresse: 'Adresse', telephone: 'Téléphone', horaires: 'Horaires', prix: 'Prix', zone: 'Zone desservie', services: 'Services',
  dirigeant: 'Dirigeant', creation: 'Création', site: 'Site', statut: 'Statut', produits: 'Produits', livraison: 'Livraison',
  clients: 'Références clients', retours: 'Retours', ingredients: 'Ingrédients', certifications: 'Labels', autre: 'Affirmation',
};

export interface ClaimGroup { field: BrandClaim['field']; value: string; providers: ProviderId[]; quote: string }

const FIELD_ORDER: BrandClaim['field'][] = ['prix', 'telephone', 'adresse', 'horaires', 'statut', 'livraison', 'zone', 'services', 'produits', 'creation', 'dirigeant', 'clients', 'site', 'autre'];

/** Regroupe les affirmations identiques (même champ, même valeur) faites par plusieurs IA. */
export function groupClaims(claims: BrandClaim[], max = 6): ClaimGroup[] {
  const map = new Map<string, ClaimGroup>();
  for (const c of claims) {
    const key = `${c.field}:${slug(c.value)}`;
    const g = map.get(key);
    if (g) { if (!g.providers.includes(c.provider)) g.providers.push(c.provider); }
    else map.set(key, { field: c.field, value: c.value, providers: [c.provider], quote: c.quote });
  }
  const list = [...map.values()].sort((a, b) => FIELD_ORDER.indexOf(a.field) - FIELD_ORDER.indexOf(b.field));
  // Une valeur par champ d'abord (les divergences entre IA restent visibles ensuite).
  const out: ClaimGroup[] = [];
  for (const g of list) if (out.length < max && !out.some((o) => o.field === g.field)) out.push(g);
  for (const g of list) if (out.length < max && !out.includes(g)) out.push(g);
  return out.sort((a, b) => FIELD_ORDER.indexOf(a.field) - FIELD_ORDER.indexOf(b.field));
}

export function factCheckOf(r: ReportResult): FactCheckReport | null {
  return r.factCheck && r.factCheck.items?.length ? r.factCheck : null;
}

/* ------------------------------------------------------------------ */
/* Pourquoi vos concurrents passent devant                             */
/* ------------------------------------------------------------------ */

export function gapsOf(r: ReportResult, sources?: SourcesView): { gaps: CompetitorGap[]; derived: boolean } {
  // Un seul comptage (auditStats) : mêmes réponses, mêmes citations que le rang et la synthèse.
  const st = auditStats(r);
  const yourMentions = st.citations;
  const total = st.answers || 1;
  const ahead = new Map(st.rows.filter((x) => !x.isMe && x.mentions > yourMentions).map((x) => [x.name.toLowerCase(), x]));
  if (r.gaps?.length) {
    // Moteur : on ne garde que les concurrents réellement devant, avec le comptage commun.
    const kept = r.gaps
      .filter((g) => ahead.has(g.competitor.toLowerCase()))
      .slice(0, 3)
      .map((g) => {
        const row = ahead.get(g.competitor.toLowerCase())!;
        const first = `Cité ${row.mentions} fois contre ${yourMentions} pour vous, sur les mêmes ${total} réponses.`;
        const rest = g.reasons.filter((x) => !/^Cité \d+ fois/.test(x));
        return { ...g, mentions: row.mentions, share: row.share, reasons: [first, ...rest] };
      });
    return { gaps: kept, derived: false };
  }
  const src = sources ?? sourcesOf(r);
  const answers = validAnswers(r);
  const top = [...ahead.values()].sort((a, b) => b.mentions - a.mentions).slice(0, 3);
  const gaps = top
    .map((c) => {
      const presentOn = src.report.domains
        .filter((d) => d.competitorsPresent.includes(c.name) && d.clientPresence !== 'present' && d.category !== 'concurrent' && d.category !== 'client')
        .slice(0, 4)
        .map((d) => d.label);
      const ownSite = src.report.domains.find((d) => d.category === 'concurrent' && slug(c.name).includes(slug(d.domain.split('.')[0])));
      const attrs = new Map<string, number>();
      for (const a of answers) {
        for (const s of sentencesWith(a.text, c.name)) {
          const tail = s.split(/[—–:(]/).slice(1).join(' ').replace(/[).]/g, '').trim();
          if (tail && tail.length < 60 && !/^[A-Z][a-z]+$/.test(tail)) attrs.set(tail.toLowerCase(), (attrs.get(tail.toLowerCase()) ?? 0) + 1);
        }
      }
      const attr = [...attrs.entries()].sort((a, b) => b[1] - a[1])[0];
      const reasons: string[] = [`Cité ${c.mentions} fois contre ${yourMentions} pour vous, sur les mêmes ${total} réponses.`];
      if (presentOn.length) reasons.push(`Présent sur ${presentOn.slice(0, 3).join(', ')}, des sources lues par les IA où vous n'apparaissez pas.`);
      if (ownSite) reasons.push(`Son site est lui-même cité comme source ${ownSite.citations} fois.`);
      if (attr) reasons.push(`Les IA le décrivent ainsi : « ${attr[0]} » (${attr[1]} fois).`);
      return { competitor: c.name, mentions: c.mentions, share: c.share, presentOn, reasons };
    });
  return { gaps, derived: true };
}

/* ------------------------------------------------------------------ */
/* Ce qu'on fait pour vous : 3 tâches avec livrable réel               */
/* ------------------------------------------------------------------ */

function cleanSite(u?: string): string | undefined {
  if (!u) return undefined;
  const t = u.trim();
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

export function jsonLdFor(r: ReportResult): string {
  const seg = segmentOf(r);
  const url = cleanSite(r.input.website);
  const base: Record<string, unknown> = { '@context': 'https://schema.org', name: r.input.businessName };
  if (url) base.url = url;
  if (seg === 'local') {
    Object.assign(base, {
      '@type': 'LocalBusiness',
      description: `${r.input.trade} à ${marketOf(r)}.`,
      address: { '@type': 'PostalAddress', addressLocality: r.input.city, addressCountry: 'FR' },
      areaServed: marketOf(r),
      telephone: 'À COMPLÉTER',
      openingHours: 'À COMPLÉTER (ex. Mo-Fr 08:00-19:00)',
    });
  } else if (seg === 'pme') {
    Object.assign(base, {
      '@type': 'Organization',
      description: r.input.offering || `${r.input.category || r.input.trade}.`,
      areaServed: marketOf(r),
      makesOffer: { '@type': 'Offer', itemOffered: { '@type': 'Service', name: r.input.category || r.input.trade, description: r.input.offering || undefined } },
    });
  } else {
    Object.assign(base, {
      '@type': 'Brand',
      description: r.input.offering || `Marque de ${topicOf(r)}.`,
      slogan: undefined,
    });
  }
  return JSON.stringify(base, (_k, v) => (v === undefined ? undefined : v), 2);
}

export interface TaskPreview {
  id: string;
  title: string;
  why: string;
  minutes: number;
  automation: ExecTask['automation'];
  deliverable: { type: 'text' | 'html' | 'jsonld' | 'link' | 'checklist'; content: string; label?: string };
}

/** Description prête à coller (fiche, profil) : gabarit, pas de LLM. */
export function profileText(r: ReportResult): string {
  const seg = segmentOf(r);
  const name = r.input.businessName;
  if (seg === 'local') {
    return `${name}, ${r.input.trade.toLowerCase()} à ${marketOf(r)}. Nous intervenons auprès des particuliers et des professionnels du quartier. Devis clair avant intervention, horaires et coordonnées à jour sur notre site${r.input.website ? ` (${r.input.website})` : ''}.`;
  }
  if (seg === 'pme') {
    return `${name} : ${r.input.category || r.input.trade}${r.input.offering ? `. ${r.input.offering.replace(/\.?$/, '.')}` : '.'} Pour les entreprises en ${marketOf(r)}. Démonstration, tarifs et références clients sur ${r.input.website || 'notre site'}.`;
  }
  return `${name} : ${topicOf(r)}${r.input.offering ? `. ${r.input.offering.replace(/\.?$/, '.')}` : '.'} Composition, conseils d'utilisation et avis clients vérifiés sur ${r.input.website || 'notre boutique'}.`;
}

function faqFor(r: ReportResult): string {
  const seg = segmentOf(r);
  const n = r.input.businessName;
  const leader = (r.competitors ?? []).find((c) => !isPlatformName(c.name))?.name;
  if (seg === 'pme') {
    return [
      `Q. À qui s'adresse ${n} ?`,
      `R. ${r.input.offering || `Aux entreprises qui cherchent un ${r.input.category || r.input.trade}.`} [Précisez taille d'entreprise et secteurs.]`,
      '',
      `Q. Combien coûte ${n} ?`,
      'R. [Prix public ou fourchette, ce qui est inclus, durée d’engagement.]',
      '',
      leader ? `Q. Quelle différence entre ${n} et ${leader} ?` : `Q. Pourquoi choisir ${n} ?`,
      'R. [Trois différences factuelles et vérifiables, sans dénigrement.]',
    ].join('\n');
  }
  return [
    `Q. Quels produits propose ${n} ?`,
    `R. ${topicOf(r)}. [Citez vos 3 produits phares et leur usage.]`,
    '',
    `Q. ${n} livre-t-elle en France et en Belgique ?`,
    'R. [Pays, délais, frais, retours.]',
    '',
    `Q. Comment choisir ${(r.input.productCategories?.[0] || topicOf(r)).toLowerCase()} ?`,
    'R. [Trois critères concrets, avec vos produits en exemple.]',
  ].join('\n');
}

function reviewMsg(r: ReportResult): string {
  return `Bonjour, merci encore pour votre confiance ! Si vous avez une minute, un avis sur notre fiche Google nous aiderait beaucoup. Dites simplement ce que nous avons fait pour vous (${r.input.trade.toLowerCase()} à ${marketOf(r)}). Merci ! ${r.input.businessName}`;
}

/**
 * 3 tâches avec un livrable réel. Repli local de `generateTasks` (module EXECUTION) :
 * même forme (`ExecTask` simplifiée), livrables générés par gabarit.
 */
export function previewTasks(r: ReportResult, sources?: SourcesView, external?: ExecTask[] | null, facts?: BrandFacts | null): TaskPreview[] {
  let ext = external ?? null;
  if (!ext) {
    try {
      ext = generateTasks(r as unknown as AuditV2, facts ?? null, { segment: segmentOf(r), max: 10 });
    } catch {
      ext = null; // module EXECUTION indisponible : repli local ci-dessous
    }
  }
  if (ext?.length) {
    // Livrable montré : le premier prêt à l'emploi (sans « [à compléter] ») s'il y en a un.
    const deliv = (t: ExecTask) => {
      const ds = t.deliverable?.filter((d) => d.type !== 'link' && d.content.trim()) ?? [];
      return ds.find((d) => !d.content.includes('[à compléter]')) ?? ds[0] ?? null;
    };
    const withDeliv = ext.filter((t) => deliv(t));
    // Variété : un type de tâche différent par carte quand c'est possible, jamais deux fois le même livrable.
    const pick: ExecTask[] = [];
    const sameDeliv = (t: ExecTask) => pick.some((p) => deliv(p)?.content.trim() === deliv(t)?.content.trim());
    for (const t of withDeliv) if (pick.length < 3 && !pick.some((p) => p.kind === t.kind) && !sameDeliv(t)) pick.push(t);
    for (const t of withDeliv) if (pick.length < 3 && !pick.includes(t) && !sameDeliv(t)) pick.push(t);
    if (pick.length >= 2) {
      return pick.map((t) => ({
        id: t.id, title: t.title, why: t.why, minutes: t.minutes, automation: t.automation,
        deliverable: deliv(t) ?? { type: 'checklist' as const, content: (t.steps ?? []).map((x, i) => `${i + 1}. ${x}`).join('\n') },
      }));
    }
  }
  const seg = segmentOf(r);
  const src = sources ?? sourcesOf(r);
  const first = src.cards.find((c) => c.presence !== 'present' && (c.category === 'annuaire' || c.category === 'avis' || c.category === 'comparatif' || c.category === 'reseau_social' || c.category === 'marketplace')) ?? src.cards[0];
  const out: TaskPreview[] = [];
  if (first) {
    out.push({
      id: `t-src-${first.domain}`,
      title: first.action,
      why: first.reference ? first.why : `${first.why} C'est la source la plus utile à investir pour vous.`,
      minutes: first.effort === 'S' ? 20 : first.effort === 'M' ? 45 : 120,
      automation: 'semi',
      deliverable: { type: 'text', label: `Description prête à coller sur ${first.label}`, content: profileText(r) },
    });
  }
  out.push({
    id: 't-schema',
    title: seg === 'local' ? 'Installer les données structurées LocalBusiness' : seg === 'pme' ? 'Installer les données structurées Organization et Service' : 'Installer les données structurées de votre marque',
    why: 'Les IA et les moteurs lisent ces données pour comprendre qui vous êtes, sans ambiguïté.',
    minutes: 10,
    automation: 'auto',
    deliverable: { type: 'jsonld', label: 'Balisage JSON-LD (servi par nous, ou à coller dans le <head>)', content: jsonLdFor(r) },
  });
  if (seg === 'local') {
    out.push({
      id: 't-reviews',
      title: 'Demander 5 avis à vos vrais clients',
      why: 'Des avis récents qui citent votre métier et votre quartier sont lus par les IA.',
      minutes: 15,
      automation: 'semi',
      deliverable: { type: 'text', label: 'Message à envoyer par SMS ou e-mail (sans contrepartie)', content: reviewMsg(r) },
    });
  } else {
    out.push({
      id: 't-faq',
      title: seg === 'pme' ? 'Publier une FAQ « acheteur » citable' : 'Publier une FAQ produit citable',
      why: 'Les IA reprennent les pages qui répondent clairement aux questions posées par les acheteurs.',
      minutes: 30,
      automation: 'semi',
      deliverable: { type: 'text', label: 'Trame de FAQ (page hébergée possible)', content: faqFor(r) },
    });
  }
  // Complément depuis les actions V1 si une tâche manque.
  for (const a of (r.topActions ?? []) as ActionItem[]) {
    if (out.length >= 3) break;
    out.push({
      id: `t-${a.id}`, title: a.title, why: a.why, minutes: a.effort === 'S' ? 20 : a.effort === 'M' ? 60 : 180, automation: 'guide',
      deliverable: { type: 'checklist', content: a.how.map((h, i) => `${i + 1}. ${h}`).join('\n') },
    });
  }
  return out.slice(0, 3);
}

export const AUTOMATION_LABEL: Record<ExecTask['automation'], string> = {
  auto: 'Fait pour vous',
  semi: 'Prêt à valider',
  guide: 'Guidé pas à pas',
};

/* ------------------------------------------------------------------ */
/* Offres par parcours                                                 */
/* ------------------------------------------------------------------ */

export interface SegmentOffer {
  planId: string;
  name: string;
  price: string;
  unit: string;
  pitch: string;
  points: string[];
  featured?: boolean;
  cta: string;
}

export function offersFor(seg: Segment): SegmentOffer[] {
  const p = seg === 'ecommerce' ? 'ecom' : seg;
  if (seg === 'local') {
    return [
      { planId: `${p}_audit_deep`, name: 'Audit + plan d’action', price: '149 €', unit: 'une fois', pitch: 'Le diagnostic complet et 10 à 15 actions avec textes prêts à copier.', points: ['Sources locales que lisent les IA', 'Livré sous 48 h', 'Remboursé sous 14 jours si non satisfait'], cta: 'Obtenir mon plan d’action' },
      { planId: `${p}_accompagne_month`, name: 'Accompagné', price: '99 €', unit: '/mois', pitch: 'On le fait pour vous : fiches Google, Bing, Apple, avis, annuaires.', points: ['Rien n’est publié sans votre validation', 'Rapport mensuel avant/après', '3 mois minimum, puis sans engagement'], featured: true, cta: 'Être accompagné' },
      { planId: `${p}_essentiel_month`, name: 'Essentiel', price: '29 €', unit: '/mois', pitch: 'Vous suivez votre visibilité et faites les actions, textes prêts à copier.', points: ['20 questions suivies chaque mois', 'Sources et opportunités classées', 'Sans engagement'], cta: 'Commencer' },
    ];
  }
  if (seg === 'pme') {
    return [
      { planId: `${p}_audit_deep`, name: 'Audit approfondi', price: '390 €', unit: 'une fois', pitch: '50 questions, toutes les sources, « pourquoi eux » et un plan sur 90 jours.', points: ['Restitution visio de 45 min', 'Livré sous 5 jours ouvrés', 'Déduit de l’Accompagné sous 30 jours'], cta: 'Commander l’audit approfondi' },
      { planId: `${p}_accompagne_month`, name: 'Accompagné', price: '490 €', unit: '/mois', pitch: 'On exécute : pages citables, comparateurs B2B, démarches vers les sources.', points: ['Rien n’est publié sans votre validation', 'Point visio mensuel de 30 min', '3 mois minimum, puis sans engagement'], featured: true, cta: 'Être accompagné' },
      { planId: `${p}_essentiel_month`, name: 'Essentiel', price: '99 €', unit: '/mois', pitch: '50 questions suivies chaque semaine, actions prêtes à faire.', points: ['5 concurrents, part de voix et sentiment', 'Trafic venu des IA via GA4', 'Sans engagement'], cta: 'Commencer' },
    ];
  }
  return [
    { planId: `${p}_audit_deep`, name: 'Audit catalogue approfondi', price: '390 €', unit: 'une fois', pitch: '50 requêtes produit, toutes les sources, audit du balisage et du flux.', points: ['Plan sur 90 jours et visio de 45 min', 'Déduit de l’Accompagné sous 30 jours', 'Remboursé sous 14 jours si non satisfait'], cta: 'Commander l’audit catalogue' },
    { planId: `${p}_accompagne_month`, name: 'Accompagné', price: '390 €', unit: '/mois', pitch: 'On exécute : fiches produit réécrites, balisage Product, comparatifs.', points: ['Rien n’est publié sans votre validation', 'Rapport mensuel et visio de 30 min', '3 mois minimum, puis sans engagement'], featured: true, cta: 'Être accompagné' },
    { planId: `${p}_essentiel_month`, name: 'Essentiel', price: '79 €', unit: '/mois', pitch: '50 requêtes produit suivies chaque semaine, fiches et balisage prêts.', points: ['5 marques concurrentes suivies', 'Trafic IA via GA4 ou Shopify', 'Sans engagement'], cta: 'Commencer' },
  ];
}

/* ------------------------------------------------------------------ */
/* Accès complet (plan payé ou compte démo)                            */
/* ------------------------------------------------------------------ */

export const DEMO_ACCOUNT_IDS = ['demo', 'demo-pme', 'demo-ecom'];

/** Audits du compte démo : `demo-1`…`demo-6` (Local) et ceux des comptes `demo-pme` / `demo-ecom`. */
export function isDemoAccountAudit(id: string): boolean {
  return /^demo-\d{1,2}$/.test(id) || /^demo-(pme|ecom)(-[\w-]+)?$/.test(id);
}

/** Réponses ancrées par IA (pour la mention honnête de méthode). */
export function groundedProviders(r: ReportResult): ProviderId[] {
  const set = new Set<ProviderId>();
  for (const a of validAnswers(r)) if (a.provider !== 'gemini' && a.citations?.length) set.add(a.provider);
  return (['chatgpt', 'perplexity', 'claude'] as ProviderId[]).filter((p) => set.has(p));
}

/** Variation déterministe (pour les placeholders flous : jamais le vrai contenu). */
export function blurWidth(seed: string, i: number): number {
  return 45 + (hash(`${seed}:${i}`) % 40);
}
