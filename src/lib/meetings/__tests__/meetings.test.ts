import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'repere-meetings-'));
for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'RESEND_API_KEY']) delete process.env[k];

const m = await import('..');

// Lundi 23 novembre 2026, 10 h à Paris
const NOW = new Date('2026-11-23T09:00:00Z');
const good = (over: Partial<import('../validate').MeetingFields> = {}): import('../validate').MeetingFields => ({
  ...m.EMPTY_MEETING,
  offer: 'accompagne',
  segment: 'pme',
  company: 'Exemple PME',
  website: 'exemple-pme.fr',
  size: '11-50',
  need: 'Comprendre pourquoi ChatGPT cite nos concurrents.',
  slots: [{ date: '2026-11-25', period: 'matin' }],
  name: 'Paul Durand',
  email: 'paul@exemple-pme.fr',
  consent: true,
  ...over,
});

describe('validation de la demande de démo', () => {
  it('accepte une demande complète', () => {
    expect(m.validateMeeting(good(), NOW)).toEqual({});
  });
  it('bornes des créneaux : demain → J+60, en semaine', () => {
    expect(m.slotBounds(NOW)).toEqual({ min: '2026-11-24', max: '2027-01-22' });
    expect(m.slotError({ date: '2026-11-23', period: 'matin' }, NOW)).toMatch(/demain/);
    expect(m.slotError({ date: '2026-11-28', period: 'matin' }, NOW)).toMatch(/lundi au vendredi/);
    expect(m.slotError({ date: '2027-03-01', period: 'matin' }, NOW)).toMatch(/60/);
    expect(m.slotError({ date: '2026-02-30', period: 'matin' }, NOW)).toMatch(/invalide/);
    expect(m.slotError({ date: '2026-11-26', period: 'soir' as never }, NOW)).toMatch(/matin/);
  });
  it('exige un créneau ou des disponibilités, refuse les doublons et plus de 3 créneaux', () => {
    expect(m.validateMeeting(good({ slots: [] }), NOW).slots).toBeDefined();
    expect(m.validateMeeting(good({ slots: [], otherTimes: 'Le mardi matin' }), NOW)).toEqual({});
    expect(m.validateMeeting(good({ slots: [{ date: '2026-11-25', period: 'matin' }, { date: '2026-11-25', period: 'matin' }] }), NOW).slots).toMatch(/deux fois/);
    const four = ['2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27'].map((date) => ({ date, period: 'matin' as const }));
    expect(m.validateMeeting(good({ slots: four }), NOW).slots).toBeDefined();
  });
  it('taille propre à l’offre, segment exigé pour Accompagné seulement', () => {
    expect(m.validateMeeting(good({ offer: 'agence', segment: '', size: '11-50' }), NOW).size).toMatch(/clients/);
    expect(m.validateMeeting(good({ offer: 'agence', segment: '', size: 'c6-20' }), NOW)).toEqual({});
    expect(m.validateMeeting(good({ segment: '' }), NOW).segment).toBeDefined();
    expect(m.validateMeeting(good({ consent: false }), NOW).consent).toBeDefined();
    expect(m.validateMeeting(good({ phone: 'abc' }), NOW).phone).toBeDefined();
  });
  it('lit un corps inconnu sans faire confiance aux types', () => {
    const f = m.meetingFieldsFrom({ offer: 'x', consent: 'true', slots: [{ date: 5 }, 'x', { date: '2026-11-25', period: 'matin' }] });
    expect(f.offer).toBe('');
    expect(f.consent).toBe(false);
    expect(f.slots).toEqual([{ date: '2026-11-25', period: 'matin' }]);
  });
});

describe('agenda en ligne', () => {
  it('n’accepte qu’une adresse https sans identifiants', () => {
    expect(m.bookingUrl({})).toBeNull();
    expect(m.bookingUrl({ NEXT_PUBLIC_BOOKING_URL: 'http://cal.com/repere' })).toBeNull();
    expect(m.bookingUrl({ NEXT_PUBLIC_BOOKING_URL: 'https://u:p@cal.com/repere' })).toBeNull();
    expect(m.bookingUrl({ NEXT_PUBLIC_BOOKING_URL: 'javascript:alert(1)' })).toBeNull();
    expect(m.bookingUrl({ NEXT_PUBLIC_BOOKING_URL: ' https://cal.com/repere/demo ' })).toBe('https://cal.com/repere/demo');
    expect(m.bookingToolName('https://cal.com/repere/demo')).toBe('Cal.com');
  });
});

describe('stockage et e-mails', () => {
  it('enregistre, ignore un doublon sous 24 h, change de statut', async () => {
    const rec = m.buildMeeting(good(), { utmSource: 'partenaire', utmMedium: 'partenaire', utmCampaign: 'studio' }, NOW);
    const a = await m.saveMeeting(rec, NOW);
    expect(a.duplicate).toBe(false);
    expect((await m.saveMeeting(m.buildMeeting(good(), null, NOW), new Date(NOW.getTime() + 3_600_000))).duplicate).toBe(true);
    expect((await m.saveMeeting(m.buildMeeting(good({ offer: 'agence', size: 'c1-5' }), null, NOW), NOW)).duplicate).toBe(false);
    const r = await m.setMeetingStatus(a.id, 'planifiee');
    expect(r?.statusHistory.map((h) => h.status)).toEqual(['nouvelle', 'planifiee']);
    expect(await m.setMeetingStatus('mtg_inexistant', 'faite')).toBeNull();
  });
  it('réponse automatique honnête : délai d’1 jour ouvré, aucun rendez-vous confirmé', () => {
    const rec = m.buildMeeting(good({ name: '<i>Paul</i>' }), null, NOW);
    const ack = m.renderMeetingAck(rec, { bookingUrl: 'https://cal.com/repere' });
    expect(ack.text).toMatch(/sous 1 jour ouvré/);
    expect(ack.text).toMatch(/aucun rendez-vous n’est encore fixé/);
    expect(ack.text).toContain('https://cal.com/repere');
    expect(ack.html).not.toContain('<i>Paul</i>');
    const n = m.renderMeetingNotification('mtg_abcdefgh', m.buildMeeting(good(), { utmMedium: 'partenaire', utmCampaign: 'studio', utmSource: 'partenaire' }, NOW), 'https://repere-ia.fr');
    expect(n.text).toContain('lien partenaire « studio »');
    expect(n.text).toContain('/admin/partenaires/rendez-vous#mtg_abcdefgh');
  });
});
