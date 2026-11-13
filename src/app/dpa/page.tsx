import { pageMeta } from '@/lib/seo/meta';
import { LegalDocument } from '@/components/pages/v4/LegalDocument';
import { DPA_SECTIONS } from './content';

export const metadata = pageMeta({
  path: '/dpa',
  title: 'Accord de sous-traitance des données (DPA)',
  description:
    "Accord de sous-traitance des données personnelles (article 28 du RGPD) entre Repéré et ses clients : objet, instructions, sécurité, sous-traitants ultérieurs, transferts, violations, fin du contrat.",
  // Placeholders [À COMPLÉTER] : noindex (et hors sitemap) tant que le texte n'est pas validé.
  noindex: true,
});

export default function Page() {
  return (
    <LegalDocument
      path="/dpa"
      title="Accord de sous-traitance des données (DPA)"
      updated="[À COMPLÉTER : JJ/MM/AAAA], version 1.0"
      sections={DPA_SECTIONS}
    />
  );
}
