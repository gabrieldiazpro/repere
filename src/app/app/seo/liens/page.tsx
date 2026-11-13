import Link from 'next/link';
import '@/components/app/seo/seo.css';
import { PageHeader } from '@/components/app/PageHeader';
import { Surface } from '@/components/ui/Surface';
import { KeyFigure } from '@/components/ui/KeyFigure';
import { ProgressBar } from '@/components/ui/Progress';
import { EmptyState } from '@/components/ui/EmptyState';
import { loadSeoSuite } from '@/components/app/seo/data';
import { fmtInt, linkStats, pathOf, type PageRow } from '@/components/app/seo/model';
import { BarChart, SeoNav, Source } from '@/components/app/seo/parts';
import { backlinksView } from '@/lib/seodata/service';
import { recordTabView } from '@/lib/roi/usage';

export const metadata = { title: 'Liens' };
export const maxDuration = 60;

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

export default async function LiensPage() {
  const s = await loadSeoSuite();
  // Liens entrants réservés à Accompagné et Agence (engagement fixe DataForSEO : rentable par construction).
  const included = s.demo || Boolean(s.ctx?.limits.backlinks);
  let bl: Awaited<ReturnType<typeof backlinksView>> | null = null;
  if (included && s.ctx && s.p) bl = await backlinksView(s.ctx, s.p).catch(() => null);
  // Usage réel de l'onglet (tableau de ROI, /admin/roi) : compté côté serveur, comptes démo ignorés.
  if (!s.demo) await recordTabView(s.ctx?.businessId ?? s.ws.business.id, 'liens');
  const b = bl && bl.available ? bl : null;
  const st = s.latest ? linkStats(s.latest.pages) : null;
  const last12 = b ? b.newLost.slice(-12) : [];
  const gained = last12.reduce((x, m) => x + m.newDomains - m.lostDomains, 0);

  const result = b
    ? `${fmtInt(b.summary.referringDomains)} sites pointent vers le vôtre`
    : st
      ? st.orphans.length
        ? `${st.orphans.length} page${st.orphans.length > 1 ? 's' : ''} de votre site ne ${st.orphans.length > 1 ? 'sont' : 'est'} reliée${st.orphans.length > 1 ? 's' : ''} à aucune autre`
        : 'Toutes vos pages sont reliées entre elles'
      : 'Vos liens ne sont pas encore analysés';

  return (
    <>
      <PageHeader
        title="Liens"
        meta={<>Liens entrants et maillage interne{s.demo ? ' (démo)' : ''}</>}
        result={result}
        resultTone={b ? (gained >= 0 ? 'up' : 'down') : st?.orphans.length ? 'warn' : st ? 'up' : undefined}
        subtitle={b ? `Solde sur 12 mois : ${gained >= 0 ? '+' : '−'}${fmtInt(Math.abs(gained))} sites. Les liens d’autres sites restent un signal de confiance pour Google et une source pour les IA.` : 'Les liens entre vos propres pages aident Google à trouver et à comprendre vos pages importantes.'}
        primary={st && (st.orphans.length || st.weak.length) ? <a className="ui-btn" data-variant="primary" href="#maillage">Relier les pages isolées</a> : undefined}
      />
      <div className="rp-page">
        <SeoNav active="liens" />
        {b ? (
          <div className="seo-grid mb-4">
            <div className="seo-grid seo-grid-3">
              <Surface title="Sites qui vous citent" id="l-dom" elevation="raised">
                <KeyFigure label="domaines référents" value={b.summary.referringDomains} delta={gained} deltaLabel="sur 12 mois" size="md" />
              </Surface>
              <Surface title="Liens entrants" id="l-bl">
                <KeyFigure label={`dont ${fmtInt(b.summary.brokenBacklinks ?? 0)} vers des pages en erreur`} value={b.summary.backlinks} size="md" />
              </Surface>
              <Surface title="Gagnés et perdus" id="l-nl">
                <BarChart values={last12.map((m) => m.newDomains)} labels={last12.map((m) => MONTHS[Number(m.date.slice(5, 7)) - 1])} label={`Nouveaux sites référents par mois : ${last12.map((m) => m.newDomains).join(', ')}`} height={90} />
                <p className="ui-caption mt-1">Nouveaux sites référents par mois.</p>
              </Surface>
            </div>
            <div className="seo-grid seo-grid-2e">
              <Surface title="Principaux sites référents" id="l-ref">
                <div className="seo-table-wrap">
                  <table className="seo-table">
                    <thead>
                      <tr>
                        <th>Site</th>
                        <th className="num">Liens</th>
                        <th className="num">Vu depuis</th>
                      </tr>
                    </thead>
                    <tbody>
                      {b.referringDomains.slice(0, 10).map((r) => (
                        <tr key={r.domain}>
                          <td>{r.domain}</td>
                          <td className="num">{fmtInt(r.backlinks)}</td>
                          <td className="num">{r.firstSeen ? new Date(r.firstSeen).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {b.source.demo && <p className="ui-caption mt-2">Sites fictifs (domaines .example).</p>}
              </Surface>
              <Surface title="Textes des liens" id="l-anch">
                <ul className="seo-bars">
                  {b.anchors.slice(0, 6).map((a) => (
                    <li key={a.anchor} className="seo-bar">
                      <span className="seo-bar-l">« {a.anchor} »</span>
                      <span className="seo-bar-v">{fmtInt(a.referringDomains)}</span>
                      <ProgressBar value={a.referringDomains} max={Math.max(1, b.anchors[0]?.referringDomains ?? 1)} size="sm" tone="neutral" label={`${a.anchor} : ${a.referringDomains} sites`} />
                    </li>
                  ))}
                </ul>
                <p className="ui-caption mt-2">Des textes variés et naturels (votre nom, votre adresse) sont un bon signe ; des ancres toutes identiques et commerciales, un risque.</p>
              </Surface>
            </div>
            <Source provider={b.source.provider} demo={b.source.demo} at={b.at} note="Mis à jour une fois par mois" />
          </div>
        ) : !included ? (
          <Surface title="Liens entrants" id="l-offer" className="mb-4">
            <p className="ui-small">
              <b>Inclus dans les offres Accompagné et Agence.</b> Les sites qui pointent vers le vôtre, les domaines gagnés et perdus chaque mois et
              les textes de ces liens viennent d’un index du web entier, payant : Repéré les relève pour les offres Accompagné et Agence, et n’affiche
              ici aucun chiffre plutôt qu’une estimation.
            </p>
            <p className="ui-small mt-2">
              Dès maintenant, gratuitement : Search Console liste vos principaux liens (rapport « Liens »), et la page{' '}
              <Link className="rp-link" href="/app/sources">Sources et citations</Link> montre les sites que les IA citent dans votre domaine.
            </p>
            <p className="mt-3">
              <Link className="ui-btn" data-size="sm" href={`/tarifs?segment=${s.ctx?.segment ?? 'local'}`}>
                Voir l’offre Accompagné
              </Link>
            </p>
          </Surface>
        ) : (
          <Surface title="Liens entrants" id="l-off" className="mb-4">
            <p className="ui-small">
              {bl && !bl.available ? `${bl.reason} ` : ''}Mesurer les liens d’autres sites vers le vôtre demande un index du web entier, payant. Repéré n’affiche donc aucun chiffre ici plutôt qu’une estimation.
              Gratuitement, Search Console liste vos principaux liens (rapport « Liens »), et la page <Link className="rp-link" href="/app/sources">Sources et citations</Link> montre les sites que les IA citent dans votre domaine : ce sont les liens qui comptent le plus.
            </p>
          </Surface>
        )}

        <Surface title="Maillage interne" id="maillage" elevation={b ? 'base' : 'raised'}>
          {!st ? (
            <EmptyState title="Lancez l’exploration" compact action={<Link className="ui-btn" data-size="sm" href="/app/seo/technique">Explorer mon site</Link>}>
              RepereBot suit vos liens internes pour mesurer la profondeur de chaque page et repérer les pages isolées.
            </EmptyState>
          ) : (
            <div className="seo-grid seo-grid-2e">
              <div>
                <h3 className="ui-h2 mb-2">Nombre de clics depuis l’accueil</h3>
                <div className="grid grid-cols-[minmax(0,1fr)] gap-2">
                  {st.depth.map((d) => (
                    <div key={d.depth} className="seo-depth">
                      <span>{d.depth === 0 ? 'Accueil' : `${d.depth} clic${d.depth > 1 ? 's' : ''}`}</span>
                      <ProgressBar value={d.count} max={Math.max(...st.depth.map((x) => x.count))} size="sm" tone={d.depth > 3 ? 'warn' : 'brand'} label={`${d.count} pages à ${d.depth} clics`} />
                      <b className="text-right tabular-nums">{d.count}</b>
                    </div>
                  ))}
                  {st.orphans.length > 0 && (
                    <div className="seo-depth">
                      <span>Isolées</span>
                      <ProgressBar value={st.orphans.length} max={Math.max(1, ...st.depth.map((x) => x.count))} size="sm" tone="down" label={`${st.orphans.length} pages isolées`} />
                      <b className="text-right tabular-nums">{st.orphans.length}</b>
                    </div>
                  )}
                </div>
                <p className="ui-caption mt-2">Au-delà de 3 clics, Google passe moins souvent. Une page isolée n’est connue que par le plan du site.</p>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
                {[
                  { t: 'Pages isolées (aucun lien interne)', list: st.orphans, d: (): string => 'plan du site seulement' },
                  { t: 'Pages trop profondes', list: st.deep, d: (p: PageRow) => `${p.depth} clics` },
                  { t: 'Pages avec un seul lien entrant', list: st.weak, d: (p: PageRow) => `${p.inlinks} lien` },
                  { t: 'Liens vers des pages en erreur', list: st.broken, d: (p: PageRow) => `erreur ${p.status}` },
                ]
                  .filter((g) => g.list.length)
                  .map((g) => (
                    <div key={g.t}>
                      <h3 className="ui-h2 mb-1 text-[15px]">
                        {g.t} ({g.list.length})
                      </h3>
                      <ul className="seo-urls">
                        {g.list.slice(0, 8).map((p) => (
                          <li key={p.url}>
                            <code>{pathOf(p.url)}</code>
                            <span>{g.d(p)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                {!st.orphans.length && !st.deep.length && !st.weak.length && !st.broken.length && <p className="ui-small">Aucune page isolée, trop profonde ou cassée.</p>}
                <Link href="/app/seo/technique?constat=seo.link.orphans" className="rp-link text-[14px]">
                  Voir les corrections dans l’audit
                </Link>
              </div>
            </div>
          )}
          {s.latest && <Source provider="repere" demo={s.latest.demo} at={s.latest.at} />}
        </Surface>
      </div>
    </>
  );
}
