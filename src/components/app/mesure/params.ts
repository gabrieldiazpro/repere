/**
 * État des écrans Mesure dans l'URL (période, comparaison, IA, tag, recherche) : partageable, conservé d'un écran à
 * l'autre. Fonctions pures (testées) — aucune lecture de données ici.
 */
import type { ProviderId } from '@/lib/engine/types';

export type RawSearch = Record<string, string | string[] | undefined>;

export type PeriodKey = 'dernier' | '3m' | '6m' | '12m' | 'tout';
export const PERIODS: { key: PeriodKey; label: string; short: string; months: number | null }[] = [
  { key: 'dernier', label: 'Dernière mesure', short: 'Dernière', months: 0 },
  { key: '3m', label: '3 derniers mois', short: '3 mois', months: 3 },
  { key: '6m', label: '6 derniers mois', short: '6 mois', months: 6 },
  { key: '12m', label: '12 derniers mois', short: '12 mois', months: 12 },
  { key: 'tout', label: 'Tout l’historique', short: 'Tout', months: null },
];
export const DEFAULT_PERIOD: PeriodKey = '6m';

export type VsKey = 'precedent' | 'debut';
export const VS: { key: VsKey; label: string }[] = [
  { key: 'precedent', label: 'la mesure précédente' },
  { key: 'debut', label: 'le début de la période' },
];
export const DEFAULT_VS: VsKey = 'precedent';

const PROVIDERS: ProviderId[] = ['chatgpt', 'perplexity', 'gemini', 'claude', 'mistral'];

export interface MesureParams {
  periode: PeriodKey;
  vs: VsKey;
  ia: ProviderId | null;
  tag: string | null;
  /** recherche plein texte */
  q: string;
}

export function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Paramètre texte nettoyé (longueur bornée, caractères de contrôle retirés). */
export function str(sp: RawSearch, key: string, max = 120): string {
  return (first(sp[key]) ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
}

export function parseParams(sp: RawSearch, providers: readonly ProviderId[] = PROVIDERS): MesureParams {
  const p = str(sp, 'periode', 10) as PeriodKey;
  const v = str(sp, 'vs', 12) as VsKey;
  const ia = str(sp, 'ia', 12) as ProviderId;
  const tag = str(sp, 'tag', 40).toLowerCase();
  return {
    periode: PERIODS.some((x) => x.key === p) ? p : DEFAULT_PERIOD,
    vs: VS.some((x) => x.key === v) ? v : DEFAULT_VS,
    ia: providers.includes(ia) ? ia : null,
    tag: tag || null,
    q: str(sp, 'q', 120),
  };
}

const DEFAULTS: Record<string, string> = { periode: DEFAULT_PERIOD, vs: DEFAULT_VS };

/**
 * Lien vers `path` qui conserve tous les paramètres connus de `sp`, modifiés par `patch` (null = retiré).
 * Les valeurs par défaut sont omises pour garder des URL courtes. L'ordre des clés est stable.
 */
export function hrefWith(path: string, sp: RawSearch, patch: Record<string, string | null | undefined> = {}, keep?: readonly string[]): string {
  const merged: Record<string, string> = {};
  for (const [k, raw] of Object.entries(sp)) {
    if (keep && !keep.includes(k)) continue;
    const v = first(raw);
    if (v) merged[k] = v;
  }
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === undefined || v === '') delete merged[k];
    else merged[k] = v;
  }
  const u = new URLSearchParams();
  for (const k of Object.keys(merged).sort()) if (DEFAULTS[k] !== merged[k]) u.set(k, merged[k]);
  const s = u.toString();
  return s ? `${path}?${s}` : path;
}

/** Paramètres transversaux à conserver en changeant d'écran (période, comparaison, IA, tag). */
export const SHARED_KEYS = ['periode', 'vs', 'ia', 'tag'] as const;

export function crossLink(path: string, sp: RawSearch, patch: Record<string, string | null> = {}): string {
  return hrefWith(path, sp, patch, SHARED_KEYS);
}
