/**
 * Lecture publique des baromètres (pages /barometre, API v5, sitemap, llms.txt).
 * Règle : seules les éditions RÉELLES et publiables sont servies. Une édition simulée n'est lisible que par
 * l'aperçu de développement local (BAROMETRE_DEMO_PREVIEW=1 hors production), jamais par le sitemap ni llms.txt.
 * Les retraits demandés par les entreprises s'appliquent aussi au rendu (sans attendre le prochain calcul).
 */
import { PROVIDER_LABELS } from '../engine/types';
import { withdrawalKey } from './names';
import { isPublishable, latestDemoEdition, listAllEditions, listEditions, withdrawnKeys } from './storage';
import type { BarometreEdition, EditionSummary } from './types';

export const BAROMETRE_BASE = '/barometre';
export const barometrePath = (slug: string) => `${BAROMETRE_BASE}/${slug}`;
export const csvPath = (slug: string, period?: string) => `${barometrePath(slug)}/donnees.csv${period ? `?periode=${period}` : ''}`;

/** Aperçu des éditions simulées : développement local uniquement, sur demande explicite. */
export function demoPreviewAllowed(env: Record<string, string | undefined> = process.env): boolean {
  return env.NODE_ENV !== 'production' && !env.VERCEL_ENV && env.BAROMETRE_DEMO_PREVIEW === '1';
}

/** Retire les lignes des entreprises ayant demandé leur retrait et renumérote. */
export function applyWithdrawals(e: BarometreEdition, keys: Set<string>): BarometreEdition {
  if (!keys.size) return e;
  const kept = e.ranking.filter((r) => ![r.name, ...r.variants].some((v) => keys.has(withdrawalKey(v))));
  if (kept.length === e.ranking.length) return e;
  const ranking = kept.map((r, i) => ({ ...r, rank: i + 1, tiedWithPrevious: i > 0 && kept[i - 1].rateLow <= r.rateHigh }));
  return { ...e, ranking, withdrawnCount: e.withdrawnCount + (e.ranking.length - kept.length) };
}

/** Dernière édition publiable d'un baromètre (ou celle du mois demandé), retraits appliqués. */
export async function getPublicEdition(slug: string, period?: string): Promise<BarometreEdition | null> {
  const eds = (await listEditions(slug)).filter(isPublishable);
  const e = period ? eds.find((x) => x.period === period) : eds[0];
  if (!e) return null;
  return applyWithdrawals(e, await withdrawnKeys(slug));
}

export interface PageData {
  edition: BarometreEdition;
  demo: boolean;
  /** mois publiés (du plus récent au plus ancien) */
  history: { period: string; measuredTo: string }[];
}

/** Données d'une page /barometre/[slug] : réel publiable, sinon aperçu simulé si autorisé, sinon null (404). */
export async function getPageData(slug: string, env: Record<string, string | undefined> = process.env): Promise<PageData | null> {
  if (!/^[a-z0-9-]{2,80}$/.test(slug)) return null;
  const real = await getPublicEdition(slug);
  if (real) {
    const history = (await listEditions(slug)).filter(isPublishable).map((e) => ({ period: e.period, measuredTo: e.measuredTo }));
    return { edition: real, demo: false, history };
  }
  if (!demoPreviewAllowed(env)) return null;
  const d = await latestDemoEdition(slug);
  return d ? { edition: { ...d, demo: true }, demo: true, history: [] } : null;
}

function summary(e: BarometreEdition): EditionSummary {
  return {
    slug: e.slug,
    title: e.def.title,
    segment: e.def.segment,
    period: e.period,
    measuredTo: e.measuredTo,
    answersValid: e.answersValid,
    providers: e.providers,
    top: e.ranking.slice(0, 3).map((r) => ({ name: r.name, rate: r.rate })),
  };
}

/** Baromètres publiés (dernière édition publiable de chacun), du plus récent au plus ancien. */
export async function listPublished(): Promise<EditionSummary[]> {
  const latest = new Map<string, BarometreEdition>();
  for (const e of await listAllEditions()) {
    if (!isPublishable(e)) continue;
    const cur = latest.get(e.slug);
    if (!cur || e.period > cur.period) latest.set(e.slug, e);
  }
  const out: EditionSummary[] = [];
  for (const e of latest.values()) out.push(summary(applyWithdrawals(e, await withdrawnKeys(e.slug))));
  return out.sort((a, b) => b.period.localeCompare(a.period) || a.title.localeCompare(b.title, 'fr'));
}

/** Entrées pour sitemap.xml et llms.txt (vide tant qu'aucun baromètre réel n'est publié). */
export async function publishedEntries(): Promise<{ path: string; title: string; lastModified: string }[]> {
  const list = await listPublished();
  if (!list.length) return [];
  return [
    { path: BAROMETRE_BASE, title: 'Baromètres : qui les IA recommandent', lastModified: list.map((x) => x.measuredTo).sort().at(-1)!.slice(0, 10) },
    ...list.map((x) => ({ path: barometrePath(x.slug), title: `Qui les IA recommandent : ${x.title}`, lastModified: x.measuredTo.slice(0, 10) })),
  ];
}

/* ------------------------------------------------------------------ */
/* Formats                                                             */
/* ------------------------------------------------------------------ */

export const pct = (x: number, digits = 0) => `${(x * 100).toFixed(digits).replace('.', ',')} %`;

export function periodLabel(period: string): string {
  const [y, m] = period.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function csvCell(v: unknown): string {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // pas d'injection de formule dans un tableur
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV (séparateur « ; », décimales en point, UTF-8 avec BOM) : une ligne par entreprise publiée. */
export function editionToCsv(e: BarometreEdition): string {
  const prov = e.providers;
  const head = [
    'periode', 'barometre', 'rang', 'entreprise', 'variantes', 'site', 'taux_citation', 'taux_citation_bas_90', 'taux_citation_haut_90',
    'part_de_voix', 'part_de_voix_bas_90', 'part_de_voix_haut_90', 'reponses_citant', 'reponses_valides', 'questions_citant',
    'position_moyenne', ...prov.map((p) => `citations_${p}`), 'evolution_points', 'methode', 'simulation',
  ];
  const r4 = (x: number) => x.toFixed(4);
  const rows = e.ranking.map((r) => [
    e.period, e.slug, r.rank, r.name, r.variants.join(' | '), r.domain ?? '', r4(r.rate), r4(r.rateLow), r4(r.rateHigh), r4(r.sov),
    r4(r.sovLow), r4(r.sovHigh), r.citedAnswers, e.answersValid, r.questions, r.avgPosition ?? '',
    ...prov.map((p) => `${r.byProvider[p]?.cited ?? 0}/${r.byProvider[p]?.answers ?? 0}`),
    r.change?.kind === 'delta' ? r.change.deltaPts : r.change?.kind === 'new' ? 'nouveau' : '',
    e.methodVersion, e.demo ? 'oui' : 'non',
  ]);
  return `﻿${[head, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n')}\r\n`;
}

export const providerList = (e: Pick<BarometreEdition, 'providers'>) => e.providers.map((p) => PROVIDER_LABELS[p] ?? p).join(', ');
