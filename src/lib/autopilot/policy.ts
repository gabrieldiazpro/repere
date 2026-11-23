/**
 * Pilote automatique — règles d'éligibilité (PURES, testées). Une modification n'est appliquée sous mandat que si
 * TOUTES les règles passent ; sinon elle reste une proposition à valider à la main dans /app/agent (rien n'est perdu).
 */
import type { ChangeSet } from '@/lib/publish/types';
import type { ContentDraft } from '@/lib/content/types';
import { categoryOfKind, mandateAllows, SCORE_DROP_MARGIN, type Mandate } from './mandate';

const TODO_RE = /\[\s*à compléter\s*\]/i;

/** Pages juridiques : jamais touchées (mentions légales, CGV/CGU, confidentialité, cookies, RGPD…). */
const LEGAL_RE = /(mentions[-_ ]?legales|mentions-l%C3%A9gales|legal|cgv|cgu|conditions[-_ ]generales|conditions-g%C3%A9n%C3%A9rales|terms|confidentialite|confidentialit%C3%A9|privacy|politique[-_ ]de[-_ ]|cookies?|rgpd|gdpr|imprint|impressum)/i;
/** Pages d'avis : jamais touchées. */
const REVIEW_RE = /(\/avis\b|\/avis[-/]|reviews?|temoignages?|t%C3%A9moignages?|testimonials?)/i;
/** Montant d'argent : « 49 € », « 49,90 EUR », « €49 ». */
const MONEY_RE = /(\d[\d\s.,]*\s?(?:€|eur\b|euros?\b)|€\s?\d[\d\s.,]*)/gi;
/** Clés JSON-LD interdites : prix, offres, avis, notes. */
const FORBIDDEN_LD_KEYS = new Set(['offers', 'price', 'pricerange', 'lowprice', 'highprice', 'pricespecification', 'review', 'reviews', 'aggregaterating', 'ratingvalue', 'reviewcount']);

export function isLegalUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  try {
    return LEGAL_RE.test(decodeURI(new URL(url, 'https://x.invalid').pathname)) || LEGAL_RE.test(new URL(url, 'https://x.invalid').pathname);
  } catch {
    return LEGAL_RE.test(url);
  }
}

export function isReviewUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  try {
    return REVIEW_RE.test(new URL(url, 'https://x.invalid').pathname);
  } catch {
    return REVIEW_RE.test(url);
  }
}

const amounts = (s: string | null | undefined) => new Set((s ?? '').match(MONEY_RE)?.map((x) => x.replace(/\s+/g, '').toLowerCase()) ?? []);

/** La valeur « après » contient-elle un montant absent de « avant » ? (modification de prix interdite) */
export function introducesPrice(before: string | null | undefined, after: string | null | undefined): boolean {
  const b = amounts(before);
  for (const a of amounts(after)) if (!b.has(a)) return true;
  return false;
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9@+]+/g, ' ').trim();

/** Valeurs textuelles d'un JSON-LD (hors @context, @type, @id, adresses web), avec les clés rencontrées. */
function leaves(v: unknown, keys: Set<string>, out: string[] = []): string[] {
  if (Array.isArray(v)) v.forEach((x) => leaves(x, keys, out));
  else if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      keys.add(k.toLowerCase());
      if (k === '@context' || k === '@type' || k === '@id') continue;
      leaves(x, keys, out);
    }
  } else if (typeof v === 'string') {
    if (!/^https?:\/\//i.test(v) && !/^mailto:|^tel:/i.test(v)) out.push(v);
  }
  return out;
}

/** Extrait le JSON d'un bloc `<script type="application/ld+json">…</script>` (ou du JSON brut). */
export function parseJsonLdBlock(block: string): unknown | null {
  const m = /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/i.exec(block);
  try {
    return JSON.parse((m ? m[1] : block).trim());
  } catch {
    return null;
  }
}

/**
 * Données structurées « issues de la fiche officielle » : chaque valeur textuelle doit se retrouver dans les faits de
 * la fiche (ou le nom de l'entreprise) ; aucune clé de prix ni d'avis.
 */
export function jsonLdFromFiche(block: string, ficheValues: readonly string[]): { ok: boolean; reason?: string } {
  const data = parseJsonLdBlock(block);
  if (!data) return { ok: false, reason: 'Données structurées illisibles.' };
  const keys = new Set<string>();
  const values = leaves(data, keys);
  const bad = [...keys].find((k) => FORBIDDEN_LD_KEYS.has(k));
  if (bad) return { ok: false, reason: `Données structurées avec « ${bad} » (prix ou avis) : jamais appliquées seules.` };
  const pool = norm(ficheValues.join(' \n '));
  if (!pool) return { ok: false, reason: 'Fiche officielle vide : aucune donnée structurée appliquée seule.' };
  const missing = values.map((x) => x.trim()).filter((x) => x && !/^\d+([.:]\d+)?$/.test(x) && !pool.includes(norm(x)));
  if (missing.length) return { ok: false, reason: `Valeur absente de votre fiche officielle : « ${missing[0].slice(0, 60)} ».` };
  return { ok: true };
}

export interface ChangeSetContext {
  mandate: Pick<Mandate, 'status' | 'categories'> | null;
  /** métier réglementé (src/lib/regulated.ts) */
  regulated: boolean;
  /** faits de la fiche officielle CONFIRMÉE (valeurs textuelles) ; vide si la fiche n'est pas confirmée */
  ficheValues: readonly string[];
}

export interface Verdict {
  ok: boolean;
  reasons: string[];
}

/**
 * Une série (ChangeSet) peut-elle être appliquée sous mandat ? Toutes ses modifications en attente doivent l'être :
 * une série n'est jamais appliquée en partie par le pilote.
 */
export function evaluateChangeSet(cs: Pick<ChangeSet, 'platform' | 'origin' | 'changes' | 'status'>, ctx: ChangeSetContext): Verdict {
  const reasons: string[] = [];
  if (!ctx.mandate || ctx.mandate.status !== 'active') return { ok: false, reasons: ['Mandat absent, en pause ou révoqué.'] };
  if (cs.platform === 'export' || cs.platform === 'gbp') reasons.push(cs.platform === 'export' ? 'Site non connecté : fichiers à déposer vous-même.' : 'Fiche Google : jamais modifiée par le pilote.');
  if (cs.origin.findingId.startsWith('content:')) reasons.push('Réécriture d’une page existante : validation une par une.');
  const pending = cs.changes.filter((c) => c.status === 'pending');
  if (!pending.length) reasons.push('Aucune modification en attente.');
  for (const ch of pending) {
    const cat = categoryOfKind(ch.kind);
    if (!cat) {
      reasons.push(`« ${ch.kind} » n’est jamais couvert par le mandat.`);
      continue;
    }
    if (!mandateAllows(ctx.mandate, cat)) reasons.push(`Catégorie non autorisée par votre mandat : ${cat}.`);
    if (ctx.regulated && (cat === 'titres' || cat === 'descriptions')) reasons.push('Métier réglementé : aucun texte rédigé seul.');
    const url = ch.target.url ?? '';
    if (isLegalUrl(url)) reasons.push(`Page juridique (${url}) : jamais modifiée.`);
    if (isReviewUrl(url)) reasons.push(`Page d’avis (${url}) : jamais modifiée.`);
    const after = ch.after ?? ch.patch.value;
    if (ch.after === null || !String(after ?? '').trim()) reasons.push('Suppression : jamais faite par le pilote.');
    if (TODO_RE.test(`${after ?? ''}\n${ch.patch.value}`)) reasons.push('Contient « [à compléter] ».');
    if (introducesPrice(ch.before, after)) reasons.push('Introduit ou modifie un prix : jamais fait par le pilote.');
    if (ch.kind === 'jsonld') {
      const v = jsonLdFromFiche(ch.patch.value, ctx.ficheValues);
      if (!v.ok) reasons.push(v.reason!);
    }
    if (ch.kind === 'redirect' && !/^seo\.broken\./.test(cs.origin.findingId)) reasons.push('Redirection d’une page qui n’est pas cassée : validation à la main.');
    if (ch.kind === 'robots.txt' && (ch.patch.op !== 'append' || /disallow/i.test(ch.patch.value))) reasons.push('robots.txt : seul l’ajout d’autorisations pour les robots d’IA est fait seul.');
  }
  return { ok: reasons.length === 0, reasons: [...new Set(reasons)] };
}

/** Fiche officielle vue par le pilote : confirmée ? quels faits vérifiés ? */
export interface FicheView {
  confirmedAt: string | null;
  /** clés des faits vérifiés par le client (texte et listes : services, certifications…) */
  verifiedKeys: readonly string[];
}

export interface DraftContext {
  mandate: Pick<Mandate, 'status' | 'categories'> | null;
  regulated: boolean;
  fiche: FicheView | null;
}

/** Un contenu de l'agent de contenu peut-il être programmé sous mandat (brouillon puis mise en ligne à 72 h) ? */
export function evaluateDraft(d: Pick<ContentDraft, 'action' | 'pageType' | 'title' | 'metaTitle' | 'metaDescription' | 'body' | 'missing' | 'checks' | 'cannibal' | 'factsUsed' | 'status' | 'slug'>, ctx: DraftContext): Verdict {
  const reasons: string[] = [];
  if (!mandateAllows(ctx.mandate, 'contenus')) return { ok: false, reasons: ['Contenus non autorisés par votre mandat (ou mandat en pause).'] };
  if (ctx.regulated) reasons.push('Métier réglementé : aucun contenu rédigé seul.');
  if (d.action !== 'create') reasons.push('Réécriture d’une page existante : validation une par une.');
  if (d.pageType === 'tarifs') reasons.push('Page de tarifs : les prix ne sont jamais publiés par le pilote.');
  if (isLegalUrl(`/${d.slug}`) || isReviewUrl(`/${d.slug}`)) reasons.push('Page juridique ou d’avis : jamais publiée par le pilote.');
  if (TODO_RE.test(`${d.title}\n${d.metaTitle}\n${d.metaDescription}\n${d.body}`)) reasons.push('Contient « [à compléter] ».');
  if (d.missing.length) reasons.push(`Informations manquantes : ${d.missing.slice(0, 3).join(', ')}.`);
  const failed = d.checks.filter((c) => !c.ok);
  if (failed.length) reasons.push(`Contrôle non passé : ${failed[0].label}.`);
  if (d.cannibal.some((c) => c.level === 'fort')) reasons.push('Trop proche d’une page existante (cannibalisation).');
  if (!ctx.fiche?.confirmedAt) reasons.push('Fiche officielle non confirmée : aucun contenu publié seul.');
  else {
    const verified = new Set(ctx.fiche.verifiedKeys);
    const unverified = d.factsUsed.filter((k) => !verified.has(k));
    if (unverified.length) reasons.push(`Fait non confirmé dans votre fiche officielle : ${unverified.slice(0, 3).join(', ')}.`);
  }
  if (introducesPrice('', d.body) || introducesPrice('', d.metaDescription)) reasons.push('Le texte cite un prix : validation à la main.');
  return { ok: reasons.length === 0, reasons: [...new Set(reasons)] };
}

export interface Scores {
  seo: number | null;
  geo: number | null;
}

/** Arrêt automatique : un score a-t-il baissé au-delà de la marge depuis la série ? */
export function scoreDrop(baseline: Scores | null | undefined, current: Scores | null | undefined, margin = SCORE_DROP_MARGIN): { dropped: boolean; detail: string } {
  if (!baseline || !current) return { dropped: false, detail: 'Pas de mesure de comparaison.' };
  const parts: string[] = [];
  for (const k of ['seo', 'geo'] as const) {
    const b = baseline[k];
    const c = current[k];
    if (typeof b === 'number' && typeof c === 'number' && b - c > margin) parts.push(`score ${k.toUpperCase()} ${b} → ${c} (−${b - c} points, marge ${margin})`);
  }
  return parts.length ? { dropped: true, detail: parts.join(' ; ') } : { dropped: false, detail: 'Aucune baisse au-delà de la marge.' };
}
