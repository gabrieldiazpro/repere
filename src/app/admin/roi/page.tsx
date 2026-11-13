import Link from 'next/link';
import { cookies } from 'next/headers';
import { isAdmin } from '../data';
import { breakEvenSubscribers, STOP_RULE_TEXT, type MonthPoint, type StopDecision } from '@/lib/roi/compute';
import { buildRoiReport, type RoiReport } from '@/lib/roi/report';
import { backlinksFixedUsd } from '@/lib/seodata/limits';
import { SOURCE_LABELS, type VisitSource } from '@/lib/roi/visits';

/**
 * ROI des sources de données payantes (réservé admin) : coût mensuel MESURÉ face au revenu mesuré, ratio et règle
 * d'arrêt « si le ratio reste < 1 après 3 mois, couper ». Méthode : src/lib/roi/report.ts, docs/MISE-EN-LIGNE.md.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export const metadata = { title: 'Admin : ROI des données payantes', robots: { index: false, follow: false } };

const eur = (n: number) => `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const int = (n: number) => n.toLocaleString('fr-FR');
const ratioText = (r: number | null) => (r === null ? '—' : r.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const frDay = (iso: string | null) => (iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '—');
const frMonth = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const muted = { color: 'var(--muted)' } as const;

const STOP_TONE: Record<StopDecision['status'], string> = {
  inactive: 'var(--muted)',
  evaluation: 'var(--ink)',
  'donnees-insuffisantes': 'var(--tone-warn)',
  continuer: 'var(--tone-up)',
  couper: 'var(--tone-down)',
};

function Figure({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="ui-card p-4">
      <dd className="ui-figure-sm rp-num">{value}</dd>
      <dt className="ui-caption mt-1" style={muted}>{label}</dt>
      {note && <p className="ui-caption mt-1" style={muted}>{note}</p>}
    </div>
  );
}

function Empty({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="ui-empty mt-3">
      <p className="font-semibold">{title}</p>
      <p className="ui-small" style={muted}>{children}</p>
    </div>
  );
}

function StopRule({ stop }: { stop: StopDecision }) {
  return (
    <div className="ui-card mt-3 p-4" style={{ borderLeft: `3px solid ${STOP_TONE[stop.status]}` }}>
      <p className="font-semibold">Règle d’arrêt : {STOP_RULE_TEXT}</p>
      <p className="ui-small mt-1" style={muted}>
        Démarrage : {frDay(stop.startDate)} · décision à partir du {frDay(stop.decisionDate)} · ratio cumulé des 3 derniers mois relevés : {ratioText(stop.ratio3m)}
      </p>
      <p className="ui-small mt-1 font-semibold" style={{ color: STOP_TONE[stop.status] }}>{stop.message}</p>
    </div>
  );
}

function History({ points }: { points: MonthPoint[] }) {
  if (!points.length) return null;
  return (
    <div className="ui-card mt-3 overflow-x-auto p-0">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Relevés mensuels</caption>
        <thead style={{ background: 'var(--surface-2)' }}>
          <tr>{['Mois', 'Coût', 'Revenu', 'Ratio'].map((h) => <th key={h} scope="col" className="ui-caption p-3 font-semibold" style={muted}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.month} className="border-t" style={{ borderColor: 'var(--hair)' }}>
              <td className="p-3">{frMonth(p.month)}</td>
              <td className="p-3 rp-num">{eur(p.costEur)}</td>
              <td className="p-3 rp-num">{eur(p.revenueEur)}</td>
              <td className="p-3 rp-num">{ratioText(p.costEur > 0 ? Math.round((p.revenueEur / p.costEur) * 100) / 100 : null)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Barometres({ r }: { r: RoiReport['barometres'] }) {
  const hasActivity = r.costEur > 0 || r.visits.total > 0 || r.analyses + r.audits + r.signupsTotal > 0;
  return (
    <section className="mt-8" aria-labelledby="b-h">
      <h2 id="b-h" className="ui-h2">Baromètres publics</h2>
      <p className="ui-small mt-1" style={muted}>
        {r.enabled ? 'Activés (BAROMETRE_ENABLED=1)' : 'Désactivés : BAROMETRE_ENABLED n’est pas mis, aucune passe mensuelle automatique.'} ·{' '}
        {r.launchCount} baromètres par mois (BAROMETRE_MAX), coût estimé ≈ {eur(r.launchEstimateEur)} · plafond {eur(r.budgetEur)} (BAROMETRE_BUDGET_EUR).
        Seuil de rentabilité : {breakEvenSubscribers(r.launchEstimateEur, 29)} abonné{breakEvenSubscribers(r.launchEstimateEur, 29) > 1 ? 's' : ''} Essentiel local attribué{breakEvenSubscribers(r.launchEstimateEur, 29) > 1 ? 's' : ''}.
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Figure label="Coût du mois (mesuré)" value={eur(r.costEur)} note="registre barometre.budget" />
        <Figure label="Revenu mensuel récurrent attribué" value={eur(r.mrrEur)} note={`${int(r.paid)} abonnement${r.paid > 1 ? 's' : ''} payant${r.paid > 1 ? 's' : ''}`} />
        <Figure label="Ratio revenu / coût" value={ratioText(r.ratio)} note={r.ratio === null ? 'aucun coût ce mois-ci' : undefined} />
        <Figure label="Visites des pages (mois)" value={int(r.visits.total)} note={`${int(r.visits.external)} depuis l’extérieur · mois précédent : ${int(r.previousVisits.total)}`} />
        <Figure label="Analyses 60 s venues d’un baromètre" value={int(r.analyses)} />
        <Figure label="Audits gratuits venus d’un baromètre" value={int(r.audits)} />
        <Figure label="Inscriptions attribuées" value={int(r.signupsTotal)} note={`dont ${int(r.signupsThisMonth)} ce mois-ci`} />
        <Figure
          label="Liens entrants des pages"
          value={r.links.state === 'ok' ? int(r.links.referringDomains) : '—'}
          note={r.links.state === 'ok' ? `domaines référents, ${int(r.links.backlinks)} liens (relevé du ${new Date(r.links.at).toLocaleDateString('fr-FR')})` : r.links.reason}
        />
      </dl>
      <StopRule stop={r.stop} />
      {!hasActivity ? (
        <Empty title="Aucune donnée mesurée">
          Aucune dépense, aucune visite et aucune inscription attribuée pour l’instant. Les chiffres apparaîtront après la première passe réelle
          (BAROMETRE_ENABLED=1) et la publication des premières éditions.
        </Empty>
      ) : (
        <>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="ui-card overflow-x-auto p-0">
              <table className="w-full text-left text-sm">
                <caption className="ui-caption p-3 text-left font-semibold">Visites par source (mois)</caption>
                <tbody>
                  {Object.entries(r.visits.bySource).length === 0 && <tr><td className="p-3" style={muted}>Aucune visite ce mois-ci.</td></tr>}
                  {(Object.entries(r.visits.bySource) as [VisitSource, number][]).sort((a, b) => b[1] - a[1]).map(([k, n]) => (
                    <tr key={k} className="border-t" style={{ borderColor: 'var(--hair)' }}><td className="p-3">{SOURCE_LABELS[k] ?? k}</td><td className="p-3 rp-num text-right">{int(n)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="ui-card overflow-x-auto p-0">
              <table className="w-full text-left text-sm">
                <caption className="ui-caption p-3 text-left font-semibold">Sites d’origine (referrer, mois)</caption>
                <tbody>
                  {r.visits.referrers.length === 0 && <tr><td className="p-3" style={muted}>Aucun site d’origine relevé.</td></tr>}
                  {r.visits.referrers.slice(0, 15).map((x) => (
                    <tr key={x.host} className="border-t" style={{ borderColor: 'var(--hair)' }}><td className="p-3" style={{ overflowWrap: 'anywhere' }}>{x.host}</td><td className="p-3 rp-num text-right">{int(x.visits)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="ui-card mt-4 overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <caption className="ui-caption p-3 text-left font-semibold">Par baromètre (visites du mois ; analyses, inscriptions et abonnements depuis le démarrage)</caption>
              <thead style={{ background: 'var(--surface-2)' }}>
                <tr>{['Baromètre', 'Visites', 'Analyses', 'Audits', 'Inscriptions', 'Payants', 'MRR'].map((h) => <th key={h} scope="col" className="ui-caption p-3 font-semibold" style={muted}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {r.bySlug.map((x) => (
                  <tr key={x.slug} className="border-t" style={{ borderColor: 'var(--hair)' }}>
                    <td className="p-3">{x.slug === 'index' ? <Link className="underline" href="/barometre">/barometre</Link> : <Link className="underline" href={`/barometre/${x.slug}`}>{x.slug}</Link>}</td>
                    <td className="p-3 rp-num">{int(x.visits)}</td>
                    <td className="p-3 rp-num">{int(x.analyses)}</td>
                    <td className="p-3 rp-num">{int(x.audits)}</td>
                    <td className="p-3 rp-num">{int(x.signups)}</td>
                    <td className="p-3 rp-num">{int(x.paid)}</td>
                    <td className="p-3 rp-num">{eur(x.mrrEur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <History points={r.history} />
    </section>
  );
}

function Liens({ r, rate }: { r: RoiReport['liens']; rate: number }) {
  const fixedEur = (r.fixedUsd > 0 ? r.fixedUsd : backlinksFixedUsd()) * rate;
  return (
    <section className="mt-10" aria-labelledby="l-h">
      <h2 id="l-h" className="ui-h2">Liens entrants (DataForSEO Backlinks)</h2>
      <p className="ui-small mt-1" style={muted}>
        {r.enabled
          ? `Activés (SEODATA_BACKLINKS_ENABLED=1), engagement ${int(r.fixedUsd)} $/mois.`
          : 'Désactivés : SEODATA_BACKLINKS_ENABLED n’est pas mis, aucun engagement, aucun relevé.'}{' '}
        Inclus seulement dans Accompagné et Agence. Seuil de rentabilité : {breakEvenSubscribers(fixedEur, 99)} abonné Accompagné (99 €/mois) couvre l’engagement (≈ {eur(fixedEur)}).
        Coût = ce que les liens AJOUTENT à la facture DataForSEO du mois : max(engagement, autres appels + liens) − autres appels.
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Figure label="Coût du mois (mesuré)" value={eur(r.costEur)} note={`liens ${r.spentBacklinksUsd.toFixed(2).replace('.', ',')} $ · autres appels ${r.spentOtherUsd.toFixed(2).replace('.', ',')} $`} />
        <Figure label="MRR des offres avec l’onglet" value={eur(r.mrrEur)} note={Object.entries(r.byTier).map(([t, x]) => `${t === 'accompagne' ? 'Accompagné' : 'Agence'} : ${x.count} (${eur(x.mrrEur)})`).join(' · ') || 'aucun abonné'} />
        <Figure label="Ratio revenu / coût" value={ratioText(r.ratio)} note={r.ratio === null ? 'aucun coût ce mois-ci' : 'couverture : MRR de ces offres / coût'} />
        <Figure label="Usage réel de l’onglet (mois)" value={`${int(r.activeSubscribers)} / ${int(r.subscribers)}`} note={`abonnés qui l’ont ouvert · ${int(r.usage.views)} affichage${r.usage.views > 1 ? 's' : ''} au total`} />
      </dl>
      <StopRule stop={r.stop} />
      {!r.enabled && r.subscribers === 0 && r.costEur === 0 && (
        <Empty title="Aucune donnée mesurée">Ni engagement ni abonné Accompagné ou Agence pour l’instant. Rien n’est estimé à la place.</Empty>
      )}
      <History points={r.history} />
    </section>
  );
}

export default async function AdminRoiPage() {
  const authed = isAdmin((await cookies()).get('admin_token')?.value);
  if (!authed) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center p-6" style={{ color: 'var(--ink)' }}>
        <div className="ui-card p-6">
          <h1 className="ui-result" style={{ fontSize: 24 }}>Accès restreint</h1>
          <p className="ui-small mt-1" style={muted}>Connectez-vous d’abord à l’administration.</p>
          <Link className="ui-btn mt-4" data-variant="primary" href="/admin">Se connecter</Link>
        </div>
      </main>
    );
  }
  let report: RoiReport | null = null;
  try {
    report = await buildRoiReport({ refreshLinks: true });
  } catch (e) {
    console.error('[admin/roi]', e);
  }
  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-6" style={{ color: 'var(--ink)' }}>
      <p className="ui-caption font-semibold" style={muted}><Link className="underline" href="/admin">Admin</Link></p>
      <h1 className="ui-h2 mt-1">ROI des données payantes</h1>
      {!report ? (
        <p className="ui-small mt-3" role="alert" style={{ color: 'var(--tone-down)' }}>Le tableau n’a pas pu être calculé. Rechargez la page.</p>
      ) : (
        <>
          <p className="ui-body mt-2" style={muted}>
            {frMonth(report.month)} · coûts mesurés dans les registres (1 $ = {report.eurPerUsd.toLocaleString('fr-FR')} €, SEODATA_EUR_PER_USD) ·
            revenus = abonnements réellement souscrits (prix des offres, annuel / 12), attribution par première page ou UTM enregistrée côté serveur, sans cookie.
            Aucun chiffre estimé n’entre dans un ratio. Le relevé du mois est enregistré à chaque ouverture de cette page.
          </p>
          <Barometres r={report.barometres} />
          <Liens r={report.liens} rate={report.eurPerUsd} />
        </>
      )}
    </main>
  );
}
