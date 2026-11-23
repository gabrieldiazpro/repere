/**
 * Test de marque (V8, anciennement « contrôle IA rapide ») : 3 à 5 vraies questions de clients, générées à partir du
 * type de site, de l'activité et de la ville, posées UNE fois à CHAQUE IA configurée via le moteur existant
 * (src/lib/engine, `runAudit`). Résultat : tableau question × IA (cité ou non, place, qui à la place, phrase,
 * sources), taux de citation avec sa fourchette, et brouillons « pourquoi lui » (src/lib/analysis/why.ts).
 *
 * Coûts : plafond d'appels par analyse (questions × IA ≤ maxCalls), budget en euros transmis au moteur (qui ne lance
 * qu'une exécution par question), plus les garde-fous de src/lib/analysis/aiguard.ts (cache 24 h, limite par domaine
 * et par jour, plafond quotidien, pause OPS). Sans aucune clé : réponses de démonstration étiquetées `demo: true`.
 * Aucune clé ne quitte le serveur.
 */
import { runAudit } from '@/lib/engine/audit';
import { createRealProvider, getExtractor, selectedProviders } from '@/lib/engine/providers';
import { ALL_PROVIDERS, PROVIDER_LABELS, type AuditInput, type AuditResult, type ProviderId } from '@/lib/engine/types';
import type { CustomQuery } from '@/lib/engine/types-v3';
import { isRegulatedTrade } from '@/lib/regulated';
import { BRAND_TEST_MAX_QUESTIONS, BRAND_TEST_MIN_QUESTIONS, anonymizeDemoNames, buildBrandTest, competitorNames, engineLabel, scrubDemoSources } from './brandtest';
import { draftWhy } from './why';
import { de, isFeminineHead, isPluralHead, nounPhrase, pluralOf, productFocus, withDefinite, withIndefinite, type NounPhrase } from './activity';
import type { AiCheckContext, AiCheckSummary, SiteType } from './types';

export const DEFAULT_MAX_AI_CALLS = 18;
/** coût maximal d'un appel (IA la plus chère + extraction), en euros : estimation prudente du plafond quotidien */
export const MAX_COST_PER_CALL_EUR = 0.025;
/** Ordre de préférence quand le plafond d'appels oblige à retirer des IA (les plus utilisées d'abord). */
const PREFERRED: string[] = ['chatgpt', 'gemini', 'perplexity', 'claude', 'mistral'];

export function maxAiCallsFromEnv(): number {
  const n = Number(process.env.ANALYSIS_MAX_AI_CALLS);
  return Number.isFinite(n) && n >= 0 ? Math.min(60, Math.floor(n)) : DEFAULT_MAX_AI_CALLS;
}

/** Genre grammatical (approché) d'un métier, pour des questions sans faute : « une boulangerie », « un plombier ». */
export function isFeminine(activity: string): boolean {
  return isFeminineHead(activity);
}

/** « luminaires artisanaux », « bijoux », « box de vins » : activité décrite par un pluriel (pas un métier). */
export function isPluralActivity(activity: string): boolean {
  return isPluralHead(activity);
}

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/**
 * Questions de recommandation (jamais de question nommant la marque : on mesure si les IA la citent d'elles-mêmes).
 * TESTS-REELS (nov. 2026) : formulations choisies selon la nature de l'activité (métier / produits / prestation),
 * avec genre, nombre et élisions (« Quel caviste… », « Où acheter des box de vins… », « Qui contacter pour la location
 * de voitures… »), pour rester correctes sur les activités lues sur de vrais sites.
 */
export function buildQuickQuestions(siteType: SiteType, activity: string | undefined, city: string | undefined, n: number): CustomQuery[] {
  const act = (activity || '').trim();
  const where = city ? ` à ${city}` : ' en France';
  const out: CustomQuery[] = [];
  if (siteType === 'local') {
    const p = nounPhrase(act || 'commerce');
    if (p.kind === 'trade') {
      const f = p.feminine;
      const a = p.text;
      const g = { quel: f ? 'Quelle' : 'Quel', quels: f ? 'Quelles' : 'Quels', notes: f ? 'notées' : 'notés', serieux: f ? 'sérieuse' : 'sérieux' };
      const pl = pluralOf(p);
      out.push(
        { text: `${g.quel} ${a} me recommandez-vous${where} ?`, intent: 'best' },
        { text: `${g.quels} sont les ${pl} les mieux ${g.notes}${where} ?`, intent: 'review' },
        { text: `J’ai besoin ${de(withIndefinite(p))}${where} rapidement, qui contacter ?`, intent: 'urgent' },
        { text: `Pouvez-vous me conseiller ${withIndefinite(p)} ${g.serieux}${where} ?`, intent: 'best' },
        { text: `${g.quel} ${a} choisir${where} pour un bon rapport qualité-prix ?`, intent: 'price' },
        { text: `Liste des meilleur${f ? 'e' : ''}s ${pl}${where}, avec leurs points forts`, intent: 'comparison' },
      );
    } else if (p.kind === 'products') {
      const x = withIndefinite(p); // « des box de vins »
      out.push(
        { text: `Où acheter ${x}${where} ?`, intent: 'where_to_buy' },
        { text: `Quelle boutique me recommandez-vous pour ${x}${where} ?`, intent: 'best' },
        { text: `Quelles sont les adresses les mieux notées pour ${x}${where} ?`, intent: 'review' },
        { text: `Qui propose ${x} de qualité${where} ?`, intent: 'best' },
        { text: `Où trouver ${x} au meilleur rapport qualité-prix${where} ?`, intent: 'price' },
        { text: `Liste des meilleures adresses pour ${x}${where}, avec leurs points forts`, intent: 'comparison' },
      );
    } else {
      const x = withDefinite(p); // « la location de voitures »
      out.push(
        { text: `Qui me recommandez-vous pour ${x}${where} ?`, intent: 'best' },
        { text: `Quelles sont les entreprises les mieux notées pour ${x}${where} ?`, intent: 'review' },
        { text: `J’ai besoin d’aide pour ${x}${where} rapidement, qui contacter ?`, intent: 'urgent' },
        { text: `Quel professionnel sérieux choisir pour ${x}${where} ?`, intent: 'best' },
        { text: `Qui choisir pour ${x}${where}, au bon rapport qualité-prix ?`, intent: 'price' },
        { text: `Liste des meilleurs professionnels pour ${x}${where}, avec leurs points forts`, intent: 'comparison' },
      );
    }
  } else if (siteType === 'ecommerce') {
    if (!act) {
      out.push(
        { text: 'Quelles boutiques en ligne françaises me recommandez-vous ?', intent: 'best' },
        { text: 'Quelles sont les marques françaises les mieux notées en ligne ?', intent: 'french_brand' },
        { text: 'Quels sites de vente en ligne français sont fiables, avec une livraison rapide ?', intent: 'where_to_buy' },
        { text: 'Comparatif des meilleures boutiques en ligne françaises', intent: 'comparison' },
      );
    } else {
      const p = nounPhrase(productFocus(act));
      const def = withDefinite(p);
      const what = p.kind === 'service' ? withIndefinite(p) : p.plural ? withIndefinite(p) : partitive(p);
      out.push(
        { text: `Où acheter ${what} en ligne en France ?`, intent: 'where_to_buy' },
        { text: `Quelles sont les meilleures boutiques en ligne pour ${def} ?`, intent: 'best' },
        { text: `Quelle marque française recommandez-vous pour ${def} ?`, intent: 'french_brand' },
        { text: `Quel site choisir pour ${def}, avec une livraison rapide ?`, intent: 'where_to_buy' },
        { text: `Comparatif des meilleurs sites pour ${def}`, intent: 'comparison' },
        { text: `${cap(def)} : quelles alternatives aux grandes marques ?`, intent: 'alternative' },
      );
    }
  } else {
    const zone = city ? ` à ${city}` : ' en France';
    if (!act) {
      out.push(
        { text: `Quelles entreprises de services aux professionnels recommandez-vous${zone} ?`, intent: 'which_company' },
        { text: `Quel prestataire B2B sérieux choisir${zone} ?`, intent: 'best' },
        { text: `Quelles sont les PME de référence${zone}, avec de bons avis ?`, intent: 'review' },
        { text: `Quels prestataires pour entreprises sont les mieux notés${zone} ?`, intent: 'review' },
        { text: `Comparatif des meilleurs prestataires pour PME${zone}`, intent: 'comparison' },
        { text: `Quelle société de services choisir${zone} pour un bon rapport qualité-prix ?`, intent: 'price' },
      );
    } else {
      const p = nounPhrase(act);
      if (p.kind === 'trade' && !p.plural) {
        const f = p.feminine;
        const pl = pluralOf(p);
        out.push(
          { text: `${f ? 'Quelle' : 'Quel'} ${p.text} me recommandez-vous${zone} ?`, intent: 'which_company' },
          { text: `${f ? 'Quelles' : 'Quels'} sont les ${pl} de référence${zone} ?`, intent: 'best' },
          { text: `Comparatif des meilleur${f ? 'e' : ''}s ${pl}${zone}`, intent: 'comparison' },
          { text: `${f ? 'Quelle' : 'Quel'} ${p.text} ${f ? 'sérieuse' : 'sérieux'} choisir, avec de bons avis ?`, intent: 'review' },
          { text: `Combien coûte ${withIndefinite(p)}, et qui contacter${zone} ?`, intent: 'price' },
          { text: `${f ? 'Quelle' : 'Quel'} ${p.text} choisir${zone} pour une PME ?`, intent: 'best' },
        );
      } else {
        const def = withDefinite(p);
        out.push(
          { text: `Quelles entreprises recommandez-vous pour ${def}${zone} ?`, intent: 'which_company' },
          { text: `Quel prestataire choisir pour ${def}${zone} ?`, intent: 'best' },
          { text: `Quels sont les acteurs de référence pour ${def}${zone} ?`, intent: 'best' },
          { text: `Comparatif des meilleures solutions pour ${def}`, intent: 'comparison' },
          { text: `Quelle société sérieuse choisir pour ${def}, avec de bons avis ?`, intent: 'review' },
          { text: `Combien coûte ${p.plural ? withDefinite(p) : def}, et qui contacter${zone} ?`, intent: 'price' },
        );
      }
    }
  }
  return out.slice(0, Math.max(3, Math.min(6, n))).map((q, i) => ({ ...q, id: `Q60-${i + 1}`, kind: 'reco' as const }));
}

/** « du vin », « de la bière », « de l’huile d’olive » (non dénombrable) ; produits au pluriel : « des … ». */
function partitive(p: NounPhrase): string {
  if (p.plural) return `des ${p.text}`;
  if (/^[aeiouyàâéèêëîïôûùh]/i.test(p.text)) return `de l’${p.text}`;
  return `${p.feminine ? 'de la' : 'du'} ${p.text}`;
}

/** Toutes les IA connues du moteur (y compris celles ajoutées après coup dans PROVIDER_LABELS). */
export function knownProviders(): ProviderId[] {
  return [...new Set([...ALL_PROVIDERS, ...(Object.keys(PROVIDER_LABELS) as ProviderId[])])];
}

/** IA réellement disponibles (clé présente), dans l'ordre de préférence. */
export function availableProviders(): ProviderId[] {
  const ok = knownProviders().filter((p) => {
    try {
      return !!createRealProvider(p);
    } catch {
      return false;
    }
  });
  const rank = (p: string) => (PREFERRED.includes(p) ? PREFERRED.indexOf(p) : PREFERRED.length);
  return ok.sort((a, b) => rank(a) - rank(b));
}

/** Libellés des IA du test (page /analyse, accroches) : configurées, sinon celles de la démonstration. */
export function brandTestEngines(): { demo: boolean; engines: { id: string; label: string }[] } {
  const real = availableProviders();
  const ids = real.length ? real : selectedProviders('free').slice(0, 3);
  return { demo: !real.length, engines: ids.map((id) => ({ id, label: engineLabel(id) })) };
}

/**
 * Plan d'appels sous plafond (1 exécution par question et par IA) : 3 à 5 questions ; on retire d'abord des IA (les
 * moins prioritaires), puis des questions. 0 question si même 3 questions × 1 IA dépassent le plafond (test sauté).
 */
export function planCalls(real: ProviderId[], maxCalls: number): { providers: ProviderId[]; questions: number } {
  if (!real.length) return { providers: [], questions: 4 }; // démo : aucun coût
  let providers = [...real];
  while (providers.length > 1 && BRAND_TEST_MIN_QUESTIONS * providers.length > maxCalls) providers = providers.slice(0, -1);
  if (BRAND_TEST_MIN_QUESTIONS * providers.length > maxCalls) return { providers: [], questions: 0 };
  const questions = Math.max(BRAND_TEST_MIN_QUESTIONS, Math.min(BRAND_TEST_MAX_QUESTIONS, Math.floor(maxCalls / providers.length)));
  return { providers, questions };
}

/** Coût prévu (euros) d'une exécution de chaque question sur chaque IA, extraction comprise. */
export function plannedCostEur(providers: ProviderId[], questions: number): number {
  const ext = getExtractor()?.costPerCallEur ?? 0;
  let perRound = 0;
  for (const p of providers) {
    const prov = createRealProvider(p);
    perRound += (prov?.costPerCallEur ?? MAX_COST_PER_CALL_EUR) + ext;
  }
  return perRound * questions;
}

export function summarizeAudit(r: AuditResult, calls: number): AiCheckSummary {
  const firstRun = r.mentions.filter((m) => m.run === Math.min(...r.mentions.filter((x) => x.queryId === m.queryId && x.provider === m.provider).map((x) => x.run)));
  const qs = r.queries.map((q) => {
    const ms = firstRun.filter((m) => m.queryId === q.id && !m.noRec);
    const comps = new Map<string, number>();
    for (const m of ms) for (const c of m.competitors) comps.set(c, (comps.get(c) ?? 0) + 1);
    return {
      id: q.id,
      text: q.text,
      asked: ms.length,
      mentioned: ms.filter((m) => m.mentioned).length,
      competitors: [...comps.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => k),
    };
  });
  return {
    demo: !!r.demo,
    auditId: r.id,
    providers: r.providersUsed?.length ? r.providersUsed : [...new Set(r.answers.map((a) => a.provider))],
    questions: qs,
    score: Math.round(r.score),
    range: r.range ? { low: Math.round(r.range.low), high: Math.round(r.range.high) } : null,
    mentionRate: r.mentionRate,
    calls,
    topCompetitors: r.competitors.slice(0, 5).map((c) => c.name),
    note: r.demo
      ? 'Démonstration : aucune IA n’est configurée sur ce serveur, ces réponses sont simulées et ne mesurent rien.'
      : `Mesure unique sur ${qs.length} questions : la marge d’erreur est large (fourchette indiquée). Le suivi mensuel pose plus de questions.`,
  };
}

/** Test de marque, sans garde-fous de coût (voir `guardedBrandTest` dans aiguard.ts). */
export async function runQuickAiCheck(ctx: AiCheckContext): Promise<AiCheckSummary | null> {
  if (ctx.activity && isRegulatedTrade(ctx.activity)) {
    ctx.onSkip?.({ reason: 'regulated', message: 'Test de marque non lancé pour cette activité réglementée : les IA y donnent des réponses encadrées, que nous ne mesurons pas.' });
    return null;
  }
  const real = availableProviders();
  const plan = planCalls(real, ctx.maxCalls);
  if (!plan.questions) {
    ctx.onSkip?.({ reason: 'no_budget', message: 'Test de marque non lancé : le plafond d’appels aux IA de ce serveur est trop bas.' });
    return null;
  }
  const demo = plan.providers.length === 0;
  const queries = buildQuickQuestions(ctx.siteType, ctx.activity, ctx.city, Math.min(BRAND_TEST_MAX_QUESTIONS, plan.questions));
  const activity = ctx.activity || (ctx.siteType === 'local' ? 'commerce' : ctx.siteType === 'ecommerce' ? 'boutique en ligne' : 'entreprise');
  const input: AuditInput = {
    businessName: ctx.brand,
    trade: activity,
    city: ctx.city || 'France',
    website: ctx.url,
    segment: ctx.siteType,
    ...(ctx.siteType === 'pme' ? { category: activity, market: ctx.city || 'France' } : {}),
    ...(ctx.siteType === 'ecommerce' ? { productCategories: [activity], market: 'France' } : {}),
  };
  const providers = demo ? selectedProviders('free').slice(0, 3) : plan.providers;
  ctx.onPlan?.({ demo, questions: queries.map((q) => ({ id: q.id!, text: q.text })), providers: providers.map((p) => ({ id: p, label: engineLabel(p) })) });
  // Budget = une exécution de chaque question sur chaque IA : le moteur retire d'office la 2ᵉ exécution.
  const budgetEur = demo ? 0 : plannedCostEur(providers, queries.length) + 1e-6;
  const result = await runAudit(input, {
    mode: 'free',
    providers,
    forceMock: demo,
    queries,
    queriesMode: 'replace',
    budgetEur,
    concurrency: Math.max(6, Math.min(12, providers.length * 2)),
    signal: ctx.signal,
    onProgress: (p) => ctx.onProgress?.(p.done, demo ? p.total : Math.min(p.total, queries.length * providers.length), p.provider),
  });
  const calls = demo ? 0 : result.answers.filter((a) => !a.demo).length;
  const summary = summarizeAudit(result, Math.min(calls, ctx.maxCalls));
  const notConfigured = demo ? [] : knownProviders().filter((p) => !providers.includes(p)).map(engineLabel);
  let test = buildBrandTest(result, { brand: ctx.brand, notConfigured });
  test.why = draftWhy(test, result, ctx.url);
  if (demo) {
    // Démonstration : pas de faux noms ni de faux sites qui pourraient être ceux de vrais commerces.
    const names = competitorNames(test, [...result.competitors.map((c) => c.name), ...result.mentions.flatMap((m) => m.competitors), ...summary.topCompetitors]);
    test = scrubDemoSources(anonymizeDemoNames(test, names, ctx.brand), ctx.url);
    const anon = anonymizeDemoNames({ questions: summary.questions, topCompetitors: summary.topCompetitors }, names, ctx.brand);
    summary.questions = anon.questions;
    summary.topCompetitors = anon.topCompetitors;
  }
  summary.test = test;
  // Mesure réelle : l'audit moteur est enregistré (comme l'audit gratuit) pour être rattaché au compte à l'inscription.
  if (!demo && ctx.save !== false) {
    try {
      const { saveAudit } = await import('@/lib/db');
      await saveAudit(result, { trigger: 'free' });
    } catch {
      delete summary.auditId;
    }
  } else if (demo) delete summary.auditId;
  return summary;
}
