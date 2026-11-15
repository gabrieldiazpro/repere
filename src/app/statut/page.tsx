import { Container } from '@/components/ui/Container';
import { PageHero, SitePage, linkClass } from '@/components/pages/ui';
import { pageMeta } from '@/lib/seo/meta';
import { CONTACT_EMAIL } from '@/lib/seo/site';
import { IMPACT_LABEL, SERVICES, STATE_LABEL, cachedHealth, listIncidents, overallState, serviceStatuses, type Incident, type PublicState } from '@/lib/ops';

/**
 * Page publique d'état des services : mesures automatiques (base, file de tâches, worker, briques activées)
 * + incidents déclarés par l'admin (/admin/ops). Sobre, sans détail technique ni chiffre inventé.
 */
export const dynamic = 'force-dynamic';

export const metadata = pageMeta({
  path: '/statut',
  title: 'État des services',
  description: 'État en direct du site, des analyses IA, du paiement et des e-mails de Repéré, et historique des incidents des 90 derniers jours.',
});

const TONE: Record<PublicState, { color: string; dot: string }> = {
  operationnel: { color: 'var(--tone-up, #15803d)', dot: '#16a34a' },
  perturbe: { color: 'var(--tone-warn, #b45309)', dot: '#d97706' },
  maintenance: { color: 'var(--tone-warn, #b45309)', dot: '#2563eb' },
  panne: { color: 'var(--tone-down, #b91c1c)', dot: '#dc2626' },
  inactif: { color: 'var(--muted, #6b7280)', dot: '#9ca3af' },
};

const HEADLINE: Record<PublicState, string> = {
  operationnel: 'Tous les services fonctionnent normalement',
  perturbe: 'Certains services sont perturbés',
  maintenance: 'Une maintenance est en cours',
  panne: 'Un service est en panne',
  inactif: 'Tous les services fonctionnent normalement',
};

const fr = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }) : '';

function Dot({ state }: { state: PublicState }) {
  return <span aria-hidden="true" className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: TONE[state].dot }} />;
}

function IncidentItem({ i }: { i: Incident }) {
  return (
    <li className="rounded-2xl border border-ink/10 bg-white p-5">
      <p className="text-[1.05rem] font-semibold">{i.title}</p>
      <p className="mt-1 text-sm text-ink/70">
        {IMPACT_LABEL[i.impact]} · {i.services.map((s) => SERVICES[s]).join(', ')} · début le {fr(i.startedAt)}
        {i.status === 'resolu' ? `, résolu le ${fr(i.resolvedAt)}` : ', en cours'}
      </p>
      {i.updates.length ? (
        <ol className="mt-3 space-y-2 border-l-2 border-ink/10 pl-4">
          {[...i.updates].reverse().map((u) => (
            <li key={u.at} className="text-[0.98rem] text-ink/80">
              <span className="text-sm text-ink/60">{fr(u.at)}</span>
              <br />
              {u.text}
            </li>
          ))}
        </ol>
      ) : null}
    </li>
  );
}

export default async function StatutPage() {
  const [health, incidents] = await Promise.all([cachedHealth(30_000).catch(() => null), listIncidents(90).catch(() => [] as Incident[])]);
  const services = serviceStatuses(health, incidents);
  const overall = overallState(services);
  const open = incidents.filter((i) => i.status === 'en_cours');
  const past = incidents.filter((i) => i.status === 'resolu');
  const checkedAt = fr(health?.time ?? new Date().toISOString());

  return (
    <SitePage>
      <PageHero
        crumbs={[{ name: 'Accueil', href: '/' }, { name: 'État des services' }]}
        title="État des services"
        lead="Ce que nos contrôles automatiques mesurent en ce moment, et les incidents que nous déclarons nous-mêmes."
      />
      <section aria-label="État actuel" className="bg-white py-12 sm:py-16">
        <Container>
          <div className="mx-auto max-w-3xl">
            <div className="flex items-center gap-3 rounded-2xl border border-ink/10 p-5" role="status">
              <Dot state={overall} />
              <div>
                <p className="text-[1.2rem] font-semibold" style={{ color: TONE[overall].color }}>{HEADLINE[overall]}</p>
                <p className="text-sm text-ink/60">Vérifié le {checkedAt} (heure de Paris). Actualisez la page pour une nouvelle mesure.</p>
              </div>
            </div>

            <ul className="mt-6 divide-y divide-ink/10 rounded-2xl border border-ink/10">
              {services.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-4 px-5 py-4">
                  <span className="text-[1.02rem]">{s.label}</span>
                  <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: TONE[s.state].color }}>
                    <Dot state={s.state} />
                    {STATE_LABEL[s.state]}
                  </span>
                </li>
              ))}
            </ul>

            <h2 className="mt-12 text-[1.5rem] font-bold">Incidents en cours</h2>
            {open.length ? (
              <ul className="mt-4 space-y-4">{open.map((i) => <IncidentItem key={i.id} i={i} />)}</ul>
            ) : (
              <p className="mt-3 text-ink/70">Aucun incident en cours.</p>
            )}

            <h2 className="mt-12 text-[1.5rem] font-bold">Incidents des 90 derniers jours</h2>
            {past.length ? (
              <ul className="mt-4 space-y-4">{past.map((i) => <IncidentItem key={i.id} i={i} />)}</ul>
            ) : (
              <p className="mt-3 text-ink/70">Aucun incident déclaré sur cette période.</p>
            )}

            <p className="mt-12 text-sm text-ink/60">
              Un problème que cette page n’affiche pas ? Écrivez-nous à{' '}
              <a className={linkClass} href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Incident')}`}>{CONTACT_EMAIL}</a>.
              « Pas encore activé » signifie que le service n’est pas encore ouvert, pas qu’il est en panne.
            </p>
          </div>
        </Container>
      </section>
    </SitePage>
  );
}
