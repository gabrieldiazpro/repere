/**
 * Fiche de vérité (docs/v2/06-indispensable.md § 5) : faits de référence saisis et validés par le client.
 * Collection `facts.brand` (id = businessId). Le contrôle d'exactitude du dernier audit est rangé dans
 * `facts.checks` (id = businessId) et relancé à chaque sauvegarde.
 *
 * Le contrôle utilise `factCheck` exporté par '@/lib/engine' s'il existe, sinon l'adaptateur local
 * `localFactCheck` (comparaison tolérante : formats de téléphone, domaines, montants).
 */
import { houseFacts, isHouseBusinessId } from './house';
import { z } from 'zod';
import * as engine from '@/lib/engine';
import type { AuditResult, ProviderId } from '@/lib/engine';
import type {
  AuditResultV2Ext,
  BrandClaim,
  BrandFactField,
  BrandFacts,
  FactCheckItem,
  FactCheckReport,
} from '@/lib/engine/types-v2';
import { getDoc, putDoc } from '@/lib/store';
import { getLatestAuditForBusiness } from '@/lib/db';
import { buildDemoWorkspaceById } from '@/lib/demo-v2';

export const FACTS_COLLECTION = 'facts.brand';
export const FACT_CHECKS_COLLECTION = 'facts.checks';

export const FACT_FIELDS: readonly BrandFactField[] = [
  'adresse',
  'telephone',
  'horaires',
  'prix',
  'zone',
  'services',
  'dirigeant',
  'creation',
  'site',
  'statut',
  'produits',
  'livraison',
  'clients',
];

export const FACT_LABELS: Record<BrandFactField, string> = {
  adresse: 'Adresse',
  telephone: 'Téléphone',
  horaires: "Horaires d'ouverture",
  prix: 'Prix',
  zone: "Zone d'intervention / de livraison",
  services: 'Services',
  dirigeant: 'Dirigeant',
  creation: 'Année de création',
  site: 'Site web',
  statut: 'Statut (ouvert, fermé…)',
  produits: 'Produits',
  livraison: 'Livraison',
  clients: 'Clients / références',
  retours: 'Retours et remboursements',
  ingredients: 'Ingrédients / composition (INCI)',
  certifications: 'Labels et certifications',
};

// ---------------------------------------------------------------------------
// Validation (zod, message par champ)
// ---------------------------------------------------------------------------

const text = (max: number) =>
  z
    .string({ error: 'Texte attendu.' })
    .trim()
    .max(max, { error: `${max} caractères au maximum.` });

const PHONE_RE = /^[+()\d][\d\s().+-]{5,24}$/;
const SITE_RE = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/[^\s]*)?$/i;

/** Chaîne vide = effacer le champ. */
export const FactsInput = z
  .object({
    adresse: text(200).refine((v) => v === '' || (/[a-zà-ÿ]{3,}/i.test(v) && /\b\d{5}\b/.test(v)), {
      error: 'Adresse attendue avec un code postal à 5 chiffres (ex. 12 rue Oberkampf, 75011 Paris).',
    }),
    telephone: text(30).refine((v) => v === '' || (PHONE_RE.test(v) && v.replace(/\D/g, '').length >= 6), {
      error: 'Numéro de téléphone invalide.',
    }),
    horaires: text(300),
    prix: text(300),
    zone: text(200),
    services: text(500),
    dirigeant: text(120),
    creation: text(20).refine((v) => v === '' || /^(1[89]\d\d|20\d\d)(-\d\d(-\d\d)?)?$/.test(v), {
      error: 'Année attendue (ex. 2009).',
    }),
    site: text(200).refine((v) => v === '' || SITE_RE.test(v), { error: 'Adresse de site invalide (ex. mon-site.fr).' }),
    statut: text(80),
    produits: text(500),
    livraison: text(300),
    clients: text(300),
    retours: text(300),
    ingredients: text(1000),
    certifications: text(300),
  })
  .partial()
  .strict();

export type FactsPatch = z.infer<typeof FactsInput>;

/** Valide un patch ; renvoie les erreurs par champ (`{ telephone: 'Numéro…' }`). */
export function validateFacts(
  input: unknown,
): { ok: true; data: FactsPatch } | { ok: false; errors: Record<string, string> } {
  const r = FactsInput.safeParse(input);
  if (r.success) return { ok: true, data: r.data };
  const errors: Record<string, string> = {};
  for (const issue of r.error.issues) {
    if (issue.code === 'unrecognized_keys') {
      for (const k of issue.keys) errors[k] = 'Champ inconnu.';
      continue;
    }
    const k = String(issue.path[0] ?? '_');
    errors[k] ??= issue.message;
  }
  return { ok: false, errors };
}

// ---------------------------------------------------------------------------
// Lecture / écriture
// ---------------------------------------------------------------------------

export async function getFacts(businessId: string): Promise<BrandFacts> {
  const doc = await getDoc<BrandFacts>(FACTS_COLLECTION, businessId);
  if (doc) return doc.data;
  const demo = buildDemoWorkspaceById(businessId);
  if (demo) return demo.facts;
  if (isHouseBusinessId(businessId)) return houseFacts();
  return { businessId, facts: {}, updatedAt: '' };
}

/**
 * Fusionne `patch` dans la fiche (valeur vide = champ supprimé) ; `replace` remplace toute la fiche.
 * Lève une erreur `FactsValidationError` si le patch est invalide.
 */
export async function saveFacts(
  businessId: string,
  patch: unknown,
  opts: { replace?: boolean } = {},
): Promise<BrandFacts> {
  const v = validateFacts(patch);
  if (!v.ok) throw new FactsValidationError(v.errors);
  const prev = opts.replace ? { businessId, facts: {}, updatedAt: '' } : await getFacts(businessId);
  const facts: BrandFacts['facts'] = { ...prev.facts };
  for (const [k, val] of Object.entries(v.data) as [BrandFactField, string | undefined][]) {
    if (val === undefined) continue;
    if (val === '') delete facts[k];
    else facts[k] = val;
  }
  const next: BrandFacts = { businessId, facts, updatedAt: new Date().toISOString() };
  await putDoc(FACTS_COLLECTION, businessId, next, businessId);
  return next;
}

export class FactsValidationError extends Error {
  constructor(public readonly errors: Record<string, string>) {
    super('Fiche de vérité invalide.');
  }
}

/** Nombre de faits renseignés (activation : ≥ 5). */
export function filledFactsCount(f: BrandFacts): number {
  return Object.values(f.facts).filter((v) => typeof v === 'string' && v.trim()).length;
}

// ---------------------------------------------------------------------------
// Contrôle d'exactitude
// ---------------------------------------------------------------------------

type FactCheckFn = (result: AuditResult & AuditResultV2Ext, facts: BrandFacts) => FactCheckReport;

const strip = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

const digits = (s: string) => {
  let d = s.replace(/\D/g, '');
  if (d.startsWith('33') && d.length === 11) d = `0${d.slice(2)}`;
  return d;
};

const domainOf = (s: string) =>
  strip(s)
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split(/[/\s?#]/)[0];

const tokens = (s: string) =>
  new Set(
    strip(s)
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' ')
      .filter((t) => t.length >= 3 || /^\d+$/.test(t)),
  );

const numbers = (s: string) => (strip(s).replace(/(\d)[\s.](\d{3})/g, '$1$2').match(/\d+(?:[,.]\d+)?/g) ?? []).map((n) => n.replace(',', '.'));

const HIGH: BrandFactField[] = ['telephone', 'adresse', 'statut', 'horaires', 'prix'];
const MEDIUM: BrandFactField[] = ['site', 'services', 'zone', 'livraison', 'produits'];

function severityOf(field: BrandFactField): FactCheckItem['severity'] {
  return HIGH.includes(field) ? 'haute' : MEDIUM.includes(field) ? 'moyenne' : 'basse';
}

/** Compare une affirmation d'IA à la valeur de référence. */
export function compareFact(field: BrandFactField, expected: string, stated: string): FactCheckItem['verdict'] {
  if (!stated.trim()) return 'non_verifiable';
  if (field === 'telephone') {
    const a = digits(expected);
    const b = digits(stated);
    if (!b) return 'non_verifiable';
    return a === b || a.endsWith(b) || b.endsWith(a) ? 'correct' : 'faux';
  }
  if (field === 'site') return domainOf(expected) === domainOf(stated) ? 'correct' : 'faux';
  if (field === 'statut') {
    const closed = (s: string) => /ferm|cesse|liquid|n'existe plus/.test(strip(s));
    return closed(expected) === closed(stated) ? 'correct' : 'faux';
  }
  const ne = numbers(expected);
  const ns = numbers(stated);
  if (ns.length && ne.length) {
    const shared = ns.filter((n) => ne.includes(n)).length;
    if (shared === 0) return 'faux';
    if (shared < ns.length) return field === 'prix' || field === 'horaires' || field === 'adresse' ? 'faux' : 'incomplet';
  }
  const te = tokens(expected);
  const ts = tokens(stated);
  if (!ts.size) return 'non_verifiable';
  let common = 0;
  for (const t of ts) if (te.has(t)) common++;
  const ratio = common / ts.size;
  if (ratio >= 0.6) return 'correct';
  if (ratio >= 0.25) return 'incomplet';
  return ne.length && ns.length ? 'faux' : 'non_verifiable';
}

/** Adaptateur local du contrôle d'exactitude (utilisé si '@/lib/engine' n'exporte pas `factCheck`). */
export function localFactCheck(result: AuditResult & AuditResultV2Ext, facts: BrandFacts): FactCheckReport {
  const items: FactCheckItem[] = [];
  const claims: BrandClaim[] = result.perception?.claims ?? [];
  for (const c of claims) {
    if (c.field === 'autre') continue;
    const expected = facts.facts[c.field];
    if (!expected) continue;
    const verdict = compareFact(c.field, expected, c.value);
    items.push({
      field: c.field,
      expected,
      stated: c.value,
      provider: c.provider as ProviderId,
      quote: c.quote,
      verdict,
      severity: verdict === 'faux' ? severityOf(c.field) : 'basse',
    });
  }
  return { checkedAt: new Date().toISOString(), items, errors: items.filter((i) => i.verdict === 'faux').length };
}

/** `factCheck` du moteur s'il est exporté, sinon l'adaptateur local. */
export function resolveFactCheck(): FactCheckFn {
  const fn = (engine as unknown as { factCheck?: FactCheckFn }).factCheck;
  return typeof fn === 'function' ? fn : localFactCheck;
}

export function runFactCheck(result: AuditResult & AuditResultV2Ext, facts: BrandFacts): FactCheckReport {
  try {
    return resolveFactCheck()(result, facts);
  } catch (e) {
    console.warn('[facts] factCheck du moteur en erreur, adaptateur local utilisé', e);
    return localFactCheck(result, facts);
  }
}

export interface StoredFactCheck {
  businessId: string;
  auditId: string;
  report: FactCheckReport;
}

/**
 * E-commerce : erreurs de prix citées par les IA (src/lib/ecommerce, `priceReport().factItems`, champ « prix »)
 * fusionnées dans la vérification des faits. Sans LLM (règles seules), sans doublon, jamais bloquant.
 */
export async function withPriceFacts(businessId: string, audit: (AuditResult & AuditResultV2Ext) | null, report: FactCheckReport): Promise<FactCheckReport> {
  if (!audit || audit.segment !== 'ecommerce') return report;
  try {
    const { getBusinessRecord } = await import('@/lib/db');
    const b = await getBusinessRecord(businessId);
    if (!b) return report;
    const { priceReport } = await import('@/lib/ecommerce');
    const extra = (await priceReport(b, { llm: false })).factItems;
    const key = (i: FactCheckItem) => `${i.field}|${i.provider}|${i.stated}`;
    const seen = new Set(report.items.map(key));
    const items = [...report.items, ...extra.filter((i) => !seen.has(key(i)))];
    return { ...report, items, errors: items.filter((i) => i.verdict === 'faux').length };
  } catch (e) {
    console.warn('[facts] erreurs de prix non fusionnées', e instanceof Error ? e.message : e);
    return report;
  }
}

/** Relance le contrôle d'exactitude du dernier audit avec la fiche courante et le range dans `facts.checks`. */
export async function refreshFactCheck(businessId: string, facts?: BrandFacts): Promise<StoredFactCheck | null> {
  const audit = (await getLatestAuditForBusiness(businessId)) as (AuditResult & AuditResultV2Ext) | null;
  if (!audit) return null;
  const f = facts ?? (await getFacts(businessId));
  const report = await withPriceFacts(businessId, audit, runFactCheck(audit, f));
  const stored: StoredFactCheck = { businessId, auditId: audit.id, report };
  await putDoc(FACT_CHECKS_COLLECTION, businessId, stored, businessId);
  return stored;
}

/** Dernier contrôle connu : celui rangé après sauvegarde, sinon celui de l'audit, sinon calculé à la volée. */
export async function getLatestFactCheck(businessId: string): Promise<StoredFactCheck | null> {
  const doc = await getDoc<StoredFactCheck>(FACT_CHECKS_COLLECTION, businessId);
  const audit = (await getLatestAuditForBusiness(businessId)) as (AuditResult & AuditResultV2Ext) | null;
  if (doc && (!audit || doc.data.auditId === audit.id)) return doc.data;
  if (!audit) return null;
  if (audit.factCheck) return { businessId, auditId: audit.id, report: await withPriceFacts(businessId, audit, audit.factCheck) };
  return { businessId, auditId: audit.id, report: await withPriceFacts(businessId, audit, runFactCheck(audit, await getFacts(businessId))) };
}
