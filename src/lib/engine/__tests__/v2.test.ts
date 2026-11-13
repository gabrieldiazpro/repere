import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildAuditQueries,
  buildBrandQueries,
  buildEcomQueries,
  buildPmeQueries,
  buildSegmentQueries,
  buildSourcesReport,
  checkClaims,
  classifyDomain,
  compareFact,
  createMockAudit,
  createMockFacts,
  factCheck,
  isBrandQuery,
  normalizePhone,
  normalizeUrl,
  parsePerception,
  pickTop10,
  robotsAllows,
  runAudit,
  scoreOpportunity,
  verifyPresence,
  type AuditInput,
  type BrandClaim,
  type ProviderAnswer,
} from '../index';
import { buildVariants } from '../detect';
import { ACTIONS } from '../actions';
import { parseOutput } from '../providers/openai';
import { stripMarkers } from '../providers/perplexity';
import type { DomainAgg } from '../sources';

const KEYS = ['OPENAI_API_KEY', 'PERPLEXITY_API_KEY', 'GEMINI_API_KEY', 'ANTHROPIC_API_KEY', 'AUDIT_PROVIDERS', 'AUDIT_EXTRACTOR'];
const saved: Record<string, string | undefined> = {};
beforeEach(() => {
  for (const k of KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.unstubAllGlobals();
});

const LOCAL: AuditInput = { businessName: 'Plomberie Martin', trade: 'plombier', city: 'Paris', district: '11e', website: 'plomberie-martin.fr', segment: 'local' };
const PME: AuditInput = {
  businessName: 'Paysia',
  trade: 'logiciel de paie',
  city: 'Paris',
  website: 'paysia.fr',
  segment: 'pme',
  category: 'logiciel de paie pour PME',
  knownCompetitors: ['PayFit', 'Silae', 'Cegid', 'Lucca'],
  market: 'France',
};
const ECOM: AuditInput = {
  businessName: 'Maison Sora',
  trade: 'cosmétiques solides',
  city: 'Lyon',
  website: 'maison-sora.fr',
  segment: 'ecommerce',
  productCategories: ['shampoing solide', 'déodorant solide'],
  knownCompetitors: ['Lamazuna', 'Respire', 'Cut by Fred'],
};

/* ------------------------------------------------------------------ */
describe('classification des domaines', () => {
  it('table : catégories du contrat V2', () => {
    const cases: [string, string][] = [
      ['pagesjaunes.fr', 'annuaire'],
      ['https://fr.trustpilot.com/review/x.fr', 'avis'],
      ['www.g2.com', 'avis'],
      ['capterra.fr', 'comparatif'],
      ['appvizer.fr', 'comparatif'],
      ['https://www.reddit.com/r/paris/comments/abc', 'forum'],
      ['leparisien.fr', 'media_national'],
      ['actu.fr', 'media_local'],
      ['amazon.fr', 'marketplace'],
      ['linkedin.com', 'reseau_social'],
      ['fr.wikipedia.org', 'wikipedia'],
      ['service-public.fr', 'institutionnel'],
      ['marmiton.org', 'media_national'],
    ];
    for (const [d, cat] of cases) expect(classifyDomain(d).category, d).toBe(cat);
    expect(classifyDomain('pagesjaunes.fr').label).toBe('PagesJaunes');
    expect(classifyDomain('pagesjaunes.fr').howTo).toMatch(/Solocal/);
  });

  it("règles d'hôte prioritaires", () => {
    expect(classifyDomain('https://maps.google.com/?cid=1')).toMatchObject({ category: 'annuaire', label: 'Google Maps', source: 'rule' });
    expect(classifyDomain('https://www.google.com/maps/place/x')).toMatchObject({ category: 'annuaire', source: 'rule' });
    expect(classifyDomain('https://forum.doctissimo.fr/beaute/x')).toMatchObject({ category: 'forum', source: 'rule' });
    expect(classifyDomain('https://paris.actu.fr/x')).toMatchObject({ category: 'media_local' });
    expect(classifyDomain('https://apps.apple.com/fr/app/x')).toMatchObject({ category: 'marketplace' });
  });

  it('client et concurrents', () => {
    expect(classifyDomain('https://www.plomberie-martin.fr/contact', { clientDomain: 'plomberie-martin.fr' }).category).toBe('client');
    const c = classifyDomain('https://www.plomberie-laurent.fr/', { competitors: ['Plomberie Laurent', 'Ets Bonnet'] });
    expect(c).toMatchObject({ category: 'concurrent', competitor: 'Plomberie Laurent' });
    expect(classifyDomain('https://payfit.com/fr', { competitors: ['PayFit'] }).category).toBe('concurrent');
    // Une plateforme de la table n'est jamais prise pour un concurrent.
    expect(classifyDomain('https://www.g2.com/', { competitors: ['G2 Conseil'] }).category).toBe('avis');
  });

  it('heuristique de repli', () => {
    expect(classifyDomain('https://www.annuaire-plombiers-paris.com/fiche/1').category).toBe('annuaire');
    expect(classifyDomain('https://www.mairie-vincennes.fr/').category).toBe('institutionnel');
    expect(classifyDomain('https://www.meilleurs-logiciels-comparatif.com/paie').category).toBe('comparatif');
    expect(classifyDomain('https://forum-bricolage.net/topic/12').category).toBe('forum');
    expect(classifyDomain('https://www.lyon-hebdo-info.fr/2026/11/x').category).toBe('media_local');
    expect(classifyDomain('https://www.avis-plombiers.net/x').category).toBe('avis');
    expect(classifyDomain('https://xk-42.xyz/').category).toBe('autre');
  });

  it("normalisation d'URL", () => {
    expect(normalizeUrl('https://www.pagesjaunes.fr/annuaire/paris/?utm_source=openai&gclid=1&page=2#top')).toEqual({
      urlNorm: 'https://pagesjaunes.fr/annuaire/paris?page=2',
      host: 'pagesjaunes.fr',
      domain: 'pagesjaunes.fr',
      path: '/annuaire/paris',
    });
    expect(normalizeUrl('https://m.leparisien.fr/article/amp')?.urlNorm).toBe('https://leparisien.fr/article');
    expect(normalizeUrl('ftp://x.fr')).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
describe('opportunités', () => {
  const agg = (over: Partial<DomainAgg['stat']> = {}, a: Partial<DomainAgg> = {}): DomainAgg => ({
    stat: {
      domain: 'pagesjaunes.fr',
      label: 'PagesJaunes',
      category: 'annuaire',
      citations: 10,
      citationShare: 0.2,
      providers: ['chatgpt', 'perplexity'],
      queries: ['T1-aaaa'],
      clientPresence: 'absent',
      competitorsPresent: ['Ets Bonnet'],
      sampleUrls: ['https://pagesjaunes.fr/x'],
      ...over,
    },
    citedAnswers: 10,
    citedRate: 0.3,
    providerCoverage: 1,
    topPositions: 3,
    avgPosition: 1.5,
    intents: ['best'],
    angles: [],
    sampleQueries: ['T1-aaaa'],
    ...a,
  });
  const q = () => 'Quel est le meilleur plombier à Paris 11e ?';

  it('gap > absent > inconnu ; présent et client/concurrent exclus', () => {
    const gap = scoreOpportunity(agg(), 'local', 30, q)!;
    const absent = scoreOpportunity(agg({ competitorsPresent: [] }), 'local', 30, q)!;
    const unknown = scoreOpportunity(agg({ competitorsPresent: [], clientPresence: 'unknown' }), 'local', 30, q)!;
    expect(gap.score).toBe(100);
    expect(gap.score).toBeGreaterThan(absent.score);
    expect(absent.score).toBeGreaterThan(unknown.score);
    expect(gap.effort).toBe('S');
    expect(gap.action).toBe("S'inscrire sur PagesJaunes");
    expect(gap.why).toMatch(/10 réponses sur 30 \(30 %\).*Ets Bonnet y apparaît ; pas vous\./);
    expect(gap.howTo[0]).toMatch(/Solocal/);
    expect(scoreOpportunity(agg({ clientPresence: 'present' }), 'local', 30, q)).toBeNull();
    expect(scoreOpportunity(agg({ category: 'client' }), 'local', 30, q)).toBeNull();
    expect(scoreOpportunity(agg({ category: 'concurrent' }), 'local', 30, q)).toBeNull();
  });

  it('poids par segment et faisabilité (média national = effort L)', () => {
    const comp = agg({ domain: 'capterra.fr', label: 'Capterra France', category: 'comparatif' }, { angles: ['comparison'] });
    expect(scoreOpportunity(comp, 'pme', 30, q)!.score).toBeGreaterThan(scoreOpportunity(comp, 'local', 30, q)!.score);
    const media = scoreOpportunity(agg({ domain: 'lemonde.fr', label: 'Le Monde', category: 'media_national' }), 'pme', 30, q)!;
    expect(media.effort).toBe('L');
    // Fréquence divisée par 2 si cité dans une seule réponse
    const once = scoreOpportunity(agg({}, { citedAnswers: 1, citedRate: 1 / 30, topPositions: 0 }), 'local', 30, q)!;
    expect(once.score).toBeLessThan(50);
  });

  it('top 10 : 3 par catégorie au plus, compléments sectoriels hors domaines cités', () => {
    const mk = (d: string, score: number, category: 'annuaire' | 'forum') => ({
      ...scoreOpportunity(agg({ domain: d, label: d, category }), 'local', 30, q)!,
      score,
    });
    const opps = [mk('a.fr', 90, 'annuaire'), mk('b.fr', 80, 'annuaire'), mk('c.fr', 70, 'annuaire'), mk('d.fr', 60, 'annuaire'), mk('e.fr', 50, 'forum')];
    const top = pickTop10(opps, 'local', 10, new Set(['pagesjaunes.fr']));
    expect(top.filter((o) => o.category === 'annuaire' && !o.fallback).length).toBe(3);
    expect(top.map((o) => o.domain)).not.toContain('d.fr');
    expect(top.map((o) => o.domain)).not.toContain('pagesjaunes.fr');
    expect(top.some((o) => o.fallback && o.domain === 'google.com')).toBe(true);
    expect(top.length).toBe(10);
    expect(top.every((o) => o.impact >= 1 && o.impact <= 3)).toBe(true);
  });

  it('buildSourcesReport : citations OpenAI/Perplexity, Gemini exclu, présence du client', () => {
    const text = '1. **Ets Bonnet** – rapide.\n2. **Plomberie Martin** – sérieux.\n3. **Atelier Roux** – correct.';
    const ans = (provider: ProviderAnswer['provider'], run: number, sources: ProviderAnswer['sources']): ProviderAnswer => ({
      provider,
      queryId: 'T1-aaaa',
      run,
      text,
      citations: (sources ?? []).map((s) => s.url),
      sources,
      demo: false,
    });
    const answers = [
      ans('chatgpt', 1, [
        { url: 'https://www.pagesjaunes.fr/annuaire/paris?utm_source=openai', title: 'Plombiers Paris 11e – PagesJaunes', snippet: 'Ets Bonnet, Atelier Roux', kind: 'cited', startIndex: 0 },
        { url: 'https://www.plomberie-martin.fr/', kind: 'cited', startIndex: text.indexOf('Plomberie Martin') },
      ]),
      ans('perplexity', 1, [{ url: 'https://www.reddit.com/r/paris/comments/1', title: 'Plombier ? : r/paris', kind: 'cited', startIndex: text.indexOf('Plomberie Martin') }]),
      ans('perplexity', 2, [{ url: 'https://www.pagesjaunes.fr/annuaire/paris', title: 'PagesJaunes', snippet: 'Ets Bonnet', kind: 'cited' }]),
      ans('gemini', 1, [{ url: 'https://www.leparisien.fr/x', kind: 'cited' }]),
    ];
    const r = buildSourcesReport(answers, LOCAL, { segment: 'local', competitors: ['Ets Bonnet', 'Atelier Roux'], queries: [{ id: 'T1-aaaa', text: 'Quel est le meilleur plombier à Paris 11e ?', intent: 'best' }] });
    expect(r.totalCitations).toBe(4);
    expect(r.domains.map((d) => d.domain)).not.toContain('leparisien.fr');
    const pj = r.domains.find((d) => d.domain === 'pagesjaunes.fr')!;
    expect(pj).toMatchObject({ category: 'annuaire', citations: 2, clientPresence: 'absent', providers: ['chatgpt', 'perplexity'] });
    expect(pj.competitorsPresent).toEqual(expect.arrayContaining(['Ets Bonnet', 'Atelier Roux']));
    expect(r.domains.find((d) => d.domain === 'reddit.com')?.clientPresence).toBe('present'); // passage qui cite le client
    expect(r.clientCitedCount).toBe(1);
    expect(r.byCategory.annuaire).toBe(2);
    expect(r.opportunities[0].domain).toBe('pagesjaunes.fr');
    expect(r.note).toMatch(/Gemini/);
  });
});

/* ------------------------------------------------------------------ */
describe('factCheck', () => {
  it('normalisations : téléphone, horaires, adresse, prix', () => {
    expect(normalizePhone('+33 (0)1 43 55 12 34')).toBe('0143551234');
    expect(normalizePhone('01.43.55.12.34')).toBe('0143551234');
    expect(compareFact('telephone', '01 43 55 12 34', '+33 1 43 55 12 34')).toBe('correct');
    expect(compareFact('telephone', '01 43 55 12 34', '01 43 55 12 35')).toBe('faux');
    expect(compareFact('horaires', 'Du lundi au vendredi, 8h-19h', 'du lundi au vendredi de 08:00 à 19:00')).toBe('correct');
    expect(compareFact('horaires', 'Du lundi au vendredi, 8h-19h', 'du lundi au samedi de 8h à 20h')).toBe('faux');
    expect(compareFact('horaires', 'Du lundi au vendredi 8 h – 12 h et 14 h – 19 h', 'de 8h à 12h')).toBe('incomplet');
    expect(compareFact('adresse', '12 rue Oberkampf, 75011 Paris', '12, rue Oberkampf 75011 PARIS')).toBe('correct');
    expect(compareFact('adresse', '3 av. Parmentier, 75011 Paris', '3 avenue Parmentier, Paris')).toBe('correct');
    expect(compareFact('adresse', '12 rue Oberkampf, 75011 Paris', '21 rue Oberkampf, 75011 Paris')).toBe('faux');
    expect(compareFact('prix', 'À partir de 8 € HT par mois', 'environ 9 € par mois')).toBe('correct');
    expect(compareFact('prix', 'À partir de 8 € HT par mois', 'environ 15 € par mois')).toBe('faux');
    expect(compareFact('site', 'paysia.fr', 'https://www.paysia.fr/tarifs')).toBe('correct');
    expect(compareFact('statut', 'ouvert', 'fermé définitivement')).toBe('faux');
  });

  it('cas vrai / faux, sévérité et compteur', () => {
    const claims: BrandClaim[] = [
      { field: 'telephone', value: '01 43 55 12 34', provider: 'chatgpt', quote: 'Tél. 01 43 55 12 34.' },
      { field: 'horaires', value: 'du lundi au samedi de 8h à 20h', provider: 'gemini', quote: 'Ouvert du lundi au samedi de 8h à 20h.' },
      { field: 'creation', value: '2009', provider: 'claude', quote: 'Créée en 2009.' },
      { field: 'dirigeant', value: 'Paul Durand', provider: 'perplexity', quote: 'Dirigée par Paul Durand.' },
    ];
    const rep = checkClaims(claims, { businessId: 'b', updatedAt: '', facts: { telephone: '01 43 55 12 34', horaires: 'Du lundi au vendredi 8 h – 19 h', creation: '2009' } });
    expect(rep.errors).toBe(1);
    expect(rep.items[0]).toMatchObject({ field: 'horaires', verdict: 'faux', severity: 'haute', provider: 'gemini' });
    expect(rep.items.find((i) => i.field === 'telephone')?.verdict).toBe('correct');
    expect(rep.items.find((i) => i.field === 'dirigeant')?.verdict).toBe('non_verifiable');
  });

  it('factCheck(result, facts) sur un audit démo : 1 erreur', () => {
    const r = createMockAudit(LOCAL, 's1');
    const rep = factCheck(r, createMockFacts(LOCAL));
    expect(rep.errors).toBe(1);
    expect(rep.items.filter((i) => i.verdict === 'correct').length).toBeGreaterThan(2);
  });
});

/* ------------------------------------------------------------------ */
describe('requêtes par segment', () => {
  it('local : gabarits V1 inchangés, pas de requête de marque en gratuit', () => {
    const qs = buildSegmentQueries(LOCAL);
    expect(qs).toHaveLength(8);
    expect(qs[0].id).toMatch(/^T1-/);
    expect(buildBrandQueries(LOCAL)).toHaveLength(0);
    expect(buildBrandQueries(LOCAL, 'paid')).toHaveLength(1);
  });

  it('PME : meilleur X pour Y, alternative, comparatif, prix, avis, quelle entreprise', () => {
    const qs = buildPmeQueries(PME);
    expect(qs).toHaveLength(8);
    expect(qs[0].text).toBe('Quel est le meilleur logiciel de paie pour une PME en France ?');
    const angles = new Set(qs.map((q) => q.angle));
    for (const a of ['best', 'alternative', 'comparison', 'price', 'review', 'which_company']) expect(angles.has(a as never), a).toBe(true);
    expect(qs.find((q) => q.angle === 'alternative')?.text).toContain('PayFit');
    expect(qs.find((q) => q.angle === 'price')?.text).toMatch(/^Combien coûte un logiciel de paie/);
    for (const q of qs) {
      expect(q.text).not.toMatch(/paysia/i);
      expect(q.kind).toBe('reco');
    }
    expect(buildPmeQueries(PME, 12)).toHaveLength(12);
  });

  it('e-commerce : meilleur produit, alternative, où acheter, marque française, avis', () => {
    const qs = buildEcomQueries(ECOM);
    const angles = new Set(qs.map((q) => q.angle));
    for (const a of ['best', 'alternative', 'where_to_buy', 'french_brand', 'review']) expect(angles.has(a as never), a).toBe(true);
    expect(qs[0].text).toBe('Quelles sont les meilleures marques de shampoing solide ?');
    expect(qs.find((q) => q.angle === 'french_brand')?.text).toBe('Quelle marque française de shampoing solide recommandes-tu ?');
    for (const q of qs) expect(q.text).not.toMatch(/sora/i);
  });

  it('requêtes de marque PME / e-commerce (perception et vérité, hors score)', () => {
    const b = buildBrandQueries(PME);
    expect(b.map((q) => q.text)).toEqual(['Que penses-tu de Paysia (logiciel de paie pour PME) ?', 'Paysia est-il fiable ? Que disent les avis des entreprises clientes ?']);
    expect(b.every((q) => q.kind === 'brand' && isBrandQuery(q))).toBe(true);
    expect(buildBrandQueries(ECOM)[1].text).toMatch(/^Maison Sora est-il fiable \?/);
    expect(buildAuditQueries(PME)).toHaveLength(10);
    expect(buildAuditQueries(PME, 'paid')).toHaveLength(15);
  });

  it('runAudit PME (démo) : requêtes de marque 1 exécution, exclues du score, aucun réseau', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const r = await runAudit(PME, { seed: 'x' });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(r.segment).toBe('pme');
    expect(r.answers).toHaveLength(8 * 2 * 3 + 2 * 3);
    expect(r.mentions).toHaveLength(8 * 2 * 3);
    const brandIds = new Set(r.queries.filter((q) => q.kind === 'brand').map((q) => q.id));
    expect(r.mentions.some((m) => brandIds.has(m.queryId))).toBe(false);
    expect(r.perception?.quotes.length).toBeGreaterThan(0);
    expect(r.sources?.domains.length).toBeGreaterThan(3);
    expect(r.factCheck).toBeUndefined(); // pas de fiche de vérité fournie
  });
});

/* ------------------------------------------------------------------ */
describe('mock des 3 segments', () => {
  for (const [name, input, errField] of [
    ['local', LOCAL, 'horaires'],
    ['pme', PME, 'prix'],
    ['ecommerce', ECOM, 'livraison'],
  ] as const) {
    it(`${name} : sources, perception, vérité (1 erreur), pourquoi, benchmark`, () => {
      const r = createMockAudit(input, 'demo-1');
      expect(r.demo).toBe(true);
      expect(r.segment).toBe(name);
      // Sources
      expect(r.sources!.totalCitations).toBeGreaterThan(30);
      expect(r.sources!.domains.length).toBeGreaterThan(5);
      expect(r.sources!.domains.some((d) => d.category === 'client')).toBe(true);
      expect(r.sources!.domains.some((d) => d.clientPresence === 'absent' && d.competitorsPresent.length > 0)).toBe(true);
      expect(r.sources!.opportunities.length).toBeGreaterThanOrEqual(5);
      expect(r.sources!.opportunities.length).toBeLessThanOrEqual(10);
      expect(r.sources!.opportunities.every((o) => o.howTo.length > 0 && o.action && o.why)).toBe(true);
      expect(r.sources!.opportunities.some((o) => o.competitorsPresent.length > 0)).toBe(true);
      expect(r.sources!.domains.every((d) => d.providers.every((p) => p !== 'gemini'))).toBe(true);
      // Perception
      expect(r.perception!.quotes.length).toBeGreaterThanOrEqual(3);
      expect(r.perception!.quotes.length).toBeLessThanOrEqual(8);
      expect(r.perception!.quotes.every((q) => q.text.length <= 400)).toBe(true);
      const s = r.perception!.sentiment;
      expect(s.positif + s.neutre + s.negatif).toBeCloseTo(1, 5);
      expect(r.perception!.themes.length).toBeGreaterThan(0);
      expect(r.perception!.claims.length).toBeGreaterThan(3);
      // Vérité : exactement une affirmation fausse de démonstration
      expect(r.factCheck!.errors).toBe(1);
      expect(r.factCheck!.items[0]).toMatchObject({ field: errField, verdict: 'faux', provider: 'gemini', severity: 'haute' });
      // Pourquoi / benchmark
      expect(r.gaps!.length).toBeGreaterThan(0);
      expect(r.gaps![0].presentOn.length).toBeGreaterThan(0);
      expect(r.gaps![0].reasons.length).toBeGreaterThanOrEqual(2);
      expect(r.benchmark!.label).toMatch(/^\d+(ᵉʳ|ᵉ) sur \d+ /);
      expect(r.benchmark!.rank).toBeLessThanOrEqual(r.benchmark!.of);
      // Déterminisme
      expect(createMockAudit(input, 'demo-1').sources).toEqual(r.sources);
    });
  }

  it('fiches démo cohérentes avec src/lib/demo-v2.ts', () => {
    expect(createMockFacts(PME).facts.prix).toMatch(/8 € HT/);
    expect(createMockFacts({ ...LOCAL, businessName: 'Plomberie Inconnue' }).facts.horaires).toBeTruthy();
  });
});

/* ------------------------------------------------------------------ */
describe('providers : extraction des URL citées', () => {
  it('OpenAI : url_citation avec titre et position', () => {
    const out = parseOutput({
      output: [
        { type: 'web_search_call', action: { sources: [{ url: 'https://a.fr/x' }, { url: 'https://b.fr/y' }] } },
        {
          type: 'message',
          content: [
            {
              type: 'output_text',
              text: 'Voici B. Puis A.',
              annotations: [
                { type: 'url_citation', url: 'https://b.fr/y?utm_source=openai', title: 'B', start_index: 10, end_index: 15 },
                { type: 'url_citation', url: 'https://a.fr/x', title: 'A', start_index: 0, end_index: 7 },
              ],
            },
          ],
        },
      ],
    });
    expect(out.citations).toEqual(['https://a.fr/x', 'https://b.fr/y']); // ordre des start_index
    expect(out.sources?.map((s) => [s.url, s.kind, s.order])).toEqual([
      ['https://a.fr/x', 'cited', 1],
      ['https://b.fr/y', 'cited', 2],
    ]);
    expect(out.sources?.[1].title).toBe('B');
  });

  it('Perplexity : marqueurs [n] relevés avant nettoyage, search_results titrés', async () => {
    const m = stripMarkers('Ets Bonnet[2] est rapide. Martin[1][web:2].');
    expect(m.text).toBe('Ets Bonnet est rapide. Martin.');
    expect(m.order).toEqual([2, 1]);
    expect(m.firstPos.get(1)).toBe(m.text.lastIndexOf('.'));
    process.env.PERPLEXITY_API_KEY = 'k';
    process.env.AUDIT_PROVIDERS = 'perplexity';
    process.env.AUDIT_EXTRACTOR = 'heuristic';
    const body = {
      output: [
        { type: 'search_results', results: [{ id: 1, url: 'https://www.pagesjaunes.fr/a', title: 'PJ', snippet: 'Ets Bonnet' }, { id: 2, url: 'https://reddit.com/r/x', title: 'R' }] },
        { type: 'message', content: [{ type: 'output_text', text: '1. **Ets Bonnet**[2] – ok.\n2. **Plomberie Martin**[1] – ok.' }] },
      ],
    };
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })));
    const r = await runAudit(LOCAL, { queries: [{ id: 'T1-aaaa', text: 'q', intent: 'best' }] });
    const a = r.answers[0];
    expect(a.text).not.toMatch(/\[\d\]/);
    expect(a.sources?.map((s) => [s.url, s.title, s.order])).toEqual([
      ['https://reddit.com/r/x', 'R', 1],
      ['https://www.pagesjaunes.fr/a', 'PJ', 2],
    ]);
    expect(r.sources?.domains.find((d) => d.domain === 'pagesjaunes.fr')?.clientPresence).toBe('present');
  });

  it('Claude : citations web_search_result_location', async () => {
    process.env.ANTHROPIC_API_KEY = 'k';
    process.env.AUDIT_PROVIDERS = 'claude';
    process.env.AUDIT_EXTRACTOR = 'heuristic';
    const body = {
      stop_reason: 'end_turn',
      content: [
        { type: 'web_search_tool_result', content: [{ type: 'web_search_result', url: 'https://g2.com/p', title: 'G2' }] },
        { type: 'text', text: 'Voici : ' },
        { type: 'text', text: 'PayFit est bien noté.', citations: [{ type: 'web_search_result_location', url: 'https://g2.com/p', title: 'G2', cited_text: 'PayFit 4,5/5' }] },
      ],
    };
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })));
    const r = await runAudit(PME, { queries: [{ id: 'P1-aaaa', text: 'q', intent: 'best', kind: 'reco' }] });
    expect(r.answers[0].sources?.[0]).toMatchObject({ url: 'https://g2.com/p', title: 'G2', snippet: 'PayFit 4,5/5', kind: 'cited', startIndex: 8 });
  });
});

/* ------------------------------------------------------------------ */
describe('perception et présence', () => {
  it('parsePerception rejette les verbatims inventés', () => {
    const passages = [{ provider: 'chatgpt' as const, query: 'q', text: 'Paysia est apprécié pour son support. Tarif : 8 € par mois.', at: '', whole: true }];
    const raw = JSON.stringify({
      passages: [
        {
          id: 1,
          quotes: [{ text: 'Paysia est apprécié pour son support.', sentiment: 'positif' }, { text: 'Paysia est le leader mondial.', sentiment: 'positif' }],
          themes: ['Service client'],
          claims: [{ field: 'prix', value: '8 € par mois', quote: 'Tarif : 8 € par mois.' }, { field: 'telephone', value: '01 00 00 00 00', quote: 'Appelez le 01 00 00 00 00.' }],
        },
      ],
    });
    const [res] = parsePerception(raw, passages);
    expect(res?.quotes).toHaveLength(1);
    expect(res?.claims.map((c) => c.field)).toEqual(['prix']);
    expect(res?.themes).toEqual(['service client']);
  });

  it('vérification HTTP : désactivée par défaut, plateformes interdites, robots.txt', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const v = await verifyPresence('https://www.reddit.com/r/paris', buildVariants(LOCAL), ['Ets Bonnet']);
    expect(v.client).toBe('unknown');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(robotsAllows('User-agent: *\nDisallow: /private\n', '/private/x')).toBe(false);
    expect(robotsAllows('User-agent: RepereBot\nAllow: /private\nUser-agent: *\nDisallow: /', '/private/x')).toBe(true);
    await createMockAudit(LOCAL);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('plan d’action : conformité des avis', () => {
  it('A03/A04 : aucune sollicitation réservée aux clients satisfaits ni contenu imposé', () => {
    const txt = ACTIONS.filter((a) => a.id === 'A03' || a.id === 'A04').map((a) => [a.title, a.why, ...a.how].join(' ')).join(' ');
    expect(txt).not.toMatch(/chaque client satisfait/i);
    expect(txt).not.toMatch(/Quel service \? Dans quel quartier/);
    expect(txt).toMatch(/pas seulement aux satisfaits|satisfaits ou non/);
  });
});
