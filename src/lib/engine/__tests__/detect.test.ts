import { describe, expect, it } from 'vitest';
import { buildVariants, detectMention, extractHeuristic, jaroWinkler, norm, registrableDomain } from '../detect';
import type { AuditInput, ProviderAnswer } from '../types';

const ans = (text: string, citations: string[] = []): ProviderAnswer => ({
  provider: 'chatgpt',
  queryId: 'T1-abcd',
  run: 1,
  text,
  citations,
  demo: false,
});

const dupont: AuditInput = { businessName: 'Plomberie Dupont SARL', trade: 'plombier', city: 'Paris', district: '11' };

describe('norm & utilitaires', () => {
  it('supprime accents, formes juridiques et ponctuation', () => {
    expect(norm('Chez Gégé')).toBe('chez gege');
    expect(norm('Plomberie Dupont SARL')).toBe('plomberie dupont');
    expect(norm("L'Atelier d'Hélène & Fils")).toBe('l atelier d helene et fils');
  });
  it('domaine enregistrable', () => {
    expect(registrableDomain('https://www.plomberie-dupont.fr/contact?x=1')).toBe('plomberie-dupont.fr');
    expect(registrableDomain('shop.example.co.uk')).toBe('example.co.uk');
  });
  it('jaro-winkler', () => {
    expect(jaroWinkler('martha', 'marhta')).toBeCloseTo(0.961, 2);
    expect(jaroWinkler('abc', 'abc')).toBe(1);
  });
  it('variantes', () => {
    const v = buildVariants(dupont);
    expect(v.full).toBe('plomberie dupont');
    expect(v.core).toBe('dupont');
    expect(v.ambiguous).toBe(false);
    expect(buildVariants({ ...dupont, businessName: 'Société Dupont Plomberie Services' }).acronym).toBe('SDPS');
  });
});

describe('detectMention', () => {
  it('reconnaît « Plomberie Dupont SARL » sous plusieurs formes', () => {
    expect(detectMention(ans('1. **Dupont Plomberie** (Paris 11e) – rapide.\n2. **Plomberie Martin** – sérieux.'), dupont).mentioned).toBe(true);
    expect(detectMention(ans("Je vous conseille plomberie dupont, très réactif, et l'entreprise Martin Frères."), dupont).mentioned).toBe(true);
  });

  it('ne confond pas avec « Dupond Électricité »', () => {
    const m = detectMention(ans('1. **Dupond Électricité** – dépannage.\n2. **Plomberie Martin** – sérieux.'), dupont);
    expect(m.mentioned).toBe(false);
    expect(m.competitors).toContain('Dupond Électricité');
  });

  it('donne le rang de liste', () => {
    const m = detectMention(
      ans('Voici :\n\n1. **Plomberie Martin** – ok.\n2. **Atelier Roux** – ok.\n3. **Dupont Plomberie** – ok.'),
      dupont,
    );
    expect(m.mentioned).toBe(true);
    expect(m.rank).toBe(3);
    expect(m.competitors).toEqual(['Plomberie Martin', 'Atelier Roux']);
  });

  it('accents : « Chez Gégé » reconnu dans « chez gege »', () => {
    const gege: AuditInput = { businessName: 'Chez Gégé', trade: 'restaurant', city: 'Paris' };
    expect(detectMention(ans('Pour bien manger, essayez chez gege, une adresse familiale.'), gege).mentioned).toBe(true);
  });

  it('nom générique : « Le Bistrot » exige une preuve géographique', () => {
    const bistrot: AuditInput = { businessName: 'Le Bistrot', trade: 'restaurant', city: 'Paris', district: 'Bastille' };
    expect(detectMention(ans('- **Le Bistrot**, rue de Lappe : cuisine maison.\n- **Chez Paulette** : convivial.'), bistrot).mentioned).toBe(false);
    expect(
      detectMention(ans('- **Le Bistrot**, rue de Lappe près de Bastille : cuisine maison.\n- **Chez Paulette** : convivial.'), bistrot).mentioned,
    ).toBe(true);
    const bistrot11: AuditInput = { ...bistrot, district: '11' };
    expect(detectMention(ans('- **Le Bistrot** (Paris 11e) : cuisine maison.\n- **Chez Paulette**.'), bistrot11).mentioned).toBe(true);
  });

  it('homonyme dans une autre ville : rejet et ajout aux concurrents', () => {
    const m1 = detectMention(ans('- **Le Bistrot** (Lyon) : très bon.\n- **Chez Paulette** : convivial.'), {
      businessName: 'Le Bistrot', trade: 'restaurant', city: 'Paris', district: 'Bastille',
    });
    expect(m1.mentioned).toBe(false);
    const m2 = detectMention(ans('1. **Dupont Plomberie** (Lyon 3e) – bien noté.\n2. **Plomberie Martin** – sérieux.'), dupont);
    expect(m2.mentioned).toBe(false);
    expect(m2.competitors).toContain('Dupont Plomberie');
    const m3 = detectMention(ans('1. **Dupont Plomberie** (Paris 15e) – bien noté.\n2. **Plomberie Martin**.'), dupont);
    expect(m3.mentioned).toBe(false);
  });

  it('acronyme : uniquement en majuscules et avec preuve', () => {
    const sdps: AuditInput = { businessName: 'Société Dupont Plomberie Services', trade: 'plombier', city: 'Paris', district: '11' };
    // Le nom complet n'apparaît pas : seul l'acronyme peut matcher.
    expect(detectMention(ans('1. **SDPS** (Paris 11e) – rapide.\n2. **Plomberie Martin**.'), sdps).mentioned).toBe(true);
    expect(detectMention(ans('1. **SDPS** – rapide.\n2. **Plomberie Martin**.'), sdps).mentioned).toBe(false);
    expect(detectMention(ans('1. **sdps** (Paris 11e) – rapide.\n2. **Plomberie Martin**.'), sdps).mentioned).toBe(false);
  });

  it('domaine cité seulement dans les sources : pas une mention, mais abaisse le seuil flou', () => {
    const site: AuditInput = { businessName: 'Dupont Plomberie', trade: 'plombier', city: 'Paris', district: '11', website: 'https://dupont-plomberie.fr' };
    const only = detectMention(ans('1. **Plomberie Martin** – ok.\n2. **Atelier Roux** – ok.', ['https://www.dupont-plomberie.fr/']), site);
    expect(only.mentioned).toBe(false);
    expect(only.citedDomain).toBe(true);
    const typo = detectMention(ans('1. **Plomberie Martin** – ok.\n2. **Dupnot Plombrie** – ok.', ['https://dupont-plomberie.fr/']), site);
    expect(typo.mentioned).toBe(true);
    const typoNoCite = detectMention(ans('1. **Plomberie Martin** – ok.\n2. **Dupnot Plombrie** – ok.'), site);
    expect(typoNoCite.mentioned).toBe(false);
  });

  it('réponse sans recommandation : noRec', () => {
    const m = detectMention(ans('Je vous conseille de consulter Google Maps pour trouver un plombier.'), dupont);
    expect(m.noRec).toBe(true);
    expect(m.snippet).toBe('[aucune recommandation]');
  });

  it('réponse en erreur : non mentionné', () => {
    const m = detectMention({ ...ans(''), error: 'HTTP 500' }, dupont);
    expect(m.mentioned).toBe(false);
    expect(m.competitors).toEqual([]);
  });
});

describe('extractHeuristic', () => {
  it('liste en gras', () => {
    const e = extractHeuristic('Voici :\n\n1. **Plomberie Martin** (Paris 11e) – rapide.\n2. **Atelier Roux** : sérieux.\n3. Google Maps – pour comparer.', dupont);
    expect(e.map((x) => x.name)).toEqual(['Plomberie Martin', 'Atelier Roux']);
  });
  it('prose : suites capitalisées, plateformes et lieux filtrés', () => {
    const e = extractHeuristic(
      'À Paris, on cite souvent Plomberie Martin, Atelier Roux et Ets Bernard. Consultez aussi Google Maps.',
      dupont,
    );
    expect(e.map((x) => x.name)).toEqual(['Plomberie Martin', 'Atelier Roux', 'Ets Bernard']);
  });
});
