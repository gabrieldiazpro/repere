/**
 * Chargeurs du portefeuille d'agence (serveur) — comptes réels et compte démo agence.
 *
 * Réel : espaces de l'utilisateur dont il est propriétaire ou administrateur ET qui ont le droit `agency.portfolio`
 * (offre Agence). Les autres espaces (un espace Découverte personnel, par exemple) ne sont pas mélangés aux clients.
 * Démo : les trois espaces démo existants (Plomberie Martin, Paysia, Maison Sora : mêmes mesures que partout dans la
 * démo) + un client d'exemple qui vient d'être créé, sans mesure. Tout est étiqueté démo.
 */
import type { AuditResult } from '@/lib/engine';
import type { Segment } from '@/lib/engine/types-v2';
import { previousComparable } from '@/lib/digest/stats';
import { getEntitlements } from '@/lib/entitlements';
import { listDocs } from '@/lib/store';
import { activeClients, getClientGrants } from './clients';
import { portfolioRow, type AiPoint, type ClientInput, type PortfolioClient } from './portfolio';
import type { AgencyProfile } from './profile';

/** Collection des explorations SEO enregistrées par l'app (src/components/app/seo/data.ts, RUN_COLLECTION). */
export const SEO_RUNS = 'appseo.run';

type AnyAudit = AuditResult & { factCheck?: { errors?: number } | null; segment?: string };

const auditAt = (a: Pick<AuditResult, 'measuredAt' | 'createdAt'>) => a.measuredAt || a.createdAt;

export function aiPointOf(a: AnyAudit): AiPoint {
  const score = a.score;
  return { score, low: a.range?.low ?? score, high: a.range?.high ?? score, at: auditAt(a), errors: a.factCheck?.errors ?? 0 };
}

/** Partie IA d'une ligne à partir des audits (du plus ancien au plus récent). */
export function aiPartOf(audits: AnyAudit[]): Pick<ClientInput, 'ai' | 'aiPrev' | 'aiTrend'> {
  const sorted = [...audits].sort((x, y) => auditAt(x).localeCompare(auditAt(y)));
  const last = sorted.at(-1) ?? null;
  const prev = last ? previousComparable(sorted as unknown as Parameters<typeof previousComparable>[0]) : null;
  return { ai: last ? aiPointOf(last) : null, aiPrev: prev ? { score: (prev as unknown as AuditResult).score } : null, aiTrend: sorted.slice(-6).map((a) => a.score) };
}

interface RunDoc {
  businessId: string;
  at: string;
  seo?: { score: number };
}

async function seoPart(businessId: string): Promise<Pick<ClientInput, 'seo' | 'seoPrev'>> {
  const docs = await listDocs<RunDoc>(SEO_RUNS, { businessId, limit: 16 }).catch(() => []);
  const runs = docs
    .map((d) => d.data)
    .filter((r) => r && r.businessId === businessId && typeof r.seo?.score === 'number')
    .sort((a, b) => a.at.localeCompare(b.at));
  const last = runs.at(-1);
  const prev = runs.at(-2);
  return { seo: last ? { score: last.seo!.score, at: last.at } : null, seoPrev: prev ? { score: prev.seo!.score } : null };
}

export interface AgencyContext {
  /** identifiant de l'agence (= utilisateur propriétaire) */
  agencyId: string;
  demo: boolean;
  /** espaces clients gérés (offre Agence, rôle propriétaire ou administrateur) */
  clientIds: string[];
  /** autres espaces du compte, hors portefeuille */
  otherCount: number;
  /** plafond de clients de l'offre */
  maxClients: number;
}

/** Contexte agence d'une session réelle, ou null si le compte n'a aucun espace en offre Agence. */
export async function agencyContextFor(session: { userId: string; email: string }): Promise<AgencyContext | null> {
  const { listBusinessesForUser, getMembership } = await import('@/lib/db');
  const list = await listBusinessesForUser(session.userId);
  const ids: string[] = [];
  let max = 0;
  for (const b of list) {
    const e = getEntitlements(b);
    if (!e.agency.portfolio) continue;
    const m = await getMembership(b.id, session.userId).catch(() => null);
    const role = m?.role ?? ((b as { ownerId?: string | null }).ownerId === session.userId ? 'owner' : null);
    if (role !== 'owner' && role !== 'admin') continue;
    ids.push(b.id);
    max = Math.max(max, e.agency.clients);
  }
  if (!ids.length) return null;
  return { agencyId: session.userId, demo: false, clientIds: ids, otherCount: list.length - ids.length, maxClients: max };
}

export async function loadRealPortfolio(ctx: AgencyContext, now: Date = new Date()): Promise<PortfolioClient[]> {
  const db = await import('@/lib/db');
  const { listChangeSets } = await import('@/lib/publish');
  const out: PortfolioClient[] = [];
  for (const id of ctx.clientIds) {
    const b = await db.getBusinessRecord(id).catch(() => null);
    if (!b) continue;
    const [audits, seo, pending, grants] = await Promise.all([
      db.listAuditsForBusiness(id).catch(() => [] as AuditResult[]),
      seoPart(id),
      listChangeSets(id, { status: ['proposed'] }).then((l) => l.length).catch(() => 0),
      getClientGrants(id).catch(() => ({ businessId: id, clients: [] })),
    ]);
    const segment: Segment = b.segment ?? 'local';
    const place = [b.district, b.city].filter(Boolean).join(' ');
    out.push(
      portfolioRow(
        {
          id,
          name: b.name,
          segment,
          descriptor: [b.trade, place].filter(Boolean).join(' · '),
          demo: false,
          needsSetup: Boolean((b as { needsSetup?: boolean }).needsSetup),
          ...aiPartOf(audits as AnyAudit[]),
          ...seo,
          pending,
          clientSeats: activeClients(grants).length,
        },
        now,
      ),
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// Compte démo agence (`?compte=demo-agence`)
// ---------------------------------------------------------------------------

export const DEMO_AGENCY_ID = 'demo-agence';
export const DEMO_AGENCY_COOKIE = 'rp_demo_agence';

export const DEMO_AGENCY_PROFILE: AgencyProfile = {
  agencyId: DEMO_AGENCY_ID,
  name: 'Agence Exemple',
  logoUrl: null,
  color: '#0f766e',
  senderName: 'Agence Exemple',
  replyTo: 'contact@agence-exemple.example',
  hideRepere: true,
  footer: 'Agence Exemple · agence fictive de démonstration',
  senderDomain: { name: 'agence-exemple.example', localPart: 'rapports', status: 'pending', providerId: null, records: [
    { record: 'SPF', type: 'TXT', name: 'send', value: 'v=spf1 include:amazonses.com ~all', status: 'pending' },
    { record: 'DKIM', type: 'TXT', name: 'resend._domainkey', value: 'p=MIGfMA0G… (valeur fournie à la vérification)', status: 'pending' },
  ], checkedAt: null, error: null },
  updatedAt: '2026-11-02T09:00:00.000Z',
  demo: true,
};

/** Client d'exemple sans mesure (montre l'état « nouveau client »). Non ouvrable : il n'a pas d'espace démo. */
export const DEMO_NEW_CLIENT = { id: 'demo-agence-nouveau', name: 'Atelier Verne', segment: 'local' as Segment, descriptor: 'menuisier · Nantes' };

let demoMemo: { key: string; rows: PortfolioClient[] } | null = null;

export async function loadDemoPortfolio(now: Date = new Date()): Promise<PortfolioClient[]> {
  const key = now.toISOString().slice(0, 10);
  if (demoMemo?.key === key) return demoMemo.rows;
  const { DEMO_IDS, buildDemoWorkspaceById, segmentForDemoId } = await import('@/lib/demo-v2');
  // Mêmes propositions que les écrans Agent et « À valider » de chaque compte démo (comptes cohérents d'un écran à l'autre).
  const { buildDemoAgent } = await import('@/components/app/agent/demo');
  const { demoSiteCrawl, DEMO_CRAWL_STAGES, demoStageDate } = await import('@/lib/seoaudit/demo-crawl');
  const { auditSeo } = await import('@/lib/seoaudit');
  const rows: PortfolioClient[] = [];
  for (const id of DEMO_IDS) {
    const ws = buildDemoWorkspaceById(id);
    if (!ws) continue;
    const segment = segmentForDemoId(id);
    const siteType = segment === 'ecommerce' ? 'ecommerce' : segment === 'pme' ? 'pme' : 'local';
    // Même calcul que l'écran SEO de la démo (src/components/app/seo/data.ts) : mesures de vitesse démo comprises.
    let perf: import('@/lib/seodata/types').PerfData | undefined;
    try {
      const { providersForBusiness } = await import('@/lib/seodata/providers');
      const { ctx, p } = await providersForBusiness(id);
      perf = p.perf && ctx.domain ? await p.perf.measure(`https://${id === 'demo-ecom' ? 'www.' : ''}${ctx.domain}/`).catch(() => undefined) : undefined;
    } catch {
      perf = undefined;
    }
    const seoAt = (s: number) => ({ score: auditSeo(demoSiteCrawl(id, s, now), { siteType, ...(perf ? { perf } : {}) }).score, at: demoStageDate(s, now) });
    let seo: ClientInput['seo'] = null;
    let seoPrev: ClientInput['seoPrev'] = null;
    try {
      seo = seoAt(DEMO_CRAWL_STAGES - 1);
      seoPrev = { score: seoAt(DEMO_CRAWL_STAGES - 2).score };
    } catch {
      /* exploration de démo indisponible : la colonne Google reste vide */
    }
    const b = ws.business;
    rows.push(
      portfolioRow(
        {
          id,
          name: b.name,
          segment,
          descriptor: [b.trade, [b.district, b.city].filter(Boolean).join(' ')].filter(Boolean).join(' · '),
          demo: true,
          ...aiPartOf(ws.audits as AnyAudit[]),
          seo,
          seoPrev,
          pending: buildDemoAgent({
            businessId: id,
            segment,
            name: b.name,
            website: b.website || 'exemple-demo.fr',
            facts: (ws.facts?.facts ?? {}) as Record<string, unknown>,
            tasks: [],
            scores: ws.audits.map((a) => (a as { score: number }).score),
            now,
          }).changeSets.filter((c) => c.status === 'proposed').length,
          clientSeats: id === 'demo' ? 1 : 0,
        },
        now,
      ),
    );
  }
  rows.push(portfolioRow({ ...DEMO_NEW_CLIENT, demo: true, ai: null, aiPrev: null, aiTrend: [], seo: null, seoPrev: null, pending: 0, clientSeats: 0, openable: false }, now));
  demoMemo = { key, rows };
  return rows;
}
