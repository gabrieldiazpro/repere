/**
 * FINITIONS V3 (qa/v3/a-corriger-QA-VISUEL-APP-2.md + reprises) : erreurs e-commerce dédoublonnées et cohérentes,
 * copilote « ma fiche Google », verbatims de prix regroupés, « C'est fait » daté en démo, profil modifiable et
 * régénération proposée, IA de l'offre, formats français, rythme du digest, écart entre mesures comparables,
 * comparatif pré-rempli, messages /contact dans l'administration.
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.setConfig({ testTimeout: 30_000 });
process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'repere-finitions-'));
for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY']) delete process.env[k];

const { priceReport, uniqueErrors, errorKey, buildPriceReport } = await import('@/lib/ecommerce');
const { getBusinessRecord } = await import('@/lib/db');
const { demoAudits } = await import('@/components/app/demo-data');
const { withCatalogErrors } = await import('@/components/app/workspace');
const { detectIntent, scriptedAnswer } = await import('@/lib/copilot/router');
const { loadCopilotContext } = await import('@/lib/copilot');
const { applyDemoTaskState, parseDemoTaskState, serializeDemoTaskState } = await import('@/components/app/demoTaskState');
const { planRegeneration } = await import('@/lib/auth/onboarding');
const { updateBusinessProfile } = await import('@/lib/auth/businesses');
const { engineAccess } = await import('@/components/app/shell/verrou');
const { getEntitlements, TIER_NAMES } = await import('@/lib/entitlements');
const { fmtMargin, fmtPts, frNum } = await import('@/lib/text');
const { impactOf } = await import('@/lib/measure');
const { frPrice } = await import('@/lib/siteaudit/product');
const { digestRhythm } = await import('@/lib/digest/stats');
const { buildComparisonPage, TO_FILL } = await import('@/lib/execution/content');
const { sortMessages, setAnswered, loadContactMessages, CONTACT_COLLECTION } = await import('@/app/admin/messages');
const { putDoc } = await import('@/lib/store');

describe('1a. Erreurs de prix e-commerce dédoublonnées et cohérentes', () => {
  it('une même erreur (IA × produit × valeur) répétée par passage ne compte qu’une fois', async () => {
    const b = (await getBusinessRecord('demo-ecom'))!;
    const r = await priceReport(b);
    const faux = r.checks.filter((c) => c.verdict === 'faux');
    expect(faux.length).toBeGreaterThanOrEqual(1);
    expect(r.errors).toBe(new Set(faux.map(errorKey)).size);
    expect(r.factItems.length).toBe(new Set(r.factItems.map((i) => `${i.provider}|${i.stated}`)).size);
    expect(r.factItems.every((i) => i.source === 'catalogue')).toBe(true);
  });

  it('uniqueErrors garde la première occurrence et ignore les verdicts justes', () => {
    const base = { productId: 'p', productName: 'P', provider: 'perplexity', queryId: 'q1', kind: 'prix' as const, stated: 14.9, expected: 12.9, delta: 0.155, quote: 'x' };
    const list = [
      { ...base, verdict: 'faux' as const },
      { ...base, queryId: 'q2', verdict: 'faux' as const },
      { ...base, stated: 12.9, verdict: 'correct' as const },
    ];
    expect(uniqueErrors(list)).toHaveLength(1);
  });

  it('Lundi et Vérité comptent les mêmes erreurs que Prix et avis (fusion dans le factCheck)', async () => {
    const latest = demoAudits('ecommerce').at(-1)!;
    const before = latest.factCheck!.errors;
    const merged = (await withCatalogErrors('demo-ecom', 'ecommerce', latest))!;
    const r = await priceReport((await getBusinessRecord('demo-ecom'))!);
    expect(merged.factCheck!.errors).toBe(before + r.factItems.length);
    // La cellule Perplexity × prix n'est plus « juste » alors qu'une erreur de prix existe.
    expect(merged.factCheck!.items.some((i) => i.field === 'prix' && i.provider === 'perplexity' && i.verdict === 'faux')).toBe(true);
    // Hors e-commerce : inchangé.
    const local = demoAudits('local').at(-1)!;
    expect(await withCatalogErrors('demo', 'local', local)).toBe(local);
  });

  it('buildPriceReport sans erreur : 0', async () => {
    const r = await buildPriceReport({ businessId: 'x', answers: [], products: [], demo: false } as never, { businessId: 'x', brand: 'X', products: [] } as never);
    expect(r.errors).toBe(0);
  });
});

describe('1b–1c. Copilote : fiche Google et prix', () => {
  it('« Ma fiche Google est-elle complète ? » → score et ce qui manque (plus de « pas de donnée »)', async () => {
    expect(detectIntent('Ma fiche Google est-elle complète ?')).toBe('gbp_audit');
    expect(detectIntent('Que manque-t-il à ma fiche Google ?')).toBe('gbp_audit');
    expect(detectIntent('Écris la description de ma fiche Google')).toBe('gbp_description');
    const ctx = (await loadCopilotContext('demo'))!;
    const a = scriptedAnswer(ctx, 'Ma fiche Google est-elle complète ?');
    expect(a.intent).toBe('gbp_audit');
    expect(a.content).toMatch(/\d+\/100/);
    expect(a.content).toContain('/app/local/fiche-google');
    expect(a.content).not.toMatch(/pas de donnée/);
  });

  it('sans audit de fiche : renvoi honnête vers la page', async () => {
    const ctx = { ...(await loadCopilotContext('demo'))!, gbp: null };
    const a = scriptedAnswer(ctx, 'Ma fiche Google est-elle complète ?');
    expect(a.content).toMatch(/pas encore été auditée/);
    expect(a.content).toContain('/app/local/fiche-google');
  });

  it('« Que disent les IA de mes prix ? » : chaque verbatim n’apparaît qu’une fois', async () => {
    for (const id of ['demo', 'demo-pme', 'demo-ecom']) {
      const ctx = (await loadCopilotContext(id))!;
      const a = scriptedAnswer(ctx, 'Que disent les IA de mes prix ?');
      const verbatims = a.content.split('\n').filter((l) => /Verbatim :/.test(l));
      expect(new Set(verbatims).size).toBe(verbatims.length);
    }
  });
});

describe('1d. Mode démo : « C’est fait » daté', () => {
  it('le cookie garde statut et date ; une valeur invalide est ignorée', () => {
    const raw = serializeDemoTaskState({ t1: { status: 'done', doneAt: '2026-11-09T10:00:00.000Z' }, t2: { status: 'todo' } });
    const s = parseDemoTaskState(raw);
    expect(s.t1).toEqual({ status: 'done', doneAt: '2026-11-09T10:00:00.000Z' });
    expect(s.t2).toEqual({ status: 'todo' });
    expect(parseDemoTaskState('{"x":["hacked"],"<b>":["done"],"y":["done","pas une date"]}')).toEqual({ y: { status: 'done' } });
    expect(parseDemoTaskState('%%%')).toEqual({});
  });

  it('les tâches cochées sur l’appareil remontent avec leur date', () => {
    const tasks = [
      { id: 't1', status: 'todo' as const, doneAt: undefined },
      { id: 't2', status: 'done' as const, doneAt: '2026-10-01T00:00:00.000Z' },
    ];
    const out = applyDemoTaskState(tasks, { t1: { status: 'done', doneAt: '2026-11-09T10:00:00.000Z' }, t2: { status: 'todo' } });
    expect(out[0]).toMatchObject({ status: 'done', doneAt: '2026-11-09T10:00:00.000Z' });
    expect(out[1]).toMatchObject({ status: 'todo', doneAt: undefined });
  });
});

describe('2. Réglages : profil et IA de l’offre', () => {
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  it('régénération : les questions automatiques de l’ancien profil passent en pause, celles du client restent', () => {
    const existing = [
      { id: 'a', text: 'Quel est le meilleur commerce à Paris ?', origin: 'gabarit', active: true },
      { id: 'b', text: 'Plombier pas cher à Paris 11 ?', origin: 'client', active: true },
    ];
    const generated = [
      { id: 'R1', text: 'Quel est le meilleur plombier à Paris 11e ?', kind: 'reco' as const },
      { id: 'R2', text: 'Plombier pas cher à Paris 11 ?', kind: 'reco' as const },
      { id: 'R3', text: 'Plombier urgence dimanche Paris 11e ?', kind: 'reco' as const },
      { id: 'B1', text: 'Que penses-tu de Plomberie Martin ?', kind: 'brand' as const },
    ];
    const plan = planRegeneration(existing, generated as never, 2, same);
    expect(plan.pause).toEqual(['a']);
    expect(plan.add.map((x) => x.query.id)).toEqual(['R1', 'R3', 'B1']);
    // limite 2 : la question du client + 1 nouvelle active
    expect(plan.add.filter((x) => x.active).map((x) => x.query.id)).toEqual(['R1']);
  });

  it('compte démo : le profil n’est jamais modifiable côté serveur', async () => {
    await expect(updateBusinessProfile({ userId: 'u', email: 'u@exemple.fr' }, { businessId: 'demo', trade: 'électricien', city: 'Lyon' })).rejects.toMatchObject({ status: 403 });
  });

  it('Découverte : seules ChatGPT, Perplexity et Gemini sont cochées ; les autres disent quelle offre les ouvre', () => {
    const names = { essentiel: TIER_NAMES.essentiel, accompagne: TIER_NAMES.accompagne };
    const local = engineAccess(getEntitlements({ id: 'x', plan: 'free', segment: 'local' }), 'local', (b) => getEntitlements(b), names);
    expect(local.filter((e) => e.included).map((e) => e.id)).toEqual(['chatgpt', 'perplexity', 'gemini']);
    expect(local.find((e) => e.id === 'claude')?.unlock).toBe(TIER_NAMES.accompagne);
    expect(local.find((e) => e.id === 'mistral')?.unlock).toBeNull();
    const pme = engineAccess(getEntitlements({ id: 'y', plan: 'free', segment: 'pme' }), 'pme', (b) => getEntitlements(b), names);
    expect(pme.find((e) => e.id === 'claude')?.unlock).toBe(TIER_NAMES.essentiel);
    expect(pme.find((e) => e.id === 'mistral')?.unlock).toBe(TIER_NAMES.accompagne);
  });
});

describe('3. Formats français', () => {
  it('marges arrondies, virgule décimale, euros', () => {
    expect(fmtMargin(13.7)).toBe('± 14 pts');
    expect(fmtMargin(0.6)).toBe('± 1 pt');
    expect(fmtMargin(6.2, '')).toBe('± 6');
    expect(fmtPts(-2.4)).toBe('−2 pts');
    expect(frNum(1234.5)).toBe('1 234,5');
    expect(frPrice('12.9', 'EUR')).toBe('12,90 €');
    expect(frPrice(19, 'USD')).toBe('19,00 USD');
  });

  it('mesure avant/après : jamais « 13.7 » dans le libellé', () => {
    const snap = (rate: number) => ({ at: '2026-10-01T00:00:00.000Z', answers: 30, mentioned: Math.round(rate * 30), rate });
    const m = {
      taskId: 't', taskTitle: 'T', businessId: 'b', doneAt: '2026-10-01T00:00:00.000Z', queries: [{ id: 'q', text: 'q' }], linkReason: 'absent',
      before: snap(0.3), checkpoints: [{ day: 14, dueAt: '2026-10-15T00:00:00.000Z', status: 'done', snapshot: snap(0.37) }],
    };
    const i = impactOf(m as never);
    expect(i.label).not.toMatch(/\d\.\d/);
    if (i.margin !== null) expect(i.label).toMatch(/± \d+ pts?/);
  });
});

describe('4. Digest du lundi : le vocabulaire suit le rythme de l’offre', () => {
  const now = new Date('2026-11-10T08:00:00Z');
  it('offre mensuelle sans nouvelle mesure : pas de « cette semaine » trompeur', () => {
    const r = digestRhythm({ frequency: 'monthly', measuredAt: '2026-11-03T07:30:00Z', now });
    expect(r.fresh).toBe(false);
    expect(r.lead).toBe('À la mesure du 3 novembre, ');
    expect(r.noNewMeasure).toMatch(/^Pas de nouvelle mesure cette semaine \(une mesure par mois\) : prochaine mesure le 1er décembre\. Voici vos actions de la semaine\.$/);
    expect(r.calm).toBe('Mois calme : votre position tient.');
  });
  it('offre mensuelle juste après la mesure : « Ce mois-ci »', () => {
    const r = digestRhythm({ frequency: 'monthly', measuredAt: '2026-11-08T07:30:00Z', now });
    expect(r.lead).toBe('Ce mois-ci, ');
    expect(r.noNewMeasure).toBeNull();
  });
  it('offre hebdomadaire : « Cette semaine »', () => {
    expect(digestRhythm({ frequency: 'weekly', measuredAt: '2026-11-09T07:30:00Z', now }).lead).toBe('Cette semaine, ');
  });
});

describe('5. Notification « Nouvelle mesure » : écart seulement entre mesures comparables', () => {
  it('audit d’un autre périmètre (autres questions) → aucune base, donc aucun écart annoncé', async () => {
    const audits = demoAudits('local');
    const last = audits.at(-1)!;
    const other = { ...last, id: 'autre', createdAt: '2020-01-01T00:00:00.000Z', measuredAt: '2020-01-01T00:00:00.000Z', queries: last.queries.map((q, i) => ({ ...q, text: `Autre question ${i} ?` })) };
    vi.resetModules();
    vi.doMock('@/lib/db', async (orig) => ({ ...(await orig<object>()), listAuditsForBusiness: async (id: string) => (id === 'mix' ? [other] : audits.slice(0, -1)) }));
    const { comparableBase } = await import('@/lib/jobs/handlers');
    expect(await comparableBase('mix', last as never)).toBeNull();
    const base = await comparableBase('suite', last as never);
    expect(base?.id).toBe(audits.at(-2)!.id);
    vi.doUnmock('@/lib/db');
  });
});

describe('6. Comparatif : cellules concurrent pré-remplies ou « à compléter »', () => {
  it('ce qui est relevé est daté et sourcé ; le reste est explicitement à compléter', () => {
    const p = buildComparisonPage({
      name: 'Paysia', segment: 'pme', activity: 'logiciel de paie', facts: { prix: '8 € HT par bulletin' }, competitor: 'Salaria', date: '2026-11-10T00:00:00Z',
      extraRows: [{ label: 'Présent sur les sources citées par les IA', mine: 'absent de ces sources', them: { value: 'capterra.fr, g2.com', source: 'sources citées par les IA' } }],
    });
    expect(p.markdown).toContain(`| Prix public | 8 € HT par bulletin | ${TO_FILL} |`);
    expect(p.markdown).toContain('capterra.fr, g2.com (sources citées par les IA, relevé le 10 novembre 2026)');
    expect(p.html).toContain('à compléter');
  });

  it('copilote démo PME : la ligne « sources » est pré-remplie', async () => {
    const ctx = (await loadCopilotContext('demo-pme'))!;
    const a = scriptedAnswer(ctx, 'Fais-moi une page comparatif face à Salaria');
    expect(a.content).toMatch(/à compléter/);
  });
});

describe('7. Messages /contact dans l’administration', () => {
  it('non répondus d’abord, puis marquer comme répondu et rouvrir', async () => {
    await putDoc(CONTACT_COLLECTION, 'm1', { email: 'a@exemple.fr', name: 'A', company: null, subject: 'Devis', message: 'Bonjour', receivedAt: '2026-11-01T10:00:00.000Z', answered: false });
    await putDoc(CONTACT_COLLECTION, 'm2', { email: 'b@exemple.fr', name: null, company: 'B', subject: null, message: 'Question', receivedAt: '2026-11-05T10:00:00.000Z', answered: false });
    expect((await loadContactMessages()).map((m) => m.id)).toEqual(['m2', 'm1']);
    expect(await setAnswered('m2', true, new Date('2026-11-06T09:00:00Z'))).toBe(true);
    const after = await loadContactMessages();
    expect(after.map((m) => m.id)).toEqual(['m1', 'm2']);
    expect(after[1]).toMatchObject({ answered: true, answeredAt: '2026-11-06T09:00:00.000Z' });
    expect(await setAnswered('m2', false)).toBe(true);
    expect(await setAnswered('inconnu', true)).toBe(false);
    expect(await setAnswered('../x', true)).toBe(false);
    expect(sortMessages([])).toEqual([]);
  });
});
