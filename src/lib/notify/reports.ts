/**
 * Rapports planifiés par e-mail (docs/v3/09-audit-app.md n° 6) — destinataires enregistrés CÔTÉ SERVEUR.
 *
 * - Collection `notify.schedules` (id = businessId) : fréquence hebdomadaire ou mensuelle, jour, heure (Paris),
 *   destinataires (5 en Essentiel, 20 en Accompagné / Agence) avec double opt-in (e-mail de confirmation signé).
 * - Chaque envoi est une tâche `report.scheduled` (file) ; un changement de réglage incrémente `version` : les
 *   tâches déjà en file pour une ancienne version ne font rien.
 * - Le rapport contient le score (avec sa marge), le rang, la part de voix, l'évolution et un lien de partage
 *   en lecture (marque blanche si le droit `whiteLabel` est présent). Jamais de tâche ni de fiche de vérité.
 */
import crypto from 'node:crypto';
import { getDoc, putDoc } from '@/lib/store';
import { isDemoBusinessId } from '@/lib/demo-v2';
import { getBusinessRecord, listAuditsForBusiness, type BusinessRecord } from '@/lib/db';
import { appUrl, esc, sendEmail, unsubscribeUrl } from '@/lib/email';
import { auditStats, previousComparable } from '@/lib/digest/stats';
import type { AuditResult } from '@/lib/engine';
import { createShareLink, type ShareBranding } from '@/lib/share';
import { addNotification } from './center';
import { isEmail } from './prefs';
import { enqueue, getEntitlements, registerHandler, type Entitlements } from './platform';

export const SCHEDULES = 'notify.schedules';

export type ReportFrequency = 'weekly' | 'monthly';

export interface Recipient {
  email: string;
  status: 'pending' | 'confirmed';
  addedAt: string;
  confirmedAt?: string | null;
}

export interface ReportSchedule {
  businessId: string;
  active: boolean;
  frequency: ReportFrequency;
  /** hebdo : 1 = lundi … 7 = dimanche ; mensuel : 1 à 28 */
  day: number;
  /** heure de Paris, 6 à 20 */
  hour: number;
  recipients: Recipient[];
  includeShareLink: boolean;
  branding?: ShareBranding | null;
  version: number;
  nextRunAt: string | null;
  lastSentAt: string | null;
  updatedAt: string;
}

export function maxRecipients(e: Pick<Entitlements, 'tier'>): number {
  if (e.tier === 'decouverte') return 0;
  if (e.tier === 'essentiel') return 5;
  return 20;
}

export function defaultSchedule(businessId: string, now: Date = new Date()): ReportSchedule {
  return { businessId, active: false, frequency: 'monthly', day: 1, hour: 9, recipients: [], includeShareLink: true, branding: null, version: 0, nextRunAt: null, lastSentAt: null, updatedAt: now.toISOString() };
}

// ---------------------------------------------------------------------------
// Fuseau de Paris
// ---------------------------------------------------------------------------
function parisParts(d: Date): { y: number; m: number; d: number; h: number; mi: number; wd: number } {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  const wd = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(p.weekday) + 1;
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, wd };
}

/** Instant UTC correspondant à y-m-d h:00 à Paris. */
export function parisToUtc(y: number, m: number, d: number, h: number): Date {
  const guess = Date.UTC(y, m - 1, d, h);
  const p = parisParts(new Date(guess));
  const off = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi) - guess; // décalage de Paris à cet instant
  return new Date(guess - off);
}

/** Prochain envoi strictement après `from`. */
export function nextRunAt(s: Pick<ReportSchedule, 'frequency' | 'day' | 'hour'>, from: Date): Date {
  const p = parisParts(from);
  for (let i = 0; i < 70; i++) {
    const cal = new Date(Date.UTC(p.y, p.m - 1, p.d + i));
    const y = cal.getUTCFullYear();
    const m = cal.getUTCMonth() + 1;
    const d = cal.getUTCDate();
    const wd = ((cal.getUTCDay() + 6) % 7) + 1;
    if (s.frequency === 'weekly' ? wd !== s.day : d !== s.day) continue;
    const at = parisToUtc(y, m, d, s.hour);
    if (at.getTime() > from.getTime()) return at;
  }
  return new Date(from.getTime() + 7 * 86_400_000);
}

// ---------------------------------------------------------------------------
// Confirmation des destinataires (double opt-in)
// ---------------------------------------------------------------------------
function secret(): string {
  const s = process.env.SHARE_SECRET || process.env.UNSUBSCRIBE_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === 'production') throw new Error('SHARE_SECRET manquant');
  return 'repere-dev-reports';
}

/** Durée de validité d'un lien de confirmation (M3 de qa/v3/securite-v3.md). */
const CONFIRM_TTL_SEC = 14 * 86_400;

export function confirmToken(businessId: string, email: string, now: number = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ b: businessId, e: email, x: Math.floor(now / 1000) + CONFIRM_TTL_SEC })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret()).update(`report-confirm:${body}`).digest('base64url');
  return `${body}.${sig}`;
}

export function readConfirmToken(token: string): { businessId: string; email: string } | null {
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = Buffer.from(crypto.createHmac('sha256', secret()).update(`report-confirm:${body}`).digest('base64url'));
  const got = Buffer.from(sig);
  if (expected.length !== got.length || !crypto.timingSafeEqual(expected, got)) return null;
  try {
    const j = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as { b?: string; e?: string; x?: number };
    if (typeof j.x !== 'number' || j.x * 1000 < Date.now()) return null;
    return j.b && j.e ? { businessId: j.b, email: j.e } : null;
  } catch {
    return null;
  }
}

export const confirmUrl = (businessId: string, email: string) => `${appUrl()}/api/alerts/reports/confirm?token=${encodeURIComponent(confirmToken(businessId, email))}`;

async function sendConfirmation(business: Pick<BusinessRecord, 'id' | 'name'>, email: string): Promise<void> {
  const url = confirmUrl(business.id, email);
  await sendEmail({
    to: email,
    subject: `Confirmez la réception des rapports de ${business.name}`.slice(0, 120),
    kind: 'transactional',
    text: `Bonjour,\n\nOn vous a ajouté comme destinataire des rapports de visibilité dans les IA de ${business.name}.\nPour les recevoir, confirmez votre adresse : ${url}\n\nSans confirmation, vous ne recevrez rien.`,
    html: `<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5">Bonjour,</p><p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5">On vous a ajouté comme destinataire des rapports de visibilité dans les IA de <strong>${esc(business.name)}</strong>.</p><p><a href="${esc(url)}" style="font-family:Arial,sans-serif;font-size:15px">Confirmer mon adresse</a></p><p style="font-family:Arial,sans-serif;font-size:13px;color:#5A6275">Sans confirmation, vous ne recevrez rien.</p>`,
    tags: [{ name: 'type', value: 'report_confirm' }],
  }).catch((e) => console.warn('[reports] confirmation non envoyée', e));
}

// ---------------------------------------------------------------------------
// Lecture / écriture
// ---------------------------------------------------------------------------
export async function getSchedule(businessId: string, now: Date = new Date()): Promise<ReportSchedule & { demo?: boolean }> {
  if (isDemoBusinessId(businessId)) {
    const s = defaultSchedule(businessId, now);
    return { ...s, active: true, recipients: [{ email: 'associe@exemple.fr', status: 'confirmed', addedAt: s.updatedAt, confirmedAt: s.updatedAt }], nextRunAt: nextRunAt(s, now).toISOString(), demo: true };
  }
  const doc = await getDoc<ReportSchedule>(SCHEDULES, businessId);
  return doc?.data ?? defaultSchedule(businessId, now);
}

export interface SchedulePatch {
  active?: boolean;
  frequency?: ReportFrequency;
  day?: number;
  hour?: number;
  recipients?: string[];
  includeShareLink?: boolean;
  branding?: ShareBranding | null;
}

export class ReportError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Valide et enregistre ; envoie les e-mails de confirmation aux nouvelles adresses ; replanifie. */
export async function saveSchedule(business: BusinessRecord, patch: SchedulePatch, now: Date = new Date()): Promise<ReportSchedule> {
  if (isDemoBusinessId(business.id)) throw new ReportError(403, 'Compte de démonstration : les modifications ne sont pas enregistrées.');
  const ent = getEntitlements(business);
  const cur = await getSchedule(business.id, now);
  const next: ReportSchedule = { ...cur };
  if (patch.frequency === 'weekly' || patch.frequency === 'monthly') next.frequency = patch.frequency;
  if (typeof patch.day === 'number') next.day = Math.round(patch.day);
  if (next.frequency === 'weekly') next.day = Math.min(7, Math.max(1, next.day));
  else next.day = Math.min(28, Math.max(1, next.day));
  if (typeof patch.hour === 'number') next.hour = Math.min(20, Math.max(6, Math.round(patch.hour)));
  if (typeof patch.includeShareLink === 'boolean') next.includeShareLink = patch.includeShareLink;
  if (patch.branding !== undefined) next.branding = patch.branding;
  const added: string[] = [];
  if (Array.isArray(patch.recipients)) {
    const wanted = [...new Set(patch.recipients.map((e) => String(e).trim().toLowerCase()).filter(isEmail))];
    const max = maxRecipients(ent);
    if (wanted.length > max) throw new ReportError(400, max ? `${max} destinataires au maximum avec votre offre.` : 'Les rapports planifiés ne sont pas inclus dans votre offre.');
    const byEmail = new Map(cur.recipients.map((r) => [r.email, r]));
    next.recipients = wanted.map((email) => {
      const prev = byEmail.get(email);
      if (prev) return prev;
      added.push(email);
      return { email, status: 'pending', addedAt: now.toISOString(), confirmedAt: null };
    });
  }
  if (typeof patch.active === 'boolean') next.active = patch.active;
  if (next.active && !ent.exports) throw new ReportError(402, 'Les rapports planifiés ne sont pas inclus dans votre offre.');
  next.version = cur.version + 1;
  next.nextRunAt = next.active ? nextRunAt(next, now).toISOString() : null;
  next.updatedAt = now.toISOString();
  await putDoc<ReportSchedule>(SCHEDULES, business.id, next, business.id);
  for (const email of added) await sendConfirmation(business, email);
  if (next.active && next.nextRunAt) await planNext(next);
  return next;
}

async function planNext(s: ReportSchedule): Promise<void> {
  if (!s.nextRunAt) return;
  await enqueue('report.scheduled', { businessId: s.businessId, version: s.version, runAt: s.nextRunAt }, {
    runAt: new Date(s.nextRunAt),
    businessId: s.businessId,
    dedupeKey: `report:${s.businessId}:${s.version}:${s.nextRunAt}`,
  });
}

export async function confirmRecipient(token: string, now: Date = new Date()): Promise<{ ok: boolean; businessName?: string }> {
  const t = readConfirmToken(token);
  if (!t || isDemoBusinessId(t.businessId)) return { ok: false };
  const doc = await getDoc<ReportSchedule>(SCHEDULES, t.businessId);
  const r = doc?.data.recipients.find((x) => x.email === t.email);
  if (!doc || !r) return { ok: false };
  if (r.status !== 'confirmed') {
    r.status = 'confirmed';
    r.confirmedAt = now.toISOString();
    await putDoc<ReportSchedule>(SCHEDULES, t.businessId, doc.data, t.businessId);
  }
  const b = await getBusinessRecord(t.businessId).catch(() => null);
  return { ok: true, businessName: b?.name };
}

// ---------------------------------------------------------------------------
// Contenu du rapport (pur)
// ---------------------------------------------------------------------------
export interface RenderedReport {
  subject: string;
  html: string;
  text: string;
}

const pct = (x: number) => `${Math.round(x * 100)} %`;
const frDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' });

export function renderScheduledReport(
  brandName: string,
  audits: AuditResult[],
  opts: { frequency: ReportFrequency; shareUrl?: string | null; to: string; color?: string; showRepere?: boolean },
): RenderedReport | null {
  const last = audits[audits.length - 1];
  if (!last) return null;
  // Écart seulement contre la dernière mesure COMPARABLE (mêmes questions, ≥ 6 jours), jamais l'audit précédent brut.
  const prev = previousComparable(audits as unknown as Parameters<typeof previousComparable>[0]) as AuditResult | null;
  const s = auditStats(last);
  const score = Math.round(last.score);
  const range = last.range ?? { low: score, high: score };
  const delta = prev ? score - Math.round(prev.score) : null;
  const margin = Math.max(1, Math.round((range.high - range.low) / 2));
  const evolution =
    delta === null
      ? 'Première mesure de référence : l’évolution apparaîtra au prochain rapport.'
      : Math.abs(delta) <= margin
        ? `Stable par rapport à la mesure précédente (${delta >= 0 ? '+' : ''}${delta} point${Math.abs(delta) > 1 ? 's' : ''}, dans la marge d’erreur de ± ${margin} point${margin > 1 ? 's' : ''}).`
        : `${delta > 0 ? 'En hausse' : 'En baisse'} de ${Math.abs(delta)} points depuis la mesure précédente.`;
  const missing = (last.sources?.domains ?? []).filter((d) => d.clientPresence === 'absent').slice(0, 3);
  const period = opts.frequency === 'weekly' ? 'hebdomadaire' : 'mensuel';
  const color = opts.color && /^#[0-9a-f]{6}$/i.test(opts.color) ? opts.color : '#3730A3';
  const footerBrand = opts.showRepere === false ? brandName : `${brandName} · rapport produit avec Repéré`;
  const subject = `Visibilité dans les IA de ${brandName} : ${score}/100 (rapport ${period})`.slice(0, 140);
  const demo = last.demo ? '\n(Données de démonstration.)' : '';
  const text = [
    `Rapport ${period} — ${brandName}`,
    `Mesure du ${frDate(last.measuredAt || last.createdAt)}`,
    '',
    `Score : ${score}/100 (marge ${range.low}–${range.high})`,
    evolution,
    `Classement : ${s.label}`,
    `Part de voix : ${pct(s.shareOfVoice)}`,
    `Méthode : ${s.methodLabel}`,
    missing.length ? `\nSources citées par les IA où vous êtes absent : ${missing.map((d) => d.domain).join(', ')}` : '',
    opts.shareUrl ? `\nRapport complet en lecture : ${opts.shareUrl}` : '',
    demo,
    `\n---\n${footerBrand}\nSe désinscrire : ${unsubscribeUrl(opts.to)}`,
  ].join('\n');
  const row = (k: string, v: string) => `<tr><td style="padding:6px 0;color:#5A6275">${esc(k)}</td><td style="padding:6px 0;text-align:right;font-weight:600">${esc(v)}</td></tr>`;
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;background:#F6F7FB"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #D5D9E4;border-radius:14px;font-family:Arial,sans-serif;color:#1B1F2E">
<tr><td style="padding:22px 28px 0;border-top:6px solid ${color};border-radius:14px 14px 0 0"><div style="font-size:13px;color:#5A6275">Rapport ${period} · mesure du ${esc(frDate(last.measuredAt || last.createdAt))}</div>
<div style="font-size:20px;font-weight:700;margin-top:4px">${esc(brandName)}</div></td></tr>
<tr><td style="padding:16px 28px"><div style="font-size:40px;font-weight:700;color:${color}">${score}<span style="font-size:18px;color:#5A6275">/100</span></div>
<div style="font-size:13px;color:#5A6275">Marge d’erreur : ${range.low} à ${range.high}</div>
<p style="font-size:15px;line-height:1.5">${esc(evolution)}</p>
<table role="presentation" width="100%" style="font-size:14px;border-top:1px solid #D5D9E4">${row('Classement', s.label)}${row('Part de voix', pct(s.shareOfVoice))}${row('Méthode', s.methodLabel)}</table>
${missing.length ? `<p style="font-size:14px;line-height:1.5;margin-top:16px"><strong>Sources citées par les IA où vous êtes absent :</strong> ${missing.map((d) => esc(d.domain)).join(', ')}</p>` : ''}
${opts.shareUrl ? `<p style="margin:20px 0"><a href="${esc(opts.shareUrl)}" style="display:inline-block;padding:12px 20px;background:${color};color:#fff;border-radius:10px;text-decoration:none;font-weight:600">Voir le rapport complet</a></p>` : ''}
${last.demo ? '<p style="font-size:13px;color:#5A6275">Données de démonstration.</p>' : ''}
</td></tr></table>
<p style="font-family:Arial,sans-serif;font-size:12px;color:#5A6275;max-width:560px">${esc(footerBrand)}. Vous recevez ce rapport car votre adresse a été confirmée comme destinataire. <a href="${esc(unsubscribeUrl(opts.to))}" style="color:#5A6275">Se désinscrire</a></p>
</td></tr></table></body></html>`;
  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// Envoi (traitant de la file)
// ---------------------------------------------------------------------------
export interface ScheduledReportResult {
  status: 'sent' | 'skipped';
  reason?: string;
  sent?: number;
}

/** Traitant `report.scheduled` : payload `{ businessId, version }`. Idempotent (ne renvoie pas deux fois la même échéance). */
export async function sendScheduledReport(payload: Record<string, unknown>, now: Date = new Date()): Promise<ScheduledReportResult> {
  const businessId = String(payload.businessId ?? '');
  if (!businessId || isDemoBusinessId(businessId)) return { status: 'skipped', reason: 'demo' };
  const doc = await getDoc<ReportSchedule>(SCHEDULES, businessId);
  const s = doc?.data;
  if (!s || !s.active) return { status: 'skipped', reason: 'inactive' };
  if (typeof payload.version === 'number' && payload.version !== s.version) return { status: 'skipped', reason: 'stale' };
  const runAt = typeof payload.runAt === 'string' ? payload.runAt : s.nextRunAt;
  if (runAt && s.lastSentAt && s.lastSentAt >= runAt) return { status: 'skipped', reason: 'already_sent' };
  const business = await getBusinessRecord(businessId);
  if (!business || business.isActive === false) return { status: 'skipped', reason: 'business' };
  const ent = getEntitlements(business);
  if (!ent.exports) return { status: 'skipped', reason: 'plan' };
  const audits = await listAuditsForBusiness(businessId);
  const recipients = s.recipients.filter((r) => r.status === 'confirmed').slice(0, maxRecipients(ent));
  let sent = 0;
  if (audits.length && recipients.length) {
    let url: string | null = null;
    if (s.includeShareLink && ent.shareLinks) {
      const link = await createShareLink({
        businessId, scope: 'dashboard', label: `Rapport planifié du ${now.toISOString().slice(0, 10)}`,
        expiresInDays: s.frequency === 'weekly' ? 35 : 70, branding: s.branding, whiteLabel: ent.whiteLabel, now,
      });
      url = link.url;
    }
    const brand = (ent.whiteLabel && s.branding?.name) || business.name;
    for (const r of recipients) {
      const m = renderScheduledReport(brand, audits, { frequency: s.frequency, shareUrl: url, to: r.email, color: ent.whiteLabel ? s.branding?.color : undefined, showRepere: !(ent.whiteLabel && s.branding?.hideRepere) });
      if (!m) break;
      const res = await sendEmail({ to: r.email, subject: m.subject, html: m.html, text: m.text, kind: 'service', tags: [{ name: 'type', value: 'report_scheduled' }] }).catch(() => null);
      if (res && (res.status === 'sent' || res.status === 'logged')) sent++;
    }
  }
  const next: ReportSchedule = { ...s, lastSentAt: runAt ?? now.toISOString(), nextRunAt: nextRunAt(s, new Date(Math.max(now.getTime(), runAt ? Date.parse(runAt) : 0))).toISOString() };
  await putDoc<ReportSchedule>(SCHEDULES, businessId, next, businessId);
  if (sent) {
    await addNotification(businessId, { type: 'report_sent', title: `Rapport envoyé à ${sent} destinataire${sent > 1 ? 's' : ''}`, href: '/app/rapports', dedupeKey: `report:${runAt}` }, now);
  }
  await planNext(next);
  return sent ? { status: 'sent', sent } : { status: 'skipped', reason: audits.length ? 'no_recipient' : 'no_audit' };
}

registerHandler('report.scheduled', async (p) => {
  await sendScheduledReport(p);
});
