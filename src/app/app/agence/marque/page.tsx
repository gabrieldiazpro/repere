import '@/components/app/agence/agence.css';
import { PageHeader } from '@/components/app/PageHeader';
import { BrandForm } from '@/components/app/agence/BrandForm';
import { loadAgency, loadPortfolio } from '@/components/app/agence/server';
import { redirect } from 'next/navigation';

export const metadata = { title: 'Votre marque' };

export default async function AgenceMarquePage() {
  const agency = await loadAgency();
  if (agency.mode === 'none') redirect('/app/agence');
  const clients = await loadPortfolio();
  const example = clients.find((c) => c.ai)?.name ?? clients[0]?.name ?? 'votre client';
  return (
    <>
      <PageHeader title="Votre marque" back={{ href: '/app/agence', label: 'Tous mes clients' }} meta={agency.mode === 'demo' ? 'Démo : agence fictive' : 'Offre Agence'} />
      <div className="rp-page">
        <BrandForm initial={agency.profile} demo={agency.mode === 'demo'} clientExample={example} />
      </div>
    </>
  );
}
