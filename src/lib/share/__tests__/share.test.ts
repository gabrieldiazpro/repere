import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { buildDemoWorkspaceById } from '@/lib/demo-v2';
import type { AuditResult } from '@/lib/engine/types';

const audits = buildDemoWorkspaceById('demo')!.audits as AuditResult[];

vi.mock('@/lib/db', async (orig) => {
  const real = await orig<typeof import('@/lib/db')>();
  return {
    ...real,
    getBusinessRecord: vi.fn(async (id: string) => (id === 'biz1' ? { id, name: 'Garage Test', plan: 'essentiel', trade: 'garagiste', city: 'Lyon', lastScore: 40, createdAt: '2026-01-01', ownerId: null, isActive: true, alertThreshold: 5, contactEmail: 'patron@garage.fr' } : null)),
    listAuditsForBusiness: vi.fn(async (id: string) => (id === 'biz1' ? audits : [])),
  };
});

import { buildPublicView, buildPublicViewFrom, createShareLink, hashToken, listShareLinks, resolveShareToken, revokeShareLink, sanitizeBranding, scrubContact, unlockProof, verifyUnlockProof, TOKEN_RE } from '@/lib/share';
import { getDoc } from '@/lib/store';

beforeAll(() => {
  (globalThis as { __repereDocsDir?: string }).__repereDocsDir = mkdtempSync(path.join(os.tmpdir(), 'share-'));
});

describe('liens de partage', () => {
  it('jeton aléatoire, seul le hachage est stocké', async () => {
    const { token, url, link } = await createShareLink({ businessId: 'biz1', scope: 'dashboard' });
    expect(TOKEN_RE.test(token)).toBe(true);
    expect(url.endsWith(`/r/${token}`)).toBe(true);
    expect(link.hint).toBe(token.slice(-6));
    const idx = await getDoc<{ linkId: string }>('share.tokens', hashToken(token));
    expect(idx?.data.linkId).toBe(link.id);
    const stored = await getDoc<Record<string, unknown>>('share.links', link.id);
    expect(JSON.stringify(stored)).not.toContain(token);
    expect((await resolveShareToken(token)).status).toBe('ok');
    const other = await createShareLink({ businessId: 'biz1', scope: 'dashboard' });
    expect(other.token).not.toBe(token);
  });

  it('expiration, révocation, jeton inconnu', async () => {
    const now = new Date('2026-11-09T10:00:00Z');
    const { token, link } = await createShareLink({ businessId: 'biz1', scope: 'dashboard', expiresInDays: 7, now });
    expect((await resolveShareToken(token, { now: new Date('2026-11-15T10:00:00Z') })).status).toBe('ok');
    expect((await resolveShareToken(token, { now: new Date('2026-11-16T10:00:01Z') })).status).toBe('expired');
    expect(await revokeShareLink('autre', link.id)).toBe(false);
    expect(await revokeShareLink('biz1', link.id)).toBe(true);
    expect((await resolveShareToken(token, { now })).status).toBe('revoked');
    expect((await resolveShareToken('x'.repeat(43))).status).toBe('not_found');
    expect((await resolveShareToken('../../etc')).status).toBe('not_found');
    const list = await listShareLinks('biz1', now);
    expect(list.find((l) => l.id === link.id)?.revoked).toBe(true);
    expect(JSON.stringify(list)).not.toMatch(/tokenHash|"hash"/);
  });

  it('expiration bornée à 365 jours', async () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const { link } = await createShareLink({ businessId: 'biz1', scope: 'dashboard', expiresInDays: 9999, now });
    expect(link.expiresAt).toBe('2027-01-01T00:00:00.000Z');
  });

  it('mot de passe facultatif et preuve de déverrouillage', async () => {
    const { token } = await createShareLink({ businessId: 'biz1', scope: 'dashboard', password: 'secret123' });
    const r = await resolveShareToken(token);
    expect(r.status).toBe('password_required');
    expect((await resolveShareToken(token, { password: 'mauvais' })).status).toBe('password_required');
    expect((await resolveShareToken(token, { password: 'secret123' })).status).toBe('ok');
    const proof = unlockProof(r.link!);
    expect(verifyUnlockProof(r.link!, proof)).toBe(true);
    expect(verifyUnlockProof(r.link!, proof.slice(1) + 'a')).toBe(false);
    expect((await resolveShareToken(token, { unlockProof: proof })).status).toBe('ok');
    await expect(createShareLink({ businessId: 'biz1', scope: 'dashboard', password: '123' })).rejects.toThrow(/8 à 128/);
  });

  it('rapport : audit du même commerce ; sans auditId, le dernier audit (contrat : facultatif)', async () => {
    await expect(createShareLink({ businessId: 'biz-sans-audit', scope: 'report' })).rejects.toThrow();
    const latest = [...audits].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
    expect((await createShareLink({ businessId: 'biz1', scope: 'report' })).link.auditId).toBe(latest.id);
    await expect(createShareLink({ businessId: 'biz1', scope: 'report', auditId: 'inexistant' })).rejects.toThrow(/introuvable/);
    const { link } = await createShareLink({ businessId: 'biz1', scope: 'report', auditId: audits[0].id });
    expect(link.auditId).toBe(audits[0].id);
  });

  it('marque blanche seulement avec le droit', () => {
    const b = { name: 'Agence <b>X</b>', logoUrl: 'https://cdn.exemple.fr/logo.png', color: '#AA0000', hideRepere: true };
    expect(sanitizeBranding(b, false)).toBeNull();
    const s = sanitizeBranding(b, true)!;
    expect(s.name).toBe('Agence bX/b');
    expect(s.color).toBe('#aa0000');
    expect(s.hideRepere).toBe(true);
    expect(sanitizeBranding({ logoUrl: 'javascript:alert(1)', color: 'red' }, true)).toBeNull();
    expect(sanitizeBranding({ logoUrl: 'http://x.fr/l.png' }, true)).toBeNull();
  });

  it('vue publique sans donnée sensible', async () => {
    const { token } = await createShareLink({ businessId: 'biz1', scope: 'dashboard', branding: { name: 'Agence', hideRepere: true }, whiteLabel: true });
    const { link } = await resolveShareToken(token);
    const v = (await buildPublicView(link!))!;
    expect(v.brand).toMatchObject({ name: 'Agence', showRepere: false });
    expect(v.history.length).toBe(Math.min(12, audits.length));
    const json = JSON.stringify(v);
    expect(json).not.toContain('patron@garage.fr');
    expect(json).not.toMatch(/"tasks"|"facts"|factCheck/);
    expect(scrubContact('écrire à jean@exemple.fr ou 06 12 34 56 78')).toBe('écrire à [adresse masquée] ou [numéro masqué]');
    const report = buildPublicViewFrom({ ...link!, scope: 'report', auditId: audits[0].id }, audits, 'Garage Test')!;
    expect(report.history).toEqual([]);
    expect(report.score).toBe(Math.round(audits[0].score));
  });
});
