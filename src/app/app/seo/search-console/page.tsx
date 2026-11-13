import Link from 'next/link';
import { Suspense } from 'react';
import '@/components/app/seo/seo.css';
import { PageHeader } from '@/components/app/PageHeader';
import { Icon } from '@/components/app/icons';
import { Surface } from '@/components/ui/Surface';
import { KeyFigure } from '@/components/ui/KeyFigure';
import { EmptyState } from '@/components/ui/EmptyState';
import { loadGsc, loadSeoSuite } from '@/components/app/seo/data';
import { fmtInt, fmtPct, fmtPos, movers, opportunities, pathOf } from '@/components/app/seo/model';
import { BarChart, LineChart, SeoNav, Source } from '@/components/app/seo/parts';
import { ChooseProperty, ConnectGscButton, OAuthNotice } from '@/components/app/seo/controls';
import { GscTables } from '@/components/app/seo/GscTables';

export const metadata = { title: 'Search Console' };
export const maxDuration = 60;

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const monthLabel = (m: string) => MONTHS[Number(m.slice(5, 7)) - 1] ?? m;

export default async function SearchConsolePage() {
  const s = await loadSeoSuite();
  const gsc = await loadGsc();
  const conn = s.status?.searchConsole;
  const id = s.ws.business.id;

  if (!gsc || !gsc.available) {
    const pending = gsc && 'pending' in gsc;
    const choose = conn?.connected && !conn.siteUrl && conn.sites.length > 0;
    return (
      <>
        <Suspense fallback={null}>
          <OAuthNotice />
        </Suspense>
        <PageHeader
          title="Search Console"
          result={pending ? 'Import de vos 16 mois de données en cours' : choose ? 'Choisissez la propriété de votre site' : 'Connectez Search Console pour voir vos vrais clics Google'}
          subtitle={pending ? 'Google transmet vos données : elles apparaissent ici dans quelques minutes, puis sont mises à jour chaque jour.' : 'Accès en lecture seule. Repéré importe 16 mois de clics, impressions et positions, par requête et par page, puis les met à jour chaque jour.'}
          primary={!pending && !choose && conn?.enabled !== false ? <ConnectGscButton businessId={id} demo={s.demo} primary /> : undefined}
        />
        <div className="rp-page">
          <SeoNav active="search-console" />
          {choose ? (
            <Surface title="Propriété Search Console" id="g-prop" elevation="raised">
              <ChooseProperty businessId={id} sites={conn!.sites} />
            </Surface>
          ) : (
            <EmptyState title={pending ? 'Import en cours' : 'Aucune donnée Search Console'} icon={<Icon name={pending ? 'database' : 'plug'} />}>
              {pending
                ? 'Revenez dans quelques minutes : les 2 à 3 derniers jours ne sont jamais consolidés par Google.'
                : conn?.enabled === false
                  ? 'La connexion Google n’est pas encore activée sur Repéré : rien n’est affiché plutôt que des chiffres inventés.'
                  : (gsc && 'reason' in gsc ? gsc.reason : null) ?? 'Search Console est gratuite : si votre site n’y est pas encore, ajoutez-le sur search.google.com/search-console puis revenez ici.'}
            </EmptyState>
          )}
        </div>
      </>
    );
  }

  const o = gsc;
  const opp = opportunities(o.topQueries);
  const mv = movers(o.topQueries);
  const monthly = o.monthly.slice(-16);
  const pct = o.clicksChange !== null ? Math.round(o.clicksChange * 100) : null;
  const ctrDelta = o.previous.impressions ? Math.round((o.totals.ctr - o.previous.ctr) * 1000) / 10 : null;
  const range = `${new Date(o.range.start).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} au ${new Date(o.range.end).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`;
  const result =
    pct === null ? `${fmtInt(o.totals.clicks)} clics depuis Google en 28 jours` : Math.abs(pct) < 3 ? `Vos clics Google sont stables : ${fmtInt(o.totals.clicks)} en 28 jours` : pct >= 0 ? `Vos clics Google progressent de ${pct} % en 28 jours` : `Vos clics Google reculent de ${Math.abs(pct)} % en 28 jours`;

  return (
    <>
      <Suspense fallback={null}>
        <OAuthNotice />
      </Suspense>
      <PageHeader
        title="Search Console"
        meta={<>{o.siteUrl.replace(/^sc-domain:/, '')}, du {range}{o.source.demo ? ' (démo)' : ''}</>}
        result={result}
        resultTone={pct === null || Math.abs(pct) < 3 ? 'neutral' : pct >= 0 ? 'up' : 'down'}
        subtitle={opp.length ? `${opp.length} requêtes sont entre la 4ᵉ et la 15ᵉ place avec des impressions : un petit gain de place y rapporterait des clics.` : 'Vos requêtes et vos pages, comparées aux 28 jours précédents.'}
        primary={opp.length ? <a className="ui-btn" data-variant="primary" href="#opportunites">Voir les opportunités</a> : undefined}
      />
      <div className="rp-page">
        <SeoNav active="search-console" />
        <div className="seo-grid mb-4">
          <div className="seo-grid seo-grid-2e">
            <Surface title="Clics" id="g-clicks" elevation="raised">
              <KeyFigure label="28 derniers jours" value={o.totals.clicks} delta={pct} deltaUnit=" %" deltaLabel="vs 28 jours précédents" size="md" />
              <LineChart values={o.series.map((d) => d.clicks)} labels={o.series.map((d) => `${Number(d.date.slice(8))}/${Number(d.date.slice(5, 7))}`)} label={`Clics par jour du ${range}`} height={110} />
            </Surface>
            <Surface title="Impressions" id="g-impr">
              <KeyFigure label="fois où votre site est apparu dans Google" value={o.totals.impressions} delta={o.previous.impressions ? Math.round(((o.totals.impressions - o.previous.impressions) / o.previous.impressions) * 100) : null} deltaUnit=" %" deltaLabel="vs 28 jours précédents" size="md" />
              <LineChart values={o.series.map((d) => d.impressions)} label="Impressions par jour" height={110} />
            </Surface>
          </div>
          <div className="seo-grid seo-grid-3">
          <Surface title="Taux de clic" id="g-ctr">
            <p className="ui-figure">{fmtPct(o.totals.ctr)}</p>
            {ctrDelta !== null && <p className="ui-caption mt-1">{ctrDelta >= 0 ? '+' : '−'}{fmtPos(Math.abs(ctrDelta))} pt vs période précédente</p>}
            <p className="ui-caption mt-2">Part des personnes qui cliquent quand votre site apparaît.</p>
          </Surface>
          <Surface title="Position moyenne" id="g-pos">
            <p className="ui-figure">{fmtPos(o.totals.position)}</p>
            {o.previous.position !== null && o.totals.position !== null && <p className="ui-caption mt-1">{fmtPos(o.previous.position)} sur la période précédente (plus petit = mieux)</p>}
          </Surface>
          <Surface title="Appareils" id="g-dev">
            <ul className="m-0 grid list-none gap-1 p-0 text-[14px]">
              {o.devices.map((d) => {
                const tot = o.devices.reduce((x, y) => x + y.clicks, 0) || 1;
                return (
                  <li key={d.key} className="flex justify-between">
                    <span>{d.key === 'MOBILE' ? 'Mobile' : d.key === 'DESKTOP' ? 'Ordinateur' : 'Tablette'}</span>
                    <b className="tabular-nums">{Math.round((d.clicks / tot) * 100)} %</b>
                  </li>
                );
              })}
            </ul>
          </Surface>
          </div>
        </div>

        <Surface title="16 mois de clics" id="g-16" className="mb-4" aside={<span>par mois</span>}>
          <BarChart values={monthly.map((m) => m.clicks)} labels={monthly.map((m) => monthLabel(m.month))} label={`Clics par mois sur ${monthly.length} mois : ${monthly.map((m) => `${monthLabel(m.month)} ${m.clicks}`).join(', ')}`} dim={[monthly.length - 1]} />
          <p className="ui-caption mt-2">Le dernier mois est en cours (barre plus claire). Search Console conserve 16 mois : Repéré les garde ensuite pour vous.</p>
        </Surface>

        <div className="seo-grid seo-grid-2 mb-4">
          <Surface title="Opportunités : à portée du top 3" id="opportunites" elevation="raised">
            {opp.length ? (
              <div className="seo-table-wrap">
                <table className="seo-table">
                  <thead>
                    <tr>
                      <th>Requête</th>
                      <th className="num">Position</th>
                      <th className="num">Impressions</th>
                      <th className="num">Clics en plus*</th>
                    </tr>
                  </thead>
                  <tbody>
                    {opp.map((r) => (
                      <tr key={r.key}>
                        <td className="kw">{r.key}</td>
                        <td className="num">{fmtPos(r.position)}</td>
                        <td className="num">{fmtInt(r.impressions)}</td>
                        <td className="num">+{fmtInt(r.potential)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="ui-caption mt-2">* Estimation sur 28 jours si la requête passait 3ᵉ, avec un taux de clic moyen : un ordre de grandeur, pas une promesse.</p>
              </div>
            ) : (
              <p className="ui-small">Aucune requête entre la 4ᵉ et la 15ᵉ place avec assez d’impressions.</p>
            )}
            <p className="mt-3">
              <Link href="/app/seo/positions" className="rp-link text-[14px]">
                Suivre ces requêtes chaque semaine
              </Link>
            </p>
          </Surface>
          <Surface title="Ce qui bouge" id="g-moves">
            {mv.up.length + mv.down.length === 0 ? (
              <p className="ui-small">Positions stables par rapport aux 28 jours précédents.</p>
            ) : (
              <ul className="m-0 list-none p-0">
                {mv.up.map((r) => (
                  <li key={`u${r.key}`} className="seo-change" data-tone="up">
                    <span className="seo-change-sign" aria-hidden="true">↑</span>
                    <span>« {r.key} » : {fmtPos(r.previousPosition)} → {fmtPos(r.position)}</span>
                  </li>
                ))}
                {mv.down.map((r) => (
                  <li key={`d${r.key}`} className="seo-change" data-tone="down">
                    <span className="seo-change-sign" aria-hidden="true">↓</span>
                    <span>« {r.key} » : {fmtPos(r.previousPosition)} → {fmtPos(r.position)}</span>
                  </li>
                ))}
              </ul>
            )}
            {o.topPages[0] && <p className="ui-caption mt-3">Page qui apporte le plus de clics : {pathOf(o.topPages[0].key)} ({fmtInt(o.topPages[0].clicks)} clics).</p>}
          </Surface>
        </div>

        <Surface title="Requêtes et pages" id="g-tables">
          <GscTables queries={o.topQueries} pages={o.topPages.map((p) => ({ ...p, previousPosition: null }))} />
          <Source provider={o.source.provider} demo={o.source.demo} at={o.updatedAt} note={o.source.note} />
        </Surface>
      </div>
    </>
  );
}
