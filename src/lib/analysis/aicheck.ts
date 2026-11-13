/**
 * Contrôle IA rapide : 3 à 6 questions générées à partir du type de site, de l'activité et de la ville, posées
 * aux IA disponibles via le moteur existant (src/lib/engine, `runAudit`, celui de l'audit gratuit).
 *
 * Coût : plafond d'appels par analyse publique (questions × 2 exécutions × IA ≤ maxCalls) ET budget en euros
 * transmis au moteur. Sans aucune clé : réponses de démonstration, étiquetées `demo: true`.
 * Aucune clé ne quitte le serveur.
 */
import { runAudit } from '@/lib/engine/audit';
import { createRealProvider, selectedProviders } from '@/lib/engine/providers';
import type { AuditInput, AuditResult, ProviderId } from '@/lib/engine/types';
import type { CustomQuery } from '@/lib/engine/types-v3';
import { isRegulatedTrade } from '@/lib/regulated';
import type { AiCheckContext, AiCheckSummary, SiteType } from './types';

export const DEFAULT_MAX_AI_CALLS = 18;
const RUNS = 2; // exécutions par question en mode gratuit (moteur)
/** coût maximal d'un appel (IA la plus chère + extraction), en euros : sert au budget transmis au moteur */
const MAX_COST_PER_CALL_EUR = 0.025;

export function maxAiCallsFromEnv(): number {
  const n = Number(process.env.ANALYSIS_MAX_AI_CALLS);
  return Number.isFinite(n) && n >= 0 ? Math.min(60, Math.floor(n)) : DEFAULT_MAX_AI_CALLS;
}

/** Questions de recommandation (jamais de question nommant la marque : on mesure si les IA la citent d'elles-mêmes). */
export function buildQuickQuestions(siteType: SiteType, activity: string | undefined, city: string | undefined, n: number): CustomQuery[] {
  const act = (activity || '').trim();
  const where = city ? ` à ${city}` : ' en France';
  const out: CustomQuery[] = [];
  if (siteType === 'local') {
    const a = act || 'commerce';
    out.push(
      { text: `Quel ${a} me recommandez-vous${where} ?`, intent: 'best' },
      { text: `Quels sont les ${a}s les mieux notés${where} ?`, intent: 'review' },
      { text: `J'ai besoin d'un ${a}${where} rapidement, qui contacter ?`, intent: 'urgent' },
      { text: `Pouvez-vous me conseiller un ${a} sérieux${where} ?`, intent: 'best' },
      { text: `Quel ${a} choisir${where} pour un bon rapport qualité-prix ?`, intent: 'price' },
      { text: `Liste des meilleurs ${a}s${where}, avec leurs points forts`, intent: 'comparison' },
    );
  } else if (siteType === 'ecommerce') {
    const a = act || 'ces produits';
    out.push(
      { text: `Où acheter ${a} en ligne en France ?`, intent: 'where_to_buy' },
      { text: `Quelles sont les meilleures boutiques en ligne pour ${a} ?`, intent: 'best' },
      { text: `Quelle marque française recommandez-vous pour ${a} ?`, intent: 'french_brand' },
      { text: `Quel site choisir pour ${a} avec une livraison rapide ?`, intent: 'where_to_buy' },
      { text: `Comparatif des meilleurs sites pour ${a}`, intent: 'comparison' },
      { text: `${a} : quelles alternatives aux grandes marques ?`, intent: 'alternative' },
    );
  } else {
    const a = act || 'notre secteur';
    const zone = city ? ` à ${city}` : ' en France';
    out.push(
      { text: `Quelles entreprises recommandez-vous pour ${a}${zone} ?`, intent: 'which_company' },
      { text: `Quel prestataire choisir pour ${a}${zone} ?`, intent: 'best' },
      { text: `Quels sont les acteurs de référence en ${a}${zone} ?`, intent: 'best' },
      { text: `Comparatif des meilleures solutions pour ${a}`, intent: 'comparison' },
      { text: `Quelle société sérieuse pour ${a}, avec de bons avis ?`, intent: 'review' },
      { text: `Combien coûte ${a} et qui contacter${zone} ?`, intent: 'price' },
    );
  }
  return out.slice(0, Math.max(3, Math.min(6, n))).map((q, i) => ({ ...q, id: `Q60-${i + 1}`, kind: 'reco' as const }));
}

/** IA réellement disponibles (clé présente). */
export function availableProviders(): ProviderId[] {
  return selectedProviders('free').filter((p) => {
    try {
      return !!createRealProvider(p);
    } catch {
      return false;
    }
  });
}

/**
 * Plan d'appels sous plafond : ≥ 3 questions ; on réduit d'abord le nombre d'IA, puis celui des questions.
 * Renvoie 0 IA si même 3 questions × 2 exécutions × 1 IA dépasse le plafond (contrôle sauté).
 */
export function planCalls(real: ProviderId[], maxCalls: number): { providers: ProviderId[]; questions: number } {
  if (!real.length) return { providers: [], questions: 4 }; // démo : aucun coût
  let providers = [...real];
  while (providers.length > 1 && 3 * RUNS * providers.length > maxCalls) providers = providers.slice(0, -1);
  if (3 * RUNS * providers.length > maxCalls) return { providers: [], questions: 0 };
  const questions = Math.max(3, Math.min(6, Math.floor(maxCalls / (RUNS * providers.length))));
  return { providers, questions };
}

export function summarizeAudit(r: AuditResult, calls: number): AiCheckSummary {
  const qs = r.queries.map((q) => {
    const ms = r.mentions.filter((m) => m.queryId === q.id && !m.noRec);
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
      : `Mesure rapide sur ${qs.length} questions : la marge d’erreur est large (fourchette indiquée). Le suivi mensuel pose plus de questions.`,
  };
}

export async function runQuickAiCheck(ctx: AiCheckContext): Promise<AiCheckSummary | null> {
  if (ctx.activity && isRegulatedTrade(ctx.activity)) return null;
  const real = availableProviders();
  const plan = planCalls(real, ctx.maxCalls);
  if (!plan.questions) return null;
  const demo = plan.providers.length === 0;
  const queries = buildQuickQuestions(ctx.siteType, ctx.activity, ctx.city, plan.questions);
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
  const plannedCalls = demo ? 0 : queries.length * RUNS * providers.length;
  const result = await runAudit(input, {
    mode: 'free',
    providers,
    forceMock: demo,
    queries,
    queriesMode: 'replace',
    budgetEur: demo ? 0 : plannedCalls * MAX_COST_PER_CALL_EUR,
    concurrency: 6,
    signal: ctx.signal,
    onProgress: (p) => ctx.onProgress?.(p.done, p.total, p.provider),
  });
  const calls = demo ? 0 : result.answers.length;
  const summary = summarizeAudit(result, Math.min(calls, ctx.maxCalls));
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
