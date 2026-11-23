'use server';
// Actions serveur du simulateur de scénarios (SCENARIOS, V9) : simulation d'une sélection, lancement.
import { revalidatePath } from 'next/cache';
import { requireBusiness } from '@/lib/auth';
import { isDemoBusinessId } from '@/lib/demo-v2';
import { log } from '@/lib/log';
import { lean, simulate, type SimResult } from '@/lib/scenarios';
import { loadScenarioContext } from './_parts/data';

const MAX_KEYS = 120;
const clean = (keys: unknown): string[] =>
  Array.isArray(keys) ? [...new Set(keys.filter((k): k is string => typeof k === 'string' && /^(seo|geo):[\w.:-]{1,120}$/.test(k)))].slice(0, MAX_KEYS) : [];

export type SimulateResult = { ok: true; result: SimResult } | { ok: false; error: string };

/** Simule une sélection de corrections (lecture seule, comptes démo compris). */
export async function simulerScenario(keys: string[]): Promise<SimulateResult> {
  const c = await loadScenarioContext();
  if (!c.crawl || !c.auditor || !c.base) return { ok: false, error: 'Aucune exploration à rejouer pour l’instant.' };
  try {
    return { ok: true, result: lean(simulate(c.crawl, c.auditor, c.base, clean(keys))) };
  } catch (e) {
    log.warn('scenarios.simulate_failed', { businessId: c.suite.ws.business.id, error: e instanceof Error ? e.message : String(e) });
    return { ok: false, error: 'La simulation n’a pas abouti. Réessayez.' };
  }
}

export type LaunchActionResult =
  | { ok: true; changeSets: number; tasks: number; skipped: string[] }
  | { ok: false; error: string; code?: 'demo_read_only' | 'forbidden' | 'empty' | 'no_crawl' | 'error' };

/** Lance un scénario : brouillons pour l'agent (validation inchangée), tâches « vous » dans le Centre d'actions. */
export async function lancerScenario(keys: string[], title: string): Promise<LaunchActionResult> {
  const c = await loadScenarioContext();
  const id = c.suite.ws.business.id;
  if (c.suite.demo || isDemoBusinessId(id)) {
    return { ok: false, code: 'demo_read_only', error: 'Compte de démonstration : rien n’est créé. Dans votre espace, ce bouton prépare les brouillons de l’agent et ajoute vos tâches au Centre d’actions.' };
  }
  const list = clean(keys);
  if (!list.length) return { ok: false, code: 'empty', error: 'Choisissez au moins une correction.' };
  if (!c.crawl || !c.auditor || !c.base || !c.latest) return { ok: false, code: 'no_crawl', error: 'Relancez l’exploration de votre site avant de lancer un scénario.' };
  let actor: { id: string; email?: string; role?: string };
  try {
    const access = await requireBusiness(null, id, { write: true });
    actor = { id: access.session?.userId ?? 'owner', email: access.session?.email, role: String(access.role) };
  } catch {
    return { ok: false, code: 'forbidden', error: 'Vous n’avez pas les droits pour lancer un scénario sur cet espace.' };
  }
  try {
    const { launchScenario } = await import('@/lib/scenarios/launch');
    const b = c.suite.ws.business as { name: string; city?: string };
    const r = await launchScenario({
      businessId: id,
      crawl: c.crawl,
      auditor: c.auditor,
      base: c.base,
      run: { id: c.latest.id, at: c.latest.at },
      keys: list,
      title: (title || 'Scénario personnalisé').slice(0, 120),
      actor,
      name: b.name,
      city: b.city,
    });
    revalidatePath('/app/scenarios');
    revalidatePath('/app/actions');
    revalidatePath('/app/agent');
    return { ok: true, changeSets: r.changeSets, tasks: r.tasks, skipped: r.skipped.slice(0, 8) };
  } catch (e) {
    log.warn('scenarios.launch_failed', { businessId: id, error: e instanceof Error ? e.message : String(e) });
    return { ok: false, code: 'error', error: 'Le scénario n’a pas pu être lancé. Réessayez dans quelques minutes.' };
  }
}
