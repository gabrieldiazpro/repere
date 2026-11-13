import Link from 'next/link';
import '@/components/app/seo/seo.css';
import { PageHeader } from '@/components/app/PageHeader';
import { Surface } from '@/components/ui/Surface';
import { Tabs } from '@/components/ui/Tabs';
import { Gauge } from '@/components/ui/Progress';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { loadSeoSuite } from '@/components/app/seo/data';
import { METRIC_EXPLAIN, RATING_LABEL, RATING_TONE, fmtInt, fmtMs, pathOf, templates } from '@/components/app/seo/model';
import { SeoNav, Source } from '@/components/app/seo/parts';
import { perfView } from '@/lib/seodata/service';
import { rate } from '@/lib/seodata/perf';
import type { Device, PerfDevice, Rating } from '@/lib/seodata/types';

export const metadata = { title: 'Vitesse du site' };
export const maxDuration = 60;

function Metric({ k, value, rating, scope }: { k: keyof typeof METRIC_EXPLAIN; value: string; rating: Rating | null; scope: string }) {
  const m = METRIC_EXPLAIN[k];
  const tone = rating ? RATING_TONE[rating] : undefined;
  return (
    <div className="seo-metric" data-tone={tone}>
      <span className="seo-metric-n">{m.name}</span>
      <span className="seo-metric-v">{value}</span>
      <span>{rating ? <StatusBadge tone={tone}>{RATING_LABEL[rating]}</StatusBadge> : <span className="ui-caption">Pas assez de visites mesurées</span>}</span>
      <span className="seo-metric-x">
        {m.plain} <span className="sr-only">({m.short}, {scope})</span>
      </span>
    </div>
  );
}

export default async function PerformancePage({ searchParams }: { searchParams: Promise<{ appareil?: string }> }) {
  const sp = await searchParams;
  const device: Device = sp.appareil === 'ordinateur' ? 'desktop' : 'mobile';
  const s = await loadSeoSuite();
  const perfStatus = s.status?.providers.find((p) => p.kind === 'perf');
  let perf: Awaited<ReturnType<typeof perfView>> | null = null;
  if (s.ctx && s.p) perf = await perfView(s.ctx, s.p, null).catch(() => null);
  const d: PerfDevice | null = perf && perf.available ? (perf.devices[device] ?? null) : null;
  const tpl = s.latest ? templates(s.latest.pages).slice(0, 8) : [];
  const f = d?.field ?? null;
  const lab = d?.lab ?? null;
  const fails = f ? (['lcp', 'inp', 'cls'] as const).filter((k) => f.ratings[k] && f.ratings[k] !== 'good') : [];
  const result = !d
    ? 'La vitesse réelle de votre site n’est pas encore mesurée'
    : f?.passesCwv === true
      ? `Votre site est rapide pour vos visiteurs sur ${device === 'mobile' ? 'mobile' : 'ordinateur'}`
      : f?.passesCwv === false
        ? `${fails.length === 1 ? 'Un critère de vitesse Google n’est' : `${fails.length} critères de vitesse Google ne sont`} pas atteint${fails.length > 1 ? 's' : ''} sur ${device === 'mobile' ? 'mobile' : 'ordinateur'}`
        : 'Pas assez de visites pour les données réelles : voici la mesure de laboratoire';
  const scope = f?.scope === 'origin' ? 'tout le site' : 'cette page';

  return (
    <>
      <PageHeader
        title="Vitesse"
        meta={<>Signaux Web essentiels de Google{s.demo ? ' (démo)' : ''}</>}
        result={result}
        resultTone={!d ? undefined : f?.passesCwv === true ? 'up' : f?.passesCwv === false ? 'down' : 'neutral'}
        subtitle="Google tient compte de la vitesse ressentie par vos visiteurs. Trois mesures comptent : l’affichage, la réaction aux clics et la stabilité."
        primary={lab?.opportunities.length ? <a href="#pistes" className="ui-btn" data-variant="primary">Voir quoi accélérer</a> : undefined}
      />
      <div className="rp-page">
        <SeoNav active="performance" />
        <nav className="mb-4" aria-label="Appareil">
          <Tabs variant="pill" label="Appareil" value={device} items={[{ id: 'mobile', label: 'Mobile', href: '/app/seo/performance' }, { id: 'desktop', label: 'Ordinateur', href: '/app/seo/performance?appareil=ordinateur' }]} />
        </nav>
        {!d ? (
          <Surface title="Mesure de vitesse" id="pf-off" tone="warn" className="mb-4">
            <p className="ui-small">{perf && !perf.available ? perf.reason : perfStatus?.reason ?? 'Mesure indisponible pour le moment.'} En attendant, voici ce que notre robot mesure lui-même : le temps de réponse et le poids de vos pages.</p>
          </Surface>
        ) : (
          <div className="seo-grid seo-grid-main mb-4">
            <Surface title={`Chez vos vrais visiteurs (${scope})`} id="pf-field" elevation="raised">
              {f ? (
                <div className="seo-cwv">
                  <Metric k="lcp" value={fmtMs(f.lcpMs)} rating={f.ratings.lcp} scope={scope} />
                  <Metric k="inp" value={fmtMs(f.inpMs)} rating={f.ratings.inp} scope={scope} />
                  <Metric k="cls" value={f.cls === null ? '—' : f.cls.toFixed(2).replace('.', ',')} rating={f.ratings.cls} scope={scope} />
                </div>
              ) : (
                <EmptyState title="Pas assez de visites mesurées par Chrome" compact>
                  Google publie ces mesures quand un site a assez de visiteurs sur 28 jours. La mesure de laboratoire, à droite, reste disponible.
                </EmptyState>
              )}
              {perf && perf.available && <Source provider={perf.source.provider} demo={perf.source.demo} at={perf.fetchedAt} />}
              <p className="ui-caption mt-3">75 % de vos visiteurs ont une expérience au moins aussi bonne que ces valeurs (28 derniers jours, navigateurs Chrome).</p>
            </Surface>
            <Surface title="En laboratoire" id="pf-lab">
              {lab?.performance != null ? (
                <div className="flex flex-wrap items-center gap-4">
                  <Gauge value={lab.performance} size={92} tone={lab.performance >= 90 ? 'up' : lab.performance >= 50 ? 'warn' : 'down'} label={`Score Lighthouse ${lab.performance} sur 100`}>
                    <b className="text-[24px]">{lab.performance}</b>
                  </Gauge>
                  <ul className="m-0 grid min-w-[180px] flex-1 list-none gap-1 p-0 text-[13.5px]">
                    <li>Affichage : <b>{fmtMs(lab.lcpMs)}</b> <span className="ui-caption">({rate('lcpMs', lab.lcpMs) ? RATING_LABEL[rate('lcpMs', lab.lcpMs)!].toLowerCase() : '—'})</span></li>
                    <li>Blocage : <b>{fmtMs(lab.tbtMs)}</b></li>
                    <li>Premier contenu : <b>{fmtMs(lab.fcpMs)}</b></li>
                  </ul>
                </div>
              ) : (
                <p className="ui-small">Mesure de laboratoire indisponible.</p>
              )}
              <p className="ui-caption mt-3">Un test simulé de votre page d’accueil (téléphone moyen, réseau 4G lent pour le mobile). Utile pour comparer avant / après une correction.</p>
            </Surface>
          </div>
        )}
        {lab && lab.opportunities.length > 0 && (
          <Surface title="Ce qui ralentit votre page d’accueil" id="pistes" className="mb-4">
            <ol className="seo-fixes">
              {lab.opportunities.map((o, i) => (
                <li key={o.id} className="seo-fix" style={{ gridTemplateColumns: 'auto minmax(0,1fr) auto' }}>
                  <span className="seo-fix-n" aria-hidden="true">{i + 1}</span>
                  <p className="seo-fix-t">{o.title}</p>
                  <span className="seo-pill" data-tone="brand">{o.savingsMs ? `jusqu’à ${fmtMs(o.savingsMs)} gagnées` : 'gain non chiffré'}</span>
                </li>
              ))}
            </ol>
          </Surface>
        )}
        <Surface title="Par modèle de page" id="pf-tpl" aside={<span>mesuré par RepereBot</span>}>
          {tpl.length ? (
            <div className="seo-table-wrap">
              <table className="seo-table">
                <thead>
                  <tr>
                    <th>Modèle</th>
                    <th className="num">Pages</th>
                    <th className="num">Réponse serveur</th>
                    <th className="num">Poids HTML</th>
                    <th className="num">Scripts</th>
                    <th className="num">Images sans dimensions</th>
                    <th>Exemple</th>
                  </tr>
                </thead>
                <tbody>
                  {tpl.map((t) => (
                    <tr key={t.template}>
                      <td className="kw">{t.template}</td>
                      <td className="num">{fmtInt(t.count)}</td>
                      <td className="num" style={{ color: t.fetchMs > 800 ? 'var(--tone-down)' : undefined }}>{fmtMs(t.fetchMs)}</td>
                      <td className="num">{fmtInt(t.kb)} Ko</td>
                      <td className="num">{t.scripts}</td>
                      <td className="num" style={{ color: t.imagesNoDim ? 'var(--tone-warn)' : undefined }}>{t.imagesNoDim}</td>
                      <td className="url">{pathOf(t.sample)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="Pas encore d’exploration" compact action={<Link href="/app/seo/technique" className="ui-btn" data-size="sm">Lancer l’exploration</Link>}>
              Après l’exploration, vous verrez quels types de pages (fiches, articles, catégories) sont les plus lents.
            </EmptyState>
          )}
          <p className="ui-caption mt-2">Réponse serveur : au-delà de 0,8 s, Google et vos visiteurs attendent. Images sans dimensions : elles font « sauter » la page au chargement.</p>
          {s.latest && <Source provider="repere" demo={s.latest.demo} at={s.latest.at} />}
        </Surface>
      </div>
    </>
  );
}
