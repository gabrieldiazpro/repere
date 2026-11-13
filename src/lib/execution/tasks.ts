/**
 * generateTasks : transforme un audit V2 en tâches concrètes avec livrable prêt à l'emploi.
 * - Synchrone, par gabarits (contrat : `generateTasks(result, facts?, opts): ExecTask[]`).
 * - `generateTasksAsync` réécrit les textes clés par LLM (fournisseur le moins cher) si une clé existe.
 * Aucun fait inventé : ce qui manque dans la fiche de vérité devient « [à compléter] ».
 */
import { resolveTrade } from '@/lib/engine/queries';
import type { BrandFactField, ExecTask, FactCheckItem, Segment, SourceCategory, SourceOpportunity } from '@/lib/engine/types-v2';
import type { Business } from '@/lib/db';
import { buildFaq, buildJsonLd, jsonLdScriptTag, toFactsMap } from './jsonld';
import { SYSTEM_FR, complete, llmAvailable, parseJsonObject } from './llm';
import { draftReviewReply, reviewKit } from './reviews';
import type { AuditV2, BrandFacts, ExecSettings, FactsMap, GenerateOptions, StoredTask } from './types';
import { capitalize, clip, escapeHtml, shortHash, slugify, splitList } from './util';
import { buildComparisonPage, buildProductSheets, realCity, type SheetProduct } from './content';
import { sellingChannel } from '@/lib/engine/sources';
import { frSpaces } from '@/lib/text';

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://repere-ia.fr').replace(/\/$/, '');
const TODO = '[à compléter]';

export const GBP_DESCRIPTION_MAX = 750;

// ---------------------------------------------------------------------------
// Contexte
// ---------------------------------------------------------------------------
export interface TaskCtx {
  businessId: string;
  name: string;
  segment: Segment;
  activity: string; // « plombier », « logiciel de paie pour PME », « cosmétiques solides »
  city: string;
  district?: string;
  place: string;
  website?: string;
  facts: FactsMap;
  services: string[];
  products: string[];
  /** produits du catalogue suivi (e-commerce), s'il est connu */
  catalog: SheetProduct[];
  audit: AuditV2;
  settings: Partial<ExecSettings>;
  now: string;
}

export function buildCtx(result: AuditV2, factsIn: BrandFacts | FactsMap | null | undefined, opts: GenerateOptions = {}): TaskCtx {
  const input = result.input;
  const segment: Segment = opts.segment ?? result.segment ?? input.segment ?? 'local';
  const facts = toFactsMap(factsIn);
  const activity =
    segment === 'local'
      ? resolveTrade(input.trade).label
      : segment === 'pme'
        ? input.category || input.trade
        : input.productCategories?.[0] || input.category || input.trade;
  const place = [input.district, input.city].filter(Boolean).join(' ').replace(/^(\d+e)\s+(.*)$/, '$2 $1');
  return {
    businessId: opts.businessId ?? (result as { businessId?: string }).businessId ?? slugify(input.businessName),
    name: input.businessName,
    segment,
    activity,
    city: input.city,
    district: input.district,
    place: place || input.market || 'France',
    website: facts.site || input.website,
    facts,
    services: splitList(facts.services),
    products: splitList(facts.produits).length ? splitList(facts.produits) : (input.productCategories ?? []),
    catalog: opts.catalog ?? [],
    audit: result,
    settings: opts.settings ?? {},
    now: (opts.now ?? new Date()).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Brouillons de tâches
// ---------------------------------------------------------------------------
type Deliverable = NonNullable<ExecTask['deliverable']>[number];

interface LlmSlot {
  /** index du livrable à réécrire */
  index: number;
  instruction: string;
  maxChars: number;
}

export interface Draft {
  key: string;
  kind: ExecTask['kind'];
  title: string;
  why: string;
  automation: ExecTask['automation'];
  minutes: number;
  impact: 1 | 2 | 3;
  deliverable: Deliverable[];
  steps: string[];
  sourceDomain?: string;
  event?: boolean;
  llm?: LlmSlot;
}

const EFFORT_MIN: Record<'S' | 'M' | 'L', number> = { S: 20, M: 45, L: 90 };

function napBlock(c: TaskCtx): string {
  const f = c.facts;
  return [
    `Nom : ${c.name}`,
    `Adresse : ${f.adresse ?? TODO}`,
    `Téléphone : ${f.telephone ?? TODO}`,
    `Site : ${c.website ?? TODO}`,
    c.segment === 'local' ? `Horaires : ${f.horaires ?? TODO}` : null,
    f.zone ? `Zone : ${f.zone}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

const lowerFirst = (s: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);

const sinceText = (c: TaskCtx) => {
  const y = c.facts.creation?.match(/\b(19|20)\d{2}\b/)?.[0];
  return y ? ` depuis ${y}` : '';
};

/** Description officielle (≤ 750 caractères, fiche Google et annuaires). */
export function officialDescription(c: TaskCtx, max = GBP_DESCRIPTION_MAX): string {
  const f = c.facts;
  const parts: string[] = [];
  const year = c.facts.creation?.match(/\b(19|20)\d{2}\b/)?.[0];
  if (c.segment === 'local') parts.push(`${c.name}, ${c.activity} à ${c.place}${sinceText(c)}.`);
  else if (c.segment === 'pme') parts.push(`${c.name} : ${lowerFirst(c.audit.input.offering?.replace(/\.$/, '') || c.activity)}.${year ? ` Depuis ${year}.` : ''}`);
  else parts.push(`${c.name} : ${lowerFirst(c.audit.input.offering?.replace(/\.$/, '') || `marque de ${c.activity}`)}.${year ? ` Depuis ${year}.` : ''}`);
  if (c.services.length) parts.push(`${c.segment === 'pme' ? 'Offres' : 'Services'} : ${c.services.join(', ')}.`);
  if (c.segment === 'ecommerce' && c.products.length) parts.push(`Produits : ${c.products.join(', ')}.`);
  if (f.zone) parts.push(`${c.segment === 'local' ? 'Intervention' : 'Zone'} : ${f.zone}.`);
  if (f.clients) parts.push(`Références : ${f.clients}.`);
  if (c.segment === 'local' && f.horaires) parts.push(`Horaires : ${f.horaires}.`);
  if (f.livraison) parts.push(`Livraison : ${f.livraison}.`);
  if (f.prix) parts.push(`Tarifs : ${f.prix}.`);
  if (parts.length < 3) parts.push(`${TODO} : ce qui vous distingue (délai, garantie, spécialité réelle).`);
  return clip(parts.join(' ').replace(/\.\./g, '.'), max);
}

function categoriesBlock(c: TaskCtx): string {
  const primary = capitalize(c.activity);
  const sec = c.services.slice(0, 4).map((s) => capitalize(s.replace(/^(le|la|les|l')\s*/i, '')));
  return [
    `Catégorie principale : ${primary} (choisissez l’intitulé Google le plus proche, sans mot-clé ajouté).`,
    `Catégories secondaires (2 à 4, uniquement si vous exercez réellement) : ${sec.length ? `à choisir parmi les catégories Google proches de : ${sec.join(', ')}` : TODO}.`,
  ].join('\n');
}

function servicesBlock(c: TaskCtx): string {
  if (!c.services.length) return `Services : ${TODO} (3 à 8 services, une phrase chacun).`;
  return c.services.map((s) => `• ${capitalize(s)} : ${TODO} (une phrase : pour qui, délai, prix indicatif si vous l’affichez).`).join('\n');
}

function postsBlock(c: TaskCtx): string {
  const s1 = c.services[0];
  const posts = [
    s1
      ? `Post 1 — ${capitalize(s1)}\n${capitalize(s1)}${c.segment === 'local' ? ` à ${c.place}` : ''} : ${c.name} vous répond${c.facts.telephone ? ` au ${c.facts.telephone}` : ''}. ${c.facts.prix ? `Tarifs : ${c.facts.prix}.` : ''}`.trim()
      : `Post 1 — Présentation\n${clip(officialDescription(c), 300)}`,
    `Post 2 — Infos pratiques\n${[c.facts.horaires && `Horaires : ${c.facts.horaires}.`, c.facts.zone && `Zone : ${c.facts.zone}.`, c.facts.adresse && `Adresse : ${c.facts.adresse}.`].filter(Boolean).join(' ') || TODO}`,
  ];
  return posts.join('\n\n');
}

function gbpDraft(c: TaskCtx): Draft {
  return {
    key: 'gbp_profile',
    kind: 'gbp_profile',
    title: 'Mettre à jour votre fiche Google avec les textes prêts',
    why: 'Gemini et les cartes Google s’appuient sur votre fiche : une description claire et des services complets disent aux IA pour quelles demandes vous recommander.',
    automation: 'semi',
    minutes: 20,
    impact: c.segment === 'local' ? 3 : 2,
    deliverable: [
      { type: 'text', label: `Description (${GBP_DESCRIPTION_MAX} caractères maximum)`, content: officialDescription(c) },
      { type: 'text', label: 'Catégories', content: categoriesBlock(c) },
      { type: 'text', label: 'Services', content: servicesBlock(c) },
      { type: 'text', label: 'Deux posts Google', content: postsBlock(c) },
    ],
    steps: [
      'Ouvrez business.google.com et sélectionnez votre fiche (ou cherchez votre nom dans Google, connecté au compte gestionnaire).',
      '« Modifier le profil » → « Description » : collez le texte, vérifiez chaque information.',
      'Vérifiez la catégorie principale et ajoutez les secondaires réelles.',
      '« Modifier les services » : collez chaque service.',
      '« Ajouter une mise à jour » : publiez le post 1 cette semaine, le post 2 la semaine prochaine.',
      'Google peut mettre quelques jours à valider les changements : c’est normal.',
    ],
    llm: {
      index: 0,
      maxChars: GBP_DESCRIPTION_MAX,
      instruction: `Rédige la description de fiche Google Business Profile (${GBP_DESCRIPTION_MAX} caractères maximum, idéalement 600 à 750), à la 3e personne, sans slogan, sans majuscules abusives, sans URL ni téléphone, en reprenant uniquement les faits fournis.`,
    },
  };
}

function bingDraft(c: TaskCtx): Draft {
  return {
    key: 'bing_places',
    kind: 'bing_places',
    title: 'Créer ou vérifier votre fiche Bing Places (import Google, 15 min)',
    why: 'Bing alimente Copilot ; la nouvelle version de Bing Places importe directement votre fiche Google. Effet sur ChatGPT non démontré, coût faible.',
    automation: 'guide',
    minutes: 15,
    impact: 2,
    deliverable: [
      { type: 'text', label: 'Coordonnées de référence (à vérifier après import)', content: napBlock(c) },
      { type: 'text', label: 'Description', content: clip(officialDescription(c), 750) },
      { type: 'link', label: 'Bing Places', content: 'https://www.bingplaces.com/' },
    ],
    steps: [
      'Ouvrez bingplaces.com et connectez-vous avec un compte Microsoft.',
      'Choisissez « Importer depuis Google Business Profile » et autorisez l’accès.',
      'Comparez nom, adresse, téléphone et horaires avec le bloc de référence : ils doivent être identiques.',
      'Validez la fiche (code par courrier, téléphone ou e-mail) puis ajoutez votre site.',
      'Revenez cocher « C’est fait » : Repéré vérifiera la fiche sous 7 jours.',
    ],
  };
}

function appleDraft(c: TaskCtx): Draft {
  return {
    key: 'apple_business',
    kind: 'apple_business',
    title: 'Revendiquer votre fiche Apple Business (Plans, Siri)',
    why: 'Apple Plans et Siri répondent aux recherches des utilisateurs d’iPhone ; la fiche se gère gratuitement. Effet sur les IA génératives non mesuré.',
    automation: 'guide',
    minutes: 15,
    impact: 1,
    deliverable: [
      { type: 'text', label: 'Coordonnées de référence', content: napBlock(c) },
      { type: 'text', label: 'Description courte', content: clip(officialDescription(c), 500) },
      { type: 'link', label: 'Apple Business', content: 'https://businessconnect.apple.com/' },
    ],
    steps: [
      'Connectez-vous avec l’identifiant Apple de l’entreprise sur Apple Business (ex-Business Connect).',
      'Recherchez votre établissement et revendiquez-le (ou créez-le).',
      'Reprenez exactement le bloc de coordonnées, ajoutez logo, photos et lien du site.',
      'Terminez la vérification demandée par Apple.',
    ],
  };
}

const PLATFORM_PROFILE = /capterra|g2\.com|appvizer|getapp|alternativeto|trustpilot|softwareadvice|trustradius|sortlist|malt/;

/** Présentation longue : la description, PLUS l'histoire, l'offre détaillée et les preuves tirées de la fiche. */
export function longDescription(c: TaskCtx, max = 1000): string {
  const f = c.facts;
  const year = f.creation?.match(/\b(19|20)\d{2}\b/)?.[0];
  const extra: string[] = [];
  if (year || f.dirigeant) extra.push(`${c.segment === 'ecommerce' ? 'La marque a été créée' : `${c.name} a été ${c.segment === 'pme' ? 'fondé' : 'créé'}`}${year ? ` en ${year}` : ''}${f.dirigeant ? ` ; ${c.segment === 'local' ? 'l’entreprise est dirigée' : 'elle est dirigée'} par ${f.dirigeant}` : ''}.`);
  if (c.services.length > 1) extra.push(`${c.segment === 'pme' ? 'L’offre comprend' : c.segment === 'ecommerce' ? 'La gamme comprend' : 'Les interventions couvrent'} : ${c.services.join(', ')}.`);
  if (f.clients) extra.push(`Clients : ${f.clients}.`);
  if (f.ingredients) extra.push(`Composition : ${f.ingredients}.`);
  if (f.certifications) extra.push(`Labels : ${f.certifications}.`);
  if (f.retours) extra.push(`Retours : ${f.retours}.`);
  if (c.website) extra.push(`Informations à jour sur ${c.website.replace(/^https?:\/\//, '')}.`);
  return clip(`${officialDescription(c, max)} ${extra.join(' ')}`.replace(/\.\./g, '.'), max);
}

function directoryTexts(c: TaskCtx, label: string, opts: { long?: boolean } = {}): Deliverable[] {
  const short = clip(
    c.segment === 'local' ? `${c.name}, ${c.activity} à ${c.place}${sinceText(c)}.` : `${c.name} : ${lowerFirst(c.audit.input.offering || c.activity)}.`,
    160,
  );
  const medium = clip(officialDescription(c, 400), 400);
  const long = longDescription(c, 1000);
  const out: Deliverable[] = [
    { type: 'text', label: 'Texte court (≤ 160 car.)', content: short },
    { type: 'text', label: 'Texte moyen (≤ 400 car.)', content: medium },
  ];
  // Le texte long n'est proposé que s'il apporte vraiment de la matière (jamais une copie du moyen).
  if (opts.long !== false && long.length > medium.length + 80) out.push({ type: 'text', label: `Présentation longue pour ${label} (≤ 1 000 car.)`, content: long });
  out.push({ type: 'text', label: 'Coordonnées identiques partout', content: napBlock(c) });
  return out;
}

/** Demande d'avis adaptée au parcours (pas de fiche Google ni de QR code pour un SaaS ou une marque en ligne). */
function reviewAsk(c: TaskCtx, platform: string): Deliverable[] {
  if (c.segment === 'pme')
    return [
      {
        type: 'text',
        label: `E-mail à vos clients — avis sur ${platform}`,
        content: [
          `Objet : votre avis sur ${c.name}, en 3 minutes`,
          '',
          'Bonjour,',
          '',
          `Vous utilisez ${c.name} depuis quelques mois. Votre retour sur ${platform}, positif ou critique, aide d’autres entreprises à choisir leur ${c.activity}, et nous aide à progresser.`,
          '',
          `Laisser un avis : [lien de votre page ${platform}]`,
          '',
          'Merci,',
          `${c.facts.dirigeant ?? `L’équipe ${c.name}`}`,
        ].join('\n'),
      },
    ];
  if (c.segment === 'ecommerce')
    return [
      {
        type: 'text',
        label: `E-mail J+7 après livraison — avis ${platform}`,
        content: [
          `Objet : votre ${c.products[0] ? lowerFirst(c.products[0]).replace(/s$/, '') : 'commande'} est bien arrivé ?`,
          '',
          'Bonjour,',
          '',
          `Votre commande ${c.name} est arrivée il y a une semaine. Qu’en pensez-vous ? Votre avis, quel qu’il soit, aide d’autres clients à choisir.`,
          '',
          `Donner mon avis : [lien ${platform}]`,
          '',
          'Merci,',
          `${c.facts.dirigeant ? `${c.facts.dirigeant}, ` : ''}${c.name}`,
        ].join('\n'),
      },
    ];
  return [];
}

function opportunityDraft(c: TaskCtx, o: SourceOpportunity, recommended = false): Draft | null {
  const minutes = EFFORT_MIN[o.effort] ?? 30;
  const comp = o.competitorsPresent.length ? ` ${o.competitorsPresent.slice(0, 3).join(', ')} y ${o.competitorsPresent.length > 1 ? 'sont' : 'est'} ; pas vous.` : '';
  const why = recommended ? `${o.why} (Source recommandée pour votre secteur, non citée dans cet audit.)` : `${o.why}${comp && !o.why.includes('pas vous') ? comp : ''}`;
  const base = { sourceDomain: o.domain, why, impact: o.impact, steps: o.howTo.length ? o.howTo : [] };
  const cat: SourceCategory = o.category;
  const domain = o.domain.toLowerCase();
  // Google, Bing et Apple ont leurs tâches dédiées (fiche Google, Bing Places, Apple Business).
  if (/(^|\.)(google\.[a-z.]+|bing\.com|apple\.com|maps\.apple)$/.test(domain)) return null;

  // Marketplace ou revendeur : un canal de vente (compte vendeur, ou dossier acheteur sur plusieurs mois), jamais « un annuaire en 30 min ».
  if (cat === 'marketplace') {
    const ch = sellingChannel(domain, o.label);
    const retailer = ch.kind === 'retailer';
    return {
      ...base,
      key: `src:${domain}`,
      kind: 'other',
      title: ch.action,
      why: `${why} ${retailer ? `${o.label} est un revendeur : on y entre par un acheteur, après plusieurs mois de démarches, sans garantie.` : `${o.label} est un canal de vente, pas un annuaire : compte vendeur, frais et logistique à prévoir.`}`,
      automation: 'guide',
      minutes: retailer ? 480 : 180,
      impact: 2,
      deliverable: retailer
        ? [
            {
              type: 'text',
              label: 'Fiche marque d’une page (à joindre au premier contact)',
              content: [
                `${c.name}${c.facts.creation ? `, depuis ${c.facts.creation}` : ''}`,
                `Ce que nous faisons : ${c.audit.input.offering || c.products.slice(0, 3).join(', ') || TODO}`,
                c.facts.certifications ? `Labels : ${c.facts.certifications}` : `Labels : ${TODO} (uniquement des certifications réelles)`,
                `Prix publics : ${c.facts.prix || TODO}`,
                `Où nous sommes vendus aujourd’hui : ${TODO}`,
                `Chiffres de vente (si vous acceptez de les partager) : ${TODO}`,
                `Contact : ${c.facts.dirigeant ?? TODO}${c.website ? ` — ${c.website}` : ''}`,
              ].join('\n'),
            },
          ]
        : [
            {
              type: 'checklist',
              label: 'Avant d’ouvrir un compte vendeur',
              content: ['Commission et abonnement de la plateforme', 'Logistique : expédition par vous ou par la plateforme', 'Marge après frais par produit', 'Fiches : titre explicite, attributs, photos, GTIN', 'Avis acheteurs : uniquement réels, sans contrepartie'].join('\n'),
            },
          ],
      steps: ch.howTo,
    };
  }

  if (cat === 'annuaire' || cat === 'avis' || cat === 'reseau_social' || (cat === 'comparatif' && PLATFORM_PROFILE.test(domain))) {
    const verb = cat === 'avis' ? 'Obtenir des avis sur' : cat === 'reseau_social' ? 'Compléter votre présence sur' : 'Créer votre fiche sur';
    const reviewOnly = cat === 'avis' && c.segment !== 'local';
    const deliverable = reviewOnly ? [...reviewAsk(c, o.label), { type: 'text' as const, label: 'Présentation (champ « À propos », si la plateforme le demande)', content: clip(officialDescription(c, 400), 400) }] : directoryTexts(c, o.label);
    if (cat === 'avis' || /trustpilot|capterra|g2\.com/.test(domain))
      deliverable.push({
        type: 'checklist',
        label: 'Demande d’avis conforme',
        content: `Envoyez la même invitation à tous vos clients de la période, sans tri ni contrepartie, sans imposer de contenu.\nLien d’avis ${o.label} : ${TODO}`,
      });
    return {
      ...base,
      key: `src:${domain}`,
      kind: 'directory',
      title: `${verb} ${o.label}`,
      automation: 'guide',
      minutes: Math.min(minutes, 30),
      deliverable,
      steps: base.steps.length
        ? base.steps
        : [`Créez ou revendiquez votre profil sur ${o.label}.`, 'Collez les textes et les coordonnées ci-dessous, identiques à votre site et à Google.', 'Ajoutez catégories, photos et lien vers votre site.', 'Revenez cocher « C’est fait » : Repéré vérifiera la présence au prochain audit.'],
      llm: {
        index: 2,
        maxChars: 1000,
        instruction: `Rédige la présentation longue de l'entreprise pour son profil sur ${o.label} (${cat}), 600 à 1 000 caractères, factuelle, adaptée aux lecteurs de cette plateforme.`,
      },
    };
  }

  if (cat === 'media_local' || cat === 'media_national') {
    const subject = c.segment === 'local' ? `Idée de sujet : ${c.activity} à ${c.place}` : `Proposition d’expertise : ${c.activity}`;
    const body = [
      'Bonjour,',
      '',
      `Je suis ${c.facts.dirigeant ?? TODO}, ${c.segment === 'local' ? `de ${c.name}, ${c.activity} à ${c.place}` : `chez ${c.name}`}. J’ai lu votre page sur le sujet${o.label ? ` (${o.label})` : ''} et je pense pouvoir apporter un éclairage utile à vos lecteurs.`,
      '',
      `Angle proposé : ${TODO} (une actualité réelle : ouverture, anniversaire${sinceText(c) ? `, ${sinceText(c).trim()}` : ''}, recrutement, donnée que vous êtes seul à détenir, conseil de saison).`,
      '',
      `Ce que je peux fournir : un avis d’expert sur ${c.services[0] ?? c.activity}, des chiffres issus de notre activité (${TODO}), des photos libres de droits.`,
      '',
      'Je reste disponible pour un échange rapide.',
      'Bien cordialement,',
      `${c.facts.dirigeant ?? TODO} — ${c.name}${c.facts.telephone ? ` — ${c.facts.telephone}` : ''}${c.website ? ` — ${c.website}` : ''}`,
    ].join('\n');
    return {
      ...base,
      key: `src:${domain}`,
      kind: 'source_outreach',
      title: `Proposer un sujet à ${o.label}`,
      automation: 'semi',
      minutes: Math.max(minutes, 30),
      deliverable: [
        { type: 'text', label: 'Objet', content: subject },
        { type: 'text', label: 'E-mail de proposition', content: body },
      ],
      steps: [
        `Repérez l’auteur de la page citée sur ${o.label} (signature de l’article ou rubrique « contact »).`,
        'Complétez l’angle et les chiffres : uniquement des faits vrais et vérifiables.',
        'Envoyez depuis votre adresse professionnelle ; une seule relance après 10 jours.',
        'Aucune publication n’est garantie : c’est une proposition.',
      ],
      llm: {
        index: 1,
        maxChars: 1400,
        instruction: `Rédige l'e-mail de proposition de sujet au média ${o.label}, 120 à 200 mots, vouvoiement, angle concret tiré des faits fournis, sans promesse ni flatterie excessive ; garde des [à compléter] pour les chiffres non fournis.`,
      },
    };
  }

  if (cat === 'forum') {
    const q = c.audit.queries[0]?.text ?? `Quel ${c.activity} choisir ?`;
    const answer = [
      `Bonjour, je précise d’emblée que je travaille chez ${c.name} (${c.activity}${c.segment === 'local' ? `, ${c.place}` : ''}) : je ne suis donc pas neutre, mais voici quelques critères utiles, quel que soit le prestataire choisi.`,
      '',
      `1. ${TODO} (critère concret : délai, garantie, transparence des prix…)`,
      `2. ${TODO}`,
      `3. ${TODO}`,
      '',
      `${c.facts.prix ? `Pour vous donner un ordre d’idée, chez nous : ${c.facts.prix}.` : ''} Bonne recherche !`,
    ].join('\n');
    return {
      ...base,
      key: `src:${domain}`,
      kind: 'source_outreach',
      title: `Répondre en expert sur ${o.label}`,
      automation: 'guide',
      minutes: 20,
      impact: Math.min(base.impact, 2) as 1 | 2,
      deliverable: [
        { type: 'text', label: 'Question type à rechercher', content: q },
        { type: 'text', label: 'Réponse d’expert (brouillon, sans lien)', content: answer },
      ],
      steps: [
        `Utilisez un compte identifié à votre nom ou à celui de l’entreprise sur ${o.label}.`,
        'Cherchez une discussion récente qui pose cette question ; lisez les règles du forum.',
        'Adaptez le brouillon à la question réelle. Pas de lien au début, affiliation toujours déclarée.',
        'Repéré ne publie jamais à votre place : c’est vous qui postez.',
      ],
      llm: {
        index: 1,
        maxChars: 1200,
        instruction: `Rédige une réponse de forum utile et honnête (100 à 180 mots) à la question « ${q} », qui déclare l'affiliation avec l'entreprise dès la première phrase, donne 3 critères de choix concrets valables pour tout prestataire, sans lien, sans dénigrer de concurrent, sans ton publicitaire.`,
      },
    };
  }

  if (cat === 'comparatif') {
    return {
      ...base,
      key: `src:${domain}`,
      kind: 'source_outreach',
      title: `Demander à figurer dans le comparatif ${o.label}`,
      automation: 'semi',
      minutes: 25,
      deliverable: [
        { type: 'text', label: 'Objet', content: `Proposition d’ajout à votre comparatif : ${c.name}` },
        {
          type: 'text',
          label: 'E-mail à l’auteur',
          content: [
            'Bonjour,',
            '',
            `Votre comparatif sur ${o.label} est souvent repris quand on cherche ${c.segment === 'local' ? `un ${c.activity} à ${c.place}` : `« ${c.activity} »`}. ${c.name} n’y figure pas encore ; voici des éléments factuels si vous le mettez à jour :`,
            '',
            `• Ce que nous faisons : ${c.audit.input.offering || c.services.slice(0, 3).join(', ') || TODO}`,
            `• Pour qui : ${c.facts.clients || c.facts.zone || TODO}`,
            `• Prix : ${c.facts.prix || TODO}`,
            `• Depuis : ${c.facts.creation || TODO}`,
            '',
            c.segment === 'pme'
              ? 'Je peux vous fournir un accès de test ou des précisions. Si une place est payante, merci de l’indiquer clairement comme telle.'
              : c.segment === 'ecommerce'
                ? 'Je peux vous envoyer des échantillons ou des précisions. Si une place est payante, merci de l’indiquer clairement comme telle.'
                : 'Je reste disponible pour toute précision. Si une place est payante, merci de l’indiquer clairement comme telle.',
            '',
            'Bien cordialement,',
            `${c.facts.dirigeant ?? TODO} — ${c.name}`,
          ].join('\n'),
        },
      ],
      steps: ['Trouvez l’auteur ou le formulaire de contact de la page.', 'Complétez les éléments factuels, envoyez, relancez une fois au maximum.'],
      llm: {
        index: 1,
        maxChars: 1400,
        instruction: `Rédige l'e-mail à l'auteur du comparatif ${o.label} pour demander l'ajout de l'entreprise, 100 à 180 mots, arguments factuels tirés du contexte, pas de dénigrement des concurrents.`,
      },
    };
  }

  if (cat === 'institutionnel') {
    return {
      ...base,
      key: `src:${domain}`,
      kind: 'other',
      title: `Vous faire référencer par ${o.label}`,
      automation: 'guide',
      minutes,
      deliverable: [{ type: 'text', label: 'Coordonnées et description', content: `${napBlock(c)}\n\n${clip(officialDescription(c), 500)}` }],
      steps: base.steps.length ? base.steps : ['Vérifiez votre éligibilité réelle.', 'Constituez le dossier demandé.', 'Mettez à jour la fiche officielle avec les coordonnées de référence.'],
    };
  }
  return null;
}

/** Sources recommandées par parcours, quand l'audit n'en propose pas assez. */
function defaultOpportunities(segment: Segment): SourceOpportunity[] {
  const o = (domain: string, label: string, category: SourceCategory, effort: 'S' | 'M' | 'L', impact: 1 | 2 | 3, why: string): SourceOpportunity => ({
    domain,
    label,
    category,
    score: 0,
    why,
    action: '',
    howTo: [],
    effort,
    impact,
    competitorsPresent: [],
  });
  if (segment === 'local')
    return [
      o('pagesjaunes.fr', 'PagesJaunes', 'annuaire', 'S', 2, 'Annuaire généraliste très consulté en France ; ses données sont reprises par d’autres annuaires.'),
      o('facebook.com', 'Facebook', 'reseau_social', 'S', 2, 'Page entreprise souvent reprise comme source d’avis et de coordonnées.'),
    ];
  if (segment === 'pme')
    return [
      o('capterra.fr', 'Capterra', 'comparatif', 'M', 3, 'Plateforme de comparaison souvent citée pour les requêtes « meilleur logiciel ».'),
      o('appvizer.fr', 'Appvizer', 'comparatif', 'M', 2, 'Comparateur français de logiciels B2B.'),
      o('g2.com', 'G2', 'comparatif', 'M', 2, 'Plateforme d’avis B2B internationale citée pour les alternatives.'),
      o('trustpilot.com', 'Trustpilot', 'avis', 'M', 2, 'Avis clients publics, souvent repris dans les réponses de réputation.'),
    ];
  return [
    o('trustpilot.com', 'Trustpilot', 'avis', 'M', 3, 'Les IA reprennent les avis publics pour juger une marque en ligne.'),
    o('reddit.com', 'Reddit', 'forum', 'M', 2, 'Très cité pour les recommandations produit, mais instable d’un mois à l’autre.'),
  ];
}

function schemaDraft(c: TaskCtx, business: Business): Draft {
  const faq = buildFaq(c.audit, c.facts, business);
  const ld = buildJsonLd(business, c.facts, c.segment, { settings: c.settings, faq: [] });
  const pluginSteps =
    c.segment === 'ecommerce'
      ? 'Shopify génère souvent déjà un balisage Product : vérifiez avec le test des résultats enrichis de Google pour éviter les doublons.'
      : 'WordPress : installez le plugin Repéré (.zip) et collez votre identifiant ; le balisage reste à jour automatiquement.';
  return {
    key: 'schema',
    kind: 'schema',
    title: `Ajouter le balisage ${c.segment === 'local' ? 'LocalBusiness' : c.segment === 'pme' ? 'Organization' : 'Organization et Product'} à votre site`,
    why: 'C’est votre fiche d’identité lisible par les machines. Microsoft dit utiliser schema.org pour ses modèles ; aucun effet direct n’est démontré pour les autres IA. Coût : 10 minutes.',
    automation: 'semi',
    minutes: 10,
    impact: 1,
    deliverable: [
      { type: 'jsonld', label: 'Bloc à coller dans le <head> (lu sans JavaScript par les robots IA)', content: jsonLdScriptTag(ld) },
      { type: 'link', label: 'JSON-LD toujours à jour (pour le plugin WordPress)', content: `${SITE}/api/schema/${encodeURIComponent(c.businessId)}` },
    ],
    steps: [
      'Le balisage ne doit décrire que ce qui est visible sur votre page (adresse, horaires, produits…).',
      pluginSteps,
      'Autres sites : collez le bloc dans l’en-tête de la page d’accueil (réglage « code personnalisé » de votre CMS).',
      'Testez la page sur search.google.com/test/rich-results.',
      faq.length ? 'La FAQ balisée est publiée sur votre page hébergée (tâche « page FAQ »).' : 'Complétez votre fiche de vérité pour enrichir le balisage.',
    ],
  };
}

function faqDraft(c: TaskCtx, business: Business): Draft {
  const faq = buildFaq(c.audit, c.facts, business);
  const slug = c.settings.slug ?? slugify(c.name);
  const html = [
    `<section class="faq">`,
    `  <h2>Questions fréquentes sur ${escapeHtml(c.name)}</h2>`,
    ...faq.flatMap((i) => [`  <h3>${escapeHtml(i.q)}</h3>`, `  <p>${escapeHtml(i.a)}</p>`]),
    `</section>`,
  ].join('\n');
  return {
    key: 'faq_page',
    kind: 'faq_page',
    title: 'Publier votre page « fiche officielle + FAQ »',
    why: 'Les IA répondent à des questions : une page claire, en texte visible, avec vos vraies informations, leur donne une source exacte à reprendre.',
    automation: 'auto',
    minutes: 10,
    impact: 2,
    deliverable: [
      { type: 'link', label: 'Votre page hébergée (relisez puis validez)', content: `${SITE}/p/${slug}` },
      { type: 'html', label: 'Bloc FAQ à coller sur votre site (optionnel)', content: html },
    ],
    steps: [
      'Relisez chaque réponse : elles viennent de votre fiche de vérité, rien n’est inventé.',
      'Ajoutez 2 ou 3 questions que vos clients posent réellement au téléphone.',
      'Ajoutez un lien vers la page depuis votre site (pied de page ou page contact).',
      'Option : sous-domaine faq.votre-site.fr (un enregistrement DNS, guidé par Repéré).',
    ],
  };
}

function reviewRequestDraft(c: TaskCtx, business: Business): Draft {
  if (c.segment !== 'local') {
    const platforms = c.segment === 'pme' ? ['G2', 'Capterra', 'Trustpilot'] : ['Avis Vérifiés', 'Trustpilot', 'les avis produits de votre boutique Shopify'];
    const main = c.segment === 'pme' ? 'G2' : 'Trustpilot';
    return {
      key: 'review_request',
      kind: 'review_request',
      title: c.segment === 'ecommerce' ? 'Demander un avis 7 jours après chaque livraison' : `Demander un avis à vos clients sur ${platforms.slice(0, 2).join(' et ')}`,
      why:
        c.segment === 'pme'
          ? 'Pour « meilleur logiciel » ou « alternative à », les IA s’appuient sur G2, Capterra et Trustpilot : des avis récents y renforcent votre crédibilité (corrélation, pas garantie).'
          : 'Les IA s’appuient sur les avis publics (Trustpilot, Avis Vérifiés, avis produits) pour juger une marque en ligne.',
      automation: 'semi',
      minutes: 15,
      impact: c.segment === 'pme' ? 2 : 3,
      deliverable: [
        ...reviewAsk(c, main),
        { type: 'checklist', label: 'Plateformes à alimenter (dans cet ordre)', content: platforms.join('\n') },
        { type: 'checklist', label: 'Règles à respecter', content: REVIEW_RULES_TEXT },
      ],
      steps:
        c.segment === 'pme'
          ? ['Exportez la liste de vos clients actifs depuis plus de 3 mois, sans tri par satisfaction.', `Créez ou revendiquez votre page ${main} et collez son lien dans l’e-mail.`, 'Envoyez la même demande à tous ; une relance au maximum.']
          : ['Programmez l’e-mail 7 jours après l’expédition dans Shopify Flow, Klaviyo ou votre outil d’avis.', 'Même message à tous les clients, sans contrepartie ni tri.', 'Répondez aux avis publiés, y compris critiques.'],
    };
  }
  const kit = reviewKit(business, c.settings);
  const deliverable: Deliverable[] = [];
  if (kit.reviewUrl) deliverable.push({ type: 'link', label: 'Lien direct d’avis Google', content: kit.reviewUrl });
  else deliverable.push({ type: 'checklist', label: 'Trouver votre lien d’avis', content: kit.instructions.join('\n') });
  deliverable.push(
    { type: 'text', label: `E-mail — ${kit.email.subject}`, content: kit.email.body },
    { type: 'text', label: 'SMS', content: kit.sms },
  );
  if (kit.qrSvg) deliverable.push({ type: 'html', label: 'QR code (SVG, à imprimer sur factures et comptoir)', content: kit.qrSvg });
  else if (kit.qrServiceUrl) deliverable.push({ type: 'link', label: 'QR code', content: kit.qrServiceUrl });
  deliverable.push({ type: 'checklist', label: 'Règles à respecter', content: kit.rules.join('\n') });
  return {
    key: 'review_request',
    kind: 'review_request',
    title: 'Lancer votre demande d’avis Google (lien, QR code, modèles)',
    why: 'Le nombre d’avis Google est le signal le plus corrélé à la présence dans les réponses des IA (corrélation, pas preuve de causalité).',
    automation: 'semi',
    minutes: 15,
    impact: 3,
    deliverable,
    steps: [
      'Envoyez la demande à tous les clients de la période (fichier ou après chaque prestation), sans tri.',
      'Aucune contrepartie, aucun contenu imposé : le client écrit librement.',
      'Une relance au maximum. Repéré suit l’évolution du nombre d’avis.',
    ],
  };
}

function reviewReplyDraft(c: TaskCtx): Draft {
  const ctx = { businessName: c.name, contact: c.facts.telephone };
  return {
    key: 'review_reply',
    kind: 'review_reply',
    title: 'Répondre à vos derniers avis (brouillons prêts)',
    why: 'Répondre montre une entreprise active et ajoute du texte utile sous votre fiche. Effet sur les IA non mesuré ; bonne pratique.',
    automation: 'semi',
    minutes: 10,
    impact: 1,
    deliverable: [
      { type: 'text', label: 'Exemple — avis 5 étoiles', content: draftReviewReply({ rating: 5, text: 'Très bon travail, rapide et soigné.' }, ctx) },
      { type: 'text', label: 'Exemple — avis 2 étoiles', content: draftReviewReply({ rating: 2, text: 'Délai plus long que prévu.' }, ctx) },
    ],
    steps: ['Collez vos avis sans réponse dans Repéré (onglet Tâches → « Répondre à un avis ») : un brouillon est rédigé pour chacun.', 'Relisez, ajustez, puis publiez depuis votre fiche Google.', 'Jamais de nom ni de détail personnel du client dans la réponse.'],
  };
}

const REVIEW_RULES_TEXT = reviewKit({ name: '' }).rules.join('\n');

const FIELD_LABEL: Record<BrandFactField, string> = {
  adresse: 'adresse',
  telephone: 'numéro de téléphone',
  horaires: 'horaires',
  prix: 'prix',
  zone: 'zone d’intervention',
  services: 'services',
  dirigeant: 'dirigeant',
  creation: 'date de création',
  site: 'site web',
  statut: 'statut (ouvert ou fermé)',
  produits: 'produits',
  livraison: 'conditions de livraison',
  clients: 'références clients',
  retours: 'conditions de retour',
  ingredients: 'composition (ingrédients)',
  certifications: 'labels et certifications',
};

const PROVIDER_LABEL: Record<string, string> = { chatgpt: 'ChatGPT', perplexity: 'Perplexity', gemini: 'Gemini', claude: 'Claude' };

function factFixDraft(c: TaskCtx, item: FactCheckItem): Draft {
  const label = FIELD_LABEL[item.field] ?? item.field;
  const where: string[] = [];
  if (c.segment === 'local') {
    where.push('Fiche Google (business.google.com) — champ correspondant');
    where.push('Votre site : page d’accueil, page contact et mentions légales');
  } else if (c.segment === 'pme') {
    where.push(`Votre site : ${item.field === 'prix' ? 'page Tarifs, FAQ et page d’accueil' : 'page d’accueil, FAQ et page « À propos »'}`);
    where.push('Vos profils G2 et Capterra (champ correspondant)');
    where.push('Votre page LinkedIn entreprise (section « À propos »)');
  } else {
    where.push(`Votre boutique : ${item.field === 'livraison' || item.field === 'retours' ? 'page Livraison et retours, bandeau du site et FAQ' : 'fiches produits concernées et FAQ'}`);
    where.push('Votre flux Google Merchant Center (champs shipping / price)');
    where.push('Vos fiches sur les places de marché où vous vendez (Amazon, Sephora…)');
  }
  where.push('Votre page hébergée Repéré et le balisage JSON-LD (mis à jour automatiquement depuis la fiche de vérité)');
  const presentDirs = (c.audit.sources?.domains ?? []).filter((d) => d.clientPresence === 'present' && ['annuaire', 'avis', 'marketplace', 'comparatif', 'reseau_social'].includes(d.category)).slice(0, 4);
  for (const d of presentDirs) where.push(`${d.label} (${d.domain}) — votre profil y est cité par les IA`);
  if (c.segment === 'local') where.push('PagesJaunes, Bing Places, Apple Business');
  // pas de double libellé (« Adresse de X : Atelier : … »)
  const expected = item.expected.replace(/^[A-Za-zÀ-ÿ’' ]{2,20}\s?:\s*/, '');
  const correct = `${capitalize(label)} de ${c.name} : ${expected}`;
  return {
    key: `fact:${item.field}`,
    kind: 'fact_fix',
    title: `Corriger : ${PROVIDER_LABEL[item.provider] ?? item.provider} donne ${item.field === 'statut' ? 'un mauvais statut' : `une mauvaise information (${label})`}`,
    why: `${PROVIDER_LABEL[item.provider] ?? item.provider} affirme « ${clip(item.stated, 120)} » alors que la bonne information est « ${clip(item.expected, 120)} ». Les IA ne se corrigent pas sur demande : elles reprennent leurs sources, il faut donc corriger celles-ci.`,
    automation: 'semi',
    minutes: 15,
    impact: item.severity === 'haute' ? 3 : item.severity === 'moyenne' ? 2 : 1,
    event: true,
    deliverable: [
      { type: 'text', label: 'Texte correct à reprendre partout', content: correct },
      { type: 'checklist', label: 'Où corriger (par ordre de priorité)', content: where.join('\n') },
      { type: 'text', label: 'Extrait de la réponse fautive', content: clip(item.quote || item.stated, 400) },
    ],
    steps: [
      c.segment === 'local'
        ? 'Corrigez d’abord votre fiche Google et votre site (sources les plus reprises).'
        : c.segment === 'pme'
          ? 'Corrigez d’abord votre site (page Tarifs et FAQ), puis vos profils G2 et Capterra.'
          : 'Corrigez d’abord votre boutique (page Livraison, fiches produits), puis votre flux Merchant Center.',
      'Puis chaque source de la liste, avec exactement le même texte.',
      'Option : signalez la réponse fautive dans l’IA (pouce vers le bas + commentaire) ; l’effet n’est pas garanti.',
      'Repéré revérifie cette information au prochain audit.',
    ],
  };
}

/** Ce que les données disent d'un concurrent (descriptions relevées dans les réponses, sources) — jamais inventé. */
export function competitorNotes(gap: { reasons: string[]; presentOn: string[] }): string[] {
  const out: string[] = [];
  for (const r of gap.reasons) {
    const m = /décrit ainsi : « (.+?) »/.exec(r);
    if (m) out.push(`décrit comme « ${m[1]} »`);
  }
  if (gap.presentOn.length) out.push(`présent sur ${gap.presentOn.slice(0, 3).join(', ')}`);
  return out;
}

function contentDraft(c: TaskCtx): Draft | null {
  const gap = c.audit.gaps?.[0];
  if (!gap) return null;
  if (c.segment === 'pme') {
    const page = buildComparisonPage({
      name: c.name,
      segment: c.segment,
      activity: c.activity,
      offering: c.audit.input.offering,
      facts: c.facts,
      competitor: gap.competitor,
      competitorNotes: competitorNotes(gap),
      date: c.now,
      // Cellule concurrent pré-remplie avec ce qui est publiquement relevé ; le reste est « à compléter ».
      extraRows: gap.presentOn.length ? [{ label: 'Présent sur les sources citées par les IA', mine: null, them: { value: gap.presentOn.slice(0, 4).join(', '), source: 'sources citées par les IA' } }] : [],
    });
    return {
      key: `content:vs:${slugify(gap.competitor)}`,
      kind: 'content',
      title: `Publier un comparatif honnête face à ${gap.competitor}`,
      why: `${gap.competitor} est cité ${gap.mentions} fois dans l’audit, plus que vous. Une page comparative factuelle donne aux IA une source pour les requêtes « alternative à » et « ${c.name} ou ${gap.competitor} ».`,
      automation: 'semi',
      minutes: 30,
      impact: 2,
      event: true,
      deliverable: [
        { type: 'text', label: 'Page rédigée (Markdown, à relire)', content: page.markdown },
        { type: 'html', label: 'La même page en HTML', content: page.html },
      ],
      steps: [
        `Remplissez chaque cellule « à compléter » et revérifiez les autres sur les pages publiques de ${gap.competitor}, puis datez la page.`,
        'Complétez honnêtement « Pour qui choisir » : un comparatif qui reconnaît les points forts de l’autre est plus repris.',
        'Publiez sur votre site (ex. /comparatif) et liez-la depuis votre page Tarifs.',
      ],
    };
  }
  const svc = c.segment === 'ecommerce' ? (c.audit.input.productCategories?.[0] ?? c.products[0] ?? c.activity) : (c.services[0] ?? c.activity);
  const title = c.segment === 'local' ? `${capitalize(svc)} à ${c.place} — ${c.name}` : `Guide : bien choisir son ${svc}`;
  return {
    key: `content:page:${slugify(svc)}`,
    kind: 'content',
    title: c.segment === 'local' ? `Créer la page « ${capitalize(svc)} » qui manque face à ${gap.competitor}` : `Publier un guide d’achat « ${capitalize(svc)} : comment bien choisir »`,
    why: `${gap.competitor} passe devant vous (${gap.mentions} citations)${gap.presentOn.length ? ` et apparaît sur ${gap.presentOn.slice(0, 3).join(', ')}` : ''}. ${gap.reasons[0] ?? ''}`.trim(),
    automation: 'semi',
    minutes: 45,
    impact: 2,
    event: true,
    deliverable: [
      { type: 'text', label: 'Titre de la page', content: title },
      {
        type: 'text',
        label: 'Trame',
        content: [
          c.segment === 'ecommerce' ? `Ce que contient notre ${svc} : ${c.facts.ingredients ?? TODO}` : `Ce que comprend la prestation « ${svc} » chez ${c.name} : ${TODO}`,
          `Pour qui, et dans quels cas : ${TODO}`,
          `Prix indicatif : ${c.facts.prix ?? TODO}`,
          c.segment === 'local' ? `Zone et délai : ${c.facts.zone ?? TODO}` : `Livraison : ${c.facts.livraison ?? TODO}`,
          `Un cas réel ou une photo : ${TODO} (obligatoire : un fait propre à vous)`,
          'FAQ : 3 questions entendues de vos clients.',
        ].join('\n'),
      },
    ],
    steps: ['Une seule page par service réel, contenu unique (pas de copie en changeant le nom de la ville).', 'Au moins un fait propre (prix, délai, photo, cas réel).', 'Liez la page depuis l’accueil.'],
  };
}

function productFeedDrafts(c: TaskCtx): Draft[] {
  const cats = (c.audit.input.productCategories?.length ? c.audit.input.productCategories : c.products).slice(0, 3);
  // Une fiche par PRODUIT du catalogue (le premier de chaque catégorie suivie), sinon par catégorie.
  const byCat = cats.map((cat) => c.catalog.find((p) => (p.category ?? '').toLowerCase() === cat.toLowerCase()) ?? cat);
  const items: (string | SheetProduct)[] = c.catalog.length ? [...byCat, ...c.catalog] : cats;
  const sheets = buildProductSheets({ name: c.name, website: c.website, facts: c.facts, products: items, city: realCity(c.city) });
  const out: Draft[] = sheets.map((sh) => ({
    key: `product:${slugify(sh.product)}`,
    kind: 'product_feed' as const,
    title: `Enrichir la fiche produit : ${sh.product.replace(/\s+/g, ' ')}`,
    why: 'Pour les requêtes « meilleur … », les IA comparent des attributs précis (composition, labels, prix, livraison). Une fiche complète et son balisage Product leur donnent ces faits.',
    automation: 'semi' as const,
    minutes: 20,
    impact: 3 as const,
    deliverable: [
      { type: 'text' as const, label: `Texte de la fiche ${sh.product.replace(/\s+/g, ' ')} (à coller dans la description)`, content: sh.text },
      ...(sh.faq.length ? [{ type: 'text' as const, label: 'FAQ produit (à afficher sur la fiche)', content: sh.faq.map((x) => `${x.q}\n${x.a}`).join('\n\n') }] : []),
      { type: 'jsonld' as const, label: 'Balisage Product et FAQ (aucune valeur inventée)', content: sh.jsonLd.map((x) => jsonLdScriptTag(x)).join('\n') },
      { type: 'checklist' as const, label: 'Il manque (à ajouter pour une fiche qui vend)', content: sh.missing.join('\n') },
    ],
    steps: [
      'Collez le texte et la FAQ dans la fiche produit (Shopify : Produits → la fiche → Description).',
      'Shopify génère souvent déjà un balisage Product : complétez-le (marque, GTIN) plutôt que d’en ajouter un second ; ajoutez au moins le bloc FAQ.',
      'Allégations santé ou « bio » : uniquement avec certification réelle.',
    ],
  }));
  out.push({
    key: 'merchant_center',
    kind: 'product_feed',
    title: 'Envoyer votre catalogue à Google Merchant Center (fiches gratuites)',
    why: 'Le flux produit alimente les fiches gratuites de Google Shopping ; c’est la voie documentée pour que vos produits soient des données structurées hors de votre site. Effet sur les IA non démontré.',
    automation: 'guide',
    minutes: 30,
    impact: 2,
    deliverable: [
      { type: 'checklist', label: 'Champs du flux à vérifier', content: 'id\ntitle (explicite)\ndescription\nlink\nimage_link\nprice\navailability\nbrand\ngtin (si existant)\nproduct_type\nshipping' },
      { type: 'link', label: 'Merchant Center', content: 'https://merchants.google.com/' },
    ],
    steps: ['Shopify : application « Google & YouTube » ; WooCommerce : extension « Google for WooCommerce ».', 'Activez les fiches gratuites, corrigez les erreurs signalées.', 'Les titres du flux reprennent le gabarit de vos fiches.'],
  });
  return out;
}

function robotsDraft(c: TaskCtx): Draft {
  return {
    key: 'robots',
    kind: 'other',
    title: 'Vérifier que les robots des IA peuvent lire votre site',
    why: 'Si robots.txt ou une protection anti-robot bloque GPTBot, OAI-SearchBot, PerplexityBot ou ClaudeBot, votre site ne peut pas être lu ni cité.',
    automation: 'semi',
    minutes: 10,
    impact: 2,
    deliverable: [
      {
        type: 'text',
        label: 'Lignes à ajouter à robots.txt (si absentes)',
        content: ['User-agent: OAI-SearchBot', 'Allow: /', '', 'User-agent: PerplexityBot', 'Allow: /', '', 'User-agent: Claude-SearchBot', 'Allow: /', '', 'User-agent: Bingbot', 'Allow: /'].join('\n'),
      },
      { type: 'link', label: 'Votre robots.txt', content: `${(c.website ?? 'https://votre-site.fr').replace(/\/$/, '').replace(/^(?!https?:)/, 'https://')}/robots.txt` },
    ],
    steps: ['Ouvrez votre robots.txt et cherchez « Disallow: / » sous ces robots.', 'Vérifiez que le texte principal apparaît dans le code source (clic droit → afficher le code source).', 'GPTBot (entraînement) peut rester bloqué si vous le souhaitez : cela n’empêche pas la recherche ChatGPT (OAI-SearchBot).'],
  };
}

function llmsTxtDraft(c: TaskCtx): Draft {
  const lines = [
    `# ${c.name}`,
    '',
    `> ${clip(officialDescription(c, 300), 300)}`,
    '',
    '## Pages clés',
    `- [Accueil](${c.website ?? TODO})`,
    `- [Fiche officielle et FAQ](${SITE}/p/${c.settings.slug ?? slugify(c.name)})`,
  ];
  return {
    key: 'llms_txt',
    kind: 'other',
    title: 'Bonus : fichier llms.txt (effet non démontré)',
    why: 'Option gratuite : selon Ahrefs (juin 2026), 97 % des fichiers llms.txt ne reçoivent aucune requête. À faire en dernier, jamais à la place du reste.',
    automation: 'semi',
    minutes: 5,
    impact: 1,
    deliverable: [{ type: 'text', label: 'Contenu de /llms.txt', content: lines.join('\n') }],
    steps: ['Déposez le fichier à la racine du site (FTP ou extension de votre CMS).', 'N’y passez pas plus de 5 minutes.'],
  };
}

function napDraft(c: TaskCtx): Draft {
  return {
    key: 'nap',
    kind: 'other',
    title: 'Fixer vos coordonnées de référence partout',
    why: 'Des coordonnées différentes d’un site à l’autre font douter les IA de qui vous êtes. Seuls 55 % des commerces connus des IA ont des informations exactes (Insites, 2026).',
    automation: 'guide',
    minutes: 20,
    impact: 2,
    deliverable: [{ type: 'text', label: 'Version de référence (identique partout)', content: napBlock(c) }],
    steps: ['Listez vos présences : Google, Bing, PagesJaunes, Facebook, annuaires, site.', 'Corrigez chaque écart (« 11ème » / « 11e », ancien numéro, ancienne raison sociale).', 'Signalez les doublons de fiches pour fusion.'],
  };
}

// ---------------------------------------------------------------------------
// Assemblage
// ---------------------------------------------------------------------------
function businessFromAudit(c: TaskCtx): Business {
  return {
    id: c.businessId,
    name: c.name,
    trade: c.audit.input.trade,
    city: c.city,
    district: c.district,
    website: c.website,
    plan: 'suivi',
    lastScore: c.audit.score ?? null,
    createdAt: c.now,
  };
}

export function buildDrafts(c: TaskCtx): Draft[] {
  const business = businessFromAudit(c);
  const drafts: Draft[] = [];
  const push = (d: Draft | null | undefined) => {
    if (d && !drafts.some((x) => x.key === d.key)) drafts.push(d);
  };

  // 1. Erreurs factuelles (événement de la semaine)
  for (const item of c.audit.factCheck?.items ?? []) if (item.verdict === 'faux' || (item.verdict === 'incomplet' && item.severity === 'haute')) push(factFixDraft(c, item));

  // 2. Fondations par parcours
  // Fiche Google : parcours local uniquement (un SaaS ou une marque en ligne sans accueil du public n'en a pas besoin).
  if (c.segment === 'local') push(gbpDraft(c));
  if (c.segment === 'local') {
    push(bingDraft(c));
    push(appleDraft(c));
    push(napDraft(c));
  }
  if (c.segment === 'ecommerce') for (const d of productFeedDrafts(c)) push(d);
  push(reviewRequestDraft(c, business));
  push(faqDraft(c, business));
  push(schemaDraft(c, business));

  // 3. Sources : opportunités de l'audit, puis sources recommandées
  const opps = [...(c.audit.sources?.opportunities ?? [])].sort((a, b) => b.score - a.score);
  let n = 0;
  for (const o of opps) {
    if (n >= 6) break;
    const d = opportunityDraft(c, o);
    if (d) {
      push(d);
      n++;
    }
  }
  if (n < 3) for (const o of defaultOpportunities(c.segment)) if (!opps.some((x) => x.domain === o.domain)) push(opportunityDraft(c, o, true));

  // 4. Pourquoi les concurrents passent devant
  push(contentDraft(c));

  // 5. Compléments
  if (c.segment === 'local') push(reviewReplyDraft(c));
  if (c.website) push(robotsDraft(c));
  push(llmsTxtDraft(c));
  return drafts;
}

/** Priorité « impact sur temps » (l'impact compte double : une tâche marginale très courte ne passe pas devant). */
export const priority = (t: Pick<ExecTask, 'impact' | 'minutes'> & { event?: boolean }) => (t.impact * t.impact * 10) / Math.max(5, t.minutes) + (t.event ? 2 : 0);

function toTask(c: TaskCtx, d: Draft): StoredTask {
  return {
    id: `t_${shortHash(`${c.businessId}:${d.key}`, 12)}`,
    businessId: c.businessId,
    kind: d.kind,
    title: frSpaces(d.title),
    why: frSpaces(d.why),
    automation: d.automation,
    minutes: d.minutes,
    impact: d.impact,
    status: 'todo',
    deliverable: d.deliverable,
    steps: d.steps,
    ...(d.sourceDomain ? { sourceDomain: d.sourceDomain } : {}),
    createdAt: c.now,
    key: d.key,
    ...(d.event ? { event: true } : {}),
  };
}

/** Contrat : tâches concrètes (gabarits, sans réseau), triées par priorité (impact / temps). */
export function generateTasks(result: AuditV2, facts?: BrandFacts | FactsMap | null, opts: GenerateOptions = {}): StoredTask[] {
  const c = buildCtx(result, facts, opts);
  return buildDrafts(c)
    .map((d) => toTask(c, d))
    .sort((a, b) => priority(b) - priority(a))
    .slice(0, opts.max ?? 18);
}

function llmContext(c: TaskCtx): string {
  const a = c.audit;
  const facts = Object.entries(c.facts)
    .map(([k, v]) => `- ${k} : ${v}`)
    .join('\n');
  return [
    `Entreprise : ${c.name} (${c.segment === 'local' ? 'commerce local' : c.segment === 'pme' ? 'PME / B2B' : 'e-commerce'})`,
    `Activité : ${c.activity}${c.segment === 'local' ? ` à ${c.place}` : ''}`,
    a.input.offering ? `Offre : ${a.input.offering}` : '',
    `Fiche de vérité (seules informations sûres) :\n${facts || '- (vide)'}`,
    `Audit : score ${a.score}/100 ; concurrents les plus cités : ${a.competitors.slice(0, 4).map((x) => x.name).join(', ') || 'aucun'}.`,
    a.perception?.themes?.length ? `Thèmes associés par les IA : ${a.perception.themes.join(', ')}.` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Comme generateTasks, puis réécrit les textes clés par LLM (au plus 8 appels). Sans clé : identique. */
export async function generateTasksAsync(result: AuditV2, facts?: BrandFacts | FactsMap | null, opts: GenerateOptions = {}): Promise<StoredTask[]> {
  const c = buildCtx(result, facts, opts);
  const drafts = buildDrafts(c);
  const ranked = drafts.map((d) => ({ d, t: toTask(c, d) })).sort((a, b) => priority(b.t) - priority(a.t)).slice(0, opts.max ?? 18);
  if (llmAvailable()) {
    const ctxText = llmContext(c);
    const jobs = ranked.filter((r) => r.d.llm).slice(0, 8);
    await Promise.all(
      jobs.map(async ({ d, t }) => {
        const slot = d.llm!;
        const current = d.deliverable[slot.index]?.content ?? '';
        const out = await complete({
          system: SYSTEM_FR,
          prompt: `${ctxText}\n\nConsigne : ${slot.instruction}\nLimite stricte : ${slot.maxChars} caractères.\nVersion gabarit à améliorer (garde les [à compléter] pour ce qui n'est pas connu) :\n"""${current}"""\n\nRéponds en JSON : {"text": "..."}`,
          json: true,
          maxTokens: Math.ceil(slot.maxChars / 2.5),
        });
        const text = parseJsonObject<{ text?: string }>(out)?.text?.trim();
        if (text && t.deliverable?.[slot.index]) {
          t.deliverable[slot.index] = { ...t.deliverable[slot.index], content: clip(text, slot.maxChars) };
          t.llm = true;
        }
      }),
    );
  }
  return ranked.map((r) => r.t);
}
