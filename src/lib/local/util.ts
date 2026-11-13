/** Petits utilitaires du module LOCAL (sans dépendance serveur). */
import type { TaskKind } from '@/lib/engine/types-v2';
import { shortHash } from '@/lib/execution/util';
import type { TaskLink } from './types';

export { shortHash };

/** Même identifiant que execution/tasks.ts (`t_` + hash(businessId:key)). */
export function taskLink(key: string, kind: TaskKind, businessId?: string): TaskLink {
  const id = businessId ? `t_${shortHash(`${businessId}:${key}`, 12)}` : undefined;
  return { key, kind, id, href: id ? `/app/actions?task=${id}` : undefined };
}

export function stableHash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Nombre pseudo-aléatoire déterministe dans [0, 1). */
export function rand01(seed: string): number {
  return (stableHash(seed) % 100000) / 100000;
}

export function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000);
}

export function daysAgoIso(days: number, now: Date = new Date()): string {
  return new Date(now.getTime() - Math.max(0, days) * 86_400_000).toISOString();
}

export function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function newLocalId(prefix: string, seed: string): string {
  return `${prefix}_${shortHash(`${seed}:${Date.now()}:${Math.random()}`, 12)}`;
}

export function clamp100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(Number.isFinite(n) ? n : 0)));
}
