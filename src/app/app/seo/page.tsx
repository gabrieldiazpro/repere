import Link from 'next/link';
import { Suspense } from 'react';
import '@/components/app/seo/seo.css';
import { PageHeader } from '@/components/app/PageHeader';
import { Icon } from '@/components/app/icons';
import { Cascade } from '@/components/motion/Cascade';
import { Counter } from '@/components/motion/Counter';
import { Surface } from '@/components/ui/Surface';
import { Gauge } from '@/components/ui/Progress';
import { Delta } from '@/components/ui/Delta';
import { Sparkline } from '@/components/ui/Sparkline';
import { KeyFigure } from '@/components/ui/KeyFigure';
import { EmptyState } from '@/components/ui/EmptyState';
import { loadGsc, loadRanks, loadSeoSuite } from '@/components/app/seo/data';
import { diffRuns, fmtInt, fmtPos, nextCrawlAllowed, topFixes, canAutoFix } from '@/components/app/seo/model';
import { ConnState, FixList, SeoNav, Source, agentHref } from '@/components/app/seo/parts';
import { ChooseProperty, ConnectGscButton, CrawlButton, OAuthNotice } from '@/components/app/seo/controls';
import type { ProviderKind } from '@/lib/seodata/types';

export const metadata = { title: 'SEO et GEO' };
export const maxDuration = 60;

const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Europe/Paris' });
const tone = (s: number) => (s >= 75 ? 'up' : s >= 50 ? 'warn' : 'down') as 'up' | 'warn' | 'down';

const CONNS: { kind: ProviderKind; name: string; what: string; href: string }[] = [
  { kind: 'searchConsole', name: 'Google Search Console', what: 'Clics, impressions et requêtes réelles sur Google (16 mois).', href: '/app/seo/search-console' },
  { kind: 'perf', name: 'Google PageSpeed Insights', what: 'Vitesse mesurée chez les vrais visiteurs et en laboratoire.', href: '/app/seo/performance' },
  { kind: 'serp', name: 'Suivi des positions', what: 'Votre place sur Google pour vos mots-clés, chaque semaine.', href: '/app/seo/positions' },
  { kind: 'backlinks', name: 'Liens entrants', what: 'Les sites qui pointent vers le vôtre.', href: '/app/seo/liens' },
];

export default async function SeoOverviewPage() {
  const s = await loadSeoSuite();
  const { latest, previous, runs, status, demo } = s;
  const [gsc, ranks] = await Promise.all([loadGsc(), loadRanks()]);
  const fixes = latest ? topFixes(latest.seo, latest.geo, 5) : [];
  const diff = diffRuns(previous, latest);
  const next = demo ? null : nextCrawlAllowed(s.rights, runs.filter((r) => r.trigger === 'manual').map((r) => r.at));
  const first = fixes[0];
  const gscOk = gsc && gsc.available ? gsc : null;
  const conn = status?.searchConsole;

  const result = latest
    ? fixes.length
      ? `${fixes.length} corrections feraient progresser votre site sur Google et dans les IA`
      : 'Votre site ne présente aucun défaut prioritaire'
    : 'Votre site n’a pas encore été exploré';
  const primary = latest ? (
    first ? (
      <Link className="ui-btn" data-variant="primary" href={canAutoFix(first) ? agentHref(first) : '/app/seo/technique'}>
        {canAutoFix(first) ? 'Laisser Repéré corriger le n° 1' : 'Voir la correction n° 1'}
        <Icon name="chevron" size={16} />
      </Link>
    ) : undefined
  ) : (
    <CrawlButton demo={demo} allowed={!next} rightsLabel={s.rights.label} nextAt={next?.toISOString()} primary />
  );

  return (
    <>
      <Suspense fallback={null}>
        <OAuthNotice />
      </Suspense>
      <PageHeader
        title="SEO et GEO"
        meta={<>Google et les IA, à partir de votre site{demo ? ' (démo)' : ''}</>}
        result={result}
        resultTone={latest ? (fixes.some((f) => f.severity === 'critical' || f.severity === 'high') ? 'down' : 'neutral') : undefined}
        subtitle={
          latest
            ? `Exploration du ${fmtDay(latest.at)} : ${fmtInt(latest.pagesCrawled)} pages lues par RepereBot, ${fmtInt(latest.seo.stats.checksRun)} contrôles Google et un audit de lisibilité par les IA.`
            : s.website
              ? `RepereBot lit les pages de ${s.website.replace(/^https?:\/\//, '')} (1 minute au plus), puis Repéré vérifie 185 points Google et la lisibilité par les IA.`
              : 'Renseignez l’adresse de votre site dans les réglages : Repéré l’explorera pour vérifier 185 points Google et la lisibilité par les IA.'
        }
        primary={primary}
        secondary={latest ? <CrawlButton demo={demo} allowed={!next} rightsLabel={s.rights.label} nextAt={next?.toISOString()} /> : undefined}
      />
      <div className="rp-page">
        <SeoNav active="apercu" />
        <Cascade className="seo-grid">
          {conn?.connected && !conn.siteUrl && conn.sites.length > 0 && (
            <Surface title="Choisissez votre propriété Search Console" id="seo-prop" elevation="raised" tone="warn">
              <p className="ui-small mb-3">Google vous a donné accès à plusieurs propriétés : indiquez celle de ce site pour importer 16 mois de données.</p>
              <ChooseProperty businessId={s.ws.business.id} sites={conn.sites} />
            </Surface>
          )}

          {latest ? (
            <div className="seo-grid seo-grid-2">
              <Surface title="Vos deux scores" id="seo-scores" elevation="hero" aside={<Link href="/app/seo/technique" className="rp-link">Détail</Link>}>
                <div className="seo-twin">
                  <div className="seo-twin-side">
                    <Gauge value={latest.seo.score} tone={tone(latest.seo.score)} size={112} label={`Score Google ${latest.seo.score} sur 100`}>
                      <span className="seo-twin-num">
                        <Counter value={latest.seo.score} />
                      </span>
                    </Gauge>
                    <span className="seo-twin-name">Google (SEO)</span>
                    {diff.seoDelta !== null ? <Delta value={diff.seoDelta} unit=" pts" label={`depuis le ${fmtDay(previous!.at)}`} /> : <span className="ui-caption">Première exploration</span>}
                  </div>
                  <span className="seo-twin-link" aria-hidden="true" />
                  <div className="seo-twin-side">
                    <Gauge value={latest.geo.score} tone={tone(latest.geo.score)} size={112} label={`Score IA ${latest.geo.score} sur 100`}>
                      <span className="seo-twin-num">
                        <Counter value={latest.geo.score} />
                      </span>
                    </Gauge>
                    <span className="seo-twin-name">IA (GEO)</span>
                    {diff.geoDelta !== null ? <Delta value={diff.geoDelta} unit=" pts" label={`depuis le ${fmtDay(previous!.at)}`} /> : <span className="ui-caption">Première exploration</span>}
                  </div>
                </div>
                {runs.length > 1 && (
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <Sparkline values={runs.map((r) => r.seo.score)} label={`Score Google : ${runs.map((r) => r.seo.score).join(', ')}`} className="text-[var(--tone-brand)]" />
                    <Sparkline values={runs.map((r) => r.geo.score)} label={`Score IA : ${runs.map((r) => r.geo.score).join(', ')}`} className="text-[var(--tone-brand)]" />
                  </div>
                )}
                <p className="ui-caption mt-3">
                  Le score Google vient de {fmtInt(latest.seo.stats.checksRun)} contrôles, arrondi à 5 points. Le score IA mesure si les IA peuvent lire, comprendre et citer vos pages ; ce n’est pas une mesure de citations (voir « Ce que disent les IA »).
                </p>
                <Source provider="repere" demo={latest.demo} at={latest.at} note={latest.demo ? 'Site fictif' : undefined} />
              </Surface>

              <Surface title="Ce qui a changé" id="seo-diff" aside={previous ? <span>depuis le {fmtDay(previous.at)}</span> : undefined}>
                {!previous ? (
                  <EmptyState title="Une seule exploration pour l’instant" compact>
                    Relancez l’exploration après vos corrections : Repéré vous dira ici ce qui est réglé et ce qui est apparu.
                  </EmptyState>
                ) : diff.resolved.length + diff.appeared.length + diff.better.length + diff.worse.length === 0 ? (
                  <p className="ui-small">Aucun changement entre les deux dernières explorations.</p>
                ) : (
                  <ul className="m-0 list-none p-0">
                    {diff.resolved.slice(0, 4).map((f) => (
                      <li key={`r${f.id}`} className="seo-change" data-tone="up">
                        <span className="seo-change-sign" aria-hidden="true">✓</span>
                        <span><span className="sr-only">Réglé : </span>{f.title.replace(/^(\d+)/, '$1')} <span className="ui-caption">— réglé</span></span>
                      </li>
                    ))}
                    {diff.better.slice(0, 3).map(({ f, before }) => (
                      <li key={`b${f.id}`} className="seo-change" data-tone="up">
                        <span className="seo-change-sign" aria-hidden="true">−</span>
                        <span><span className="sr-only">Amélioré : </span>{f.title} <span className="ui-caption">— {before} → {f.affectedCount} {f.affectedCount > 1 ? 'pages' : 'page'} ({f.sectionLabel.toLowerCase()})</span></span>
                      </li>
                    ))}
                    {diff.appeared.slice(0, 3).map((f) => (
                      <li key={`a${f.id}`} className="seo-change" data-tone="down">
                        <span className="seo-change-sign" aria-hidden="true">+</span>
                        <span><span className="sr-only">Nouveau : </span>{f.title} <span className="ui-caption">— nouveau</span></span>
                      </li>
                    ))}
                    {diff.worse.slice(0, 3).map(({ f, before }) => (
                      <li key={`w${f.id}`} className="seo-change" data-tone="down">
                        <span className="seo-change-sign" aria-hidden="true">+</span>
                        <span><span className="sr-only">Aggravé : </span>{f.title} <span className="ui-caption">— {before} → {f.affectedCount} {f.affectedCount > 1 ? 'pages' : 'page'} ({f.sectionLabel.toLowerCase()})</span></span>
                      </li>
                    ))}
                  </ul>
                )}
              </Surface>
            </div>
          ) : (
            <Surface title="Première exploration" id="seo-first" elevation="hero">
              <EmptyState title="Lancez l’exploration de votre site" icon={<Icon name="search" />} action={<CrawlButton demo={demo} allowed={!next} rightsLabel={s.rights.label} nextAt={next?.toISOString()} primary />}>
                RepereBot respecte votre robots.txt et lit vos pages comme Google. Vous obtenez un score Google, un score IA et les corrections dans l’ordre. Votre offre : {s.rights.label.toLowerCase()}.
              </EmptyState>
            </Surface>
          )}

          {latest && fixes.length > 0 && (
            <Surface title="Les 5 corrections qui comptent le plus" id="seo-top" elevation="raised" aside={<Link href="/app/seo/technique" className="rp-link">Tout l’audit</Link>}>
              <FixList fixes={fixes} />
              <p className="ui-caption mt-3">Ordre : gravité × effet attendu ÷ effort. « Repéré peut le faire » : l’agent prépare la modification, vous la validez avant toute publication.</p>
            </Surface>
          )}

          <div className="seo-grid seo-grid-3">
            <Surface title="Clics depuis Google" id="seo-clics" aside={<Link href="/app/seo/search-console" className="rp-link">Search Console</Link>}>
              {gscOk ? (
                <>
                  <KeyFigure label="28 derniers jours" value={gscOk.totals.clicks} delta={gscOk.clicksChange !== null ? Math.round(gscOk.clicksChange * 100) : null} deltaUnit=" %" deltaLabel="vs 28 jours précédents" trend={gscOk.series.map((d) => d.clicks)} trendLabel="Clics par jour" size="md" />
                  <Source provider={gscOk.source.provider} demo={gscOk.source.demo} />
                </>
              ) : (
                <EmptyState title="Search Console n’est pas connecté" compact action={<ConnectGscButton businessId={s.ws.business.id} demo={demo} />}>
                  Connectez-la pour voir vos clics, vos requêtes et vos pages qui progressent.
                </EmptyState>
              )}
            </Surface>
            <Surface title="Visibilité sur vos mots-clés" id="seo-vis" aside={<Link href="/app/seo/positions" className="rp-link">Positions</Link>}>
              {ranks && ranks.report.visibility !== null ? (
                <>
                  <KeyFigure label={`${ranks.report.keywords.length} relevés suivis`} value={Math.round(ranks.report.visibility)} unit=" %" delta={ranks.report.visibilityPrevious !== null ? Math.round((ranks.report.visibility - ranks.report.visibilityPrevious) * 10) / 10 : null} deltaUnit=" pt" deltaLabel="sur une semaine" size="md" margin="Estimation : part des clics possibles captés" />
                  <Source provider={ranks.report.demo ? 'demo' : 'dataforseo'} demo={ranks.report.demo} />
                </>
              ) : (
                <EmptyState title="Aucune position relevée" compact action={<Link href="/app/seo/positions" className="ui-btn" data-size="sm">Choisir mes mots-clés</Link>}>
                  {ranks?.serp?.state === 'off' ? ranks.serp.reason : 'Ajoutez les mots-clés que vos clients tapent : Repéré relève votre place chaque semaine.'}
                </EmptyState>
              )}
            </Surface>
            <Surface title="Position moyenne" id="seo-pos" aside={<Link href="/app/seo/search-console" className="rp-link">Requêtes</Link>}>
              {gscOk && gscOk.totals.position !== null ? (
                <>
                  <p className="ui-figure">{fmtPos(gscOk.totals.position)}</p>
                  <p className="ui-small mt-1">
                    {gscOk.previous.position !== null ? <Delta value={Math.round((gscOk.previous.position - gscOk.totals.position) * 10) / 10} unit=" place" label="gagnée en moyenne" decimals={1} /> : null}
                  </p>
                  <p className="ui-caption mt-2">Moyenne pondérée par les impressions, toutes requêtes confondues.</p>
                </>
              ) : (
                <p className="ui-small">Disponible après la connexion de Search Console.</p>
              )}
            </Surface>
          </div>

          <Surface title="Vos sources de données" id="seo-conns">
            <ul className="seo-conns">
              {CONNS.map((c) => {
                const st = status?.providers.find((x) => x.kind === c.kind);
                return (
                  <li key={c.kind} className="seo-conn" data-state={st?.state ?? 'off'}>
                    <span className="seo-conn-dot" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="seo-conn-n">
                        <Link href={c.href} className="hover:underline">{c.name}</Link>
                      </p>
                      <p className="seo-conn-r">{st?.state === 'off' ? st.reason : c.what}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {c.kind === 'searchConsole' && st?.state === 'off' && status?.searchConsole.enabled ? (
                        <ConnectGscButton businessId={s.ws.business.id} demo={demo} label="Connecter" />
                      ) : (
                        <ConnState s={st} />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="ui-caption mt-3">
              Sans source connectée, Repéré n’affiche aucun chiffre de trafic ni de position : seulement ce que son robot mesure sur votre site.
              {demo && ' Ici, toutes les sources sont en démonstration.'}
            </p>
          </Surface>

          {latest && (
            <p className="ui-small text-[var(--muted)]">
              Mesurez avec <Link className="rp-link" href="/app/seo/positions">les positions</Link>, comprenez avec <Link className="rp-link" href="/app/seo/technique">l’audit</Link> et <Link className="rp-link" href="/app/seo/geo">la lisibilité par les IA</Link>, agissez avec <Link className="rp-link" href="/app/agent">l’agent</Link>, prouvez avec <Link className="rp-link" href="/app/seo/search-console">les clics Google</Link>.
            </p>
          )}
        </Cascade>
      </div>
    </>
  );
}
