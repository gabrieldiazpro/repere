/**
 * Candidature au programme partenaires : champs et validation. Pur (formulaire client + route serveur).
 * Mêmes règles que le formulaire pilote (src/lib/pilots/validate.ts) dont on reprend la normalisation du site.
 */
import { normalizeWebsite } from '@/lib/pilots/validate';
import { isPartnerFamily, type PartnerFamily } from './program';

export { normalizeWebsite };

export const AUDIENCE_SIZES = [
  { id: 'lt10', label: 'Moins de 10' },
  { id: '10-50', label: '10 à 50' },
  { id: '50-200', label: '50 à 200' },
  { id: 'gt200', label: 'Plus de 200' },
] as const;
export type AudienceSize = (typeof AUDIENCE_SIZES)[number]['id'];
export const isAudienceSize = (v: unknown): v is AudienceSize => AUDIENCE_SIZES.some((s) => s.id === v);
export const audienceLabel = (v: AudienceSize | null | undefined) => AUDIENCE_SIZES.find((s) => s.id === v)?.label ?? '—';

export interface PartnerFields {
  family: PartnerFamily | '';
  company: string;
  website: string;
  name: string;
  email: string;
  role: string;
  city: string;
  /** Nombre de clients, adhérents ou élèves concernés (ordre de grandeur, facultatif). */
  audience: AudienceSize | '';
  message: string;
  /** Accord pour figurer dans l'annuaire public une fois accepté (facultatif). */
  listOk: boolean;
  consent: boolean;
}

export type PartnerErrors = Partial<Record<keyof PartnerFields, string>>;

export const EMPTY_PARTNER: PartnerFields = {
  family: '',
  company: '',
  website: '',
  name: '',
  email: '',
  role: '',
  city: '',
  audience: '',
  message: '',
  listOk: false,
  consent: false,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const MESSAGE_MIN = 20;
export const MESSAGE_MAX = 2000;

export function validatePartner(f: PartnerFields): PartnerErrors {
  const e: PartnerErrors = {};
  if (!isPartnerFamily(f.family)) e.family = 'Choisissez le type de partenaire.';
  if (!f.company.trim()) e.company = 'Indiquez le nom de votre structure.';
  else if (f.company.length > 120) e.company = 'Le nom dépasse 120 caractères.';
  if (!normalizeWebsite(f.website)) e.website = 'Indiquez l’adresse de votre site, par exemple www.exemple.fr.';
  if (!f.name.trim()) e.name = 'Indiquez votre nom.';
  else if (f.name.length > 120) e.name = 'Votre nom dépasse 120 caractères.';
  if (!EMAIL_RE.test(f.email.trim()) || f.email.length > 200) e.email = 'Cette adresse e-mail semble incomplète. Vérifiez-la, par exemple vous@exemple.fr.';
  if (f.role.length > 80) e.role = 'La fonction dépasse 80 caractères.';
  if (f.city.length > 80) e.city = 'La ville dépasse 80 caractères.';
  if (f.audience !== '' && !isAudienceSize(f.audience)) e.audience = 'Choisissez un ordre de grandeur dans la liste.';
  const m = f.message.trim();
  if (m.length < MESSAGE_MIN) e.message = `Dites-nous en quelques mots comment vous imaginez le partenariat (${MESSAGE_MIN} caractères au moins).`;
  else if (f.message.length > MESSAGE_MAX) e.message = `Votre texte dépasse ${MESSAGE_MAX.toLocaleString('fr-FR')} caractères : raccourcissez-le.`;
  if (f.consent !== true) e.consent = 'Cochez la case pour que nous puissions étudier votre candidature.';
  return e;
}

export function partnerFieldsFrom(body: unknown): PartnerFields {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const s = (k: string) => (typeof b[k] === 'string' ? (b[k] as string) : '');
  const family = s('family');
  const audience = s('audience');
  return {
    family: isPartnerFamily(family) ? family : '',
    company: s('company'),
    website: s('website'),
    name: s('name'),
    email: s('email'),
    role: s('role'),
    city: s('city'),
    audience: isAudienceSize(audience) ? audience : '',
    message: s('message'),
    listOk: b.listOk === true,
    consent: b.consent === true,
  };
}
