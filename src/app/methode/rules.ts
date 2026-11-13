/**
 * Les 20 règles de citabilité publiées sur /methode. Les poids doivent rester identiques à
 * CITABILITY_WEIGHTS (src/lib/siteaudit/citability.ts) : un test le vérifie (src/lib/seo/__tests__/content.test.ts).
 */
export interface CitabilityRule {
  id: string;
  label: string;
  points: number;
  test: string;
}

export const CITABILITY_RULES: CitabilityRule[] = [
  { id: 'direct_answer', label: 'Réponse directe en tête', points: 10, test: 'Le premier paragraphe répond seul à la question principale, en moins de 60 mots, sans formule d’accueil.' },
  { id: 'question_headings', label: 'Titres en forme de questions', points: 6, test: 'Au moins deux intertitres sont formulés comme une question de client.' },
  { id: 'heading_structure', label: 'Structure en intertitres', points: 5, test: 'La page est découpée en sections annoncées par des intertitres H2 ou H3.' },
  { id: 'short_paragraphs', label: 'Paragraphes courts', points: 5, test: 'Aucun paragraphe de plus de 120 mots ; une idée par paragraphe.' },
  { id: 'lists', label: 'Listes', points: 4, test: 'Au moins trois éléments de liste dans le contenu principal.' },
  { id: 'tables', label: 'Tableaux comparatifs', points: 4, test: 'Les comparaisons sont dans un tableau HTML avec cellules d’en-tête.' },
  { id: 'numbers', label: 'Chiffres précis', points: 5, test: 'Prix, délais, zones, années ou quantités sont écrits en chiffres.' },
  { id: 'sourced', label: 'Chiffres sourcés', points: 6, test: 'La page renvoie à au moins deux sources externes par des liens.' },
  { id: 'date', label: 'Date visible', points: 6, test: 'Une date de publication ou de mise à jour est affichée sur la page.' },
  { id: 'author', label: 'Auteur identifié', points: 6, test: 'Une signature ou un auteur est déclaré sur la page ou dans ses données structurées.' },
  { id: 'definitions', label: 'Définitions claires', points: 4, test: 'Au moins une phrase définit le terme clé (« X est un… »).' },
  { id: 'faq', label: 'Questions fréquentes', points: 6, test: 'Une section de questions-réponses, de préférence balisée FAQPage.' },
  { id: 'length', label: 'Longueur du contenu', points: 6, test: 'Au moins 300 mots utiles, sans devenir une page démesurée.' },
  { id: 'internal_links', label: 'Liens internes', points: 4, test: 'La page renvoie vers d’autres pages du même site.' },
  { id: 'entities', label: 'Entités nommées', points: 4, test: 'La marque, la ville, les produits et les personnes sont nommés précisément.' },
  { id: 'contact', label: 'Coordonnées visibles', points: 4, test: 'Téléphone, adresse ou e-mail écrits en texte, pas seulement dans une image.' },
  { id: 'jsonld', label: 'Données structurées cohérentes', points: 4, test: 'Un JSON-LD valide reprend les informations visibles.' },
  { id: 'readable_no_js', label: 'Lisible sans JavaScript', points: 4, test: 'Le texte est présent dans le HTML initial (au moins 50 mots).' },
  { id: 'title_match', label: 'Titre et H1 cohérents', points: 4, test: 'La balise title et le H1 parlent du même sujet, avec les mots des clients.' },
  { id: 'canonical', label: 'Adresse canonique', points: 3, test: 'La balise canonical déclare l’adresse de référence de la page.' },
];

export const CITABILITY_TOTAL = CITABILITY_RULES.reduce((n, r) => n + r.points, 0);
