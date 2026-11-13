/**
 * Profil d'un nouvel espace Découverte (inscription gratuite, /bienvenue) : métier ou catégorie, ville, quartier et
 * entrée d'audit complète, repris de l'audit gratuit d'origine quand il existe (B1 de qa/v3/regard-client-v3.md).
 *
 * Le métier, la ville et les catégories d'un audit public ne sont pas des données sensibles : on les reprend même si
 * l'adresse de l'inscription diffère de celle de l'audit. Seul le RATTACHEMENT de l'audit reste conditionné à la même
 * adresse (claims.ts). Jamais de métier générique inventé (« commerce », « entreprise », « boutique en ligne ») : s'il
 * manque, l'espace est « à compléter » et /bienvenue le demande.
 */
import type { Segment } from '@/lib/engine/types-v2';

export interface SignupProfileInput {
  name: string;
  segment: Segment;
  website?: string;
  /** métier (local), secteur (PME) ou catégorie de produits principale (e-commerce), saisi à l'inscription */
  trade?: string;
  city?: string;
}

/** Champs utiles de l'entrée d'un audit gratuit (forme `AuditInput` du moteur, lue sans confiance). */
export interface OriginAuditInput {
  segment?: string;
  businessName?: string;
  trade?: string;
  city?: string;
  district?: string;
  website?: string | null;
  category?: string;
  offering?: string;
  productCategories?: unknown;
  knownCompetitors?: unknown;
  market?: string;
}

export interface SignupProfile {
  trade: string;
  city: string;
  district?: string;
  /** entrée d'audit enregistrée sur l'espace (relue par chaque mesure : catégories, concurrents connus…) */
  auditInput: Record<string, unknown>;
  needsSetup: boolean;
  /** l'audit d'origine a servi (même parcours) */
  fromOrigin: boolean;
}

const clean = (v: unknown, max = 80): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const fold = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const list = (v: unknown, max: number, len = 60): string[] =>
  Array.isArray(v) ? v.map((x) => clean(x, len)).filter((x) => x.length >= 2).slice(0, max) : [];

/** Métier ou catégorie à afficher pour un audit (« plombier », « logiciel de paie pour PME », « shampoing solide »). */
export function tradeOfAudit(o: OriginAuditInput | null | undefined): string {
  if (!o) return '';
  const seg = o.segment ?? 'local';
  if (seg === 'pme') return clean(o.category) || clean(o.trade);
  if (seg === 'ecommerce') return list(o.productCategories, 3)[0] || clean(o.category) || clean(o.trade);
  return clean(o.trade);
}

export function resolveSignupProfile(input: SignupProfileInput, origin?: OriginAuditInput | null): SignupProfile {
  const segment = input.segment;
  const o = origin && (origin.segment ?? 'local') === segment ? origin : null;
  const typedTrade = clean(input.trade);
  const typedCity = clean(input.city);
  const trade = typedTrade || tradeOfAudit(o);
  const originCity = segment === 'local' ? clean(o?.city) : clean(o?.market) || clean(o?.city);
  const sameCity = !typedCity || (!!originCity && fold(typedCity) === fold(originCity));
  const city = typedCity || originCity || (segment === 'local' ? '' : 'France');
  const district = segment === 'local' && sameCity ? clean(o?.district) || undefined : undefined;
  const cats = list(o?.productCategories, 3);
  const competitors = list(o?.knownCompetitors, 5);
  const auditInput: Record<string, unknown> = {
    segment,
    businessName: input.name.trim(),
    website: input.website || null,
    ...(trade ? { trade } : {}),
    ...(segment === 'local' && city ? { city } : {}),
    ...(district ? { district } : {}),
    ...(segment === 'pme' && trade ? { category: trade } : {}),
    ...(segment === 'ecommerce' && trade ? { productCategories: [trade, ...cats.filter((c) => fold(c) !== fold(trade))].slice(0, 3) } : {}),
    ...(segment !== 'local' ? { market: clean(o?.market) || (city !== 'France' ? city : 'France') } : {}),
    ...(segment !== 'local' && clean(o?.offering, 200) ? { offering: clean(o?.offering, 200) } : {}),
    ...(competitors.length ? { knownCompetitors: competitors } : {}),
  };
  return {
    trade,
    city,
    ...(district ? { district } : {}),
    auditInput,
    needsSetup: !trade || (segment === 'local' && !city),
    fromOrigin: !!o,
  };
}

/** Champs à demander sur /bienvenue pour un espace à compléter. */
export function missingSetupFields(b: { segment?: Segment; trade?: string; city?: string; name?: string }): ('name' | 'trade' | 'city')[] {
  const out: ('name' | 'trade' | 'city')[] = [];
  if (!clean(b.name) || clean(b.name).length < 2) out.push('name');
  if (!clean(b.trade)) out.push('trade');
  if ((b.segment ?? 'local') === 'local' && !clean(b.city)) out.push('city');
  return out;
}

const WHAT: Record<'name' | 'city', string> = { city: 'votre ville', name: 'le nom de votre entreprise' };
const TRADE_WORD: Record<Segment, string> = { local: 'votre métier', pme: 'votre secteur', ecommerce: 'votre catégorie de produits' };

/**
 * Texte d'accueil de /bienvenue pour un espace à compléter (B3) : une inscription gratuite n'est pas un paiement, et
 * on ne nomme que ce qui manque vraiment.
 */
export function setupIntro(b: { free: boolean; segment: Segment; prefill: { name?: string; trade?: string; city?: string } }): string {
  const missing = missingSetupFields({ segment: b.segment, ...b.prefill }).map((k) => (k === 'trade' ? TRADE_WORD[b.segment] : WHAT[k]));
  const list = missing.length > 1 ? `${missing.slice(0, -1).join(', ')} et ${missing[missing.length - 1]}` : missing[0];
  const need = list ? `Il manque ${list} pour lancer votre première mesure.` : 'Vérifiez vos informations pour lancer votre première mesure.';
  return b.free ? `Votre compte gratuit est créé. ${need}` : `Votre paiement est bien enregistré. ${need}`;
}
