/**
 * Baromètre Repéré de la visibilité IA : statistiques agrégées et anonymes calculées à partir des audits.
 *
 * - Lecture seule. Avec Supabase : table `audits` (colonnes score, mention_rate, share_of_voice, sub_scores,
 *   demo, created_at, result->segment). Sinon : store local `.data/audits.json` (même emplacement que src/lib/db.ts).
 * - Les audits de démonstration (`demo = true`, id `demo-*`) sont exclus.
 * - Aucune donnée nominative n'est renvoyée : uniquement des agrégats.
 * - `getStudyStats()` renvoie `null` sous STUDY_MIN_AUDITS (30) ; la publication des chiffres sur le site
 *   n'a lieu qu'à partir de STUDY_PUBLISH_AT (200) audits.
 *
 * Fichier serveur uniquement.
 */
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

export const STUDY_MIN_AUDITS = 30;
export const STUDY_PUBLISH_AT = 200;
/** Seuil sous lequel un segment ou une IA n'est pas détaillé (évite les sous-échantillons trop petits). */
export const STUDY_MIN_SUBGROUP = 30;

export type StudyProvider = 'chatgpt' | 'gemini' | 'perplexity' | 'claude' | 'copilot';
export type StudySegment = 'local' | 'pme' | 'ecommerce' | 'inconnu';

export interface StudyStats {
  /** nombre d'audits pris en compte */
  count: number;
  /** premier et dernier audit pris en compte (ISO) */
  periodStart: string;
  periodEnd: string;
  /** date de calcul (ISO) */
  computedAt: string;
  score: { median: number; mean: number; p25: number; p75: number };
  /** part des audits par tranche de score (0-39, 40-69, 70-100), en % arrondis */
  bands: { invisible: number; peuVisible: number; bienRecommande: number };
  /** part des audits où l'entreprise n'est citée dans aucune réponse, en % */
  neverMentioned: number;
  /** taux de mention médian (0-100) */
  mentionRateMedian: number;
  /** part de voix médiane face aux concurrents cités (0-100) */
  shareOfVoiceMedian: number;
  /** score médian par IA (seulement si au moins STUDY_MIN_SUBGROUP audits mesurés sur cette IA) */
  byProvider: Partial<Record<StudyProvider, { n: number; median: number }>>;
  /** répartition par parcours (n et score médian si n ≥ STUDY_MIN_SUBGROUP) */
  bySegment: Partial<Record<StudySegment, { n: number; median: number | null }>>;
}

interface Row {
  score: number;
  mentionRate: number;
  shareOfVoice: number;
  subScores: Record<string, number | null>;
  segment: StudySegment;
  createdAt: string;
}

const PROVIDERS: StudyProvider[] = ['chatgpt', 'gemini', 'perplexity', 'claude', 'copilot'];

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}
const median = (xs: number[]) => quantile([...xs].sort((a, b) => a - b), 0.5);
const pct = (n: number, d: number) => (d ? Math.round((100 * n) / d) : 0);
const r1 = (x: number) => Math.round(x * 10) / 10;
/** taux stocké en 0-1 ou 0-100 → 0-100 */
const as100 = (x: number) => (x <= 1 ? x * 100 : x);

function normSegment(s: unknown): StudySegment {
  return s === 'local' || s === 'pme' || s === 'ecommerce' ? s : 'inconnu';
}

async function readSupabase(): Promise<Row[] | null> {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) return null;
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const rows: Row[] = [];
  const page = 1000;
  for (let from = 0; from < 50_000; from += page) {
    const { data, error } = await sb
      .from('audits')
      .select('id, score, mention_rate, share_of_voice, sub_scores, demo, created_at, segment:result->>segment')
      .eq('status', 'done')
      .order('created_at', { ascending: true })
      .range(from, from + page - 1);
    if (error) throw new Error(`[studies] lecture des audits : ${error.message}`);
    for (const d of (data ?? []) as Record<string, unknown>[]) {
      if (d.demo || String(d.id).startsWith('demo-') || typeof d.score !== 'number') continue;
      rows.push({
        score: d.score,
        mentionRate: Number(d.mention_rate ?? 0),
        shareOfVoice: Number(d.share_of_voice ?? 0),
        subScores: (d.sub_scores as Record<string, number | null>) ?? {},
        segment: normSegment(d.segment),
        createdAt: String(d.created_at),
      });
    }
    if (!data || data.length < page) break;
  }
  return rows;
}

async function readLocal(): Promise<Row[]> {
  const dirs = [process.env.DATA_DIR, path.join(process.cwd(), '.data'), path.join(os.tmpdir(), 'repere-data')].filter(
    (d): d is string => Boolean(d),
  );
  for (const dir of dirs) {
    try {
      const raw = JSON.parse(await fs.readFile(path.join(dir, 'audits.json'), 'utf8')) as Record<
        string,
        { result?: Record<string, unknown> }
      >;
      const rows: Row[] = [];
      for (const [id, v] of Object.entries(raw)) {
        const r = v?.result;
        if (!r || r.demo || id.startsWith('demo-') || typeof r.score !== 'number') continue;
        rows.push({
          score: r.score,
          mentionRate: Number(r.mentionRate ?? 0),
          shareOfVoice: Number(r.shareOfVoice ?? 0),
          subScores: (r.subScores as Record<string, number | null>) ?? {},
          segment: normSegment(r.segment),
          createdAt: String(r.createdAt ?? ''),
        });
      }
      return rows;
    } catch {
      /* fichier absent : dossier suivant */
    }
  }
  return [];
}

/** Calcule les agrégats à partir de lignes déjà filtrées (exporté pour les tests). */
export function computeStudyStats(rows: Row[], now = new Date()): StudyStats | null {
  if (rows.length < STUDY_MIN_AUDITS) return null;
  const scores = rows.map((r) => r.score).sort((a, b) => a - b);
  const dates = rows.map((r) => r.createdAt).filter(Boolean).sort();
  const n = rows.length;

  const byProvider: StudyStats['byProvider'] = {};
  for (const p of PROVIDERS) {
    const xs = rows.map((r) => r.subScores?.[p]).filter((x): x is number => typeof x === 'number');
    if (xs.length >= STUDY_MIN_SUBGROUP) byProvider[p] = { n: xs.length, median: Math.round(median(xs)) };
  }

  const bySegment: StudyStats['bySegment'] = {};
  for (const s of ['local', 'pme', 'ecommerce', 'inconnu'] as StudySegment[]) {
    const xs = rows.filter((r) => r.segment === s).map((r) => r.score);
    if (xs.length) bySegment[s] = { n: xs.length, median: xs.length >= STUDY_MIN_SUBGROUP ? Math.round(median(xs)) : null };
  }

  return {
    count: n,
    periodStart: dates[0] ?? now.toISOString(),
    periodEnd: dates[dates.length - 1] ?? now.toISOString(),
    computedAt: now.toISOString(),
    score: {
      median: Math.round(quantile(scores, 0.5)),
      mean: r1(scores.reduce((a, b) => a + b, 0) / n),
      p25: Math.round(quantile(scores, 0.25)),
      p75: Math.round(quantile(scores, 0.75)),
    },
    bands: {
      invisible: pct(scores.filter((s) => s <= 39).length, n),
      peuVisible: pct(scores.filter((s) => s >= 40 && s <= 69).length, n),
      bienRecommande: pct(scores.filter((s) => s >= 70).length, n),
    },
    neverMentioned: pct(rows.filter((r) => r.mentionRate === 0).length, n),
    mentionRateMedian: r1(median(rows.map((r) => as100(r.mentionRate)))),
    shareOfVoiceMedian: r1(median(rows.map((r) => as100(r.shareOfVoice)))),
    byProvider,
    bySegment,
  };
}

/**
 * Statistiques agrégées du Baromètre. `null` s'il y a moins de STUDY_MIN_AUDITS audits réels,
 * ou si le store est illisible (la page affiche alors l'état « collecte en cours »).
 */
export async function getStudyStats(): Promise<StudyStats | null> {
  try {
    const rows = (await readSupabase()) ?? (await readLocal());
    return computeStudyStats(rows);
  } catch (e) {
    console.warn('[studies] statistiques indisponibles', e);
    return null;
  }
}

/** Nombre d'audits réels collectés (pour la jauge de progression), sans autre détail. */
export async function getStudyProgress(): Promise<number> {
  const s = await getStudyStats();
  return s?.count ?? 0;
}

/* ------------------------------------------------------------------ */
/* Catalogue des études publiées                                       */
/* ------------------------------------------------------------------ */

export interface StudyMeta {
  slug: string;
  title: string;
  description: string;
  published: string;
  updated: string;
}

export const STUDIES: StudyMeta[] = [
  {
    slug: 'barometre-visibilite-ia',
    title: 'Baromètre Repéré de la visibilité IA des entreprises françaises',
    description:
      "À quelle fréquence ChatGPT, Gemini et Perplexity citent-ils les entreprises françaises ? Méthode, état de la collecte et résultats agrégés des audits Repéré, publiés à partir de 200 audits.",
    published: '2026-11-09',
    updated: '2026-11-09',
  },
  {
    slug: 'ce-que-nous-savons-deja',
    title: 'Recherche IA en France : ce que nous savons déjà (synthèse des études publiques)',
    description:
      "Synthèse sourcée des études publiques 2025-2026 sur l'usage des IA génératives en France, les sources citées par ChatGPT, l'exactitude des réponses et le trafic venu des IA.",
    published: '2026-11-09',
    updated: '2026-11-09',
  },
];

export const getStudy = (slug: string) => STUDIES.find((s) => s.slug === slug);
export const studyPath = (s: StudyMeta | string) => `/etudes/${typeof s === 'string' ? s : s.slug}`;
