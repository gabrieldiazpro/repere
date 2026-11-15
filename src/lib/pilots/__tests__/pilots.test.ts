import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const DATA_DIR = mkdtempSync(path.join(tmpdir(), 'repere-pilots-'));
process.env.DATA_DIR = DATA_DIR;
for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'RESEND_API_KEY']) delete process.env[k];

const v = await import('../validate');
const s = await import('../store');
const m = await import('../measures');
const n = await import('../notify');

const good = (over: Partial<import('../validate').PilotFields> = {}): import('../validate').PilotFields => ({
  ...v.EMPTY_PILOT,
  name: 'Claire Martin',
  email: 'Claire@Boulangerie-Test.fr ',
  company: 'Boulangerie Test',
  website: 'www.boulangerie-test.fr/',
  segment: 'local',
  city: 'Lyon',
  motivation: 'On nous trouve sur Google Maps mais jamais dans ChatGPT.',
  consent: true,
  ...over,
});

describe('validation de la candidature', () => {
  it('accepte une candidature complète', () => {
    expect(v.validatePilot(good())).toEqual({});
  });
  it('exige le consentement, le type, le site et une motivation', () => {
    const e = v.validatePilot({ ...v.EMPTY_PILOT, consent: false });
    expect(Object.keys(e).sort()).toEqual(['company', 'consent', 'email', 'motivation', 'name', 'segment', 'website'].sort());
  });
  it('exige la ville pour un commerce local seulement', () => {
    expect(v.validatePilot(good({ city: '' })).city).toBeDefined();
    expect(v.validatePilot(good({ city: '', segment: 'pme' })).city).toBeUndefined();
  });
  it('normalise le site et refuse IP, localhost et identifiants', () => {
    expect(v.normalizeWebsite('www.exemple.fr/')).toBe('https://www.exemple.fr');
    expect(v.normalizeWebsite('http://exemple.fr/boutique/')).toBe('http://exemple.fr/boutique');
    for (const bad of ['', 'localhost', 'http://127.0.0.1', 'ftp://exemple.fr', 'https://user:pw@exemple.fr', 'exemple', 'a.local']) {
      expect(v.normalizeWebsite(bad)).toBeNull();
    }
  });
  it('lit un corps inconnu sans faire confiance aux types', () => {
    const f = v.pilotFieldsFrom({ name: 3, segment: 'pirate', consent: 'true', publishOk: true });
    expect(f.name).toBe('');
    expect(f.segment).toBe('');
    expect(f.consent).toBe(false);
    expect(f.publishOk).toBe(true);
  });
});

describe('stockage des candidatures', () => {
  it('enregistre, détecte les doublons et persiste dans le store', async () => {
    const now = new Date('2026-11-15T10:00:00Z');
    const app = s.buildApplication(good(), now);
    expect(app.email).toBe('claire@boulangerie-test.fr');
    expect(app.domain).toBe('boulangerie-test.fr');
    expect(app.status).toBe('a_etudier');
    expect(app.consent.text).toBe(s.CONSENT_TEXT);
    const first = await s.savePilotApplication(app, now);
    expect(first.duplicate).toBe(false);
    expect(s.isPilotId(first.id)).toBe(true);
    const again = await s.savePilotApplication(s.buildApplication(good({ website: 'https://boulangerie-test.fr' }), now), now);
    expect(again).toEqual({ id: first.id, duplicate: true });
    const later = new Date(now.getTime() + 31 * 86_400_000);
    const third = await s.savePilotApplication(s.buildApplication(good(), later), later);
    expect(third.duplicate).toBe(false);
    // attendre la persistance sur disque
    await new Promise((r) => setTimeout(r, 50));
    const disk = JSON.parse(readFileSync(path.join(DATA_DIR, 'doc-pilots.applications.json'), 'utf8'));
    expect(Object.keys(disk)).toContain(first.id);
  });

  it('change le statut, pose J0 à l’activation, ajoute des notes, rattache un espace', async () => {
    const { id } = await s.savePilotApplication(s.buildApplication(good({ email: 'b@pme-test.fr', segment: 'pme', website: 'pme-test.fr' })));
    const t1 = new Date('2026-11-20T09:00:00Z');
    let p = await s.setPilotStatus(id, 'retenue', t1);
    expect(p?.status).toBe('retenue');
    expect(p?.startedAt).toBeNull();
    p = await s.setPilotStatus(id, 'active', new Date('2026-11-22T09:00:00Z'));
    expect(p?.startedAt).toBe('2026-11-22T09:00:00.000Z');
    expect(p?.statusHistory.map((h) => h.status)).toEqual(['a_etudier', 'retenue', 'active']);
    expect(await s.addPilotNote(id, '   ')).toBeNull();
    p = await s.addPilotNote(id, 'Appel fait, J0 lundi.');
    expect(p?.notes).toHaveLength(1);
    expect(await s.linkPilotBusiness(id, 'mauvais id !')).toBeNull();
    expect(await s.linkPilotBusiness(id, 'demo', '2026-13-45')).toBeNull();
    p = await s.linkPilotBusiness(id, 'demo', '2026-11-25');
    expect(p?.businessId).toBe('demo');
    expect(p?.startedAt).toBe('2026-11-25T09:00:00.000Z');
    expect(await s.setPilotStatus('pil_inconnu123', 'active')).toBeNull();
    expect(await s.getPilot('../../etc')).toBeNull();
  });

  it('trie (à étudier d’abord) et compte les places', async () => {
    const rows = await s.listPilots();
    expect(rows[0].status).toBe('a_etudier');
    expect(s.seatsTaken(rows)).toBe(1);
    expect(s.seatsTaken([{ status: 'retenue' }, { status: 'active' }, { status: 'refusee' }, { status: 'a_etudier' }])).toBe(2);
  });
});

describe('suivi J0 / J30 / J90', () => {
  const start = '2026-01-01T09:00:00.000Z';
  const site = [
    { at: '2025-12-30T10:00:00Z', seo: 50, geo: 40, global: 45 },
    { at: '2026-02-02T10:00:00Z', seo: 60, geo: 48, global: 54 },
    { at: '2026-03-05T10:00:00Z', seo: 99, geo: 99, global: 99 }, // hors fenêtre J30 (± 10 j) et J90 (± 15 j)
  ];
  const ai = [{ at: '2026-01-02T10:00:00Z', score: 20, low: 14, high: 26, demo: false }];

  it('prend la mesure la plus proche dans chaque fenêtre, sans interpolation', () => {
    const t = m.computeTracking(start, site, ai, new Date('2026-06-01T00:00:00Z'));
    const [j0, j30, j90] = t.milestones;
    expect(j0.site?.global).toBe(45);
    expect(j0.ai?.score).toBe(20);
    expect(j30.site?.global).toBe(54);
    expect(j30.ai).toBeNull();
    expect(j90.state).toBe('manquante');
    expect(t.delta).toEqual({ from: 'j0', to: 'j30', global: 9, ai: null, aiBeyondMargin: null });
  });
  it('dit si l’écart IA dépasse les marges d’erreur', () => {
    const later = [...ai, { at: '2026-04-01T10:00:00Z', score: 40, low: 33, high: 47, demo: false }];
    expect(m.computeTracking(start, site, later, new Date('2026-06-01T00:00:00Z')).delta?.aiBeyondMargin).toBe(true);
    const close = [...ai, { at: '2026-04-01T10:00:00Z', score: 24, low: 18, high: 30, demo: false }];
    expect(m.computeTracking(start, site, close, new Date('2026-06-01T00:00:00Z')).delta?.aiBeyondMargin).toBe(false);
  });
  it('marque « à venir » un jalon dont la fenêtre est encore ouverte', () => {
    const t = m.computeTracking(start, site.slice(0, 1), [], new Date('2026-01-15T00:00:00Z'));
    expect(t.milestones.map((x) => x.state)).toEqual(['mesure', 'a_venir', 'a_venir']);
    expect(t.delta).toBeNull();
  });
  it('lit les vraies mesures d’un espace (compte démo)', async () => {
    const { ai: points } = await m.loadMeasures('demo');
    expect(points.length).toBeGreaterThan(0);
    expect(points.every((p) => p.demo)).toBe(true);
    expect(await m.trackingFor(null, start)).toBeNull();
  });
});

describe('notification au fondateur', () => {
  it('résume la candidature et échappe le HTML', () => {
    const app = s.buildApplication(good({ company: '<b>Évil</b>', publishOk: true }));
    const r = n.renderPilotNotification('pil_abc12345', app, 'https://repere-ia.fr/');
    expect(r.subject).toBe('Candidature pilote : <b>Évil</b> (Commerce local)');
    expect(r.html).not.toContain('<b>Évil</b>');
    expect(r.html).toContain('&lt;b&gt;');
    expect(r.text).toContain('https://repere-ia.fr/admin/pilotes#pil_abc12345');
    expect(r.text).toContain('Avant/après publiable : oui');
  });
  it('choisit le destinataire PILOTS_NOTIFY_EMAIL, sinon EMAIL_REPLY_TO, sinon le contact', () => {
    const keep = { a: process.env.PILOTS_NOTIFY_EMAIL, b: process.env.EMAIL_REPLY_TO };
    process.env.PILOTS_NOTIFY_EMAIL = 'fondateur@exemple.fr';
    expect(n.pilotNotifyAddress()).toBe('fondateur@exemple.fr');
    delete process.env.PILOTS_NOTIFY_EMAIL;
    process.env.EMAIL_REPLY_TO = 'reponse@exemple.fr';
    expect(n.pilotNotifyAddress()).toBe('reponse@exemple.fr');
    delete process.env.EMAIL_REPLY_TO;
    expect(n.pilotNotifyAddress()).toMatch(/@/);
    if (keep.a) process.env.PILOTS_NOTIFY_EMAIL = keep.a;
    if (keep.b) process.env.EMAIL_REPLY_TO = keep.b;
  });
});
