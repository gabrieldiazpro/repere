/**
 * V8 (TEST-MARQUE) — « Votre marque est-elle citée par les IA ? » : lecture d'un audit moteur (src/lib/engine) en
 * tableau question × IA : cité ou non, à quelle place, qui est cité à la place, phrase extraite, sources lues.
 * Fonctions PURES (aucun réseau). La marge d'erreur est un intervalle de Wilson à 90 % : une seule mesure sur
 * quelques questions ne dit pas tout, d'où « mesure unique, à confirmer dans le temps ».
 */
import { registrableDomain } from '@/lib/engine/detect';
import { PROVIDER_LABELS, type AuditResult, type ProviderAnswer } from '@/lib/engine/types';
import type { BrandTest, BrandTestCell, BrandTestProvider, CitationRate } from './types';

export const BRAND_TEST_MAX_QUESTIONS = 5;
export const BRAND_TEST_MIN_QUESTIONS = 3;

/** Libellé d'une IA (y compris celles ajoutées par le moteur après coup). */
export function engineLabel(id: string): string {
  return (PROVIDER_LABELS as Record<string, string>)[id] ?? id.charAt(0).toUpperCase() + id.slice(1);
}

/** Intervalle de Wilson (90 %) d'une proportion, arrondi en points de pourcentage. */
export function wilson(cited: number, asked: number, z = 1.645): CitationRate {
  if (asked <= 0) return { cited: 0, asked: 0, rate: 0, low: 0, high: 0 };
  const p = cited / asked;
  const z2 = z * z;
  const den = 1 + z2 / asked;
  const centre = (p + z2 / (2 * asked)) / den;
  const half = (z * Math.sqrt((p * (1 - p)) / asked + z2 / (4 * asked * asked))) / den;
  const pct = (x: number) => Math.max(0, Math.min(100, Math.round(x * 100)));
  return { cited, asked, rate: pct(p), low: pct(centre - half), high: pct(centre + half) };
}

const SENT_RE = /[^.!?\n]+[.!?]?/g;

function clean(t: string): string {
  return t
    .replace(/\*\*|__|`/g, '')
    .replace(/\[(\d+)\]/g, '')
    .replace(/^[\s>*#\-–•\d.)]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Première phrase de `text` qui nomme `name` (insensible aux accents), coupée à 260 caractères. */
export function sentenceWith(text: string, name: string): string | undefined {
  const n = fold(name).trim();
  if (!text || n.length < 2) return undefined;
  for (const line of text.split(/\n+/)) {
    for (const m of line.match(SENT_RE) ?? []) {
      if (fold(m).includes(n)) {
        const c = clean(m);
        if (c.length >= 8) return c.length > 260 ? `${c.slice(0, 257).trim()}…` : c;
      }
    }
  }
  return undefined;
}

function sourcesOf(a: ProviderAnswer | undefined): BrandTestCell['sources'] {
  if (!a) return [];
  const raw = a.sources?.length
    ? [...a.sources].sort((x, y) => (x.kind === 'retrieved' ? 1 : 0) - (y.kind === 'retrieved' ? 1 : 0)).map((s) => ({ url: s.url, title: s.title }))
    : a.citations.map((url) => ({ url, title: undefined as string | undefined }));
  const out: BrandTestCell['sources'] = [];
  const seen = new Set<string>();
  for (const s of raw) {
    if (!/^https?:\/\//i.test(s.url) || seen.has(s.url)) continue;
    seen.add(s.url);
    out.push({ url: s.url, domain: registrableDomain(s.url), ...(s.title ? { title: s.title.slice(0, 140) } : {}) });
    if (out.length >= 5) break;
  }
  return out;
}

/**
 * Tableau question × IA d'un audit. Une seule exécution par question et par IA (la première) : c'est une mesure
 * unique. Les réponses en erreur ou sans recommandation sont montrées, mais exclues du taux.
 */
export function buildBrandTest(r: AuditResult, opts: { brand: string; notConfigured?: string[]; reusedAt?: string } ): BrandTest {
  const providers = r.providersUsed?.length ? r.providersUsed : [...new Set(r.answers.map((a) => a.provider))];
  const firstRun = (xs: { provider: string; queryId: string; run: number }[], p: string, q: string) =>
    xs.filter((x) => x.provider === p && x.queryId === q).sort((a, b) => a.run - b.run)[0];
  const questions = r.queries
    .filter((q) => q.kind !== 'brand')
    .map((q) => ({
      id: q.id,
      text: q.text,
      cells: providers.map((p): BrandTestCell => {
        const a = firstRun(r.answers, p, q.id) as ProviderAnswer | undefined;
        const m = firstRun(r.mentions, p, q.id) as (typeof r.mentions)[number] | undefined;
        const base = { provider: p, label: engineLabel(p), ...(a?.model ? { model: a.model } : {}) };
        if (!a || a.error || !a.text?.trim() || !m) return { ...base, status: 'error', rank: null, instead: [], sources: [] };
        const sources = sourcesOf(a);
        if (m.noRec) return { ...base, status: 'no_reco', rank: null, instead: [], excerpt: clean(a.text).slice(0, 220) || undefined, sources };
        const instead = m.competitors.slice(0, 3);
        if (m.mentioned) {
          return {
            ...base,
            status: 'cited',
            rank: m.rank ?? null,
            // cités AVANT vous (votre place le dit), au plus 3
            instead: m.rank && m.rank > 1 ? instead.slice(0, Math.min(3, m.rank - 1)) : [],
            excerpt: (m.snippet && clean(m.snippet)) || sentenceWith(a.text, opts.brand),
            sources,
          };
        }
        return { ...base, status: 'not_cited', rank: null, instead, excerpt: (instead[0] && sentenceWith(a.text, instead[0])) || clean(a.text).slice(0, 200) || undefined, sources };
      }),
    }));
  const cells = questions.flatMap((q) => q.cells);
  const rateOf = (cs: BrandTestCell[]) => wilson(cs.filter((c) => c.status === 'cited').length, cs.filter((c) => c.status === 'cited' || c.status === 'not_cited').length);
  const perProvider: BrandTestProvider[] = providers.map((p) => ({ id: p, label: engineLabel(p), ...rateOf(cells.filter((c) => c.provider === p)) }));
  const overall = rateOf(cells);
  const demo = !!r.demo;
  return {
    version: 1,
    demo,
    measuredAt: r.measuredAt || r.createdAt,
    brand: opts.brand,
    questions,
    providers: perProvider,
    notConfigured: opts.notConfigured ?? [],
    overall,
    ...(opts.reusedAt ? { reused: { at: opts.reusedAt } } : {}),
    note: demo
      ? 'Démonstration : aucune IA n’est configurée sur ce serveur. Les réponses sont des exemples simulés et les concurrents sont remplacés par « Concurrent A, B… » : rien n’est mesuré.'
      : `Mesure unique : ${questions.length} questions posées une fois à ${providers.length} IA. Les réponses des IA varient d’un jour à l’autre : la fourchette indique la marge d’erreur, à confirmer dans le temps par le suivi.`,
  };
}

/** Concurrents cités à votre place, par question : nom → IA qui l'ont cité (ordre d'apparition). */
export function competitorsByQuestion(t: BrandTest): { questionId: string; question: string; competitor: string; providers: string[] }[] {
  const out: { questionId: string; question: string; competitor: string; providers: string[] }[] = [];
  for (const q of t.questions) {
    const counts = new Map<string, string[]>();
    for (const c of q.cells) {
      if (c.status !== 'not_cited' && !(c.status === 'cited' && c.instead.length)) continue;
      const first = c.instead[0];
      if (!first) continue;
      counts.set(first, [...(counts.get(first) ?? []), c.label]);
    }
    const best = [...counts.entries()].sort((a, b) => b[1].length - a[1].length)[0];
    if (best) out.push({ questionId: q.id, question: q.text, competitor: best[0], providers: best[1] });
  }
  return out;
}

/**
 * Site d'un concurrent repéré dans les réponses : URL dont le domaine ressemble au nom (sources citées, liens écrits
 * dans le texte). null si rien de probant (on ne devine pas d'adresse).
 */
export function competitorSite(name: string, answers: Pick<ProviderAnswer, 'text' | 'citations' | 'sources'>[], exclude: string[] = []): string | null {
  const tokens = fold(name)
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(' ')
    .filter((w) => w.length >= 3 && !/^(les|des|aux|chez|maison|boulangerie|restaurant|garage|cabinet|agence|atelier|societe|the)$/.test(w));
  const squash = fold(name).replace(/[^a-z0-9]+/g, '');
  if (!tokens.length && squash.length < 4) return null;
  const urls = new Set<string>();
  for (const a of answers) {
    for (const u of a.citations ?? []) urls.add(u);
    for (const s of a.sources ?? []) urls.add(s.url);
    for (const m of (a.text ?? '').match(/https?:\/\/[^\s)\]>"']+|www\.[a-z0-9.-]+\.[a-z]{2,}/gi) ?? []) urls.add(m.startsWith('http') ? m : `https://${m}`);
  }
  const ex = new Set(exclude.map((d) => registrableDomain(d)));
  for (const u of urls) {
    let host: string;
    try {
      host = new URL(u).hostname;
    } catch {
      continue;
    }
    const dom = registrableDomain(host);
    if (ex.has(dom)) continue;
    const label = dom.split('.')[0].replace(/-/g, '');
    if ((squash.length >= 4 && (label === squash || (label.length >= Math.max(6, squash.length * 0.6) && squash.includes(label)))) || (tokens.length && tokens.every((t) => label.includes(t)))) {
      return `https://${host}/`;
    }
  }
  return null;
}

/**
 * Démonstration (aucune IA configurée) : les noms de concurrents inventés par le simulateur (« Atelier Caron »,
 * « Vidal Les »…) avaient l'air de vrais commerces, et pouvaient en être un. Pour un visiteur, l'aperçu honnête est
 * « Concurrent A, B, C… (exemple simulé) » : la forme du résultat sans faux noms (TESTS-REELS, nov. 2026).
 * Remplace partout (cellules, phrases, synthèse, « pourquoi lui ») ; la marque analysée n'est jamais remplacée.
 */
export function demoPlaceholder(i: number): string {
  return `Concurrent ${String.fromCharCode(65 + (i % 26))}${i >= 26 ? Math.floor(i / 26) + 1 : ''}`;
}

export function anonymizeDemoNames<T>(value: T, names: string[], brand: string): T {
  const b = fold(brand).trim();
  const uniq = [...new Set(names.map((n) => n.trim()).filter((n) => n.length >= 2 && fold(n) !== b))];
  if (!uniq.length) return value;
  const map = new Map(uniq.map((n, i) => [n, demoPlaceholder(i)]));
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp([...map.keys()].sort((x, y) => y.length - x.length).map(esc).join('|'), 'g');
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return v.replace(re, (m) => map.get(m) ?? m);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(value) as T;
}

/** Noms de concurrents d'un test de marque (ordre d'apparition). */
export function competitorNames(t: BrandTest, extra: string[] = []): string[] {
  const out: string[] = [];
  for (const q of t.questions) for (const c of q.cells) for (const n of c.instead) if (!out.includes(n)) out.push(n);
  for (const w of t.why ?? []) if (!out.includes(w.competitor)) out.push(w.competitor);
  for (const n of extra) if (!out.includes(n)) out.push(n);
  return out;
}

/** Démonstration : seules restent les sources génériques (annuaire, carte) et le site analysé ; aucun site de concurrent. */
export function scrubDemoSources(t: BrandTest, clientUrl: string): BrandTest {
  let client = '';
  try {
    client = registrableDomain(new URL(/^https?:\/\//i.test(clientUrl) ? clientUrl : `https://${clientUrl}`).hostname);
  } catch {
    /* adresse brute */
  }
  const keep = (d: string) => d === client || /^(?:google\.[a-z.]+|pagesjaunes\.fr)$/.test(d);
  return {
    ...t,
    questions: t.questions.map((q) => ({ ...q, cells: q.cells.map((c) => ({ ...c, sources: c.sources.filter((x) => keep(x.domain)) })) })),
    ...(t.why ? { why: t.why.map((w) => ({ ...w, site: null, sources: w.sources.filter((x) => keep(x.domain)) })) } : {}),
  };
}
