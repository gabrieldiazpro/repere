import { Verdict } from '@/components/app/v4/Verdict';
import Link from 'next/link';
import { adaptTasks, adaptTraffic } from '@/components/app/adapters';
import { Delta } from '@/components/app/Charts';
import { Icon } from '@/components/app/icons';
import { Empty, PageHeader, Panel } from '@/components/app/PageHeader';
import { bandFor, fmtDate, fmtInt, ordinal } from '@/components/app/tokens';
import { auditDate, rankOf } from '@/components/app/workspace';
import { loadActionContext } from '@/components/app/action/context';
import { sortActions } from '@/components/app/action/model';
import { ScheduledReports, ScoreCard, ShareLinks } from '@/components/app/action/ReportsPanels';
import { rankMove } from '@/lib/digest/stats';

export const metadata = { title: 'Rapports' };

export default async function RapportsPage() {
  const { ws, ent } = await loadActionContext();
  const { audits, latest, business } = ws;
  if (!latest) {
    return (
      <>
        <PageHeader title="Rapports" />
        <div className="rp-page">
          <Empty title="Pas encore de rapport">Votre premier rapport apparaîtra ici, avec son PDF.</Empty>
        </div>
      </>
    );
  }
  const [tasks, traffic] = await Promise.all([adaptTasks(business.id, ws.fb), adaptTraffic(business.id, 90, ws.fb)]);
  const list = [...audits].reverse();
  // Bilan trimestriel : même calcul de rang que partout (src/lib/digest/stats.ts), période écrite en toutes lettres.
  const qm = rankMove(audits, 'quarter');
  const start = audits.find((a) => a.id === qm?.fromId) ?? audits[Math.max(0, audits.length - 4)];
  const r0 = rankOf(start);
  const r1 = rankOf(latest);
  const since = new Date(Date.now() - 92 * 86400000).toISOString();
  const doneQ = tasks.filter((t) => t.status === 'done' && (!t.doneAt || t.doneAt >= since));
  const fixes = doneQ.filter((t) => t.kind === 'fact_fix').length;
  const sourcesWon = doneQ.filter((t) => ['directory', 'source_outreach', 'bing_places', 'apple_business'].includes(t.kind)).length;
  const aiVisits = traffic ? traffic.days.reduce((s, d) => s + Object.values(d.visits).reduce((a, b) => a + (b ?? 0), 0), 0) : null;
  // R1 : dates exactes, pas de mois nommés (« du 5 août au 5 novembre 2026 »).
  const sameYear = fmtDate(auditDate(start), { year: 'numeric' }) === fmtDate(auditDate(latest), { year: 'numeric' });
  const period = `du ${fmtDate(auditDate(start), sameYear ? { day: 'numeric', month: 'long' } : undefined)} au ${fmtDate(auditDate(latest))}`;
  // R2 : à zéro, montrer la prochaine source à gagner plutôt qu'un « 0 » qui dévalorise.
  const nextSource = sortActions(tasks.filter((t) => t.status !== 'done' && t.status !== 'skipped' && ['directory', 'source_outreach', 'bing_places', 'apple_business', 'gbp_profile'].includes(t.kind)))[0];

  const stats = [
    { k: 'Places sur le trimestre', v: r0.rank - r1.rank, fmt: (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0'), sub: `${ordinal(r0.rank)} → ${ordinal(r1.rank)} sur ${r1.of}` },
    { k: 'Score sur le trimestre', v: Math.round(latest.score - start.score), fmt: (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0'), sub: `${Math.round(start.score)} → ${Math.round(latest.score)} sur 100` },
    { k: 'Tâches faites', v: doneQ.length, fmt: (n: number) => String(n), sub: sourcesWon || !nextSource ? `${sourcesWon} source${sourcesWon > 1 ? 's' : ''} ou fiche${sourcesWon > 1 ? 's' : ''} obtenue${sourcesWon > 1 ? 's' : ''}` : `Prochaine : ${nextSource.title} (${nextSource.minutes} min)` },
    { k: 'Erreurs corrigées', v: fixes, fmt: (n: number) => String(n), sub: `${latest.factCheck?.errors ?? 0} encore ouverte${(latest.factCheck?.errors ?? 0) > 1 ? 's' : ''}` },
    { k: 'Visites venues des IA', v: aiVisits ?? 0, fmt: (n: number) => (aiVisits === null ? '—' : fmtInt(n)), sub: 'plancher mesuré, 90 jours' },
  ];

  return (
    <>
      <PageHeader
        title="Rapports"
        meta={<>{audits.length} audit{audits.length > 1 ? 's' : ''} conservé{audits.length > 1 ? 's' : ''} depuis {fmtDate(auditDate(audits[0]), { month: 'long', year: 'numeric' })}{latest.demo ? ' · démo' : ''}</>}
      />
      <div className="rp-page" data-visite="rapports">
        <Verdict
          tone={r0.rank - r1.rank > 0 ? 'good' : r0.rank - r1.rank < 0 ? 'bad' : 'neutral'}
          title={
            r0.rank - r1.rank > 0
              ? `Vous avez gagné ${r0.rank - r1.rank} place${r0.rank - r1.rank > 1 ? 's' : ''} ce trimestre`
              : r0.rank - r1.rank < 0
                ? `Vous avez perdu ${r1.rank - r0.rank} place${r1.rank - r0.rank > 1 ? 's' : ''} ce trimestre`
                : `Votre rang est stable ce trimestre : ${ordinal(r1.rank)} sur ${r1.of}`
          }
          lead={`${doneQ.length} tâche${doneQ.length > 1 ? 's' : ''} faite${doneQ.length > 1 ? 's' : ''} ${period}. Le bilan ci-dessous est prêt à partager.`}
          figure={{ value: Math.round(latest.score), suffix: '/100', label: 'score à la dernière mesure' }}
          action={{ href: '#share-h', label: 'Partager le bilan', icon: 'share' }}
          details={<p>Votre historique complet, le bilan trimestriel (envoyé chaque trimestre et 30 jours avant un renouvellement annuel) et tout ce qu’il faut pour le partager : liens, envois automatiques, carte de score.</p>}
          detailsLabel="Ce que contient cet écran"
        />
        <section aria-labelledby="bilan-h" className="rp-panel overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-3 bg-[var(--deep)] px-5 py-5 text-[var(--on-primary)] lg:px-8 lg:py-6">
            <div>
              <p className="text-[13px] text-[var(--on-deep)]">Aperçu · bilan trimestriel</p>
              <h2 id="bilan-h" className="rp-display mt-1 text-[24px] lg:text-[30px]">
                Ce que vous avez obtenu {period}
              </h2>
              <p className="mt-1 text-[13px] text-[var(--on-deep)]">{business.name} · envoyé chaque trimestre et 30 jours avant un renouvellement annuel</p>
            </div>
            <a href={`/api/report/${encodeURIComponent(latest.id)}/pdf`} className="rp-btn border-[var(--on-deep)]/30 bg-transparent text-[var(--on-primary)] hover:bg-[var(--overlay)]" download>
              <Icon name="download" size={16} /> PDF du dernier audit
            </a>
          </div>
          <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            {stats.map((s, i) => (
              <div key={s.k} className={`border-[var(--hair)] p-4 lg:px-6 lg:py-5 ${i < stats.length - 1 ? 'border-r' : ''} border-b lg:border-b-0`}>
                <dt className="text-[12px] text-[var(--muted)]">{s.k}</dt>
                <dd className="rp-display rp-num mt-1 text-[28px]">{s.fmt(s.v)}</dd>
                <dd className="text-[12px] text-[var(--muted)]">{s.sub}</dd>
              </div>
            ))}
          </dl>
          <p className="border-t border-[var(--hair)] px-5 py-3 text-[12px] text-[var(--muted)] lg:px-8">
            Mesures sur échantillon de questions ; les IA varient d’une réponse à l’autre. Les visites sont un plancher : une partie du trafic IA n’est pas mesurable. Aucun résultat n’est garanti.
          </p>
        </section>

        <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
          <Panel id="share-h" title="Liens de partage">
            <ShareLinks businessId={business.id} demo={ws.demo} ent={ent} auditId={latest.id} />
          </Panel>
          <div className="flex flex-col gap-4">
            <Panel id="sched-h" title="Envoi automatique">
              <ScheduledReports businessId={business.id} demo={ws.demo} ent={ent} />
            </Panel>
            <Panel id="card-h" title="Carte de score partageable">
              <ScoreCard businessId={business.id} demo={ws.demo} auditId={latest.id} />
            </Panel>
          </div>
        </div>

        <Panel id="hist-h" title="Historique des audits" pad={false}>
          <div className="rp-scroll px-2 pb-2 lg:px-3">
            <table className="rp-table">
              <thead>
                <tr>
                  <th scope="col">Mois</th>
                  <th scope="col" className="num">Score</th>
                  <th scope="col">Niveau</th>
                  <th scope="col" className="num">Évolution</th>
                  <th scope="col">
                    <span title="Le nombre d’acteurs cités varie d’une mesure à l’autre : le total change avec lui.">Rang</span>
                  </th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.map((a, i) => {
                  const prev = list[i + 1];
                  const b = bandFor(a.score);
                  const r = rankOf(a);
                  return (
                    <tr key={a.id}>
                      <td className="whitespace-nowrap font-medium capitalize">
                        {fmtDate(auditDate(a), { month: 'long', year: 'numeric' })}
                        <span className="block text-[12px] font-normal normal-case text-[var(--muted)]">{fmtDate(auditDate(a), { day: 'numeric', month: 'short' })}</span>
                      </td>
                      <td className="num rp-display text-[18px]">{Math.round(a.score)}</td>
                      <td>
                        <span className="rp-chip" style={{ background: b.bg, color: b.ink, borderColor: 'transparent' }}>
                          {b.label}
                        </span>
                      </td>
                      <td className="num">{prev ? <Delta value={Math.round(a.score) - Math.round(prev.score)} label=" points" /> : <span className="text-[12px] text-[var(--muted)]">départ</span>}</td>
                      <td className="whitespace-nowrap text-[13px]">
                        {ordinal(r.rank)} sur {r.of}
                      </td>
                      <td>
                        <div className="flex justify-end gap-1.5">
                          <Link href={`/rapport/${encodeURIComponent(a.id)}`} className="rp-btn rp-btn-sm">
                            Voir
                          </Link>
                          <a href={`/api/report/${encodeURIComponent(a.id)}/pdf`} className="rp-btn rp-btn-sm" download>
                            <Icon name="download" size={14} /> PDF
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </>
  );
}
