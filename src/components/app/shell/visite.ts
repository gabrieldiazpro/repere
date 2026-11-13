// Visite guidée : /app?visite=1 (&segment=local|pme|ecommerce). 8 étapes sur le compte démo, d'une page à l'autre.
// Chaque étape pointe un élément par attribut data-visite="…" (posé par l'agent propriétaire de la page).
// Élément absent → l'infobulle s'affiche centrée, la visite continue (jamais bloquée).
import type { Segment } from '@/lib/engine/types-v2';

export interface VisiteEtape {
  /** valeur de l'attribut data-visite ciblé */
  cible: string;
  /** page où se trouve la cible */
  page: string;
  titre: string;
  texte: string;
}

/** Liste de référence des attributs data-visite (documentée dans docs/v3/progress/COQUILLE.md). */
export const CIBLES = {
  phrase: 'lundi-phrase', // /app — COQUILLE
  score: 'lundi-score', // /app — COQUILLE
  questions: 'questions', // /app/questions — MESURE (conteneur de la liste des questions suivies)
  reponses: 'reponses', // /app/reponses — MESURE (première réponse d'IA affichée)
  concurrents: 'concurrents', // /app/concurrents — MESURE (tableau thème × IA)
  actions: 'actions', // /app/actions — ACTION (liste du centre d'actions)
  trafic: 'trafic', // /app/trafic — ACTION (bloc visites / ventes venues des IA)
  copilote: 'copilote', // /app/copilote — ACTION (zone de saisie)
  local: 'local', // /app/local/fiche-google — METIERS (score de la fiche Google)
  produits: 'produits', // /app/produits — METIERS (tableau des produits cités)
  recherche: 'recherche', // bouton de recherche (coquille)
} as const;

const COMMUNES: VisiteEtape[] = [
  {
    cible: CIBLES.phrase,
    page: '/app',
    titre: 'Votre semaine en une phrase',
    texte: 'Chaque lundi, Repéré résume ce qui a changé dans les réponses des IA à votre sujet.',
  },
  {
    cible: CIBLES.score,
    page: '/app',
    titre: 'Score et rang, avec leur marge',
    texte: 'Le score dit à quel point les IA vous recommandent. La marge d’erreur rappelle que ces réponses varient d’un jour à l’autre.',
  },
  {
    cible: CIBLES.questions,
    page: '/app/questions',
    titre: 'Les questions suivies',
    texte: 'Les questions que vos clients posent aux IA. Vous les choisissez ; nous les posons à chaque mesure.',
  },
  {
    cible: CIBLES.reponses,
    page: '/app/reponses',
    titre: 'Les réponses, mot pour mot',
    texte: 'Chaque réponse est conservée telle quelle, avec votre nom et vos concurrents surlignés.',
  },
  {
    cible: CIBLES.concurrents,
    page: '/app/concurrents',
    titre: 'Qui passe devant vous',
    texte: 'Votre part de voix face à vos concurrents, thème par thème et IA par IA.',
  },
  {
    cible: CIBLES.actions,
    page: '/app/actions',
    titre: 'Quoi faire cette semaine',
    texte: 'Des actions classées par effet attendu, avec le livrable prêt et la mesure avant / après.',
  },
  {
    cible: CIBLES.trafic,
    page: '/app/trafic',
    titre: 'La preuve : visites et ventes',
    texte: 'Les visites venues des IA sur votre site, mesurées sans cookie.',
  },
  {
    cible: CIBLES.copilote,
    page: '/app/copilote',
    titre: 'Posez vos questions',
    texte: 'Le copilote répond à partir de vos données, jamais d’un chiffre inventé. Bonne visite !',
  },
];

/** Étape propre au parcours, insérée avant la preuve (trafic). */
const METIER: Partial<Record<Segment, VisiteEtape>> = {
  local: {
    cible: CIBLES.local,
    page: '/app/local/fiche-google', // /app/local redirige ici : le chemin doit être celui de la page réelle
    titre: 'Votre fiche Google',
    texte: 'Les IA s’appuient sur votre fiche, vos avis et les annuaires. Voici ce qu’il faut compléter.',
  },
  ecommerce: {
    cible: CIBLES.produits,
    page: '/app/produits',
    titre: 'Vos produits dans les IA',
    texte: 'Quels produits sont cités, à quel prix, et quels revendeurs passent devant votre boutique.',
  },
};

/** 8 étapes : pour Local et E-commerce, l'étape métier remplace l'étape « réponses ». */
export function etapesVisite(segment: Segment | null | undefined): VisiteEtape[] {
  const m = segment ? METIER[segment] : undefined;
  if (!m) return COMMUNES;
  const list = COMMUNES.filter((e) => e.cible !== CIBLES.reponses);
  const i = list.findIndex((e) => e.cible === CIBLES.trafic);
  return [...list.slice(0, i), m, ...list.slice(i)];
}

export const VISITE_STORAGE = 'rp_visite';

export interface VisiteState {
  segment: Segment | null;
  step: number;
  /** visite terminée ou quittée */
  done?: boolean;
}

export function parseVisite(raw: string | null | undefined): VisiteState | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as VisiteState;
    if (typeof v.step !== 'number' || v.step < 0) return null;
    return { segment: v.segment ?? null, step: Math.floor(v.step), done: Boolean(v.done) };
  } catch {
    return null;
  }
}

/** Compte démo à ouvrir pour un parcours (?compte=… lu par le middleware). */
export const DEMO_ACCOUNT: Record<Segment, string> = { local: 'demo', pme: 'demo-pme', ecommerce: 'demo-ecom' };
