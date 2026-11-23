/**
 * Pilote automatique (V10, PILOTE-AUTO) : mandat, règles d'éligibilité, arrêt automatique, passage complet sur
 * dépendances simulées, récapitulatif, liens signés, offre (droits, marge ≥ 70 %).
 */
import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import {
  CATEGORY_DEFS,
  CONTENT_REVIEW_HOURS,
  DEFAULT_CATEGORIES,
  NEVER_DONE,
  categoryOfKind,
  isMandateActor,
  mandateActor,
  mandateKinds,
  mandateText,
  sanitizeCategories,
  type Mandate,
} from '../mandate';
import { evaluateChangeSet, evaluateDraft, introducesPrice, isLegalUrl, jsonLdFromFiche, scoreDrop } from '../policy';
import { buildRecap, isRecapDue, recapEmail } from '../recap';
import { signActionToken, verifyActionToken } from '../tokens';
import { runAutopilot, sweepBusiness, type AutopilotDeps } from '../runner';
import type { AutopilotState } from '../store';
import type { ChangeSet, Change } from '@/lib/publish/types';
import type { ContentDraft } from '@/lib/content/types';
import { getEntitlements, type Entitlements } from '@/lib/entitlements';
import { PILOTE_PLAN_IDS, getPlan, isPilotePlanId, planTier, pilotePlanFor } from '@/lib/plans';
import { autopilotMargin, grossMargin } from '@/lib/economics';

const NOW = new Date('2026-11-23T08:00:00Z'); // lundi

const mandate = (over: Partial<Mandate> = {}): Mandate => ({
  id: 'mdt_test_abcdef',
  businessId: 'b1',
  categories: [...DEFAULT_CATEGORIES],
  status: 'active',
  signedAt: '2026-11-01T10:00:00.000Z',
  signedBy: { userId: 'u1', email: 'client@exemple.fr' },
  proof: { version: 'v', textHash: 'h', serverAt: '2026-11-01T10:00:00.000Z' },
  text: 't',
  updatedAt: '2026-11-01T10:00:00.000Z',
  ...over,
});

const change = (over: Partial<Change> = {}): Change => ({
  id: 'ch1',
  kind: 'meta.title',
  target: { url: 'https://exemple.fr/services' },
  patch: { op: 'set', value: 'Plombier à Lyon 3e — Dépannage' },
  before: 'Accueil',
  beforeSource: 'platform',
  after: 'Plombier à Lyon 3e — Dépannage',
  rationale: '',
  risk: 'low',
  generatedBy: 'ai',
  status: 'pending',
  ...over,
});

const cs = (over: Partial<ChangeSet> = {}, ch: Partial<Change> = {}): ChangeSet => ({
  id: 'cs_test_000001',
  businessId: 'b1',
  platform: 'wordpress',
  site: 'https://exemple.fr',
  title: 'Titres de pages',
  origin: { findingId: 'seo.title.too_long' },
  changes: [change(ch)],
  risk: 'low',
  status: 'proposed',
  createdAt: NOW.toISOString(),
  createdBy: { id: 'agent' },
  version: 1,
  updatedAt: NOW.toISOString(),
  ...over,
});

const ctx = { mandate: mandate(), regulated: false, ficheValues: ['Plomberie Martin', '12 rue des Lilas, Lyon', '04 00 00 00 00', 'Lun-Ven 8h-18h'] };

describe('mandat : catégories, texte, preuve', () => {
  it('défauts prudents : robots.txt et redirections décochés ; contenus cochés avec relecture de 72 h', () => {
    expect(DEFAULT_CATEGORIES).not.toContain('robots_ia');
    expect(DEFAULT_CATEGORIES).not.toContain('redirections');
    expect(DEFAULT_CATEGORIES).toContain('contenus');
    expect(CONTENT_REVIEW_HOURS).toBe(72);
  });
  it('les types jamais couverts : canonique, noindex, plan du site, fiche Google, réécriture, FAQ', () => {
    for (const k of ['canonical', 'meta.robots', 'sitemap.xml', 'gbp.description', 'gbp.hours', 'rewrite', 'faq'] as const) expect(categoryOfKind(k)).toBeNull();
    expect(mandateKinds(['titres', 'alt'])).toEqual(['meta.title', 'image.alt']);
  });
  it('métier réglementé : aucune catégorie rédactionnelle', () => {
    expect(sanitizeCategories(['titres', 'descriptions', 'contenus', 'alt', 'inconnu'], true)).toEqual(['alt']);
    expect(sanitizeCategories(['contenus', 'titres', 'titres'])).toEqual(['titres', 'contenus']);
  });
  it('le texte signé cite les catégories, les interdits, les plafonds, l’annulation et la mention « à relire par un avocat »', () => {
    const t = mandateText({ businessName: 'Plomberie Martin', site: 'https://exemple.fr', categories: ['titres'], signerEmail: 'a@b.fr', at: NOW.toISOString(), limits: { series: 20, contents: 2 } });
    expect(t).toMatch(/à relire par un avocat/);
    expect(t).toMatch(/Titres des pages/);
    expect(t).not.toMatch(/Textes alternatifs/);
    for (const n of NEVER_DONE) expect(t).toContain(n);
    expect(t).toMatch(/20 séries de corrections et 2 contenus par mois/);
    expect(t).toMatch(/annulée en un clic/);
    expect(crypto.createHash('sha256').update(t).digest('hex')).toHaveLength(64);
  });
  it('acteur du mandat : reconnu seulement sous la forme mandat:mdt_…', () => {
    expect(isMandateActor(mandateActor(mandate()))).toBe(true);
    expect(isMandateActor({ id: 'mandat:x', role: 'mandate' })).toBe(false);
    expect(isMandateActor({ id: 'mandat:mdt_test_abcdef', role: 'admin' })).toBe(false);
  });
  it('chaque catégorie a un libellé et une aide', () => {
    for (const c of CATEGORY_DEFS) expect(c.label && c.help).toBeTruthy();
  });
});

describe('règles : ce que le pilote ne fait jamais', () => {
  it('titre ordinaire : appliqué', () => expect(evaluateChangeSet(cs(), ctx)).toEqual({ ok: true, reasons: [] }));
  it('mandat en pause ou catégorie décochée : non', () => {
    expect(evaluateChangeSet(cs(), { ...ctx, mandate: mandate({ status: 'paused' }) }).ok).toBe(false);
    expect(evaluateChangeSet(cs(), { ...ctx, mandate: mandate({ categories: ['alt'] }) }).ok).toBe(false);
  });
  it('pages juridiques et d’avis : jamais', () => {
    expect(isLegalUrl('https://exemple.fr/mentions-legales')).toBe(true);
    expect(isLegalUrl('https://exemple.fr/cgv')).toBe(true);
    expect(isLegalUrl('https://exemple.fr/politique-de-confidentialite')).toBe(true);
    expect(evaluateChangeSet(cs({}, { target: { url: 'https://exemple.fr/cgv' } }), ctx).ok).toBe(false);
    expect(evaluateChangeSet(cs({}, { target: { url: 'https://exemple.fr/avis-clients' } }), ctx).ok).toBe(false);
  });
  it('prix : jamais introduit ni modifié', () => {
    expect(introducesPrice('Dépannage', 'Dépannage dès 49 €')).toBe(true);
    expect(introducesPrice('Dépannage dès 49 €', 'Plombier Lyon — dès 49 €')).toBe(false);
    expect(evaluateChangeSet(cs({}, { after: 'Dépannage dès 49 €', patch: { op: 'set', value: 'Dépannage dès 49 €' } }), ctx).ok).toBe(false);
  });
  it('suppression, « [à compléter] », export, fiche Google, réécriture : jamais', () => {
    expect(evaluateChangeSet(cs({}, { after: null }), ctx).ok).toBe(false);
    expect(evaluateChangeSet(cs({}, { after: 'Plombier [à compléter]', patch: { op: 'set', value: 'Plombier [à compléter]' } }), ctx).ok).toBe(false);
    expect(evaluateChangeSet(cs({ platform: 'export' }), ctx).ok).toBe(false);
    expect(evaluateChangeSet(cs({ origin: { findingId: 'content:ct_x' } }), ctx).ok).toBe(false);
    expect(evaluateChangeSet(cs({}, { kind: 'canonical' }), ctx).ok).toBe(false);
  });
  it('redirections : seulement des pages cassées, et seulement si cochées', () => {
    const red = { kind: 'redirect' as const, target: { url: 'https://exemple.fr/ancienne', path: '/ancienne' }, patch: { op: 'set' as const, value: '/services' }, before: null, after: '/services' };
    const m = mandate({ categories: [...DEFAULT_CATEGORIES, 'redirections'] });
    expect(evaluateChangeSet(cs({ origin: { findingId: 'seo.broken.internal' } }, red), { ...ctx, mandate: m }).ok).toBe(true);
    expect(evaluateChangeSet(cs({ origin: { findingId: 'seo.dup.redirect' } }, red), { ...ctx, mandate: m }).ok).toBe(false);
    expect(evaluateChangeSet(cs({ origin: { findingId: 'seo.broken.internal' } }, red), ctx).ok).toBe(false);
  });
  it('données structurées : seulement les faits de la fiche officielle confirmée, jamais prix ni avis', () => {
    const ok = '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Plumber","name":"Plomberie Martin","telephone":"04 00 00 00 00","url":"https://exemple.fr"}</script>';
    expect(jsonLdFromFiche(ok, ctx.ficheValues).ok).toBe(true);
    expect(jsonLdFromFiche(ok.replace('Plomberie Martin', 'Meilleur plombier de France'), ctx.ficheValues).ok).toBe(false);
    expect(jsonLdFromFiche(ok.replace('"url"', '"aggregateRating":{"ratingValue":"5"},"url"'), ctx.ficheValues).ok).toBe(false);
    expect(jsonLdFromFiche(ok.replace('"url"', '"priceRange":"€€","url"'), ctx.ficheValues).ok).toBe(false);
    expect(evaluateChangeSet(cs({}, { kind: 'jsonld', patch: { op: 'append', value: ok }, before: null, after: ok }), { ...ctx, ficheValues: [] }).ok).toBe(false);
  });
  it('robots.txt : seulement des autorisations ajoutées', () => {
    const m = mandate({ categories: [...DEFAULT_CATEGORIES, 'robots_ia'] });
    const add = { kind: 'robots.txt' as const, patch: { op: 'append' as const, value: 'User-agent: GPTBot\nAllow: /' }, after: 'x\nUser-agent: GPTBot\nAllow: /', before: 'x' };
    expect(evaluateChangeSet(cs({}, add), { ...ctx, mandate: m }).ok).toBe(true);
    expect(evaluateChangeSet(cs({}, { ...add, patch: { op: 'append', value: 'User-agent: *\nDisallow: /' } }), { ...ctx, mandate: m }).ok).toBe(false);
  });
  it('métier réglementé : aucun titre ni description rédigés seuls', () => expect(evaluateChangeSet(cs(), { ...ctx, regulated: true }).ok).toBe(false));
});

const draft = (over: Partial<ContentDraft> = {}): ContentDraft =>
  ({
    id: 'ct_test_1',
    businessId: 'b1',
    action: 'create',
    pageType: 'zone',
    format: 'page',
    target: 'plombier lyon 3',
    title: 'Zone d’intervention',
    slug: 'zone-intervention',
    metaTitle: 'Zone d’intervention — Plomberie Martin',
    metaDescription: 'Nous intervenons à Lyon 3e et alentours.',
    body: '## Où intervenons-nous ?\nLyon 3e et alentours.',
    sources: [],
    jsonLd: [],
    links: [],
    cannibal: [],
    checks: [{ id: 'title', label: 'Titre', ok: true, detail: '' }],
    citability: { score: 70, passages: [] },
    factsUsed: ['zone', 'telephone'],
    missing: [],
    writer: 'modele',
    history: [],
    status: 'draft',
    questionIds: [],
    evidence: [],
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    version: 1,
    ...over,
  }) as ContentDraft;

describe('contenus : faits de la fiche confirmée, contrôles passés', () => {
  const dctx = { mandate: mandate(), regulated: false, fiche: { confirmedAt: '2026-11-10T00:00:00Z', verifiedKeys: ['zone', 'telephone', 'adresse'] } };
  it('complet, vérifié : programmé', () => expect(evaluateDraft(draft(), dctx)).toEqual({ ok: true, reasons: [] }));
  it('fiche non confirmée, fait non vérifié, « [à compléter] », contrôle raté : non', () => {
    expect(evaluateDraft(draft(), { ...dctx, fiche: { confirmedAt: null, verifiedKeys: ['zone', 'telephone'] } }).ok).toBe(false);
    expect(evaluateDraft(draft({ factsUsed: ['zone', 'prix'] }), dctx).ok).toBe(false);
    expect(evaluateDraft(draft({ body: 'Tarif : [à compléter]' }), dctx).ok).toBe(false);
    expect(evaluateDraft(draft({ checks: [{ id: 'x', label: 'Longueur', ok: false, detail: '' }] }), dctx).ok).toBe(false);
    expect(evaluateDraft(draft({ missing: ['horaires'] }), dctx).ok).toBe(false);
  });
  it('tarifs, prix cité, réécriture, page juridique, métier réglementé, contenus décochés : non', () => {
    expect(evaluateDraft(draft({ pageType: 'tarifs' }), dctx).ok).toBe(false);
    expect(evaluateDraft(draft({ body: 'Dépannage dès 49 €' }), dctx).ok).toBe(false);
    expect(evaluateDraft(draft({ action: 'rewrite' }), dctx).ok).toBe(false);
    expect(evaluateDraft(draft({ slug: 'mentions-legales' }), dctx).ok).toBe(false);
    expect(evaluateDraft(draft(), { ...dctx, regulated: true }).ok).toBe(false);
    expect(evaluateDraft(draft(), { ...dctx, mandate: mandate({ categories: ['titres'] }) }).ok).toBe(false);
  });
});

describe('arrêt automatique', () => {
  it('baisse au-delà de la marge de 5 points : arrêt', () => {
    expect(scoreDrop({ seo: 80, geo: 70 }, { seo: 74, geo: 70 }).dropped).toBe(true);
    expect(scoreDrop({ seo: 80, geo: 70 }, { seo: 76, geo: 66 }).dropped).toBe(false);
    expect(scoreDrop(null, { seo: 1, geo: 1 }).dropped).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Passage complet sur dépendances simulées
// ---------------------------------------------------------------------------

function fakeDeps(o: { ent?: Partial<Entitlements>; mandate?: Mandate | null; changeSets?: ChangeSet[]; drafts?: ContentDraft[]; applied?: number } = {}) {
  const ent = { ...getEntitlements({ id: 'b1', plan: 'essentiel', segment: 'local', planId: 'local_pilote_month', isActive: true }), ...(o.ent ?? {}) };
  let state: AutopilotState = { businessId: 'b1', series: [], contents: [], updatedAt: '' };
  let m = o.mandate === undefined ? mandate() : o.mandate;
  const sets = o.changeSets ?? [cs()];
  const drafts = o.drafts ?? [];
  const calls: string[] = [];
  const emails: { to: string; subject: string; items: string[] }[] = [];
  const deps: AutopilotDeps = {
    business: async () => ({ b: { id: 'b1', name: 'Plomberie Martin', website: 'exemple.fr', segment: 'local', trade: 'plombier', contactEmail: 'client@exemple.fr' }, ent }),
    getMandate: async () => m,
    pauseMandate: async (_b, _w, p) => (m = { ...m!, status: 'paused', pauseReason: p.reason }),
    getState: async () => state,
    saveState: async (s) => (state = s),
    journal: async (_b, _w, a, x) => calls.push(`journal:${a}:${x.ref ?? ''}`),
    fiche: async () => ({ view: { confirmedAt: '2026-11-10T00:00:00Z', verifiedKeys: ['zone', 'telephone'] }, values: ctx.ficheValues }),
    regulated: () => false,
    listChangeSets: async () => sets,
    createChangeSets: async () => void calls.push('create'),
    proposeChangeSet: async (_b, id) => sets.find((x) => x.id === id)!,
    validateUnderMandate: async (_b, id) => {
      calls.push(`validate:${id}`);
      return sets.find((x) => x.id === id)!;
    },
    applyChangeSet: async (_b, id) => {
      calls.push(`apply:${id}`);
      const s = sets.find((x) => x.id === id)!;
      s.status = 'verified';
      s.changes.forEach((c) => (c.status = 'verified'));
      return s;
    },
    countAppliedThisMonth: async () => o.applied ?? 0,
    listDrafts: async () => drafts,
    prepareDrafts: async () => 0,
    validateDraft: async (_b, id) => {
      calls.push(`validateDraft:${id}`);
      return drafts.find((x) => x.id === id)!;
    },
    pushDraft: async (_b, id) => {
      calls.push(`push:${id}`);
      const d = drafts.find((x) => x.id === id)!;
      d.status = 'remote_draft';
      return d;
    },
    publishDraft: async (_b, id) => {
      calls.push(`publish:${id}`);
      const d = drafts.find((x) => x.id === id)!;
      d.status = 'published';
      return d;
    },
    notify: async () => void calls.push('notify'),
    email: async (to, e) => void emails.push({ to, subject: e.subject, items: (e.items ?? []).map((i) => `${i.text} ${i.link?.url ?? ''}`) }),
    actionUrl: (b, k, r) => `https://repere.test/pilote/action?${k}=${r}`,
    appUrl: () => 'https://repere.test',
    listJournal: async () => [],
  };
  return { deps, calls, emails, get state() { return state; }, get mandate() { return m; } };
}

describe('passage du pilote', () => {
  it('applique une série couverte, journalise, prévient après coup avec le lien d’annulation', async () => {
    const f = fakeDeps();
    const r = await runAutopilot('b1', { trigger: 'analysis', now: NOW, analysis: { id: 'an1', createdAt: NOW.toISOString(), scores: { seo: 70, geo: 60 } }, deps: f.deps });
    expect(r).toMatchObject({ status: 'done', applied: ['cs_test_000001'] });
    expect(f.calls).toContain('validate:cs_test_000001');
    expect(f.calls).toContain('apply:cs_test_000001');
    expect(f.calls).toContain('journal:series.applied:cs_test_000001');
    expect(f.state.series[0].baseline).toMatchObject({ seo: 70, geo: 60 });
    expect(f.emails[0].items[0]).toContain('undo=cs_test_000001');
  });
  it('sans l’offre, sans mandat ou mandat en pause : rien', async () => {
    expect(await runAutopilot('b1', { trigger: 'manual', now: NOW, deps: fakeDeps({ ent: { autopilot: false } }).deps })).toEqual({ status: 'skipped', reason: 'offer' });
    expect(await runAutopilot('b1', { trigger: 'manual', now: NOW, deps: fakeDeps({ mandate: null }).deps })).toEqual({ status: 'skipped', reason: 'no_mandate' });
    expect(await runAutopilot('b1', { trigger: 'manual', now: NOW, deps: fakeDeps({ mandate: mandate({ status: 'paused' }) }).deps })).toEqual({ status: 'skipped', reason: 'paused' });
    expect(await runAutopilot('demo', { trigger: 'manual', now: NOW, deps: fakeDeps().deps })).toEqual({ status: 'skipped', reason: 'demo' });
  });
  it('plafond mensuel de l’offre atteint : rien d’appliqué', async () => {
    const f = fakeDeps({ applied: 20 });
    const r = await runAutopilot('b1', { trigger: 'manual', now: NOW, deps: f.deps });
    expect(r).toMatchObject({ status: 'done', applied: [] });
    expect(f.calls.some((c) => c.startsWith('apply'))).toBe(false);
  });
  it('hors mandat (page juridique) : laissé à la validation manuelle', async () => {
    const f = fakeDeps({ changeSets: [cs({}, { target: { url: 'https://exemple.fr/mentions-legales' } })] });
    const r = await runAutopilot('b1', { trigger: 'manual', now: NOW, deps: f.deps });
    expect(r).toMatchObject({ status: 'done', applied: [], skipped: 1 });
  });
  it('baisse de score après une série : arrêt automatique, alerte, retour arrière proposé', async () => {
    const f = fakeDeps();
    await runAutopilot('b1', { trigger: 'analysis', now: NOW, analysis: { id: 'an1', createdAt: NOW.toISOString(), scores: { seo: 80, geo: 60 } }, deps: f.deps });
    const later = new Date(NOW.getTime() + 7 * 86_400_000);
    const r = await runAutopilot('b1', { trigger: 'analysis', now: later, analysis: { id: 'an2', createdAt: later.toISOString(), scores: { seo: 70, geo: 60 } }, deps: f.deps });
    expect(r.status).toBe('stopped');
    expect(f.mandate?.status).toBe('paused');
    expect(f.mandate?.pauseReason).toBe('guard');
    expect(f.state.guard?.seriesIds).toEqual(['cs_test_000001']);
    expect(f.emails.at(-1)!.subject).toMatch(/arrêté/);
    expect(f.emails.at(-1)!.items[0]).toContain('undo=cs_test_000001');
  });
  it('contenu : validé sous mandat, brouillon chez le client, mis en ligne seulement après 72 h et sans blocage', async () => {
    const d = draft();
    const f = fakeDeps({ changeSets: [], drafts: [d] });
    const r = await runAutopilot('b1', { trigger: 'manual', now: NOW, deps: f.deps });
    expect(r).toMatchObject({ status: 'done', scheduled: ['ct_test_1'] });
    expect(f.calls).toEqual(expect.arrayContaining(['validateDraft:ct_test_1', 'push:ct_test_1']));
    expect(f.calls).not.toContain('publish:ct_test_1');
    expect(f.emails[0].items[0]).toContain('block=ct_test_1');
    // 71 h plus tard : rien ; 72 h : mise en ligne.
    await sweepBusiness('b1', new Date(NOW.getTime() + 71 * 3_600_000), f.deps);
    expect(f.calls).not.toContain('publish:ct_test_1');
    await sweepBusiness('b1', new Date(NOW.getTime() + 72 * 3_600_000), f.deps);
    expect(f.calls).toContain('publish:ct_test_1');
    expect(f.state.contents[0].status).toBe('published');
  });
  it('contenu bloqué ou mandat mis en pause pendant la relecture : jamais mis en ligne', async () => {
    const f = fakeDeps({ changeSets: [], drafts: [draft()] });
    await runAutopilot('b1', { trigger: 'manual', now: NOW, deps: f.deps });
    f.state.contents[0].status = 'blocked';
    await sweepBusiness('b1', new Date(NOW.getTime() + 80 * 3_600_000), f.deps);
    expect(f.calls).not.toContain('publish:ct_test_1');
    const g = fakeDeps({ changeSets: [], drafts: [draft({ id: 'ct_test_2' })] });
    await runAutopilot('b1', { trigger: 'manual', now: NOW, deps: g.deps });
    await g.deps.pauseMandate('b1', { id: 'u1' }, { reason: 'client' }, NOW);
    await sweepBusiness('b1', new Date(NOW.getTime() + 80 * 3_600_000), g.deps);
    expect(g.calls).not.toContain('publish:ct_test_2');
  });
});

describe('récapitulatif du lundi et rapport du mois', () => {
  it('dû le lundi, au plus une fois tous les 6 jours', () => {
    expect(isRecapDue(null, NOW)).toBe(true);
    expect(isRecapDue('2026-11-20T08:00:00Z', NOW)).toBe(false);
    expect(isRecapDue('2026-11-16T07:00:00Z', NOW)).toBe(true);
    expect(isRecapDue(null, new Date('2026-11-24T08:00:00Z'))).toBe(false);
  });
  it('effet présenté avec sa marge : jamais de conclusion dans la marge', () => {
    const state: AutopilotState = {
      businessId: 'b1',
      series: [{ csId: 'cs_a', title: 'Titres', kinds: ['meta.title'], pages: 2, appliedAt: '2026-11-18T07:00:00Z', status: 'verified', baseline: { seo: 70, geo: 60 }, checkedAt: '2026-11-22T07:00:00Z', after: { seo: 73, geo: 68 } }],
      contents: [{ draftId: 'ct_a', title: 'FAQ', scheduledAt: '2026-11-22T07:00:00Z', publishAt: '2026-11-25T07:00:00Z', status: 'scheduled' }],
      lastRecapAt: '2026-11-16T07:00:00Z',
      updatedAt: '',
    };
    const r = buildRecap({ state, journal: [], now: NOW, used: 1, limits: { series: 20, contents: 2 }, mandate: { status: 'active' }, waitingProposals: 2 });
    expect(r.monthly).toBe(false);
    expect(r.effects.find((e) => e.label.startsWith('Score SEO'))!.text).toMatch(/dans la marge/);
    expect(r.effects.find((e) => e.label.startsWith('Score GEO'))!.beyondMargin).toBe(true);
    const mail = recapEmail(r, { name: 'Plomberie Martin', businessId: 'b1', app: 'https://repere.test', actionUrl: (b, k, x) => `${k}:${x}` });
    expect(mail.items!.map((i) => i.link?.url)).toEqual(['undo:cs_a', 'block:ct_a']);
    expect(mail.paragraphs.join(' ')).toMatch(/2 propositions attendent votre validation/);
    expect(mail.paragraphs.join(' ')).not.toMatch(/garanti/i);
  });
});

describe('liens signés des e-mails', () => {
  it('vérifiés, falsification et expiration refusées', () => {
    const t = signActionToken('b1', 'undo', 'cs_a', 60, NOW.getTime());
    expect(verifyActionToken(t, NOW.getTime())).toMatchObject({ businessId: 'b1', kind: 'undo', ref: 'cs_a' });
    expect(verifyActionToken(t.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A')), NOW.getTime())).toBeNull();
    expect(verifyActionToken(t, NOW.getTime() + 61_000)).toBeNull();
  });
});

describe('offre Pilote automatique : droits et marge brute ≥ 70 %', () => {
  it('une offre par parcours, mensuelle, sans engagement, droits de l’Essentiel + pilote', () => {
    expect(PILOTE_PLAN_IDS).toHaveLength(3);
    for (const id of PILOTE_PLAN_IDS) {
      const p = getPlan(id);
      expect([p.interval, p.commitmentMonths ?? 0, p.available, planTier(id)]).toEqual(['month', 0, true, 'essentiel']);
      expect(p.features.join(' ')).toMatch(/Sans engagement/);
      expect(p.features.join(' ')).toMatch(/72 h/);
    }
    expect(pilotePlanFor('ecommerce')).toBe('ecom_pilote_month');
    expect(isPilotePlanId('local_essentiel_month')).toBe(false);
    expect(getEntitlements({ id: 'x', plan: 'essentiel', segment: 'local', planId: 'local_essentiel_month', isActive: true }).autopilot).toBe(false);
    expect(getEntitlements({ id: 'x', plan: 'essentiel', segment: 'pme', planId: 'pme_pilote_month', isActive: true }).autopilot).toBe(true);
    expect(getEntitlements({ id: 'x', plan: 'essentiel', segment: 'pme', planId: 'pme_pilote_month', isActive: false }).autopilot).toBe(false);
    expect(getEntitlements({ id: 'x', plan: 'accompagne', segment: 'pme', planId: 'pme_accompagne_month', isActive: true }).autopilot).toBe(false);
  });
  it('marge brute ≥ 70 % au plafond (mesure, données SEO, Stripe, rédaction, e-mails, support écrit compris)', () => {
    for (const seg of ['local', 'pme', 'ecommerce'] as const) {
      const id = pilotePlanFor(seg);
      const e = getEntitlements({ id: 'x', plan: 'essentiel', segment: seg, planId: id, isActive: true });
      const price = getPlan(id).priceCents / 100;
      const m = autopilotMargin(price, e, seg);
      expect(m.rate, seg).toBeGreaterThanOrEqual(0.7);
      expect(m.otherEur).toBeGreaterThan(grossMargin(price, e).otherEur);
    }
  });
  it('Stripe : les 3 prix mensuels sont décrits par stripe-setup (rien n’est créé sans lancer le script)', async () => {
    const { soldPlans } = await import('../../../../scripts/ops/lib/plans.mjs');
    const { priceSpec } = await import('../../../../scripts/ops/stripe-setup.mjs');
    const sold = (await soldPlans()) as { id: string; priceCents: number; interval: string }[];
    for (const id of PILOTE_PLAN_IDS) {
      const p = sold.find((x) => x.id === id);
      expect(p, id).toBeTruthy();
      expect(priceSpec(p, 'prod_x')).toMatchObject({ unit_amount: getPlan(id).priceCents, lookup_key: id, recurring: { interval: 'month' } });
    }
  });
});
