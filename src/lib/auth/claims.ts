/**
 * Effets d'une connexion réussie : rattachements et invitations.
 *
 * Règle de sécurité (A3/S1 de docs/v3/10) : on ne rattache JAMAIS un commerce à un compte dont l'adresse n'est pas
 * prouvée. Une session ouverte par un lien magique prouve l'adresse ; le jeton `claim` est en plus lié à cet e-mail.
 */
import {
  addMembership,
  claimBusinessesForUser,
  createBusiness,
  findInvitationByTokenHash,
  getAudit,
  getBusinessRecord,
  getMembership,
  listBusinessesForUser,
  listMembers,
  updateInvitation,
  type BusinessRecord,
} from '@/lib/db';
import type { AuditResult } from '@/lib/engine/types';
import type { Segment } from '@/lib/engine/types-v2';
import { decouvertePlanFor } from '@/lib/plans';
import { resolveSignupProfile, type OriginAuditInput } from './profile';
import { getDoc, putDoc } from '@/lib/store';
import { randomToken, sha256, signValue, verifyValue } from './cookies';
import { enqueueOnboardingAudit } from './onboarding';
import type { Session } from './session';
import { normEmail } from './users';
import { recordSignupAttribution, sanitizeAttribution, type Attribution } from '@/lib/roi/attribution';

const DAY = 86_400;

// ---------------------------------------------------------------------------
// Jetons signés
// ---------------------------------------------------------------------------

export interface PurchaseClaim {
  k: 'purchase';
  /** commerce payé à rattacher */
  b: string;
  e: string;
  exp: number;
}

export interface SignupClaim {
  k: 'signup';
  e: string;
  /** nom de l'entreprise */
  name: string;
  segment: Segment;
  website?: string;
  trade?: string;
  city?: string;
  /** audit gratuit d'origine (/inscription?audit=) : rattaché s'il a été demandé avec cette adresse */
  audit?: string;
  /** analyse 60 s d'origine (/inscription?analyse=, V5) : rattachée et reprise (site, marque, type, ville) aux mêmes conditions */
  analysis?: string;
  /** code de parrainage (/inscription?ref=) */
  ref?: string;
  /** suite demandée après l'inscription (`carte` : publier la carte de score de l'audit d'origine) */
  suite?: 'carte';
  /** origine de la visite (première page / UTM, sans cookie ; ROI des baromètres) */
  src?: Attribution;
  n: string;
  exp: number;
}

export type Claim = PurchaseClaim | SignupClaim;

export function purchaseClaimToken(businessId: string, email: string, ttlDays = 30): string {
  return signValue({ k: 'purchase', b: businessId, e: normEmail(email), exp: Math.floor(Date.now() / 1000) + ttlDays * DAY } satisfies PurchaseClaim);
}

const ANALYSIS_ID_RE = /^an_[A-Za-z0-9_-]{1,77}$/;

export function signupClaimToken(input: { email: string; name: string; segment: Segment; website?: string; trade?: string; city?: string; audit?: string; analysis?: string; ref?: string; suite?: 'carte'; src?: Attribution | null }): string {
  return signValue({
    k: 'signup',
    e: normEmail(input.email),
    name: input.name,
    segment: input.segment,
    website: input.website || undefined,
    trade: input.trade || undefined,
    city: input.city || undefined,
    audit: input.audit && /^[A-Za-z0-9_-]{1,80}$/.test(input.audit) ? input.audit : undefined,
    analysis: input.analysis && ANALYSIS_ID_RE.test(input.analysis) ? input.analysis : undefined,
    ref: input.ref && /^[A-Za-z0-9_-]{1,20}$/.test(input.ref) ? input.ref : undefined,
    suite: input.suite === 'carte' ? 'carte' : undefined,
    src: sanitizeAttribution(input.src) ?? undefined,
    n: randomToken(12),
    exp: Math.floor(Date.now() / 1000) + 7 * DAY,
  } satisfies SignupClaim);
}

export function readClaim(token: string | null | undefined): Claim | null {
  const c = verifyValue<Claim>(token);
  return c && (c.k === 'purchase' || c.k === 'signup') ? c : null;
}

// ---------------------------------------------------------------------------
// Création d'un commerce Découverte (inscription gratuite, /bienvenue)
// ---------------------------------------------------------------------------

/** Audit gratuit d'origine (public par lien) : lu pour reprendre métier, ville, catégories et questions. */
async function originAudit(id: string | undefined): Promise<AuditResult | null> {
  if (!id || !/^[A-Za-z0-9_-]{1,80}$/.test(id) || id.startsWith('demo-')) return null;
  return getAudit(id).catch(() => null);
}

/** Ce que l'espace reprend d'une analyse 60 s (V5), si elle a été demandée avec cette adresse. */
export interface AnalysisSignupDefaults {
  name: string;
  segment: Segment;
  website: string;
  trade?: string;
  city?: string;
}

export async function analysisSignupDefaults(id: string | undefined, email: string): Promise<AnalysisSignupDefaults | null> {
  if (!id || !ANALYSIS_ID_RE.test(id) || !email) return null;
  try {
    const { analysisRequestedBy } = await import('@/lib/analysis/store');
    const doc = await analysisRequestedBy(id, normEmail(email));
    if (!doc) return null;
    const a = doc.analysis;
    let website = a.input.url;
    try {
      website = new URL(a.crawl?.finalOrigin || a.input.url).origin + '/';
    } catch {
      /* adresse d'entrée gardée */
    }
    return {
      name: (a.input.brand || a.detected.brand || '').trim().slice(0, 120),
      segment: a.input.siteType ?? a.detected.siteType,
      website,
      ...(a.detected.activity ? { trade: a.detected.activity.slice(0, 80) } : {}),
      ...((a.input.city || a.detected.city) ? { city: (a.input.city || a.detected.city)!.slice(0, 80) } : {}),
    };
  } catch {
    return null;
  }
}

/**
 * Crée l'espace Découverte. Avec `audit` (inscription depuis le rapport gratuit), l'espace reprend l'audit d'origine :
 * métier ou catégorie, ville et quartier, catégories produits, concurrents connus et questions posées (B1).
 * Sans métier connu : espace « à compléter » (/bienvenue le demande), jamais de métier générique.
 */
export async function createOwnedBusiness(
  session: Session,
  rawInput: { name: string; segment: Segment; website?: string; trade?: string; city?: string; audit?: string; analysis?: string },
): Promise<BusinessRecord> {
  // Analyse 60 s d'origine : reprend site, marque, type et ville quand la personne ne les a pas saisis.
  const fromAnalysis = await analysisSignupDefaults(rawInput.analysis, session.email);
  const input = fromAnalysis
    ? {
        ...rawInput,
        name: rawInput.name?.trim() || fromAnalysis.name,
        segment: rawInput.segment || fromAnalysis.segment,
        website: rawInput.website || fromAnalysis.website,
        trade: rawInput.trade || ((rawInput.segment || fromAnalysis.segment) === fromAnalysis.segment ? fromAnalysis.trade : undefined),
        city: rawInput.city || fromAnalysis.city,
      }
    : rawInput;
  const segment = input.segment;
  const origin = await originAudit(input.audit);
  const profile = resolveSignupProfile(input, (origin?.input as OriginAuditInput | undefined) ?? null);
  return createBusiness({
    name: input.name.trim().slice(0, 120),
    trade: profile.trade.slice(0, 80),
    city: profile.city.slice(0, 80),
    ...(profile.district ? { district: profile.district.slice(0, 80) } : {}),
    website: input.website || undefined,
    contactEmail: session.email,
    ownerId: session.userId,
    plan: 'free',
    planId: decouvertePlanFor(segment),
    segment,
    needsSetup: profile.needsSetup,
    auditInput: profile.auditInput,
  }).then(async (b) => {
    // Supabase : createBusiness n'ajoute pas l'adhésion (mode mémoire : oui, idempotent).
    await addMembership(b.id, session.userId, 'owner', session.email);
    // Questions de l'audit d'origine reprises (dans la limite de l'offre) quand le parcours est le même.
    if (!b.needsSetup) await enqueueOnboardingAudit(b.id, profile.fromOrigin && origin ? { queries: origin.queries } : undefined);
    return b;
  });
}

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

export type InviteOutcome = 'accepted' | 'already_member' | 'invalid' | 'expired' | 'wrong_email';

export async function acceptInvitation(session: Session, rawToken: string): Promise<{ outcome: InviteOutcome; businessId?: string }> {
  const inv = await findInvitationByTokenHash(sha256(rawToken));
  if (!inv || inv.revokedAt) return { outcome: 'invalid' };
  if (inv.acceptedAt) {
    return inv.acceptedBy === session.userId ? { outcome: 'already_member', businessId: inv.businessId } : { outcome: 'invalid' };
  }
  if (new Date(inv.expiresAt).getTime() < Date.now()) return { outcome: 'expired' };
  if (normEmail(inv.email) !== normEmail(session.email)) return { outcome: 'wrong_email' };
  const existing = await getMembership(inv.businessId, session.userId);
  if (!existing) {
    // Sièges revérifiés à l'acceptation (offre rétrogradée entre l'envoi et le clic : F6 de securite-v3).
    const business = await getBusinessRecord(inv.businessId);
    if (!business) return { outcome: 'invalid' };
    const { getEntitlements } = await import('@/lib/entitlements');
    if ((await listMembers(inv.businessId)).length >= getEntitlements(business).seats) return { outcome: 'invalid' };
  }
  // Une invitation ne rétrograde jamais un membre existant.
  if (!existing) await addMembership(inv.businessId, session.userId, inv.role, session.email);
  await updateInvitation(inv.id, { acceptedAt: new Date().toISOString(), acceptedBy: session.userId });
  return { outcome: existing ? 'already_member' : 'accepted', businessId: inv.businessId };
}

// ---------------------------------------------------------------------------
// Après connexion
// ---------------------------------------------------------------------------

export interface LoginEffects {
  /** commerces rattachés ou créés pendant cette connexion */
  businessIds: string[];
  invite?: InviteOutcome;
  /** commerce à sélectionner (créé, rattaché ou rejoint) */
  selectBusinessId?: string;
  hasBusiness: boolean;
  /** page où poursuivre (ex. carte de score publiée après l'inscription) */
  next?: string;
}

/**
 * Suites d'une inscription gratuite (raccordement V3) : audit d'origine rattaché au nouvel espace (seulement s'il a
 * été demandé avec la même adresse : un identifiant d'audit seul ne suffit pas), parrainage attribué, carte de score
 * publiée si la personne l'a demandée (« Partager ma carte de score »). Jamais bloquant.
 */
async function afterSignup(session: Session, businessId: string, claim: SignupClaim): Promise<string | undefined> {
  let next: string | undefined;
  if (claim.audit) {
    try {
      const db = await import('@/lib/db');
      const audit = await db.getAudit(claim.audit);
      const owner = await db.getAuditBusinessId(claim.audit);
      // L'e-mail n'est pas stocké dans l'audit (public par lien) mais dans `leads` : auditRequestedBy regarde les deux.
      if (audit && !owner && (await db.auditRequestedBy(claim.audit, session.email))) {
        await db.linkAuditToBusiness(claim.audit, businessId);
        if (claim.suite === 'carte') {
          const { enableCard } = await import('@/lib/growth/cards');
          const card = await enableCard(businessId, claim.audit);
          next = `/carte/${claim.audit}?t=${card.token}`;
        }
      }
    } catch (e) {
      console.warn('[auth] audit d’origine non rattaché', e instanceof Error ? e.message : e);
    }
  }
  if (claim.analysis) {
    try {
      const { attachAnalysisToBusiness } = await import('@/lib/analysis/store');
      await attachAnalysisToBusiness(claim.analysis, businessId, session.email);
    } catch (e) {
      console.warn('[auth] analyse d’origine non rattachée', e instanceof Error ? e.message : e);
    }
  }
  if (claim.ref) {
    try {
      const { attributeReferral } = await import('@/lib/growth/referral');
      await attributeReferral({ code: claim.ref, refereeBusinessId: businessId });
    } catch (e) {
      console.warn('[auth] parrainage non attribué', e instanceof Error ? e.message : e);
    }
  }
  return next;
}

export async function applyLoginEffects(session: Session, params: { claim?: string | null; invite?: string | null }): Promise<LoginEffects> {
  const ids: string[] = [];
  let select: string | undefined;
  let next: string | undefined;
  const claim = readClaim(params.claim);
  if (claim && claim.e === normEmail(session.email)) {
    if (claim.k === 'purchase') {
      const got = await claimBusinessesForUser(session.userId, session.email, { businessIds: [claim.b] });
      ids.push(...got);
      // déjà rattaché à cet utilisateur (lien cliqué deux fois) : on le sélectionne quand même
      if (got.length || (await getMembership(claim.b, session.userId))) select = claim.b;
    } else {
      const used = await getDoc('auth.signup_used', claim.n);
      if (!used) {
        await putDoc('auth.signup_used', claim.n, { at: new Date().toISOString(), userId: session.userId });
        // Un seul espace gratuit par compte (décision 2) : une seconde inscription rouvre l'espace existant.
        let existing: string | undefined;
        for (const b of await listBusinessesForUser(session.userId)) {
          if (b.plan === 'free' && (await getMembership(b.id, session.userId))?.role === 'owner') {
            existing = b.id;
            break;
          }
        }
        if (existing) select = existing;
        else {
          const b = await createOwnedBusiness(session, claim);
          // Origine de l'inscription (analyse ou audit d'origine, sinon première page / UTM) : ROI des baromètres.
          await recordSignupAttribution(b.id, { analysis: claim.analysis, audit: claim.audit, attribution: claim.src ?? null });
          ids.push(b.id);
          select = b.id;
          next = await afterSignup(session, b.id, claim);
        }
      }
    }
  }
  let invite: InviteOutcome | undefined;
  if (params.invite) {
    const r = await acceptInvitation(session, params.invite);
    invite = r.outcome;
    if (r.businessId && (r.outcome === 'accepted' || r.outcome === 'already_member')) select = r.businessId;
  }
  // Filet de sécurité : commerces PAYÉS à cet e-mail encore sans propriétaire (2ᵉ achat, lien perdu).
  const safety = await claimBusinessesForUser(session.userId, session.email);
  for (const id of safety) if (!ids.includes(id)) ids.push(id);
  if (!select && safety.length) select = safety[safety.length - 1];
  const all = await listBusinessesForUser(session.userId);
  // Espace à compléter (achat sans audit, inscription locale sans ville) : /bienvenue avant l'espace, sinon aucun
  // premier audit n'est lancé et l'espace reste vide.
  if (!next && select) {
    const rec = await getBusinessRecord(select);
    if (rec?.needsSetup && (await getMembership(select, session.userId))?.role === 'owner') next = '/bienvenue';
  }
  return { businessIds: ids, invite, selectBusinessId: select, hasBusiness: all.length > 0, ...(next ? { next } : {}) };
}
