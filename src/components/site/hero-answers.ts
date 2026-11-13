/**
 * Forme d'une réponse d'IA montrée dans les scènes « Qui l'IA recommande ? ». Les réponses elles-mêmes sont lues
 * dans les comptes démo par src/components/site/demo-figures.ts (`demoHeroAnswer`), jamais écrites à la main.
 */
export type HeroAnswerData = {
  ia: string;
  question: string;
  intro: string;
  items: { name: string; note: string; you?: boolean }[];
  footer: [string, string];
  label: string;
};
