/**
 * « Réserver une démo » (offres Accompagné et Agence) : champs et validation. Pur (formulaire client + route serveur).
 * Créneaux souhaités : jusqu'à 3 demi-journées en semaine, de demain à J+60 (heure de Paris) ; à défaut, un texte libre.
 */
import { normalizeWebsite } from '@/lib/pilots/validate';

export { normalizeWebsite };

export const MEETING_OFFERS = [
  { id: 'accompagne', label: 'Accompagné', who: 'pour mon entreprise' },
  { id: 'agence', label: 'Agence', who: 'pour mon agence et mes clients' },
] as const;
export type MeetingOffer = (typeof MEETING_OFFERS)[number]['id'];
export const isMeetingOffer = (v: unknown): v is MeetingOffer => MEETING_OFFERS.some((o) => o.id === v);
export const offerLabel = (o: MeetingOffer) => MEETING_OFFERS.find((x) => x.id === o)?.label ?? o;

export const SEGMENTS = [
  { id: 'local', label: 'Commerce local' },
  { id: 'pme', label: 'PME / B2B' },
  { id: 'ecommerce', label: 'E-commerce' },
] as const;
export type MeetingSegment = (typeof SEGMENTS)[number]['id'];
export const isMeetingSegment = (v: unknown): v is MeetingSegment => SEGMENTS.some((s) => s.id === v);

/** Taille : effectif (Accompagné) ou nombre de clients suivis (Agence). */
export const SIZES: Record<MeetingOffer, { id: string; label: string }[]> = {
  accompagne: [
    { id: '1', label: 'Seul ou à deux' },
    { id: '3-10', label: '3 à 10 personnes' },
    { id: '11-50', label: '11 à 50 personnes' },
    { id: '51-250', label: '51 à 250 personnes' },
    { id: '250+', label: 'Plus de 250 personnes' },
  ],
  agence: [
    { id: 'c1-5', label: '1 à 5 clients' },
    { id: 'c6-20', label: '6 à 20 clients' },
    { id: 'c21-50', label: '21 à 50 clients' },
    { id: 'c50+', label: 'Plus de 50 clients' },
  ],
};
export const sizeLabel = (offer: MeetingOffer, id: string) => SIZES[offer].find((s) => s.id === id)?.label ?? id;

export const PERIODS = [
  { id: 'matin', label: 'Matin (9 h – 12 h)' },
  { id: 'apres-midi', label: 'Après-midi (14 h – 18 h)' },
] as const;
export type SlotPeriod = (typeof PERIODS)[number]['id'];
export const isSlotPeriod = (v: unknown): v is SlotPeriod => PERIODS.some((p) => p.id === v);

export interface Slot {
  date: string; // AAAA-MM-JJ
  period: SlotPeriod;
}

export interface MeetingFields {
  offer: MeetingOffer | '';
  segment: MeetingSegment | '';
  company: string;
  website: string;
  size: string;
  need: string;
  slots: Slot[];
  otherTimes: string;
  name: string;
  email: string;
  phone: string;
  consent: boolean;
}

export type MeetingErrors = Partial<Record<keyof MeetingFields, string>>;

export const MAX_SLOTS = 3;
export const SLOT_HORIZON_DAYS = 60;
export const NEED_MIN = 10;
export const NEED_MAX = 2000;

export const EMPTY_MEETING: MeetingFields = {
  offer: '',
  segment: '',
  company: '',
  website: '',
  size: '',
  need: '',
  slots: [],
  otherTimes: '',
  name: '',
  email: '',
  phone: '',
  consent: false,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[+()0-9 .-]{6,25}$/;

/** Date du jour à Paris (AAAA-MM-JJ). */
export function parisDay(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

const dayNum = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86_400_000;
const fromDayNum = (n: number) => new Date(n * 86_400_000).toISOString().slice(0, 10);

/** Bornes du sélecteur de date : demain → J+60 (Paris). */
export function slotBounds(now: Date = new Date()): { min: string; max: string } {
  const today = dayNum(parisDay(now));
  return { min: fromDayNum(today + 1), max: fromDayNum(today + SLOT_HORIZON_DAYS) };
}

/** Erreur d'un créneau, ou null s'il est valide. */
export function slotError(s: Slot, now: Date = new Date()): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date) || !Number.isFinite(Date.parse(`${s.date}T12:00:00Z`)) || fromDayNum(dayNum(s.date)) !== s.date) return 'Date invalide.';
  const { min, max } = slotBounds(now);
  if (s.date < min) return 'Choisissez une date à partir de demain.';
  if (s.date > max) return `Choisissez une date dans les ${SLOT_HORIZON_DAYS} prochains jours.`;
  const wd = new Date(`${s.date}T12:00:00Z`).getUTCDay();
  if (wd === 0 || wd === 6) return 'Nous proposons les démos du lundi au vendredi.';
  if (!isSlotPeriod(s.period)) return 'Choisissez le matin ou l’après-midi.';
  return null;
}

export function validateMeeting(f: MeetingFields, now: Date = new Date()): MeetingErrors {
  const e: MeetingErrors = {};
  if (!isMeetingOffer(f.offer)) e.offer = 'Choisissez l’offre qui vous intéresse.';
  if (f.offer === 'accompagne' && !isMeetingSegment(f.segment)) e.segment = 'Choisissez le type d’entreprise.';
  if (!f.company.trim()) e.company = f.offer === 'agence' ? 'Indiquez le nom de votre agence.' : 'Indiquez le nom de votre entreprise.';
  else if (f.company.length > 120) e.company = 'Le nom dépasse 120 caractères.';
  if (!normalizeWebsite(f.website)) e.website = 'Indiquez l’adresse de votre site, par exemple www.exemple.fr.';
  if (isMeetingOffer(f.offer) && !SIZES[f.offer].some((s) => s.id === f.size)) e.size = f.offer === 'agence' ? 'Indiquez combien de clients vous suivez.' : 'Indiquez la taille de votre entreprise.';
  const n = f.need.trim();
  if (n.length < NEED_MIN) e.need = `Dites-nous en une phrase ce que vous voulez voir pendant la démo (${NEED_MIN} caractères au moins).`;
  else if (f.need.length > NEED_MAX) e.need = `Votre texte dépasse ${NEED_MAX.toLocaleString('fr-FR')} caractères : raccourcissez-le.`;
  if (f.slots.length > MAX_SLOTS) e.slots = `${MAX_SLOTS} créneaux au plus.`;
  else {
    const bad = f.slots.map((s) => slotError(s, now)).find(Boolean);
    if (bad) e.slots = bad;
    else if (new Set(f.slots.map((s) => `${s.date}|${s.period}`)).size !== f.slots.length) e.slots = 'Le même créneau est indiqué deux fois.';
  }
  if (f.otherTimes.length > 300) e.otherTimes = 'Ce texte dépasse 300 caractères.';
  if (!e.slots && f.slots.length === 0 && !f.otherTimes.trim()) e.slots = 'Proposez au moins un créneau, ou décrivez vos disponibilités.';
  if (!f.name.trim()) e.name = 'Indiquez votre nom.';
  else if (f.name.length > 120) e.name = 'Votre nom dépasse 120 caractères.';
  if (!EMAIL_RE.test(f.email.trim()) || f.email.length > 200) e.email = 'Cette adresse e-mail semble incomplète. Vérifiez-la, par exemple vous@exemple.fr.';
  if (f.phone.trim() && !PHONE_RE.test(f.phone.trim())) e.phone = 'Ce numéro semble incomplet (chiffres, espaces, + et tirets).';
  if (f.consent !== true) e.consent = 'Cochez la case pour que nous puissions vous recontacter.';
  return e;
}

export function meetingFieldsFrom(body: unknown): MeetingFields {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const s = (k: string) => (typeof b[k] === 'string' ? (b[k] as string) : '');
  const offer = s('offer');
  const segment = s('segment');
  const rawSlots = Array.isArray(b.slots) ? b.slots.slice(0, MAX_SLOTS + 1) : [];
  const slots: Slot[] = rawSlots
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
    .map((x) => ({ date: typeof x.date === 'string' ? x.date.slice(0, 10) : '', period: (isSlotPeriod(x.period) ? x.period : '') as SlotPeriod }))
    .filter((x) => x.date !== '');
  return {
    offer: isMeetingOffer(offer) ? offer : '',
    segment: isMeetingSegment(segment) ? segment : '',
    company: s('company'),
    website: s('website'),
    size: s('size').slice(0, 20),
    need: s('need'),
    slots,
    otherTimes: s('otherTimes'),
    name: s('name'),
    email: s('email'),
    phone: s('phone'),
    consent: b.consent === true,
  };
}

/** « mardi 2 décembre, matin » */
export function slotLabel(s: Slot): string {
  const d = new Date(`${s.date}T12:00:00Z`);
  const day = Number.isFinite(d.getTime()) ? d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }) : s.date;
  return `${day}, ${s.period === 'matin' ? 'matin' : 'après-midi'}`;
}
