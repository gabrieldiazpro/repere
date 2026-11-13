import { describe, expect, it } from 'vitest';
import { isRegulatedTrade } from '@/lib/regulated';
import { TRADES } from '@/app/audit/options';

describe('métiers réglementés (qa/ARBITRAGES.md n° 8)', () => {
  it.each(['Dentiste', 'chirurgien-dentiste', 'Ostéopathe', 'kiné', 'Kinésithérapeute', 'médecin généraliste', 'Psychologue', 'Pharmacie', 'infirmière', 'sage-femme', 'Avocat', 'cabinet d’avocats', 'Expert-comptable', 'notaire', 'commissaire de justice', 'architecte', 'cabinet d’expertise comptable'])(
    '« %s » est refusé',
    (t) => expect(isRegulatedTrade(t)).toBe(true),
  );
  it.each(['plombier', 'Restaurant italien', 'coiffeur', 'institut de beauté', 'agence immobilière', 'fleuriste', 'architecte d’intérieur', 'serrurier', '', 'logiciel de comptabilité', 'logiciel de paie', 'matériel dentaire', 'logiciel pour cabinet médical', 'blouses médicales'])(
    '« %s » est accepté',
    (t) => expect(isRegulatedTrade(t)).toBe(false),
  );
  it('le formulaire ne propose aucun métier réglementé', () => {
    expect(TRADES.length).toBeGreaterThan(10);
    expect(TRADES.filter((t) => isRegulatedTrade(t.nom))).toEqual([]);
  });
});
