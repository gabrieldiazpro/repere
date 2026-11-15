/**
 * Notification au fondateur à chaque nouvelle candidature pilote, par l'envoi existant (src/lib/email.ts, Resend ;
 * sans RESEND_API_KEY, l'e-mail est journalisé dans la console).
 * Destinataire : PILOTS_NOTIFY_EMAIL, sinon EMAIL_REPLY_TO, sinon l'adresse de contact publique.
 */
import { esc, sendEmail, appUrl, type SendEmailResult } from '@/lib/email';
import { CONTACT_EMAIL } from '@/lib/seo/site';
import { PILOT_SEGMENT_SHORT } from './validate';
import type { PilotApplication } from './store';

export function pilotNotifyAddress(): string {
  return (process.env.PILOTS_NOTIFY_EMAIL || process.env.EMAIL_REPLY_TO || CONTACT_EMAIL).trim();
}

/** Contenu de l'e-mail (pur, testé). */
export function renderPilotNotification(id: string, p: PilotApplication, base: string = appUrl()) {
  const adminUrl = `${base.replace(/\/$/, '')}/admin/pilotes#${encodeURIComponent(id)}`;
  const subject = `Candidature pilote : ${p.company} (${PILOT_SEGMENT_SHORT[p.segment]})`;
  const lines: [string, string][] = [
    ['Entreprise', p.company],
    ['Site', p.website],
    ['Type', PILOT_SEGMENT_SHORT[p.segment]],
    ['Ville', p.city ?? '—'],
    ['Contact', `${p.name}${p.role ? `, ${p.role}` : ''}`],
    ['E-mail', p.email],
    ['Avant/après publiable', p.publishOk ? 'oui, accord donné' : 'non'],
  ];
  const text = [
    'Nouvelle candidature au programme pilote Repéré.',
    '',
    ...lines.map(([k, v]) => `${k} : ${v}`),
    '',
    'Ce qu’elle attend :',
    p.motivation,
    '',
    `Étudier la candidature : ${adminUrl}`,
  ].join('\n');
  const html = `<div style="font-family:Arial,sans-serif;color:#1B1F2E;font-size:15px;line-height:1.5">
<p style="font-size:18px;font-weight:bold;margin:0 0 12px">Nouvelle candidature pilote : ${esc(p.company)}</p>
<table cellpadding="4" style="border-collapse:collapse">${lines
    .map(([k, v]) => `<tr><td style="color:#5A6275;padding-right:12px">${esc(k)}</td><td>${esc(v)}</td></tr>`)
    .join('')}</table>
<p style="margin:16px 0 4px;color:#5A6275">Ce qu’elle attend :</p>
<p style="margin:0;white-space:pre-wrap">${esc(p.motivation)}</p>
<p style="margin:20px 0"><a href="${esc(adminUrl)}" style="background:#3730A3;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:bold">Étudier la candidature</a></p>
</div>`;
  return { subject, text, html };
}

export async function notifyFounder(id: string, p: PilotApplication): Promise<SendEmailResult> {
  const { subject, text, html } = renderPilotNotification(id, p);
  try {
    // Message interne, déclenché par une action : « transactional » (jamais filtré par la liste d'opposition).
    return await sendEmail({ to: pilotNotifyAddress(), subject, text, html, kind: 'transactional', tags: [{ name: 'type', value: 'pilot_application' }] });
  } catch (e) {
    return { id: null, status: 'error', error: e instanceof Error ? e.message : String(e) };
  }
}
