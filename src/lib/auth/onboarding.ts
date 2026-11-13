/**
 * Premier audit d'un nouvel espace (inscription Découverte, achat, espace complété) : tâche `audit.run` de la file
 * (@/lib/jobs, agent TACHES-FOND), dédoublonnée par espace. Jamais bloquant : un échec est journalisé.
 *
 * Avant la mise en file, les questions suivies sont semées (B10 de qa/v3/regard-client-v3.md) : celles de l'audit
 * gratuit d'origine quand l'espace en vient, sinon celles du moteur, dans la limite de l'offre. Sans cela, le premier
 * audit posait 12 questions à un espace Découverte qui n'en suit que 5, et l'accueil annonçait « 2 questions sur 12 ».
 */
import type { QuerySpec } from '@/lib/engine/types';

export interface OnboardingOptions {
  /** questions de l'audit d'origine (même parcours), à reprendre telles quelles */
  queries?: Pick<QuerySpec, 'id' | 'text' | 'kind' | 'intent' | 'angle'>[];
}

const isBrand = (q: Pick<QuerySpec, 'id' | 'kind'>) => q.kind === 'brand' || /^(B\d|BU-|CB-)/.test(q.id);

/**
 * Questions à suivre : recommandation d'abord (ce sont elles qui font le score), marque ensuite ; seules les
 * `limit` premières sont actives. Pure.
 */
export function pickOnboardingQuestions<Q extends Pick<QuerySpec, 'id' | 'text' | 'kind'>>(queries: readonly Q[], limit: number): { query: Q; active: boolean }[] {
  const seen = new Set<string>();
  const ordered = [...queries.filter((q) => !isBrand(q)), ...queries.filter(isBrand)].filter((q) => {
    const k = q.text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return ordered.map((query, i) => ({ query, active: i < Math.max(0, limit) }));
}

/** Sème les questions suivies d'un espace sans question. Renvoie le nombre de questions actives semées. */
export async function seedOnboardingPrompts(businessId: string, opts: OnboardingOptions = {}): Promise<number> {
  try {
    const [{ getBusinessRecord }, repo, { intentOfQuery }, { getEntitlements }, { putDoc }] = await Promise.all([
      import('@/lib/db'),
      import('@/lib/prompts/repo'),
      import('@/lib/prompts/engine'),
      import('@/lib/entitlements'),
      import('@/lib/store'),
    ]);
    const business = await getBusinessRecord(businessId);
    if (!business) return 0;
    if ((await repo.listPrompts(businessId)).length) return 0;
    const limit = getEntitlements(business).prompts;
    let queries = opts.queries?.length ? opts.queries : null;
    if (!queries) {
      const { buildAuditQueries } = await import('@/lib/engine/queries-v2');
      const { auditInputFor } = await import('@/lib/jobs/handlers');
      const generated = buildAuditQueries(auditInputFor(business, null) as unknown as Parameters<typeof buildAuditQueries>[0], 'paid');
      // Offre assez large pour tout poser : on laisse le moteur et `ensureInitialPrompts` faire comme avant.
      if (generated.filter((q) => !isBrand(q)).length <= limit) return 0;
      queries = generated;
    }
    const picked = pickOnboardingQuestions(queries, limit);
    if (!picked.length) return 0;
    await putDoc('prompts.meta', businessId, { seededAt: new Date().toISOString(), from: opts.queries?.length ? 'audit_origine' : 'moteur' }, businessId);
    let active = 0;
    for (const { query, active: on } of picked) {
      try {
        const p = repo.buildPrompt(business, {
          text: query.text,
          intent: intentOfQuery(query as QuerySpec),
          origin: 'gabarit',
          queryId: query.id,
          active: on,
        });
        await putDoc(repo.COLLECTION, p.id, p, businessId);
        if (on) active++;
      } catch {
        /* question refusée par la validation : ignorée */
      }
    }
    return active;
  } catch (e) {
    console.warn('[auth] questions de départ non semées', businessId, e instanceof Error ? e.message : e);
    return 0;
  }
}

export async function enqueueOnboardingAudit(businessId: string, opts: OnboardingOptions = {}): Promise<void> {
  await seedOnboardingPrompts(businessId, opts);
  try {
    const { enqueue } = await import('@/lib/jobs');
    await enqueue('audit.run', { businessId, trigger: 'onboarding' }, { businessId, dedupeKey: `onboarding:${businessId}` });
  } catch (e) {
    console.warn('[auth] premier audit non programmé', businessId, e instanceof Error ? e.message : e);
  }
}

// ---------------------------------------------------------------------------
// Métier / ville modifiés dans Réglages : régénération PROPOSÉE des questions (jamais automatique)
// ---------------------------------------------------------------------------

export interface RegenPlan<Q> {
  /** questions générées automatiquement (origine « gabarit ») à mettre en pause : leur historique est conservé */
  pause: string[];
  /** nouvelles questions à suivre (actives dans la limite de l'offre, les autres en réserve) */
  add: { query: Q; active: boolean }[];
}

/**
 * Pure. Les questions écrites ou choisies par le client (origine « client » ou « suggestion ») sont gardées et
 * comptent dans la limite ; seules les questions automatiques de l'ancien profil cèdent la place.
 */
export function planRegeneration<Q extends Pick<QuerySpec, 'id' | 'text' | 'kind'>>(
  existing: readonly { id: string; text: string; origin: string; active: boolean }[],
  generated: readonly Q[],
  limit: number,
  same: (a: string, b: string) => boolean,
): RegenPlan<Q> {
  const kept = existing.filter((p) => p.origin !== 'gabarit');
  const fresh = pickOnboardingQuestions(generated, generated.length)
    .map((x) => x.query)
    .filter((q) => !kept.some((p) => same(p.text, q.text)));
  const pause = existing.filter((p) => p.origin === 'gabarit' && p.active && !fresh.some((q) => same(q.text, p.text))).map((p) => p.id);
  const stillActive = existing.filter((p) => p.active && !pause.includes(p.id));
  let room = Math.max(0, limit - stillActive.length);
  const add = fresh
    .filter((q) => !existing.some((p) => p.origin === 'gabarit' && same(p.text, q.text)))
    .map((query) => {
      const active = !isBrand(query) && room > 0;
      if (active) room--;
      return { query, active };
    });
  return { pause, add };
}

/** Questions que le moteur poserait pour le profil ACTUEL de l'espace (métier, ville, quartier), sans rien écrire. */
export async function generatedQuestionsFor(businessId: string) {
  const { getBusinessRecord } = await import('@/lib/db');
  const business = await getBusinessRecord(businessId);
  if (!business) return [];
  const { buildAuditQueries } = await import('@/lib/engine/queries-v2');
  const { auditInputFor } = await import('@/lib/jobs/handlers');
  // Les concurrents et catégories de l'ancien profil ne s'appliquent plus au nouveau métier.
  const input = auditInputFor(business, null, { competitors: undefined, categories: undefined });
  return buildAuditQueries(input as unknown as Parameters<typeof buildAuditQueries>[0], 'paid');
}

/** Applique la régénération acceptée par le client. Renvoie le nombre de questions ajoutées et mises en pause. */
export async function regenerateQuestions(businessId: string): Promise<{ added: number; active: number; paused: number }> {
  const [{ getBusinessRecord }, repo, { intentOfQuery }, { getEntitlements }, { putDoc }, { isDuplicate }] = await Promise.all([
    import('@/lib/db'),
    import('@/lib/prompts/repo'),
    import('@/lib/prompts/engine'),
    import('@/lib/entitlements'),
    import('@/lib/store'),
    import('@/lib/prompts/text'),
  ]);
  const business = await getBusinessRecord(businessId);
  if (!business) return { added: 0, active: 0, paused: 0 };
  const existing = await repo.listPrompts(businessId);
  const plan = planRegeneration(existing, await generatedQuestionsFor(businessId), getEntitlements(business).prompts, isDuplicate);
  const now = new Date().toISOString();
  for (const id of plan.pause) {
    const p = existing.find((x) => x.id === id);
    if (p) await putDoc(repo.COLLECTION, id, { ...p, active: false, updatedAt: now }, businessId);
  }
  let added = 0;
  let active = 0;
  for (const { query, active: on } of plan.add) {
    try {
      // Même identifiant de gabarit qu'une ancienne question (autre texte) : nouvelle série, sans mélange d'historique.
      const reused = existing.some((x) => x.queryId === query.id);
      const p = repo.buildPrompt(business, { text: query.text, intent: intentOfQuery(query as QuerySpec), origin: 'gabarit', ...(reused ? {} : { queryId: query.id }), active: on });
      await putDoc(repo.COLLECTION, p.id, p, businessId);
      added++;
      if (on) active++;
    } catch {
      /* question refusée par la validation : ignorée */
    }
  }
  await putDoc('prompts.meta', businessId, { seededAt: now, from: 'reglages' }, businessId);
  return { added, active, paused: plan.pause.length };
}
