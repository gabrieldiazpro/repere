import { PageHeader } from '@/components/app/PageHeader';
import { ContentTabs, SimBand } from '@/components/app/contenu/Chrome';
import { ContentJournal } from '@/components/app/contenu/Journal';

export const metadata = { title: 'Journal des contenus' };

export default function JournalPage() {
  return (
    <>
      <PageHeader title="Journal des contenus" result="Qui a fait quoi, quand" resultTone="brand" subtitle="Chaque rédaction, validation, création sur votre site, mise en ligne et retrait est enregistrée. Le journal ne peut pas être modifié." />
      <div className="rp-page">
        <SimBand />
        <ContentTabs current="journal" />
        <ContentJournal />
      </div>
    </>
  );
}
