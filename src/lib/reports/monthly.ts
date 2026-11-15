/**
 * Rapport mensuel d'un espace (V6, agent AGENCES) — modèle pur, partagé par la version imprimable
 * (/app/rapports/mensuel) et la marque des e-mails.
 *
 * Marque : celle de l'agence si l'espace a le droit `agency.branding` et qu'un profil d'agence s'applique ;
 * sinon Repéré. Rien n'est inventé : chaque bloc sans donnée dit pourquoi (« pas encore d'audit du site »…).
 * Écarts IA : seulement contre la mesure précédente COMPARABLE et comparés à la marge d'erreur.
 */
export interface ReportBrand {
  name: string;
  logoUrl: string | null;
  color: string;
  /** « Rapport produit avec Repéré » en pied de page */
  showRepere: boolean;
  footer: string | null;
  /** marque d'agence (et non Repéré) */
  agency: boolean;
}

export const REPERE_BRAND: ReportBrand = { name: 'Repéré', logoUrl: null, color: '#3730a3', showRepere: true, footer: null, agency: false };

export function brandFromProfile(p: { name: string; logoUrl?: string | null; color: string; hideRepere: boolean; footer?: string | null } | null, allowed: boolean): ReportBrand {
  if (!p || !allowed) return REPERE_BRAND;
  return { name: p.name, logoUrl: p.logoUrl ?? null, color: /^#[0-9a-f]{6}$/i.test(p.color) ? p.color : REPERE_BRAND.color, showRepere: !p.hideRepere, footer: p.footer ?? null, agency: true };
}

export interface MonthlyInput {
  brand: ReportBrand;
  client: { name: string; descriptor: string };
  demo: boolean;
  /** du plus ancien au plus récent ; `prev` = mesure précédente comparable */
  ai: { score: number; low: number; high: number; at: string; rank: number; of: number; shareOfVoice: number; errors: number } | null;
  aiPrev: { score: number; rank: number } | null;
  aiHistory: { at: string; score: number }[];
  seo: { score: number; at: string; pages: number; fixes: { title: string; severity: string; affected: number }[] } | null;
  seoPrev: { score: number } | null;
  ranks: { keywords: number; top3: number; top10: number; up: { keyword: string; change: number; position: number | null }[]; down: { keyword: string; change: number; position: number | null }[]; demo: boolean } | null;
  agent: { applied: { title: string; at: string }[]; pending: { title: string }[] };
  now: Date;
}

export type Tone = 'good' | 'bad' | 'neutral';

export interface MonthlyReport {
  brand: ReportBrand;
  title: string;
  period: string;
  client: { name: string; descriptor: string };
  demo: boolean;
  headline: { text: string; tone: Tone };
  ai: { score: number; range: string; delta: string; tone: Tone; rank: string; share: string; errors: number; history: { at: string; score: number }[] } | null;
  seo: { score: number; delta: string; tone: Tone; pages: number; fixes: { title: string; severity: string; affected: number }[] } | null;
  ranks: MonthlyInput['ranks'];
  agent: MonthlyInput['agent'];
  notes: string[];
}

const frMonth = (d: Date) => d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'Europe/Paris' });
const frDay = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' });
const pts = (n: number) => `${n} point${Math.abs(n) > 1 ? 's' : ''}`;
const ord = (n: number) => (n === 1 ? '1er' : `${n}e`);

/** Écart IA lisible, comparé à la marge (pur). */
export function aiDelta(score: number, prev: number | null, margin: number): { text: string; tone: Tone } {
  if (prev === null) return { text: 'Première mesure de référence : l’évolution apparaîtra le mois prochain.', tone: 'neutral' };
  const d = Math.round(score) - Math.round(prev);
  if (Math.abs(d) <= margin) return { text: `Stable (${d >= 0 ? '+' : '−'}${pts(Math.abs(d))}, dans la marge de ± ${margin})`, tone: 'neutral' };
  return d > 0 ? { text: `+${pts(d)} depuis la mesure précédente`, tone: 'good' } : { text: `−${pts(-d)} depuis la mesure précédente`, tone: 'bad' };
}

export function buildMonthlyReport(i: MonthlyInput): MonthlyReport {
  const notes: string[] = ['Mesures sur un échantillon de questions : les IA varient d’une réponse à l’autre, d’où la marge d’erreur.', 'Aucun résultat n’est garanti : Google et les IA restent maîtres de leurs réponses.'];
  let ai: MonthlyReport['ai'] = null;
  let headline: MonthlyReport['headline'] = { text: `Première mesure de ${i.client.name} à venir`, tone: 'neutral' };
  if (i.ai) {
    const score = Math.round(i.ai.score);
    const margin = Math.max(1, Math.round((i.ai.high - i.ai.low) / 2));
    const d = aiDelta(score, i.aiPrev ? i.aiPrev.score : null, margin);
    ai = {
      score,
      range: `${Math.round(i.ai.low)} à ${Math.round(i.ai.high)}`,
      delta: d.text,
      tone: d.tone,
      rank: `${ord(i.ai.rank)} sur ${i.ai.of}`,
      share: `${Math.round(i.ai.shareOfVoice * 100)} %`,
      errors: i.ai.errors,
      history: i.aiHistory.slice(-6).map((h) => ({ at: h.at, score: Math.round(h.score) })),
    };
    headline =
      d.tone === 'good'
        ? { text: `${i.client.name} gagne en visibilité dans les IA : ${score}/100`, tone: 'good' }
        : d.tone === 'bad'
          ? { text: `${i.client.name} recule dans les IA : ${score}/100`, tone: 'bad' }
          : { text: `${i.client.name} : visibilité dans les IA stable à ${score}/100`, tone: 'neutral' };
  }
  let seo: MonthlyReport['seo'] = null;
  if (i.seo) {
    const s = Math.round(i.seo.score);
    const dd = i.seoPrev ? s - Math.round(i.seoPrev.score) : null;
    seo = {
      score: s,
      delta: dd === null ? 'Premier audit du site' : dd === 0 ? 'Inchangé depuis l’audit précédent' : `${dd > 0 ? '+' : '−'}${pts(Math.abs(dd))} depuis l’audit précédent`,
      tone: dd === null || dd === 0 ? 'neutral' : dd > 0 ? 'good' : 'bad',
      pages: i.seo.pages,
      fixes: i.seo.fixes.slice(0, 5),
    };
  } else notes.push('Pas encore d’audit du site : le score Google apparaîtra après la première exploration.');
  if (!i.ranks) notes.push('Positions Google : suivi non activé pour cet espace.');
  if (i.demo) notes.unshift('Données de démonstration : client, agence et mesures fictifs.');
  return {
    brand: i.brand,
    title: `Rapport mensuel — ${frMonth(i.now)}`,
    period: i.ai ? `Dernière mesure IA du ${frDay(i.ai.at)}${i.seo ? `, audit du site du ${frDay(i.seo.at)}` : ''}` : 'Aucune mesure pour l’instant',
    client: i.client,
    demo: i.demo,
    headline,
    ai,
    seo,
    ranks: i.ranks,
    agent: { applied: i.agent.applied.slice(0, 6), pending: i.agent.pending.slice(0, 6) },
    notes,
  };
}
