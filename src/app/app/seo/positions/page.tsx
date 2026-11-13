import Link from 'next/link';
import '@/components/app/seo/seo.css';
import { PageHeader } from '@/components/app/PageHeader';
import { Surface } from '@/components/ui/Surface';
import { KeyFigure } from '@/components/ui/KeyFigure';
import { ProgressBar } from '@/components/ui/Progress';
import { EmptyState } from '@/components/ui/EmptyState';
import { loadRanks, loadSeoSuite } from '@/components/app/seo/data';
import { fmtInt, fmtPos } from '@/components/app/seo/model';
import { SeoNav, Source } from '@/components/app/seo/parts';
import { KeywordManager, type KwRow } from '@/components/app/seo/KeywordManager';
import type { KeywordReport } from '@/lib/seodata/rank';

export const metadata = { title: 'Positions Google' };
export const maxDuration = 60;

const pl = (n: number, a: string, b: string) => `${fmtInt(n)} ${n > 1 ? b : a}`;

export default async function SeoPositionsPage() {
  const s = await loadSeoSuite();
  const ranks = await loadRanks();
  const demo = s.demo;
  const report = ranks?.report ?? null;
  const serp = ranks?.serp ?? s.status?.providers.find((p) => p.kind === 'serp') ?? null;
  const canTrack = Boolean(ranks && ranks.limit > 0 && serp && serp.state !== 'off');

  // Une ligne par mot-clé, colonnes mobile / ordinateur.
  const byKw = new Map<string, KwRow>();
  const dev = (k: KeywordReport) => ({ position: k.position, change: k.change, history: k.history.map((h) => h.position) });
  for (const k of report?.keywords ?? []) {
    const r = byKw.get(k.keyword) ?? { keyword: k.keyword, volume: k.volume, mobile: null, desktop: null, url: k.url, aiOverview: k.aiOverview, aiCitesUs: k.aiOverviewCitesUs, features: k.features.filter((f) => f !== 'ai_overview' && f !== 'organic'), tracked: true };
    r[k.device] = dev(k);
    if (k.aiOverview) r.aiOverview = true;
    if (k.aiOverviewCitesUs) r.aiCitesUs = true;
    r.url = r.url ?? k.url;
    byKw.set(k.keyword, r);
  }
  for (const t of ranks?.config.keywords ?? []) if (!byKw.has(t.keyword)) byKw.set(t.keyword, { keyword: t.keyword, volume: t.volume, mobile: null, desktop: null, url: null, aiOverview: null, aiCitesUs: null, features: [], tracked: true });
  const rows = [...byKw.values()];
  const best = (r: KwRow) => Math.min(r.mobile?.position ?? 99, r.desktop?.position ?? 99);
  const top10 = rows.filter((r) => best(r) <= 10).length;
  const top3 = rows.filter((r) => best(r) <= 3).length;
  const near = rows.filter((r) => best(r) > 10 && best(r) <= 20).length;
  const visDelta = report && report.visibility !== null && report.visibilityPrevious !== null ? Math.round((report.visibility - report.visibilityPrevious) * 10) / 10 : null;
  const week = report?.week ? report.week.replace(/^(\d{4})-W(\d+)$/, 'semaine $2 de $1') : null;

  const result = !rows.length
    ? 'Choisissez les mots-clés à surveiller sur Google'
    : `Vous êtes dans les 10 premiers résultats sur ${pl(top10, 'mot-clé', 'mots-clés')} sur ${rows.length}`;

  return (
    <>
      <PageHeader
        title="Positions Google"
        meta={<>{week ? `Relevé de la ${week}` : 'Relevé hebdomadaire'}{demo ? ' (démo)' : ''}</>}
        result={result}
        resultTone={rows.length ? (top10 >= rows.length / 2 ? 'up' : 'neutral') : undefined}
        subtitle={rows.length ? `${pl(top3, 'mot-clé', 'mots-clés')} dans le top 3, ${pl(near, 'en deuxième page', 'en deuxième page')} : ce sont vos gains les plus proches.` : 'Repéré relève chaque semaine votre place sur Google, celle de vos concurrents et la présence d’un aperçu IA.'}
        primary={near > 0 ? <Link className="ui-btn" data-variant="primary" href="/app/seo/search-console#opportunites">Voir les pages à pousser</Link> : undefined}
      />
      <div className="rp-page">
        <SeoNav active="positions" />
        {serp?.state === 'off' && (
          <Surface title="Le relevé des positions n’est pas actif" id="p-off" tone="warn" className="mb-4">
            <p className="ui-small">{serp.reason} Repéré n’affiche aucune position inventée : en attendant, vos positions moyennes réelles sont dans <Link className="rp-link" href="/app/seo/search-console">Search Console</Link>.</p>
          </Surface>
        )}
        {report && rows.length > 0 && (
          <div className="seo-grid seo-grid-3 mb-4">
            <Surface title="Part de visibilité" id="p-vis" elevation="raised">
              <KeyFigure label="des clics possibles sur vos mots-clés" value={report.visibility !== null ? Math.round(report.visibility) : null} unit=" %" delta={visDelta} deltaUnit=" pt" deltaLabel="sur une semaine" margin="Estimation (taux de clic moyen par position), pas une mesure de trafic" size="md" />
            </Surface>
            <Surface title="Répartition" id="p-dist">
              <div className="grid grid-cols-[minmax(0,1fr)] gap-2">
                {([['top3', 'Top 3', 'up'], ['top10', 'Positions 4 à 10', 'up'], ['top20', 'Positions 11 à 20', 'warn'], ['out', 'Au-delà', 'neutral']] as const).map(([k, l, t]) => (
                  <div key={k} className="seo-depth" style={{ gridTemplateColumns: '120px minmax(0,1fr) 32px' }}>
                    <span>{l}</span>
                    <ProgressBar value={report.distribution[k]} max={Math.max(1, report.keywords.length)} size="sm" tone={t} label={`${l} : ${report.distribution[k]}`} />
                    <b className="text-right tabular-nums">{report.distribution[k]}</b>
                  </div>
                ))}
              </div>
              <p className="ui-caption mt-2">Relevés mobile et ordinateur comptés séparément.</p>
            </Surface>
            <Surface title="Aperçus IA de Google" id="p-aio">
              <KeyFigure label={`relevés avec un aperçu IA ; vous y êtes cité ${pl(report.aiOverview.citesUs, 'fois', 'fois')}`} value={report.aiOverview.keywordsWithOverview} size="md" foot={<Link href="/app/seo/geo" className="rp-link text-[13px]">Être cité par les IA</Link>} />
            </Surface>
          </div>
        )}
        <div className="seo-grid seo-grid-main">
          <Surface title="Vos mots-clés" id="p-kw" elevation="raised">
            <KeywordManager
              businessId={s.ws.business.id}
              demo={demo}
              rows={rows}
              suggestions={(ranks?.suggestions ?? []).map((x) => ({ keyword: x.keyword, reason: x.reason, volume: x.volume, position: x.position }))}
              limit={ranks?.limit ?? 0}
              canTrack={canTrack || demo}
              reason={serp?.state === 'off' ? serp.reason : null}
            />
            {report && <Source provider={report.demo ? 'demo' : 'dataforseo'} demo={report.demo} note={report.note} />}
          </Surface>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
            <Surface title="Qui prend la visibilité" id="p-share">
              {report && report.share.length ? (
                <ul className="seo-bars">
                  {report.share.map((x) => (
                    <li key={x.domain} className="seo-bar">
                      <span className={`seo-bar-l seo-dom ${x.isUs ? 'font-semibold' : ''}`}>{x.isUs ? `Vous (${x.domain})` : x.domain}</span>
                      <span className="seo-bar-v">{fmtPos(x.share).replace(/,0$/, '')} %</span>
                      <ProgressBar value={x.share} max={100} size="sm" tone={x.isUs ? 'brand' : 'neutral'} label={`${x.domain} : ${x.share} %`} />
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="Pas encore de relevé" compact>
                  Après le premier relevé, vous verrez qui se positionne sur vos mots-clés.
                </EmptyState>
              )}
            </Surface>
            {report && report.competitors.length > 0 && (
              <Surface title="Concurrents sur vos mots-clés" id="p-comp">
                <div className="seo-table-wrap">
                  <table className="seo-table">
                    <thead>
                      <tr>
                        <th>Site</th>
                        <th className="num">Dans le top 10</th>
                        <th className="num">Position moy.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.competitors.map((c) => (
                        <tr key={c.domain}>
                          <td className="seo-dom">{c.domain}</td>
                          <td className="num">{c.keywordsInTop10}</td>
                          <td className="num">{fmtPos(c.avgPosition)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {demo && <p className="ui-caption mt-2">Concurrents fictifs (domaines .example).</p>}
              </Surface>
            )}
            {report && (report.movers.up.length > 0 || report.movers.down.length > 0) && (
              <Surface title="Cette semaine" id="p-moves">
                <ul className="m-0 list-none p-0">
                  {report.movers.up.slice(0, 3).map((k) => (
                    <li key={`u${k.keyword}${k.device}`} className="seo-change" data-tone="up">
                      <span className="seo-change-sign" aria-hidden="true">↑</span>
                      <span>
                        « {k.keyword} » gagne {k.change} place{(k.change ?? 0) > 1 ? 's' : ''} ({k.device === 'mobile' ? 'mobile' : 'ordinateur'}), {k.position ?? '> 20'}ᵉ
                      </span>
                    </li>
                  ))}
                  {report.movers.down.slice(0, 3).map((k) => (
                    <li key={`d${k.keyword}${k.device}`} className="seo-change" data-tone="down">
                      <span className="seo-change-sign" aria-hidden="true">↓</span>
                      <span>
                        « {k.keyword} » perd {Math.abs(k.change ?? 0)} place{Math.abs(k.change ?? 0) > 1 ? 's' : ''} ({k.device === 'mobile' ? 'mobile' : 'ordinateur'}), {k.position ?? '> 20'}ᵉ
                      </span>
                    </li>
                  ))}
                </ul>
              </Surface>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
