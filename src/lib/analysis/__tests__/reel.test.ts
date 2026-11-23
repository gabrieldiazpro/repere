/**
 * TESTS-REELS (23 nov. 2026) : cas relevés sur de vrais sites français (fixtures-reel.ts), corrigés dans le code.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { detectSite, cityFromText } from '../detect';
import { cleanActivity, nounPhrase, productFocus, tradeFromBrand } from '../activity';
import { buildQuickQuestions, runQuickAiCheck } from '../aicheck';
import { anonymizeDemoNames } from '../brandtest';
import { getProDeclaration, recordProDeclaration } from '../store';
import { consumeProIntent, rememberProIntent, intentKey } from '@/components/analysis/proIntent';
import { resolveAnalysisPrefill } from '@/components/analysis/prefill';
import { firewallOf } from '@/lib/crawl/diagnose';
import { crawlSite } from '@/lib/crawl/crawl';
import { SafeFetchError, isTlsError, safeFetch, setFetchDeps } from '@/lib/siteaudit/fetch';
import { parseHtml } from '@/lib/siteaudit/html';
import * as FX from './fixtures-reel';

let restore: () => void = () => {};
afterEach(() => restore());

describe('détection sur de vrais sites', () => {
  it('lepetitballon.com : marque, e-commerce, activité « box de vins », questions en bon français', () => {
    const d = detectSite({ url: 'https://www.lepetitballon.com/' }, FX.LE_PETIT_BALLON);
    expect(d.brand).toBe('Le Petit Ballon');
    expect(d.siteType).toBe('ecommerce');
    expect(d.activity).toBe('box de vins');
    const q = buildQuickQuestions(d.siteType, d.activity, d.city, 5).map((x) => x.text);
    expect(q[0]).toBe('Où acheter des box de vins en ligne en France ?');
    for (const t of q) {
      expect(t).not.toMatch(/Quel les|les les|du petit|Petit Ballon/i);
    }
  });

  it('logiciel ou banque « Product + SoftwareApplication » : pas une boutique ; relative coupée', () => {
    const d = detectSite({ url: 'https://www.qonto.com/fr' }, FX.NEOBANQUE);
    expect(d.siteType).toBe('pme');
    expect(d.activity).toBe('banque pro');
    expect(buildQuickQuestions(d.siteType, d.activity, undefined, 3)[0].text).toBe('Quelle banque pro me recommandez-vous en France ?');
  });

  it('praticienne Wix : nom sans forme juridique ni capitales, H1 en <span> lu d’un seul mot, pas une boutique', () => {
    const d = detectSite({ url: 'https://fleursdevies.fr/' }, FX.PRATICIENNE_WIX);
    expect(d.brand).toBe('Fleurs de Vies');
    expect(d.siteType).toBe('local');
    expect(d.activity).toBe('biorésonance');
    expect(parseHtml(FX.PRATICIENNE_WIX).headings[0].text).toBe('FLEURS DE VIES NUTRITION');
    expect(buildQuickQuestions('local', d.activity, d.city, 3)[0].text).toBe('Qui me recommandez-vous pour la biorésonance à Domats ?');
  });

  it('réseau de coiffeurs : métier lu dans le nom ; « Make a Difference » n’est pas une ville', () => {
    const d = detectSite({ url: 'https://www.jeanlouisdavid.com/' }, FX.COIFFEUR_RESEAU);
    expect(d.city).toBeUndefined();
    expect(d.activity).toBe('coiffeur');
    expect(cityFromText('Coiffeur Jean Louis David | Make a Difference')).toBeUndefined();
    expect(cityFromText('Tapisserie Sur Mesure')).toBeUndefined();
    expect(cityFromText('Plombier à Lyon 3e')).toBe('Lyon');
  });

  it('H1 décoré : aucune activité inventée', () => {
    const d = detectSite({ url: 'https://www.septime-charonne.fr/' }, FX.RESTAURANT_DECORE);
    expect(d.activity).toBeUndefined();
  });

  it('segments de titres et H1 réels → activité propre, ou rien', () => {
    const cases: [string, string, string | undefined][] = [
      ['Les box de vins du Petit Ballon', 'Le Petit Ballon', 'box de vins'],
      ['Abonnement de box de vin et bière', 'Le Petit Ballon', 'abonnement de box de vin'],
      ['Thés et infusions bio de qualité', 'Kusmi Tea', 'thés et infusions bio'],
      ['Thés et Infusions Bio de qualité', 'Kusmi Tea', 'thés et infusions bio'],
      ['Logiciel de Paie & RH', 'PayFit', 'logiciel de paie & RH'],
      ['LDLC.com', 'LDLC', undefined],
      ['Maison Pierre Hermé', 'Pierre Hermé Paris', undefined],
      ['Leblanc', 'Leblanc', undefined],
      ['Fabricant de Savon de Marseille', 'La Savonnerie Marius Fabre', 'fabricant de savon de marseille'],
      ['Vins de Bourgogne', 'Cave', 'vins de Bourgogne'],
      ['du miel à l’état brut !', 'Miel Factory', 'miel à l’état brut'],
      ['Savon de Marseille chez Marius Fabre', 'La Savonnerie Marius Fabre', 'savon de Marseille'],
      ['Logiciel de paie & RH', 'PayFit', 'logiciel de paie & RH'],
      ['Il n’est de bouillon que Chartier', 'Bouillon Chartier', undefined],
      ['Prêt à faire du tri dans ton dressing ?', 'Vinted', undefined],
      ['Passez au meilleur de la tech', 'Back Market', undefined],
      ['Let’s cultivate the art of French coffee', 'Cafés Richard', undefined],
      ['Human’s resources', 'Lucca', undefined],
      ['High-Tech Expérience', 'LDLC', undefined],
      ['Le standard de l’assurance prévention', 'Alan', undefined],
      ['Échangeons', 'Leblanc', undefined],
      ['Nourrir', 'Poilâne', undefined],
      ['Index of /', 'Maison', undefined],
      ['Un instant', 'Bouillon Chartier', undefined],
      ['f l e u r s', 'Fleurs de Vies', undefined],
      ['Bienvenue chez Dupont', 'Dupont', undefined],
      ['Plombier chauffagiste à Lyon', 'EPC Énergie', 'plombier chauffagiste'],
    ];
    for (const [seg, brand, want] of cases) expect(cleanActivity(seg, brand), seg).toBe(want);
  });

  it('métier dans le nom, produit d’une boutique', () => {
    expect(tradeFromBrand('Coiffeur Jean Louis David')).toBe('coiffeur');
    expect(tradeFromBrand('Boulangerie')).toBeUndefined();
    expect(tradeFromBrand('Maison Kayser')).toBeUndefined();
    expect(productFocus('créateur de sacs à dos')).toBe('sacs à dos');
    expect(productFocus('spécialiste des thés')).toBe('thés');
    expect(productFocus('fabricant de Savon de Marseille')).toBe('savon de Marseille');
    expect(nounPhrase('box de vins')).toMatchObject({ kind: 'products', plural: true });
    expect(nounPhrase('location de voitures')).toMatchObject({ kind: 'service', feminine: true });
    expect(nounPhrase('caviste')).toMatchObject({ kind: 'trade', feminine: false });
  });
});

describe('questions : jamais de faute de construction', () => {
  const ACTS = ['box de vins', 'caviste', 'location de voitures', 'huiles essentielles', 'vin', 'huile d’olive', 'abonnement de box de vin', 'logiciel de paie', 'expertise comptable', 'agence web', 'restaurant italien', 'hôtel', 'boulangerie', 'sacs à dos', 'thés et infusions bio', 'coiffeur', 'whisky', undefined];
  it('aucune question cassée, quel que soit le type de site', () => {
    for (const t of ['local', 'pme', 'ecommerce'] as const)
      for (const a of ACTS)
        for (const q of buildQuickQuestions(t, a, t === 'ecommerce' ? undefined : 'Paris', 6)) {
          const x = q.text;
          expect(x, `${t} / ${a}`).not.toMatch(/\b(?:Quel|Quelle|Quels|Quelles|un|une|des|du|le|la|les) (?:les|le|la|des|du|un|une)\b(?! (?:plus|meilleur|mieux))/);
          expect(x).not.toMatch(/\s{2}|\s,|undefined|notre secteur|ces produits/);
          expect(x.charAt(0)).toBe(x.charAt(0).toUpperCase());
          expect(x).not.toMatch(/d’(?:[bcdfgjklmnpqrstvwxz])/i);
        }
  });
  it('élisions et accords', () => {
    expect(buildQuickQuestions('ecommerce', 'huile d’olive', undefined, 3)[0].text).toBe('Où acheter de l’huile d’olive en ligne en France ?');
    expect(buildQuickQuestions('local', 'hôtel', 'Nice', 3)[2].text).toBe('J’ai besoin d’un hôtel à Nice rapidement, qui contacter ?');
    expect(buildQuickQuestions('local', 'restaurant italien', 'Lyon', 3)[1].text).toBe('Quels sont les restaurants italiens les mieux notés à Lyon ?');
    expect(buildQuickQuestions('pme', 'agence web', 'Nantes', 3)[1].text).toBe('Quelles sont les agences web de référence à Nantes ?');
    expect(buildQuickQuestions('local', 'location de voitures', 'Nice', 3)[0].text).toBe('Qui me recommandez-vous pour la location de voitures à Nice ?');
  });
});

describe('démonstration sans clé IA : aperçu honnête, aucun faux nom', () => {
  it('concurrents remplacés par « Concurrent A, B… », sites inventés retirés', async () => {
    const s = await runQuickAiCheck({ url: 'https://www.lepetitballon.com/', brand: 'Le Petit Ballon', siteType: 'ecommerce', activity: 'box de vins', maxCalls: 18, signal: new AbortController().signal, save: false });
    expect(s?.demo).toBe(true);
    const t = s!.test!;
    const names = t.questions.flatMap((q) => q.cells.flatMap((c) => c.instead));
    expect(names.length).toBeGreaterThan(0);
    for (const n of names) expect(n).toMatch(/^Concurrent [A-Z]\d*$/);
    for (const n of s!.topCompetitors) expect(n).toMatch(/^Concurrent [A-Z]\d*$/);
    for (const c of t.questions.flatMap((q) => q.cells)) for (const src of c.sources) expect(src.domain).toMatch(/^(?:google\.[a-z.]+|pagesjaunes\.fr|lepetitballon\.com)$/);
    expect(JSON.stringify(t)).not.toMatch(/Atelier Caron|Vidal|Muller|Chez Rose/);
    expect(t.note).toMatch(/exemples simulés/);
  });
  it('la marque analysée n’est jamais remplacée', () => {
    const out = anonymizeDemoNames({ a: 'Le Petit Ballon devant Atelier Caron et Chez Rose' }, ['Atelier Caron', 'Chez Rose', 'Le Petit Ballon'], 'Le Petit Ballon');
    expect(out.a).toBe('Le Petit Ballon devant Concurrent A et Concurrent B');
  });
});

describe('accès : signatures relevées sur le vrai web', () => {
  const serve = (pages: Record<string, { status: number; body: string; headers?: Record<string, string> }>) => {
    restore = setFetchDeps({
      resolver: async () => [{ address: '93.184.216.34', family: 4 }],
      transport: async (req) => {
        const r = pages[req.url.toString()] ?? { status: 404, body: '' };
        return { status: r.status, headers: { 'content-type': 'text/html; charset=utf-8', ...(r.headers ?? {}) }, body: Buffer.from(req.method === 'HEAD' ? '' : r.body), truncated: false };
      },
    });
  };

  it('page 200 « Un instant, s’il vous plaît… » : défi anti-robots, pas « site en JavaScript »', async () => {
    expect(firewallOf(200, {}, FX.DEFI_UN_INSTANT)).toBe('un service anti-robots');
    expect(firewallOf(200, {}, '<title>Un instant gourmand, pâtisserie à Lyon</title>')).toBeNull();
    serve({ 'https://defi.example/': { status: 200, body: FX.DEFI_UN_INSTANT } });
    const c = await crawlSite('https://defi.example/', { maxPages: 2, timeBudgetMs: 5000 });
    expect(c.diagnosis?.state).toBe('blocked_firewall');
  });

  it('« Index of / » : liste de fichiers, aucun score', async () => {
    serve({ 'https://liste.example/': { status: 200, body: FX.INDEX_OF } });
    const c = await crawlSite('https://liste.example/', { maxPages: 3, timeBudgetMs: 5000 });
    expect(c.diagnosis?.state).toBe('directory_listing');
    expect(c.diagnosis?.readable).not.toBe(true);
  });

  it('certificat délivré pour un autre domaine : message précis (code tls)', async () => {
    const tlsErr = Object.assign(new Error("Hostname/IP does not match certificate's altnames: Host: www.cuisiniste.example. is not in the cert's altnames: DNS:*.autre.example"), { code: 'ERR_TLS_CERT_ALTNAME_INVALID' });
    expect(isTlsError(tlsErr)).toBe(true);
    expect(isTlsError(Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }))).toBe(false);
    restore = setFetchDeps({
      resolver: async () => [{ address: '93.184.216.34', family: 4 }],
      transport: async () => {
        throw tlsErr;
      },
    });
    const e = await safeFetch('https://www.cuisiniste.example/', { respectRobots: false }).catch((x) => x);
    expect(e).toBeInstanceOf(SafeFetchError);
    expect((e as SafeFetchError).code).toBe('tls');
    expect((e as SafeFetchError).publicMessage).toMatch(/certificat HTTPS/);
    const c = await crawlSite('https://www.cuisiniste.example/', { maxPages: 1, timeBudgetMs: 4000 });
    expect(c.diagnosis?.state).toBe('tls_error');
  });
});

describe('lancement direct depuis l’accueil (case professionnelle)', () => {
  const mem = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
  };
  it('trace à usage unique, même site, 10 minutes, même onglet', () => {
    const st = mem();
    rememberProIntent('https://www.LePetitBallon.com/', 1000, st);
    expect(consumeProIntent('lepetitballon.com', 2000, st)).toBe(true);
    expect(consumeProIntent('lepetitballon.com', 2000, st)).toBe(false);
    rememberProIntent('a.fr', 0, st);
    expect(consumeProIntent('b.fr', 1, st)).toBe(false);
    rememberProIntent('a.fr', 0, st);
    expect(consumeProIntent('a.fr', 11 * 60 * 1000, st)).toBe(false);
    expect(consumeProIntent('a.fr', 0, null)).toBe(false);
    expect(intentKey('http://www.site.fr/page?x=1')).toBe('site.fr');
  });
  it('?pro=1 n’est lu qu’avec une adresse de site', () => {
    expect(resolveAnalysisPrefill({ site: 'lepetitballon.com', pro: '1', segment: 'ecommerce' })).toMatchObject({ site: 'lepetitballon.com', pro: true, siteType: 'ecommerce' });
    expect(resolveAnalysisPrefill({ nom: 'Le Petit Ballon', pro: '1' }).pro).toBeUndefined();
  });
  it('déclaration horodatée par le serveur, texte exact, IP en empreinte', async () => {
    const now = new Date('2026-11-23T17:00:00Z');
    const ref = await recordProDeclaration({ source: 'accueil', domain: 'lepetitballon.com', ip: '203.0.113.7', now });
    expect(ref).toMatchObject({ at: '2026-11-23T17:00:00.000Z', source: 'accueil' });
    const doc = await getProDeclaration(ref.id);
    expect(doc).toMatchObject({ text: 'J’agis pour les besoins de mon activité professionnelle', domain: 'lepetitballon.com', source: 'accueil' });
    expect(JSON.stringify(doc)).not.toContain('203.0.113.7');
  });
});
