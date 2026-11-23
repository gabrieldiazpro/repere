/**
 * Fiche officielle — modèle pur (sans E/S) : libellés, validation, migration depuis les anciennes fiches, miroir vers
 * elles, vue publique, rappel de vérification.
 */
import type { BrandFactField, Segment } from '@/lib/engine/types-v2';
import { splitList } from '../util';
import {
  FicheError,
  TEXT_KEYS,
  isTextKey,
  type Credential,
  type FactSource,
  type FicheActor,
  type FichePatch,
  type HoursException,
  type ListFact,
  type OfficialFiche,
  type ServiceItem,
  type TextFact,
  type TextKey,
} from './types';

export const FICHE_COLLECTION = 'fiche.official';
/** Rappel « vérifiez votre fiche » : tous les 90 jours. */
export const REVERIFY_DAYS = 90;

export { FICHE_FIELDS, ESSENTIAL, type FieldDef } from './labels';
import { FICHE_FIELDS, ESSENTIAL } from './labels';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
const PHONE_RE = /^[+()\d][\d\s().+-]{5,24}$/;
const SITE_RE = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/[^\s]*)?$/i;
const EMAIL_RE = /^[^\s@<>"]{1,64}@[a-z0-9.-]+\.[a-z]{2,}$/i;
const HTTPS_RE = /^https:\/\/[^\s<>"]{3,300}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function cleanText(v: unknown, max: number): string {
  return String(v ?? '')
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

export function validateText(key: TextKey, v: string): string | null {
  if (!v) return null;
  if (key === 'telephone' && !(PHONE_RE.test(v) && v.replace(/\D/g, '').length >= 6)) return 'Numéro de téléphone invalide.';
  if (key === 'adresse' && !(/[a-zà-ÿ]{3,}/i.test(v) && /\b\d{5}\b/.test(v))) return 'Adresse attendue avec un code postal à 5 chiffres (ex. 12 rue Oberkampf, 75011 Paris).';
  if (key === 'site' && !SITE_RE.test(v)) return 'Adresse de site invalide (ex. mon-site.fr).';
  if (key === 'email' && !EMAIL_RE.test(v)) return 'Adresse e-mail invalide.';
  if (key === 'creation' && !/^(1[89]\d\d|20\d\d)$/.test(v)) return 'Année attendue (ex. 2009).';
  return null;
}

const validDate = (s: string) => DATE_RE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

/** Valide et nettoie une saisie. Lève FicheError(400) avec les erreurs par champ. */
export function sanitizePatch(input: unknown): FichePatch {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new FicheError(400, 'Requête invalide.', 'invalid');
  const o = input as Record<string, unknown>;
  const errors: Record<string, string> = {};
  const out: FichePatch = {};
  if (o.text !== undefined) {
    if (!o.text || typeof o.text !== 'object' || Array.isArray(o.text)) throw new FicheError(400, 'Requête invalide.', 'invalid');
    out.text = {};
    for (const [k, raw] of Object.entries(o.text as Record<string, unknown>)) {
      if (!isTextKey(k)) {
        errors[k] = 'Champ inconnu.';
        continue;
      }
      const v = cleanText(raw, FICHE_FIELDS[k].max);
      const err = validateText(k, v);
      if (err) errors[k] = err;
      else out.text[k] = v;
    }
  }
  const arr = (k: string, max: number): unknown[] | undefined => {
    const v = o[k];
    if (v === undefined) return undefined;
    if (!Array.isArray(v)) {
      errors[k] = 'Liste attendue.';
      return undefined;
    }
    if (v.length > max) errors[k] = `${max} éléments au maximum.`;
    return v.slice(0, max);
  };
  const services = arr('services', 30);
  if (services) {
    out.services = [];
    services.forEach((s, i) => {
      const r = (s && typeof s === 'object' ? s : {}) as Record<string, unknown>;
      const name = cleanText(r.name, 160);
      if (!name) return;
      const item: ServiceItem = { name };
      if (r.priceFrom !== undefined && r.priceFrom !== null && r.priceFrom !== '') {
        const p = typeof r.priceFrom === 'number' ? r.priceFrom : Number(String(r.priceFrom).replace(',', '.').replace(/\s/g, ''));
        if (!Number.isFinite(p) || p < 0 || p > 1_000_000) errors[`services.${i}`] = 'Prix « à partir de » invalide.';
        else item.priceFrom = Math.round(p * 100) / 100;
      }
      const unit = cleanText(r.unit, 40);
      if (unit) item.unit = unit;
      out.services!.push(item);
    });
  }
  const certs = arr('certifications', 20);
  if (certs) {
    out.certifications = [];
    certs.forEach((c, i) => {
      const r = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>;
      const name = cleanText(r.name, 160);
      if (!name) return;
      const item: Credential = { name };
      const number = cleanText(r.number, 60);
      if (number) item.number = number;
      const issuer = cleanText(r.issuer, 120);
      if (issuer) item.issuer = issuer;
      const url = cleanText(r.verifyUrl, 300);
      if (url) {
        if (!HTTPS_RE.test(url)) errors[`certifications.${i}`] = 'Lien de vérification attendu en https://';
        else item.verifyUrl = url;
      }
      out.certifications!.push(item);
    });
  }
  const exc = arr('exceptions', 40);
  if (exc) {
    out.exceptions = [];
    exc.forEach((e, i) => {
      const r = (e && typeof e === 'object' ? e : {}) as Record<string, unknown>;
      const from = cleanText(r.from, 10);
      if (!from) return;
      const to = cleanText(r.to, 10);
      const closed = r.closed !== false;
      const opens = cleanText(r.opens, 5);
      const closes = cleanText(r.closes, 5);
      if (!validDate(from) || (to && (!validDate(to) || to < from))) {
        errors[`exceptions.${i}`] = 'Dates attendues au format AAAA-MM-JJ (fin après début).';
        return;
      }
      if (!closed && !(TIME_RE.test(opens) && TIME_RE.test(closes))) {
        errors[`exceptions.${i}`] = 'Heures attendues au format HH:MM.';
        return;
      }
      const item: HoursException = { from, closed };
      if (to && to !== from) item.to = to;
      if (!closed) Object.assign(item, { opens, closes });
      const label = cleanText(r.label, 80);
      if (label) item.label = label;
      out.exceptions!.push(item);
    });
    out.exceptions.sort((a, b) => a.from.localeCompare(b.from));
  }
  const same = arr('sameAs', 12);
  if (same) {
    out.sameAs = [];
    same.forEach((u, i) => {
      const v = cleanText(u, 300);
      if (!v) return;
      if (!HTTPS_RE.test(v)) errors[`sameAs.${i}`] = 'Lien attendu en https://';
      else if (!out.sameAs!.includes(v)) out.sameAs!.push(v);
    });
  }
  if (o.accept !== undefined) {
    if (!Array.isArray(o.accept)) errors.accept = 'Liste attendue.';
    else
      out.accept = o.accept.slice(0, 30).flatMap((a) => {
        const r = (a && typeof a === 'object' ? a : {}) as Record<string, unknown>;
        if (!isTextKey(r.key) || (r.source !== 'site' && r.source !== 'google' && r.source !== 'client')) return [];
        const v = cleanText(r.value, FICHE_FIELDS[r.key].max);
        if (!v || validateText(r.key, v)) return [];
        return [{ key: r.key, value: v, source: r.source as FactSource }];
      });
  }
  if (Object.keys(errors).length) throw new FicheError(400, 'Certains champs sont invalides.', 'invalid', errors);
  return out;
}

// ---------------------------------------------------------------------------
// Services et labels ↔ texte (anciennes fiches)
// ---------------------------------------------------------------------------
const fmtPrice = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ','));
export const priceLabel = (s: ServiceItem) => (typeof s.priceFrom === 'number' ? `à partir de ${fmtPrice(s.priceFrom)} €${s.unit ? ` ${s.unit}` : ''}` : '');

export function serviceLine(s: ServiceItem): string {
  const p = priceLabel(s);
  return p ? `${s.name} : ${p}` : s.name;
}

/** « Recherche de fuite : à partir de 120 € TTC » → { name, priceFrom: 120, unit: 'TTC' }. */
export function parseServiceLine(line: string): ServiceItem | null {
  const t = line.replace(/^[-–*•\s]+/, '').trim();
  if (!t) return null;
  const m = t.match(/^(.{2,160}?)\s*[:–—-]\s*(?:à partir de|dès|a partir de)?\s*(\d+(?:[  ]\d{3})*(?:[,.]\d{1,2})?)\s*€\s*(.{0,40})$/i);
  if (m) {
    const price = Number(m[2].replace(/[  ]/g, '').replace(',', '.'));
    const unit = m[3].trim().replace(/^[,;.]\s*/, '');
    return { name: m[1].trim(), priceFrom: price, ...(unit ? { unit } : {}) };
  }
  return { name: t.slice(0, 160) };
}

/** Texte libre (lignes ou liste à virgules) → services. Les lignes avec prix sont lues une par une. */
export function parseServices(text: string | undefined): ServiceItem[] {
  if (!text) return [];
  const lines = text.includes('\n') ? text.split('\n') : /€/.test(text) ? text.split(/;|\n/) : splitList(text);
  return lines
    .map(parseServiceLine)
    .filter((s): s is ServiceItem => !!s)
    .map((s) => ({ ...s, name: s.name.charAt(0).toUpperCase() + s.name.slice(1) }))
    .slice(0, 30);
}

export function credentialLine(c: Credential): string {
  return `${c.name}${c.issuer && !c.name.includes(c.issuer) ? ` (${c.issuer})` : ''}${c.number ? ` n° ${c.number}` : ''}`;
}

/** « RGE Qualibat n° E-12345 ; vegan » → labels. */
export function parseCredentials(text: string | undefined): Credential[] {
  if (!text) return [];
  return text
    .split(/[;\n]/)
    .map((x) => x.replace(/^[-–*•\s]+/, '').trim())
    .filter(Boolean)
    .slice(0, 20)
    .map((x) => {
      const m = x.match(/^(.*?)\s*(?:n°|no\.?|numéro|num\.)\s*([A-Z0-9][A-Z0-9 ./-]{1,40})$/i);
      const url = x.match(/https:\/\/\S+/)?.[0];
      const base = (m ? m[1] : x).replace(/https:\/\/\S+/, '').replace(/[,(]\s*$/, '').trim();
      const iss = base.match(/^(.*?)\s*\(([^)]{2,60})\)$/);
      return {
        name: (iss ? iss[1] : base).slice(0, 160),
        ...(iss ? { issuer: iss[2] } : {}),
        ...(m ? { number: m[2].trim() } : {}),
        ...(url ? { verifyUrl: url } : {}),
      };
    });
}

// ---------------------------------------------------------------------------
// Migration depuis les anciennes fiches (lecture seule de celles-ci)
// ---------------------------------------------------------------------------
export interface LegacySources {
  businessId: string;
  business: { name: string; website?: string; trade?: string };
  /** fiche de vérité (facts.brand) */
  verite?: { facts: Partial<Record<BrandFactField, string>>; updatedAt: string } | null;
  /** faits clés de l'agent de contenu (content.facts) */
  contenu?: { facts: Partial<Record<string, string>>; updatedAt: string } | null;
  /** réglages d'exécution (exec.settings) : profils officiels */
  settings?: { sameAs?: string[]; updatedAt?: string } | null;
}

/** Fiche de vérité → clés de la fiche officielle. */
const FROM_VERITE: Partial<Record<BrandFactField, TextKey>> = {
  adresse: 'adresse',
  telephone: 'telephone',
  horaires: 'horaires',
  prix: 'prix',
  zone: 'zone',
  dirigeant: 'dirigeant',
  creation: 'creation',
  site: 'site',
  statut: 'statut',
  produits: 'produits',
  livraison: 'livraison',
  clients: 'clients',
  retours: 'retours',
  ingredients: 'ingredients',
};
/** Faits clés (agent de contenu) → clés de la fiche officielle (services et labels traités à part). */
const FROM_CONTENU: Record<string, TextKey> = {
  activite: 'activite',
  zone: 'zone',
  adresse: 'adresse',
  telephone: 'telephone',
  email: 'email',
  horaires: 'horaires',
  prix: 'prix',
  delais: 'delais',
  garanties: 'garanties',
  paiement: 'paiement',
  creation: 'creation',
  dirigeant: 'dirigeant',
  equipe: 'equipe',
  histoire: 'histoire',
  difference: 'difference',
  clients: 'clients',
  livraison: 'livraison',
  retours: 'retours',
  avis: 'avis',
};

const EPOCH = '1970-01-01T00:00:00.000Z';
const at = (s: string | undefined) => (s && !Number.isNaN(Date.parse(s)) ? s : EPOCH);

export function emptyFiche(businessId: string, now: string): OfficialFiche {
  return { businessId, version: 1, text: {}, publication: { indexable: false, embedJsonLd: false }, updatedAt: now };
}

/**
 * Construit la fiche à partir des anciennes collections. Priorité : faits clés de l'agent de contenu > fiche de vérité
 * (même règle qu'avant, « la saisie des faits clés prime ») > fiche du commerce (nom, site). Les valeurs reprises sont
 * « saisies par le client » mais pas encore « vérifiées » dans la fiche officielle.
 */
export function migrateFromLegacy(src: LegacySources, now = new Date().toISOString()): OfficialFiche {
  const f = emptyFiche(src.businessId, now);
  const from: string[] = [];
  const put = (k: TextKey, v: string | undefined, when: string, origin: string) => {
    const value = cleanText(v, FICHE_FIELDS[k].max);
    if (!value) return;
    f.text[k] = { value, source: 'client', at: at(when), verified: false, from: origin };
  };
  if (src.business.name) put('nom', src.business.name, src.verite?.updatedAt || EPOCH, 'business');
  if (src.business.website) put('site', src.business.website, src.verite?.updatedAt || EPOCH, 'business');
  if (src.verite) {
    from.push('facts.brand');
    for (const [field, key] of Object.entries(FROM_VERITE) as [BrandFactField, TextKey][]) put(key, src.verite.facts[field], src.verite.updatedAt, 'facts.brand');
    const services = parseServices(src.verite.facts.services);
    if (services.length) f.services = { value: services, source: 'client', at: at(src.verite.updatedAt), verified: false, from: 'facts.brand' };
    const certs = parseCredentials(src.verite.facts.certifications);
    if (certs.length) f.certifications = { value: certs, source: 'client', at: at(src.verite.updatedAt), verified: false, from: 'facts.brand' };
  }
  if (src.contenu) {
    from.push('content.facts');
    for (const [k, key] of Object.entries(FROM_CONTENU)) put(key, src.contenu.facts[k], src.contenu.updatedAt, 'content.facts');
    const services = parseServices(src.contenu.facts.services);
    if (services.length) f.services = { value: services, source: 'client', at: at(src.contenu.updatedAt), verified: false, from: 'content.facts' };
    const certs = parseCredentials(src.contenu.facts.certifications);
    if (certs.length) f.certifications = { value: certs, source: 'client', at: at(src.contenu.updatedAt), verified: false, from: 'content.facts' };
  }
  const sameAs = (src.settings?.sameAs ?? []).filter((u) => HTTPS_RE.test(u));
  if (sameAs.length) {
    from.push('exec.settings');
    f.sameAs = { value: [...new Set(sameAs)], source: 'client', at: at(src.settings?.updatedAt), verified: false, from: 'exec.settings' };
  }
  f.migratedFrom = from;
  return f;
}

/**
 * Reprend dans la fiche les changements faits depuis dans les anciens écrans (/app/verite, /app/contenu/faits) :
 * une valeur différente et PLUS RÉCENTE que le fait de la fiche la remplace (non vérifiée). Rien n'est jamais effacé.
 */
export function syncFromLegacy(fiche: OfficialFiche, src: LegacySources): { fiche: OfficialFiche; changed: string[] } {
  const fresh = migrateFromLegacy(src, fiche.updatedAt);
  const changed: string[] = [];
  const text = { ...fiche.text };
  for (const k of TEXT_KEYS) {
    const n = fresh.text[k];
    const o = text[k];
    if (!n || n.from === 'business') continue;
    if (!o) {
      // Absent de la fiche : repris seulement si saisi ailleurs APRÈS la dernière mise à jour (sinon : effacé exprès).
      if (n.at <= fiche.updatedAt) continue;
      text[k] = n;
      changed.push(k);
    } else if (norm(o.value) !== norm(n.value) && n.at > o.at) {
      text[k] = n;
      changed.push(k);
    }
  }
  const out: OfficialFiche = { ...fiche, text };
  for (const k of ['services', 'certifications'] as const) {
    const n = fresh[k] as ListFact<ServiceItem | Credential> | undefined;
    const o = fiche[k] as ListFact<ServiceItem | Credential> | undefined;
    if (!n) continue;
    const line = (x: ServiceItem | Credential) => (k === 'services' ? serviceLine(x as ServiceItem) : credentialLine(x as Credential));
    if ((!o && n.at > fiche.updatedAt) || (o && n.at > o.at && norm(n.value.map(line).join('|')) !== norm(o.value.map(line).join('|')))) {
      (out as unknown as Record<string, unknown>)[k] = n;
      changed.push(k);
    }
  }
  if (fresh.sameAs && ((!fiche.sameAs && fresh.sameAs.at > fiche.updatedAt) || (fiche.sameAs && fresh.sameAs.at > fiche.sameAs.at && fresh.sameAs.value.join('|') !== fiche.sameAs.value.join('|')))) {
    out.sameAs = fresh.sameAs;
    changed.push('sameAs');
  }
  return { fiche: out, changed };
}

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9€]+/g, ' ')
    .trim();

// ---------------------------------------------------------------------------
// Saisie → fiche
// ---------------------------------------------------------------------------
export function applyPatch(prev: OfficialFiche, patch: FichePatch, actor: FicheActor, now = new Date().toISOString()): OfficialFiche {
  const next: OfficialFiche = { ...prev, text: { ...prev.text }, updatedAt: now };
  const mine = (): Omit<TextFact, 'value'> => ({ source: 'client', at: now, verified: true, verifiedAt: now });
  for (const [k, v] of Object.entries(patch.text ?? {}) as [TextKey, string][]) {
    if (!v) delete next.text[k];
    else if (prev.text[k]?.value === v && prev.text[k]?.verified) continue;
    else next.text[k] = { value: v, ...mine() };
  }
  for (const a of patch.accept ?? []) next.text[a.key] = { value: a.value, source: a.source, at: prev.text[a.key]?.value === a.value ? prev.text[a.key]!.at : now, verified: true, verifiedAt: now };
  const list = <T,>(k: 'services' | 'certifications' | 'exceptions' | 'sameAs', v: T[] | undefined) => {
    if (v === undefined) return;
    if (!v.length) delete (next as unknown as Record<string, unknown>)[k];
    else (next as unknown as Record<string, unknown>)[k] = { value: v, ...mine() } satisfies ListFact<T>;
  };
  list('services', patch.services);
  list('certifications', patch.certifications);
  list('exceptions', patch.exceptions);
  list('sameAs', patch.sameAs);
  void actor;
  return next;
}

/** « Je confirme que c'est à jour » : chaque fait affiché devient vérifié, la date de vérification est posée. */
export function confirmFiche(prev: OfficialFiche, actor: FicheActor, now = new Date().toISOString()): OfficialFiche {
  const text: OfficialFiche['text'] = {};
  for (const [k, f] of Object.entries(prev.text) as [TextKey, TextFact][]) text[k] = { ...f, verified: true, verifiedAt: now };
  const lists: Partial<OfficialFiche> = {};
  for (const k of ['services', 'certifications', 'exceptions', 'sameAs'] as const) {
    const l = prev[k];
    if (l) (lists as Record<string, unknown>)[k] = { ...l, verified: true, verifiedAt: now };
  }
  return { ...prev, ...lists, text, confirmedAt: now, confirmedBy: actor.email ?? actor.id, updatedAt: now };
}

// ---------------------------------------------------------------------------
// Vue publique : seulement ce que le client a saisi ou confirmé
// ---------------------------------------------------------------------------
export interface PublicFiche {
  businessId: string;
  text: Partial<Record<TextKey, string>>;
  services: ServiceItem[];
  certifications: Credential[];
  exceptions: HoursException[];
  sameAs: string[];
  /** dernière vérification par le client (null = jamais confirmée) */
  confirmedAt: string | null;
  /** date de la dernière mise à jour d'un fait publié */
  updatedAt: string | null;
  demo: boolean;
}

const publishable = (f: { source: FactSource; verified: boolean } | undefined) => !!f && (f.source === 'client' || f.verified);

/** Exceptions encore utiles (fin ≥ aujourd'hui), 10 au plus. */
export function upcomingExceptions(list: HoursException[], now = new Date()): HoursException[] {
  const today = now.toISOString().slice(0, 10);
  return list.filter((e) => (e.to ?? e.from) >= today).slice(0, 10);
}

export function publicView(fiche: OfficialFiche, now = new Date()): PublicFiche {
  const text: PublicFiche['text'] = {};
  const dates: string[] = [];
  for (const [k, f] of Object.entries(fiche.text) as [TextKey, TextFact][]) {
    if (!publishable(f)) continue;
    text[k] = f.value;
    dates.push(f.verifiedAt ?? f.at);
  }
  const list = <T,>(l: ListFact<T> | undefined): T[] => {
    if (!publishable(l)) return [];
    dates.push(l!.verifiedAt ?? l!.at);
    return l!.value;
  };
  const updated = dates.filter((d) => d > EPOCH).sort().pop() ?? null;
  return {
    businessId: fiche.businessId,
    text,
    services: list(fiche.services),
    certifications: list(fiche.certifications),
    exceptions: upcomingExceptions(list(fiche.exceptions), now),
    sameAs: list(fiche.sameAs),
    confirmedAt: fiche.confirmedAt ?? null,
    updatedAt: updated,
    demo: !!fiche.demo,
  };
}

/** Vue publique → faits « à plat » de la fiche de vérité (FAQ, balisage, tâches). */
export function toFactsMap(p: PublicFiche): Partial<Record<BrandFactField, string>> {
  const t = p.text;
  const out: Partial<Record<BrandFactField, string>> = {};
  for (const [field, key] of Object.entries(FROM_VERITE) as [BrandFactField, TextKey][]) if (t[key]) out[field] = t[key];
  if (p.services.length) out.services = p.services.map((s) => s.name).join(', ');
  if (p.certifications.length) out.certifications = p.certifications.map(credentialLine).join(' ; ');
  return out;
}

// ---------------------------------------------------------------------------
// Miroir vers les anciennes fiches (une seule source, des écrans qui restent justes)
// ---------------------------------------------------------------------------
/** Patch pour la fiche de vérité (`saveFacts`, champs vides = effacés). Seuls les champs touchés par la saisie. */
export function veritePatch(fiche: OfficialFiche, touched: Set<string>): Record<string, string> {
  const out: Record<string, string> = {};
  const MAX: Partial<Record<BrandFactField, number>> = { prix: 300, zone: 200, horaires: 300, livraison: 300, clients: 300, retours: 300 };
  for (const [field, key] of Object.entries(FROM_VERITE) as [BrandFactField, TextKey][]) if (touched.has(key)) out[field] = (fiche.text[key]?.value ?? '').slice(0, MAX[field] ?? 1000);
  if (touched.has('services')) out.services = (fiche.services?.value ?? []).map((s) => s.name).join(', ').slice(0, 500);
  if (touched.has('certifications')) out.certifications = (fiche.certifications?.value ?? []).map(credentialLine).join(' ; ').slice(0, 300);
  return out;
}

/** Faits clés complets pour l'agent de contenu (`content.facts`, remplacés en bloc). */
export function contenuFacts(fiche: OfficialFiche, previous: Partial<Record<string, string>> = {}): Record<string, string> {
  const out: Record<string, string> = { ...(previous as Record<string, string>) };
  for (const [k, key] of Object.entries(FROM_CONTENU)) {
    const v = fiche.text[key]?.value;
    if (v) out[k] = v;
    else delete out[k];
  }
  const services = fiche.services?.value ?? [];
  if (services.length) out.services = services.map(serviceLine).join('\n');
  else delete out.services;
  const certs = fiche.certifications?.value ?? [];
  if (certs.length) out.certifications = certs.map(credentialLine).join('\n');
  else delete out.certifications;
  return out;
}

// ---------------------------------------------------------------------------
// Rappel de vérification (90 jours)
// ---------------------------------------------------------------------------
export function daysSince(iso: string | null | undefined, now = new Date()): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : Math.floor((now.getTime() - t) / 86_400_000);
}

/** Prochaine vérification attendue (null = jamais confirmée : tout de suite). */
export function nextCheckDue(fiche: Pick<OfficialFiche, 'confirmedAt'>): string | null {
  if (!fiche.confirmedAt) return null;
  return new Date(Date.parse(fiche.confirmedAt) + REVERIFY_DAYS * 86_400_000).toISOString();
}

export function reminderDue(fiche: Pick<OfficialFiche, 'confirmedAt' | 'text'>, now = new Date()): boolean {
  if (!Object.keys(fiche.text).length) return false;
  const d = daysSince(fiche.confirmedAt, now);
  return d === null || d >= REVERIFY_DAYS;
}

/** Clé de dédoublonnage du rappel : une notification par période de 90 jours. */
export function reminderKey(fiche: Pick<OfficialFiche, 'confirmedAt'>, now = new Date()): string {
  return `fiche.reverify:${fiche.confirmedAt ? fiche.confirmedAt.slice(0, 10) : `jamais-${now.toISOString().slice(0, 7)}`}`;
}

/** Complétude sur les faits essentiels du parcours (0–1). */
export function completeness(fiche: OfficialFiche, segment: Segment): { filled: number; total: number; verified: number } {
  const keys = ESSENTIAL[segment];
  const filled = keys.filter((k) => fiche.text[k]?.value).length + (fiche.services?.value.length ? 1 : 0);
  const verified = keys.filter((k) => fiche.text[k]?.verified).length + (fiche.services?.verified ? 1 : 0);
  return { filled, total: keys.length + 1, verified };
}
