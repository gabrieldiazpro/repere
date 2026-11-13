/**
 * E-mails transactionnels (Resend) — textes : docs/08-copy.md §4 ; règles : docs/06-juridique.md (E5, E6).
 * Sans RESEND_API_KEY, l'e-mail est journalisé dans la console (mode démo) au lieu d'être envoyé.
 *
 * Chaque e-mail porte :
 * - un lien de désinscription en un clic (signé HMAC) + en-têtes List-Unsubscribe / List-Unsubscribe-Post ;
 * - l'identité de l'expéditeur (LEGAL_NAME, LEGAL_ADDRESS, LEGAL_SIREN).
 * Les e-mails « service » et « marketing » ne partent pas vers une adresse de la liste d'opposition.
 */
import { SITE_URL } from '@/lib/seo/site';
import crypto from 'node:crypto';
import { Resend } from 'resend';
import { citationStats, scoreBand, type AuditResult, type ProviderId } from '@/lib/engine';
import { isSuppressed, type Business } from '@/lib/db';
import { VAT_NOTICE, getPlan, includesActionPlan, type PlanId } from '@/lib/plans';
import { signPlanToken } from '@/lib/pdf/sign';
import type { WeeklyDigestView } from '@/lib/digest';

export const BRAND = process.env.NEXT_PUBLIC_BRAND_NAME || 'Repéré';

const C = {
  primary: '#3730A3',
  accent: '#F5A524',
  success: '#15803D',
  warning: '#B45309',
  danger: '#B91C1C',
  ink: '#1B1F2E',
  muted: '#5A6275',
  line: '#D5D9E4',
  bg: '#F6F7FB',
  primaryBg: '#ECEBFA',
};

const PROVIDER_LABEL: Record<ProviderId, string> = {
  chatgpt: 'ChatGPT',
  perplexity: 'Perplexity',
  gemini: 'Gemini',
  claude: 'Claude',
  mistral: 'Mistral (Le Chat)',
};

export function appUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  // même repli que src/lib/seo/site.ts : jamais localhost dans un e-mail de production
  return SITE_URL;
}

// ---------------------------------------------------------------------------
// Désinscription signée
// ---------------------------------------------------------------------------

function unsubscribeSecret(): string {
  const s = process.env.UNSUBSCRIBE_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === 'production') throw new Error('UNSUBSCRIBE_SECRET manquant');
  return 'repere-dev-unsubscribe'; // dev / démo uniquement
}

export function unsubscribeToken(email: string): string {
  return crypto
    .createHmac('sha256', unsubscribeSecret())
    .update(email.trim().toLowerCase())
    .digest('base64url')
    .slice(0, 32);
}

export function verifyUnsubscribeToken(email: string, token: string): boolean {
  const expected = Buffer.from(unsubscribeToken(email));
  const given = Buffer.from(token || '');
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

export function unsubscribeUrl(email: string): string {
  const e = email.trim().toLowerCase();
  return `${appUrl()}/desinscription?e=${encodeURIComponent(e)}&t=${unsubscribeToken(e)}`;
}

/** URL « un clic » pour l'en-tête List-Unsubscribe-Post (RFC 8058) : POST serveur à serveur. */
export function unsubscribeOneClickUrl(email: string): string {
  const e = email.trim().toLowerCase();
  return `${appUrl()}/api/unsubscribe?e=${encodeURIComponent(e)}&t=${unsubscribeToken(e)}`;
}

// ---------------------------------------------------------------------------
// Envoi
// ---------------------------------------------------------------------------

/** transactional : toujours envoyé (paiement, rapport demandé) ; service/marketing : bloqués si opposition. */
export type EmailKind = 'transactional' | 'service' | 'marketing';

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  kind: EmailKind;
  attachments?: { filename: string; content: Buffer }[];
  tags?: { name: string; value: string }[];
}

export interface SendEmailResult {
  id: string | null;
  status: 'sent' | 'logged' | 'suppressed' | 'error';
  error?: string;
}

let _resend: Resend | null = null;
function resend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!_resend) _resend = new Resend(key);
  return _resend;
}

export function isEmailEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const to = input.to.trim().toLowerCase();
  if (input.kind !== 'transactional') {
    try {
      if (await isSuppressed(to)) return { id: null, status: 'suppressed' };
    } catch (e) {
      console.warn('[email] vérification de la liste d’opposition impossible', e);
    }
  }

  const unsub = unsubscribeOneClickUrl(to);
  const replyTo = process.env.EMAIL_REPLY_TO || undefined;
  const headers: Record<string, string> = {
    'List-Unsubscribe': replyTo ? `<${unsub}>, <mailto:${replyTo}?subject=STOP>` : `<${unsub}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };

  const client = resend();
  if (!client) {
    console.info(
      `[email:démo] à=${to} | objet="${input.subject}" | type=${input.kind}` +
        (input.attachments?.length ? ` | PJ=${input.attachments.map((a) => a.filename).join(',')}` : '') +
        `\n${input.text}\n`,
    );
    return { id: null, status: 'logged' };
  }

  try {
    const { data, error } = await client.emails.send({
      from: process.env.EMAIL_FROM || `${BRAND} <onboarding@resend.dev>`,
      to: [to],
      replyTo,
      subject: input.subject,
      html: input.html,
      text: input.text,
      headers,
      attachments: input.attachments,
      tags: input.tags,
    });
    if (error) return { id: null, status: 'error', error: error.message };
    return { id: data?.id ?? null, status: 'sent' };
  } catch (e) {
    return { id: null, status: 'error', error: e instanceof Error ? e.message : String(e) };
  }
}

// ---------------------------------------------------------------------------
// Gabarit HTML (tables + styles en ligne, compatible clients mail)
// ---------------------------------------------------------------------------

export function esc(s: string | number | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function legalLine(): string {
  const parts = [
    process.env.LEGAL_NAME || BRAND,
    process.env.LEGAL_ADDRESS,
    process.env.LEGAL_SIREN ? `SIREN ${process.env.LEGAL_SIREN}` : undefined,
    process.env.EMAIL_REPLY_TO,
  ].filter(Boolean);
  return parts.map((p) => esc(p as string)).join(' · ');
}

interface LayoutInput {
  to: string;
  preheader: string;
  /** HTML déjà échappé. */
  body: string;
  cta?: { label: string; url: string };
  /** Raison de l'envoi (pied de page). */
  reason: string;
}

function layout({ to, preheader, body, cta, reason }: LayoutInput): string {
  const font = "Inter, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";
  const button = cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 8px"><tr><td style="border-radius:10px;background:${C.primary}">
<a href="${esc(cta.url)}" style="display:inline-block;padding:13px 22px;font-family:${font};font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px">${esc(cta.label)}</a>
</td></tr></table>`
    : '';
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><title>${esc(BRAND)}</title></head>
<body style="margin:0;padding:0;background:${C.bg}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid ${C.line};border-radius:14px">
<tr><td style="padding:22px 28px 0;font-family:${font}">
<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${C.accent};margin-right:8px;vertical-align:middle"></span><span style="font-size:18px;font-weight:700;color:${C.primary};vertical-align:middle">${esc(BRAND)}</span>
<span style="font-size:13px;color:${C.muted};vertical-align:middle"> · référencement IA</span>
</td></tr>
<tr><td style="padding:18px 28px 26px;font-family:${font};font-size:16px;line-height:1.6;color:${C.ink}">
${body}
${button}
<p style="margin:24px 0 0">L'équipe ${esc(BRAND)}<br><span style="color:${C.muted}">Une question ? Répondez simplement à cet e-mail.</span></p>
</td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px"><tr><td style="padding:16px 28px;font-family:${font};font-size:12px;line-height:1.5;color:${C.muted}">
${esc(reason)} <a href="${esc(unsubscribeUrl(to))}" style="color:${C.muted};text-decoration:underline">Se désinscrire</a> ou répondez « STOP ».<br>
${legalLine()} · <a href="${esc(appUrl())}/confidentialite" style="color:${C.muted}">Confidentialité</a>
</td></tr></table>
</td></tr></table></body></html>`;
}

function textFooter(to: string, reason: string): string {
  return `\n\nL'équipe ${BRAND}\nUne question ? Répondez simplement à cet e-mail.\n\n---\n${reason}\nSe désinscrire : ${unsubscribeUrl(to)} (ou répondez « STOP »)\n${[
    process.env.LEGAL_NAME || BRAND,
    process.env.LEGAL_ADDRESS,
    process.env.LEGAL_SIREN ? `SIREN ${process.env.LEGAL_SIREN}` : '',
  ]
    .filter(Boolean)
    .join(' · ')}`;
}

function scoreBadge(score: number): string {
  const band = scoreBand(score);
  return `<span style="display:inline-block;padding:2px 10px;border-radius:999px;background:${esc(band.bg)};color:${esc(band.ink)};font-size:14px;font-weight:600">${esc(band.label)}</span>`;
}

const REASON_AUDIT = `Vous recevez cet e-mail car vous avez demandé un audit sur ${BRAND}.`;
const REASON_SUB = `Vous recevez cet e-mail car vous êtes abonné au suivi ${BRAND}.`;
const REASON_PURCHASE = `Vous recevez cet e-mail suite à votre commande sur ${BRAND}.`;
const REASON_DIGEST = `Vous recevez ce point du lundi car vous êtes abonné à ${BRAND}. Fréquence modifiable dans vos réglages.`;

const DEMO_NOTE = `<p style="margin:16px 0 0;padding:10px 12px;border-radius:8px;background:${C.primaryBg};color:${C.primary};font-size:14px">Mode démonstration : les résultats sont des exemples plausibles, pas un audit réel de votre commerce.</p>`;

// ---------------------------------------------------------------------------
// 4.1 Rapport envoyé
// ---------------------------------------------------------------------------

export async function sendReportEmail(
  to: string,
  r: AuditResult,
  opts: { pdf?: Buffer | null } = {},
): Promise<SendEmailResult> {
  const name = r.input.businessName;
  const band = scoreBand(r.score);
  const { cited, total } = citationStats(r);
  const top = r.competitors[0]?.name;
  const url = `${appUrl()}/rapport/${encodeURIComponent(r.id)}`;
  const subject = `Votre score de visibilité IA : ${r.score}/100`;
  const preheader = `Ce que ChatGPT, Gemini et Perplexity disent de ${name}.`;

  const body = `<p style="margin:0 0 14px">Bonjour,</p>
<p style="margin:0 0 14px">Votre audit de <strong>${esc(name)}</strong> est prêt.</p>
<p style="margin:0 0 6px;font-size:30px;font-weight:700;color:${esc(band.color)}">${r.score}<span style="font-size:18px;color:${C.muted}">/100</span></p>
<p style="margin:0 0 14px">${scoreBadge(r.score)}</p>
<p style="margin:0 0 14px">Vous êtes cité dans <strong>${cited}</strong> réponses sur <strong>${total}</strong>.${
    top ? ` Le concurrent le plus recommandé à votre place est <strong>${esc(top)}</strong>.` : ''
  }</p>
<p style="margin:0 0 14px">Vous trouverez le rapport complet ${opts.pdf ? 'en pièce jointe (PDF) et ' : ''}en ligne. Vous y verrez les questions exactes que nous avons posées et les réponses des IA, mot pour mot.</p>
${r.demo ? DEMO_NOTE : ''}
<p style="margin:16px 0 0">Bonne lecture,</p>`;

  const text = `Bonjour,

Votre audit de ${name} est prêt.

Votre score : ${r.score}/100. ${band.label}.
Vous êtes cité dans ${cited} réponses sur ${total}.${top ? ` Le concurrent le plus recommandé à votre place est ${top}.` : ''}

Voir mon rapport : ${url}
${r.demo ? '\nMode démonstration : les résultats sont des exemples plausibles, pas un audit réel.\n' : ''}
Bonne lecture,${textFooter(to, REASON_AUDIT)}`;

  return sendEmail({
    to,
    subject,
    // demandé via un formulaire public : la liste d'opposition s'applique (anti-abus, qa/securite.md E3)
    kind: 'service',
    html: layout({ to, preheader, body, cta: { label: 'Voir mon rapport', url }, reason: REASON_AUDIT }),
    text,
    attachments: opts.pdf ? [{ filename: `rapport-visibilite-ia-${slug(name)}.pdf`, content: opts.pdf }] : undefined,
    tags: [{ name: 'type', value: 'report' }],
  });
}

// ---------------------------------------------------------------------------
// 4.1 bis Rapport de l'analyse 60 s (V5) — demandé en saisissant son e-mail sur /analyse
// ---------------------------------------------------------------------------

/** Forme minimale lue dans `FullAnalysis` (src/lib/analysis/types.ts), sans dépendance circulaire. */
export interface AnalysisEmailView {
  brand: string;
  url: string;
  verdict: string;
  scores: { seo: number | null; geo: number | null; global: number | null };
  priorities: { title: string }[];
  demo: boolean;
  partial: boolean;
}

const REASON_ANALYSIS = `Vous recevez cet e-mail car vous avez demandé une analyse de site sur ${BRAND} et saisi cette adresse.`;

export async function sendAnalysisReportEmail(to: string, a: AnalysisEmailView, reportUrl: string): Promise<SendEmailResult> {
  const score = (n: number | null) => (n == null ? 'non mesuré' : `${n}/100`);
  const subject = a.scores.global != null ? `Analyse de ${a.brand} : ${a.scores.global}/100` : `Analyse de ${a.brand} : votre rapport`;
  const preheader = `SEO ${score(a.scores.seo)} · IA (GEO) ${score(a.scores.geo)} — et les corrections prioritaires.`;
  const top = a.priorities.slice(0, 3);
  const body = `<p style="margin:0 0 14px">Bonjour,</p>
<p style="margin:0 0 14px">L'analyse de <strong>${esc(a.brand)}</strong> (${esc(a.url)}) est prête.</p>
<p style="margin:0 0 14px">${esc(a.verdict)}</p>
<p style="margin:0 0 14px">Google (SEO) : <strong>${esc(score(a.scores.seo))}</strong> · IA (GEO) : <strong>${esc(score(a.scores.geo))}</strong></p>
${top.length ? `<p style="margin:0 0 6px">À corriger en priorité :</p><ul style="margin:0 0 14px;padding-left:20px">${top.map((p) => `<li>${esc(p.title)}</li>`).join('')}</ul>` : ''}
${a.partial ? `<p style="margin:0 0 14px;color:${C.muted}">Une partie des mesures n'a pas pu aboutir : le rapport indique lesquelles.</p>` : ''}
<p style="margin:0 0 14px;color:${C.muted};font-size:14px">Ces scores décrivent l'état de votre site au moment de l'analyse ; ils ne préjugent pas de vos positions futures.</p>
${a.demo ? DEMO_NOTE : ''}`;
  const text = `Bonjour,

L'analyse de ${a.brand} (${a.url}) est prête.
${a.verdict}

Google (SEO) : ${score(a.scores.seo)} · IA (GEO) : ${score(a.scores.geo)}
${top.length ? `\nÀ corriger en priorité :\n${top.map((p) => `- ${p.title}`).join('\n')}\n` : ''}
Voir le rapport : ${reportUrl}
(lien personnel, valable 90 jours)
${a.demo ? '\nMode démonstration : les résultats sont des exemples, pas une analyse réelle.\n' : ''}${textFooter(to, REASON_ANALYSIS)}`;
  return sendEmail({
    to,
    subject,
    // formulaire public : liste d'opposition appliquée (comme le rapport d'audit)
    kind: 'service',
    html: layout({ to, preheader, body, cta: { label: 'Voir le rapport', url: reportUrl }, reason: REASON_ANALYSIS }),
    text,
    tags: [{ name: 'type', value: 'analysis' }],
  });
}

// ---------------------------------------------------------------------------
// 4.4 Alerte mensuelle (hausse / baisse / stable)
// ---------------------------------------------------------------------------

/** `first` : aucune mesure comparable (mêmes questions, ≥ 6 jours) — première mesure de référence, aucun écart. */
export type MonthlyVariant = 'up' | 'down' | 'stable' | 'first';

export function monthlyVariant(delta: number, threshold = 5): MonthlyVariant {
  if (delta >= threshold) return 'up';
  if (delta <= -threshold) return 'down';
  return 'stable';
}

export async function sendMonthlyAlertEmail(
  to: string,
  /**
   * `previous` : la dernière mesure COMPARABLE à `current` (previousComparable de @/lib/digest/stats, via
   * comparableBase de @/lib/jobs/handlers), jamais simplement l'audit précédent. null → première mesure de référence.
   */
  args: { business: Pick<Business, 'id' | 'name'>; current: AuditResult; previous: AuditResult | null; threshold?: number },
): Promise<SendEmailResult & { variant: MonthlyVariant }> {
  const { business, current, previous } = args;
  const delta = previous ? current.score - previous.score : 0;
  const variant: MonthlyVariant = previous ? monthlyVariant(delta, args.threshold ?? 5) : 'first';
  const name = business.name;
  const { cited, total } = citationStats(current);
  const prevCited = previous ? citationStats(previous).cited : null;
  const dashboard = `${appUrl()}/app`;
  const abs = Math.abs(delta);

  let subject: string;
  let preheader: string;
  let body: string;
  let text: string;
  let ctaLabel: string;

  if (variant === 'up') {
    subject = `Bonne nouvelle : votre score passe de ${previous!.score} à ${current.score}`;
    preheader = 'Les IA vous recommandent davantage ce mois-ci.';
    ctaLabel = 'Voir le détail de mon évolution';
    body = `<p style="margin:0 0 14px">Bonjour,</p>
<p style="margin:0 0 14px">Votre audit mensuel de <strong>${esc(name)}</strong> est prêt, et il est en progrès : <strong style="color:${C.success}">${current.score}/100</strong> (+${abs} points).</p>
<p style="margin:0 0 14px">Ce mois-ci, vous êtes cité dans ${cited} réponses sur ${total}${prevCited !== null ? `, contre ${prevCited} le mois dernier` : ''}.</p>`;
    text = `Bonjour,\n\nVotre audit mensuel de ${name} est prêt, et il est en progrès : ${current.score}/100 (+${abs} points).\nCe mois-ci, vous êtes cité dans ${cited} réponses sur ${total}${prevCited !== null ? `, contre ${prevCited} le mois dernier` : ''}.`;
  } else if (variant === 'down') {
    subject = 'Votre score de visibilité IA a baissé ce mois-ci';
    preheader = `${current.score}/100 (−${abs} points). Voici ce qui a changé.`;
    ctaLabel = 'Voir ce qui a changé';
    const findings = downFindings(current, previous!);
    body = `<p style="margin:0 0 14px">Bonjour,</p>
<p style="margin:0 0 14px">Votre audit mensuel de <strong>${esc(name)}</strong> montre une baisse : <strong style="color:${C.danger}">${current.score}/100</strong> (−${abs} points).</p>
<p style="margin:0 0 10px">Pas d'inquiétude excessive : les IA se mettent régulièrement à jour, et une variation d'un mois peut être passagère. Voici ce que nous observons :</p>
<ul style="margin:0 0 14px;padding-left:20px">${findings.map((f) => `<li style="margin:0 0 6px">${esc(f)}</li>`).join('')}</ul>`;
    text = `Bonjour,\n\nVotre audit mensuel de ${name} montre une baisse : ${current.score}/100 (−${abs} points).\n\nPas d'inquiétude excessive : les IA se mettent régulièrement à jour, et une variation d'un mois peut être passagère. Voici ce que nous observons :\n${findings.map((f) => `- ${f}`).join('\n')}`;
  } else if (variant === 'first') {
    subject = `Votre mesure de référence : ${current.score}/100`;
    preheader = 'Première mesure de référence : l’évolution apparaîtra à la prochaine mesure comparable.';
    ctaLabel = 'Voir mon tableau de bord';
    body = `<p style="margin:0 0 14px">Bonjour,</p>
<p style="margin:0 0 14px">Votre mesure de <strong>${esc(name)}</strong> est prête : <strong>${current.score}/100</strong>. Les IA vous citent dans ${cited} réponses sur ${total}.</p>
<p style="margin:0 0 14px">C'est votre première mesure de référence sur ces questions : aucun écart n'est calculé pour l'instant. L'évolution apparaîtra à la prochaine mesure portant sur les mêmes questions.</p>`;
    text = `Bonjour,\n\nVotre mesure de ${name} est prête : ${current.score}/100. Les IA vous citent dans ${cited} réponses sur ${total}.\nC'est votre première mesure de référence sur ces questions : aucun écart n'est calculé pour l'instant. L'évolution apparaîtra à la prochaine mesure portant sur les mêmes questions.`;
  } else {
    const month = new Intl.DateTimeFormat('fr-FR', { month: 'long', timeZone: 'Europe/Paris' }).format(
      new Date(current.createdAt),
    );
    subject = `Votre score de visibilité IA de ${month} : ${current.score}/100`;
    preheader = 'Pas de grand changement ce mois-ci.';
    ctaLabel = 'Voir mon tableau de bord';
    body = `<p style="margin:0 0 14px">Bonjour,</p>
<p style="margin:0 0 14px">Votre position est stable ce mois-ci : <strong>${current.score}/100</strong>. Les IA continuent de vous citer dans ${cited} réponses sur ${total}.</p>`;
    text = `Bonjour,\n\nVotre position est stable ce mois-ci : ${current.score}/100. Les IA continuent de vous citer dans ${cited} réponses sur ${total}.`;
  }

  if (current.demo) body += DEMO_NOTE;
  text += `\n\n${ctaLabel} : ${dashboard}${textFooter(to, REASON_SUB)}`;

  const res = await sendEmail({
    to,
    subject,
    kind: 'service',
    html: layout({ to, preheader, body, cta: { label: ctaLabel, url: dashboard }, reason: REASON_SUB }),
    text,
    tags: [{ name: 'type', value: `monthly_${variant}` }],
  });
  return { ...res, variant };
}

function downFindings(current: AuditResult, previous: AuditResult): string[] {
  const out: string[] = [];
  let worst: { p: ProviderId; from: number; to: number } | null = null;
  for (const p of Object.keys(current.subScores) as ProviderId[]) {
    const a = previous.subScores[p];
    const b = current.subScores[p];
    if (a == null || b == null) continue;
    if (b < a && (!worst || a - b > worst.from - worst.to)) worst = { p, from: a, to: b };
  }
  if (worst) out.push(`${PROVIDER_LABEL[worst.p]} vous cite moins souvent qu'avant (${worst.from} → ${worst.to}/100).`);
  const prevNames = new Set(previous.competitors.map((c) => c.name.toLowerCase()));
  const newcomer = current.competitors.slice(0, 3).find((c) => !prevNames.has(c.name.toLowerCase()));
  const top = current.competitors[0];
  if (newcomer) out.push(`${newcomer.name} apparaît désormais parmi les noms les plus cités.`);
  else if (top) out.push(`${top.name} reste le nom le plus recommandé par les IA.`);
  if (!out.length) out.push('La baisse est répartie sur plusieurs IA, sans cause unique.');
  return out;
}

// ---------------------------------------------------------------------------
// Achat confirmé / paiement échoué (transactionnels)
// ---------------------------------------------------------------------------

export async function sendPurchaseConfirmationEmail(
  to: string,
  args: { planId: PlanId; businessId?: string | null; auditId?: string | null },
): Promise<SendEmailResult> {
  const plan = getPlan(args.planId);
  const url = args.businessId
    ? `${appUrl()}/app`
    : args.auditId
      ? `${appUrl()}/rapport/${encodeURIComponent(args.auditId)}`
      : `${appUrl()}/app`;
  // Plan d'action : lien signé vers le PDF généré à la volée (GET /api/report/[id]/plan?token=…).
  let planUrl: string | null = null;
  if (includesActionPlan(args.planId) && args.auditId) {
    try {
      planUrl = `${appUrl()}/api/report/${encodeURIComponent(args.auditId)}/plan?token=${signPlanToken(args.auditId)}`;
    } catch (e) {
      console.error('[email] lien du plan d’action impossible (AUDIT_SIGNING_SECRET ?)', e);
    }
  }
  const extra = includesActionPlan(args.planId)
    ? planUrl
      ? "Votre plan d'action personnalisé est prêt : téléchargez-le en PDF avec le lien ci-dessous."
      : "Votre plan d'action personnalisé vous sera livré en PDF sous 2 jours ouvrés."
    : 'Votre premier audit de suivi est programmé : vous recevrez une alerte dès que votre score bouge.';
  const planHtml = planUrl
    ? `<p style="margin:0 0 14px"><a href="${esc(planUrl)}" style="color:${C.primary};font-weight:600">Télécharger mon plan d'action (PDF)</a></p>`
    : '';
  const subject = `Merci ! Votre commande ${plan.name} est confirmée`;
  const body = `<p style="margin:0 0 14px">Bonjour,</p>
<p style="margin:0 0 14px">Merci pour votre confiance. Votre offre <strong>${esc(plan.name)}</strong> est bien enregistrée.</p>
<p style="margin:0 0 14px">${esc(extra)}</p>
${planHtml}<p style="margin:0 0 14px;color:${C.muted};font-size:14px">Votre facture vous est envoyée séparément par notre prestataire de paiement (Stripe). ${esc(VAT_NOTICE)}.${includesActionPlan(args.planId) ? " Plan d'action satisfait ou remboursé : 14 jours après réception, sur simple réponse à cet e-mail." : ''}</p>`;
  return sendEmail({
    to,
    subject,
    kind: 'transactional',
    html: layout({ to, preheader: extra, body, cta: { label: 'Accéder à mon espace', url }, reason: REASON_PURCHASE }),
    text: `Bonjour,\n\nMerci pour votre confiance. Votre offre ${plan.name} est bien enregistrée.\n${extra}${planUrl ? `\nPlan d'action (PDF) : ${planUrl}` : ''}\n\nAccéder à mon espace : ${url}${textFooter(to, REASON_PURCHASE)}`,
    tags: [{ name: 'type', value: 'purchase' }],
  });
}

export async function sendPaymentFailedEmail(to: string, args: { manageUrl?: string } = {}): Promise<SendEmailResult> {
  const url = args.manageUrl || `${appUrl()}/app/reglages`;
  const subject = 'Votre paiement n’a pas abouti';
  const body = `<p style="margin:0 0 14px">Bonjour,</p>
<p style="margin:0 0 14px">Le dernier prélèvement de votre abonnement ${esc(BRAND)} n'a pas pu être effectué. Cela arrive souvent quand une carte expire.</p>
<p style="margin:0 0 14px">Pour continuer à recevoir votre audit mensuel, mettez à jour votre moyen de paiement. Nous réessaierons automatiquement dans les prochains jours.</p>`;
  return sendEmail({
    to,
    subject,
    kind: 'transactional',
    html: layout({
      to,
      preheader: 'Mettez à jour votre carte pour garder votre suivi.',
      body,
      cta: { label: 'Mettre à jour mon paiement', url },
      reason: REASON_SUB,
    }),
    text: `Bonjour,\n\nLe dernier prélèvement de votre abonnement ${BRAND} n'a pas pu être effectué. Mettez à jour votre moyen de paiement : ${url}${textFooter(to, REASON_SUB)}`,
    tags: [{ name: 'type', value: 'payment_failed' }],
  });
}

function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

// ---------------------------------------------------------------------------
// Digest du lundi (docs/v2/06-indispensable.md § 2.1)
// ---------------------------------------------------------------------------

export interface DigestEmailLinks {
  /** lien signé « C'est fait » pour une tâche (src/lib/digest/sign.ts) */
  done?: (taskId: string) => string;
  app?: string;
  fix?: string;
  settings?: string;
}

const SENTIMENT_STYLE: Record<string, { label: string; bg: string; ink: string }> = {
  positif: { label: 'positif', bg: '#E7F5EC', ink: C.success },
  neutre: { label: 'neutre', bg: '#EEF0F5', ink: C.muted },
  negatif: { label: 'à corriger', bg: '#FDECEC', ink: C.danger },
};

function frDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Europe/Paris' }).format(new Date(iso));
}

function smallButton(label: string, url: string, color: string = C.primary): string {
  return `<a href="${esc(url)}" style="display:inline-block;padding:7px 14px;border-radius:8px;background:${color};color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;white-space:nowrap">${esc(label)}</a>`;
}

function sectionTitle(t: string): string {
  return `<p style="margin:22px 0 8px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${C.muted}">${esc(t)}</p>`;
}

function quoteBlock(q: NonNullable<WeeklyDigestView['bestQuote']>, border: string, title: string): string {
  const st = SENTIMENT_STYLE[q.sentiment] ?? SENTIMENT_STYLE.neutre;
  const provider = PROVIDER_LABEL[q.provider] ?? q.provider;
  return `<div style="margin:0 0 10px;padding:12px 14px;border-left:4px solid ${border};background:${C.bg};border-radius:0 10px 10px 0">
<p style="margin:0 0 6px;font-size:13px;color:${C.muted}"><strong style="color:${C.ink}">${esc(title)}</strong> · ${esc(provider)}${q.query ? ` · « ${esc(q.query)} »` : ''} <span style="display:inline-block;margin-left:4px;padding:1px 8px;border-radius:999px;background:${st.bg};color:${st.ink};font-size:12px;font-weight:600">${esc(st.label)}</span></p>
<p style="margin:0;font-size:15px;line-height:1.5;color:${C.ink}">« ${esc(q.text.length > 280 ? `${q.text.slice(0, 277)}…` : q.text)} »</p></div>`;
}

/** Rendu (sans envoi) du digest : objet, HTML et texte. Sert à l'envoi et à l'aperçu. */
export function renderWeeklyDigestEmail(
  to: string,
  d: WeeklyDigestView,
  links: DigestEmailLinks = {},
): { subject: string; html: string; text: string; preheader: string } {
  const base = appUrl();
  const app = links.app ?? `${base}/app`;
  const fix = links.fix ?? `${base}/app/verite`;
  const settings = links.settings ?? `${base}/app/reglages`;
  const done = links.done ?? (() => `${base}/app/taches`);
  const preheader = d.headline;
  const parts: string[] = [];
  const text: string[] = [`Bonjour,`, '', d.headline];

  parts.push(`<p style="margin:0 0 4px;font-size:13px;color:${C.muted}">Semaine du ${esc(frDate(`${d.week}T12:00:00Z`))} · ${esc(d.businessName)}${d.measuredAt ? ` · mesure du ${esc(frDate(d.measuredAt))}` : ''}</p>`);
  parts.push(`<p style="margin:0 0 16px;font-size:21px;line-height:1.35;font-weight:700;color:${C.ink}">${esc(d.headline)}</p>`);

  // Rang + score
  if (d.benchmark) {
    const arrow =
      d.rankDelta && d.rankDelta > 0
        ? `<span style="color:${C.success};font-weight:700">▲ ${d.rankDelta} place${d.rankDelta > 1 ? 's' : ''}</span>`
        : d.rankDelta && d.rankDelta < 0
          ? `<span style="color:${C.danger};font-weight:700">▼ ${-d.rankDelta} place${d.rankDelta < -1 ? 's' : ''}</span>`
          : `<span style="color:${C.muted}">position stable</span>`;
    const score =
      d.scoreDelta === null ? '' : ` · score ${d.scoreDelta > 0 ? '+' : ''}${d.scoreDelta} pt${Math.abs(d.scoreDelta) > 1 ? 's' : ''}`;
    parts.push(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.primaryBg};border-radius:12px"><tr><td style="padding:14px 16px">
<p style="margin:0 0 2px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${C.primary}">Votre rang</p>
<p style="margin:0 0 4px;font-size:19px;font-weight:700;color:${C.primary}">${esc(d.benchmark.label)}</p>
<p style="margin:0;font-size:14px">${arrow}<span style="color:${C.muted}">${esc(score)}</span></p></td></tr></table>`);
    text.push('', `Votre rang : ${d.benchmark.label}${d.rankDelta ? ` (${d.rankDelta > 0 ? '+' : ''}${d.rankDelta} place(s))` : ''}`);
  }

  // Verbatims
  if (d.bestQuote || d.quoteToFix) {
    parts.push(sectionTitle('Ce que les IA disent de vous'));
    if (d.bestQuote) parts.push(quoteBlock(d.bestQuote, C.success, 'La meilleure citation'));
    if (d.quoteToFix) parts.push(quoteBlock(d.quoteToFix, C.warning, 'À corriger'));
    if (d.bestQuote) text.push('', `Meilleure citation (${PROVIDER_LABEL[d.bestQuote.provider] ?? d.bestQuote.provider}) : « ${d.bestQuote.text} »`);
    if (d.quoteToFix) text.push(`À corriger (${PROVIDER_LABEL[d.quoteToFix.provider] ?? d.quoteToFix.provider}) : « ${d.quoteToFix.text} »`);
  }

  // Exactitude
  parts.push(sectionTitle('Exactitude'));
  if (d.factErrors > 0) {
    const items = d.factErrorItems
      .map(
        (e) =>
          `<li style="margin:0 0 6px"><strong>${esc(e.label)}</strong> : ${esc(PROVIDER_LABEL[e.provider] ?? e.provider)} indique « ${esc(e.stated)} », la bonne information est « ${esc(e.expected)} ».</li>`,
      )
      .join('');
    parts.push(`<div style="padding:12px 14px;border-radius:10px;background:#FDECEC;color:${C.ink}">
<p style="margin:0 0 8px;font-weight:700;color:${C.danger}">${d.factErrors} erreur${d.factErrors > 1 ? 's' : ''} détectée${d.factErrors > 1 ? 's' : ''}</p>
${items ? `<ul style="margin:0 0 10px;padding-left:18px;font-size:14px">${items}</ul>` : ''}
${smallButton('Corriger', fix, C.danger)}
<p style="margin:8px 0 0;font-size:12px;color:${C.muted}">Détection sur échantillon. La correction par les IA n'est pas garantie et peut prendre plusieurs semaines.</p></div>`);
    text.push('', `Exactitude : ${d.factErrors} erreur(s) détectée(s).`, ...d.factErrorItems.map((e) => `- ${e.label} : « ${e.stated} » au lieu de « ${e.expected} »`), `Corriger : ${fix}`);
  } else {
    parts.push(`<p style="margin:0;padding:10px 14px;border-radius:10px;background:#E7F5EC;color:${C.success};font-weight:600">Toutes vos informations vérifiées sont justes.</p>`);
    text.push('', 'Exactitude : toutes vos informations vérifiées sont justes.');
  }

  // Nouveaux concurrents
  if (d.newCompetitors.length) {
    parts.push(sectionTitle('Nouveaux concurrents cités'));
    parts.push(`<p style="margin:0">${d.newCompetitors.map((n) => `<strong>${esc(n)}</strong>`).join(', ')} ${d.newCompetitors.length > 1 ? 'apparaissent' : 'apparaît'} dans les réponses des IA.</p>`);
    text.push('', `Nouveaux concurrents : ${d.newCompetitors.join(', ')}`);
  }

  // Tâches
  parts.push(sectionTitle(d.tasks.length ? `Vos ${d.tasks.length} tâches de la semaine · ${d.totalMinutes} min` : 'Vos tâches'));
  if (d.tasks.length) {
    const rows = d.tasks
      .map(
        (t) => `<tr><td style="padding:10px 0;border-top:1px solid ${C.line};vertical-align:top">
<p style="margin:0;font-size:15px;font-weight:600;color:${C.ink}">${esc(t.title)}</p>
<p style="margin:2px 0 0;font-size:13px;color:${C.muted}">${esc(t.minutes)} min${t.deliverable?.length ? ' · livrable prêt à copier' : ''}</p></td>
<td align="right" style="padding:10px 0 10px 12px;border-top:1px solid ${C.line};vertical-align:middle">${t.status === 'done' ? `<span style="color:${C.success};font-weight:600;font-size:14px">Fait</span>` : smallButton("C'est fait", done(t.id), C.success)}</td></tr>`,
      )
      .join('');
    parts.push(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`);
    text.push('', 'Vos tâches de la semaine :', ...d.tasks.map((t) => `- ${t.title} (${t.minutes} min) — c'est fait : ${done(t.id)}`));
  } else {
    parts.push(`<p style="margin:0">Aucune tâche en attente : tout est à jour.</p>`);
  }

  if (typeof d.aiVisits === 'number') {
    parts.push(sectionTitle('Visites venues des IA'));
    parts.push(`<p style="margin:0"><strong>${esc(d.aiVisits)}</strong> visite${d.aiVisits > 1 ? 's' : ''} sur votre site depuis ChatGPT, Perplexity, Gemini ou Copilot ces 7 derniers jours.</p>`);
    text.push('', `Visites venues des IA (7 jours) : ${d.aiVisits}`);
  }

  if (d.demo) parts.push(DEMO_NOTE);

  const forward = `mailto:?subject=${encodeURIComponent(`${BRAND} : ${d.headline}`)}&body=${encodeURIComponent(`Le point de la semaine sur notre visibilité dans les IA : ${app}`)}`;
  parts.push(`<p style="margin:22px 0 0;font-size:14px;color:${C.muted}"><a href="${esc(forward)}" style="color:${C.primary}">Transférer à mon associé ou mon agence</a> · <a href="${esc(settings)}" style="color:${C.primary}">Recevoir ce point chaque mois plutôt</a></p>`);
  text.push('', `Ouvrir mon espace : ${app}`, `Changer la fréquence : ${settings}`);

  const html = layout({ to, preheader, body: parts.join('\n'), cta: { label: 'Ouvrir mon espace', url: app }, reason: REASON_DIGEST });
  return { subject: d.subject, html, text: text.join('\n') + textFooter(to, REASON_DIGEST), preheader };
}

export async function sendWeeklyDigestEmail(to: string, d: WeeklyDigestView, links: DigestEmailLinks = {}): Promise<SendEmailResult> {
  const r = renderWeeklyDigestEmail(to, d, links);
  return sendEmail({
    to,
    subject: r.subject,
    kind: 'service',
    html: r.html,
    text: r.text,
    tags: [{ name: 'type', value: 'weekly_digest' }],
  });
}

// ---------------------------------------------------------------------------
// Mois d'Essentiel offert avec l'audit approfondi : rappel J-5 (src/lib/entitlements.ts, sweepAuditOffers)
// ---------------------------------------------------------------------------

export async function sendAuditOfferReminderEmail(
  to: string,
  args: { businessName: string; until: string; segment: 'local' | 'pme' | 'ecommerce' },
): Promise<SendEmailResult> {
  const day = new Date(args.until).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Europe/Paris' });
  const pricing = `${appUrl()}/tarifs?segment=${args.segment}`;
  const subject = `Votre mois d'Essentiel offert se termine le ${day}`;
  const preheader = 'Ensuite, retour à Découverte sans frais et sans perte de données.';
  const body = `<p style="margin:0 0 14px">Bonjour,</p>
<p style="margin:0 0 14px">Le mois d'Essentiel offert avec l'audit approfondi de <strong>${esc(args.businessName)}</strong> se termine le <strong>${esc(day)}</strong>.</p>
<p style="margin:0 0 14px">Aucun moyen de paiement n'est enregistré : rien ne vous sera prélevé. À cette date, votre espace repasse automatiquement en Découverte ; votre historique et vos livrables restent consultables.</p>
<p style="margin:0 0 14px">Pour garder le suivi complet, vous pouvez choisir une offre à tout moment.</p>`;
  const text = `Bonjour,\n\nLe mois d'Essentiel offert avec l'audit approfondi de ${args.businessName} se termine le ${day}.\nAucun moyen de paiement n'est enregistré : rien ne vous sera prélevé. À cette date, votre espace repasse automatiquement en Découverte ; votre historique et vos livrables restent consultables.\nPour garder le suivi complet, vous pouvez choisir une offre à tout moment.\n\nVoir les offres : ${pricing}${textFooter(to, REASON_PURCHASE)}`;
  return sendEmail({
    to,
    subject,
    kind: 'service',
    html: layout({ to, preheader, body, cta: { label: 'Voir les offres', url: pricing }, reason: REASON_PURCHASE }),
    text,
    tags: [{ name: 'type', value: 'audit_offer_reminder' }],
  });
}
