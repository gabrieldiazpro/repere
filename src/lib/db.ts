/**
 * Accès données — contrat docs/00b-CONTRATS-MODULES.md.
 *
 * - Avec SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY : Postgres Supabase
 *   via la clé service_role (serveur uniquement, contourne la RLS — voir supabase/schema.sql).
 * - Sinon : mode démo, store mémoire persisté dans `.data/*.json` (ou DATA_DIR, ou le dossier
 *   temporaire du système si le disque du projet est en lecture seule, comme sur Vercel).
 *
 * Fichier serveur uniquement (node:fs, clé service_role) : ne jamais l'importer dans un composant client.
 */
import { HOUSE_BUSINESS, isHouseBusinessId } from './house';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AuditResult } from '@/lib/engine';
import type { Segment } from '@/lib/engine/types-v2';
import type { PlanId, PlanTier } from '@/lib/plans';
import type { Role } from '@/lib/auth/roles';
import { buildDemoWorkspace, buildDemoWorkspaceById, findDemoAudit, isDemoBusinessId } from '@/lib/demo-v2';
import { readJsonSafe, writeFileAtomic } from '@/lib/store';

export { isDemoBusinessId } from '@/lib/demo-v2';

// ---------------------------------------------------------------------------
// Types publics (contrat)
// ---------------------------------------------------------------------------

export interface Business {
  id: string;
  name: string;
  trade: string;
  city: string;
  district?: string;
  website?: string;
  /** Niveau d'accès (V1 : suivi/pro ; V2 : essentiel/accompagne/reseau). */
  plan: PlanTier;
  /** Parcours V2 (défaut 'local'). */
  segment?: Segment;
  /** Offre exacte (V3) : sert aux droits (src/lib/entitlements.ts). null/absent = déduite de `plan`. */
  planId?: PlanId | null;
  lastScore: number | null;
  createdAt: string;
}

/** Business + champs internes (serveur). */
export interface BusinessRecord extends Business {
  ownerId: string | null;
  contactEmail?: string;
  stripeCustomerId?: string;
  isActive: boolean;
  /** Seuil d'alerte en points (défaut 5). */
  alertThreshold: number;
  /** Commerce créé sans audit (paiement depuis /tarifs) : nom, métier, ville à compléter sur /bienvenue. */
  needsSetup?: boolean;
  /** Entrée de l'audit d'origine (segment, catégories…), relue par les audits planifiés. */
  auditInput?: Record<string, unknown> | null;
}

export type AuditTrigger = 'free' | 'monthly' | 'manual';

export interface LeadInput {
  email: string;
  /** Facultatifs pour la liste d'attente Pro / Agence (source 'waitlist'). */
  businessName?: string;
  trade?: string;
  city?: string;
  district?: string;
  auditId?: string;
  consent: boolean;
  source: 'site' | 'prospection' | 'waitlist' | 'tool' | 'contact';
  /** Liste d'attente : offre attendue. */
  interest?: 'pro' | 'agency';
}

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete' | 'unpaid';

export interface SubscriptionRecord {
  id: string;
  userId: string | null;
  businessId: string | null;
  email: string | null;
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  planId: PlanId;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  actionPlanPurchased: boolean;
  /** Fin d'engagement minimum (Accompagné : 3 mois), AAAA-MM-JJ, depuis la metadata Stripe. */
  commitmentUntil?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AlertType =
  | 'audit_done'
  | 'score_up'
  | 'score_down'
  | 'milestone'
  | 'new_competitor'
  | 'competitor_overtook'
  | 'actions_reminder'
  | 'payment_failed'
  | 'subscription_canceled'
  // V2 (src/lib/alerts.ts, digest)
  | 'fact_error'
  | 'visibility_change'
  | 'weekly_digest';

// ---------------------------------------------------------------------------
// Mode
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export function isSupabaseEnabled(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

let _sb: SupabaseClient | null = null;
function sb(): SupabaseClient {
  if (!_sb) {
    _sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _sb;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (s: string) => UUID_RE.test(s);

export function hashEmail(email: string): string {
  return crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}

function nowIso() {
  return new Date().toISOString();
}

function periodOf(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

function fail(where: string, error: { message: string } | null): void {
  if (error) throw new Error(`[db] ${where} : ${error.message}`);
}

// ---------------------------------------------------------------------------
// Store mémoire persisté (.data/*.json)
// ---------------------------------------------------------------------------

interface StoredAudit {
  result: AuditResult;
  businessId: string | null;
  trigger: AuditTrigger;
}

interface LeadRecord extends LeadInput {
  id: string;
  createdAt: string;
}

interface AlertRecord {
  id: string;
  businessId: string;
  auditId: string | null;
  type: AlertType;
  title: string;
  body?: string;
  payload: Record<string, unknown>;
  emailSentAt: string | null;
  createdAt: string;
}

interface MemStore {
  audits: Record<string, StoredAudit>;
  businesses: Record<string, BusinessRecord>;
  leads: Record<string, LeadRecord>;
  actions: Record<string, Record<string, boolean>>;
  subscriptions: Record<string, SubscriptionRecord>;
  suppression: Record<string, string>;
  stripeEvents: Record<string, string>;
  alerts: AlertRecord[];
  /** clé `${businessId}:${userId}` */
  memberships: Record<string, MembershipRecord>;
  invitations: Record<string, InvitationRecord>;
}

type CollectionName = keyof MemStore;
const COLLECTIONS: CollectionName[] = [
  'audits',
  'businesses',
  'leads',
  'actions',
  'subscriptions',
  'suppression',
  'stripeEvents',
  'alerts',
  'memberships',
  'invitations',
];

const g = globalThis as unknown as { __repereMem?: Promise<MemStore>; __repereDataDir?: string };

function dataDir(): string {
  return g.__repereDataDir || process.env.DATA_DIR || path.join(process.cwd(), '.data');
}

async function loadMem(): Promise<MemStore> {
  const empty: MemStore = {
    audits: {},
    businesses: {},
    leads: {},
    actions: {},
    subscriptions: {},
    suppression: {},
    stripeEvents: {},
    alerts: [],
    memberships: {},
    invitations: {},
  };
  for (const name of COLLECTIONS) {
    // Absent → collection vide ; vide ou tronqué → collection vide + journal (readJsonSafe).
    const v = await readJsonSafe<unknown>(path.join(dataDir(), `${name}.json`), () => undefined, 'db');
    if (v !== undefined && v !== null) (empty as unknown as Record<string, unknown>)[name] = v;
  }
  return empty;
}

function mem(): Promise<MemStore> {
  if (!g.__repereMem) g.__repereMem = loadMem();
  return g.__repereMem;
}

const writeChains = new Map<CollectionName, Promise<void>>();

/** Écrit une collection sur disque (sérialisé ; bascule sur le dossier tmp si lecture seule). */
function persist(name: CollectionName): Promise<void> {
  const prev = writeChains.get(name) ?? Promise.resolve();
  const next = prev.then(async () => {
    const store = await mem();
    const body = JSON.stringify(store[name], null, 1);
    try {
      await fs.mkdir(dataDir(), { recursive: true });
      await writeFileAtomic(path.join(dataDir(), `${name}.json`), body);
    } catch (e) {
      const fallback = path.join(os.tmpdir(), 'repere-data');
      if (dataDir() !== fallback) {
        g.__repereDataDir = fallback;
        try {
          await fs.mkdir(fallback, { recursive: true });
          await writeFileAtomic(path.join(fallback, `${name}.json`), body);
          return;
        } catch {
          /* ignore */
        }
      }
      console.warn(`[db] écriture de ${name}.json impossible, données en mémoire seulement`, e);
    }
  });
  writeChains.set(
    name,
    next.catch(() => undefined),
  );
  return next;
}

// ---------------------------------------------------------------------------
// Comptes démo (src/lib/demo-v2.ts) : `demo` (Plomberie Martin, 6 audits 18 → 61), `demo-pme`, `demo-ecom`
// ---------------------------------------------------------------------------

export const DEMO_BUSINESS_ID = 'demo';

function buildDemo(): { business: BusinessRecord; audits: AuditResult[] } {
  return buildDemoWorkspace('local');
}

function toPublicBusiness(b: BusinessRecord): Business {
  return {
    id: b.id,
    name: b.name,
    trade: b.trade,
    city: b.city,
    district: b.district,
    website: b.website,
    plan: b.plan,
    segment: b.segment ?? 'local',
    planId: b.planId ?? null,
    lastScore: b.lastScore,
    createdAt: b.createdAt,
  };
}

/** 6 mois d'historique démo (audits du plus ancien au plus récent). */
export async function getDemoBusiness(): Promise<{ business: Business; audits: AuditResult[] }> {
  const d = buildDemo();
  return { business: toPublicBusiness(d.business), audits: d.audits };
}

// ---------------------------------------------------------------------------
// Audits
// ---------------------------------------------------------------------------

/**
 * Sauvegarde (ou remplace) un résultat d'audit.
 * `opts.businessId` rattache l'audit à un commerce suivi (et met à jour son dernier score).
 */
export async function saveAudit(
  r: AuditResult,
  opts: { businessId?: string | null; trigger?: AuditTrigger } = {},
): Promise<void> {
  const businessId = opts.businessId ?? null;
  const trigger: AuditTrigger = opts.trigger ?? (businessId ? 'manual' : 'free');

  if (isSupabaseEnabled()) {
    const { error } = await sb()
      .from('audits')
      .upsert(
        {
          id: r.id,
          business_id: businessId,
          trigger,
          status: 'done',
          score: r.score,
          sub_scores: r.subScores,
          mention_rate: r.mentionRate,
          avg_rank: r.avgRank,
          share_of_voice: r.shareOfVoice,
          competitors: r.competitors,
          queries: r.queries,
          confidence: r.confidence,
          demo: r.demo,
          period: periodOf(r.createdAt),
          created_at: r.createdAt,
          finished_at: nowIso(),
          result: r,
        },
        { onConflict: 'id' },
      );
    fail('saveAudit', error);
    if (businessId) await updateBusiness(businessId, { lastScore: r.score });
    return;
  }

  const store = await mem();
  store.audits[r.id] = { result: r, businessId, trigger };
  await persist('audits');
  if (businessId) await updateBusiness(businessId, { lastScore: r.score });
}

export async function getAudit(id: string): Promise<AuditResult | null> {
  if (!id) return null;
  if (id.startsWith('demo-')) {
    const demo = findDemoAudit(id);
    if (demo) return demo.audit;
  }
  if (isSupabaseEnabled()) {
    const { data, error } = await sb().from('audits').select('result').eq('id', id).maybeSingle();
    fail('getAudit', error);
    return (data?.result as AuditResult | undefined) ?? null;
  }
  const store = await mem();
  return store.audits[id]?.result ?? null;
}

/** Commerce auquel un audit est rattaché (null pour un audit gratuit non rattaché). */
export async function getAuditBusinessId(auditId: string): Promise<string | null> {
  if (auditId.startsWith('demo-')) {
    const demo = findDemoAudit(auditId);
    if (demo) return demo.businessId;
    if (/^demo-\d+$/.test(auditId)) return DEMO_BUSINESS_ID;
  }
  if (isSupabaseEnabled()) {
    const { data, error } = await sb().from('audits').select('business_id').eq('id', auditId).maybeSingle();
    fail('getAuditBusinessId', error);
    return (data?.business_id as string | null | undefined) ?? null;
  }
  const store = await mem();
  return store.audits[auditId]?.businessId ?? null;
}

/** Rattache un audit existant (ex. l'audit gratuit) à un commerce. */
export async function linkAuditToBusiness(auditId: string, businessId: string): Promise<void> {
  if (isSupabaseEnabled()) {
    const { error } = await sb().from('audits').update({ business_id: businessId }).eq('id', auditId);
    fail('linkAuditToBusiness', error);
    return;
  }
  const store = await mem();
  const a = store.audits[auditId];
  if (a) {
    a.businessId = businessId;
    await persist('audits');
  }
}

/** Audits d'un commerce, du plus ancien au plus récent. */
export async function listAuditsForBusiness(businessId: string): Promise<AuditResult[]> {
  const demoWs = buildDemoWorkspaceById(businessId);
  if (demoWs) return demoWs.audits;
  if (isSupabaseEnabled()) {
    if (!isUuid(businessId)) return [];
    const { data, error } = await sb()
      .from('audits')
      .select('result')
      .eq('business_id', businessId)
      .eq('status', 'done')
      .order('created_at', { ascending: true });
    fail('listAuditsForBusiness', error);
    return (data ?? []).map((row: { result: AuditResult }) => row.result);
  }
  const store = await mem();
  return Object.values(store.audits)
    .filter((a) => a.businessId === businessId)
    .map((a) => a.result)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getLatestAuditForBusiness(businessId: string): Promise<AuditResult | null> {
  const all = await listAuditsForBusiness(businessId);
  return all.length ? all[all.length - 1] : null;
}

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------

export async function saveLead(l: LeadInput): Promise<{ id: string }> {
  const email = l.email.trim().toLowerCase();
  if (isSupabaseEnabled()) {
    let score: number | null = null;
    if (l.auditId) score = (await getAudit(l.auditId))?.score ?? null;
    const { data, error } = await sb()
      .from('leads')
      .insert({
        email,
        business_name: l.businessName ?? null,
        trade: l.trade ?? null,
        city: l.city ?? null,
        district: l.district ?? null,
        score,
        utm: l.interest ? { waitlist: l.interest } : {},
        free_audit_id: l.auditId ?? null,
        source: l.source,
        marketing_consent: l.consent,
        consent_at: l.consent ? nowIso() : null,
      })
      .select('id')
      .single();
    fail('saveLead', error);
    return { id: data!.id as string };
  }
  const store = await mem();
  const id = crypto.randomUUID();
  store.leads[id] = { ...l, email, id, createdAt: nowIso() };
  await persist('leads');
  return { id };
}

/**
 * L'audit `auditId` a-t-il été demandé avec cette adresse ? (l'e-mail n'est jamais stocké dans l'audit, qui est public
 * par son lien : seulement dans `leads.free_audit_id`). Sert à n'accorder le rattachement d'un audit qu'à son auteur.
 */
export async function auditRequestedBy(auditId: string, email: string | null | undefined): Promise<boolean> {
  if (!auditId || !email) return false;
  const e = email.trim().toLowerCase();
  const audit = await getAudit(auditId).catch(() => null);
  const inputEmail = (audit?.input as { email?: string } | undefined)?.email;
  if (inputEmail && inputEmail.trim().toLowerCase() === e) return true;
  if (isSupabaseEnabled()) {
    if (!isUuid(auditId)) return false;
    const { data, error } = await sb().from('leads').select('id').eq('free_audit_id', auditId).eq('email', e).limit(1);
    fail('auditRequestedBy', error);
    return Boolean(data && data.length);
  }
  const store = await mem();
  return Object.values(store.leads).some((l) => (l as { auditId?: string }).auditId === auditId && (l as { email?: string }).email === e);
}

// ---------------------------------------------------------------------------
// Commerces
// ---------------------------------------------------------------------------

interface BusinessRow {
  id: string;
  owner_id: string | null;
  name: string;
  trade: string;
  city: string;
  district: string | null;
  website: string | null;
  contact_email: string | null;
  plan: Business['plan'];
  segment?: Segment | null;
  plan_id?: string | null;
  needs_setup?: boolean | null;
  audit_input?: Record<string, unknown> | null;
  last_score: number | null;
  stripe_customer_id: string | null;
  is_active: boolean;
  alert_prefs: { threshold?: number } | null;
  created_at: string;
}

function rowToBusiness(r: BusinessRow): BusinessRecord {
  return {
    id: r.id,
    name: r.name,
    trade: r.trade,
    city: r.city,
    district: r.district ?? undefined,
    website: r.website ?? undefined,
    plan: r.plan ?? 'free',
    segment: r.segment ?? 'local',
    planId: (r.plan_id as PlanId | null | undefined) ?? null,
    lastScore: r.last_score,
    createdAt: r.created_at,
    needsSetup: Boolean(r.needs_setup),
    auditInput: r.audit_input ?? null,
    ownerId: r.owner_id,
    contactEmail: r.contact_email ?? undefined,
    stripeCustomerId: r.stripe_customer_id ?? undefined,
    isActive: r.is_active,
    alertThreshold: Number(r.alert_prefs?.threshold ?? 5),
  };
}

export async function getBusinessRecord(id: string): Promise<BusinessRecord | null> {
  const demoWs = buildDemoWorkspaceById(id);
  if (demoWs) return demoWs.business;
  if (isHouseBusinessId(id)) return HOUSE_BUSINESS;
  if (isSupabaseEnabled()) {
    if (!isUuid(id)) return null;
    const { data, error } = await sb().from('businesses').select('*').eq('id', id).maybeSingle();
    fail('getBusiness', error);
    return data ? rowToBusiness(data as BusinessRow) : null;
  }
  const store = await mem();
  return store.businesses[id] ?? null;
}

export async function getBusiness(id: string): Promise<Business | null> {
  const b = await getBusinessRecord(id);
  return b ? toPublicBusiness(b) : null;
}

/** Commerces dont l'utilisateur est membre (tous rôles) ou propriétaire historique (owner_id), du plus ancien au plus récent. */
export async function listBusinessesForUser(userId: string): Promise<Business[]> {
  if (userId === DEMO_BUSINESS_ID) return [toPublicBusiness(buildDemo().business)];
  if (isSupabaseEnabled()) {
    if (!isUuid(userId)) return [];
    const { data: ms, error: e1 } = await sb().from('memberships').select('business_id').eq('user_id', userId);
    fail('listBusinessesForUser.memberships', e1);
    const ids = (ms ?? []).map((m: { business_id: string }) => m.business_id).filter(isUuid);
    let q = sb().from('businesses').select('*');
    q = ids.length ? q.or(`owner_id.eq.${userId},id.in.(${ids.join(',')})`) : q.eq('owner_id', userId);
    const { data, error } = await q.order('created_at', { ascending: true });
    fail('listBusinessesForUser', error);
    return (data ?? []).map((r) => toPublicBusiness(rowToBusiness(r as BusinessRow)));
  }
  const store = await mem();
  const memberOf = new Set(
    Object.values(store.memberships)
      .filter((m) => m.userId === userId)
      .map((m) => m.businessId),
  );
  return Object.values(store.businesses)
    .filter((b) => b.ownerId === userId || memberOf.has(b.id))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map(toPublicBusiness);
}

export interface CreateBusinessInput {
  name: string;
  trade: string;
  city: string;
  district?: string;
  website?: string;
  contactEmail?: string;
  ownerId?: string | null;
  plan?: Business['plan'];
  segment?: Segment;
  planId?: PlanId | null;
  stripeCustomerId?: string;
  sourceLeadId?: string;
  /** Entrée complète de l'audit d'origine (relue par les audits planifiés : segment, catégories…). */
  auditInput?: Record<string, unknown> | null;
  needsSetup?: boolean;
}

export async function createBusiness(input: CreateBusinessInput): Promise<BusinessRecord> {
  if (isSupabaseEnabled()) {
    const { data, error } = await sb()
      .from('businesses')
      .insert({
        owner_id: input.ownerId ?? null,
        name: input.name,
        trade: input.trade,
        city: input.city,
        district: input.district ?? null,
        website: input.website ?? null,
        contact_email: input.contactEmail?.toLowerCase() ?? null,
        plan: input.plan ?? 'free',
        segment: input.segment ?? 'local',
        plan_id: input.planId ?? null,
        audit_input: input.auditInput ?? null,
        needs_setup: input.needsSetup ?? false,
        stripe_customer_id: input.stripeCustomerId ?? null,
        source_lead_id: input.sourceLeadId ?? null,
      })
      .select('*')
      .single();
    fail('createBusiness', error);
    return rowToBusiness(data as BusinessRow);
  }
  const store = await mem();
  const b: BusinessRecord = {
    id: crypto.randomUUID(),
    name: input.name,
    trade: input.trade,
    city: input.city,
    district: input.district,
    website: input.website,
    plan: input.plan ?? 'free',
    segment: input.segment ?? 'local',
    planId: input.planId ?? null,
    lastScore: null,
    createdAt: nowIso(),
    needsSetup: input.needsSetup ?? false,
    auditInput: input.auditInput ?? null,
    ownerId: input.ownerId ?? null,
    contactEmail: input.contactEmail?.toLowerCase(),
    stripeCustomerId: input.stripeCustomerId,
    isActive: true,
    alertThreshold: 5,
  };
  store.businesses[b.id] = b;
  await persist('businesses');
  if (b.ownerId) await addMembership(b.id, b.ownerId, 'owner', input.contactEmail ?? null);
  return b;
}

export type BusinessPatch = Partial<
  Pick<
    BusinessRecord,
    | 'plan'
    | 'segment'
    | 'lastScore'
    | 'contactEmail'
    | 'isActive'
    | 'stripeCustomerId'
    | 'ownerId'
    | 'planId'
    | 'needsSetup'
    | 'name'
    | 'trade'
    | 'city'
    | 'district'
    | 'website'
  >
>;

export async function updateBusiness(id: string, patch: BusinessPatch): Promise<void> {
  if (isDemoBusinessId(id)) return;
  if (isSupabaseEnabled()) {
    if (!isUuid(id)) return;
    const row: Record<string, unknown> = {};
    if (patch.plan !== undefined) row.plan = patch.plan;
    if (patch.segment !== undefined) row.segment = patch.segment;
    if (patch.lastScore !== undefined) row.last_score = patch.lastScore;
    if (patch.contactEmail !== undefined) row.contact_email = patch.contactEmail;
    if (patch.isActive !== undefined) row.is_active = patch.isActive;
    if (patch.stripeCustomerId !== undefined) row.stripe_customer_id = patch.stripeCustomerId;
    if (patch.ownerId !== undefined) row.owner_id = patch.ownerId;
    if (patch.planId !== undefined) row.plan_id = patch.planId;
    if (patch.needsSetup !== undefined) row.needs_setup = patch.needsSetup;
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.trade !== undefined) row.trade = patch.trade;
    if (patch.city !== undefined) row.city = patch.city;
    if (patch.district !== undefined) row.district = patch.district || null;
    if (patch.website !== undefined) row.website = patch.website || null;
    if (!Object.keys(row).length) return;
    const { error } = await sb().from('businesses').update(row).eq('id', id);
    fail('updateBusiness', error);
    return;
  }
  const store = await mem();
  const b = store.businesses[id];
  if (!b) return;
  Object.assign(b, patch);
  await persist('businesses');
  if (patch.ownerId) await addMembership(id, patch.ownerId, 'owner', b.contactEmail ?? null);
}

/**
 * Commerces abonnés (plan ≠ free, actifs) dont le dernier audit date de plus de `minDays` jours.
 * Utilisé par le cron mensuel.
 */
export async function listBusinessesDueForAudit(minDays = 28, limit = 50): Promise<BusinessRecord[]> {
  let candidates: BusinessRecord[];
  if (isSupabaseEnabled()) {
    const { data, error } = await sb()
      .from('businesses')
      .select('*')
      // Offres payantes ET Découverte (1 mesure par mois, décision 2) ; jamais un espace à compléter.
      .or('plan.neq.free,plan_id.like.%_decouverte')
      .eq('is_active', true)
      .eq('needs_setup', false)
      .order('updated_at', { ascending: true })
      .limit(500);
    fail('listBusinessesDueForAudit', error);
    candidates = (data ?? []).map((r) => rowToBusiness(r as BusinessRow));
  } else {
    const store = await mem();
    candidates = Object.values(store.businesses).filter(
      (b) => (b.plan !== 'free' || String(b.planId ?? '').endsWith('_decouverte')) && b.isActive && !b.needsSetup,
    );
  }
  const cutoff = Date.now() - minDays * 86_400_000;
  const due: BusinessRecord[] = [];
  for (const b of candidates) {
    if (due.length >= limit) break;
    const last = await getLatestAuditForBusiness(b.id);
    if (!last || new Date(last.createdAt).getTime() < cutoff) due.push(b);
  }
  return due;
}

// ---------------------------------------------------------------------------
// Plan d'action (cases cochées)
// ---------------------------------------------------------------------------

export async function getActionProgress(businessId: string): Promise<Record<string, boolean>> {
  if (isSupabaseEnabled() && !isDemoBusinessId(businessId)) {
    if (!isUuid(businessId)) return {};
    const { data, error } = await sb()
      .from('actions_progress')
      .select('action_key, status')
      .eq('business_id', businessId);
    fail('getActionProgress', error);
    const out: Record<string, boolean> = {};
    for (const r of (data ?? []) as { action_key: string; status: string }[]) out[r.action_key] = r.status === 'done';
    return out;
  }
  const store = await mem();
  return { ...(store.actions[businessId] ?? {}) };
}

export async function setActionProgress(businessId: string, actionId: string, done: boolean): Promise<void> {
  if (isSupabaseEnabled() && !isDemoBusinessId(businessId)) {
    const { error } = await sb()
      .from('actions_progress')
      .upsert(
        {
          business_id: businessId,
          action_key: actionId,
          status: done ? 'done' : 'todo',
          done_at: done ? nowIso() : null,
        },
        { onConflict: 'business_id,action_key' },
      );
    fail('setActionProgress', error);
    return;
  }
  const store = await mem();
  store.actions[businessId] = { ...(store.actions[businessId] ?? {}), [actionId]: done };
  await persist('actions');
}

// ---------------------------------------------------------------------------
// Abonnements (miroir Stripe)
// ---------------------------------------------------------------------------

interface SubscriptionRow {
  id: string;
  user_id: string | null;
  business_id: string | null;
  email: string | null;
  stripe_customer_id: string;
  stripe_subscription_id: string | null;
  plan: PlanId;
  status: SubscriptionStatus;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  action_plan_purchased: boolean;
  commitment_until?: string | null;
  created_at: string;
  updated_at: string;
}

function rowToSub(r: SubscriptionRow): SubscriptionRecord {
  return {
    id: r.id,
    userId: r.user_id,
    businessId: r.business_id,
    email: r.email,
    stripeCustomerId: r.stripe_customer_id,
    stripeSubscriptionId: r.stripe_subscription_id,
    planId: r.plan,
    status: r.status,
    currentPeriodEnd: r.current_period_end,
    cancelAtPeriodEnd: r.cancel_at_period_end,
    actionPlanPurchased: r.action_plan_purchased,
    commitmentUntil: r.commitment_until ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export type SubscriptionUpsert = Partial<Omit<SubscriptionRecord, 'id' | 'createdAt' | 'updatedAt'>> & {
  stripeCustomerId: string;
  planId: PlanId;
  status: SubscriptionStatus;
};

/**
 * Crée ou met à jour un abonnement. Clé : stripeSubscriptionId s'il existe,
 * sinon (achat unique) une ligne par client + plan.
 */
export async function upsertSubscription(s: SubscriptionUpsert): Promise<SubscriptionRecord> {
  // Par identifiant d'abonnement, sinon la ligne du même client et du même plan encore sans abonnement (paiement
  // enregistré avant que l'abonnement ne soit connu) : sans ce repli, une résiliation ne retrouvait pas le commerce.
  const pending = async () =>
    (await listSubscriptionsByCustomer(s.stripeCustomerId)).find((x) => !x.stripeSubscriptionId && x.planId === s.planId) ?? null;
  const existing = s.stripeSubscriptionId
    ? ((await findSubscriptionByStripeId(s.stripeSubscriptionId)) ?? (await pending()))
    : await pending();

  const merged: SubscriptionRecord = {
    id: existing?.id ?? crypto.randomUUID(),
    userId: s.userId ?? existing?.userId ?? null,
    businessId: s.businessId ?? existing?.businessId ?? null,
    email: s.email ?? existing?.email ?? null,
    stripeCustomerId: s.stripeCustomerId,
    stripeSubscriptionId: s.stripeSubscriptionId ?? existing?.stripeSubscriptionId ?? null,
    planId: s.planId,
    status: s.status,
    currentPeriodEnd: s.currentPeriodEnd ?? existing?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: s.cancelAtPeriodEnd ?? existing?.cancelAtPeriodEnd ?? false,
    actionPlanPurchased: s.actionPlanPurchased ?? existing?.actionPlanPurchased ?? false,
    commitmentUntil: s.commitmentUntil ?? existing?.commitmentUntil ?? null,
    createdAt: existing?.createdAt ?? nowIso(),
    updatedAt: nowIso(),
  };

  if (isSupabaseEnabled()) {
    const { error } = await sb().from('subscriptions').upsert(
      {
        id: merged.id,
        user_id: merged.userId,
        business_id: merged.businessId,
        email: merged.email,
        stripe_customer_id: merged.stripeCustomerId,
        stripe_subscription_id: merged.stripeSubscriptionId,
        plan: merged.planId,
        status: merged.status,
        current_period_end: merged.currentPeriodEnd,
        cancel_at_period_end: merged.cancelAtPeriodEnd,
        action_plan_purchased: merged.actionPlanPurchased,
        commitment_until: merged.commitmentUntil ?? null,
      },
      { onConflict: 'id' },
    );
    fail('upsertSubscription', error);
    return merged;
  }
  const store = await mem();
  store.subscriptions[merged.id] = merged;
  await persist('subscriptions');
  return merged;
}

export async function findSubscriptionByStripeId(stripeSubscriptionId: string): Promise<SubscriptionRecord | null> {
  if (isSupabaseEnabled()) {
    const { data, error } = await sb()
      .from('subscriptions')
      .select('*')
      .eq('stripe_subscription_id', stripeSubscriptionId)
      .maybeSingle();
    fail('findSubscriptionByStripeId', error);
    return data ? rowToSub(data as SubscriptionRow) : null;
  }
  const store = await mem();
  return Object.values(store.subscriptions).find((s) => s.stripeSubscriptionId === stripeSubscriptionId) ?? null;
}

export async function listSubscriptionsByCustomer(stripeCustomerId: string): Promise<SubscriptionRecord[]> {
  if (isSupabaseEnabled()) {
    const { data, error } = await sb().from('subscriptions').select('*').eq('stripe_customer_id', stripeCustomerId);
    fail('listSubscriptionsByCustomer', error);
    return (data ?? []).map((r) => rowToSub(r as SubscriptionRow));
  }
  const store = await mem();
  return Object.values(store.subscriptions).filter((s) => s.stripeCustomerId === stripeCustomerId);
}

/** Idempotence du webhook Stripe : true si l'événement est nouveau (et le marque comme traité). */
export async function markStripeEventProcessed(eventId: string, type: string): Promise<boolean> {
  if (isSupabaseEnabled()) {
    const { error } = await sb().from('stripe_events').insert({ id: eventId, type });
    if (error) {
      if ((error as { code?: string }).code === '23505') return false;
      fail('markStripeEventProcessed', error);
    }
    return true;
  }
  const store = await mem();
  if (store.stripeEvents[eventId]) return false;
  store.stripeEvents[eventId] = nowIso();
  await persist('stripeEvents');
  return true;
}

/** Annule le marquage (si le traitement a échoué, Stripe pourra réessayer). */
export async function unmarkStripeEvent(eventId: string): Promise<void> {
  if (isSupabaseEnabled()) {
    await sb().from('stripe_events').delete().eq('id', eventId);
    return;
  }
  const store = await mem();
  delete store.stripeEvents[eventId];
  await persist('stripeEvents');
}

// ---------------------------------------------------------------------------
// Liste d'opposition (désinscription) — jamais vidée (docs/06-juridique.md, E7)
// ---------------------------------------------------------------------------

export async function addSuppression(email: string, reason = 'unsubscribe'): Promise<void> {
  const h = hashEmail(email);
  if (isSupabaseEnabled()) {
    const { error } = await sb()
      .from('suppression')
      .upsert({ email_hash: h, reason }, { onConflict: 'email_hash', ignoreDuplicates: true });
    fail('addSuppression', error);
    return;
  }
  const store = await mem();
  if (!store.suppression[h]) {
    store.suppression[h] = nowIso();
    await persist('suppression');
  }
}

export async function isSuppressed(email: string): Promise<boolean> {
  const h = hashEmail(email);
  if (isSupabaseEnabled()) {
    const { data, error } = await sb().from('suppression').select('email_hash').eq('email_hash', h).maybeSingle();
    fail('isSuppressed', error);
    return Boolean(data);
  }
  const store = await mem();
  return Boolean(store.suppression[h]);
}

// ---------------------------------------------------------------------------
// Journal des alertes
// ---------------------------------------------------------------------------

export async function recordAlert(a: {
  businessId: string;
  auditId?: string | null;
  type: AlertType;
  title: string;
  body?: string;
  payload?: Record<string, unknown>;
  emailSent?: boolean;
}): Promise<void> {
  const emailSentAt = a.emailSent ? nowIso() : null;
  // Comptes démo : jamais en base (clé étrangère), journal mémoire uniquement.
  if (isSupabaseEnabled() && !isDemoBusinessId(a.businessId)) {
    const { error } = await sb().from('alerts').insert({
      business_id: a.businessId,
      audit_id: a.auditId ?? null,
      type: a.type,
      title: a.title,
      body: a.body ?? null,
      payload: a.payload ?? {},
      email_sent_at: emailSentAt,
    });
    fail('recordAlert', error);
    return;
  }
  const store = await mem();
  store.alerts.push({
    id: crypto.randomUUID(),
    businessId: a.businessId,
    auditId: a.auditId ?? null,
    type: a.type,
    title: a.title,
    body: a.body,
    payload: a.payload ?? {},
    emailSentAt,
    createdAt: nowIso(),
  });
  if (store.alerts.length > 1000) store.alerts.splice(0, store.alerts.length - 1000);
  await persist('alerts');
}

// ---------------------------------------------------------------------------
// Authentification (Supabase Auth, jeton d'accès envoyé par le client)
// ---------------------------------------------------------------------------

/** Renvoie l'id utilisateur d'un jeton d'accès Supabase, ou null. */
export async function getUserIdFromAccessToken(token: string | null | undefined): Promise<string | null> {
  if (!token || !isSupabaseEnabled()) return null;
  const { data, error } = await sb().auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

// ---------------------------------------------------------------------------
// V2 — alertes (lecture), accès, digest, benchmark
// ---------------------------------------------------------------------------

export interface AlertEntry {
  id: string;
  businessId: string;
  auditId: string | null;
  type: AlertType;
  title: string;
  body?: string;
  payload: Record<string, unknown>;
  emailSentAt: string | null;
  createdAt: string;
}

/** Alertes d'un commerce, de la plus récente à la plus ancienne. */
export async function listAlerts(businessId: string, limit = 50): Promise<AlertEntry[]> {
  if (isSupabaseEnabled() && !isDemoBusinessId(businessId)) {
    if (!isUuid(businessId)) return [];
    const { data, error } = await sb()
      .from('alerts')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(limit);
    fail('listAlerts', error);
    return (data ?? []).map((r: Record<string, unknown>) => ({
      id: String(r.id),
      businessId: String(r.business_id),
      auditId: (r.audit_id as string | null) ?? null,
      type: r.type as AlertType,
      title: String(r.title),
      body: (r.body as string | null) ?? undefined,
      payload: (r.payload as Record<string, unknown>) ?? {},
      emailSentAt: (r.email_sent_at as string | null) ?? null,
      createdAt: String(r.created_at),
    }));
  }
  const store = await mem();
  return store.alerts
    .filter((a) => a.businessId === businessId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
    .map((a) => ({ ...a }));
}

/**
 * Contrôle d'accès des routes V2 (facts, copilot, digest, benchmark) — conservé pour ses appelants, délègue à
 * `requireBusiness` de @/lib/auth (session par cookie httpOnly ou Bearer, rôles, démo en lecture).
 * Nouveau code : utiliser directement `requireBusiness`.
 */
export async function canAccessBusiness(
  req: Request,
  businessId: string,
): Promise<{ ok: true; business: BusinessRecord } | { ok: false; status: 400 | 401 | 403 | 404 | 503 }> {
  const { requireBusiness, HttpError } = await import('@/lib/auth');
  try {
    const { business } = await requireBusiness(req, businessId);
    return { ok: true, business: business as BusinessRecord };
  } catch (e) {
    if (e instanceof HttpError) {
      const s = e.status;
      return { ok: false, status: (s === 400 || s === 401 || s === 404 || s === 503 ? s : 403) as 400 | 401 | 403 | 404 | 503 };
    }
    throw e;
  }
}

// ---------------------------------------------------------------------------
// V3 — équipes : memberships (rôles) et invitations (supabase/migrations/0003_comptes.sql)
// ---------------------------------------------------------------------------

export interface MembershipRecord {
  businessId: string;
  userId: string;
  role: Role;
  /** E-mail du membre au moment de l'ajout (affichage). */
  email: string | null;
  createdAt: string;
}

export interface InvitationRecord {
  id: string;
  businessId: string;
  email: string;
  role: Exclude<Role, 'owner'>;
  /** SHA-256 du jeton envoyé par e-mail (le jeton lui-même n'est jamais stocké). */
  tokenHash: string;
  invitedBy: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  acceptedBy: string | null;
  revokedAt: string | null;
  createdAt: string;
}

interface MembershipRow {
  business_id: string;
  user_id: string;
  role: Role;
  email: string | null;
  created_at: string;
}

const rowToMembership = (r: MembershipRow): MembershipRecord => ({
  businessId: r.business_id,
  userId: r.user_id,
  role: r.role,
  email: r.email,
  createdAt: r.created_at,
});

interface InvitationRow {
  id: string;
  business_id: string;
  email: string;
  role: InvitationRecord['role'];
  token_hash: string;
  invited_by: string | null;
  expires_at: string;
  accepted_at: string | null;
  accepted_by: string | null;
  revoked_at: string | null;
  created_at: string;
}

const rowToInvitation = (r: InvitationRow): InvitationRecord => ({
  id: r.id,
  businessId: r.business_id,
  email: r.email,
  role: r.role,
  tokenHash: r.token_hash,
  invitedBy: r.invited_by,
  expiresAt: r.expires_at,
  acceptedAt: r.accepted_at,
  acceptedBy: r.accepted_by,
  revokedAt: r.revoked_at,
  createdAt: r.created_at,
});

const mKey = (businessId: string, userId: string) => `${businessId}:${userId}`;

/** Ajoute (ou met à jour le rôle d') un membre. Idempotent. */
export async function addMembership(businessId: string, userId: string, role: Role, email: string | null = null): Promise<void> {
  if (isDemoBusinessId(businessId)) return;
  if (isSupabaseEnabled()) {
    if (!isUuid(businessId) || !isUuid(userId)) return;
    const { error } = await sb()
      .from('memberships')
      .upsert({ business_id: businessId, user_id: userId, role, email: email?.toLowerCase() ?? null }, { onConflict: 'business_id,user_id' });
    fail('addMembership', error);
    return;
  }
  const store = await mem();
  const k = mKey(businessId, userId);
  const prev = store.memberships[k];
  store.memberships[k] = {
    businessId,
    userId,
    role,
    email: email?.toLowerCase() ?? prev?.email ?? null,
    createdAt: prev?.createdAt ?? nowIso(),
  };
  await persist('memberships');
}

export async function getMembership(businessId: string, userId: string): Promise<MembershipRecord | null> {
  if (isSupabaseEnabled()) {
    if (!isUuid(businessId) || !isUuid(userId)) return null;
    const { data, error } = await sb()
      .from('memberships')
      .select('*')
      .eq('business_id', businessId)
      .eq('user_id', userId)
      .maybeSingle();
    fail('getMembership', error);
    return data ? rowToMembership(data as MembershipRow) : null;
  }
  const store = await mem();
  return store.memberships[mKey(businessId, userId)] ?? null;
}

export async function listMembers(businessId: string): Promise<MembershipRecord[]> {
  if (isSupabaseEnabled()) {
    if (!isUuid(businessId)) return [];
    const { data, error } = await sb()
      .from('memberships')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: true });
    fail('listMembers', error);
    return (data ?? []).map((r) => rowToMembership(r as MembershipRow));
  }
  const store = await mem();
  return Object.values(store.memberships)
    .filter((m) => m.businessId === businessId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function listMembershipsForUser(userId: string): Promise<MembershipRecord[]> {
  if (isSupabaseEnabled()) {
    if (!isUuid(userId)) return [];
    const { data, error } = await sb().from('memberships').select('*').eq('user_id', userId);
    fail('listMembershipsForUser', error);
    return (data ?? []).map((r) => rowToMembership(r as MembershipRow));
  }
  const store = await mem();
  return Object.values(store.memberships).filter((m) => m.userId === userId);
}

export async function removeMembership(businessId: string, userId: string): Promise<void> {
  if (isSupabaseEnabled()) {
    if (!isUuid(businessId) || !isUuid(userId)) return;
    const { error } = await sb().from('memberships').delete().eq('business_id', businessId).eq('user_id', userId);
    fail('removeMembership', error);
    return;
  }
  const store = await mem();
  delete store.memberships[mKey(businessId, userId)];
  await persist('memberships');
}

export async function createInvitation(
  inv: Omit<InvitationRecord, 'id' | 'createdAt' | 'acceptedAt' | 'acceptedBy' | 'revokedAt'>,
): Promise<InvitationRecord> {
  const rec: InvitationRecord = {
    ...inv,
    email: inv.email.trim().toLowerCase(),
    id: crypto.randomUUID(),
    acceptedAt: null,
    acceptedBy: null,
    revokedAt: null,
    createdAt: nowIso(),
  };
  if (isSupabaseEnabled()) {
    const { error } = await sb().from('invitations').insert({
      id: rec.id,
      business_id: rec.businessId,
      email: rec.email,
      role: rec.role,
      token_hash: rec.tokenHash,
      invited_by: rec.invitedBy,
      expires_at: rec.expiresAt,
    });
    fail('createInvitation', error);
    return rec;
  }
  const store = await mem();
  store.invitations[rec.id] = rec;
  await persist('invitations');
  return rec;
}

export async function findInvitationByTokenHash(tokenHash: string): Promise<InvitationRecord | null> {
  if (isSupabaseEnabled()) {
    const { data, error } = await sb().from('invitations').select('*').eq('token_hash', tokenHash).maybeSingle();
    fail('findInvitationByTokenHash', error);
    return data ? rowToInvitation(data as InvitationRow) : null;
  }
  const store = await mem();
  return Object.values(store.invitations).find((i) => i.tokenHash === tokenHash) ?? null;
}

/** Invitations en attente (ni acceptées, ni révoquées, ni expirées). */
export async function listPendingInvitations(businessId: string): Promise<InvitationRecord[]> {
  let all: InvitationRecord[];
  if (isSupabaseEnabled()) {
    if (!isUuid(businessId)) return [];
    const { data, error } = await sb()
      .from('invitations')
      .select('*')
      .eq('business_id', businessId)
      .is('accepted_at', null)
      .is('revoked_at', null);
    fail('listPendingInvitations', error);
    all = (data ?? []).map((r) => rowToInvitation(r as InvitationRow));
  } else {
    const store = await mem();
    all = Object.values(store.invitations).filter((i) => i.businessId === businessId && !i.acceptedAt && !i.revokedAt);
  }
  const now = Date.now();
  return all.filter((i) => new Date(i.expiresAt).getTime() > now).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function updateInvitation(
  id: string,
  patch: Partial<Pick<InvitationRecord, 'acceptedAt' | 'acceptedBy' | 'revokedAt'>>,
): Promise<void> {
  if (isSupabaseEnabled()) {
    if (!isUuid(id)) return;
    const row: Record<string, unknown> = {};
    if (patch.acceptedAt !== undefined) row.accepted_at = patch.acceptedAt;
    if (patch.acceptedBy !== undefined) row.accepted_by = patch.acceptedBy;
    if (patch.revokedAt !== undefined) row.revoked_at = patch.revokedAt;
    const { error } = await sb().from('invitations').update(row).eq('id', id);
    fail('updateInvitation', error);
    return;
  }
  const store = await mem();
  const i = store.invitations[id];
  if (!i) return;
  Object.assign(i, patch);
  await persist('invitations');
}

/**
 * Rattachement d'un commerce sans propriétaire à un utilisateur dont l'e-mail est CONFIRMÉ (faille A3/S1 de docs/v3/10).
 * - `businessIds` fournis : rattache ces commerces s'ils sont sans propriétaire et que leur e-mail de contact est celui
 *   de l'utilisateur (lien signé envoyé à cette adresse : inscription Découverte, achat) ;
 * - sinon : filet de sécurité à chaque connexion, limité aux commerces PAYÉS (une ligne `subscriptions`) à cet e-mail.
 * L'appelant garantit que `email` est confirmé (session issue d'un lien magique) ; avec Supabase, les fonctions SQL
 * revérifient `auth.users.email_confirmed_at`.
 * @returns ids des commerces rattachés
 */
export async function claimBusinessesForUser(
  userId: string,
  email: string,
  opts: { businessIds?: string[] } = {},
): Promise<string[]> {
  const e = email.trim().toLowerCase();
  if (isSupabaseEnabled()) {
    if (!isUuid(userId)) return [];
    const claimed: string[] = [];
    for (const id of (opts.businessIds ?? []).filter(isUuid)) {
      const { data, error } = await sb().rpc('claim_business', { p_user: userId, p_business: id });
      fail('claim_business', error);
      if (data === true) claimed.push(id);
    }
    if (!opts.businessIds) {
      const { data, error } = await sb().rpc('claim_paid_businesses', { p_user: userId });
      fail('claim_paid_businesses', error);
      for (const r of (data ?? []) as ({ business_id?: string } | string)[]) {
        const id = typeof r === 'string' ? r : r.business_id;
        if (id) claimed.push(id);
      }
    }
    return claimed;
  }
  const store = await mem();
  const paid = new Set(
    Object.values(store.subscriptions)
      .map((s) => s.businessId)
      .filter((x): x is string => Boolean(x)),
  );
  const wanted = opts.businessIds ? new Set(opts.businessIds) : null;
  const claimed: string[] = [];
  for (const b of Object.values(store.businesses)) {
    if (b.ownerId || (b.contactEmail ?? '').toLowerCase() !== e) continue;
    if (wanted ? !wanted.has(b.id) : !paid.has(b.id)) continue;
    b.ownerId = userId;
    claimed.push(b.id);
  }
  if (claimed.length) {
    await persist('businesses');
    for (const id of claimed) await addMembership(id, userId, 'owner', e);
    for (const s of Object.values(store.subscriptions)) {
      if (!s.userId && s.businessId && claimed.includes(s.businessId)) s.userId = userId;
    }
    await persist('subscriptions');
  }
  return claimed;
}

/** Commerces rattachés à un client Stripe (2ᵉ achat, portail). */
export async function listBusinessesByStripeCustomer(customerId: string): Promise<BusinessRecord[]> {
  if (isSupabaseEnabled()) {
    const { data, error } = await sb().from('businesses').select('*').eq('stripe_customer_id', customerId);
    fail('listBusinessesByStripeCustomer', error);
    return (data ?? []).map((r) => rowToBusiness(r as BusinessRow));
  }
  const store = await mem();
  return Object.values(store.businesses).filter((b) => b.stripeCustomerId === customerId);
}

/** Commerces abonnés, actifs, avec une adresse de contact : destinataires du digest du lundi. */
export async function listBusinessesForDigest(limit = 500): Promise<BusinessRecord[]> {
  if (isSupabaseEnabled()) {
    const { data, error } = await sb()
      .from('businesses')
      .select('*')
      .neq('plan', 'free')
      .eq('is_active', true)
      .not('contact_email', 'is', null)
      .order('created_at', { ascending: true })
      .limit(limit);
    fail('listBusinessesForDigest', error);
    return (data ?? []).map((r) => rowToBusiness(r as BusinessRow));
  }
  const store = await mem();
  return Object.values(store.businesses)
    .filter((b) => b.plan !== 'free' && b.isActive && b.contactEmail)
    .slice(0, limit);
}

const normKey = (s: string | undefined | null) =>
  (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/**
 * Derniers audits réels (hors démo) d'une cohorte métier × zone, un par entreprise (nom normalisé).
 * Sert au benchmark sectoriel anonymisé (publié seulement à partir de 5 entreprises).
 */
export async function listCohortAudits(cohort: { trade: string; city: string; district?: string }, limit = 200): Promise<AuditResult[]> {
  let rows: AuditResult[];
  if (isSupabaseEnabled()) {
    // F4 : seulement les audits rattachés à un commerce (pas de cohorte remplie d'audits gratuits fictifs).
    let q = sb().from('audits').select('result').eq('status', 'done').eq('demo', false).not('business_id', 'is', null).eq('result->input->>trade', cohort.trade).eq('result->input->>city', cohort.city);
    if (cohort.district) q = q.eq('result->input->>district', cohort.district);
    const { data, error } = await q.order('created_at', { ascending: false }).limit(limit * 3);
    fail('listCohortAudits', error);
    rows = (data ?? []).map((r: { result: AuditResult }) => r.result);
  } else {
    const store = await mem();
    rows = Object.values(store.audits)
      .filter((a) => Boolean(a.businessId))
      .map((a) => a.result)
      .filter(
        (r) =>
          !r.demo &&
          normKey(r.input.trade) === normKey(cohort.trade) &&
          normKey(r.input.city) === normKey(cohort.city) &&
          (!cohort.district || normKey(r.input.district) === normKey(cohort.district)),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  const seen = new Set<string>();
  const out: AuditResult[] = [];
  for (const r of rows) {
    const k = normKey(r.input.businessName);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
    if (out.length >= limit) break;
  }
  return out;
}
