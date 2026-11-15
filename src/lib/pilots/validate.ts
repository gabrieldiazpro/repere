/**
 * Programme « entreprises pilotes » : champs du formulaire de candidature et validation.
 * Pur (aucun import serveur) : utilisé par le formulaire (client) et par la route POST /pilotes/candidature (serveur).
 */

/** Nombre de places du programme (affiché sur /pilotes). */
export const PILOT_SLOTS = 10;
/** Durée de l'offre pilote, en mois (PROPOSITION à valider par le fondateur, voir docs/lancement/). */
export const PILOT_MONTHS = 3;

export const PILOT_SEGMENTS = [
  { id: 'local', label: 'Commerce local (boutique, restaurant, artisan, cabinet…)' },
  { id: 'pme', label: 'PME ou entreprise B2B' },
  { id: 'ecommerce', label: 'Boutique en ligne (e-commerce)' },
] as const;
export type PilotSegment = (typeof PILOT_SEGMENTS)[number]['id'];

export const PILOT_SEGMENT_SHORT: Record<PilotSegment, string> = { local: 'Commerce local', pme: 'PME / B2B', ecommerce: 'E-commerce' };

export interface PilotFields {
  name: string;
  email: string;
  company: string;
  website: string;
  segment: PilotSegment | '';
  city: string;
  role: string;
  motivation: string;
  /** Accord (facultatif) pour publier un avant/après chiffré, nominatif, à la fin du programme. */
  publishOk: boolean;
  /** Consentement obligatoire au traitement de la candidature. */
  consent: boolean;
}

export type PilotErrors = Partial<Record<keyof PilotFields, string>>;

export const EMPTY_PILOT: PilotFields = {
  name: '',
  email: '',
  company: '',
  website: '',
  segment: '',
  city: '',
  role: '',
  motivation: '',
  publishOk: false,
  consent: false,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const MOTIVATION_MIN = 20;
export const MOTIVATION_MAX = 2000;

/** Normalise l'adresse du site : ajoute https:// si absent, refuse ce qui n'est pas un domaine public plausible. */
export function normalizeWebsite(raw: string): string | null {
  const s = raw.trim();
  if (!s || s.length > 300) return null;
  const withScheme = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    if (u.username || u.password) return null;
    const host = u.hostname.toLowerCase();
    // Un nom de domaine avec une extension : pas d'IP, pas de localhost.
    if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/i.test(host) || /^\d+(\.\d+){3}$/.test(host) || host.endsWith('.local') || host.endsWith('.localhost')) return null;
    return `${u.protocol}//${host}${u.pathname === '/' ? '' : u.pathname.replace(/\/+$/, '')}`;
  } catch {
    return null;
  }
}

export function isPilotSegment(v: unknown): v is PilotSegment {
  return PILOT_SEGMENTS.some((s) => s.id === v);
}

/** Validation complète (mêmes messages côté client et serveur). */
export function validatePilot(f: PilotFields): PilotErrors {
  const e: PilotErrors = {};
  if (!f.name.trim()) e.name = 'Indiquez votre nom.';
  else if (f.name.length > 120) e.name = 'Votre nom dépasse 120 caractères.';
  if (!EMAIL_RE.test(f.email.trim()) || f.email.length > 200) e.email = 'Cette adresse e-mail semble incomplète. Vérifiez-la, par exemple vous@exemple.fr.';
  if (!f.company.trim()) e.company = 'Indiquez le nom de votre entreprise.';
  else if (f.company.length > 120) e.company = 'Le nom de l’entreprise dépasse 120 caractères.';
  if (!normalizeWebsite(f.website)) e.website = 'Indiquez l’adresse de votre site, par exemple www.exemple.fr.';
  if (!isPilotSegment(f.segment)) e.segment = 'Choisissez le type d’entreprise.';
  if (f.city.length > 80) e.city = 'La ville dépasse 80 caractères.';
  if (f.segment === 'local' && !f.city.trim()) e.city = 'Indiquez votre ville : la visibilité locale se mesure ville par ville.';
  if (f.role.length > 80) e.role = 'La fonction dépasse 80 caractères.';
  const m = f.motivation.trim();
  if (m.length < MOTIVATION_MIN) e.motivation = `Dites-nous en quelques mots ce que vous attendez (${MOTIVATION_MIN} caractères au moins).`;
  else if (f.motivation.length > MOTIVATION_MAX) e.motivation = `Votre texte dépasse ${MOTIVATION_MAX.toLocaleString('fr-FR')} caractères : raccourcissez-le.`;
  if (f.consent !== true) e.consent = 'Cochez la case pour que nous puissions étudier votre candidature.';
  return e;
}

/** Lit un corps JSON inconnu en champs typés (valeurs manquantes → vides). */
export function pilotFieldsFrom(body: unknown): PilotFields {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const s = (k: string) => (typeof b[k] === 'string' ? (b[k] as string) : '');
  const seg = s('segment');
  return {
    name: s('name'),
    email: s('email'),
    company: s('company'),
    website: s('website'),
    segment: isPilotSegment(seg) ? seg : '',
    city: s('city'),
    role: s('role'),
    motivation: s('motivation'),
    publishOk: b.publishOk === true,
    consent: b.consent === true,
  };
}
