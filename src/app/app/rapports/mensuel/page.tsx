import Link from 'next/link';
import '@/components/app/agence/agence.css';
import { PageHeader } from '@/components/app/PageHeader';
import { BrandMark } from '@/components/app/agence/BrandMark';
import { PrintButton } from '@/components/app/agence/PrintButton';
import { loadReportBrand } from '@/components/app/agence/server';
import { loadWorkspace, auditDate } from '@/components/app/workspace';
import { loadRanks, loadSeoSuite } from '@/components/app/seo/data';
import { topFixes, SEVERITY_LABEL } from '@/components/app/seo/model';
import { auditStats } from '@/lib/digest/stats';
import { listChangeSets } from '@/lib/publish';
import { buildMonthlyReport } from '@/lib/reports/monthly';

export const metadata = { title: 'Rapport mensuel' };
export const maxDuration = 60;

const frDay = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'Europe/Paris' });

export default async function RapportMensuelPage() {
  const ws = await loadWorkspace();
  const [brand, suite, ranks, sets] = await Promise.all([loadReportBrand(), loadSeoSuite(), loadRanks(), listChangeSets(ws.business.id).catch(() => [])]);
  const now = new Date();
  const since = new Date(now.getTime() - 31 * 86_400_000).toISOString();
  const latest = ws.latest;
  const stats = latest ? auditStats(latest) : null;
  const prevStats = ws.previous ? auditStats(ws.previous) : null;
  const seoRun = suite.latest;
  const r = buildMonthlyReport({
    brand,
    client: { name: ws.business.name, descriptor: ws.business.descriptor },
    demo: ws.demo,
    ai:
      latest && stats
        ? { score: latest.score, low: latest.range?.low ?? latest.score, high: latest.range?.high ?? latest.score, at: auditDate(latest), rank: stats.rank, of: stats.of, shareOfVoice: stats.shareOfVoice, errors: latest.factCheck?.errors ?? 0 }
        : null,
    aiPrev: ws.previous && prevStats ? { score: ws.previous.score, rank: prevStats.rank } : null,
    aiHistory: ws.audits.map((a) => ({ at: auditDate(a), score: a.score })),
    seo: seoRun ? { score: seoRun.seo.score, at: seoRun.at, pages: seoRun.pagesCrawled, fixes: topFixes(seoRun.seo, seoRun.geo, 5).map((f) => ({ title: f.title, severity: SEVERITY_LABEL[f.severity], affected: f.affectedCount })) } : null,
    seoPrev: suite.previous ? { score: suite.previous.seo.score } : null,
    ranks: ranks?.report?.keywords.length
      ? {
          keywords: new Set(ranks.report.keywords.map((k) => k.keyword)).size,
          top3: ranks.report.distribution.top3,
          top10: ranks.report.distribution.top10,
          up: ranks.report.movers.up.slice(0, 3).map((k) => ({ keyword: k.keyword, change: k.change ?? 0, position: k.position })),
          down: ranks.report.movers.down.slice(0, 3).map((k) => ({ keyword: k.keyword, change: k.change ?? 0, position: k.position })),
          demo: ranks.report.demo,
        }
      : null,
    agent: {
      applied: sets.filter((c) => (c.status === 'applied' || c.status === 'verified' || c.status === 'partially_applied') && (c.appliedAt ?? '') >= (ws.demo ? '' : since)).map((c) => ({ title: c.title, at: c.appliedAt ?? c.createdAt })),
      pending: sets.filter((c) => c.status === 'proposed').map((c) => ({ title: c.title })),
    },
    now,
  });
  const maxH = Math.max(1, ...(r.ai?.history ?? []).map((h) => h.score));
  return (
    <>
      <PageHeader title="Rapport mensuel" back={{ href: '/app/rapports', label: 'Rapports' }} meta={r.brand.agency ? `À la marque ${r.brand.name}` : 'Version imprimable'} actions={<PrintButton />} />
      <div className="rp-page flex flex-col gap-4">
        {!r.brand.agency && (
          <p className="ag-noprint text-[13px] text-[var(--muted)]">
            Avec l’offre Agence, ce rapport porte votre nom, votre logo et votre couleur à la place de Repéré. <Link href="/app?compte=demo-agence" className="underline">Voir la démo agence</Link>
          </p>
        )}
        <article className="ag-report" style={{ ['--ag-color' as string]: r.brand.color }} aria-labelledby="rm-h">
          <header className="ag-report-head">
            <div className="flex items-center gap-3">
              <BrandMark name={r.brand.name} logoUrl={r.brand.logoUrl} size={44} />
              <div>
                <p style={{ fontWeight: 700, fontSize: 16 }}>{r.brand.name}</p>
                <p className="ag-muted">{r.title}</p>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontWeight: 650 }}>{r.client.name}</p>
              <p className="ag-muted">{r.client.descriptor}</p>
            </div>
          </header>
          <section className="ag-report-sec">
            {r.demo && (
              <p className="ag-muted" style={{ marginBottom: 6 }}>
                <strong>Démonstration</strong> : données fictives.
              </p>
            )}
            <h1 id="rm-h" className="rp-display" style={{ fontSize: 24, lineHeight: 1.25 }} data-tone={r.headline.tone}>
              {r.headline.text}
            </h1>
            <p className="ag-muted" style={{ marginTop: 4 }}>
              {r.period}
            </p>
          </section>
          <section className="ag-report-sec ag-report-grid" aria-label="Scores">
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 650 }}>Visibilité dans les IA</h2>
              {r.ai ? (
                <>
                  <p className="ag-big rp-num" style={{ marginTop: 8 }}>
                    {r.ai.score}
                    <span style={{ fontSize: 18, color: '#5a6275', fontWeight: 500 }}>/100</span>
                  </p>
                  <p style={{ fontSize: 14, marginTop: 6 }} data-tone={r.ai.tone}>
                    {r.ai.delta}
                  </p>
                  <p className="ag-muted">
                    Marge {r.ai.range} · {r.ai.rank} · part de voix {r.ai.share}
                  </p>
                  {r.ai.errors > 0 && <p style={{ fontSize: 14, marginTop: 6 }} data-tone="bad">{r.ai.errors} erreur{r.ai.errors > 1 ? 's' : ''} des IA sur vos informations</p>}
                  {r.ai.history.length > 1 && (
                    <div className="ag-hist" role="img" aria-label={`Évolution : ${r.ai.history.map((h) => h.score).join(', ')}`}>
                      {r.ai.history.map((h) => (
                        <span key={h.at} style={{ height: `${Math.max(4, (h.score / maxH) * 100)}%` }} title={`${frDay(h.at)} : ${h.score}`} />
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="ag-muted" style={{ marginTop: 8 }}>
                  Première mesure à venir.
                </p>
              )}
            </div>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 650 }}>Audit Google du site</h2>
              {r.seo ? (
                <>
                  <p className="ag-big rp-num" style={{ marginTop: 8 }}>
                    {r.seo.score}
                    <span style={{ fontSize: 18, color: '#5a6275', fontWeight: 500 }}>/100</span>
                  </p>
                  <p style={{ fontSize: 14, marginTop: 6 }} data-tone={r.seo.tone}>
                    {r.seo.delta}
                  </p>
                  <p className="ag-muted">{r.seo.pages} pages explorées</p>
                </>
              ) : (
                <p className="ag-muted" style={{ marginTop: 8 }}>
                  Pas encore d’audit du site.
                </p>
              )}
            </div>
          </section>
          {r.seo && r.seo.fixes.length > 0 && (
            <section className="ag-report-sec">
              <h2 style={{ fontSize: 15, fontWeight: 650 }}>Les corrections qui comptent ce mois-ci</h2>
              <ul className="ag-list">
                {r.seo.fixes.map((f) => (
                  <li key={f.title}>
                    {f.title} <span className="ag-muted">({f.severity.toLowerCase()}, {f.affected} page{f.affected > 1 ? 's' : ''})</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {r.ranks && (
            <section className="ag-report-sec">
              <h2 style={{ fontSize: 15, fontWeight: 650 }}>Positions Google</h2>
              <p style={{ fontSize: 14, marginTop: 6 }}>
                {r.ranks.keywords} mot{r.ranks.keywords > 1 ? 's' : ''}-clé{r.ranks.keywords > 1 ? 's' : ''} suivi{r.ranks.keywords > 1 ? 's' : ''} : {r.ranks.top3} dans les 3 premiers résultats, {r.ranks.top10} dans les 10 premiers{r.ranks.demo ? ' (démo)' : ''}.
              </p>
              {(r.ranks.up.length > 0 || r.ranks.down.length > 0) && (
                <ul className="ag-list">
                  {r.ranks.up.map((k) => (
                    <li key={`u${k.keyword}`} data-tone="good">
                      « {k.keyword} » : +{k.change} place{k.change > 1 ? 's' : ''}
                      {k.position ? `, ${k.position}e` : ''}
                    </li>
                  ))}
                  {r.ranks.down.map((k) => (
                    <li key={`d${k.keyword}`} data-tone="bad">
                      « {k.keyword} » : −{Math.abs(k.change)} place{Math.abs(k.change) > 1 ? 's' : ''}
                      {k.position ? `, ${k.position}e` : ''}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
          <section className="ag-report-sec">
            <h2 style={{ fontSize: 15, fontWeight: 650 }}>Corrections faites sur le site</h2>
            {r.agent.applied.length ? (
              <ul className="ag-list">
                {r.agent.applied.map((a) => (
                  <li key={a.title + a.at}>
                    {a.title} <span className="ag-muted">({frDay(a.at)})</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ag-muted" style={{ marginTop: 6 }}>
                Aucune correction appliquée ce mois-ci.
              </p>
            )}
            {r.agent.pending.length > 0 && (
              <p style={{ fontSize: 14, marginTop: 10 }}>
                <strong>{r.agent.pending.length}</strong> proposition{r.agent.pending.length > 1 ? 's attendent' : ' attend'} votre validation
                <span className="ag-noprint">
                  {' '}
                  : <Link href="/app/validation" className="underline">les voir</Link>
                </span>
                .
              </p>
            )}
          </section>
          <footer className="ag-report-foot">
            {r.notes.map((n) => (
              <p key={n}>{n}</p>
            ))}
            <p style={{ marginTop: 8 }}>
              {r.brand.footer ?? r.brand.name}
              {r.brand.showRepere && r.brand.agency ? ' · rapport produit avec Repéré' : ''}
            </p>
          </footer>
        </article>
      </div>
    </>
  );
}
