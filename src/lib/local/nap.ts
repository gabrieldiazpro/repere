/**
 * Audit NAP (nom, adresse, téléphone) sur les annuaires (docs/v3/05-teardown-local.md § 2.4).
 *
 * Statuts : « vérifié » (URL fournie, page lue, nom ou téléphone retrouvés), « déclaré présent » (le client dit y être,
 * sans URL ou page illisible), « absent », « inconnu » (non renseigné). Vérification légère via `safeFetch`
 * (anti-SSRF, robots.txt respecté) : beaucoup d'annuaires bloquent les robots, la page reste alors « déclarée ».
 * Aucune correction automatique.
 */
import { normalizeAddress, normalizePhone, norm } from '@/lib/engine';
import { safeFetch, type SafeResponse } from '@/lib/siteaudit/fetch';
import { sameAddress, sameName, samePhone } from './gbp';
import type { Directory, NapAudit, NapEntryInput, NapIssue, NapRow, NapStatus } from './types';
import { clamp100, newLocalId } from './util';
import { urlMatchesDirectory } from './directories';

export interface NapReference {
  name: string;
  address?: string;
  phone?: string;
  website?: string;
}

export type PageFetcher = (url: string) => Promise<Pick<SafeResponse, 'status' | 'body' | 'contentType'>>;

const defaultFetcher: PageFetcher = (url) => safeFetch(url, { timeoutMs: 6000, maxBytes: 1_500_000 });

export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;|&rsquo;/g, '’')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Numéros de téléphone français trouvés dans un texte (normalisés, 10 chiffres). */
export function phonesIn(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/(?:\+33\s?\(?0?\)?|0033\s?|\b0)[1-9](?:[\s.\-]?\d{2}){4}\b/g)) {
    const n = normalizePhone(m[0]);
    if (n.length === 10) out.add(n);
  }
  return [...out];
}

/** Vérification légère d'une page d'annuaire contre la référence. */
export function checkPage(text: string, ref: NapReference): { name: boolean | null; address: boolean | null; phone: boolean | null; foundPhones: string[] } {
  const t = norm(text);
  const name = ref.name ? t.replace(/[^a-z0-9]/g, '').includes(norm(ref.name).replace(/[^a-z0-9]/g, '')) : null;
  const foundPhones = phonesIn(text);
  const phone = ref.phone ? foundPhones.includes(normalizePhone(ref.phone)) : null;
  let address: boolean | null = null;
  if (ref.address) {
    const a = normalizeAddress(ref.address);
    const streetWords = a.street.split(' ').filter((w) => w.length > 3);
    const hasStreet = streetWords.length ? streetWords.every((w) => t.includes(w)) : false;
    address = hasStreet && (!a.cp || t.includes(a.cp)) && (!a.number || new RegExp(`\\b${a.number}\\b`).test(t));
  }
  return { name, address, phone, foundPhones };
}

function issuesFromListed(d: Directory, ref: NapReference, listed: NonNullable<NapEntryInput['listed']>): NapIssue[] {
  const out: NapIssue[] = [];
  if (listed.name && ref.name && !sameName(ref.name, listed.name))
    out.push({ directoryId: d.id, field: 'name', expected: ref.name, found: listed.name, severity: 'moyenne', message: `Nom différent sur ${d.name}.` });
  if (listed.phone && ref.phone && !samePhone(ref.phone, listed.phone))
    out.push({ directoryId: d.id, field: 'phone', expected: ref.phone, found: listed.phone, severity: 'haute', message: `Téléphone différent sur ${d.name} : un client qui appelle ce numéro ne vous joindra peut-être pas.` });
  if (listed.address && ref.address && !sameAddress(ref.address, listed.address)) {
    const a = normalizeAddress(ref.address);
    const b = normalizeAddress(listed.address);
    const serious = (a.cp && b.cp && a.cp !== b.cp) || (a.number && b.number && a.number !== b.number);
    out.push({ directoryId: d.id, field: 'address', expected: ref.address, found: listed.address, severity: serious ? 'haute' : 'basse', message: serious ? `Adresse différente sur ${d.name}.` : `Adresse écrite autrement sur ${d.name} (abréviation, complément) : harmonisez-la.` });
  }
  return out;
}

const STATUS_FACTOR: Record<NapStatus, number> = { verified: 1, declared: 0.6, absent: 0, unknown: 0 };
const PRIORITY_WEIGHT: Record<Directory['priority'], number> = { 1: 3, 2: 2, 3: 1 };

/** Score /100 : présence pondérée par la priorité de l'annuaire, moins les incohérences. */
export function napScore(rows: NapRow[]): number {
  const total = rows.reduce((n, r) => n + PRIORITY_WEIGHT[r.directory.priority], 0);
  if (!total) return 0;
  const got = rows.reduce((n, r) => {
    const penalty = r.issues.some((i) => i.severity === 'haute') ? 0.5 : r.issues.length ? 0.8 : 1;
    return n + PRIORITY_WEIGHT[r.directory.priority] * STATUS_FACTOR[r.status] * penalty;
  }, 0);
  return clamp100((got / total) * 100);
}

export interface NapAuditOptions {
  businessId: string;
  /** vérifier les URL fournies (réseau) ; défaut true */
  verify?: boolean;
  fetcher?: PageFetcher;
  now?: Date;
  demo?: boolean;
  /** 8 vérifications au maximum par audit */
  maxChecks?: number;
}

export async function auditNap(directories: Directory[], entries: NapEntryInput[], ref: NapReference, opts: NapAuditOptions): Promise<NapAudit> {
  const now = opts.now ?? new Date();
  const fetcher = opts.fetcher ?? defaultFetcher;
  const byId = new Map(entries.map((e) => [e.directoryId, e]));
  let checks = 0;
  const rows: NapRow[] = [];
  for (const d of directories) {
    const e = byId.get(d.id);
    const issues: NapIssue[] = [];
    let status: NapStatus = e?.present === true || e?.url ? 'declared' : e?.present === false ? 'absent' : 'unknown';
    let url: string | undefined;
    let check: NapRow['check'];
    if (e?.url) {
      if (!urlMatchesDirectory(e.url, d)) {
        issues.push({ directoryId: d.id, field: 'url', expected: d.domain, found: e.url.slice(0, 200), severity: 'basse', message: `Le lien fourni n’est pas sur ${d.domain}.` });
      } else {
        url = e.url.slice(0, 500);
        if (opts.verify !== false && checks < (opts.maxChecks ?? 8)) {
          checks++;
          try {
            const res = await fetcher(url);
            if (res.status >= 200 && res.status < 300 && /html|text/.test(res.contentType || 'text/html')) {
              const c = checkPage(htmlToText(res.body), ref);
              const confirmed = c.name === true || c.phone === true;
              check = { fetched: true, name: c.name, address: c.address, phone: c.phone, note: confirmed ? 'Page lue : votre fiche est retrouvée.' : 'Page lue, mais ni votre nom ni votre téléphone n’y figurent : vérifiez le lien.' };
              if (confirmed) status = 'verified';
              if (confirmed && c.phone === false && ref.phone) {
                const other = c.foundPhones[0];
                issues.push({ directoryId: d.id, field: 'phone', expected: ref.phone, found: other ?? 'absent de la page', severity: other ? 'haute' : 'moyenne', message: other ? `Un autre numéro figure sur ${d.name}.` : `Votre téléphone n’apparaît pas sur ${d.name}.` });
              }
              if (confirmed && c.address === false && ref.address)
                issues.push({ directoryId: d.id, field: 'address', expected: ref.address, found: 'différente ou absente', severity: 'moyenne', message: `L’adresse de ${d.name} ne correspond pas exactement à votre fiche de vérité.` });
            } else {
              check = { fetched: false, name: null, address: null, phone: null, note: `Page non lisible (code ${res.status}) : statut laissé « déclaré ».` };
            }
          } catch {
            check = { fetched: false, name: null, address: null, phone: null, note: 'Vérification automatique impossible (site qui bloque les robots ou trop lent) : statut laissé « déclaré ».' };
          }
        }
      }
    }
    if (e?.listed) for (const i of issuesFromListed(d, ref, e.listed)) if (!issues.some((x) => x.field === i.field)) issues.push(i);
    rows.push({ directory: d, status, ...(url ? { url } : {}), ...(check ? { checkedAt: now.toISOString(), check } : {}), issues });
  }
  const issues = rows.flatMap((r) => r.issues);
  const counts = { verified: 0, declared: 0, absent: 0, unknown: 0 } as Record<NapStatus, number>;
  for (const r of rows) counts[r.status]++;
  return {
    id: newLocalId('nap', opts.businessId),
    businessId: opts.businessId,
    reference: ref,
    rows,
    issues,
    score: napScore(rows),
    counts,
    createdAt: now.toISOString(),
    ...(opts.demo ? { demo: true } : {}),
  };
}

/** Entrées du client nettoyées (corps de requête). */
export function parseNapEntries(raw: unknown, directories: Directory[]): NapEntryInput[] {
  const ids = new Set(directories.map((d) => d.id));
  const s = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);
  return (Array.isArray(raw) ? raw : [])
    .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object' && ids.has(String((e as { directoryId?: unknown }).directoryId)))
    .slice(0, 20)
    .map((e) => {
      const l = e.listed && typeof e.listed === 'object' ? (e.listed as Record<string, unknown>) : null;
      const listed = l ? { name: s(l.name, 200), address: s(l.address, 300), phone: s(l.phone, 40) } : undefined;
      return {
        directoryId: String(e.directoryId),
        present: typeof e.present === 'boolean' ? e.present : null,
        url: s(e.url, 500),
        ...(listed && (listed.name || listed.address || listed.phone) ? { listed } : {}),
      };
    });
}
