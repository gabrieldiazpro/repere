import { describe, expect, it } from 'vitest';
import { DPA_SECTIONS, SUBPROCESSORS } from '../content';

const text = DPA_SECTIONS.map((s) =>
  [s.title, ...(s.paras ?? []), ...(s.list ?? []), ...(s.after ?? []), ...(s.table?.rows.flat() ?? [])].join('\n'),
).join('\n');

describe('DPA (article 28.3 du RGPD)', () => {
  it.each([
    ['objet, durée, nature, finalité, données, personnes', /Finalités[\s\S]*Catégories de personnes[\s\S]*Catégories de données[\s\S]*Durée/],
    ['a) instructions documentées, y compris transferts', /instruction documentée[^.]*transferts/],
    ['b) confidentialité', /confidentialité/],
    ['c) sécurité article 32', /article 32/],
    ['d) sous-traitants ultérieurs, autorisation et information', /autorisation écrite générale[\s\S]*s'y opposer/],
    ['e) droits des personnes', /exercice des droits/],
    ['f) violations et analyses d’impact', /violation[\s\S]*analyses d'impact/i],
    ['g) restitution ou effacement', /restitue[\s\S]*efface/],
    ['h) audits et inspections', /audits, y compris des inspections/],
    ['instruction illicite signalée', /violation du RGPD/],
  ])('%s', (_label, re) => {
    expect(text).toMatch(re);
  });

  it('liste chaque sous-traitant ultérieur avec son lieu et son encadrement', () => {
    for (const name of ['Vercel', 'Supabase', 'Resend', 'OpenAI', 'Anthropic', 'Google', 'Perplexity', 'Mistral']) {
      expect(SUBPROCESSORS.some((p) => p.name.includes(name))).toBe(true);
    }
    for (const p of SUBPROCESSORS) {
      expect(p.place.length).toBeGreaterThan(0);
      expect(p.transfer.length).toBeGreaterThan(0);
    }
  });

  it("n'invente aucune identité : l'éditeur vient des variables NEXT_PUBLIC_LEGAL_*", () => {
    expect(text).toMatch(/NEXT_PUBLIC_LEGAL_NAME|NEXT_PUBLIC_LEGAL_SIREN/); // variables vides en test → mention « à compléter »
    expect(text).not.toMatch(/\b\d{3} ?\d{3} ?\d{3}\b/); // aucun SIREN écrit en dur
  });
});
