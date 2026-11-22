import { PageHeader } from '@/components/app/PageHeader';
import { ContentTabs, SimBand } from '@/components/app/contenu/Chrome';
import { MentionsList, MentionsResult } from '@/components/app/contenu/Mentions';

export const metadata = { title: 'Mentions à obtenir' };

export default function MentionsPage() {
  return (
    <>
      <PageHeader
        title="Mentions à obtenir"
        result={<MentionsResult />}
        resultTone="brand"
        subtitle="Les sites que les IA citent quand on leur pose vos questions, et où vous n’êtes pas encore. Pour chacun : pourquoi, comment, et un message prêt à envoyer — par vous. Repéré n’envoie rien et ne pratique aucun échange de liens."
      />
      <div className="rp-page">
        <SimBand />
        <ContentTabs current="mentions" />
        <MentionsList />
      </div>
    </>
  );
}
