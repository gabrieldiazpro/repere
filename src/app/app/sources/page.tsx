import '@/components/app/mesure/mesure.css';
import Link from 'next/link';
import { CategoryBars, HBar } from '@/components/app/Charts';
import { Empty, PageHeader, Panel } from '@/components/app/PageHeader';
import { Verdict } from '@/components/app/v4/Verdict';
import { TaskButton } from '@/components/app/mesure/TaskButton';
import { ExportLink } from '@/components/app/mesure/ui';
import { crossLink, type RawSearch } from '@/components/app/mesure/params';
import { loadMesure } from '@/components/app/mesure/server';
import { CATEGORY_LABEL, EFFORT_TIME, fmtDate, IMPACT_LABEL, pct, PROVIDER_LABEL } from '@/components/app/tokens';
import { auditDate } from '@/components/app/workspace';
import type { ExecTask, Presence, SourceCategory, SourceOpportunity } from '@/lib/engine/types-v2';

export const metadata = { title: 'Sources' };

const PRESENCE: Record<Presence, { sym: string; label: string; cls: string }> = {
  present: { sym: '✓', label: 'Présent', cls: 'text-[var(--success-ink)]' },
  absent: { sym: '✗', label: 'Absent', cls: 'text-[var(--danger-ink)]' },
  unknown: { sym: '?', label: 'Non vérifié', cls: 'text-[var(--muted)]' },
};

function Stars({ n }: { n: 1 | 2 | 3 }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={IMPACT_LABEL[n]}>
      {[1, 2, 3].map((i) => (
        <svg key={i} viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
          <path d="M6 .8 7.6 4.1l3.6.5-2.6 2.5.6 3.6L6 9l-3.2 1.7.6-3.6L.8 4.6l3.6-.5z" fill={i <= n ? 'var(--accent)' : 'var(--hair)'} stroke={i <= n ? 'var(--warning)' : 'var(--line)'} strokeWidth=".6" />
        </svg>
      ))}
    </span>
  );
}

function toTask(o: SourceOpportunity, businessId: string): ExecTask {
  return {
    id: `src-${o.domain}`,
    businessId,
    kind: o.category === 'annuaire' ? 'directory' : o.category === 'avis' ? 'review_request' : 'source_outreach',
    title: o.action,
    why: o.why,
    automation: 'guide',
    minutes: o.effort === 'S' ? 30 : o.effort === 'M' ? 120 : 240,
    impact: o.impact,
    status: 'todo',
    steps: o.howTo,
    sourceDomain: o.domain,
    createdAt: new Date(0).toISOString(),
  };
}

export default async function SourcesPage({ searchParams }: { searchParams: Promise<RawSearch> }) {
  const { ws, ent, sp } = await loadMesure(searchParams);
  const a = ws.latest;
  const s = a?.sources;
  if (!a || !s) {
    return (
      <>
        <PageHeader title="Sources" />
        <div className="rp-page">
          <Empty title="Pas encore de sources relevées">Elles apparaîtront après votre premier audit de suivi.</Empty>
        </div>
      </>
    );
  }
  const cats = (Object.entries(s.byCategory) as [SourceCategory, number][]).sort((x, y) => y[1] - x[1]);
  const top = s.domains.slice(0, 10);
  const presentTop = top.filter((d) => d.clientPresence === 'present').length;
  const maxShare = Math.max(...s.domains.map((d) => d.citationShare));

  return (
    <>
      <PageHeader
        title="Sources"
        meta={<>Relevé du {fmtDate(auditDate(a), { day: 'numeric', month: 'long' })} · {s.totalCitations} citations{a.demo ? ' · démo' : ''}</>}
        dataDate={auditDate(a)}
        actions={<ExportLink ent={ent} businessId={ws.business.id} kind="sources" label="Exporter" />}
      />
      <div className="rp-page">
        <Verdict
          tone={presentTop === top.length ? 'good' : presentTop < top.length / 2 ? 'bad' : 'warn'}
          title={
            presentTop === top.length
              ? `Vous êtes présent sur les ${top.length} sites que les IA citent le plus`
              : `Vous êtes absent de ${top.length - presentTop} des ${top.length} sites que les IA citent le plus`
          }
          lead={`Y figurer donne aux IA une raison de vous recommander. ${s.opportunities.filter((o) => o.effort === 'S').length} inscriptions se font en moins de 30 minutes.`}
          figure={{ value: presentTop, suffix: `/${top.length}`, label: 'sources clés où vous êtes' }}
          action={s.opportunities.length ? { href: '#opp-h', label: 'Voir les sources prioritaires', icon: 'link' } : undefined}
          details={<p>Les sites que les IA citent quand on leur pose vos questions, classés par nombre de citations. « Présent » : votre nom ou votre site apparaît sur la page citée.</p>}
          detailsLabel="Comment lire cet écran"
        />
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px]">
          <span className="text-[var(--muted)]">Vue par domaine.</span>
          <Link href={crossLink('/app/citations', sp)} className="rp-link">
            Voir les pages citées, une par une
          </Link>
        </p>
        <dl className="rp-panel grid grid-cols-2 lg:grid-cols-4">
          {[
            { k: 'Citations relevées', v: String(s.totalCitations), sub: `${s.domains.length} domaines` },
            { k: 'Citations de votre site', v: String(s.clientCitedCount), sub: pct(s.clientCitedCount / Math.max(1, s.totalCitations)) + ' du total' },
            { k: `Présence sur les ${top.length} sources les plus citées`, v: `${presentTop}/${top.length}`, sub: `${top.length - presentTop} à gagner` },
            { k: 'Opportunités classées', v: String(s.opportunities.length), sub: `${s.opportunities.filter((o) => o.effort === 'S').length} rapides` },
          ].map((x, i) => (
            <div key={x.k} className={`p-4 lg:px-6 ${i % 2 === 0 ? 'border-r' : ''} ${i < 2 ? 'border-b lg:border-b-0' : ''} ${i === 1 ? 'lg:border-r' : ''} border-[var(--hair)]`}>
              <dt className="text-[12px] text-[var(--muted)]">{x.k}</dt>
              <dd className="mt-1">
                <span className="rp-display rp-num text-[24px]">{x.v}</span>
                <span className="ml-1.5 text-[12px] text-[var(--muted)]">{x.sub}</span>
              </dd>
            </div>
          ))}
        </dl>

        <section aria-labelledby="opp-h">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 id="opp-h" className="scroll-mt-24 rp-display text-[20px] lg:text-[22px]">
              Vos {Math.min(10, s.opportunities.length)} sources prioritaires
            </h2>
            <span className="text-[13px] text-[var(--muted)]">Classées par fréquence de citation et facilité d’accès</span>
          </div>
          <ol className="grid gap-3 lg:grid-cols-2 lg:gap-4">
            {s.opportunities.map((o, i) => {
              const d = s.domains.find((x) => x.domain === o.domain);
              const pres = PRESENCE[d?.clientPresence ?? 'absent'];
              return (
                <li key={o.domain} className="rp-panel flex flex-col p-4 lg:p-5">
                  <div className="flex items-start gap-3">
                    <span className="rp-num flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-[var(--deep)] text-[13px] font-semibold text-[var(--on-primary)]">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[15px] font-semibold leading-snug">
                        {o.label} <span className="font-normal text-[var(--muted)]">· {CATEGORY_LABEL[o.category]}</span>
                      </h3>
                      <p className="text-[13px] text-[var(--muted)]">{o.domain}</p>
                    </div>
                    <span className={`flex-none text-[12px] font-semibold ${pres.cls}`}>
                      <span aria-hidden="true">{pres.sym} </span>
                      {pres.label}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[var(--muted)]">
                    <span className="inline-flex items-center gap-1.5">
                      Impact <Stars n={o.impact} />
                    </span>
                    <span>
                      Effort <strong className="text-[var(--ink)]">{o.effort}</strong> ({EFFORT_TIME[o.effort]})
                    </span>
                    <span className="rp-num">Score {o.score}/100</span>
                  </div>
                  <p className="mt-3 text-[14px] leading-relaxed">
                    <span className="font-semibold">Pourquoi : </span>
                    {o.why}
                  </p>
                  <details className="mt-2" open={i < 2}>
                    <summary className="flex min-h-[32px] items-center gap-1 text-[14px] font-semibold">
                      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" className="rp-chevron" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="m9 6 6 6-6 6" /></svg>
                      Comment y entrer : {o.action}
                    </summary>
                    <ol className="mt-1 flex flex-col gap-1 pl-5 text-[14px] [list-style:decimal]">
                      {o.howTo.map((h, k) => (
                        <li key={k}>{h}</li>
                      ))}
                    </ol>
                  </details>
                  <div className="mt-auto pt-3">
                    {o.competitorsPresent.length > 0 && (
                      <p className="mb-3 flex flex-wrap items-center gap-1.5 text-[12px] text-[var(--muted)]">
                        Déjà présents :
                        {o.competitorsPresent.map((c) => (
                          <span key={c} className="rp-chip">
                            {c}
                          </span>
                        ))}
                      </p>
                    )}
                    <TaskButton businessId={ws.business.id} draft={toTask(o, ws.business.id)} demo={ws.demo} label="Ajouter à mes tâches" />
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <div className="flex flex-col gap-4 lg:gap-5">
          <Panel id="cat-h" title="Citations par catégorie">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-10">
            <div>
            <CategoryBars
              title="Répartition des citations par catégorie de source"
              total={s.totalCitations}
              rows={cats.map(([c, v]) => ({ label: CATEGORY_LABEL[c], value: v, color: c === 'client' ? 'var(--accent)' : 'var(--primary)' }))}
            />
            </div>
            {s.note && <p className="self-end text-[13px] text-[var(--muted)] lg:border-l lg:border-[var(--hair)] lg:pl-6">{s.note}</p>}
            </div>
          </Panel>

          <Panel id="dom-h" title="Tous les domaines cités" aside="✓ présent · ✗ absent · ? non vérifié" pad={false}>
            <div className="rp-scroll px-2 pb-2 lg:px-3">
              <table className="rp-table">
                <thead>
                  <tr>
                    <th scope="col">Domaine</th>
                    <th scope="col">Catégorie</th>
                    <th scope="col" className="min-w-[150px]">Part des citations</th>
                    <th scope="col">IA</th>
                    <th scope="col" className="text-center">Vous</th>
                    <th scope="col">Concurrents présents</th>
                  </tr>
                </thead>
                <tbody>
                  {s.domains.map((d) => {
                    const p = PRESENCE[d.clientPresence];
                    const mine = d.category === 'client';
                    return (
                      <tr key={d.domain} className={mine ? 'is-me' : ''}>
                        <td>
                          <span className="font-medium">{d.label}</span>
                          <span className="block text-[12px] text-[var(--muted)]">{d.domain}</span>
                        </td>
                        <td className="whitespace-nowrap text-[13px]">{CATEGORY_LABEL[d.category]}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className="w-20 overflow-hidden rounded-[2px]">
                              <HBar value={d.citationShare} max={maxShare} color={mine ? 'var(--accent)' : 'var(--primary)'} height={8} />
                            </span>
                            <span className="rp-num whitespace-nowrap text-[13px]">{pct(d.citationShare)}</span>
                            <span className="rp-num text-[12px] text-[var(--muted)]">({d.citations})</span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap text-[12px] text-[var(--muted)]">{d.providers.map((x) => PROVIDER_LABEL[x]).join(', ')}</td>
                        <td className={`text-center font-semibold ${p.cls}`} title={p.label}>
                          <span aria-hidden="true">{p.sym}</span>
                          <span className="sr-only">{p.label}</span>
                        </td>
                        <td className="min-w-[200px] text-[13px] text-[var(--muted)]">
                          {d.competitorsPresent.length ? (
                            <>
                              {d.competitorsPresent.slice(0, 3).join(', ')}
                              {d.competitorsPresent.length > 3 && <span className="rp-chip ml-1.5" title={d.competitorsPresent.slice(3).join(', ')}>+{d.competitorsPresent.length - 3}</span>}
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
