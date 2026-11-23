/**
 * E-mails de la lettre mensuelle et des ressources. Envoi par sendEmail (src/lib/email.ts) : en-têtes
 * List-Unsubscribe en un clic, liste d'opposition respectée pour les envois « marketing », mode démo sans clé Resend.
 *
 * Aucun pixel de suivi d'ouverture (recommandation CNIL du 14 avril 2026) ; les liens portent seulement des
 * paramètres utm, lisibles par le destinataire.
 */
import { BRAND, appUrl, esc, sendEmail, type SendEmailResult } from '@/lib/email';
import { STATUS_LABEL, frDate, veillePath, type TimelineItem, type VeilleEntry } from '@/lib/veille';
import type { NewsletterIssue } from './store';
import { normEmail, signToken } from './tokens';

const C = { primary: '#3730A3', accent: '#F5A524', ink: '#1B1F2E', muted: '#5A6275', line: '#D5D9E4', bg: '#F6F7FB', primaryBg: '#ECEBFA' };
const FONT = "Inter, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";

/* ------------------------------ liens signés ------------------------------ */

export function confirmUrl(email: string, base = appUrl()): string {
  const e = normEmail(email);
  return `${base}/api/newsletter/confirm?e=${encodeURIComponent(e)}&t=${signToken('nl-confirm', e)}`;
}
export function newsletterUnsubscribeUrl(email: string, base = appUrl()): string {
  const e = normEmail(email);
  return `${base}/api/newsletter/unsubscribe?e=${encodeURIComponent(e)}&t=${signToken('nl-unsub', e)}`;
}
export function guideReadUrl(email: string, base = appUrl()): string {
  const e = normEmail(email);
  return `${base}/ressources/guide-2027/lire?e=${encodeURIComponent(e)}&t=${signToken('res-guide-2027', e)}`;
}
export function guidePdfUrl(email: string, base = appUrl()): string {
  const e = normEmail(email);
  return `${base}/ressources/guide-2027/pdf?e=${encodeURIComponent(e)}&t=${signToken('res-guide-2027', e)}`;
}

/* ------------------------------ gabarit ------------------------------ */

function legal(): string {
  return [process.env.LEGAL_NAME || BRAND, process.env.LEGAL_ADDRESS, process.env.LEGAL_SIREN ? `SIREN ${process.env.LEGAL_SIREN}` : undefined]
    .filter(Boolean)
    .map((p) => esc(p as string))
    .join(' · ');
}

const para = (t: string) =>
  t
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${esc(p.trim())}</p>`)
    .join('\n');

function button(label: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 8px"><tr><td style="border-radius:10px;background:${C.primary}">
<a href="${esc(url)}" style="display:inline-block;padding:13px 22px;font-family:${FONT};font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px">${esc(label)}</a>
</td></tr></table>`;
}

interface Frame {
  preheader: string;
  body: string;
  /** Pied de page : raison de l'envoi + lien de désinscription (lettre) ou mention « envoi unique ». */
  footer: string;
  title: string;
}

function frame({ preheader, body, footer, title }: Frame): string {
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:${C.bg}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid ${C.line};border-radius:14px">
<tr><td style="padding:22px 28px 0;font-family:${FONT}">
<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${C.accent};margin-right:8px;vertical-align:middle"></span><span style="font-size:18px;font-weight:700;color:${C.primary};vertical-align:middle">${esc(BRAND)}</span>
<span style="font-size:13px;color:${C.muted};vertical-align:middle"> · veille Google et IA</span>
</td></tr>
<tr><td style="padding:18px 28px 26px;font-family:${FONT};font-size:16px;line-height:1.6;color:${C.ink}">
${body}
</td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px"><tr><td style="padding:16px 28px;font-family:${FONT};font-size:12px;line-height:1.5;color:${C.muted}">
${footer}<br>${legal()} · <a href="${esc(appUrl())}/confidentialite" style="color:${C.muted}">Confidentialité</a>
</td></tr></table>
</td></tr></table></body></html>`;
}

/* ------------------------------ confirmation (double opt-in) ------------------------------ */

export function renderConfirmEmail(to: string) {
  const url = confirmUrl(to);
  const subject = `Confirmez votre inscription à la lettre de ${BRAND}`;
  const html = frame({
    title: subject,
    preheader: 'Un clic pour confirmer. Sans clic, vous ne recevrez rien.',
    body: `<h1 style="margin:0 0 12px;font-size:22px;line-height:1.3">Confirmez votre inscription</h1>
${para(`Vous (ou quelqu'un qui a saisi votre adresse) avez demandé à recevoir la lettre mensuelle de ${BRAND} : ce qui change pour la visibilité des sites professionnels sur Google et dans les IA, une fois par mois.`)}
${button("Je confirme mon inscription", url)}
<p style="margin:12px 0 0;font-size:14px;color:${C.muted}">Sans confirmation, votre adresse ne recevra aucune lettre. Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet e-mail.</p>`,
    footer: `Vous recevez cet e-mail unique parce que votre adresse a été saisie dans un formulaire d'inscription de ${esc(BRAND)}.`,
  });
  const text = `Confirmez votre inscription à la lettre mensuelle de ${BRAND} (veille Google et IA, une fois par mois) :\n${url}\n\nSans confirmation, vous ne recevrez rien. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.`;
  return { subject, html, text };
}

export async function sendConfirmEmail(to: string): Promise<SendEmailResult> {
  const m = renderConfirmEmail(to);
  // Envoi demandé à l'instant par la personne : « transactional » (pas filtré par la liste d'opposition).
  return sendEmail({ to, ...m, kind: 'transactional', tags: [{ name: 'type', value: 'newsletter-confirm' }] });
}

/* ------------------------------ numéro de la lettre ------------------------------ */

function utm(url: string, issue: Pick<NewsletterIssue, 'number'>): string {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}utm_source=lettre&utm_medium=email&utm_campaign=numero-${issue.number}`;
}

export interface RenderIssueInput {
  issue: Pick<NewsletterIssue, 'number' | 'subject' | 'preheader' | 'intro' | 'outro'>;
  entries: VeilleEntry[];
  deadlines: TimelineItem[];
  to: string;
  base?: string;
}

export function renderIssueEmail({ issue, entries, deadlines, to, base = appUrl() }: RenderIssueInput) {
  const unsub = newsletterUnsubscribeUrl(to, base);
  const cards = entries
    .map((e) => {
      const url = utm(`${base}${veillePath(e)}`, issue);
      const todo = e.actions.slice(0, 2).map((a) => `<li style="margin:0 0 6px">${esc(a)}</li>`).join('');
      return `<tr><td style="padding:16px 0;border-top:1px solid ${C.line}">
<p style="margin:0 0 4px;font-size:13px;color:${C.muted}">${esc(frDate(e.eventDate))} · ${esc(STATUS_LABEL[e.status])}</p>
<p style="margin:0 0 6px;font-size:17px;font-weight:700;line-height:1.35"><a href="${esc(url)}" style="color:${C.ink};text-decoration:none">${esc(e.title)}</a></p>
<p style="margin:0 0 8px">${esc(e.summary)}</p>
<p style="margin:0 0 4px;font-size:14px;font-weight:600">Ce qu'il faut faire</p>
<ul style="margin:0 0 8px;padding-left:20px;font-size:15px">${todo}</ul>
<a href="${esc(url)}" style="font-size:14px;color:${C.primary}">Lire la fiche et ses sources</a>
</td></tr>`;
    })
    .join('\n');
  const dl = deadlines.length
    ? `<h2 style="margin:24px 0 8px;font-size:18px">Prochaines échéances</h2>
<ul style="margin:0 0 8px;padding-left:20px">${deadlines.map((d) => `<li style="margin:0 0 6px"><strong>${esc(frDate(d.date))}</strong> : ${esc(d.label)}</li>`).join('')}</ul>`
    : '';
  const hub = utm(`${base}/veille`, issue);
  const html = frame({
    title: issue.subject,
    preheader: issue.preheader,
    body: `<p style="margin:0 0 4px;font-size:13px;color:${C.muted}">Lettre n° ${issue.number}</p>
${para(issue.intro)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${cards}</table>
${dl}
${para(issue.outro)}
<p style="margin:16px 0 0;font-size:14px"><a href="${esc(hub)}" style="color:${C.primary}">Toutes les fiches de veille</a></p>`,
    footer: `Vous recevez cette lettre parce que vous vous êtes inscrit et avez confirmé votre adresse. <a href="${esc(unsub)}" style="color:${C.muted};text-decoration:underline">Se désinscrire en un clic</a> ou répondez « STOP ».`,
  });
  const text = [
    `Lettre n° ${issue.number} — ${issue.subject}`,
    issue.intro,
    ...entries.map(
      (e) =>
        `— ${e.title}\n${frDate(e.eventDate)} · ${STATUS_LABEL[e.status]}\n${e.summary}\nCe qu'il faut faire :\n${e.actions
          .slice(0, 2)
          .map((a) => `  • ${a}`)
          .join('\n')}\nFiche et sources : ${utm(`${base}${veillePath(e)}`, issue)}`,
    ),
    deadlines.length ? `Prochaines échéances :\n${deadlines.map((d) => `  • ${frDate(d.date)} : ${d.label}`).join('\n')}` : '',
    issue.outro,
    `Toutes les fiches : ${hub}`,
    `---\nSe désinscrire en un clic : ${unsub} (ou répondez « STOP »)`,
  ]
    .filter(Boolean)
    .join('\n\n');
  return { subject: issue.subject, html, text };
}

export async function sendIssueEmail(input: RenderIssueInput): Promise<SendEmailResult> {
  const m = renderIssueEmail(input);
  return sendEmail({ to: input.to, ...m, kind: 'marketing', tags: [{ name: 'type', value: 'newsletter' }, { name: 'numero', value: String(input.issue.number) }] });
}

/* ------------------------------ guide 2027 (ressource) ------------------------------ */

export function renderGuideEmail(to: string, opts: { newsletter: boolean }) {
  const read = guideReadUrl(to);
  const pdf = guidePdfUrl(to);
  const subject = 'Votre guide « Être recommandé par Google et les IA en 2027 »';
  const nl = opts.newsletter
    ? `<div style="margin:20px 0 0;padding:14px 16px;background:${C.primaryBg};border-radius:10px">
<p style="margin:0 0 6px;font-weight:600">Vous avez aussi demandé la lettre mensuelle</p>
<p style="margin:0 0 8px;font-size:15px">Confirmez-le d'un clic. Sans confirmation, vous ne la recevrez pas.</p>
<a href="${esc(confirmUrl(to))}" style="color:${C.primary};font-weight:600">Je confirme mon inscription à la lettre</a>
</div>`
    : '';
  const html = frame({
    title: subject,
    preheader: 'Le lien vers votre guide, à lire en ligne, imprimer ou télécharger en PDF.',
    body: `<h1 style="margin:0 0 12px;font-size:22px;line-height:1.3">Voici votre guide</h1>
${para(`Merci de votre intérêt. Le guide « Être recommandé par Google et les IA en 2027 » rassemble ce que nous savons, sources à l'appui, et ce que nous ne savons pas. Vous pouvez le lire en ligne, l'imprimer ou le télécharger en PDF.`)}
${button('Lire le guide', read)}
<p style="margin:8px 0 0;font-size:15px"><a href="${esc(pdf)}" style="color:${C.primary}">Télécharger le PDF</a></p>
${nl}`,
    footer: `Vous recevez cet e-mail unique parce que vous avez demandé ce guide sur le site de ${esc(BRAND)}. Nous ne vous écrirons pas d'autre e-mail${opts.newsletter ? ' sauf si vous confirmez votre inscription à la lettre' : ''}.`,
  });
  const text = [
    `Voici votre guide « Être recommandé par Google et les IA en 2027 ».`,
    `Lire en ligne : ${read}`,
    `PDF : ${pdf}`,
    opts.newsletter ? `Vous avez aussi demandé la lettre mensuelle. Confirmez-le ici (sans confirmation, vous ne la recevrez pas) : ${confirmUrl(to)}` : '',
    `---\nE-mail unique envoyé à votre demande.`,
  ]
    .filter(Boolean)
    .join('\n\n');
  return { subject, html, text };
}

export async function sendGuideEmail(to: string, opts: { newsletter: boolean }): Promise<SendEmailResult> {
  const m = renderGuideEmail(to, opts);
  return sendEmail({ to, ...m, kind: 'transactional', tags: [{ name: 'type', value: 'ressource-guide-2027' }] });
}
