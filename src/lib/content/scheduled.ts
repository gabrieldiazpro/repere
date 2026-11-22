/**
 * V8 FINALE — mesure J+30 / J+90 des contenus publiés en tâche planifiée (cron quotidien existant
 * /api/cron/monthly), en plus du calcul au chargement de /app/contenu. Lecture seule côté fournisseurs : aucune
 * mesure IA n'est lancée ici, on réutilise la dernière mesure enregistrée et la Search Console déjà synchronisée.
 * Comptes démo ignorés ; au plus `limit` espaces par passage.
 */
import { isDemoBusinessId } from '@/lib/demo-v2';
import { listDocs } from '@/lib/store';
import type { EffectInputs } from './effect';
import { DRAFTS, refreshEffects } from './service';
import type { ContentDraft } from './types';

export interface EffectSweepDeps {
  latestAudit?: (businessId: string) => Promise<EffectInputs['audit']>;
  gsc?: (businessId: string) => Promise<EffectInputs['gsc']>;
}

/** Espaces dont au moins un contenu publié attend sa mesure J+30 ou J+90. */
export async function businessesAwaitingEffect(limit = 200): Promise<string[]> {
  const ids = new Set<string>();
  for (const d of await listDocs<ContentDraft>(DRAFTS, { limit: 5000 })) {
    const x = d.data;
    if (!x?.businessId || isDemoBusinessId(x.businessId) || !x.effect || (x.effect.d30 && x.effect.d90)) continue;
    ids.add(x.businessId);
    if (ids.size >= limit) break;
  }
  return [...ids];
}

async function defaultLatestAudit(businessId: string): Promise<EffectInputs['audit']> {
  const { getLatestAuditForBusiness } = await import('@/lib/db');
  const a = await getLatestAuditForBusiness(businessId);
  return a ? { measuredAt: a.measuredAt ?? a.createdAt, mentions: a.mentions ?? [] } : null;
}

async function defaultGsc(businessId: string): Promise<EffectInputs['gsc']> {
  const { loadStored } = await import('@/lib/seodata/searchconsole');
  const s = await loadStored(businessId);
  const q = s.recent?.queries ?? [];
  return q.length ? { topQueries: q.map((r) => ({ key: r.key, impressions: r.impressions, clicks: r.clicks, position: r.position })) } : null;
}

/** Complète les mesures dues de tous les espaces concernés. Ne lève jamais : renvoie les compteurs. */
export async function sweepContentEffects(now = new Date(), deps: EffectSweepDeps = {}): Promise<{ businesses: number; measured: number; errors: number }> {
  const latestAudit = deps.latestAudit ?? defaultLatestAudit;
  const gsc = deps.gsc ?? defaultGsc;
  let measured = 0;
  let errors = 0;
  const ids = await businessesAwaitingEffect().catch(() => [] as string[]);
  for (const id of ids) {
    try {
      const [audit, g] = await Promise.all([latestAudit(id).catch(() => null), gsc(id).catch(() => null)]);
      measured += await refreshEffects(id, { audit, gsc: g }, now);
    } catch {
      errors++;
    }
  }
  return { businesses: ids.length, measured, errors };
}
