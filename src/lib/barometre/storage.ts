/**
 * Stockage des baromètres (src/lib/store : table `documents` en production, fichiers .data en local).
 *
 * Collections :
 *  - barometre.raw / barometre.demo.raw : collecte brute d'un mois (reprise après interruption) ;
 *  - barometre.editions : éditions RÉELLES (une par baromètre et par mois, `version` incrémentée à chaque recalcul) ;
 *  - barometre.archive : versions remplacées (traçabilité) ;
 *  - barometre.demo : éditions simulées, JAMAIS lues par les pages publiques, le sitemap ou llms.txt ;
 *  - barometre.budget : dépense du mois (euros) ;
 *  - barometre.withdrawals : demandes de retrait traitées (noms à ne plus publier).
 * Garde-fou : `saveEdition` refuse d'écrire une édition simulée dans la collection publique, quel que soit l'appelant.
 */
import { getDoc, listDocs, putDoc } from '../store';
import { MIN_COMPLETION } from './aggregate';
import { BAROMETRE_METHOD, type BarometreEdition, type RawRun } from './types';
import { withdrawalKey } from './names';

export const COLL = {
  raw: 'barometre.raw',
  demoRaw: 'barometre.demo.raw',
  editions: 'barometre.editions',
  archive: 'barometre.archive',
  demo: 'barometre.demo',
  budget: 'barometre.budget',
  withdrawals: 'barometre.withdrawals',
} as const;

/** Réponses valides minimales pour publier (8 questions × 2 IA × 3 passages). */
export const MIN_VALID_ANSWERS = 48;
/** Entreprises vérifiées minimales pour publier un classement. */
export const MIN_RANKED = 3;

const DEMO_MODEL = /demo|mock|simul/i;

export const editionId = (slug: string, period: string) => `${slug}:${period}`;

/** Mois courant « AAAA-MM » (UTC). */
export function currentPeriod(d = new Date()): string {
  return d.toISOString().slice(0, 7);
}
export function previousPeriod(period: string): string {
  const [y, m] = period.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

/** Publiable = réel (aucune trace de simulation), complet, assez de réponses et de noms vérifiés. */
export function isPublishable(e: BarometreEdition | null | undefined): e is BarometreEdition {
  if (!e || e.demo) return false;
  if (Object.values(e.models).some((m) => !m || DEMO_MODEL.test(m))) return false;
  if (e.methodVersion !== BAROMETRE_METHOD) return false;
  if (e.status !== 'complete') return false;
  if (e.answersValid < MIN_VALID_ANSWERS || e.answersValid < MIN_COMPLETION * e.answersPlanned) return false;
  return e.ranking.length >= MIN_RANKED;
}

export class DemoPublicationError extends Error {
  constructor(slug: string) {
    super(`[barometre] refus : l'édition simulée ${slug} ne peut pas être écrite dans les éditions publiques`);
    this.name = 'DemoPublicationError';
  }
}

/* ------------------------------------------------------------------ */
/* Collecte brute                                                      */
/* ------------------------------------------------------------------ */

export async function loadRaw(slug: string, period: string, demo: boolean): Promise<RawRun | null> {
  return (await getDoc<RawRun>(demo ? COLL.demoRaw : COLL.raw, editionId(slug, period)))?.data ?? null;
}
export async function saveRaw(raw: RawRun): Promise<void> {
  await putDoc(raw.demo ? COLL.demoRaw : COLL.raw, editionId(raw.slug, raw.period), raw, raw.slug);
}

/* ------------------------------------------------------------------ */
/* Éditions                                                            */
/* ------------------------------------------------------------------ */

/** Écrit une édition. Simulée → collection démo ; réelle → éditions publiques (version précédente archivée). */
export async function saveEdition(e: BarometreEdition, opts: { target?: 'public' | 'demo' } = {}): Promise<BarometreEdition> {
  const looksDemo = e.demo || Object.values(e.models).some((m) => !m || DEMO_MODEL.test(m));
  if (opts.target === 'public' && looksDemo) throw new DemoPublicationError(e.slug);
  if (looksDemo) {
    const stored = { ...e, demo: true };
    await putDoc(COLL.demo, editionId(e.slug, e.period), stored, e.slug);
    return stored;
  }
  const id = editionId(e.slug, e.period);
  const prev = (await getDoc<BarometreEdition>(COLL.editions, id))?.data;
  const version = prev ? prev.version + 1 : 1;
  if (prev) await putDoc(COLL.archive, `${id}:v${prev.version}`, prev, e.slug);
  const stored = { ...e, version };
  await putDoc(COLL.editions, id, stored, e.slug);
  return stored;
}

export async function getEdition(slug: string, period: string, demo = false): Promise<BarometreEdition | null> {
  return (await getDoc<BarometreEdition>(demo ? COLL.demo : COLL.editions, editionId(slug, period)))?.data ?? null;
}

/** Éditions réelles d'un baromètre, de la plus récente à la plus ancienne. */
export async function listEditions(slug: string): Promise<BarometreEdition[]> {
  const docs = await listDocs<BarometreEdition>(COLL.editions, { businessId: slug, limit: 120 });
  return docs.map((d) => d.data).filter((e) => e.slug === slug).sort((a, b) => b.period.localeCompare(a.period));
}

export async function listAllEditions(): Promise<BarometreEdition[]> {
  const docs = await listDocs<BarometreEdition>(COLL.editions, { limit: 5000 });
  return docs.map((d) => d.data);
}

export async function latestDemoEdition(slug: string): Promise<BarometreEdition | null> {
  const docs = await listDocs<BarometreEdition>(COLL.demo, { businessId: slug, limit: 24 });
  return docs.map((d) => d.data).sort((a, b) => b.period.localeCompare(a.period))[0] ?? null;
}

/** Dernière édition publiable strictement avant `period` (base de l'évolution mois à mois). */
export async function previousPublishable(slug: string, period: string): Promise<BarometreEdition | null> {
  return (await listEditions(slug)).find((e) => e.period < period && isPublishable(e)) ?? null;
}

/* ------------------------------------------------------------------ */
/* Budget                                                              */
/* ------------------------------------------------------------------ */

export interface BudgetDoc {
  period: string;
  spentEur: number;
  bySlug: Record<string, number>;
}

/** Registre de dépense du mois : réservation avant chaque appel, écriture aux points de sauvegarde. */
export class BudgetLedger {
  private dirty = false;
  constructor(
    public readonly period: string,
    public readonly limitEur: number,
    public spentEur = 0,
    public bySlug: Record<string, number> = {},
    private readonly persistFn: ((d: BudgetDoc) => Promise<void>) | null = null,
  ) {}
  remaining(): number {
    return Math.max(0, this.limitEur - this.spentEur);
  }
  tryReserve(slug: string, cost: number): boolean {
    if (cost <= 0) return true;
    if (this.spentEur + cost > this.limitEur + 1e-9) return false;
    this.spentEur += cost;
    this.bySlug[slug] = (this.bySlug[slug] ?? 0) + cost;
    this.dirty = true;
    return true;
  }
  async persist(): Promise<void> {
    if (!this.dirty || !this.persistFn) return;
    this.dirty = false;
    await this.persistFn({ period: this.period, spentEur: this.spentEur, bySlug: this.bySlug });
  }
}

/** Registre du mois, stocké dans barometre.budget (les simulations ont leur propre registre, jamais mélangé). */
export async function loadBudget(period: string, limitEur: number, demo = false): Promise<BudgetLedger> {
  const id = demo ? `demo:${period}` : period;
  const doc = (await getDoc<BudgetDoc>(COLL.budget, id))?.data;
  return new BudgetLedger(period, limitEur, doc?.spentEur ?? 0, { ...(doc?.bySlug ?? {}) }, async (d) => {
    await putDoc(COLL.budget, id, d);
  });
}

/* ------------------------------------------------------------------ */
/* Retraits                                                            */
/* ------------------------------------------------------------------ */

export interface Withdrawal {
  name: string;
  key: string;
  requestedAt: string;
  /** baromètres concernés ; vide = tous */
  slugs: string[];
  note?: string;
}

/** Enregistre une demande de retrait traitée (appliquée au prochain calcul ET au rendu des pages). */
export async function addWithdrawal(name: string, slugs: string[] = [], note?: string, now = new Date().toISOString()): Promise<Withdrawal> {
  const w: Withdrawal = { name, key: withdrawalKey(name), requestedAt: now, slugs, ...(note ? { note } : {}) };
  await putDoc(COLL.withdrawals, w.key, w);
  return w;
}

export async function withdrawnKeys(slug: string): Promise<Set<string>> {
  const docs = await listDocs<Withdrawal>(COLL.withdrawals, { limit: 5000 });
  return new Set(docs.map((d) => d.data).filter((w) => !w.slugs.length || w.slugs.includes(slug)).map((w) => w.key));
}
