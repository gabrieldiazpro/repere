import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { buildDemoWorkspaceById } from '@/lib/demo-v2';
import type { AuditResult } from '@/lib/engine/types';

const audits = buildDemoWorkspaceById('demo')!.audits as AuditResult[];
const biz = (id: string, plan: string) => ({ id, name: 'Garage Test', plan, trade: 'garagiste', city: 'Lyon', lastScore: 40, createdAt: '2026-01-01', ownerId: null, isActive: true, alertThreshold: 5, contactEmail: 'patron@garage.fr' });

vi.mock('@/lib/db', async (orig) => {
  const real = await orig<typeof import('@/lib/db')>();
  return {
    ...real,
    getBusinessRecord: vi.fn(async (id: string) => (id.startsWith('biz') ? biz(id, id === 'bizFree' ? 'free' : 'essentiel') : null)),
    listAuditsForBusiness: vi.fn(async (id: string) => (id.startsWith('biz') ? audits : [])),
  };
});

import { addNotification, defaultPrefs, getAlertPrefs, listNotifications, markNotifications, mergePrefs, notify, saveAlertPrefs, wants } from '@/lib/notify';
import { confirmRecipient, confirmToken, getSchedule, nextRunAt, readConfirmToken, renderScheduledReport, saveSchedule, sendScheduledReport } from '@/lib/notify/reports';
import { listLocalJobs, useMemoryJobs } from '@/lib/jobs/testing';
import type { BusinessRecord } from '@/lib/db';

beforeAll(() => {
  useMemoryJobs();
  (globalThis as { __repereDocsDir?: string }).__repereDocsDir = mkdtempSync(path.join(os.tmpdir(), 'notify-'));
});

describe('préférences d’alerte côté serveur', () => {
  it('fusion validée, seuil borné, adresses filtrées', () => {
    const p = mergePrefs(defaultPrefs(), { types: { fact_error: { email: false, bidon: true }, inconnu: { inApp: true } }, threshold: 99, copyTo: ['a@b.fr', 'pas-une-adresse', 'A@B.FR'] });
    expect(p.types.fact_error.email).toBe(false);
    expect(p.types.fact_error.inApp).toBe(true);
    expect(p.threshold).toBe(30);
    expect(p.copyTo).toEqual(['a@b.fr']);
    expect(wants(p, 'score_change', 'inApp', { delta: 3 })).toBe(false);
    expect(wants(p, 'score_change', 'inApp', { delta: -40 })).toBe(true);
    expect(wants({ ...p, threshold: 5 }, 'score_change', 'inApp', { delta: 3 })).toBe(false);
  });
  it('persistance, démo par défaut', async () => {
    await saveAlertPrefs('bizP', { threshold: 8 });
    expect((await getAlertPrefs('bizP')).threshold).toBe(8);
    expect((await getAlertPrefs('demo')).threshold).toBe(5);
  });
});

describe('centre de notifications', () => {
  it('ajout, dédoublonnage, lu / non lu', async () => {
    const a = await addNotification('bizN', { type: 'task_done', title: 'A', href: 'javascript:alert(1)', dedupeKey: 'k' });
    const b = await addNotification('bizN', { type: 'task_done', title: 'A bis', dedupeKey: 'k' });
    expect(b!.id).toBe(a!.id);
    expect(a!.href).toBeNull();
    await addNotification('bizN', { type: 'milestone', title: 'B', href: '/app' });
    let r = await listNotifications('bizN');
    expect(r.items).toHaveLength(2);
    expect(r.unread).toBe(2);
    expect(await markNotifications('bizN', [a!.id])).toBe(1);
    r = await listNotifications('bizN', { unreadOnly: true });
    expect(r.unread).toBe(1);
    expect(await markNotifications('bizN', 'all')).toBe(1);
    expect((await listNotifications('bizN')).unread).toBe(0);
  });
  it('démo : notifications dérivées, étiquetées, jamais écrites', async () => {
    const r = await listNotifications('demo');
    expect(r.items.length).toBeGreaterThan(0);
    expect(r.items.every((n) => n.demo)).toBe(true);
    expect(await addNotification('demo', { type: 'milestone', title: 'x' })).toBeNull();
    expect(await markNotifications('demo', 'all')).toBe(0);
  });
  it('notify respecte les préférences', async () => {
    await saveAlertPrefs('bizQ', { types: { milestone: { inApp: false } } });
    expect((await notify('bizQ', { type: 'milestone', title: 'Palier' })).item).toBeNull();
    expect((await notify('bizQ', { type: 'new_competitor', title: 'Nouveau' })).item).not.toBeNull();
  });
});

describe('rapports planifiés', () => {
  it('prochaine échéance à l’heure de Paris', () => {
    const w = nextRunAt({ frequency: 'weekly', day: 1, hour: 9 }, new Date('2026-11-09T10:00:00Z')); // lundi 11 h à Paris
    expect(w.toISOString()).toBe('2026-11-16T08:00:00.000Z');
    const m = nextRunAt({ frequency: 'monthly', day: 1, hour: 9 }, new Date('2026-11-09T10:00:00Z'));
    expect(m.toISOString()).toBe('2026-12-01T08:00:00.000Z');
    const summer = nextRunAt({ frequency: 'monthly', day: 1, hour: 9 }, new Date('2026-06-15T10:00:00Z'));
    expect(summer.toISOString()).toBe('2026-07-01T07:00:00.000Z');
  });
  it('jeton de confirmation signé', () => {
    const t = confirmToken('bizR', 'a@b.fr');
    expect(readConfirmToken(t)).toEqual({ businessId: 'bizR', email: 'a@b.fr' });
    expect(readConfirmToken(t.slice(0, -2) + 'xx')).toBeNull();
  });
  it('destinataires côté serveur, double opt-in, envoi', async () => {
    const b = biz('bizR', 'essentiel') as unknown as BusinessRecord;
    await expect(saveSchedule(b, { recipients: ['1@a.fr', '2@a.fr', '3@a.fr', '4@a.fr', '5@a.fr', '6@a.fr'] })).rejects.toThrow(/5 destinataires/);
    const s = await saveSchedule(b, { active: true, frequency: 'weekly', day: 1, hour: 9, recipients: ['associe@garage.fr'] }, new Date('2026-11-09T10:00:00Z'));
    expect(s.recipients[0].status).toBe('pending');
    expect(s.nextRunAt).toBe('2026-11-16T08:00:00.000Z');
    expect((await listLocalJobs('report.scheduled')).some((j) => j.payload.businessId === 'bizR')).toBe(true);
    // non confirmé : rien n'est envoyé
    expect((await sendScheduledReport({ businessId: 'bizR', version: s.version, runAt: s.nextRunAt })).reason).toBe('no_recipient');
    expect((await confirmRecipient(confirmToken('bizR', 'associe@garage.fr'))).ok).toBe(true);
    const cur = await getSchedule('bizR');
    expect(cur.recipients[0].status).toBe('confirmed');
    const res = await sendScheduledReport({ businessId: 'bizR', version: cur.version, runAt: '2026-11-23T08:00:00.000Z' }, new Date('2026-11-23T08:00:00Z'));
    expect(res).toMatchObject({ status: 'sent', sent: 1 });
    // idempotent, version périmée ignorée
    expect((await sendScheduledReport({ businessId: 'bizR', version: cur.version, runAt: '2026-11-23T08:00:00.000Z' })).reason).toBe('already_sent');
    expect((await sendScheduledReport({ businessId: 'bizR', version: 0 })).reason).toBe('stale');
  });
  it('offre Découverte : pas de rapport planifié', async () => {
    await expect(saveSchedule(biz('bizFree', 'free') as unknown as BusinessRecord, { recipients: ['a@b.fr'] })).rejects.toThrow(/offre/);
  });
  it('contenu honnête', () => {
    const r = renderScheduledReport('Garage Test', audits, { frequency: 'monthly', to: 'x@y.fr', shareUrl: 'https://repere.fr/r/abc' })!;
    const last = audits[audits.length - 1];
    expect(r.subject).toContain(`${Math.round(last.score)}/100`);
    expect(r.text).toMatch(/Marge|marge/);
    expect(r.html).toContain('https://repere.fr/r/abc');
    expect(r.html).toContain('Se désinscrire');
    const wl = renderScheduledReport('Agence X', audits, { frequency: 'weekly', to: 'x@y.fr', showRepere: false })!;
    expect(wl.text).not.toContain('Repéré');
  });
});
