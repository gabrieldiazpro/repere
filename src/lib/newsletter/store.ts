/**
 * Stockage de la lettre mensuelle (src/lib/store, collections préfixées `newsletter.`).
 *
 * - `newsletter.subscribers` : une fiche par adresse (id = empreinte de l'adresse). Statut pending → active (après clic
 *   sur le lien de confirmation) → unsubscribed. Le texte exact du consentement et sa date sont conservés (preuve).
 * - `newsletter.issues` : numéros (brouillon → en cours d'envoi → envoyé). Aucun envoi automatique.
 * - `newsletter.deliveries` : un document par (numéro, abonné) envoyé, pour reprendre l'envoi par lots sans doublon.
 * - `newsletter.downloads` : demandes de ressources (guide 2027), avec le consentement distinct à la lettre.
 */
import { getDoc, listDocs, putDoc, updateDoc } from '@/lib/store';
import { emailId, normEmail } from './tokens';

export const COLL = {
  subscribers: 'newsletter.subscribers',
  issues: 'newsletter.issues',
  deliveries: 'newsletter.deliveries',
  downloads: 'newsletter.downloads',
} as const;

export type SubscriberStatus = 'pending' | 'active' | 'unsubscribed';
export type SubscribeSource = 'site' | 'veille' | 'guide' | 'ressource' | 'autre';
export const SOURCES: SubscribeSource[] = ['site', 'veille', 'guide', 'ressource', 'autre'];

/** Texte du consentement affiché sous la case à cocher (conservé avec l'inscription). */
export const CONSENT_TEXT =
  "J'accepte de recevoir la lettre mensuelle de Repéré (veille Google et IA, une fois par mois). Je peux me désinscrire en un clic à tout moment.";

export interface Subscriber {
  email: string;
  status: SubscriberStatus;
  source: SubscribeSource;
  /** Page d'inscription (chemin), pour savoir quel formulaire fonctionne. */
  page?: string;
  consentText: string;
  consentAt: string;
  confirmSentAt?: string;
  confirmedAt?: string;
  unsubscribedAt?: string;
  createdAt: string;
}

export interface NewsletterIssue {
  id: string;
  number: number;
  subject: string;
  preheader: string;
  intro: string;
  /** Fiches de veille reprises (slugs, dans l'ordre). */
  entrySlugs: string[];
  outro: string;
  status: 'draft' | 'sending' | 'sent';
  createdAt: string;
  updatedAt: string;
  sentCount: number;
  failedCount: number;
  lastBatchAt?: string;
  sentAt?: string;
}

export interface Delivery {
  issueId: string;
  subscriberId: string;
  status: 'sent' | 'logged' | 'suppressed' | 'error';
  at: string;
  error?: string;
}

export interface DownloadRequest {
  email: string;
  resource: 'guide-2027';
  /** Case « recevoir aussi la lettre » cochée (consentement distinct). */
  newsletter: boolean;
  page?: string;
  requestedAt: string;
  sentAt?: string;
}

const now = () => new Date().toISOString();

/* ------------------------------ abonnés ------------------------------ */

export async function getSubscriber(email: string): Promise<Subscriber | null> {
  return (await getDoc<Subscriber>(COLL.subscribers, emailId(email)))?.data ?? null;
}

/**
 * Enregistre une demande d'inscription. Ne réactive jamais un abonné actif (rien à faire) ; une adresse désinscrite
 * qui se réinscrit repasse par la confirmation. Retourne l'état et s'il faut envoyer l'e-mail de confirmation.
 */
export async function requestSubscription(
  email: string,
  source: SubscribeSource,
  page?: string,
): Promise<{ subscriber: Subscriber; sendConfirmation: boolean }> {
  const e = normEmail(email);
  const prev = await getSubscriber(e);
  if (prev?.status === 'active') return { subscriber: prev, sendConfirmation: false };
  const t = now();
  const sub: Subscriber = {
    email: e,
    status: 'pending',
    source: prev?.status === 'pending' ? prev.source : source,
    page: prev?.status === 'pending' ? prev.page : page,
    consentText: CONSENT_TEXT,
    consentAt: t,
    confirmSentAt: t,
    createdAt: prev?.createdAt ?? t,
  };
  await putDoc(COLL.subscribers, emailId(e), sub);
  return { subscriber: sub, sendConfirmation: true };
}

/** Confirme (double opt-in). Une adresse inconnue ou désinscrite n'est pas réactivée par un vieux lien. */
export async function confirmSubscription(email: string): Promise<'confirmed' | 'already' | 'unknown'> {
  const prev = await getSubscriber(email);
  if (!prev || prev.status === 'unsubscribed') return 'unknown';
  if (prev.status === 'active') return 'already';
  await updateDoc<Subscriber>(COLL.subscribers, emailId(email), { status: 'active', confirmedAt: now() });
  return 'confirmed';
}

/** Désinscription : toujours possible, même pour une adresse inconnue (on garde alors une trace « unsubscribed »). */
export async function unsubscribe(email: string): Promise<void> {
  const e = normEmail(email);
  const prev = await getSubscriber(e);
  const t = now();
  await putDoc<Subscriber>(COLL.subscribers, emailId(e), {
    email: e,
    status: 'unsubscribed',
    source: prev?.source ?? 'autre',
    page: prev?.page,
    consentText: prev?.consentText ?? '',
    consentAt: prev?.consentAt ?? t,
    confirmSentAt: prev?.confirmSentAt,
    confirmedAt: prev?.confirmedAt,
    unsubscribedAt: t,
    createdAt: prev?.createdAt ?? t,
  });
}

export async function listSubscribers(): Promise<(Subscriber & { id: string })[]> {
  const docs = await listDocs<Subscriber>(COLL.subscribers, { limit: 100_000 });
  return docs.map((d) => ({ ...d.data, id: d.id })).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

export function subscriberCounts(list: Subscriber[]) {
  return {
    total: list.length,
    active: list.filter((s) => s.status === 'active').length,
    pending: list.filter((s) => s.status === 'pending').length,
    unsubscribed: list.filter((s) => s.status === 'unsubscribed').length,
  };
}

/* ------------------------------ numéros ------------------------------ */

export async function listIssues(): Promise<NewsletterIssue[]> {
  const docs = await listDocs<NewsletterIssue>(COLL.issues, { limit: 500 });
  return docs.map((d) => d.data).sort((a, b) => b.number - a.number);
}

export async function getIssue(id: string): Promise<NewsletterIssue | null> {
  return (await getDoc<NewsletterIssue>(COLL.issues, id))?.data ?? null;
}

export async function saveIssue(issue: NewsletterIssue): Promise<NewsletterIssue> {
  const next = { ...issue, updatedAt: now() };
  await putDoc(COLL.issues, issue.id, next);
  return next;
}

/** Modifie un brouillon. Un numéro en cours d'envoi ou envoyé n'est plus modifiable (ce qui est parti est parti). */
export async function updateDraft(
  id: string,
  patch: Partial<Pick<NewsletterIssue, 'subject' | 'preheader' | 'intro' | 'entrySlugs' | 'outro'>>,
): Promise<NewsletterIssue | null> {
  const prev = await getIssue(id);
  if (!prev || prev.status !== 'draft') return null;
  return saveIssue({ ...prev, ...patch });
}

export async function nextIssueNumber(): Promise<number> {
  const all = await listIssues();
  return all.reduce((m, i) => Math.max(m, i.number), 0) + 1;
}

/* ------------------------------ envois ------------------------------ */

export const deliveryId = (issueId: string, subscriberId: string) => `${issueId}:${subscriberId}`;

export async function getDelivery(issueId: string, subscriberId: string): Promise<Delivery | null> {
  return (await getDoc<Delivery>(COLL.deliveries, deliveryId(issueId, subscriberId)))?.data ?? null;
}

export async function recordDelivery(d: Delivery): Promise<void> {
  await putDoc(COLL.deliveries, deliveryId(d.issueId, d.subscriberId), d);
}

/* ------------------------------ ressources ------------------------------ */

export async function recordDownload(r: Omit<DownloadRequest, 'requestedAt'>): Promise<DownloadRequest> {
  const doc: DownloadRequest = { ...r, email: normEmail(r.email), requestedAt: now() };
  await putDoc(COLL.downloads, `${r.resource}:${emailId(r.email)}:${Date.now().toString(36)}`, doc);
  return doc;
}

export async function listDownloads(): Promise<DownloadRequest[]> {
  return (await listDocs<DownloadRequest>(COLL.downloads, { limit: 100_000 })).map((d) => d.data);
}

/* ------------------------------ export ------------------------------ */

const csvCell = (v: string | undefined) => {
  const s = v ?? '';
  // Protection contre l'injection de formules dans un tableur.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function subscribersCsv(list: Subscriber[]): string {
  const head = ['email', 'statut', 'source', 'page', 'consentement_le', 'confirme_le', 'desinscrit_le', 'cree_le'];
  const rows = list.map((s) =>
    [s.email, s.status, s.source, s.page, s.consentAt, s.confirmedAt, s.unsubscribedAt, s.createdAt].map(csvCell).join(','),
  );
  return `﻿${[head.join(','), ...rows].join('\n')}\n`;
}
