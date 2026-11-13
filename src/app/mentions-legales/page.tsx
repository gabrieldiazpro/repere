import { pageMeta } from '@/lib/seo/meta';
import type { LegalSection } from '@/lib/seo/shell';
import { LegalDocument } from '@/components/pages/v4/LegalDocument';
import { LEGAL, LEGAL_ADDRESS, SIREN_DISPLAY, orTodo } from '@/lib/seo/site';

export const metadata = pageMeta({
  path: '/mentions-legales',
  title: 'Mentions légales',
  description: 'Mentions légales du site Repéré : société éditrice, directeur de la publication, hébergeur, propriété intellectuelle et contact.',
  // Placeholders [À COMPLÉTER] : noindex (et hors sitemap) tant que le texte n'est pas validé.
  noindex: true,
});

const sections: LegalSection[] = [
  {
    title: 'Éditeur du site',
    paras: [
      `Le site et le service Repéré sont édités par la société ${orTodo(LEGAL.name, 'dénomination exacte (NEXT_PUBLIC_LEGAL_NAME)')}, qui les exploite sous le nom commercial « Repéré ».`,
      `Forme juridique et capital : ${orTodo(LEGAL.form, 'forme juridique et capital, ex. « SAS au capital de 1 000 € » (NEXT_PUBLIC_LEGAL_FORM)')}`,
      `Immatriculation : RCS ${orTodo(LEGAL.rcsCity, 'ville (NEXT_PUBLIC_LEGAL_RCS_CITY)')} ${orTodo(SIREN_DISPLAY, 'SIREN (NEXT_PUBLIC_LEGAL_SIREN)')}`,
      `Siège social : ${orTodo(LEGAL_ADDRESS, 'adresse (NEXT_PUBLIC_LEGAL_STREET, NEXT_PUBLIC_LEGAL_POSTAL_CODE, NEXT_PUBLIC_LEGAL_CITY)')}`,
      `E-mail : ${orTodo(LEGAL.email, 'e-mail (NEXT_PUBLIC_LEGAL_EMAIL)')}, téléphone : ${orTodo(LEGAL.phone, 'téléphone (NEXT_PUBLIC_LEGAL_PHONE)')}`,
      'TVA : TVA non applicable, art. 293 B du CGI (franchise en base de TVA). [À VÉRIFIER : seulement si la société est éligible à la franchise ; sinon indiquer ici son numéro de TVA intracommunautaire.]',
      'Activité non réglementée : [À VÉRIFIER : aucune autorisation ni ordre professionnel requis]',
    ],
  },
  { title: 'Directeur de la publication', paras: [`${orTodo(LEGAL.publicationDirector, 'Prénom NOM, en qualité de représentant légal (président, gérant) de la société (NEXT_PUBLIC_LEGAL_PUBLICATION_DIRECTOR)')}. Contact : ${orTodo(LEGAL.email, 'e-mail (NEXT_PUBLIC_LEGAL_EMAIL)')}.`] },
  {
    title: 'Hébergement',
    paras: [
      'Site hébergé par : Vercel Inc., [À COMPLÉTER : adresse postale et numéro de téléphone, à reporter depuis vercel.com/legal].',
      'Base de données : Supabase Inc., [À COMPLÉTER : adresse postale et numéro de téléphone], région de données [À VÉRIFIER : UE].',
      'Les autres prestataires intervenant dans le service sont listés dans la politique de confidentialité (/confidentialite).',
    ],
  },
  {
    title: 'Propriété intellectuelle',
    paras: ['Les textes, la marque, les visuels et le code du site sont la propriété de l\'éditeur [À VÉRIFIER : ou utilisés avec autorisation]. Toute reproduction non autorisée est interdite.'],
  },
  { title: 'Données personnelles', paras: ['Voir la politique de confidentialité : /confidentialite.'] },
  {
    title: 'Contenu généré par IA',
    paras: ['Les analyses, brouillons de contenus et réponses du Copilote affichés sont produits en partie par des assistants d\'intelligence artificielle et peuvent comporter des erreurs ; ils sont identifiés comme tels et, pour tout contenu destiné à être publié, relus et validés par le client. Le Copilote est une IA, pas une personne. Voir la page Méthode et la mention « Méthode et limites » de chaque rapport.'],
  },
  {
    title: 'Clients professionnels',
    paras: ['Le service est réservé aux professionnels agissant pour les besoins de leur activité (conditions générales de vente, article 4). Les dispositions propres aux consommateurs, dont la médiation de la consommation, ne s\'appliquent donc pas. Conditions générales de vente : /cgv ; accord de sous-traitance des données : /dpa.'],
  },
  { title: 'Signalement d\'un contenu et contact', paras: [`Pour signaler un contenu illicite ou contester un rapport vous concernant : ${orTodo(LEGAL.email, 'e-mail (NEXT_PUBLIC_LEGAL_EMAIL)')}, en précisant l'adresse de la page et le motif. Nous accusons réception et traitons chaque signalement dans les meilleurs délais.`] },
];

export default function Page() {
  return <LegalDocument path="/mentions-legales" title="Mentions légales" updated="[À COMPLÉTER : JJ/MM/AAAA]" sections={sections} />;
}
