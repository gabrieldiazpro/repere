/**
 * Notification au fondateur à chaque candidature partenaire (src/lib/email.ts ; sans RESEND_API_KEY, journalisée).
 * Destinataire : PARTNERS_NOTIFY_EMAIL, sinon PILOTS_NOTIFY_EMAIL, sinon EMAIL_REPLY_TO, sinon l'adresse de contact.
 */
import { esc, sendEmail, appUrl, type SendEmailResult } from '@/lib/email';
import { CONTACT_EMAIL } from '@/lib/seo/site';
import { FAMILIES } from './program';
import { audienceLabel } from './validate';
import type { PartnerRecord } from './store';

export function partnersNotifyAddress(env: Record<string, string | undefined> = process.env): string {
  return (env.PARTNERS_NOTIFY_EMAIL || env.PILOTS_NOTIFY_EMAIL || env.EMAIL_REPLY_TO || CONTACT_EMAIL).trim();
}

export function renderPartnerNotification(id: string, p: PartnerRecord, base: string = appUrl()) {
  const adminUrl = `${base.replace(/\/$/, '')}/admin/partenaires#${encodeURIComponent(id)}`;
  const fam = FAMILIES[p.family];
  const subject = `Candidature partenaire : ${p.company} (${fam.short})`;
  const lines: [string, string][] = [
    ['Structure', p.company],
    ['Type', fam.label],
    ['Site', p.website],
    ['Ville', p.city ?? '—'],
    ['Clients, adhérents ou élèves', audienceLabel(p.audience)],
    ['Contact', `${p.name}${p.role ? `, ${p.role}` : ''}`],
    ['E-mail', p.email],
    ['Annuaire public', p.listOk ? 'accord donné' : 'non'],
  ];
  const text = [
    'Nouvelle candidature au programme partenaires Repéré.',
    '',
    ...lines.map(([k, v]) => `${k} : ${v}`),
    '',
    'Son message :',
    p.message,
    '',
    `Étudier la candidature : ${adminUrl}`,
  ].join('\n');
  const html = `<div style="font-family:Arial,sans-serif;color:#1B1F2E;font-size:15px;line-height:1.5">
<p style="font-size:18px;font-weight:bold;margin:0 0 12px">Nouvelle candidature partenaire : ${esc(p.company)}</p>
<table cellpadding="4" style="border-collapse:collapse">${lines
    .map(([k, v]) => `<tr><td style="color:#5A6275;padding-right:12px">${esc(k)}</td><td>${esc(v)}</td></tr>`)
    .join('')}</table>
<p style="margin:16px 0 4px;color:#5A6275">Son message :</p>
<p style="margin:0;white-space:pre-wrap">${esc(p.message)}</p>
<p style="margin:20px 0"><a href="${esc(adminUrl)}" style="background:#3730A3;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:bold">Étudier la candidature</a></p>
</div>`;
  return { subject, text, html };
}

export async function notifyFounderOfPartner(id: string, p: PartnerRecord): Promise<SendEmailResult> {
  const { subject, text, html } = renderPartnerNotification(id, p);
  try {
    return await sendEmail({ to: partnersNotifyAddress(), subject, text, html, kind: 'transactional', tags: [{ name: 'type', value: 'partner_application' }] });
  } catch (e) {
    return { id: null, status: 'error', error: e instanceof Error ? e.message : String(e) };
  }
}
