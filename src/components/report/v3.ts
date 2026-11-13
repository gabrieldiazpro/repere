// Dérivations V3 du rapport (pures, partagées par la page /rapport/[id] et le PDF).
// Règle : une seule fonction de calcul par chiffre. Marge d'erreur, matrice thème × IA et URL citées viennent du
// moteur (src/lib/engine/analytics.ts, sources) ; rang et comptages viennent de auditStats (src/lib/digest/stats.ts).
import { computeMargins, buildVoiceMatrix } from '@/lib/engine/analytics';
import { THEME_LABEL } from '@/lib/engine/queries-v3';
import type { ProviderId } from '@/lib/engine/types';
import type { UrlStat, VoiceMatrix } from '@/lib/engine/types-v3';
import { auditStats } from '@/lib/digest/stats';
import { segmentOf, type ReportResult } from './adapters';

/* ---------- Marge d'erreur ---------- */

export interface MarginView {
  score: number;
  low: number;
  high: number;
  /** demi-largeur arrondie, affichée « ± n » */
  margin: number;
  /** « 42 ± 6 » */
  short: string;
  /** phrase pour les lecteurs : intervalle et méthode */
  long: string;
  /** taux de citation (0-100) et sa marge, en points */
  mention: { value: number; margin: number } | null;
}

/** Marge du score : `result.margins` du moteur, recalculée par la même fonction si l'audit est antérieur à la V3. */
export function marginOf(r: ReportResult): MarginView {
  let m = r.margins ?? null;
  if (!m && r.mentions?.length && r.range) {
    try {
      m = computeMargins(r);
    } catch {
      m = null;
    }
  }
  const score = Math.round(r.score);
  const low = Math.round(m?.score.low ?? r.range?.low ?? score);
  const high = Math.round(m?.score.high ?? r.range?.high ?? score);
  const margin = Math.max(0, Math.round(m?.score.margin ?? (high - low) / 2));
  const questions = m?.questions ?? 0;
  const mention = m
    ? { value: Math.round(m.mentionRate.value * 100), margin: Math.round(m.mentionRate.margin * 100) }
    : null;
  return {
    score,
    low,
    high,
    margin,
    short: margin > 0 ? `${score} ± ${margin}` : `${score}`,
    long:
      margin > 0
        ? `Intervalle à 90 % : entre ${low} et ${high}${questions ? `, calculé en rééchantillonnant les ${questions} questions` : ''}.`
        : 'Mesure sur peu de réponses : la marge d’erreur n’a pas pu être calculée.',
    mention,
  };
}

/* ---------- URL citées ---------- */

export interface CitedUrl {
  url: string;
  domain: string;
  title: string | null;
  citations: number;
  providers: ProviderId[];
  clientPresent: boolean;
  competitors: string[];
}

/** Les URL les plus citées par les IA (agrégat `sources.urls` du moteur), sinon les exemples d'URL par domaine. */
export function citedUrls(r: ReportResult, max = 5): CitedUrl[] {
  const urls: UrlStat[] = r.sources?.urls ?? [];
  if (urls.length) {
    return [...urls]
      .sort((a, b) => b.citations - a.citations || (a.bestPosition ?? 99) - (b.bestPosition ?? 99) || a.url.localeCompare(b.url))
      .slice(0, max)
      .map((u) => ({
        url: u.url,
        domain: u.domain,
        title: u.title?.trim() || null,
        citations: u.citations,
        providers: u.providers,
        clientPresent: u.clientPresent,
        competitors: u.competitorsPresent ?? [],
      }));
  }
  const out: CitedUrl[] = [];
  for (const d of [...(r.sources?.domains ?? [])].sort((a, b) => b.citations - a.citations)) {
    for (const url of d.sampleUrls ?? []) {
      if (out.length >= max) return out;
      if (out.some((o) => o.url === url)) continue;
      out.push({
        url,
        domain: d.domain,
        title: null,
        citations: d.citations,
        providers: d.providers,
        clientPresent: d.clientPresence === 'present',
        competitors: d.competitorsPresent ?? [],
      });
    }
  }
  return out;
}

/** Affichage court d'une URL : domaine + chemin tronqué, sans protocole ni paramètres. */
export function shortUrl(url: string, max = 64): string {
  try {
    const u = new URL(url);
    const s = `${u.hostname.replace(/^www\./, '')}${u.pathname === '/' ? '' : u.pathname}`;
    return s.length > max ? `${s.slice(0, max - 1)}…` : s;
  } catch {
    return url.length > max ? `${url.slice(0, max - 1)}…` : url;
  }
}

/** Seules les URL http(s) deviennent des liens (jamais javascript:, data:…). */
export function safeHref(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}

/* ---------- Matrice thème × IA ---------- */

export interface VoiceView {
  themes: { id: string; label: string }[];
  providers: ProviderId[];
  /** cells[i][j] : taux de citation 0-100 et nombre de réponses, null si non mesuré */
  cells: ({ rate: number; cited: number; answers: number; leader: string | null } | null)[][];
}

/** Matrice thème × IA du moteur (`result.voice`, sinon `buildVoiceMatrix`). null si moins de 2 thèmes ou 2 IA. */
export function voiceOf(r: ReportResult): VoiceView | null {
  let m: VoiceMatrix | null = r.voice ?? null;
  if (!m && r.answers?.length && r.mentions?.length) {
    try {
      m = buildVoiceMatrix(r);
    } catch {
      m = null;
    }
  }
  if (!m || m.themes.length < 2 || m.providers.length < 2) return null;
  const cells = m.cells.map((row) =>
    row.map((c) =>
      c && c.answers > 0
        ? {
            rate: Math.round(c.mentionRate * 100),
            cited: c.cited,
            answers: c.answers,
            leader: c.leaders.find((l) => !l.client && l.mentions > 0)?.name ?? null,
          }
        : null,
    ),
  );
  if (!cells.some((row) => row.some(Boolean))) return null;
  return {
    themes: m.themes.map((t) => ({ id: t, label: themeLabel(t) })),
    providers: m.providers,
    cells,
  };
}

export function themeLabel(t: string): string {
  const known = (THEME_LABEL as Record<string, string>)[t];
  if (known) return known;
  const s = t.replace(/[-_]+/g, ' ').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Autre';
}

/* ---------- Synthèse en 5 secondes ---------- */

export interface Summary {
  margin: MarginView;
  rank: number;
  of: number;
  rankLabel: string;
  cited: number;
  answers: number;
  /** une seule action, la plus utile */
  action: { title: string; why: string; href: string };
}

/**
 * L'action unique de la synthèse, par ordre de gravité : une erreur factuelle, puis la source où les concurrents
 * sont et pas vous, puis la première action du moteur.
 */
export function summaryOf(r: ReportResult): Summary {
  const st = auditStats(r);
  const errors = r.factCheck?.items.filter((i) => i.verdict === 'faux') ?? [];
  const opp = (r.sources?.opportunities ?? []).find((o) => o.competitorsPresent.length > 0);
  const top = r.topActions?.[0];
  let action: Summary['action'];
  if (errors.length) {
    const e = errors[0];
    action = {
      title: 'Corriger l’information fausse donnée par les IA',
      why: `L’IA annonce « ${clip(e.stated, 60)} » au lieu de « ${clip(e.expected, 60)} ».`,
      href: '#verite',
    };
  } else if (opp) {
    action = {
      title: opp.action,
      why: `${opp.competitorsPresent.slice(0, 2).join(' et ')} ${opp.competitorsPresent.length > 1 ? 'y sont' : 'y est'}, pas vous. Les IA lisent cette source quand elles répondent sur votre sujet.`,
      href: '#sources',
    };
  } else if (top) {
    action = { title: top.title, why: top.why, href: '#pour-vous' };
  } else {
    action = {
      title: segmentOf(r) === 'local' ? 'Compléter votre fiche Google' : 'Publier une page qui répond aux questions de vos acheteurs',
      why: 'C’est la base que lisent les IA quand elles parlent de vous.',
      href: '#pour-vous',
    };
  }
  return { margin: marginOf(r), rank: st.rank, of: st.of, rankLabel: st.label, cited: st.citations, answers: st.answers, action };
}

function clip(s: string, n: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

/* ---------- Conversion ---------- */

/** Identifiant de l'offre gratuite Découverte du parcours (src/lib/plans.ts). */
export function decouvertePlanId(r: ReportResult): 'local_decouverte' | 'pme_decouverte' | 'ecom_decouverte' {
  const seg = segmentOf(r);
  return seg === 'pme' ? 'pme_decouverte' : seg === 'ecommerce' ? 'ecom_decouverte' : 'local_decouverte';
}

/** Lien « Créer mon compte gratuit » : l'audit est rattaché au compte créé (agent COMPTES). */
export function signupHref(r: ReportResult): string {
  return `/inscription?audit=${encodeURIComponent(r.id)}&offre=${decouvertePlanId(r)}`;
}

/** Ancres de la navigation collante, dans l'ordre de la page. */
export const REPORT_ANCHORS: { id: string; label: string }[] = [
  { id: 'synthese', label: 'Synthèse' },
  { id: 'verite', label: 'Erreurs des IA' },
  { id: 'sources', label: 'Sources' },
  { id: 'pourquoi', label: 'Concurrents' },
  { id: 'themes', label: 'Thèmes × IA' },
  { id: 'perception', label: 'Ce qu’elles disent' },
  { id: 'questions', label: 'Questions' },
  { id: 'pour-vous', label: 'On le fait pour vous' },
  { id: 'offres', label: 'Offres' },
];

/* ---------- V4 : les 3 constats de la synthèse ---------- */

export type FindingTone = 'bad' | 'warn' | 'good';

export interface Finding {
  tone: FindingTone;
  /** le chiffre ou le mot-clé, lu en premier */
  big: string;
  /** le constat en une phrase */
  text: string;
  /** étiquette courte au-dessus (facultative) */
  label?: string;
  href: string;
}

/**
 * Les 3 constats les plus importants, par ordre de lecture : présence dans les réponses, place face au premier
 * concurrent, puis l'action la plus utile (une erreur factuelle passe devant tout). Mêmes chiffres que la synthèse.
 */
export function findingsOf(
  summary: Summary,
  leader: { name: string; mentions: number } | null,
  youMentions: number,
): Finding[] {
  const { cited, answers, rank, of, action } = summary;
  const pct = answers ? Math.round((cited / answers) * 100) : 0;
  const out: Finding[] = [];
  out.push({
    tone: pct < 20 ? 'bad' : pct < 50 ? 'warn' : 'good',
    big: `${cited} sur ${answers}`,
    text:
      cited === 0
        ? 'Aucune réponse des IA ne vous cite.'
        : `réponse${cited > 1 ? 's' : ''} des IA vous cite${cited > 1 ? 'nt' : ''} (${pct} %).`,
    href: '#questions',
  });
  if (leader && rank > 1) {
    out.push({
      tone: rank <= 3 ? 'warn' : 'bad',
      big: `${rank}${rank === 1 ? 'ᵉʳ' : 'ᵉ'} sur ${of}`,
      text: `${leader.name} est cité dans ${leader.mentions} réponse${leader.mentions > 1 ? 's' : ''}, vous dans ${youMentions}.`,
      href: '#pourquoi',
    });
  } else if (of > 1) {
    out.push({ tone: 'good', big: `1ᵉʳ sur ${of}`, text: 'Vous êtes l’acteur le plus cité. L’enjeu : garder cette place.', href: '#pourquoi' });
  }
  out.push({
    tone: action.href === '#verite' ? 'bad' : 'warn',
    label: 'À faire en premier',
    big: action.title,
    text: action.why,
    href: action.href,
  });
  return out.slice(0, 3);
}

/** Extrait court (≈ 160 caractères) d'une réponse d'IA, coupé sur un mot. */
export function shortQuote(text: string, max = 170): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.lastIndexOf(' ', max - 1);
  return `${t.slice(0, cut > max * 0.6 ? cut : max - 1).replace(/[,;:.…\s]+$/, '')} …`;
}
