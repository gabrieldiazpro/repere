import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/app/PageHeader';
import { SimBand } from '@/components/app/agent/Chrome';
import { ProposalDetail } from '@/components/app/agent/ProposalDetail';
import { cleanTitle, originOf } from '@/components/app/agent/model';
import { loadChangeSet } from '@/components/app/agent/server';

export const metadata = { title: 'Proposition de l’agent' };

const CS_RE = /^cs_[A-Za-z0-9_-]{6,30}$/;

export default async function AgentChangeSetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!CS_RE.test(id)) notFound();
  const { cs } = await loadChangeSet(id);
  if (!cs) notFound();
  return (
    <>
      <PageHeader
        title="Agent"
        back={{ href: '/app/agent', label: 'Propositions' }}
        meta={originOf(cs).label}
        result={cleanTitle(cs.title)}
        resultTone={cs.status === 'proposed' ? 'warn' : cs.status === 'verified' ? 'up' : cs.status === 'failed' ? 'down' : 'brand'}
        subtitle={
          cs.status === 'proposed' || cs.status === 'draft'
            ? 'Comparez l’avant et l’après, modifiez le texte si besoin, puis validez. Chaque étape est inscrite au journal et peut être annulée.'
            : cs.status === 'validated'
              ? 'Validé : rien n’est encore écrit sur votre site. L’agent applique au clic, puis vérifie que la modification est en ligne.'
              : 'Ce qui a changé, qui l’a validé, et l’effet mesuré depuis. Chaque changement en ligne peut être annulé.'
        }
      />
      <div className="rp-page">
        <SimBand />
        <ProposalDetail id={cs.id} />
      </div>
    </>
  );
}
