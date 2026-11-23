import Link from 'next/link';
import '@/components/app/agence/agence.css';
import { PageHeader } from '@/components/app/PageHeader';
import { Verdict } from '@/components/app/v4/Verdict';
import { BrandMark } from '@/components/app/agence/BrandMark';
import { Portfolio } from '@/components/app/agence/Portfolio';
import { loadAgency, loadPortfolio } from '@/components/app/agence/server';
import { portfolioSummary } from '@/lib/agency/portfolio';
import { AGENCY_INCLUDED_CLIENTS, AGENCY_MAX_CLIENTS, formatPrice, getAddon } from '@/lib/plans';

export const metadata = { title: 'Tous mes clients' };
export const maxDuration = 60;

const pl = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

export default async function AgencePage() {
  const agency = await loadAgency();
  if (agency.mode === 'none') {
    return (
      <>
        <PageHeader title="Tous mes clients" />
        <div className="rp-page">
          <Verdict
            tone="brand"
            title="Le tableau de bord multi-clients fait partie de l’offre Agence"
            lead="Tous vos clients sur une page, rapports à votre marque, accès client pour valider les corrections et exports CSV par client."
            action={{ href: '/app?compte=demo-agence', label: 'Voir la démo agence', icon: 'eye' }}
            secondary={
              <Link href="/agences" className="rp-btn">
                Voir l’offre Agence
              </Link>
            }
          />
        </div>
      </>
    );
  }
  const clients = await loadPortfolio();
  const s = portfolioSummary(clients);
  const demo = agency.mode === 'demo';
  const p = agency.profile;
  const max = agency.ctx?.maxClients ?? AGENCY_MAX_CLIENTS;
  const title =
    s.needAttention > 0
      ? `${pl(s.needAttention, 'client demande', 'clients demandent')} votre attention`
      : s.pending > 0
        ? `${pl(s.pending, 'proposition attend', 'propositions attendent')} une validation`
        : clients.length
          ? 'Tous vos clients sont au vert'
          : 'Ajoutez votre premier client';
  return (
    <>
      <PageHeader
        title="Tous mes clients"
        meta={
          <>
            {pl(clients.length, 'client', 'clients')} · {AGENCY_INCLUDED_CLIENTS} inclus dans l’offre Agence, +{formatPrice(getAddon('agency_extra_client').priceCents)}/mois par client au-delà (jusqu’à {max})
            {demo ? ' · démo, agence fictive' : ''}
          </>
        }
      />
      <div className="rp-page flex flex-col gap-4" style={{ ['--ag-color' as string]: p?.color }}>
        <div className="ag-brand">
          <BrandMark name={p?.name ?? 'Votre agence'} logoUrl={p?.logoUrl} />
          <div className="min-w-0 flex-1">
            <p className="ag-brand-name">{p?.name ?? 'Votre agence'}</p>
            <p className="ag-brand-sub">
              {p
                ? `Vos rapports, liens et e-mails portent cette marque${p.hideRepere ? ', sans mention de Repéré' : ''}.`
                : 'Ajoutez votre nom, votre logo et votre couleur : ils remplaceront Repéré sur les rapports de vos clients.'}
            </p>
          </div>
          <Link href="/app/agence/marque" className="rp-btn rp-btn-sm flex-none">
            {p ? 'Modifier' : 'Ajouter votre marque'}
          </Link>
        </div>

        <Verdict
          tone={s.needAttention ? 'warn' : s.pending ? 'brand' : 'good'}
          title={title}
          lead={
            clients.length
              ? `${pl(s.measured, 'client mesuré', 'clients mesurés')} dans les IA${s.up ? `, dont ${s.up} en progrès au-delà de la marge d’erreur` : ''}. Les alertes ne se déclenchent qu’au-delà de la marge de chaque mesure.`
              : 'Chaque client a son propre espace : créez-le depuis la page d’accueil, il apparaîtra ici.'
          }
          details={
            <p>
              Score IA : visibilité du client dans les réponses de ChatGPT, Perplexity, Gemini et Claude, comparée à la mesure précédente comparable (mêmes questions). Score Google : audit technique et éditorial du site, comparé à l’exploration précédente. Une baisse de 5 points à l’audit est signalée, de 10 points en rouge.
            </p>
          }
          detailsLabel="Comment lire ces chiffres"
        />

        <dl className="ag-kpis">
          <div className="ag-kpi">
            <dt>Clients suivis</dt>
            <dd className="ag-kpi-v rp-num">{clients.length}</dd>
            <dd className="ag-kpi-s">sur {max} inclus</dd>
          </div>
          <div className="ag-kpi">
            <dt>Score IA moyen</dt>
            <dd className="ag-kpi-v rp-num">{s.avgAi ?? '—'}</dd>
            <dd className="ag-kpi-s">{s.measured ? `sur ${pl(s.measured, 'client mesuré', 'clients mesurés')}` : 'aucune mesure pour l’instant'}</dd>
          </div>
          <div className="ag-kpi">
            <dt>Score Google moyen</dt>
            <dd className="ag-kpi-v rp-num">{s.avgSeo ?? '—'}</dd>
            <dd className="ag-kpi-s">audit du site, sur 100</dd>
          </div>
          <div className="ag-kpi">
            <dt>À valider</dt>
            <dd className="ag-kpi-v rp-num">{s.pending}</dd>
            <dd className="ag-kpi-s">propositions de l’agent</dd>
          </div>
        </dl>

        <Portfolio clients={clients} demo={demo} canInvite />

        <p className="text-[12px] text-[var(--muted)]">
          {demo
            ? 'Démo : agence et clients fictifs, mesures de démonstration. Les invitations, envois et réglages ne sont pas enregistrés.'
            : 'Seuls les espaces en offre Agence dont vous êtes propriétaire ou administrateur apparaissent ici.'}
          {agency.ctx && agency.ctx.otherCount > 0 ? ` ${pl(agency.ctx.otherCount, 'autre espace', 'autres espaces')} de votre compte n’y figure${agency.ctx.otherCount > 1 ? 'nt' : ''} pas.` : ''}
        </p>
      </div>
    </>
  );
}
