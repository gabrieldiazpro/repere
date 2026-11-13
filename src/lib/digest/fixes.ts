/**
 * Suivi d'une correction après « C'est fait » (amélioration n° 8 de qa/v3/regard-client-v3.md) :
 * l'accueil ne garde pas la phrase rouge « Corriger en 15 min » quand la tâche de correction est faite ;
 * il dit « Correction faite le 10 nov. : revérification de Gemini à la prochaine mesure, le 5 déc. ».
 * Pure (aucune E/S), utilisable par l'accueil, le digest et le copilote.
 */
import type { ProviderId } from '@/lib/engine/types';
import type { BrandFactField, ExecTask, FactCheckItem } from '@/lib/engine/types-v2';
import { FACT_LABELS } from '@/lib/facts';
import { PROVIDER_LABEL } from '@/lib/alerts';

export type MeasureFrequency = 'monthly' | 'weekly' | 'daily';

const DAY = 86_400_000;

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Prochaine mesure strictement après `after`, à partir de la dernière mesure et de la fréquence de l'offre. */
export function nextMeasureAfter(lastMeasure: string, after: string, frequency: MeasureFrequency = 'monthly'): string {
  const t0 = new Date(lastMeasure);
  const limit = new Date(after).getTime();
  const d = new Date(t0);
  for (let i = 0; i < 400 && d.getTime() <= limit; i++) {
    if (frequency === 'monthly') d.setUTCMonth(d.getUTCMonth() + 1);
    else d.setTime(d.getTime() + (frequency === 'weekly' ? 7 : 1) * DAY);
  }
  return d.toISOString();
}

/** Fréquence de mesure déduite des dates d'audit (écart médian ≤ 10 jours : hebdomadaire ; sinon mensuelle). */
export function frequencyOfAudits(audits: { measuredAt?: string; createdAt: string }[]): MeasureFrequency {
  const t = audits.map((a) => new Date(a.measuredAt ?? a.createdAt).getTime()).sort((x, y) => x - y);
  const gaps = t.slice(1).map((x, i) => (x - t[i]) / DAY).sort((x, y) => x - y);
  if (!gaps.length) return 'monthly';
  const med = gaps[Math.floor(gaps.length / 2)];
  return med <= 2 ? 'daily' : med <= 10 ? 'weekly' : 'monthly';
}

/** Tâche de correction qui porte sur ce champ (titre ou livrable), la plus récente d'abord. */
export function fixTaskFor(field: BrandFactField, tasks: Pick<ExecTask, 'id' | 'kind' | 'title' | 'status' | 'doneAt' | 'minutes'>[]) {
  const label = fold(FACT_LABELS[field] ?? field);
  const fixes = tasks.filter((t) => t.kind === 'fact_fix');
  const own = fixes.filter((t) => fold(t.title).includes(label));
  const list = own.length ? own : fixes.length === 1 ? fixes : [];
  const open = list.find((t) => t.status !== 'done' && t.status !== 'skipped') ?? null;
  const done = list.filter((t) => t.status === 'done').sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''))[0] ?? null;
  return { open, done };
}

export interface FixFollowUp {
  state: 'to_fix' | 'fixed';
  task: { id: string; minutes: number } | null;
  /** date de « C'est fait » (ISO) */
  doneAt: string | null;
  /** prochaine mesure qui revérifiera l'IA (ISO) */
  recheckAt: string | null;
  /** « Correction faite le 10 nov. : nous revérifions Gemini à la prochaine mesure, le 5 déc. » */
  headline: string | null;
  provider: ProviderId;
}

const short = (iso: string) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'Europe/Paris' }).format(new Date(iso));

/**
 * État de l'erreur affichée en tête d'accueil. Une erreur encore présente dans la DERNIÈRE mesure mais dont la tâche est
 * faite APRÈS cette mesure est « corrigée, en attente de revérification » (et non plus « à corriger »).
 */
export function fixFollowUp(
  error: Pick<FactCheckItem, 'field' | 'provider'>,
  tasks: Pick<ExecTask, 'id' | 'kind' | 'title' | 'status' | 'doneAt' | 'minutes'>[],
  opts: { lastMeasure: string; frequency?: MeasureFrequency },
): FixFollowUp {
  const { open, done } = fixTaskFor(error.field, tasks);
  const ia = PROVIDER_LABEL[error.provider] ?? error.provider;
  if (open || !done) return { state: 'to_fix', task: open ? { id: open.id, minutes: open.minutes } : null, doneAt: null, recheckAt: null, headline: null, provider: error.provider };
  const doneAt = done.doneAt ?? new Date().toISOString();
  const recheckAt = nextMeasureAfter(opts.lastMeasure, doneAt > opts.lastMeasure ? doneAt : opts.lastMeasure, opts.frequency ?? 'monthly');
  return {
    state: 'fixed',
    task: { id: done.id, minutes: done.minutes },
    doneAt,
    recheckAt,
    headline: `Correction faite le ${short(doneAt)} : nous revérifions ${ia} à la prochaine mesure, le ${short(recheckAt).replace(/\.$/, '')}.`,
    provider: error.provider,
  };
}
