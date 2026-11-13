import Link from 'next/link';
import '@/components/app/seo/seo.css';
import { PageHeader } from '@/components/app/PageHeader';
import { Icon } from '@/components/app/icons';
import { Surface } from '@/components/ui/Surface';
import { ProgressBar } from '@/components/ui/Progress';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Disclosure } from '@/components/ui/Disclosure';
import { loadSeoSuite } from '@/components/app/seo/data';
import { allFindings, fmtInt, pathOf, topFixes } from '@/components/app/seo/model';
import { deterministicRewrite, type FactsInput } from '@/lib/geo';
import { FixList, SeoNav, Source, agentHref } from '@/components/app/seo/parts';

export const metadata = { title: 'Lisible par les IA' };
export const maxDuration = 60;

type RewriteItem = { url: string; passageId: string; before: string; value: string; mode: string; notes?: string[] };
const PRESENCE: Record<string, { label: string; tone: 'up' | 'warn' | 'down' | 'neutral' }> = {
  verifiee: { label: 'Vous y êtes', tone: 'up' },
  liee: { label: 'Lien depuis votre site', tone: 'up' },
  absente: { label: 'Absent', tone: 'down' },
  inconnue: { label: 'À vérifier', tone: 'neutral' },
};
const STATUS: Record<string, { label: string; tone: 'up' | 'warn' | 'down' }> = { couverte: { label: 'Répondue', tone: 'up' }, partielle: { label: 'En partie', tone: 'warn' }, absente: { label: 'Sans réponse', tone: 'down' } };

export default async function GeoPage() {
  const s = await loadSeoSuite();
  const r = s.latest;
  if (!r) {
    return (
      <>
        <PageHeader title="Lisible par les IA" result="Votre site n’a pas encore été exploré" subtitle="Repéré vérifie si ChatGPT, Perplexity, Gemini et les aperçus IA de Google peuvent lire, comprendre et citer vos pages." />
        <div className="rp-page">
          <SeoNav active="geo" />
          <EmptyState title="Lancez l’exploration" icon={<Icon name="search" />} action={<Link className="ui-btn" data-variant="primary" href="/app/seo/technique">Explorer mon site</Link>}>
            L’analyse de lisibilité par les IA part de la même exploration que l’audit Google.
          </EmptyState>
        </div>
      </>
    );
  }
  const g = r.geo;
  const fixes = topFixes(null, g, 5);
  const rewrite = allFindings(null, g).find((f) => f.autoFix?.kind === 'rewrite');
  const fromFinding = ((rewrite?.autoFix?.payload as { items?: RewriteItem[] } | undefined)?.items ?? []).slice(0, 3);
  // Sans constat « passages faibles » (moins de la moitié des passages), on propose quand même les plus faibles.
  const items: RewriteItem[] = fromFinding.length
    ? fromFinding
    : g.passages.toRewrite.slice(0, 3).map((p) => {
        const rw = deterministicRewrite(p, { brand: g.brand, facts: s.ws.facts.facts as FactsInput });
        return { url: rw.url, passageId: rw.passageId, before: rw.before, value: rw.after, mode: rw.mode, notes: rw.notes };
      });
  const uncovered = g.fanOut.items.filter((i) => i.status !== 'couverte');
  const access = g.sections.find((x) => x.id === 'acces');
  const entity = g.sections.find((x) => x.id === 'entite');
  const blockers = access?.findings.filter((f) => f.severity === 'critical' || f.severity === 'high') ?? [];
  const result = blockers.length
    ? 'Certains robots d’IA ne peuvent pas lire votre site'
    : uncovered.length
      ? `${uncovered.length} question${uncovered.length > 1 ? 's' : ''} de vos clients sans réponse claire sur votre site`
      : items.length
        ? `${items.length} passage${items.length > 1 ? 's' : ''} à réécrire pour être cité`
        : 'Votre site est bien préparé pour être cité par les IA';

  return (
    <>
      <PageHeader
        title="Lisible par les IA"
        meta={<>Optimisation pour les moteurs génératifs (GEO){r.demo ? ' (démo)' : ''}</>}
        result={result}
        resultTone={blockers.length ? 'down' : uncovered.length || items.length ? 'warn' : 'up'}
        subtitle={`Score ${g.score}/100 : accès des robots, identité de votre entreprise, passages citables, questions couvertes, fraîcheur. Ce qui est vraiment cité se mesure dans « Ce que disent les IA ».`}
        primary={
          rewrite ? (
            <Link className="ui-btn" data-variant="primary" href={agentHref({ id: rewrite.id, origin: 'geo' })}>
              Faire réécrire par Repéré
            </Link>
          ) : undefined
        }
        secondary={
          <Link className="rp-link text-[14px]" href="/app/ia">
            Ce que disent les IA
          </Link>
        }
      />
      <div className="rp-page">
        <SeoNav active="geo" />
        <div className="seo-grid seo-grid-main mb-4">
          <Surface title="Passages à réécrire" id="geo-pass" elevation="raised" aside={<span>{fmtInt(g.stats.citablePassages)} citables sur {fmtInt(g.stats.passages)}</span>}>
            {items.length ? (
              <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
                {items.map((it) => (
                  <div key={it.passageId}>
                    <p className="ui-caption mb-2">
                      {pathOf(it.url)} · {it.mode === 'ia' ? 'proposé par l’IA, vérifié contre vos faits' : 'proposé par des règles de rédaction'}
                    </p>
                    <div className="seo-ba">
                      <div className="seo-ba-before">
                        <h4>Avant</h4>
                        <p>{it.before}</p>
                      </div>
                      <div className="seo-ba-after">
                        <h4>Après</h4>
                        <p>{it.value}</p>
                      </div>
                    </div>
                    {it.notes?.length ? <p className="ui-caption mt-2">{it.notes.join(' ')}</p> : null}
                  </div>
                ))}
                <p className="ui-caption">Une IA cite plus volontiers un passage qui se suffit à lui-même : le nom de l’entreprise, un chiffre précis, une date. Rien n’est publié sans votre validation ; les « [à compléter] » sont à remplir par vous.</p>
              </div>
            ) : (
              <EmptyState title="Aucun passage prioritaire à réécrire" compact>
                Vos pages clés contiennent déjà des passages autonomes et précis.
              </EmptyState>
            )}
          </Surface>
          <Surface title="Score par critère" id="geo-sec">
            <ul className="seo-bars">
              {g.sections
                .filter((x) => x.weight > 0)
                .map((x) => (
                  <li key={x.id} className="seo-bar">
                    <span className="seo-bar-l">{x.label}</span>
                    <span className="seo-bar-v">{x.measured ? x.score : '—'}</span>
                    {x.measured ? <ProgressBar value={x.score} size="sm" tone={x.score >= 75 ? 'up' : x.score >= 50 ? 'warn' : 'down'} label={`${x.label} : ${x.score} sur 100`} /> : <span className="ui-caption" style={{ gridColumn: '1 / -1' }}>Non mesuré : {x.note}</span>}
                  </li>
                ))}
            </ul>
          </Surface>
        </div>

        <div className="seo-grid seo-grid-2e mb-4">
          <Surface title="Questions de vos clients" id="geo-q" aside={<span>{g.fanOut.covered} répondues sur {g.fanOut.items.length}</span>}>
            <ul className="seo-fixes">
              {[...uncovered, ...g.fanOut.items.filter((i) => i.status === 'couverte')].slice(0, 8).map((q) => (
                <li key={q.id} className="seo-fix" style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}>
                  <div className="min-w-0">
                    <p className="seo-fix-t">{q.question}</p>
                    {q.bestUrl && <p className="seo-fix-m">Meilleure page : {pathOf(q.bestUrl)}</p>}
                  </div>
                  <StatusBadge tone={STATUS[q.status].tone}>{STATUS[q.status].label}</StatusBadge>
                </li>
              ))}
            </ul>
            <p className="ui-caption mt-2">{g.fanOut.note}</p>
          </Surface>
          <Surface title="Votre entreprise, vue par les IA" id="geo-ent">
            <p className="ui-small mb-2">
              Identité structurée (JSON-LD) : <b>{g.stats.orgJsonLd ? 'présente' : 'absente'}</b>. Robots de recherche des IA bloqués : <b>{g.stats.searchBotsBlocked.length ? g.stats.searchBotsBlocked.join(', ') : 'aucun'}</b>.
            </p>
            {(entity?.findings ?? []).concat(access?.findings ?? []).filter((f) => f.severity !== 'info').slice(0, 5).map((f) => (
              <p key={f.id} className="seo-change" data-tone="down">
                <span className="seo-change-sign" aria-hidden="true">!</span>
                <span>{f.title}</span>
              </p>
            ))}
            {!(entity?.findings ?? []).concat(access?.findings ?? []).some((f) => f.severity !== 'info') && <p className="seo-change" data-tone="up"><span className="seo-change-sign" aria-hidden="true">✓</span><span>Nom, coordonnées et accès des robots cohérents.</span></p>}
            <p className="mt-3">
              <Link href="/app/verite" className="rp-link text-[14px]">Vérifier votre fiche de vérité</Link>
            </p>
          </Surface>
        </div>

        <Surface title="Présence hors de votre site" id="geo-off" className="mb-4" aside={g.offsite.measured ? <span>{fmtInt(g.offsite.totalCitations)} citations relevées</span> : undefined}>
          {g.offsite.measured && g.offsite.domains.length ? (
            <div className="seo-table-wrap">
              <table className="seo-table">
                <thead>
                  <tr>
                    <th>Site cité par les IA</th>
                    <th>Type</th>
                    <th className="num">Citations</th>
                    <th>Vous</th>
                  </tr>
                </thead>
                <tbody>
                  {g.offsite.domains.slice(0, 8).map((d) => (
                    <tr key={d.domain}>
                      <td className="kw">{d.label}</td>
                      <td>{d.categoryLabel}</td>
                      <td className="num">{fmtInt(d.citations)}</td>
                      <td>
                        <StatusBadge tone={PRESENCE[d.clientPresence].tone}>{PRESENCE[d.clientPresence].label}</StatusBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="ui-caption mt-2">Part des citations qui pointent vers votre propre site : {Math.round(g.offsite.ownShare * 100)} %. Détail dans <Link className="rp-link" href="/app/sources">Sources et citations</Link>.</p>
            </div>
          ) : (
            <p className="ui-small">Non mesuré : il faut d’abord une mesure des réponses des IA. <Link className="rp-link" href="/app/questions">Questions suivies</Link></p>
          )}
        </Surface>

        {fixes.length > 0 && (
          <Surface title="Corrections GEO prioritaires" id="geo-fix" className="mb-4">
            <FixList fixes={fixes} />
          </Surface>
        )}

        <Disclosure title="Méthode et limites" icon={<Icon name="info" />}>
          <ul className="ui-small m-0 grid gap-1 pl-5">
            {g.limits.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </Disclosure>
        <Source provider="repere" demo={r.demo} at={r.at} note={g.demo ? 'Sous-questions issues de gabarits, sans IA' : undefined} />
      </div>
    </>
  );
}
