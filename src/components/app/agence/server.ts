// Contexte agence des écrans (serveur uniquement) — agent AGENCES (V6).
import { cache } from 'react';
import { cookies } from 'next/headers';
import { getSession } from '@/lib/auth';
import { agencyContextFor, DEMO_AGENCY_COOKIE, DEMO_AGENCY_PROFILE, loadDemoPortfolio, loadRealPortfolio, type AgencyContext } from '@/lib/agency/load';
import { agencyProfileForBusiness, getAgencyProfile, type AgencyProfile } from '@/lib/agency/profile';
import type { PortfolioClient } from '@/lib/agency/portfolio';
import { brandFromProfile, type ReportBrand } from '@/lib/reports/monthly';
import { loadWorkspace } from '../workspace';
import { loadEntitlements } from '../shell/server';

export interface AgencyView {
  mode: 'demo' | 'real' | 'none';
  ctx: AgencyContext | null;
  profile: AgencyProfile | null;
}

/** Repère du compte démo agence (posé par /app/agence/demo). */
export async function isDemoAgency(): Promise<boolean> {
  return (await cookies()).get(DEMO_AGENCY_COOKIE)?.value === '1';
}

export const loadAgency = cache(async (): Promise<AgencyView> => {
  const ws = await loadWorkspace();
  if (ws.demo) return { mode: 'demo', ctx: { agencyId: DEMO_AGENCY_PROFILE.agencyId, demo: true, clientIds: [], otherCount: 0, maxClients: 20 }, profile: DEMO_AGENCY_PROFILE };
  const session = await getSession();
  if (!session) return { mode: 'none', ctx: null, profile: null };
  const ctx = await agencyContextFor(session).catch(() => null);
  if (!ctx) return { mode: 'none', ctx: null, profile: null };
  return { mode: 'real', ctx, profile: await getAgencyProfile(ctx.agencyId).catch(() => null) };
});

export const loadPortfolio = cache(async (): Promise<PortfolioClient[]> => {
  const a = await loadAgency();
  if (a.mode === 'demo') return loadDemoPortfolio();
  if (a.mode === 'real' && a.ctx) return loadRealPortfolio(a.ctx);
  return [];
});

/** Le lien « Tous mes clients » de la coquille : offre Agence, ou compte démo agence. */
export const showAgencyNav = cache(async (): Promise<boolean> => {
  const ws = await loadWorkspace();
  if (ws.demo) return isDemoAgency();
  const ent = await loadEntitlements().catch(() => null);
  if (ent?.agency.portfolio) return true;
  return (await loadAgency()).mode === 'real';
});

/** Marque du rapport de l'espace courant : agence (offre Agence ou démo agence), sinon Repéré. */
export const loadReportBrand = cache(async (): Promise<ReportBrand> => {
  const ws = await loadWorkspace();
  if (ws.demo) return brandFromProfile(DEMO_AGENCY_PROFILE, await isDemoAgency());
  const ent = await loadEntitlements().catch(() => null);
  if (!ent?.agency.branding) return brandFromProfile(null, false);
  const p = await agencyProfileForBusiness(ws.business.id).catch(() => null);
  return brandFromProfile(p, true);
});
