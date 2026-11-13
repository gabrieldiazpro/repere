/**
 * Les 3 tâches de la semaine (docs/v2/06-indispensable.md § 2.2) — logique pure, testable sans stockage.
 * - une tâche liée à l'événement de la semaine (erreur détectée, concurrent qui monte), si elle existe ;
 * - la plus rentable (impact / temps) ;
 * - la plus rapide ;
 * - pas deux tâches du même type ; une tâche non faite glisse une fois, puis est remplacée (mise de côté 4 semaines).
 */
import type { StoredTask } from './types';
import { priority } from './tasks';
import { addWeeks } from './util';

const OPEN = new Set(['todo', 'in_progress']);
export const WEEKLY_COUNT = 3;
export const SNOOZE_WEEKS = 4;

export interface WeeklyPick {
  week: string;
  tasks: StoredTask[]; // les 3 de la semaine
  changed: StoredTask[]; // tâches modifiées à persister
}

export function pickWeekly(all: StoredTask[], week: string): WeeklyPick {
  const tasks = all.map((t) => ({ ...t }));
  const changed = new Map<string, StoredTask>();
  const mark = (t: StoredTask) => changed.set(t.id, t);
  const prev = addWeeks(week, -1);

  // 1. Déjà choisies cette semaine (y compris faites) : on ne change pas un plan affiché.
  const chosen = tasks.filter((t) => t.week === week && t.status !== 'skipped');

  // 2. Semaines passées : glisser une fois, puis remplacer.
  for (const t of tasks) {
    if (!t.week || t.week >= week || !OPEN.has(t.status)) continue;
    if (t.week === prev && (t.carried ?? 0) < 1 && chosen.length < WEEKLY_COUNT && !chosen.some((c) => c.kind === t.kind)) {
      t.week = week;
      t.carried = (t.carried ?? 0) + 1;
      chosen.push(t);
    } else {
      t.week = undefined;
      t.carried = 0;
      t.snoozedUntil = addWeeks(week, SNOOZE_WEEKS);
    }
    mark(t);
  }

  // 3. Compléter : événement, plus rentable, plus rapide — sans doublon de type.
  const pool = () =>
    tasks.filter((t) => OPEN.has(t.status) && !t.week && (!t.snoozedUntil || t.snoozedUntil <= week) && !chosen.includes(t));
  const take = (cands: StoredTask[], strictKind = true): boolean => {
    const t = cands.find((c) => !strictKind || !chosen.some((x) => x.kind === c.kind));
    if (!t) return false;
    t.week = week;
    t.carried = 0;
    t.snoozedUntil = undefined;
    chosen.push(t);
    mark(t);
    return true;
  };
  const byPriority = (a: StoredTask, b: StoredTask) => priority(b) - priority(a) || a.id.localeCompare(b.id);
  const roles: (() => StoredTask[])[] = [
    () => pool().filter((t) => t.event).sort(byPriority),
    () => pool().sort(byPriority),
    () => pool().sort((a, b) => a.minutes - b.minutes || b.impact - a.impact || a.id.localeCompare(b.id)),
  ];
  for (const role of roles) if (chosen.length < WEEKLY_COUNT) take(role());
  // Rôles manquants (pas d'événement, ou tout est du même type) : on complète par priorité.
  while (chosen.length < WEEKLY_COUNT && take(pool().sort(byPriority))) {
    /* diversité */
  }
  while (chosen.length < WEEKLY_COUNT && take(pool().sort(byPriority), false)) {
    /* dernier recours : même type */
  }

  const order = (t: StoredTask) => (t.status === 'done' ? 1 : 0);
  return { week, tasks: chosen.slice(0, WEEKLY_COUNT).sort((a, b) => order(a) - order(b) || byPriority(a, b)), changed: [...changed.values()] };
}
