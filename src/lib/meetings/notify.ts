/**
 * E-mails d'une demande de démo : notification au fondateur, et réponse automatique au demandeur (accusé de réception
 * honnête : un humain revient vers lui sous 1 jour ouvré ; aucune date de démo n'est confirmée par ce message).
 * Destinataire interne : MEETINGS_NOTIFY_EMAIL, sinon PILOTS_NOTIFY_EMAIL, sinon EMAIL_REPLY_TO, sinon le contact.
 */
import { esc, sendEmail, appUrl, BRAND, type SendEmailResult } from '@/lib/email';
import { CONTACT_EMAIL } from '@/lib/seo/site';
import { offerLabel, sizeLabel, slotLabel, SEGMENTS } from './validate';
import type { MeetingRequest } from './store';

export function meetingsNotifyAddress(env: Record<string, string | undefined> = process.env): string {
  return (env.MEETINGS_NOTIFY_EMAIL || env.PILOTS_NOTIFY_EMAIL || env.EMAIL_REPLY_TO || CONTACT_EMAIL).trim();
}

const seg = (m: MeetingRequest) => (m.segment ? SEGMENTS.find((s) => s.id === m.segment)?.label ?? m.segment : null);

export function renderMeetingNotification(id: string, m: MeetingRequest, base: string = appUrl()) {
  const adminUrl = `${base.replace(/\/$/, '')}/admin/partenaires/rendez-vous#${encodeURIComponent(id)}`;
  const subject = `Demande de démo ${offerLabel(m.offer)} : ${m.company}`;
  const slots = m.slots.length ? m.slots.map(slotLabel).join(' ; ') : '—';
  const origin = m.attribution?.utmMedium === 'partenaire' ? `lien partenaire « ${m.attribution.utmCampaign} »` : m.attribution?.utmSource ? `campagne ${m.attribution.utmSource}` : m.attribution?.referrerHost ?? '—';
  const lines: [string, string][] = [
    ['Offre', offerLabel(m.offer) + (seg(m) ? ` (${seg(m)})` : '')],
    ['Entreprise', m.company],
    ['Site', m.website],
    ['Taille', sizeLabel(m.offer, m.size)],
    ['Créneaux souhaités', slots],
    ['Autres disponibilités', m.otherTimes ?? '—'],
    ['Contact', m.name],
    ['E-mail', m.email],
    ['Téléphone', m.phone ?? '—'],
    ['Origine', origin],
  ];
  const text = ['Nouvelle demande de démo.', '', ...lines.map(([k, v]) => `${k} : ${v}`), '', 'Son besoin :', m.need, '', `Voir les demandes : ${adminUrl}`].join('\n');
  const html = `<div style="font-family:Arial,sans-serif;color:#1B1F2E;font-size:15px;line-height:1.5">
<p style="font-size:18px;font-weight:bold;margin:0 0 12px">Demande de démo ${esc(offerLabel(m.offer))} : ${esc(m.company)}</p>
<table cellpadding="4" style="border-collapse:collapse">${lines.map(([k, v]) => `<tr><td style="color:#5A6275;padding-right:12px">${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</table>
<p style="margin:16px 0 4px;color:#5A6275">Son besoin :</p>
<p style="margin:0;white-space:pre-wrap">${esc(m.need)}</p>
<p style="margin:20px 0"><a href="${esc(adminUrl)}" style="background:#3730A3;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:bold">Voir les demandes</a></p>
</div>`;
  return { subject, text, html };
}

/** Réponse automatique : aucune promesse autre que le délai de réponse. */
export function renderMeetingAck(m: MeetingRequest, opts: { bookingUrl?: string | null } = {}) {
  const subject = `${BRAND} : votre demande de démo est bien reçue`;
  const slots = m.slots.map(slotLabel);
  const text = [
    `Bonjour ${m.name},`,
    '',
    `Nous avons bien reçu votre demande de démo de l’offre ${offerLabel(m.offer)} pour ${m.company}.`,
    'Nous revenons vers vous sous 1 jour ouvré pour confirmer un créneau. Ce message est une réponse automatique : aucun rendez-vous n’est encore fixé.',
    ...(slots.length ? ['', 'Vos créneaux souhaités :', ...slots.map((s) => `- ${s}`)] : []),
    ...(m.otherTimes ? ['', `Vos disponibilités : ${m.otherTimes}`] : []),
    ...(opts.bookingUrl ? ['', `Si vous préférez choisir vous-même un créneau libre : ${opts.bookingUrl}`] : []),
    '',
    `Une question d’ici là ? Répondez à ce message ou écrivez à ${CONTACT_EMAIL}.`,
    '',
    `L’équipe ${BRAND}`,
  ].join('\n');
  const html = `<div style="font-family:Arial,sans-serif;color:#1B1F2E;font-size:15px;line-height:1.55">
<p>Bonjour ${esc(m.name)},</p>
<p>Nous avons bien reçu votre demande de démo de l’offre <strong>${esc(offerLabel(m.offer))}</strong> pour ${esc(m.company)}.</p>
<p><strong>Nous revenons vers vous sous 1 jour ouvré</strong> pour confirmer un créneau. Ce message est une réponse automatique : aucun rendez-vous n’est encore fixé.</p>
${slots.length ? `<p style="margin-bottom:4px">Vos créneaux souhaités :</p><ul style="margin-top:0">${slots.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}
${m.otherTimes ? `<p>Vos disponibilités : ${esc(m.otherTimes)}</p>` : ''}
${opts.bookingUrl ? `<p>Si vous préférez choisir vous-même un créneau libre : <a href="${esc(opts.bookingUrl)}">${esc(opts.bookingUrl)}</a></p>` : ''}
<p>Une question d’ici là ? Répondez à ce message ou écrivez à <a href="mailto:${esc(CONTACT_EMAIL)}">${esc(CONTACT_EMAIL)}</a>.</p>
<p>L’équipe ${esc(BRAND)}</p>
</div>`;
  return { subject, text, html };
}

async function safe(p: Promise<SendEmailResult>): Promise<SendEmailResult> {
  try {
    return await p;
  } catch (e) {
    return { id: null, status: 'error', error: e instanceof Error ? e.message : String(e) };
  }
}

export async function notifyMeeting(id: string, m: MeetingRequest, opts: { bookingUrl?: string | null } = {}): Promise<{ notified: SendEmailResult; acknowledged: SendEmailResult }> {
  const n = renderMeetingNotification(id, m);
  const a = renderMeetingAck(m, opts);
  const notified = await safe(sendEmail({ to: meetingsNotifyAddress(), subject: n.subject, text: n.text, html: n.html, kind: 'transactional', replyTo: m.email, tags: [{ name: 'type', value: 'demo_request' }] }));
  // Réponse à une demande que la personne vient de faire : transactionnelle (comme une confirmation).
  const acknowledged = await safe(sendEmail({ to: m.email, subject: a.subject, text: a.text, html: a.html, kind: 'transactional', tags: [{ name: 'type', value: 'demo_request_ack' }] }));
  return { notified, acknowledged };
}
