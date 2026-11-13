/**
 * Écart → brief de contenu (docs/v3/03, grille thème × IA puis « un écart devient un brief ») :
 * titre, angle, questions à traiter, sources à citer, structure, longueur. Règles déterministes, sans LLM ;
 * fondé uniquement sur ce que l'audit a mesuré (questions, concurrents, sources citées par les IA).
 */
import { norm } from './detect';
import { isBrandQuery, segmentOf } from './queries-v2';
import { angleOf, themeOf } from './queries-v3';
import { scoredMentions } from './coherence';
import { CATEGORY_LABEL } from './sources/classify';
import type { AuditInput, AuditResult, QueryAngle } from './types';
import type { CompetitorGap, Segment, SourceCategory, SourceOpportunity } from './types-v2';
import type { BriefFormat, ContentBrief, QueryGap } from './types-v3';
import { shortHash } from './util';

export type BriefContext = Pick<AuditResult, 'queries' | 'answers' | 'mentions' | 'sources'>;
export type BriefTarget = QueryGap | CompetitorGap | SourceOpportunity;

const NOTE =
  'Ce brief s’appuie sur les réponses et les sources relevées lors de la mesure. Un contenu bien construit augmente les chances d’être repris par les IA, sans aucune garantie de citation.';

const LENGTH: Record<BriefFormat, { minWords: number; maxWords: number }> = {
  comparatif: { minWords: 1200, maxWords: 2000 },
  guide: { minWords: 1500, maxWords: 2500 },
  page_service: { minWords: 600, maxWords: 1100 },
  faq: { minWords: 500, maxWords: 1000 },
  article_invite: { minWords: 700, maxWords: 1200 },
  fiche: { minWords: 150, maxWords: 400 },
};

const FORMAT_LABEL: Record<BriefFormat, string> = {
  comparatif: 'Comparatif',
  guide: 'Guide pratique',
  page_service: 'Page de service',
  faq: 'Page questions-réponses',
  article_invite: 'Article ou tribune sur un site tiers',
  fiche: 'Fiche sur une plateforme',
};

const AUDIENCE: Record<Segment, string> = {
  local: 'Particuliers de la zone qui cherchent un professionnel et demandent conseil à une IA.',
  pme: 'Décideurs et acheteurs qui comparent des prestataires avant de demander un devis.',
  ecommerce: 'Acheteurs en ligne qui comparent des marques et des produits avant de commander.',
};

export function isQueryGap(t: BriefTarget): t is QueryGap {
  return typeof (t as QueryGap).queryId === 'string' && typeof (t as QueryGap).text === 'string';
}
export function isCompetitorGap(t: BriefTarget): t is CompetitorGap {
  return typeof (t as CompetitorGap).competitor === 'string' && Array.isArray((t as CompetitorGap).reasons);
}

function formatForAngle(angle: QueryAngle, segment: Segment): BriefFormat {
  switch (angle) {
    case 'comparison':
    case 'alternative':
    case 'best':
    case 'which_company':
    case 'french_brand':
      return 'comparatif';
    case 'price':
    case 'where_to_buy':
      return 'guide';
    case 'review':
    case 'brand_opinion':
    case 'brand_trust':
    case 'brand_facts':
      return 'faq';
    default:
      return segment === 'ecommerce' ? 'guide' : 'page_service';
  }
}

function formatForCategory(c: SourceCategory): BriefFormat {
  if (c === 'annuaire' || c === 'avis' || c === 'marketplace' || c === 'reseau_social') return 'fiche';
  if (c === 'client') return 'page_service';
  if (c === 'forum') return 'faq';
  return 'article_invite';
}

/** Écarts par question : questions de visibilité où le client n'est jamais cité alors que des concurrents le sont. */
export function queryGaps(r: Pick<AuditResult, 'queries' | 'answers' | 'mentions'>, max = 10): QueryGap[] {
  const valid = scoredMentions(r);
  const out: (QueryGap & { n: number })[] = [];
  for (const q of r.queries) {
    if (isBrandQuery(q)) continue;
    const ms = valid.filter((m) => m.queryId === q.id);
    if (!ms.length || ms.some((m) => m.mentioned)) continue;
    const count = new Map<string, number>();
    for (const m of ms) for (const c of new Set(m.competitors)) count.set(c, (count.get(c) ?? 0) + 1);
    if (!count.size) continue;
    const competitors = [...count].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([c]) => c).slice(0, 5);
    out.push({ queryId: q.id, text: q.text, theme: themeOf(q), competitors, providers: [...new Set(ms.map((m) => m.provider))], n: [...count.values()].reduce((a, b) => a + b, 0) });
  }
  return out
    .sort((a, b) => b.n - a.n || a.queryId.localeCompare(b.queryId))
    .slice(0, max)
    .map(({ n, ...g }) => {
      void n;
      return g;
    });
}

/** Sources citées par les IA sur les questions données (domaines tiers, hors concurrents), les plus citées d'abord. */
function sourcesFor(ctx: BriefContext | undefined, queryIds: string[] | null, max = 5): ContentBrief['sources'] {
  const urls = ctx?.sources?.urls ?? [];
  const doms = ctx?.sources?.domains ?? [];
  const keep = (cat: SourceCategory) => cat !== 'concurrent' && cat !== 'client';
  const out: ContentBrief['sources'] = [];
  const seen = new Set<string>();
  const pool = urls.filter((u) => keep(u.category) && (!queryIds || u.queries.some((q) => queryIds.includes(q))));
  for (const u of pool) {
    if (seen.has(u.domain)) continue;
    seen.add(u.domain);
    const comp = u.competitorsPresent.length ? ` ; on y trouve ${u.competitorsPresent.slice(0, 2).join(', ')}` : '';
    out.push({ domain: u.domain, label: u.title || CATEGORY_LABEL[u.category], url: u.url, why: `Citée ${u.citations} fois par les IA sur ces questions${comp}.` });
    if (out.length >= max) return out;
  }
  for (const d of doms.filter((x) => keep(x.category) && (!queryIds || x.queries.some((q) => queryIds.includes(q))))) {
    if (seen.has(d.domain)) continue;
    seen.add(d.domain);
    out.push({ domain: d.domain, label: d.label, url: d.sampleUrls[0], why: `Citée ${d.citations} fois par les IA (${CATEGORY_LABEL[d.category].toLowerCase()}).` });
    if (out.length >= max) break;
  }
  return out;
}

/** Questions proches (même thème) à traiter dans le même contenu, la question cible en premier. */
function relatedQuestions(ctx: BriefContext | undefined, first: string | null, theme: string | null, max = 6): string[] {
  const qs = (ctx?.queries ?? []).filter((q) => !isBrandQuery(q));
  const picked = [first, ...qs.filter((q) => !theme || themeOf(q) === theme).map((q) => q.text)].filter((x): x is string => !!x);
  const out: string[] = [];
  for (const t of picked) if (!out.some((o) => norm(o) === norm(t))) out.push(t);
  return out.slice(0, max);
}

function outlineFor(format: BriefFormat, input: AuditInput, questions: string[], competitors: string[]): ContentBrief['outline'] {
  const name = input.businessName;
  const where = input.city ? ` à ${input.city}` : '';
  const qPoints = questions.slice(0, 5);
  switch (format) {
    case 'comparatif':
      return [
        { heading: 'La réponse en deux phrases', points: ['Répondre directement à la question posée, en tête de page', `Situer ${name} parmi les options, sans dénigrer`] },
        { heading: 'Les critères pour choisir', points: ['Critères concrets et vérifiables (prix, délais, garanties, zone)', 'Un tableau récapitulatif'] },
        { heading: 'Les options comparées', points: [competitors.length ? `Présentation factuelle des acteurs cités par les IA : ${competitors.slice(0, 4).join(', ')}` : 'Présentation factuelle des principaux acteurs', `${name} : points forts et limites, chiffres sourcés`] },
        { heading: 'Questions fréquentes', points: qPoints.length ? qPoints : ['Questions posées par vos clients'] },
        { heading: 'Méthode et date de mise à jour', points: ['Auteur identifié, date visible', 'Sources citées en lien'] },
      ];
    case 'guide':
      return [
        { heading: 'La réponse courte', points: ['Fourchette ou réponse chiffrée en tête, avec la date', 'Ce qui fait varier la réponse'] },
        { heading: 'Étapes ou critères détaillés', points: ['Un intertitre par étape ou critère', 'Exemples chiffrés, sources citées'] },
        { heading: `Comment ${name} répond à ce besoin`, points: ['Offre, conditions, délais réels', `Zone ou canaux de vente${where}`] },
        { heading: 'Questions fréquentes', points: qPoints.length ? qPoints : ['Questions posées par vos clients'] },
      ];
    case 'page_service':
      return [
        { heading: `Le service en une phrase${where}`, points: ['Ce que vous faites, pour qui, où', 'Coordonnées identiques à vos fiches (nom, adresse, téléphone)'] },
        { heading: 'Prestations et tarifs indicatifs', points: ['Liste des prestations', 'Prix ou fourchettes, délais d’intervention'] },
        { heading: 'Preuves', points: ['Avis vérifiables, certifications, années d’expérience', 'Réalisations datées'] },
        { heading: 'Questions fréquentes', points: qPoints.length ? qPoints : ['Questions posées par vos clients'] },
      ];
    case 'faq':
      return [
        { heading: 'Questions et réponses', points: qPoints.length ? qPoints.map((q) => `${q} : réponse de 2 à 4 phrases, factuelle`) : ['Une question par intertitre, réponse courte'] },
        { heading: 'Informations de référence', points: ['Horaires, prix, zone, contact : identiques à votre fiche de vérité', 'Date de mise à jour'] },
      ];
    case 'article_invite':
      return [
        { heading: 'Sujet proposé au site', points: ['Un angle utile à leurs lecteurs, pas une publicité', 'Données ou retour d’expérience exclusifs'] },
        { heading: 'Plan de l’article', points: [...qPoints.slice(0, 3), `Mention factuelle de ${name} et lien vers votre site`] },
        { heading: 'Prise de contact', points: ['Identifier la rubrique et la personne responsable', 'Proposer le sujet en 5 lignes'] },
      ];
    case 'fiche':
      return [
        { heading: 'Informations à remplir', points: ['Nom, adresse, téléphone, site : identiques partout', 'Catégorie exacte, horaires, zone desservie'] },
        { heading: 'Description', points: ['Ce que vous faites, pour qui, où, en 3 phrases', 'Mots que vos clients emploient'] },
        { heading: 'Preuves', points: ['Photos récentes', 'Demander des avis à vos clients récents'] },
      ];
  }
}

function checklistFor(format: BriefFormat): string[] {
  const base = ['Répondre à la question dès les premières lignes', 'Afficher l’auteur et la date de mise à jour', 'Citer des chiffres avec leur source'];
  if (format === 'fiche') return ['Coordonnées identiques à votre site et à vos autres fiches', 'Catégorie et zone exactes', 'Photos et avis récents'];
  if (format === 'article_invite') return ['Contenu utile pour les lecteurs du site', 'Lien vers une page précise de votre site', 'Pas de texte publicitaire'];
  return [...base, 'Balisage FAQPage pour la partie questions-réponses', 'Lien depuis votre page d’accueil ou votre menu'];
}

/**
 * Brief de contenu pour un écart (question perdue, concurrent qui passe devant) ou une opportunité de source.
 * `ctx` (l'audit) enrichit les questions et les sources citées ; sans lui, le brief reste valide mais plus court.
 */
export function buildContentBrief(target: BriefTarget, input: AuditInput, ctx?: BriefContext): ContentBrief {
  const segment = segmentOf(input);
  const name = input.businessName;
  let format: BriefFormat;
  let title: string;
  let angle: string;
  let questions: string[];
  let competitors: string[];
  let sources: ContentBrief['sources'];
  let publishOn: string;
  let key: string;

  if (isQueryGap(target)) {
    const q = ctx?.queries.find((x) => x.id === target.queryId) ?? { id: target.queryId, text: target.text, theme: target.theme };
    const a = angleOf(q);
    const theme = target.theme ?? themeOf(q);
    format = formatForAngle(a, segment);
    competitors = target.competitors.slice(0, 5);
    questions = relatedQuestions(ctx, target.text, theme);
    sources = sourcesFor(ctx, ctx ? ctx.queries.filter((x) => themeOf(x) === theme).map((x) => x.id) : null);
    title = `${FORMAT_LABEL[format]} : ${target.text.replace(/\s*\?$/, '')}`;
    angle = competitors.length
      ? `Les IA citent ${competitors.slice(0, 3).join(', ')} sur cette question, jamais ${name}. Donner une réponse directe et vérifiable qui place ${name} parmi les options.`
      : `Les IA ne citent pas ${name} sur cette question. Publier la réponse la plus claire et la plus vérifiable du sujet.`;
    publishOn = format === 'faq' || format === 'page_service' ? 'Votre site (page dédiée, liée depuis le menu)' : 'Votre site (blog ou rubrique conseils)';
    key = `q|${target.queryId}`;
  } else if (isCompetitorGap(target)) {
    format = 'comparatif';
    competitors = [target.competitor];
    const ids = ctx ? scoredMentions(ctx).filter((m) => !m.mentioned && m.competitors.includes(target.competitor)).map((m) => m.queryId) : [];
    const texts = [...new Set(ids)].map((id) => ctx!.queries.find((q) => q.id === id)?.text).filter((x): x is string => !!x);
    questions = relatedQuestions(ctx ? { ...ctx, queries: ctx.queries.filter((q) => texts.includes(q.text)) } : undefined, texts[0] ?? null, null);
    sources = sourcesFor(ctx, ids.length ? [...new Set(ids)] : null);
    const on = target.presentOn.slice(0, 3);
    title = `${name} ou ${target.competitor} : comment choisir`;
    angle =
      `${target.competitor} est cité dans ${target.mentions} réponse${target.mentions > 1 ? 's' : ''} où ${name} ne l’est pas` +
      (on.length ? `, et il est présent sur ${on.join(', ')}` : '') +
      '. Un comparatif honnête et sourcé donne aux IA de quoi vous citer à côté de lui.';
    publishOn = 'Votre site (page comparatif), puis les sources tierces listées';
    key = `c|${norm(target.competitor)}`;
  } else {
    format = formatForCategory(target.category);
    competitors = target.competitorsPresent.slice(0, 5);
    const d = ctx?.sources?.domains.find((x) => x.domain === target.domain);
    const ids = d?.queries ?? [];
    const texts = ids.map((id) => ctx?.queries.find((q) => q.id === id)?.text).filter((x): x is string => !!x);
    questions = [...new Set(texts)].slice(0, 6);
    sources = [{ domain: target.domain, label: target.label, url: d?.sampleUrls[0], why: target.why }];
    title = format === 'fiche' ? `Fiche ${name} sur ${target.label}` : `Proposition de contenu pour ${target.label}`;
    angle = `${target.why} ${target.action}.`.replace(/\.\./g, '.');
    publishOn = target.label;
    key = `s|${target.domain}`;
  }

  return {
    id: `brief-${shortHash(`${name}|${key}`, 8)}`,
    title,
    format,
    angle,
    audience: AUDIENCE[segment],
    questions,
    sources,
    competitors,
    outline: outlineFor(format, input, questions, competitors),
    length: LENGTH[format],
    publishOn,
    checklist: checklistFor(format),
    note: NOTE,
  };
}
