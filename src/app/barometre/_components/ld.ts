/** JSON-LD des baromètres : Dataset (avec distribution CSV) + WebPage + fil d'Ariane. Jamais pour une édition simulée. */
import { PROVIDER_LABELS } from '@/lib/engine/types';
import type { BarometreEdition } from '@/lib/barometre/types';
import { barometrePath, csvPath } from '@/lib/barometre/public';
import { breadcrumbListLd, graph, orgRef, pageIds, webPageLd } from '@/lib/seo/jsonld';
import { abs } from '@/lib/seo/site';

export function barometreDescription(e: BarometreEdition): string {
  const top = e.ranking.slice(0, 3).map((r) => r.name).join(', ');
  return `Entreprises citées par ${e.providers.map((p) => PROVIDER_LABELS[p]).join(', ')} pour « ${e.def.subject} » : ${e.answersValid} réponses analysées${top ? `. En tête : ${top}` : ''}. Mesure mensuelle avec marges d'erreur.`;
}

export function datasetLd(e: BarometreEdition) {
  if (e.demo) return null;
  const path = barometrePath(e.slug);
  const ids = pageIds(path);
  return {
    '@type': 'Dataset',
    '@id': ids.dataset,
    name: `Qui les IA recommandent : ${e.def.title} (${e.period})`,
    description: barometreDescription(e),
    url: abs(path),
    inLanguage: 'fr-FR',
    creator: orgRef(),
    publisher: orgRef(),
    isAccessibleForFree: true,
    dateModified: e.aggregatedAt,
    temporalCoverage: `${e.measuredFrom.slice(0, 10)}/${e.measuredTo.slice(0, 10)}`,
    ...(e.def.city ? { spatialCoverage: { '@type': 'Place', name: `${e.def.city}, France` } } : { spatialCoverage: { '@type': 'Country', name: 'France' } }),
    measurementTechnique: `${e.questions.length} questions de clients posées ${e.runs} fois à chaque IA ; extraction et fusion des noms d'entreprises cités ; intervalles à 90 % par rééchantillonnage des questions (${e.methodVersion}).`,
    variableMeasured: ['Taux de citation par les IA', 'Part de voix', 'Citations par IA', 'Sources citées'],
    distribution: [{ '@type': 'DataDownload', encodingFormat: 'text/csv', contentUrl: abs(csvPath(e.slug, e.period)) }],
  };
}

export function barometrePageLd(e: BarometreEdition) {
  const path = barometrePath(e.slug);
  const crumbs = [
    { name: 'Accueil', path: '/' },
    { name: 'Baromètres', path: '/barometre' },
    { name: e.def.title, path },
  ];
  return graph([
    webPageLd(path, { name: `Qui les IA recommandent : ${e.def.title}`, description: barometreDescription(e), dateModified: e.aggregatedAt.slice(0, 10), mainEntity: pageIds(path).dataset }, { withContext: false }),
    datasetLd(e),
    breadcrumbListLd(path, crumbs, { withContext: false }),
  ]);
}
