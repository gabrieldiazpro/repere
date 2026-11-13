/** Espaces (commerces) d'un compte : liste pour le sélecteur, création depuis /bienvenue. */
import { getBusinessRecord, getMembership, listBusinessesForUser, updateBusiness } from '@/lib/db';
import { requireBusiness } from './access';
import { enqueueOnboardingAudit } from './onboarding';
import type { Segment } from '@/lib/engine/types-v2';
import { TIER_NAMES, getEntitlements } from '@/lib/entitlements';
import { createOwnedBusiness } from './claims';
import { missingSetupFields } from './profile';
import { HttpError, type Role } from './roles';
import type { Session } from './session';

export interface AccountBusiness {
  id: string;
  name: string;
  segment: Segment;
  role: Role;
  /** Découverte, Essentiel, Accompagné, Agence */
  offer: string;
  needsSetup: boolean;
  /** offre gratuite Découverte (inscription) ou espace payé (achat) : /bienvenue n'a pas le même texte */
  free: boolean;
  /** valeurs déjà connues, pour pré-remplir /bienvenue (vides si inconnues ; jamais « Mon entreprise ») */
  prefill: { name: string; website: string; trade: string; city: string };
}

export async function listAccountBusinesses(session: Session): Promise<AccountBusiness[]> {
  const list = await listBusinessesForUser(session.userId);
  const out: AccountBusiness[] = [];
  for (const b of list) {
    const role = (await getMembership(b.id, session.userId))?.role ?? 'owner';
    // `listBusinessesForUser` renvoie la forme publique (sans needsSetup) : relire l'enregistrement serveur.
    const rec = (await getBusinessRecord(b.id)) ?? (b as typeof b & { needsSetup?: boolean });
    const tier = getEntitlements(b).tier;
    out.push({
      id: b.id,
      name: b.name,
      segment: b.segment ?? 'local',
      role,
      offer: TIER_NAMES[tier],
      needsSetup: Boolean(rec.needsSetup),
      free: tier === 'decouverte',
      prefill: {
        name: PLACEHOLDER_NAMES.has(b.name) ? '' : b.name,
        website: b.website ?? '',
        trade: b.trade ?? '',
        city: b.segment !== 'local' && b.city === 'France' ? '' : (b.city ?? ''),
      },
    });
  }
  return out;
}

const SEGMENTS: Segment[] = ['local', 'pme', 'ecommerce'];
/** Nom provisoire d'un espace payé sans audit (provision.ts) : jamais proposé comme valeur. */
const PLACEHOLDER_NAMES = new Set(['Mon entreprise']);
const s = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/**
 * Crée un espace Découverte dont l'utilisateur est propriétaire. Un compte n'a qu'UN espace gratuit (décision 2 :
 * 1 marque) ; au-delà, il passe par une offre payante.
 */
export async function createAccountBusiness(session: Session, input: Record<string, unknown>) {
  const name = s(input.name, 120);
  if (name.length < 2) throw new HttpError(400, 'Indiquez le nom de votre entreprise.');
  const segment = SEGMENTS.includes(input.segment as Segment) ? (input.segment as Segment) : null;
  if (!segment) throw new HttpError(400, 'Choisissez votre parcours : commerce local, PME ou e-commerce.');
  let website = s(input.website, 200);
  if (website && !/^https?:\/\//i.test(website)) website = `https://${website}`;
  if (website) {
    try {
      website = new URL(website).toString();
    } catch {
      throw new HttpError(400, 'L’adresse du site semble incorrecte.');
    }
  }
  const mine = await listAccountBusinesses(session);
  const freeOwned = mine.filter((b) => b.role === 'owner' && b.offer === TIER_NAMES.decouverte);
  if (freeOwned.length >= 1) {
    throw new HttpError(402, 'Votre compte gratuit comprend un espace. Passez à une offre payante pour en suivre un autre.', 'quota_exceeded');
  }
  return createOwnedBusiness(session, { name, segment, website: website || undefined, trade: s(input.trade, 80) || undefined, city: s(input.city, 80) || undefined });
}

const TRADE_REQUIRED: Record<Segment, string> = {
  local: 'Indiquez votre métier, par exemple « plombier » ou « pizzeria ».',
  pme: 'Indiquez votre secteur, par exemple « logiciel de paie pour PME ».',
  ecommerce: 'Indiquez votre catégorie de produits principale, par exemple « shampoing solide ».',
};

/** Complète un espace « à compléter » (achat sans audit, inscription sans métier ni ville) : /bienvenue, propriétaire uniquement. */
export async function completeBusinessSetup(session: Session, input: Record<string, unknown>) {
  const { business } = await requireBusiness(null, s(input.businessId, 100), { session, minRole: 'owner', write: true });
  const name = s(input.name, 120);
  if (name.length < 2) throw new HttpError(400, 'Indiquez le nom de votre entreprise.');
  let website = s(input.website, 200);
  if (website && !/^https?:\/\//i.test(website)) website = `https://${website}`;
  if (website) {
    try {
      website = new URL(website).toString();
    } catch {
      throw new HttpError(400, 'L’adresse du site semble incorrecte.');
    }
  }
  const segment = business.segment ?? 'local';
  const city = s(input.city, 80) || business.city || (segment === 'local' ? '' : 'France');
  const trade = s(input.trade, 80) || business.trade;
  const missing = missingSetupFields({ segment, name, trade, city });
  if (missing.includes('trade')) throw new HttpError(400, TRADE_REQUIRED[segment]);
  if (missing.includes('city')) throw new HttpError(400, 'Indiquez la ville de votre commerce.');
  // Lu AVANT la mise à jour (le store mémoire renvoie l'objet lui-même, modifié en place).
  const wasPending = Boolean(business.needsSetup);
  await updateBusiness(business.id, {
    name,
    website: website || undefined,
    city,
    trade,
    needsSetup: false,
  });
  if (wasPending) await enqueueOnboardingAudit(business.id);
  return { id: business.id, name };
}

export interface ProfileUpdate {
  id: string;
  trade: string;
  city: string;
  district: string;
  /** métier, ville ou quartier différents d'avant : la régénération des questions est proposée */
  changed: boolean;
  /** nouvelles questions qu'une régénération ajouterait (aperçu, rien n'est écrit) */
  proposal: string[];
}

/**
 * Réglages › Compte : métier (ou secteur, catégorie) et ville modifiables par un propriétaire ou un administrateur.
 * Les questions suivies ne changent PAS ici : la régénération est proposée (aperçu renvoyé) puis acceptée à part.
 */
export async function updateBusinessProfile(session: Session, input: Record<string, unknown>): Promise<ProfileUpdate> {
  const { business } = await requireBusiness(null, s(input.businessId, 100), { session, minRole: 'admin', write: true });
  const segment = business.segment ?? 'local';
  const trade = s(input.trade, 80).replace(/\s+/g, ' ');
  if (trade.length < 2) throw new HttpError(400, TRADE_REQUIRED[segment]);
  const city = s(input.city, 80).replace(/\s+/g, ' ') || (segment === 'local' ? '' : 'France');
  if (city.length < 2) throw new HttpError(400, 'Indiquez la ville de votre commerce.');
  const district = input.district === undefined ? (business.district ?? '') : s(input.district, 60).replace(/\s+/g, ' ');
  const changed = trade !== (business.trade ?? '') || city !== (business.city ?? '') || district !== (business.district ?? '');
  if (changed) await updateBusiness(business.id, { trade, city, district });
  let proposal: string[] = [];
  if (changed) {
    try {
      const { generatedQuestionsFor } = await import('./onboarding');
      proposal = (await generatedQuestionsFor(business.id)).filter((q) => q.kind !== 'brand').map((q) => q.text).slice(0, getEntitlements(business).prompts);
    } catch {
      proposal = [];
    }
  }
  return { id: business.id, trade, city, district, changed, proposal };
}

/** Régénération des questions acceptée après un changement de profil (propriétaire ou administrateur). */
export async function regenerateBusinessQuestions(session: Session, input: Record<string, unknown>) {
  const { business } = await requireBusiness(null, s(input.businessId, 100), { session, minRole: 'admin', write: true });
  const { regenerateQuestions } = await import('./onboarding');
  return regenerateQuestions(business.id);
}
