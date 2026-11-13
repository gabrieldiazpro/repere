/**
 * AMELIO-DONNEES (qa/v3/regard-client-v3.md, bugs B5–B8, B11–B18, B21 ; améliorations 4–6, 8–12).
 * Invariants croisés sur les 3 comptes démo : un même chiffre ne change pas d'un écran à l'autre
 * (rapport, accueil, Concurrents, grille thème × IA, Sources, Produits, carte, copilote).
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.setConfig({ testTimeout: 60_000 });
process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'repere-amelio-donnees-'));
for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY']) delete process.env[k];

const { buildDemoWorkspace } = await import('@/lib/demo-v2');
const { auditStats, mentionRateOf, shareOfVoiceOf, providerBreakdown, rowMentionRate, findRow } = await import('@/lib/digest/stats');
const { competitorRanking } = await import('@/components/report/derive');
const { buildLocalDemo, DEMO_MANUAL, DEMO_REVIEWS } = await import('@/lib/local');
const { askCopilot, detectIntent } = await import('@/lib/copilot');
const { fixFollowUp, nextMeasureAfter, frequencyOfAudits } = await import('@/lib/digest/fixes');
const { buildProductSheets, buildComparisonPage, audienceOf, realCity } = await import('@/lib/execution/content');
const { generateTasks } = await import('@/lib/execution/tasks');
const { withDemoV2 } = await import('@/lib/execution/demo');
const { DEMO_PRODUCTS, demoCatalog, withDemoProducts, buildProductTracking } = await import('@/lib/ecommerce');
const { createMockAudit, createMockFacts } = await import('@/lib/engine');
const { sellingChannel } = await import('@/lib/engine/sources');
const { checkClaims } = await import('@/lib/engine/factcheck');

const SEGMENTS = [
  ['local', 'demo'],
  ['pme', 'demo-pme'],
  ['ecommerce', 'demo-ecom'],
] as const;

const ask = async (id: string, q: string) => (await askCopilot(id, [{ role: 'user', content: q }])) as unknown as { content: string; intent: string; deliverables: { label: string; content: string }[] };

describe('une seule définition par pourcentage (amélioration 4)', () => {
  for (const [seg] of SEGMENTS) {
    const ws = buildDemoWorkspace(seg);
    const a = ws.audits.at(-1)!;
    const s = auditStats(a);

    it(`${seg} : taux de mention = citations / réponses, identique au moteur`, () => {
      expect(s.mentionRate).toBeCloseTo(s.citations / s.answers, 10);
      expect(mentionRateOf(s)).toBe(s.mentionRate);
      expect(a.mentionRate).toBeCloseTo(s.mentionRate, 3);
    });

    it(`${seg} : part de voix = citations / total des citations, identique au moteur`, () => {
      const total = s.rows.reduce((t, r) => t + r.mentions, 0);
      for (const r of s.rows) {
        expect(r.share).toBeCloseTo(r.mentions / total, 10);
        expect(shareOfVoiceOf(s, r.isMe ? undefined : r.name)).toBeCloseTo(r.share, 10);
        expect(rowMentionRate(s, r)).toBeCloseTo(r.mentions / s.answers, 10);
      }
      expect(s.rows.reduce((t, r) => t + r.share, 0)).toBeCloseTo(1, 6);
      expect(a.shareOfVoice).toBeCloseTo(s.shareOfVoice, 3);
    });

    it(`${seg} : la grille thème × IA totalise le KPI « réponses qui vous citent » (B6)`, () => {
      let cited = 0;
      let answers = 0;
      for (const row of a.voice?.cells ?? []) for (const c of row) if (c) ((cited += c.cited), (answers += c.answers));
      expect(cited).toBe(s.citations);
      expect(answers).toBe(s.answers);
    });

    it(`${seg} : « Les plus cités » (grille) et le classement donnent la même part de voix (B6)`, () => {
      for (const t of a.voice?.topCompetitors ?? []) {
        const row = findRow(s, t.name)!;
        expect(row, t.name).toBeTruthy();
        expect(t.mentions).toBe(row.mentions);
        expect(Math.round(t.share * 100)).toBe(Math.round(row.share * 100));
      }
    });

    it(`${seg} : le rapport public reprend les lignes de l'espace (B5)`, () => {
      const r = competitorRanking(a as never, 5);
      expect(r.answers).toBe(s.answers);
      for (const row of r.rows) {
        const ref = row.isYou ? s.rows.find((x) => x.isMe)! : findRow(s, row.name)!;
        expect(row.mentions).toBe(ref.mentions);
        expect(row.share).toBeCloseTo(ref.share, 10);
      }
      expect(r.leader!.mentions).toBe(s.rows.find((x) => !x.isMe)!.mentions);
    });

    it(`${seg} : la ventilation par IA redonne les totaux (copilote B6)`, () => {
      const top = s.rows.find((x) => !x.isMe)!;
      const b = providerBreakdown(a, top.name);
      expect(b.reduce((t, x) => t + x.me, 0)).toBe(s.citations);
      expect(b.reduce((t, x) => t + x.him, 0)).toBe(top.mentions);
      expect(b.reduce((t, x) => t + x.answers, 0)).toBe(s.answers);
    });

    it(`${seg} : Sources — citations du site ≤ citations du domaine du client (B18)`, () => {
      const src = a.sources!;
      const own = src.domains.filter((d) => d.category === 'client').reduce((t, d) => t + d.citations, 0);
      expect(src.clientCitedCount).toBe(own);
      expect(src.clientCitedCount).toBeLessThanOrEqual(src.totalCitations);
      const top = src.domains[0];
      if (top && top.category !== 'client') expect(src.clientCitedCount).toBeLessThanOrEqual(top.citations * 2);
    });

    it(`${seg} : Vérité — un « juste » par information et par IA (B17)`, () => {
      const items = a.factCheck?.items ?? [];
      const ok = items.filter((i) => i.verdict === 'correct');
      expect(new Set(ok.map((i) => `${i.field}|${i.provider}`)).size).toBe(ok.length);
    });
  }

  it('fiche démo : 2 formulations justes du même prix = 1 information juste', () => {
    const r = checkClaims(
      [
        { field: 'prix', value: '49 €', provider: 'chatgpt', quote: 'a' },
        { field: 'prix', value: 'déplacement 49 €', provider: 'chatgpt', quote: 'b' },
      ] as never,
      { prix: 'Déplacement 49 €' },
    );
    expect(r.items.filter((i) => i.verdict === 'correct')).toHaveLength(1);
  });
});

describe('un seul vivier de concurrents, carte comprise (B7, amélioration 12)', () => {
  it('la carte locale reprend le vivier de Concurrents et se centre sur le taux de mention global', async () => {
    const ws = buildDemoWorkspace('local');
    const s = auditStats(ws.audits.at(-1)!);
    const d = (await buildLocalDemo('demo'))!;
    const pool = new Set(s.rows.filter((r) => !r.isMe).map((r) => r.name));
    for (const z of d.map.zones) if (z.dominantCompetitor) expect(pool.has(z.dominantCompetitor.name), z.dominantCompetitor.name).toBe(true);
    // pas « (18) » partout : les compteurs dominants varient
    expect(new Set(d.map.zones.map((z) => z.dominantCompetitor?.mentions)).size).toBeGreaterThan(1);
    // pas « 12 zones sur 12 » à 94 % : la moyenne des zones reste proche du taux global (± 15 points)
    const rates = d.map.zones.map((z) => z.mentionRate ?? 0);
    const mean = rates.reduce((t, x) => t + x, 0) / rates.length;
    expect(Math.abs(mean - s.mentionRate)).toBeLessThan(0.15);
    expect(Math.max(...rates)).toBeLessThan(0.95);
    expect(d.map.zones.some((z) => z.band !== 'fort')).toBe(true);
  });

  it('Fiche Google et Avis : même nombre d’avis et même note (B17)', async () => {
    const d = (await buildLocalDemo('demo'))!;
    expect(DEMO_REVIEWS.length).toBe(DEMO_MANUAL.reviewCount);
    expect(d.themes.analyzed).toBe(DEMO_MANUAL.reviewCount);
    expect(d.themes.averageRating).toBe(DEMO_MANUAL.rating);
  });

  it('noms e-commerce distincts (pas « Savonnerie Alba » et « Maison Alba »)', () => {
    const s = auditStats(buildDemoWorkspace('ecommerce').audits.at(-1)!);
    const words = s.rows.map((r) => r.name.split(/\s+/).at(-1)!.toLowerCase());
    expect(new Set(words).size).toBe(words.length);
  });

  it('concurrents déclarés (vraies marques possibles) : aucune phrase prêtée par une IA (B21)', () => {
    const a = createMockAudit({ businessName: 'Paie Lumen', trade: 'logiciel de paie', city: 'Paris', segment: 'pme', category: 'logiciel de paie pour PME', knownCompetitors: ['PayFit', 'Silae', 'Lucca'] } as never, 'seed-b21');
    let seen = 0;
    for (const ans of a.answers) {
      for (const line of ans.text.split('\n')) {
        const m = /\*\*(PayFit|Silae|Lucca)\*\*(.*)$/.exec(line);
        if (!m) continue;
        seen++;
        expect(m[2].replace(/[.\s]/g, ''), line).toBe('');
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
});

describe('copilote : routage tolérant (B11, amélioration 5) et pas de donnée interne (B13)', () => {
  const ROUTES: [string, string][] = [
    ["Un client m'a laissé 3 étoiles en disant que la facture était plus chère que le devis. Écris-moi une réponse", 'review_reply'],
    ['Quelle est notre part de voix face à Paylo sur les 6 derniers mois ?', 'share_of_voice'],
    ["Qu'est-ce qui a changé depuis le mois dernier et pourquoi ?", 'period_compare'],
    ["Écris un e-mail à l'auteur d'un comparatif beauté", 'outreach_email'],
    ['Réécris la fiche de mon shampoing solide Onde', 'product_pages'],
    ['Écris-moi une page comparatif face à Paylo', 'comparison'],
    ["J'ai 20 minutes cette semaine, je fais quoi ?", 'weekly_plan'],
    ['Réponds à cet avis 3 étoiles : « Intervention correcte mais délai trop long. »', 'review_reply'],
    ['Écris la description de ma fiche Google', 'gbp_description'],
  ];
  for (const [q, intent] of ROUTES) it(`« ${q} » → ${intent}`, () => expect(detectIntent(q)).toBe(intent));

  it('avis rapporté sans guillemets : une réponse rédigée, pas « pas de donnée »', async () => {
    const r = await ask('demo', "Un client m'a laissé 3 étoiles en disant que la facture était plus chère que le devis. Écris-moi une réponse");
    expect(r.intent).toBe('review_reply');
    expect(r.content).not.toMatch(/pas de donnée/);
    expect(r.deliverables.length).toBeGreaterThan(0);
  });

  it('part de voix face à Paylo : série mesure par mesure, mêmes chiffres que Concurrents', async () => {
    const r = await ask('demo-pme', 'Quelle est notre part de voix face à Paylo sur les 6 derniers mois ?');
    expect(r.intent).toBe('share_of_voice');
    const s = auditStats(buildDemoWorkspace('pme').audits.at(-1)!);
    expect(r.content).toContain(`vous ${Math.round(s.shareOfVoice * 100)} %`);
    expect(r.content).toContain(`Paylo ${Math.round(findRow(s, 'Paylo')!.share * 100)} %`);
    expect(r.content).not.toMatch(/# Paysia ou Paylo/);
  });

  it('« pourquoi X passe devant » : la ventilation par IA somme au total (B6 copilote)', async () => {
    const r = await ask('demo', 'Pourquoi Fournier & Fils passe devant moi ?');
    const s = auditStats(buildDemoWorkspace('local').audits.at(-1)!);
    const line = r.content.split('\n').find((l) => l.startsWith('Par IA'))!;
    const pairs = [...line.matchAll(/(\d+) contre (\d+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
    expect(pairs.reduce((t, p) => t + p[1], 0)).toBe(s.citations);
    expect(pairs.reduce((t, p) => t + p[0], 0)).toBe(findRow(s, 'Fournier & Fils')!.mentions);
  });

  it('comparatif publiable : aucune donnée d’audit ni nombre de clients dans la page (B13, amélioration 11)', async () => {
    const r = await ask('demo-pme', 'Écris-moi une page comparatif face à Paylo');
    const page = r.deliverables.map((d) => d.content).join('\n');
    expect(page).not.toMatch(/cité \d+ fois|dans l’audit|dans l'audit/);
    expect(page).not.toMatch(/1 200 entreprises clientes/);
    expect(page).not.toMatch(/Les critères pour lesquels/);
    expect(page).toMatch(/Si vous avez plus de 250 salariés/);
    // la donnée interne reste dans la bulle, hors livrable
    expect(r.content).toMatch(/donnée interne/);
    expect(audienceOf('PME de 10 à 250 salariés ; 1 200 entreprises clientes')).toBe('PME de 10 à 250 salariés');
  });

  it('e-mail à l’auteur d’un comparatif : un e-mail, pas une page comparatif', async () => {
    const r = await ask('demo-ecom', "Écris un e-mail à l'auteur d'un comparatif beauté");
    expect(r.intent).toBe('outreach_email');
    expect(r.content).not.toMatch(/lequel choisir/);
  });

  it('fiche du produit nommé (« Onde »), au niveau du produit, sans « liste INCI sur chaque fiche » (B8, amélioration 10)', async () => {
    const r = await ask('demo-ecom', 'Réécris la fiche de mon shampoing solide Onde');
    expect(r.intent).toBe('product_pages');
    expect(r.content).toMatch(/Onde/);
    expect(r.content).not.toMatch(/sur chaque fiche produit/);
    expect(r.content).toMatch(/\[collez votre liste INCI\]/);
  });

  it('Produits et copilote : mêmes chiffres par produit (B8)', async () => {
    const ws = buildDemoWorkspace('ecommerce');
    const t = buildProductTracking(withDemoProducts(ws.audits.at(-1)!), demoCatalog(), { demo: true });
    const r = await ask('demo-ecom', 'Quelles fiches produits dois-je améliorer ?');
    for (const p of t.products) {
      if (!p.answers) continue;
      expect(r.content, p.name).toContain(`**${p.name}** — absent de ${p.answers - p.appearances} réponse`);
      expect(r.content).toContain(`présent dans ${p.appearances})`);
    }
    expect(r.content).not.toMatch(/sous un titre|cité dans 6 réponses sur 12/);
  });

  it('sources sans Markdown souligné visible (B12)', async () => {
    const r = await ask('demo', 'Quel est mon rang ?');
    expect(r.content).not.toMatch(/(^|\n)_Sources? :/);
    expect(r.content).not.toMatch(/\d{4}-\d\d-\d\dT\d\d:/);
  });
});

describe('e-commerce réaliste (B14, B15, améliorations 9 et 10)', () => {
  it('marketplace et revendeur : jamais « annuaire, 30 min »', () => {
    expect(sellingChannel('sephora.fr', 'Sephora')).toMatchObject({ kind: 'retailer', effort: 'L', action: 'Préparer un dossier acheteur pour Sephora' });
    expect(sellingChannel('amazon.fr', 'Amazon.fr')).toMatchObject({ kind: 'marketplace', effort: 'M' });
    const ws = buildDemoWorkspace('ecommerce');
    const tasks = generateTasks(withDemoV2(ws.audits.at(-1)! as never, 'ecommerce'), ws.facts, { segment: 'ecommerce', catalog: DEMO_PRODUCTS, max: 30 });
    for (const t of tasks.filter((x) => /sephora|amazon|nocibe|marionnaud/i.test(x.title + (x.sourceDomain ?? '')))) {
      expect(t.kind, t.title).not.toBe('directory');
      expect(t.minutes, t.title).toBeGreaterThanOrEqual(120);
      expect(t.title).not.toMatch(/^Vous référencer sur/);
    }
  });

  it('fiches produit au niveau du produit, « Il manque » au lieu de phrases vides, jamais « à France »', () => {
    const ws = buildDemoWorkspace('ecommerce');
    const tasks = generateTasks(withDemoV2(ws.audits.at(-1)! as never, 'ecommerce'), ws.facts, { segment: 'ecommerce', catalog: DEMO_PRODUCTS, max: 30 });
    const feeds = tasks.filter((t) => t.kind === 'product_feed' && /fiche produit/.test(t.title));
    expect(feeds.length).toBeGreaterThan(0);
    expect(feeds.some((t) => /Onde/.test(t.title))).toBe(true);
    for (const t of feeds) for (const d of t.deliverable ?? []) expect(d.content).not.toMatch(/sur chaque fiche produit|à France\b/);
    const [sheet] = buildProductSheets({ name: 'Bulle d’Argile', facts: {}, products: ['shampoing solide'], city: 'France' });
    expect(sheet.text).not.toMatch(/Fabriqué par .* à France/);
    expect(sheet.missing.join(' ')).toMatch(/bénéfice/);
    expect(realCity('France')).toBeUndefined();
    expect(realCity('Lyon')).toBe('Lyon');
  });

  it('marque en ligne sans ville : pas d’adresse inventée « …, 69001 France »', () => {
    const f = createMockFacts({ businessName: 'Bulle d’Argile', trade: 'cosmétiques solides', city: 'France', segment: 'ecommerce', productCategories: ['shampoing solide'] } as never);
    expect(f.facts.adresse ?? '').not.toMatch(/France$/);
  });

  it('comparatif : « Pour qui choisir l’autre » en cas explicites', () => {
    const p = buildComparisonPage({ name: 'A', segment: 'pme', activity: 'paie', facts: { clients: 'PME de 10 à 250 salariés ; 1 200 entreprises clientes' }, competitor: 'B', competitorNotes: ['cité 45 fois contre 18 dans l’audit', 'décrit comme « interface simple »'], date: '2026-11-05T08:00:00Z' });
    expect(p.markdown).not.toMatch(/cité 45 fois|1 200 entreprises/);
    expect(p.markdown).toMatch(/Si « interface simple » est votre premier critère/);
  });
});

describe('après « C’est fait » (B16, amélioration 8)', () => {
  const err = { field: 'horaires' as const, provider: 'gemini' as const };
  const base = { id: 't1', kind: 'fact_fix' as const, title: 'Corriger : Gemini donne une mauvaise information (horaires)', minutes: 15 };

  it('tâche ouverte : à corriger', () => {
    const f = fixFollowUp(err, [{ ...base, status: 'todo' }], { lastMeasure: '2026-11-05T08:00:00.000Z' });
    expect(f.state).toBe('to_fix');
    expect(f.task?.id).toBe('t1');
  });

  it('tâche faite : « correction faite le…, revérification à la prochaine mesure »', () => {
    const f = fixFollowUp(err, [{ ...base, status: 'done', doneAt: '2026-11-10T09:00:00.000Z' }], { lastMeasure: '2026-11-05T08:00:00.000Z', frequency: 'monthly' });
    expect(f.state).toBe('fixed');
    expect(f.recheckAt).toBe('2026-12-05T08:00:00.000Z');
    expect(f.headline).toBe('Correction faite le 10 nov. : nous revérifions Gemini à la prochaine mesure, le 5 déc.');
  });

  it('fréquence déduite des mesures', () => {
    expect(frequencyOfAudits(buildDemoWorkspace('local').audits)).toBe('monthly');
    expect(nextMeasureAfter('2026-11-03T08:00:00.000Z', '2026-11-04T00:00:00.000Z', 'weekly')).toBe('2026-11-10T08:00:00.000Z');
  });
});
