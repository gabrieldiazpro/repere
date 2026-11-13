import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.setConfig({ testTimeout: 60_000 });
import type { Segment } from '@/lib/engine/types-v2';
import { buildDemoWorkspaceById } from '@/lib/demo-v2';
import {
  buildFaq,
  buildJsonLd,
  draftReviewReply,
  encodeQr,
  generateTasks,
  googleReviewUrl,
  listTasks,
  parseOpeningHours,
  pickWeekly,
  reviewKit,
  seedDemoExec,
  updateTaskStatus,
  validateJsonLd,
  weeklyTasks,
  withDemoV2,
  GBP_DESCRIPTION_MAX,
  type AuditV2,
  type StoredTask,
} from '@/lib/execution';
import { rsDivisor, rsRemainder } from '@/lib/execution/qr';
import { addWeeks, isoMonday } from '@/lib/execution/util';

beforeAll(() => {
  process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), 'repere-exec-'));
});

const IDS: Record<Segment, string> = { local: 'demo', pme: 'demo-pme', ecommerce: 'demo-ecom' };
const NOW = new Date('2026-11-09T09:00:00Z');

function workspace(segment: Segment) {
  const ws = buildDemoWorkspaceById(IDS[segment])!;
  const audit = withDemoV2(ws.audits[ws.audits.length - 1] as AuditV2, segment);
  return { ws, audit };
}

describe('generateTasks', () => {
  for (const segment of ['local', 'pme', 'ecommerce'] as Segment[]) {
    it(`produit des tâches complètes et prêtes à l'emploi (${segment})`, () => {
      const { ws, audit } = workspace(segment);
      const tasks = generateTasks(audit, ws.facts, { businessId: ws.business.id, segment, now: NOW });
      expect(tasks.length).toBeGreaterThanOrEqual(8);
      expect(new Set(tasks.map((t) => t.id)).size).toBe(tasks.length);
      for (const t of tasks) {
        expect(t.businessId).toBe(ws.business.id);
        expect(['auto', 'semi', 'guide']).toContain(t.automation);
        expect(t.minutes).toBeGreaterThan(0);
        expect([1, 2, 3]).toContain(t.impact);
        expect(t.status).toBe('todo');
        expect(t.deliverable?.length).toBeGreaterThan(0);
        for (const d of t.deliverable ?? []) {
          expect(d.content.length).toBeGreaterThan(10);
          expect(d.content).not.toMatch(/undefined|null|\[object Object\]/);
        }
      }
      const kinds = new Set(tasks.map((t) => t.kind));
      expect(kinds.has('fact_fix')).toBe(true);
      expect(kinds.has('faq_page')).toBe(true);
      expect(kinds.has('schema')).toBe(true);
      expect(kinds.has('review_request')).toBe(true);
      // Déterministe
      const again = generateTasks(audit, ws.facts, { businessId: ws.business.id, segment, now: NOW });
      expect(again.map((t) => t.id)).toEqual(tasks.map((t) => t.id));

      if (segment === 'local') {
        expect(kinds.has('gbp_profile')).toBe(true);
        expect(kinds.has('bing_places')).toBe(true);
        const gbp = tasks.find((t) => t.kind === 'gbp_profile')!;
        const desc = gbp.deliverable![0].content;
        expect(desc.length).toBeLessThanOrEqual(GBP_DESCRIPTION_MAX);
        expect(desc).toContain('Plomberie Martin');
        expect(tasks.some((t) => t.sourceDomain === 'pagesjaunes.fr')).toBe(true);
        expect(tasks.some((t) => /google|bing\.com|apple\.com/.test(t.sourceDomain ?? ''))).toBe(false);
      }
      if (segment === 'pme') {
        expect(tasks.some((t) => t.kind === 'directory' && /g2\.com|capterra|appvizer|getapp|trustpilot/.test(t.sourceDomain ?? ''))).toBe(true);
        expect(tasks.some((t) => t.kind === 'source_outreach')).toBe(true);
        expect(tasks.some((t) => t.kind === 'content' && /comparatif/.test(t.title))).toBe(true);
        expect(kinds.has('bing_places')).toBe(false);
      }
      if (segment === 'ecommerce') {
        expect(tasks.filter((t) => t.kind === 'product_feed').length).toBeGreaterThanOrEqual(2);
        const pf = tasks.find((t) => t.kind === 'product_feed' && t.deliverable?.some((d) => d.type === 'jsonld'))!;
        expect(pf).toBeTruthy();
        expect(kinds.has('apple_business')).toBe(false);
      }
      // La demande d'avis ne filtre pas et n'incite pas
      const rr = tasks.find((t) => t.kind === 'review_request')!;
      const text = rr.deliverable!.map((d) => d.content).join('\n');
      expect(text).not.toMatch(/satisfait\s*\?|cadeau offert|remise en échange|5 étoiles/i);
    });
  }

  it("n'invente pas d'information absente de la fiche de vérité", () => {
    const { ws, audit } = workspace('local');
    const tasks = generateTasks(audit, { businessId: 'x', facts: {}, updatedAt: '' }, { businessId: 'x', segment: 'local', now: NOW });
    const gbp = tasks.find((t) => t.kind === 'gbp_profile')!;
    expect(gbp.deliverable!.map((d) => d.content).join('\n')).toContain('[à compléter]');
    expect(gbp.deliverable![0].content).not.toContain('Oberkampf');
    expect(ws.facts.facts.adresse).toContain('Oberkampf');
  });
});

describe('buildJsonLd / buildFaq', () => {
  it('local : sous-type, adresse, horaires, FAQPage valides', () => {
    const { ws, audit } = workspace('local');
    const faq = buildFaq(audit, ws.facts, ws.business);
    expect(faq.length).toBeGreaterThanOrEqual(5);
    const ld = buildJsonLd(ws.business, ws.facts, 'local', { faq, pageUrl: 'https://repere-ia.fr/p/plomberie-martin' });
    expect(validateJsonLd(ld)).toEqual([]);
    const graph = ld['@graph'] as Record<string, unknown>[];
    const org = graph[0];
    expect(org['@type']).toBe('Plumber');
    expect(org.address).toMatchObject({ postalCode: '75011', addressLocality: 'Paris', streetAddress: '12 rue Oberkampf' });
    expect(org.openingHoursSpecification).toEqual([
      { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '08:00', closes: '19:00' },
      { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Saturday'], opens: '09:00', closes: '13:00' },
    ]);
    const faqNode = graph.find((n) => n['@type'] === 'FAQPage')!;
    expect((faqNode.mainEntity as unknown[]).length).toBe(faq.length);
    expect(JSON.stringify(ld)).not.toContain('undefined');
  });

  it('PME : Organization + Service', () => {
    const { ws } = workspace('pme');
    const ld = buildJsonLd(ws.business, ws.facts, 'pme');
    expect(validateJsonLd(ld)).toEqual([]);
    const graph = ld['@graph'] as Record<string, unknown>[];
    expect(graph[0]['@type']).toBe('Organization');
    expect(graph[0].foundingDate).toBe('2018');
    expect(graph.filter((n) => n['@type'] === 'Service').length).toBeGreaterThanOrEqual(3);
  });

  it('e-commerce : OnlineStore + Product/Offer', () => {
    const { ws } = workspace('ecommerce');
    const ld = buildJsonLd(ws.business, ws.facts, 'ecommerce', {
      settings: { products: [{ name: 'Shampoing solide', price: 12.9, currency: 'EUR', gtin: '3760000000001' }] },
    });
    expect(validateJsonLd(ld)).toEqual([]);
    const graph = ld['@graph'] as Record<string, unknown>[];
    expect(graph[0]['@type']).toBe('OnlineStore');
    const p = graph.find((n) => n['@type'] === 'Product')!;
    expect(p.offers).toMatchObject({ '@type': 'Offer', price: '12.90', priceCurrency: 'EUR' });
  });

  it('horaires non reconnus : aucune invention', () => {
    expect(parseOpeningHours('sur rendez-vous')).toEqual([]);
    expect(parseOpeningHours('24h/24 et 7j/7')[0]).toMatchObject({ opens: '00:00', closes: '23:59' });
  });
});

describe('weeklyTasks', () => {
  const mk = (id: string, kind: StoredTask['kind'], impact: 1 | 2 | 3, minutes: number, extra: Partial<StoredTask> = {}): StoredTask => ({
    id,
    businessId: 'b',
    kind,
    title: id,
    why: '',
    automation: 'semi',
    minutes,
    impact,
    status: 'todo',
    createdAt: NOW.toISOString(),
    ...extra,
  });
  const week = isoMonday(NOW);

  it('3 tâches : événement, plus rentable, plus rapide, sans doublon de type', () => {
    const tasks = [
      mk('a', 'directory', 3, 20),
      mk('b', 'directory', 3, 15),
      mk('c', 'fact_fix', 2, 15, { event: true }),
      mk('d', 'other', 1, 5),
      mk('e', 'content', 2, 60),
    ];
    const { tasks: pick } = pickWeekly(tasks, week);
    expect(pick).toHaveLength(3);
    expect(pick.map((t) => t.id).sort()).toEqual(['b', 'c', 'd']);
    expect(new Set(pick.map((t) => t.kind)).size).toBe(3);
    expect(pick.every((t) => t.week === week)).toBe(true);
  });

  it('une tâche non faite glisse une fois puis est remplacée', () => {
    const base = [mk('a', 'directory', 3, 20), mk('b', 'content', 2, 30), mk('c', 'other', 1, 5), mk('d', 'schema', 1, 10), mk('e', 'faq_page', 2, 10)];
    const w1 = pickWeekly(base, week);
    const ids1 = w1.tasks.map((t) => t.id);
    const merged1 = base.map((t) => w1.changed.find((c) => c.id === t.id) ?? t);
    merged1.find((t) => t.id === ids1[0])!.status = 'done';
    const w2 = pickWeekly(merged1, addWeeks(week, 1));
    const carried = w2.tasks.filter((t) => ids1.includes(t.id) && t.status !== 'done');
    expect(carried.length).toBeGreaterThan(0);
    expect(carried.every((t) => t.carried === 1)).toBe(true);
    const merged2 = merged1.map((t) => w2.changed.find((c) => c.id === t.id) ?? t);
    const w3 = pickWeekly(merged2, addWeeks(week, 2));
    for (const t of carried) expect(w3.tasks.map((x) => x.id)).not.toContain(t.id);
  });

  it('démo : amorce 8 à 12 tâches (2 faites), 3 tâches stables, statut persistant', async () => {
    for (const id of ['demo', 'demo-pme', 'demo-ecom']) {
      await seedDemoExec(id, { force: true, now: NOW });
      const all = await listTasks(id);
      expect(all.length).toBeGreaterThanOrEqual(8);
      expect(all.length).toBeLessThanOrEqual(12);
      expect(all.filter((t) => t.status === 'done')).toHaveLength(2);
      const w = await weeklyTasks(id, NOW);
      expect(w).toHaveLength(3);
      expect(new Set(w.map((t) => t.kind)).size).toBe(3);
      expect(w.some((t) => t.kind === 'fact_fix')).toBe(true);
      const again = await weeklyTasks(id, NOW);
      expect(again.map((t) => t.id)).toEqual(w.map((t) => t.id));
      const up = await updateTaskStatus(id, w[0].id, 'done');
      expect(up?.status).toBe('done');
      expect(up?.doneAt).toBeTruthy();
      expect(await updateTaskStatus('autre', w[0].id, 'done')).toBeNull();
      const after = await weeklyTasks(id, NOW);
      expect(after.find((t) => t.id === w[0].id)?.status).toBe('done');
    }
  });
});

describe('avis et QR code', () => {
  it('Reed-Solomon : vecteur de référence (HELLO WORLD, 1-M)', () => {
    const data = [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17];
    expect(rsRemainder(data, rsDivisor(10))).toEqual([196, 35, 39, 119, 235, 215, 231, 226, 93, 23]);
  });

  it('QR : motifs de repérage, bits de format valides, version adaptée', () => {
    const url = googleReviewUrl('ChIJN1t_tDeuEmsRUsoyG83frY4')!;
    const qr = encodeQr(url);
    expect(qr.size).toBe(qr.version * 4 + 17);
    const m = qr.modules;
    for (const [x, y] of [[0, 0], [qr.size - 7, 0], [0, qr.size - 7]]) {
      expect(m[y][x]).toBe(true);
      expect(m[y + 1][x + 1]).toBe(false);
      expect(m[y + 3][x + 3]).toBe(true);
    }
    // Lecture des 15 bits de format (première copie) puis contrôle BCH
    const bits: boolean[] = [];
    for (let i = 0; i <= 5; i++) bits.push(m[i][8]);
    bits.push(m[7][8], m[8][8], m[8][7]);
    for (let i = 9; i < 15; i++) bits.push(m[8][14 - i]);
    let v = 0;
    bits.forEach((b, i) => (v |= (b ? 1 : 0) << i));
    const raw = v ^ 0x5412;
    expect(raw >>> 13).toBe(0); // niveau M
    let rem = raw >>> 10;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    expect(((raw >>> 10) << 10) | rem).toBe(raw);
  });

  it('kit avis : lien depuis le placeId, sinon instructions ; aucune incitation', () => {
    const kit = reviewKit({ name: 'Plomberie Martin' }, { placeId: 'ChIJN1t_tDeuEmsRUsoyG83frY4' });
    expect(kit.reviewUrl).toBe('https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4');
    expect(kit.qrSvg).toMatch(/^<svg/);
    expect(kit.email.body).toContain(kit.reviewUrl!);
    expect(kit.email.body).toMatch(/désinscription/);
    expect(kit.sms).toMatch(/STOP/);
    const none = reviewKit({ name: 'X' });
    expect(none.reviewUrl).toBeNull();
    expect(none.instructions.length).toBeGreaterThan(1);
    expect(`${kit.email.body}${kit.sms}`).not.toMatch(/cadeau|réduction|remise|5 étoiles/i);
  });

  it('réponse à un avis : sans donnée personnelle', () => {
    const r = draftReviewReply({ rating: 1, text: 'Nul, appelez-moi au 06 12 34 56 78', author: 'Jean Dupont' }, { businessName: 'Plomberie Martin', contact: '01 43 55 12 34' });
    expect(r).not.toMatch(/Jean|Dupont|06 12 34 56 78/);
    expect(r).toMatch(/^Bonjour,/);
    expect(draftReviewReply({ rating: 5, text: 'Super travail, merci !' }, { businessName: 'Plomberie Martin' })).toMatch(/Merci/);
  });
});
