import { describe, expect, it } from 'vitest';
import { generateFanOut, inventedFacts, rewritePassage, runGeo, templateFanOut, type GeoLlm, type Passage } from '../index';
import { doc, makeCrawl } from './fixtures';

/** Fournisseur d'IA simulé : répond selon le système demandé, compte les appels. */
function fakeLlm(handler: (system: string, user: string) => string | Promise<string>): GeoLlm & { calls: number } {
  const llm = {
    model: 'faux:modele',
    calls: 0,
    async completeJson(system: string, user: string) {
      llm.calls++;
      return handler(system, user);
    },
  };
  return llm;
}

const passage: Passage = {
  id: 'p1',
  url: 'https://plomberie-dupont.fr/',
  heading: 'Combien coûte un dépannage ?',
  headingIsQuestion: true,
  text: 'Il faut savoir que chaque situation est différente. Le déplacement est facturé 80 € TTC à Grenoble et chaque heure de travail coûte 50 € TTC, devis gratuit avant intervention.',
  words: 30,
  position: 0.1,
  depth: 0,
  externalLinks: 0,
};

describe('rewritePassage', () => {
  it('sans IA : règles déterministes, réponse chiffrée en tête', async () => {
    const r = await rewritePassage(passage, { brand: 'Plomberie Dupont', llm: null });
    expect(r.mode).toBe('deterministe');
    expect(r.after.startsWith('Le déplacement est facturé 80 € TTC')).toBe(true);
    expect(r.notes.join(' ')).toMatch(/aucun fournisseur/);
    expect(inventedFacts(r.after, passage.text)).toEqual([]);
  });

  it('IA : réécriture acceptée si elle ne reprend que des faits connus', async () => {
    const llm = fakeLlm(() => JSON.stringify({ text: 'Un dépannage par Plomberie Dupont à Grenoble coûte 80 € TTC de déplacement, puis 50 € TTC par heure de travail. Le devis est gratuit avant toute intervention.', facts: ['80 € TTC', '50 € TTC'] }));
    const r = await rewritePassage(passage, { brand: 'Plomberie Dupont', llm });
    expect(r).toMatchObject({ mode: 'ia', model: 'faux:modele', facts: ['80 € TTC', '50 € TTC'] });
    expect(llm.calls).toBe(1);
  });

  it('IA : faits inventés ⇒ rejet et repli déterministe', async () => {
    const llm = fakeLlm(() => JSON.stringify({ text: 'Plomberie Dupont, n°1 à Grenoble depuis 1998 avec 4,9/5 sur 812 avis, facture 80 € TTC le déplacement (voir https://avis-faux.example).' }));
    const r = await rewritePassage(passage, { brand: 'Plomberie Dupont', llm });
    expect(r.mode).toBe('deterministe');
    expect(r.notes.join(' ')).toMatch(/rejetée.*1998/);
    expect(inventedFacts('A 1998, 4.9 et https://avis-faux.example', passage.text)).toEqual(['1998', '4.9', 'https://avis-faux.example']);
  });

  it('IA : faits de la fiche de vérité autorisés ; erreurs et réponses vides ⇒ repli', async () => {
    const ok = fakeLlm(() => JSON.stringify({ text: 'Plomberie Dupont facture 80 € TTC le déplacement à Grenoble et 50 € TTC par heure ; elle intervient dans 18 communes autour de Grenoble.' }));
    expect((await rewritePassage(passage, { llm: ok, facts: { zone: 'Grenoble et 18 communes' } })).mode).toBe('ia');
    const boom = fakeLlm(() => {
      throw new Error('quota');
    });
    expect((await rewritePassage(passage, { llm: boom })).notes.join(' ')).toMatch(/IA indisponible \(quota\)/);
    const empty = fakeLlm(() => 'pas de json');
    expect((await rewritePassage(passage, { llm: empty })).mode).toBe('deterministe');
    const slow = fakeLlm(() => new Promise<string>((ok2) => setTimeout(() => ok2('{}'), 200)));
    expect((await rewritePassage(passage, { llm: slow, timeoutMs: 20 })).notes.join(' ')).toMatch(/délai dépassé/);
  });

  it('déterministe : faits de la fiche ajoutés seulement quand le passage n’a aucun chiffre', async () => {
    const vague: Passage = { ...passage, text: 'Il faut savoir que chaque situation est différente et que nous adaptons toujours notre tarif à vos besoins réels, sans mauvaise surprise sur la facture finale.' };
    const r = await rewritePassage(vague, { brand: 'Plomberie Dupont', facts: { prix: 'Déplacement 80 € TTC' } });
    expect(r.after).toContain('Tarifs : Déplacement 80 € TTC.');
    expect(r.after.startsWith('Chaque situation est différente')).toBe(true);
    expect(r.facts).toEqual(['Tarifs : Déplacement 80 € TTC']);
  });
});

describe('rewritePassage — sujet nommé', () => {
  it('pronom en tête remplacé par le nom ; à défaut, marqueur à compléter', async () => {
    const p: Passage = { ...passage, heading: 'Notre zone', headingIsQuestion: false, text: 'Elle intervient dans toute l’agglomération grenobloise, du lundi au samedi, pour les dépannages et les installations de chauffe-eau, avec un devis gratuit.' };
    expect((await rewritePassage(p, { brand: 'Plomberie Dupont' })).after.startsWith('Plomberie Dupont intervient')).toBe(true);
    expect((await rewritePassage(p, {})).after.startsWith('[nom de l’entreprise] intervient')).toBe(true);
  });
});

describe('generateFanOut', () => {
  const ctx = { siteType: 'local' as const, brand: 'Plomberie Dupont', trade: 'plombier', city: 'Grenoble' };
  it('IA : sous-questions validées, dédoublonnées, facette devinée si absente', async () => {
    const llm = fakeLlm(() =>
      JSON.stringify({
        items: [
          { seed: 'Quel plombier choisir à Grenoble ?', question: 'Quel est le prix moyen d’un dépannage de plomberie à Grenoble ?', facet: 'prix' },
          { question: 'Quel est le prix moyen d’un dépannage de plomberie à Grenoble ?' },
          { question: 'Quels plombiers sont certifiés RGE à Grenoble ?' },
          { question: 'Un plombier peut-il venir le dimanche à Grenoble ?', facet: 'inconnue' },
          { question: 'x' },
        ],
      }),
    );
    const subs = await generateFanOut(['Quel plombier choisir à Grenoble ?'], ctx, llm);
    expect(subs.map((s) => [s.facet, s.source])).toEqual([
      ['prix', 'ia'],
      ['garanties', 'ia'],
      ['urgence', 'ia'],
    ]);
  });
  it('sans IA ou réponse inexploitable : gabarits', async () => {
    expect((await generateFanOut([], ctx, null)).every((s) => s.source === 'modele')).toBe(true);
    expect(await generateFanOut([], ctx, fakeLlm(() => '{"items": []}'))).toEqual(templateFanOut(['Quel plombier choisir à Grenoble ?'], ctx));
  });
});

describe('runGeo (fournisseur simulé)', () => {
  it('sous-questions et réécritures par l’IA, rapport non démo', async () => {
    const weak = 'Il est vraiment très important de faire appel à un professionnel sérieux et compétent pour tous vos travaux de plomberie et de chauffage, car cela vous évitera bien des soucis et des désagréments par la suite dans votre maison ou votre appartement.';
    const crawl = makeCrawl('https://plomberie-dupont.fr', [
      { path: '/', html: doc({ title: 'Plomberie Dupont', h1: 'Plomberie Dupont', sections: [['Nos services', weak], ['Nos valeurs', weak.replace('Il est', 'Cela reste')], ['Notre équipe', weak.replace('Il est vraiment', 'Ce sera toujours')]] }) },
    ]);
    const llm = fakeLlm((system) =>
      system.includes('query fan-out')
        ? JSON.stringify({ items: [{ question: 'Quel est le tarif d’un plombier à Grenoble ?', facet: 'prix' }, { question: 'Plomberie Dupont est-il assuré ?', facet: 'garanties' }, { question: 'Comment joindre Plomberie Dupont ?', facet: 'contact' }] })
        : JSON.stringify({ text: 'Plomberie Dupont réalise vos travaux de plomberie et de chauffage. [à compléter : un chiffre précis (prix, délai, quantité)]' }),
    );
    const r = await runGeo(crawl, { brand: 'Plomberie Dupont' }, { llm });
    expect(r.fanOut.source).toBe('ia');
    expect(r.fanOut.items).toHaveLength(3);
    expect(r.demo).toBe(false);
    const weakF = r.sections.flatMap((s) => s.findings).find((f) => f.id === 'geo.passages.weak')!;
    const items = (weakF.autoFix!.payload as { items: { mode: string }[] }).items;
    expect(items.length).toBe(3);
    expect(items.every((i) => i.mode === 'ia')).toBe(true);
    expect(llm.calls).toBe(4); // 1 éventail + 3 réécritures
  });

  it('llm:null ⇒ identique à auditGeo (démo)', async () => {
    const crawl = makeCrawl('https://x.fr', [{ path: '/', html: doc({ title: 'X', h1: 'X', intro: ['X est une entreprise.'] }) }]);
    const r = await runGeo(crawl, {}, { llm: null });
    expect(r.demo).toBe(true);
    expect(r.fanOut.source).toBe('modele');
  });
});
