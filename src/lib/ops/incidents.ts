/**
 * Incidents déclarés par l'admin (collection `ops.incidents`), affichés sur la page publique /statut.
 * Texte libre saisi par le fondateur : aucune génération automatique, aucune donnée client.
 */
import { randomUUID } from 'node:crypto';
import { getDoc, listDocs, putDoc } from '@/lib/store';
import { OPS } from './config';

export const SERVICES = {
  site: 'Site et application',
  analyses: 'Analyses et audits IA',
  paiement: 'Paiement',
  emails: 'E-mails',
  donnees: 'Base de données',
} as const;
export type ServiceId = keyof typeof SERVICES;

export type IncidentImpact = 'maintenance' | 'mineur' | 'majeur';

export const IMPACT_LABEL: Record<IncidentImpact, string> = {
  maintenance: 'Maintenance',
  mineur: 'Perturbation',
  majeur: 'Panne',
};

export interface IncidentUpdate {
  at: string;
  text: string;
}

export interface Incident {
  id: string;
  title: string;
  impact: IncidentImpact;
  services: ServiceId[];
  status: 'en_cours' | 'resolu';
  startedAt: string;
  resolvedAt: string | null;
  updates: IncidentUpdate[];
}

const clean = (s: unknown, max: number) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, max) : '');

export function isServiceId(s: unknown): s is ServiceId {
  return typeof s === 'string' && s in SERVICES;
}

export interface NewIncident {
  title: string;
  impact?: string;
  services?: string[];
  text?: string;
}

export function validateIncident(i: NewIncident): { ok: true; value: Required<Pick<Incident, 'title' | 'impact' | 'services'>> & { text: string } } | { ok: false; error: string } {
  const title = clean(i.title, 140);
  if (title.length < 4) return { ok: false, error: 'Titre trop court (4 caractères au moins).' };
  const impact = (['maintenance', 'mineur', 'majeur'] as const).find((x) => x === i.impact) ?? 'mineur';
  const services = (i.services ?? []).filter(isServiceId);
  return { ok: true, value: { title, impact, services: services.length ? [...new Set(services)] : ['site'], text: clean(i.text, 1000) } };
}

export async function createIncident(input: NewIncident, now: Date = new Date()): Promise<Incident> {
  const v = validateIncident(input);
  if (!v.ok) throw new Error(v.error);
  const at = now.toISOString();
  const inc: Incident = {
    id: `${at.slice(0, 10)}-${randomUUID().slice(0, 8)}`,
    title: v.value.title,
    impact: v.value.impact,
    services: v.value.services,
    status: 'en_cours',
    startedAt: at,
    resolvedAt: null,
    updates: v.value.text ? [{ at, text: v.value.text }] : [],
  };
  await putDoc(OPS.incidents, inc.id, inc);
  return inc;
}

export async function updateIncident(id: string, patch: { text?: string; resolve?: boolean }, now: Date = new Date()): Promise<Incident | null> {
  const prev = (await getDoc<Incident>(OPS.incidents, clean(id, 60)))?.data;
  if (!prev) return null;
  const text = clean(patch.text, 1000);
  const next: Incident = {
    ...prev,
    updates: text ? [...prev.updates, { at: now.toISOString(), text }].slice(-30) : prev.updates,
    ...(patch.resolve ? { status: 'resolu' as const, resolvedAt: now.toISOString() } : {}),
  };
  await putDoc(OPS.incidents, next.id, next);
  return next;
}

/** Incidents en cours, puis résolus des `days` derniers jours (les plus récents d'abord). */
export async function listIncidents(days = 90, now: Date = new Date()): Promise<Incident[]> {
  const since = now.getTime() - days * 86_400_000;
  return (await listDocs<Incident>(OPS.incidents, { limit: 200 }))
    .map((d) => d.data)
    .filter((i) => i.status === 'en_cours' || new Date(i.startedAt).getTime() >= since)
    .sort((a, b) => (a.status === b.status ? b.startedAt.localeCompare(a.startedAt) : a.status === 'en_cours' ? -1 : 1));
}
