// Chargement des données du tableau de bord (côté serveur uniquement).
// Session serveur (@/lib/auth : cookies httpOnly, jamais lus en JavaScript) → commerces de l'utilisateur.
// Connecté sans espace → /bienvenue ; erreur de base → erreur affichée ; JAMAIS de repli silencieux sur la démo.
// Sans session : démo (le middleware n'ouvre /app sans session que pour une démo choisie explicitement).
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { COOKIES } from '@/lib/auth/cookies';
import {
  getDemoBusiness,
  listAuditsForBusiness,
  listBusinessesForUser,
  type Business,
} from '@/lib/db';
import type { AuditResult, CompetitorStat } from '@/lib/engine';

export const BUSINESS_COOKIE = COOKIES.business;

export interface DashboardData {
  business: Business;
  businesses: Business[];
  /** Audits triés du plus ancien au plus récent. */
  audits: AuditResult[];
  latest: AuditResult | null;
  previous: AuditResult | null;
  demo: boolean;
  userEmail: string | null;
}

export function supabasePublicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? '';
  return { url, anonKey, configured: Boolean(url && anonKey) };
}

export function auditDate(a: AuditResult): string {
  return a.measuredAt ?? a.createdAt;
}

function sortAudits(list: AuditResult[]) {
  return [...list].sort((a, b) => new Date(auditDate(a)).getTime() - new Date(auditDate(b)).getTime());
}

async function sessionUser(): Promise<{ id: string; email: string | null } | null> {
  const session = await getSession();
  return session ? { id: session.userId, email: session.email || null } : null;
}

function build(business: Business, businesses: Business[], audits: AuditResult[], demo: boolean, userEmail: string | null): DashboardData {
  const sorted = sortAudits(audits);
  return {
    business,
    businesses,
    audits: sorted,
    latest: sorted.at(-1) ?? null,
    previous: sorted.length > 1 ? sorted[sorted.length - 2] : null,
    demo,
    userEmail,
  };
}

export const loadDashboard = cache(async (): Promise<DashboardData> => {
  const user = await sessionUser();
  if (user) {
    // Une erreur de lecture remonte (page d'erreur de /app) : jamais la démo à la place des données du client.
    const businesses = await listBusinessesForUser(user.id);
    if (businesses.length) {
      const wanted = (await cookies()).get(BUSINESS_COOKIE)?.value;
      const business = businesses.find((b) => b.id === wanted) ?? businesses[0];
      const audits = await listAuditsForBusiness(business.id);
      return build(business, businesses, audits, false, user.email);
    }
    // Connecté sans espace : démo seulement si choisie explicitement (cookie de démo), sinon /bienvenue.
    const demo = (await cookies()).get(COOKIES.demo)?.value;
    if (!demo) redirect('/bienvenue');
  }
  const { business, audits } = await getDemoBusiness();
  return build(business, [business], audits, true, null);
});

/** Part de voix du commerce et classement avec les concurrents ("Vous" inséré à son rang). */
export function ranking(a: AuditResult) {
  const me = { name: 'Vous', share: a.shareOfVoice, mentions: Math.round(a.mentionRate * a.mentions.length), isMe: true };
  const rows = [
    ...a.competitors.map((c: CompetitorStat) => ({ name: c.name, share: c.share, mentions: c.mentions, isMe: false })),
    me,
  ].sort((x, y) => y.share - x.share);
  return rows;
}

/** Concurrent le plus cité qui vous dépasse, et s'il vient de vous dépasser par rapport à l'audit précédent. */
export function overtaker(latest: AuditResult, previous: AuditResult | null) {
  const top = [...latest.competitors].sort((x, y) => y.share - x.share).find((c) => c.share > latest.shareOfVoice);
  if (!top) return null;
  let isNew = false;
  if (previous) {
    const before = previous.competitors.find((c) => c.name === top.name);
    isNew = !before || before.share <= previous.shareOfVoice;
  }
  return { competitor: top, isNew, gap: top.share - latest.shareOfVoice };
}
