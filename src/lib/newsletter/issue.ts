/**
 * Rédaction d'un numéro de la lettre à partir des dernières fiches de veille. Le brouillon est une proposition :
 * l'administrateur relit, modifie, prévisualise, puis déclenche lui-même chaque lot d'envoi.
 */
import { CONSULTED, VEILLE_ENTRIES, getEntry, sortedEntries, upcoming, type TimelineItem, type VeilleEntry } from '@/lib/veille';
import type { NewsletterIssue } from './store';

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export const monthLabel = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;

/** Les `n` fiches dont l'évènement est passé, les plus récentes d'abord. */
export function latestEntries(today: string, n = 5, list: readonly VeilleEntry[] = VEILLE_ENTRIES): VeilleEntry[] {
  return sortedEntries(list.filter((e) => e.eventDate <= today)).slice(0, n);
}

export function resolveEntries(slugs: string[]): VeilleEntry[] {
  return slugs.map((s) => getEntry(s)).filter((e): e is VeilleEntry => Boolean(e));
}

/** Échéances à venir citées dans le numéro (4 au plus). */
export function issueDeadlines(today: string, max = 4): TimelineItem[] {
  return upcoming(VEILLE_ENTRIES, today).slice(0, max);
}

/** Brouillon générique : les cinq dernières fiches, un objet et une introduction neutres à relire. */
export function draftFromVeille(number: number, today: string): Omit<NewsletterIssue, 'createdAt' | 'updatedAt'> {
  const entries = latestEntries(today, 5);
  const month = monthLabel(today);
  return {
    id: `numero-${number}`,
    number,
    subject: `Veille Google et IA, ${month} : ${entries[0]?.title ?? 'ce qui a changé ce mois-ci'}`.slice(0, 140),
    preheader: `${entries.length} changements datés et sourcés, et ce qu'il faut faire.`,
    intro: `Voici ce qui a changé ce mois-ci pour votre visibilité sur Google et dans les assistants IA. Chaque point renvoie à une fiche datée, avec ses sources officielles. Ce qui n'est pas confirmé est dit comme tel.`,
    entrySlugs: entries.map((e) => e.slug),
    outro: `Une question sur l'un de ces points ? Répondez simplement à cet e-mail : nous lisons toutes les réponses.`,
    status: 'draft',
    sentCount: 0,
    failedCount: 0,
  };
}

/** Premier numéro, rédigé à la main (brouillon). Jamais envoyé sans action de l'administrateur. */
export function firstIssueDraft(): Omit<NewsletterIssue, 'createdAt' | 'updatedAt'> {
  const slugs = [
    'apercus-ia-mode-ia-france',
    'mises-a-jour-coeur-google-2025-2026',
    'ai-act-article-50-transparence',
    'controle-ia-generative-search-console',
    'robots-ia-2026-qui-fait-quoi',
  ];
  return {
    id: 'numero-1',
    number: 1,
    subject: 'Google répond désormais à la place des sites, en France aussi : ce que cela change pour vous',
    preheader: 'Aperçus IA, mise à jour de Google en cours, AI Act : cinq points datés et sourcés, et quoi faire.',
    intro: [
      `Bonjour,`,
      `Voici le premier numéro de la lettre de veille de Repéré. Une fois par mois, nous relisons les annonces de Google, des assistants IA et des autorités, et nous ne gardons que ce qui change quelque chose pour un commerce, une PME ou une boutique en ligne.`,
      `Ce mois-ci, trois faits dominent. Depuis le 22 juillet, Google affiche en France des réponses générées par l'IA au-dessus des résultats : la question n'est plus seulement « suis-je bien classé ? » mais « suis-je cité ? ». Une nouvelle mise à jour principale de Google a commencé le 10 novembre et n'était pas terminée au 23 novembre : attendez sa fin avant de tirer des conclusions de vos chiffres. Enfin, les règles de transparence de l'AI Act s'appliquent depuis le 2 août.`,
      `Chaque point renvoie à une fiche datée, avec ses sources. Quand une information n'est pas confirmée, nous l'écrivons.`,
    ].join('\n\n'),
    entrySlugs: slugs,
    outro: [
      `À noter pour la suite : le 2 décembre 2026, les fournisseurs d'outils d'IA déjà sur le marché doivent marquer les contenus générés ; le 31 janvier 2027, Merchant Center exigera des images produits d'au moins 500 × 500 pixels.`,
      `Une question, un sujet que vous voulez voir traité ? Répondez simplement à cet e-mail.`,
    ].join('\n\n'),
    status: 'draft',
    sentCount: 0,
    failedCount: 0,
  };
}

/** Date du jour au format ISO (AAAA-MM-JJ), fuseau de Paris. */
export function todayParis(d = new Date()): string {
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export { CONSULTED };
