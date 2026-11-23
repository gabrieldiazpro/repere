/**
 * Codes et liens de parrainage des partenaires. Pur.
 *
 * Un lien partenaire est une adresse du site suivie de `?ref=<code>` (ex. https://repere-ia.fr/?ref=agence-dupont).
 * L'attribution réutilise celle des baromètres (src/lib/roi) : SANS cookie ni stockage dans le navigateur, la première
 * page vue est gardée en mémoire de l'onglet et `?ref=` y est lu comme une campagne « partenaire » (src/lib/roi/core.ts
 * `partnerRefOf`, `partnerCodeOf`). L'origine est enregistrée avec l'analyse, l'audit ou l'espace créé à l'inscription.
 */
import { partnerCodeOf, partnerRefOf, PARTNER_UTM, type Attribution } from '@/lib/roi/core';

export { partnerCodeOf, partnerRefOf, PARTNER_UTM };

export const isPartnerCode = (c: unknown): c is string => partnerRefOf(c) !== undefined;

/** Code proposé à partir du nom de la structure : minuscules sans accents, tirets, 3 à 30 caractères. */
export function suggestCode(company: string): string {
  let s = company
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' et ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30)
    .replace(/-+$/g, '');
  if (s.startsWith('rep-')) s = `p-${s}`.slice(0, 30).replace(/-+$/g, '');
  if (s.length < 3) s = `${s || 'partenaire'}-${s ? 'pro' : ''}`.replace(/-+$/g, '');
  return isPartnerCode(s) ? s : 'partenaire';
}

/** Rend `code` unique parmi `taken` en ajoutant -2, -3… */
export function uniqueCode(code: string, taken: Iterable<string>): string {
  const set = new Set(taken);
  if (!set.has(code)) return code;
  for (let i = 2; i < 1000; i++) {
    const suffix = `-${i}`;
    const c = `${code.slice(0, 30 - suffix.length).replace(/-+$/g, '')}${suffix}`;
    if (!set.has(c)) return c;
  }
  return `${code.slice(0, 20)}-${Date.now().toString(36).slice(-6)}`;
}

/** Lien de parrainage vers une page du site (défaut : l'accueil). */
export function referralLink(siteUrl: string, code: string, path = '/'): string {
  const base = siteUrl.replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  const sep = p.includes('?') ? '&' : '?';
  return `${base}${p}${sep}ref=${encodeURIComponent(code)}`;
}

/** Vrai si cette origine vient du lien de ce partenaire. */
export function attributedTo(a: Attribution | null | undefined, code: string): boolean {
  return partnerCodeOf(a) === code;
}
