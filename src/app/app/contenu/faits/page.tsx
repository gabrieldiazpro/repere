import { PageHeader } from '@/components/app/PageHeader';
import { ContentTabs, SimBand } from '@/components/app/contenu/Chrome';
import { FactsForm, SettingsForm } from '@/components/app/contenu/Facts';

export const metadata = { title: 'Faits clés' };

export default function FaitsPage() {
  return (
    <>
      <PageHeader
        title="Faits clés"
        result="La seule source des textes de l’agent"
        resultTone="brand"
        subtitle="Ce que vous écrivez ici est repris mot pour mot dans les brouillons. Ce qui manque reste « [à compléter] » : l’agent ne devine jamais un prix, un délai ou une garantie."
      />
      <div className="rp-page">
        <SimBand />
        <ContentTabs current="faits" />
        <FactsForm />
        <SettingsForm />
      </div>
    </>
  );
}
