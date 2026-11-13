/**
 * GET /api/benchmark?businessId=… — rang dans le dernier audit (+ évolution), et benchmark sectoriel anonymisé
 * (métier × zone) uniquement si au moins 5 entreprises de la cohorte ont été mesurées. Aucun nom de tiers n'est exposé
 * dans le benchmark sectoriel : moyennes et percentile seulement.
 */
import { NextResponse } from 'next/server';
import { canAccessBusiness, listAuditsForBusiness, listCohortAudits } from '@/lib/db';
import type { AuditV2 } from '@/lib/alerts';
import { MIN_COHORT, clientMentions, rankInAudit, sectorBenchmark } from '@/lib/digest/benchmark';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const businessId = new URL(req.url).searchParams.get('businessId');
  if (!businessId || !/^[A-Za-z0-9_-]{1,100}$/.test(businessId)) {
    return NextResponse.json({ error: 'businessId manquant ou invalide.' }, { status: 400 });
  }
  const auth = await canAccessBusiness(req, businessId);
  if (!auth.ok) return NextResponse.json({ error: 'Accès refusé.' }, { status: auth.status });

  try {
    const audits = (await listAuditsForBusiness(businessId)) as AuditV2[];
    const latest = audits.at(-1);
    if (!latest) return NextResponse.json({ rank: null, history: [], sector: null, minCohort: MIN_COHORT });
    const rank = rankInAudit(latest);
    const history = audits.map((a) => {
      const r = rankInAudit(a);
      return { auditId: a.id, at: a.createdAt, rank: r.rank, of: r.of, score: a.score, mentions: clientMentions(a) };
    });
    const ahead = latest.competitors
      .filter((c) => c.mentions > clientMentions(latest))
      .slice(-1)
      .map((c) => ({ name: c.name, gap: c.mentions - clientMentions(latest) }))[0] ?? null;
    const cohort = latest.demo ? [] : await listCohortAudits({ trade: latest.input.trade, city: latest.input.city, district: latest.input.district });
    const sector = sectorBenchmark(latest, cohort);
    return NextResponse.json({
      rank,
      /** acteur juste devant (écart en nombre de citations) */
      nextAhead: ahead,
      history,
      sector,
      sectorNote: sector ? null : `Benchmark sectoriel publié à partir de ${MIN_COHORT} entreprises mesurées dans votre métier et votre zone.`,
      minCohort: MIN_COHORT,
      demo: Boolean(latest.demo),
    });
  } catch (e) {
    console.error('[api/benchmark]', e);
    return NextResponse.json({ error: 'Benchmark indisponible.' }, { status: 500 });
  }
}
