import '@/components/app/mesure/mesure.css';
import Link from 'next/link';
import { Empty, PageHeader, Panel } from '@/components/app/PageHeader';
import { CATEGORY_LABEL, fmtDate, PROVIDER_LABEL } from '@/components/app/tokens';
import { mergeUrlHistory } from '@/lib/engine';
import type { SourceCategory } from '@/lib/engine/types-v2';
import { dateOf, filterUrls, sortUrls, URL_SORTS, urlsWithHistory, type UrlSort } from '@/components/app/mesure/derive';
import { loadMesure } from '@/components/app/mesure/server';
import { crossLink, hrefWith, str, type RawSearch } from '@/components/app/mesure/params';
import { Verdict, V4Empty } from '@/components/app/v4/Verdict';
import { ExportLink, Kpi, MesureBar, PeriodNote } from '@/components/app/mesure/ui';
import { TaskButton } from '@/components/app/mesure/TaskButton';

export const metadata = { title: 'Pages citées' };

const STEP = 30;

function pathOf(url: string) {
  try {
    const u = new URL(url);
    const p = `${u.pathname}${u.search}`;
    return p === '/' ? '' : p.length > 70 ? `${p.slice(0, 68)}…` : p;
  } catch {
    return url;
  }
}

export default async function CitationsPage({ searchParams }: { searchParams: Promise<RawSearch> }) {
  const m = await loadMesure(searchParams);
  const { ws, business, ent, period, params, sp } = m;
  const latest = period.current;
  const s = latest?.sources;
  if (!latest || !s) {
    return (
      <>
        <PageHeader title="Pages citées" />
        <div className="rp-page">
          <V4Empty title="Pas encore de pages citées" icon="link">Les pages que les IA citent en source apparaissent après votre première mesure.</V4Empty>
        </div>
      </>
    );
  }
  const latestUrls = s.urls ?? [];
  const history = period.audits.length > 1 ? mergeUrlHistory(period.audits) : latestUrls;
  const all = urlsWithHistory(latestUrls, history);
  const cats = [...new Set(all.map((u) => u.category))].sort((a, b) => CATEGORY_LABEL[a].localeCompare(CATEGORY_LABEL[b], 'fr'));
  const comps = [...new Set(all.flatMap((u) => u.competitorsPresent))].sort((a, b) => a.localeCompare(b, 'fr'));
  const cat = (cats as string[]).includes(str(sp, 'cat', 30)) ? (str(sp, 'cat', 30) as SourceCategory) : null;
  const concurrent = comps.includes(str(sp, 'concurrent', 80)) ? str(sp, 'concurrent', 80) : null;
  const absent = str(sp, 'absent', 2) === '1';
  const anciennes = str(sp, 'anciennes', 2) === '1';
  const tri = (URL_SORTS.find((x) => x.key === str(sp, 'tri', 12))?.key ?? 'citations') as UrlSort;
  const shown = Math.min(500, Math.max(STEP, Number.parseInt(str(sp, 'n', 4), 10) || STEP));

  const filtered = sortUrls(filterUrls(anciennes ? all : all.filter((u) => u.stillCited), { ia: params.ia, category: cat, absent, competitor: concurrent, q: params.q }), tri);
  const stillCited = all.filter((u) => u.stillCited);
  const refDate = period.reference ? dateOf(period.reference).slice(0, 10) : null;
  const isNew = (u: (typeof all)[number]) => Boolean(refDate && u.firstSeen && u.firstSeen.slice(0, 10) > refDate);
  const queriesText = new Map(period.audits.flatMap((a) => a.queries.map((q) => [q.id, q.text] as const)));
  const targets = stillCited.filter((u) => !u.clientPresent && u.competitorsPresent.length > 0);
  const mine = stillCited.filter((u) => u.clientPresent).length;
  const keep = (keys: string[]) => keys.map((k) => (str(sp, k, 80) ? <input key={k} type="hidden" name={k} value={str(sp, k, 80)} /> : null));

  return (
    <>
      <PageHeader
        title="Pages citées"
        meta={
          <>
            Relevé du {fmtDate(dateOf(latest), { day: 'numeric', month: 'long' })} · page par page{latest.demo ? ' · démo' : ''}
          </>
        }
        dataDate={dateOf(latest)}
        actions={<ExportLink ent={ent} businessId={business.id} kind="urls" from={period.from} to={period.to} label="Exporter" />}
      />
      <div className="rp-page" data-visite="citations">
        <Verdict
          tone={targets.length === 0 ? 'good' : targets.length > mine ? 'bad' : 'warn'}
          title={targets.length ? `${targets.length} page${targets.length > 1 ? 's' : ''} citée${targets.length > 1 ? 's' : ''} par les IA montre${targets.length > 1 ? 'nt' : ''} vos concurrents, pas vous` : 'Vous figurez sur toutes les pages qui citent vos concurrents'}
          lead={`Vous figurez sur ${mine} des ${stillCited.length} pages que les IA citent en source.`}
          figure={{ value: targets.length, label: 'pages à viser' }}
          action={targets.length ? { href: hrefWith('/app/citations', sp, { absent: '1', n: null }), label: 'Voir les pages à viser', icon: 'link' } : undefined}
          details={<p>Chaque page que les IA citent en source quand on leur pose vos questions. Une page où vos concurrents figurent et pas vous est une page à viser : article, fiche, comparatif.</p>}
        />
        <MesureBar path="/app/citations" sp={sp} params={params} providers={latest.providersUsed} />
        <PeriodNote from={period.from} to={period.to} refDate={period.reference ? dateOf(period.reference) : null} limitedByPlan={period.limitedByPlan} historyMonths={ent.historyMonths} />

        <dl className="rp-panel rp-kpis">
          <Kpi label="Pages citées" value={String(stillCited.length)} sub={`${stillCited.reduce((n, u) => n + u.citations, 0)} citations`} />
          <Kpi label="Pages où vous figurez" value={String(stillCited.filter((u) => u.clientPresent).length)} sub={`sur ${stillCited.length}`} />
          <Kpi label="Concurrents présents, pas vous" value={String(stillCited.filter((u) => !u.clientPresent && u.competitorsPresent.length).length)} sub="pages à viser en priorité" />
          <Kpi label={refDate ? 'Nouvelles depuis la comparaison' : 'Nouvelles pages'} value={refDate ? String(stillCited.filter(isNew).length) : '—'} sub={refDate ? `depuis le ${fmtDate(refDate, { day: 'numeric', month: 'short' })}` : 'à la prochaine mesure'} />
        </dl>

        <form method="get" action="/app/citations" className="rp-panel flex flex-wrap items-end gap-3 p-4 lg:p-5" aria-label="Filtrer les pages citées">
          {keep(['periode', 'vs', 'ia', 'tri'])}
          <label className="flex min-w-[180px] flex-[2] flex-col gap-1 text-[12px] text-[var(--muted)]">
            Rechercher
            <input type="search" name="q" defaultValue={params.q} className="rp-input" placeholder="Adresse, titre ou domaine" />
          </label>
          <label className="flex min-w-[150px] flex-1 flex-col gap-1 text-[12px] text-[var(--muted)]">
            Catégorie
            <select name="cat" defaultValue={cat ?? ''} className="rp-select w-full">
              <option value="">Toutes</option>
              {cats.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </label>
          {comps.length > 0 && (
            <label className="flex min-w-[150px] flex-1 flex-col gap-1 text-[12px] text-[var(--muted)]">
              Concurrent présent
              <select name="concurrent" defaultValue={concurrent ?? ''} className="rp-select w-full">
                <option value="">Tous</option>
                {comps.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex min-h-[40px] items-center gap-2 text-[14px]">
            <input type="checkbox" name="absent" value="1" defaultChecked={absent} className="h-4 w-4 accent-[var(--primary)]" />
            Je n’y suis pas
          </label>
          <label className="flex min-h-[40px] items-center gap-2 text-[14px]">
            <input type="checkbox" name="anciennes" value="1" defaultChecked={anciennes} className="h-4 w-4 accent-[var(--primary)]" />
            Inclure les pages qui ne sont plus citées
          </label>
          <button type="submit" className="rp-btn rp-btn-primary">
            Filtrer
          </button>
        </form>

        <Panel
          id="urls-h"
          title={
            <>
              {filtered.length} page{filtered.length > 1 ? 's' : ''}
            </>
          }
          aside={
            <span className="rp-segs" role="group" aria-label="Trier">
              {URL_SORTS.map((x) => (
                <Link key={x.key} href={hrefWith('/app/citations', sp, { tri: x.key === 'citations' ? null : x.key })} aria-current={tri === x.key ? 'true' : undefined} scroll={false}>
                  {x.label}
                </Link>
              ))}
            </span>
          }
          pad={false}
        >
          {filtered.length ? (
            <ul className="rp-rows mt-3 border-t border-[var(--hair)]">
              {filtered.slice(0, shown).map((u) => (
                <li key={u.url} className="rp-row grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto] lg:items-start lg:gap-6" data-me={u.category === 'client' ? 'true' : undefined}>
                  <div className="min-w-0">
                    <a href={u.url} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold leading-snug hover:underline">
                      {u.title ?? u.domain}
                    </a>
                    <p className="truncate text-[12px] text-[var(--muted)]">
                      {u.domain}
                      {pathOf(u.url)}
                    </p>
                    <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12px] text-[var(--muted)]">
                      <span className="rp-chip">{CATEGORY_LABEL[u.category]}</span>
                      <span className="rp-num">
                        {u.citations} citation{u.citations > 1 ? 's' : ''}
                        {u.bestPosition ? ` · meilleure position ${u.bestPosition}` : ''}
                      </span>
                      {isNew(u) && <span className="rp-chip rp-chip-primary">Nouvelle</span>}
                      {!u.stillCited && <span className="rp-chip rp-chip-warning">Plus citée</span>}
                    </p>
                    <details className="mt-1.5">
                      <summary className="inline-flex min-h-[28px] items-center gap-1 text-[12px] text-[var(--muted)] hover:text-[var(--ink)]">
                        <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" className="rp-chevron" fill="none" stroke="currentColor" strokeWidth="2.4">
                          <path d="m9 6 6 6-6 6" />
                        </svg>
                        {u.queries.length} question{u.queries.length > 1 ? 's' : ''} · {u.providers.map((p) => PROVIDER_LABEL[p].replace(' (Le Chat)', '')).join(', ')}
                        {u.firstSeen ? ` · vue depuis le ${fmtDate(u.firstSeen, { day: 'numeric', month: 'short' })}` : ''}
                      </summary>
                      <ul className="mt-1 flex flex-col gap-0.5 pl-4 text-[13px]">
                        {u.queries.slice(0, 10).map((q) => (
                          <li key={q}>
                            <Link href={crossLink('/app/reponses', sp, { question: q })} className="rp-link font-normal">
                              {queriesText.get(q) ?? q}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </details>
                  </div>
                  <div className="text-[13px]">
                    <p className={u.clientPresent ? 'font-semibold text-[var(--success-ink)]' : 'font-semibold text-[var(--danger-ink)]'}>
                      <span aria-hidden="true">{u.clientPresent ? '✓ ' : '✗ '}</span>
                      {u.clientPresent ? 'Vous y figurez' : 'Vous n’y figurez pas'}
                    </p>
                    {u.competitorsPresent.length > 0 ? (
                      <p className="mt-1 text-[var(--muted)]">
                        {u.competitorsPresent.slice(0, 3).join(', ')}
                        {u.competitorsPresent.length > 3 && (
                          <span className="rp-chip ml-1.5" title={u.competitorsPresent.slice(3).join(', ')}>
                            +{u.competitorsPresent.length - 3}
                          </span>
                        )}
                      </p>
                    ) : (
                      <p className="mt-1 text-[var(--muted)]">Aucun concurrent repéré sur la page</p>
                    )}
                  </div>
                  {!u.clientPresent && u.category !== 'client' && u.category !== 'concurrent' ? (
                    <div className="flex flex-wrap gap-2 lg:flex-col lg:items-end">
                      <Link href={crossLink('/app/citations/brief', sp, { url: u.url })} className="rp-btn rp-btn-sm">
                        Brief de contenu
                      </Link>
                      <TaskButton
                        businessId={business.id}
                        demo={ws.demo}
                        draft={{
                          id: `url-${u.domain}-${u.url.length}`,
                          title: `Figurer sur « ${(u.title ?? u.domain).slice(0, 90)} »`,
                          why: `Page citée ${u.citations} fois par ${u.providers.map((p) => PROVIDER_LABEL[p]).join(', ')}${u.competitorsPresent.length ? ` ; ${u.competitorsPresent.slice(0, 3).join(', ')} y figure${u.competitorsPresent.length > 1 ? 'nt' : ''}` : ''}. Vous n’y figurez pas.`,
                          minutes: 60,
                          impact: u.citations >= 5 ? 3 : 2,
                          steps: [`Ouvrir la page : ${u.url}`, 'Repérer comment les acteurs cités y figurent (liste, avis, fiche, article)', 'Demander à y figurer ou proposer une contribution', 'Noter la date pour mesurer l’effet à la prochaine mesure'],
                          kind: 'source_outreach',
                          sourceDomain: u.domain,
                        }}
                      />
                    </div>
                  ) : (
                    <span />
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="border-t border-[var(--hair)] p-5 text-center">
              <p className="font-semibold">{all.length ? 'Aucune page pour ces filtres' : 'Aucune page citée relevée'}</p>
              <p className="mx-auto mt-1 max-w-md text-[14px] text-[var(--muted)]">{all.length ? 'Retirez un filtre ou élargissez la période.' : s.note ?? 'Les IA de cette mesure n’ont pas donné de sources.'}</p>
            </div>
          )}
          {filtered.length > shown && (
            <div className="border-t border-[var(--hair)] p-4 text-center">
              <Link href={hrefWith('/app/citations', sp, { n: String(shown + STEP) })} className="rp-btn" scroll={false}>
                Voir {Math.min(STEP, filtered.length - shown)} pages de plus
              </Link>
            </div>
          )}
        </Panel>
        <p className="text-[13px] text-[var(--muted)]">
          {s.note ? `${s.note} ` : ''}
          <Link href={crossLink('/app/sources', sp)} className="rp-link">
            Voir la vue par domaine et vos 10 sources prioritaires
          </Link>
        </p>
      </div>
    </>
  );
}
