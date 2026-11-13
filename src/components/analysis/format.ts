/**
 * ANALYSE-UI — libellés, tons et diagnostics de l'analyse 60 s (purs, testés).
 */
import type { Finding, Severity } from '@/lib/crawl/types';
import type { FullAnalysis, PriorityItem } from '@/lib/analysis/types';
import type { Tone } from '@/components/ui/tone';

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: 'Bloquant',
  high: 'Important',
  medium: 'À corriger',
  low: 'Mineur',
  info: 'Info',
};

export const SEVERITY_TONE: Record<Severity, Tone> = {
  critical: 'down',
  high: 'down',
  medium: 'warn',
  low: 'neutral',
  info: 'neutral',
};

export const SOURCE_LABEL: Record<'seo' | 'geo' | 'ai', string> = { seo: 'Google', geo: 'IA', ai: 'IA' };

const PROVIDERS: Record<string, string> = {
  chatgpt: 'ChatGPT',
  openai: 'ChatGPT',
  perplexity: 'Perplexity',
  gemini: 'Gemini',
  claude: 'Claude',
  anthropic: 'Claude',
  mistral: 'Le Chat',
  copilot: 'Copilot',
};
export const providerLabel = (p: string) => PROVIDERS[p.toLowerCase()] ?? p;

/** Bande de score : même lecture partout (rouge < 40 ≤ ambre < 70 ≤ vert). */
export function scoreTone(score: number | null | undefined): Tone {
  if (score == null) return 'neutral';
  return score >= 70 ? 'up' : score >= 40 ? 'warn' : 'down';
}

export function scoreWord(score: number | null | undefined): string {
  if (score == null) return 'non mesuré';
  return score >= 70 ? 'solide' : score >= 40 ? 'à renforcer' : 'faible';
}

export function hostOf(url: string | undefined): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  }
}

/** Chemin lisible d'une URL (« / » pour l'accueil). */
export function pathOf(url: string): string {
  try {
    const u = new URL(url);
    return decodeURIComponent(u.pathname + (u.search || '')) || '/';
  } catch {
    return url;
  }
}

/** Durée réelle : « 41 s », « 1 min 04 s ». */
export function seconds(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} s`;
  return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`;
}

/** Chronomètre « 00:23 ». */
export function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function hasAutoFix(a: Pick<FullAnalysis, 'autoFixes'>, f: Finding): boolean {
  return !!f.autoFix || a.autoFixes.some((x) => x.findingId === f.id);
}

export type Problem =
  | { kind: 'robots'; host: string }
  | { kind: 'unreachable'; host: string }
  | null;

/**
 * Ce qui a empêché l'analyse de lire le site.
 * - robots : notre robot (RepereBot) a été refusé par robots.txt (page d'accueil illisible, pages vues mais bloquées).
 * - unreachable : aucune page n'a répondu.
 */
export function diagnose(a: FullAnalysis): Problem {
  const host = hostOf(a.crawl?.finalOrigin ?? a.input.url);
  const errors = Object.values(a.modules ?? {}).map((m) => m?.error ?? '').join(' ');
  const ids = new Set([...(a.seo?.sections ?? []), ...(a.geo?.sections ?? [])].flatMap((s) => s.findings.map((f) => f.id)));
  const detectFailed = a.modules?.detect?.status === 'failed';
  if (/robots|RepereBot/i.test(errors)) return { kind: 'robots', host };
  if (detectFailed && (ids.has('seo.robots.blocks_all') || (a.crawl && a.crawl.robotsFound && a.crawl.pagesFetched > 0 && a.crawl.pagesIndexable === 0))) return { kind: 'robots', host };
  if (!a.crawl || a.crawl.pagesFetched === 0) return detectFailed || a.modules?.crawl?.status !== 'ok' ? { kind: 'unreachable', host } : null;
  return null;
}

/** Modules qui n'ont pas abouti (résultat partiel), en langage clair. */
export function partialNotes(a: FullAnalysis): string[] {
  const out: string[] = [];
  const m = a.modules ?? {};
  const bad = (k: keyof FullAnalysis['modules']) => m[k] && (m[k].status === 'failed' || m[k].status === 'timeout');
  if (bad('crawl')) out.push(m.crawl.status === 'timeout' ? 'L’exploration a dépassé le temps imparti : seules les pages déjà lues sont analysées.' : 'L’exploration du site n’a pas abouti.');
  if (bad('seo')) out.push('L’audit Google n’a pas pu se terminer : son score n’est pas calculé.');
  if (bad('geo')) out.push('L’audit IA n’a pas pu se terminer : son score n’est pas calculé.');
  if (bad('ai')) out.push('Les IA n’ont pas toutes répondu à temps : le contrôle rapide n’est pas affiché.');
  if (bad('data')) out.push('La mesure de vitesse PageSpeed n’a pas abouti.');
  if (a.crawl?.truncated) out.push(`Exploration limitée aux ${a.crawl.pagesFetched} premières pages (analyse gratuite) : l’espace Repéré explore jusqu’à 2 000 pages.`);
  return out;
}

/** Toutes les sections d'un module triées du score le plus faible au plus fort (les vides à la fin). */
export function sortedSections(r: FullAnalysis['seo']) {
  return [...(r?.sections ?? [])].sort((x, y) => (y.findings.length ? 1 : 0) - (x.findings.length ? 1 : 0) || x.score - y.score);
}

/** Lien d'inscription qui rattache l'analyse (et pré-remplit site, nom, parcours). */
export function signupHref(a: FullAnalysis): string {
  const q = new URLSearchParams({ parcours: a.detected.siteType, analyse: a.id, site: a.crawl?.finalOrigin ?? a.input.url });
  if (a.detected.brand) q.set('nom', a.detected.brand);
  return `/inscription?${q.toString()}`;
}

export function priorityKey(p: PriorityItem, i: number): string {
  return `${p.source}-${p.id}-${i}`;
}
