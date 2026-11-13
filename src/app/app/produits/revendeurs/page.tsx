import { Empty, PageHeader, Panel } from '@/components/app/PageHeader';
import { pct } from '@/components/app/tokens';
import { loadMetier } from '@/components/app/metiers/context';
import { copilotHref, DESTINATION_LABEL, KIND_COLOR } from '@/components/app/metiers/logic';
import { KeyFigures, LoadError, Meter, NextSteps, ParcoursGate, PRODUITS_TABS, SourceNote, SubNav } from '@/components/app/metiers/ui';
import { ECOM_KIND_LABEL, retailerReport, type EcomSourceKind, type RetailerReport } from '@/lib/ecommerce';
import { Verdict } from '@/components/app/v4/Verdict';

export const metadata = { title: 'Revendeurs cités' };
export const dynamic = 'force-dynamic';

const IMPACT = { 1: 'impact modéré', 2: 'impact fort', 3: 'impact majeur' } as const;

export default async function RevendeursPage() {
  const ctx = await loadMetier('ecommerce');
  const header = (
    <PageHeader
      title="Revendeurs cités"
      meta={<>{ctx.ws.business.name}{ctx.demo ? ' · démo' : ''}</>}
      lead="Quand une IA recommande un produit, elle donne aussi un lien. Il mène chez vous, ou chez une marketplace, un revendeur, un comparatif."
    />
  );
  if (!ctx.inParcours) return <>{header}<ParcoursGate parcours="ecommerce" demo={ctx.demo} /></>;

  let r: RetailerReport | null = null;
  try {
    r = await retailerReport(ctx.business);
  } catch (e) {
    console.error('[app/produits/revendeurs]', (e as Error).message);
  }

  return (
    <>
      {header}
      <div className="rp-page">
        <SubNav tabs={PRODUITS_TABS} current="/app/produits/revendeurs" label="Parcours e-commerce" />
        {!r ? (
          <LoadError what="les sources citées" />
        ) : r.citations === 0 ? (
          <Empty title="Aucune source citée pour l’instant">Perplexity, ChatGPT avec recherche et Claude donnent leurs sources ; elles apparaîtront ici après la prochaine mesure. Gemini n’en donne pas.</Empty>
        ) : (
          <Body r={r} demo={ctx.demo} />
        )}
      </div>
    </>
  );
}

function Body({ r, demo }: { r: RetailerReport; demo: boolean }) {
  const kinds = (Object.entries(r.byKind) as [EcomSourceKind, { citations: number; share: number }][]).sort((a, b) => b[1].citations - a[1].citations);
  const dest = (Object.entries(r.destinations) as [keyof typeof DESTINATION_LABEL, { answers: number; share: number }][]).sort((a, b) => b[1].answers - a[1].answers);
  const brand = r.destinations.brand?.share ?? 0;
  const top = r.domains.filter((d) => d.kind !== 'brand')[0];
  return (
    <>
      <Verdict
        tone={r.thirdPartyShare >= 0.5 ? 'bad' : r.thirdPartyShare >= 0.25 ? 'warn' : 'good'}
        title={r.thirdPartyShare >= 0.25 && top ? `Les IA envoient l’achat chez ${top.label} plus que chez vous` : 'Les IA envoient surtout l’achat vers votre site'}
        lead={`${pct(brand)} des réponses mènent à votre site, ${pct(r.thirdPartyShare)} des liens d’achat partent ailleurs.`}
        figure={{ value: Math.round(r.thirdPartyShare * 100), suffix: ' %', label: 'des liens d’achat vont ailleurs' }}
      />
      <KeyFigures
        items={[
          { k: 'Achat envoyé ailleurs que chez vous', v: pct(r.thirdPartyShare), extra: 'des liens d’achat' },
          { k: 'Réponses qui mènent à votre site', v: pct(brand) },
          { k: 'Premier site tiers cité', v: top ? top.label : '—', extra: top ? `${top.citations} citations` : undefined },
          { k: 'Réponses avec sources', v: r.answersWithSources, extra: `${r.citations} liens` },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
        <Panel id="dest-h" title="Où l’IA envoie l’acheteur">
          <p className="mb-3 text-[13px] text-[var(--muted)]">Première destination d’achat de chaque réponse.</p>
          <ul className="flex flex-col gap-3">
            {dest.map(([k, v]) => (
              <li key={k} className="grid grid-cols-[minmax(110px,36%)_1fr_auto] items-center gap-3 text-[14px]">
                <span className={k === 'brand' ? 'font-semibold' : ''}>{DESTINATION_LABEL[k]}</span>
                <Meter value={v.share} max={1} color={k === 'brand' ? 'var(--success)' : k === 'competitor' ? 'var(--danger)' : 'var(--warning)'} />
                <span className="rp-num w-24 text-right">
                  <strong>{pct(v.share)}</strong> <span className="text-[12px] text-[var(--muted)]">{v.answers} rép.</span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel id="kind-h" title="Part des liens par type de site">
          <ul className="flex flex-col gap-3">
            {kinds.map(([k, v]) => (
              <li key={k} className="grid grid-cols-[minmax(110px,36%)_1fr_auto] items-center gap-3 text-[14px]">
                <span>{ECOM_KIND_LABEL[k]}</span>
                <Meter value={v.share} max={1} color={KIND_COLOR[k]} />
                <span className="rp-num w-24 text-right">
                  <strong>{pct(v.share)}</strong> <span className="text-[12px] text-[var(--muted)]">{v.citations}</span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel id="domaines-h" title="Sites cités" pad={false}>
        <div className="rp-scroll px-2 pb-2 lg:px-3">
          <table className="rp-table">
            <thead>
              <tr>
                <th scope="col">Site</th>
                <th scope="col">Type</th>
                <th scope="col" className="num">Citations</th>
                <th scope="col">Votre marque y figure</th>
                <th scope="col">Concurrents présents</th>
              </tr>
            </thead>
            <tbody>
              {r.domains.slice(0, 15).map((d) => (
                <tr key={d.domain}>
                  <td className="font-medium">
                    {d.label}
                    <span className="block text-[12px] text-[var(--muted)]">{d.domain}</span>
                  </td>
                  <td className="text-[13px]">{ECOM_KIND_LABEL[d.kind]}</td>
                  <td className="num">{d.citations}</td>
                  <td>{d.kind === 'brand' ? '—' : d.brandPresent ? <span className="rp-chip rp-chip-success">oui</span> : <span className="rp-chip rp-chip-danger">non</span>}</td>
                  <td className="max-w-[240px] text-[13px]">{d.competitorsPresent.slice(0, 3).join(', ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel id="exemples-h" title="Exemples, question par question" pad={false}>
        <ul className="divide-y divide-[var(--hair)]">
          {r.byQuery.slice(0, 8).map((q) => (
            <li key={q.queryId} className="flex flex-col gap-1 px-4 py-3 lg:px-5">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-medium">« {q.query} »</span>
                {q.brandLinked ? <span className="rp-chip rp-chip-success">lien vers votre site</span> : <span className="rp-chip rp-chip-warning">aucun lien vers votre site</span>}
              </p>
              <p className="text-[13px] text-[var(--muted)]">{q.destinations.length ? q.destinations.slice(0, 5).map((d) => `${d.domain} (${ECOM_KIND_LABEL[d.kind].toLowerCase()})`).join(' · ') : 'pas de source'}</p>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel id="reco-h" title="Que faire">
        {r.recommendations.length ? (
          <ol className="flex flex-col gap-4">
            {r.recommendations.map((x, i) => (
              <li key={`${x.title}-${i}`} className="flex gap-3">
                <span className="rp-num mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[var(--primary-bg)] text-[12px] font-semibold text-[var(--primary)]" aria-hidden="true">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold">
                    {x.title} <span className="text-[12px] font-normal text-[var(--muted)]">· {IMPACT[x.impact]}</span>
                  </p>
                  <p className="text-[14px] text-[var(--muted)]">{x.why}</p>
                  <ul className="mt-1 list-disc pl-5 text-[14px]">
                    {x.steps.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                  <a className="rp-link text-[13px]" href={copilotHref(`${x.title}. ${x.why}`, 'produits')}>
                    En parler au copilote
                  </a>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-[14px] text-[var(--muted)]">Les IA envoient déjà vers votre site : continuez à soigner vos fiches produit.</p>
        )}
        <div className="mt-4 flex flex-col gap-3">
          <SourceNote label={demo || r.demo ? 'Démo' : 'Sources citées par les IA lors de la dernière mesure'} detail={r.notes.join(' ')} demo={demo || r.demo} />
          <NextSteps
            steps={[
              { href: '/app/taches', label: 'Voir les tâches', primary: true },
              { href: '/app/sources', label: 'Toutes les sources citées' },
            ]}
          />
        </div>
      </Panel>
    </>
  );
}
