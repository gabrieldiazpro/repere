import { describe, expect, it } from 'vitest';
import { shouldProposeName, stripPrivateParams } from '../prefill';

describe('formulaire d’audit (B4, B22)', () => {
  it('nom proposé seulement si le champ est vide et que personne ne tape (jamais « KarimPlomberie Karim »)', () => {
    const base = { guess: 'Plomberie Karim', replaceGuess: false, userEditing: false };
    expect(shouldProposeName({ ...base, current: '', proposed: 'Plomberie Karim' })).toBe(true);
    expect(shouldProposeName({ ...base, current: '', proposed: 'Plomberie Karim', userEditing: true })).toBe(false);
    expect(shouldProposeName({ ...base, current: 'Plomberie K', proposed: 'Plomberie Karim' })).toBe(false);
    // le nom lu sur la page remplace la proposition faite depuis l'adresse… tant que personne n'y a touché
    expect(shouldProposeName({ ...base, current: 'Plomberie Karim', proposed: 'Plomberie Karim & Fils', replaceGuess: true })).toBe(true);
    expect(shouldProposeName({ ...base, current: 'Plomberie Karim', proposed: 'Plomberie Karim & Fils', replaceGuess: true, userEditing: true })).toBe(false);
    expect(shouldProposeName({ ...base, current: 'Autre nom', proposed: 'Plomberie Karim & Fils', replaceGuess: true })).toBe(false);
    expect(shouldProposeName({ ...base, current: '', proposed: undefined })).toBe(false);
  });

  it('jamais d’e-mail ni de consentement dans l’adresse de /audit', () => {
    const sp = new URLSearchParams('segment=ecommerce&nom=Bulle&email=ines%40example.fr&consent=on&marketingConsent=on');
    expect(stripPrivateParams(sp)).toBe('segment=ecommerce&nom=Bulle');
    expect(stripPrivateParams(new URLSearchParams('segment=local'))).toBe('segment=local');
  });

  it('le formulaire part en POST et le bouton attend l’hydratation', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../AuditForm.tsx', import.meta.url), 'utf8');
    expect(src).toMatch(/<form method="post"/);
    expect(src).toMatch(/disabled=\{!hydrated\}/);
  });
});
