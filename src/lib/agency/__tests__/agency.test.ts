import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { agencyLimitsFor, assertAgency, getEntitlements } from '@/lib/entitlements';
import { AgencyError, agencyProfileForBusiness, initialsOf, normalizeDomain, sanitizeProfile, saveAgencyProfile, shareBrandingOf } from '@/lib/agency/profile';
import { addressOf, checkDomain, mapStatus, registerDomain, senderFor, type DomainApi } from '@/lib/agency/sender';
import { canApprove, getClientGrants, grantClient, isClientApprover, revokeClient } from '@/lib/agency/clients';
import { filterClients, portfolioRow, portfolioSummary, sortClients, type ClientInput } from '@/lib/agency/portfolio';
import { aiPartOf, loadDemoPortfolio, DEMO_AGENCY_PROFILE } from '@/lib/agency/load';
import { exportHref, openHref, safeTarget } from '@/lib/agency/links';
import { clientExportFilename, positionsCsv } from '@/lib/agency/exports';
import { parseCsv } from '@/lib/exports/csv';
import { aiDelta, brandFromProfile, buildMonthlyReport, REPERE_BRAND } from '@/lib/reports/monthly';
import { decideRoute } from '@/lib/auth/routing';
import { buildDemoWorkspaceById } from '@/lib/demo-v2';
import { renderScheduledReport } from '@/lib/notify/reports';
import type { AuditResult } from '@/lib/engine';

beforeAll(() => {
  (globalThis as { __repereDocsDir?: string }).__repereDocsDir = mkdtempSync(path.join(os.tmpdir(), 'agency-'));
});

const NOW = new Date('2026-11-15T10:00:00Z');
const base: ClientInput = {
  id: 'b1', name: 'Garage Test', segment: 'local', descriptor: 'garagiste · Lyon', demo: false,
  ai: { score: 50, low: 44, high: 56, at: '2026-11-10T08:00:00Z', errors: 0 }, aiPrev: { score: 52 }, aiTrend: [40, 45, 52, 50],
  seo: { score: 70, at: '2026-11-08T08:00:00Z' }, seoPrev: { score: 70 }, pending: 0, clientSeats: 0,
};

describe('droits agence', () => {
  it('réservés à l’offre Agence (et montrés en démo)', () => {
    expect(agencyLimitsFor('agence')).toMatchObject({ portfolio: true, clients: 50, includedClients: 10, branding: true, senderDomain: true, clientPortal: true, clientExports: true });
    expect(agencyLimitsFor('demo').portfolio).toBe(true);
    for (const t of ['decouverte', 'essentiel', 'accompagne'] as const) expect(agencyLimitsFor(t)).toMatchObject({ portfolio: false, clients: 0, branding: false, clientPortal: false });
    const agence = getEntitlements({ id: 'x', plan: 'agency', segment: 'local', planId: null });
    expect(agence.agency.portfolio).toBe(true);
    expect(agence.agency.clients).toBe(agence.brands);
    const acc = getEntitlements({ id: 'x', plan: 'accompagne', segment: 'pme', planId: null });
    expect(() => assertAgency(acc, 'branding')).toThrow(/offre Agence/);
    expect(() => assertAgency(agence, 'branding')).not.toThrow();
    // Inactif : retombe en Découverte, donc plus de fonctions agence.
    expect(getEntitlements({ id: 'x', plan: 'agency', segment: 'local', planId: null, isActive: false }).agency.portfolio).toBe(false);
  });
});

describe('marque de l’agence', () => {
  it('valide la saisie', () => {
    const p = sanitizeProfile('u1', { name: '  Agence <b>Nord</b> ', logoUrl: 'https://cdn.exemple.fr/l.png', color: '#AABBCC', replyTo: 'Contact@Nord.fr', hideRepere: true }, null, NOW);
    expect(p.name).toBe('Agence bNord/b');
    expect(p.color).toBe('#aabbcc');
    expect(p.replyTo).toBe('contact@nord.fr');
    expect(p.hideRepere).toBe(true);
    expect(() => sanitizeProfile('u1', { name: 'A' }, null)).toThrow(AgencyError);
    expect(() => sanitizeProfile('u1', { name: 'Agence', logoUrl: 'http://x.fr/l.png' }, null)).toThrow(/https/);
    expect(() => sanitizeProfile('u1', { name: 'Agence', color: 'red' }, null)).toThrow(/#RRGGBB/);
    expect(() => sanitizeProfile('u1', { name: 'Agence', replyTo: 'pas-un-mail' }, null)).toThrow(/réponse/);
    expect(shareBrandingOf(p)).toEqual({ name: p.name, logoUrl: 'https://cdn.exemple.fr/l.png', color: '#aabbcc', hideRepere: true });
    expect(initialsOf('Agence Exemple')).toBe('AE');
    expect(initialsOf('Nordik')).toBe('NO');
  });

  it('domaine d’envoi : normalisation', () => {
    expect(normalizeDomain('https://Rapports.Agence-Exemple.example/')).toBe('rapports.agence-exemple.example');
    expect(normalizeDomain('contact@agence.fr')).toBe('agence.fr');
    expect(normalizeDomain('192.168.0.1')).toBeNull();
    expect(normalizeDomain('localhost')).toBeNull();
    expect(normalizeDomain('a b.fr')).toBeNull();
  });

  it('le profil s’applique aux espaces dont un propriétaire ou admin est l’agence', async () => {
    await saveAgencyProfile('agence-1', { name: 'Agence Une', color: '#112233' }, 'moi@agence.fr', NOW);
    const members = async () => [{ userId: 'client-9', role: 'viewer' }, { userId: 'agence-1', role: 'admin' }];
    expect((await agencyProfileForBusiness('b1', { members }))?.name).toBe('Agence Une');
    expect(await agencyProfileForBusiness('b2', { members: async () => [{ userId: 'client-9', role: 'owner' }] })).toBeNull();
    // un lecteur qui aurait un profil ne donne pas sa marque
    await saveAgencyProfile('client-9', { name: 'Pas moi' }, null, NOW);
    expect(await agencyProfileForBusiness('b3', { members: async () => [{ userId: 'client-9', role: 'viewer' }] })).toBeNull();
  });
});

describe('expéditeur', () => {
  const profile = { name: 'Agence "Nord"', senderName: null, replyTo: 'contact@nord.fr', senderDomain: null };
  it('sans domaine vérifié : nom de l’agence, adresse de Repéré', () => {
    const s = senderFor(profile, 'Repéré <rapports@repere.fr>');
    expect(s).toEqual({ from: '"Agence Nord" <rapports@repere.fr>', replyTo: 'contact@nord.fr', ownDomain: false });
    expect(senderFor({ ...profile, senderDomain: { name: 'nord.fr', localPart: 'rapports', status: 'pending', records: [] } }, 'x@repere.fr').ownDomain).toBe(false);
    expect(senderFor(null, 'Repéré <a@b.fr>').from).toBe('Repéré <a@b.fr>');
    expect(addressOf('a@b.fr')).toBe('a@b.fr');
  });
  it('domaine vérifié : adresse de l’agence', () => {
    const s = senderFor({ ...profile, senderDomain: { name: 'nord.fr', localPart: 'bilan', status: 'verified', records: [] } }, 'x@repere.fr');
    expect(s.from).toBe('"Agence Nord" <bilan@nord.fr>');
    expect(s.ownDomain).toBe(true);
  });
  it('vérification par le fournisseur (faux client), sans clé : rien de simulé', async () => {
    const calls: string[] = [];
    let status = 'pending';
    const api: DomainApi = {
      create: async (n) => (calls.push(`create:${n}`), { id: 'd1', status: 'not_started', records: [{ record: 'DKIM', type: 'TXT', name: 'resend._domainkey', value: 'p=abc' }] }),
      get: async (id) => (calls.push(`get:${id}`), { id, status, records: [] }),
      verify: async (id) => {
        calls.push(`verify:${id}`);
        status = 'verified';
      },
    };
    const d = await registerDomain({ domain: 'Nord.fr' }, null, api, NOW);
    expect(d).toMatchObject({ name: 'nord.fr', localPart: 'rapports', status: 'not_started', providerId: 'd1' });
    const v = await checkDomain(d, api, NOW);
    expect(v.status).toBe('verified');
    expect(v.records.length).toBe(1); // garde les enregistrements connus si le fournisseur n'en renvoie pas
    expect(calls).toEqual(['create:nord.fr', 'verify:d1', 'get:d1']);
    expect((await registerDomain({ domain: 'nord.fr' }, null, null, NOW)).status).toBe('unavailable');
    await expect(registerDomain({ domain: 'pas un domaine' }, null, api)).rejects.toThrow(/Domaine invalide/);
    expect(mapStatus('temporary_failure')).toBe('failed');
    const broken: DomainApi = { ...api, create: async () => { throw new Error('quota'); } };
    expect((await registerDomain({ domain: 'sud.fr' }, null, broken)).status).toBe('failed');
  });
});

describe('accès client', () => {
  it('le client invité valide, le lecteur ordinaire non', async () => {
    expect(canApprove('owner', { clientApprover: false, clientPortal: false })).toBe(true);
    expect(canApprove('admin', { clientApprover: false, clientPortal: false })).toBe(true);
    expect(canApprove('member', { clientApprover: true, clientPortal: true })).toBe(false);
    expect(canApprove('viewer', { clientApprover: false, clientPortal: true })).toBe(false);
    expect(canApprove('viewer', { clientApprover: true, clientPortal: false })).toBe(false);
    expect(canApprove('viewer', { clientApprover: true, clientPortal: true })).toBe(true);
    expect(canApprove('demo', { clientApprover: true, clientPortal: true })).toBe(false);
    await grantClient('bz', 'Client@Garage.fr', 'agence-1', 'M. Client', NOW);
    expect(await isClientApprover('bz', 'client@garage.FR')).toBe(true);
    expect(await isClientApprover('bz', 'autre@garage.fr')).toBe(false);
    expect(await revokeClient('bz', 'client@garage.fr')).toBe(true);
    expect(await isClientApprover('bz', 'client@garage.fr')).toBe(false);
    expect((await getClientGrants('bz')).clients).toHaveLength(1);
  });
});

describe('portefeuille', () => {
  it('une baisse IA n’alerte qu’au-delà de la marge', () => {
    expect(portfolioRow(base, NOW).status).toBe('ok'); // −2 dans ± 6
    const drop = portfolioRow({ ...base, aiPrev: { score: 60 } }, NOW);
    expect(drop.status).toBe('alert');
    expect(drop.alerts[0]).toMatchObject({ kind: 'ai_drop', tone: 'bad' });
    expect(drop.ai?.delta).toBe(-10);
    const up = portfolioRow({ ...base, aiPrev: { score: 40 } }, NOW);
    expect(up.status).toBe('ok');
    expect(up.alerts.some((a) => a.kind === 'ai_up')).toBe(true);
  });
  it('erreurs, audit Google en recul, mesure ancienne, nouveau client', () => {
    expect(portfolioRow({ ...base, ai: { ...base.ai!, errors: 1 } }, NOW).status).toBe('watch');
    expect(portfolioRow({ ...base, ai: { ...base.ai!, errors: 3 } }, NOW).status).toBe('alert');
    expect(portfolioRow({ ...base, seoPrev: { score: 75 } }, NOW).alerts.find((a) => a.kind === 'seo_drop')?.tone).toBe('warn');
    expect(portfolioRow({ ...base, seoPrev: { score: 80 } }, NOW).status).toBe('alert');
    expect(portfolioRow({ ...base, ai: { ...base.ai!, at: '2026-09-01T00:00:00Z' } }, NOW).alerts.some((a) => a.kind === 'stale')).toBe(true);
    const fresh = portfolioRow({ ...base, ai: null, aiPrev: null, aiTrend: [], seo: null, seoPrev: null }, NOW);
    expect(fresh.status).toBe('setup');
    expect(fresh.ai).toBeNull();
    expect(fresh.alerts[0].label).toBe('Première mesure à venir');
  });
  it('tri, filtres, synthèse', () => {
    const rows = [
      portfolioRow({ ...base, id: 'a', name: 'Zeta', ai: { ...base.ai!, score: 30 }, aiPrev: { score: 50 } }, NOW),
      portfolioRow({ ...base, id: 'b', name: 'Alpha', pending: 2 }, NOW),
      portfolioRow({ ...base, id: 'c', name: 'Émile', segment: 'pme', ai: null, aiPrev: null, seo: null, seoPrev: null }, NOW),
    ];
    expect(sortClients(rows).map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(sortClients(rows, 'name', 'asc').map((r) => r.name)).toEqual(['Alpha', 'Émile', 'Zeta']);
    expect(sortClients(rows, 'ai', 'asc').map((r) => r.id)).toEqual(['a', 'b', 'c']); // sans mesure : toujours à la fin
    expect(sortClients(rows, 'ai', 'desc').map((r) => r.id)).toEqual(['b', 'a', 'c']);
    expect(filterClients(rows, { q: 'emile' }).map((r) => r.id)).toEqual(['c']);
    expect(filterClients(rows, { view: 'pending' }).map((r) => r.id)).toEqual(['b']);
    expect(filterClients(rows, { view: 'alert' }).map((r) => r.id)).toEqual(['a']);
    expect(filterClients(rows, { segment: 'pme' }).map((r) => r.id)).toEqual(['c']);
    expect(portfolioSummary(rows)).toMatchObject({ clients: 3, measured: 2, avgAi: 40, pending: 2, needAttention: 1 });
  });
  it('partie IA calculée sur la mesure précédente comparable', () => {
    const audits = buildDemoWorkspaceById('demo')!.audits as AuditResult[];
    const p = aiPartOf(audits as never);
    expect(p.ai?.score).toBe(audits.at(-1)!.score);
    expect(p.aiTrend).toHaveLength(6);
  });
  it('démo agence : 3 espaces démo existants + un nouveau client sans mesure, tous étiquetés', async () => {
    const rows = await loadDemoPortfolio(NOW);
    expect(rows.map((r) => r.id)).toEqual(['demo', 'demo-pme', 'demo-ecom', 'demo-agence-nouveau']);
    expect(rows.every((r) => r.demo)).toBe(true);
    expect(rows[0].name).toBe('Plomberie Martin');
    expect(rows[0].ai?.score).toBe(61); // même chiffre que la démo locale
    expect(rows[3]).toMatchObject({ openable: false, ai: null, status: 'setup' });
    expect(rows.slice(0, 3).every((r) => r.seo && r.seo.score >= 0)).toBe(true);
    expect(DEMO_AGENCY_PROFILE.demo).toBe(true);
  }, 30_000);
});

describe('liens et exports', () => {
  it('pas de redirection ouverte', () => {
    expect(safeTarget('/app/rapports/mensuel')).toBe('/app/rapports/mensuel');
    expect(safeTarget('https://evil.fr')).toBe('/app');
    expect(safeTarget('//evil.fr')).toBe('/app');
    expect(safeTarget('/app//evil.fr')).toBe('/app');
    expect(safeTarget('/app/agence/ouvrir?client=x')).toBe('/app');
    expect(safeTarget(null)).toBe('/app');
    expect(openHref('demo', '/app/validation')).toBe('/app/agence/ouvrir?client=demo&vers=%2Fapp%2Fvalidation');
    expect(exportHref('b1', 'positions')).toBe('/app/agence/export?client=b1&kind=positions');
  });
  it('CSV des positions et nom de fichier sans marque', () => {
    const { csv, rows } = positionsCsv({
      domain: 'garage.fr', demo: false, week: '2026-W46', previousWeek: null,
      keywords: [{ keyword: '=garage lyon', device: 'mobile', volume: null, difficulty: null, position: 4, previous: 6, change: 2, best: 3, url: 'https://garage.fr/', features: [], aiOverview: true, aiOverviewCitesUs: false, history: [] }],
    } as never);
    expect(rows).toBe(1);
    const t = parseCsv(csv.replace(/^﻿/, ''));
    expect(t[0][0]).toBe('Semaine');
    expect(t[1][2]).toBe("'=garage lyon"); // formule neutralisée
    expect(t[1][3]).toBe('mobile');
    expect(t[1][9]).toBe('non mesuré');
    expect(positionsCsv(null).rows).toBe(0);
    expect(clientExportFilename('constats', 'Plomberie Martin', true, NOW)).toBe('constats-plomberie-martin-demo-2026-11-15.csv');
  });
});

describe('rapport mensuel', () => {
  it('marque : agence seulement si le droit est là', () => {
    const p = { name: 'Agence Une', logoUrl: null, color: '#112233', hideRepere: true, footer: 'Tél.' };
    expect(brandFromProfile(p, false)).toBe(REPERE_BRAND);
    expect(brandFromProfile(p, true)).toMatchObject({ name: 'Agence Une', color: '#112233', showRepere: false, agency: true });
    expect(brandFromProfile({ ...p, color: 'bleu' }, true).color).toBe(REPERE_BRAND.color);
  });
  it('écart IA comparé à la marge, blocs vides expliqués', () => {
    expect(aiDelta(61, null, 5).tone).toBe('neutral');
    expect(aiDelta(61, 58, 5).text).toMatch(/Stable/);
    expect(aiDelta(61, 52, 5)).toEqual({ text: '+9 points depuis la mesure précédente', tone: 'good' });
    expect(aiDelta(40, 52, 5).tone).toBe('bad');
    const r = buildMonthlyReport({
      brand: REPERE_BRAND, client: { name: 'Garage Test', descriptor: '' }, demo: true,
      ai: { score: 61, low: 55, high: 67, at: '2026-11-10T08:00:00Z', rank: 2, of: 9, shareOfVoice: 0.21, errors: 1 }, aiPrev: { score: 52, rank: 4 },
      aiHistory: [{ at: '2026-10-10', score: 52 }, { at: '2026-11-10', score: 61 }], seo: null, seoPrev: null, ranks: null, agent: { applied: [], pending: [{ title: 'x' }] }, now: NOW,
    });
    expect(r.headline).toEqual({ text: 'Garage Test gagne en visibilité dans les IA : 61/100', tone: 'good' });
    expect(r.ai).toMatchObject({ rank: '2e sur 9', share: '21 %', range: '55 à 67' });
    expect(r.notes[0]).toMatch(/démonstration/);
    expect(r.notes.some((n) => /Pas encore d’audit du site/.test(n))).toBe(true);
    expect(r.notes.some((n) => /Positions Google/.test(n))).toBe(true);
  });
  it('e-mail programmé « préparé par » l’agence', () => {
    const audits = buildDemoWorkspaceById('demo')!.audits as AuditResult[];
    const m = renderScheduledReport('Plomberie Martin', audits, { frequency: 'monthly', to: 'a@b.fr', color: '#112233', showRepere: false, by: 'Agence Une' })!;
    expect(m.text).toContain('Rapport préparé par Agence Une');
    expect(m.text).not.toContain('Repéré\n');
    expect(m.html).toContain('#112233');
    const plain = renderScheduledReport('Plomberie Martin', audits, { frequency: 'monthly', to: 'a@b.fr' })!;
    expect(plain.text).toContain('Plomberie Martin · rapport produit avec Repéré');
  });
});

describe('routage de la démo agence', () => {
  it('?compte=demo-agence pose la démo et ouvre le portefeuille', () => {
    expect(decideRoute({ pathname: '/app', search: '?compte=demo-agence', hasSession: false })).toEqual({ action: 'redirect', to: '/app/agence/demo', setDemo: 'local' });
    expect(decideRoute({ pathname: '/app/agence/demo', search: '', hasSession: false, demoCookie: 'local' })).toEqual({ action: 'next' });
  });
});
