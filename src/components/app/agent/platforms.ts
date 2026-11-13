/**
 * Assistant de connexion : où trouver chaque accès, plateforme par plateforme (sources : docs/v5/publication.md).
 * Les champs correspondent à `connect()` des connecteurs de @/lib/publish (config / credentials).
 */
import type { ChangeKind, Platform } from './model';

export interface PlatformField {
  name: string;
  /** 'config' (non secret) ou 'credentials' (chiffré au repos, jamais renvoyé) */
  group: 'config' | 'credentials';
  label: string;
  placeholder?: string;
  help?: string;
  type?: 'text' | 'password' | 'url';
  optional?: boolean;
  /** contrôle rapide côté navigateur (le serveur revalide) */
  pattern?: RegExp;
  error?: string;
}

export interface PlatformGuide {
  id: Exclude<Platform, 'export'>;
  monogram: string;
  pitch: string;
  /** étapes « où trouver », en texte simple ; `path` est affiché comme un chemin de menu */
  steps: { text: string; path?: string }[];
  tip?: string;
  fields: PlatformField[];
  /** ce que l'agent saura faire une fois connecté (avant test des droits) */
  can: ChangeKind[];
}

export const GUIDES: PlatformGuide[] = [
  {
    id: 'wordpress',
    monogram: 'W',
    pitch: 'Titres, descriptions, textes d’images, données structurées et questions fréquentes.',
    steps: [
      { text: 'Connectez-vous à votre WordPress, puis ouvrez', path: 'Utilisateurs > Profil' },
      { text: 'Descendez jusqu’à « Mots de passe d’application ». Nommez-le « Repéré », puis cliquez sur', path: 'Ajouter un mot de passe d’application' },
      { text: 'Copiez le mot de passe affiché (24 caractères, par groupes de 4). WordPress ne le montre qu’une fois.' },
    ],
    tip: 'Un compte au rôle « Éditeur » suffit. Avec Yoast, installez l’extension d’aide fournie pour que l’agent écrive titres et descriptions ; avec Rank Math, rien à faire. Le site doit être en https.',
    fields: [
      { name: 'siteUrl', group: 'config', label: 'Adresse du site', placeholder: 'https://www.votre-site.fr', type: 'url', pattern: /^https:\/\/[^\s/]+\.[^\s]+$/i, error: 'Adresse en https requise (ex. https://www.votre-site.fr).' },
      { name: 'username', group: 'credentials', label: 'Identifiant WordPress', placeholder: 'votre identifiant de connexion' },
      { name: 'password', group: 'credentials', label: 'Mot de passe d’application', placeholder: 'abcd efgh ijkl mnop qrst uvwx', type: 'password', help: 'Pas votre mot de passe habituel : celui créé à l’étape 2.', pattern: /^[A-Za-z0-9 ]{16,}$/, error: 'Collez le mot de passe d’application (au moins 16 caractères).' },
    ],
    can: ['meta.title', 'meta.description', 'image.alt', 'jsonld', 'faq', 'rewrite'],
  },
  {
    id: 'shopify',
    monogram: 'S',
    pitch: 'Titres et descriptions des produits, pages et articles, textes produits, redirections.',
    steps: [
      { text: 'Dans l’administration Shopify, ouvrez', path: 'Paramètres > Applications et canaux de vente > Développer des applications' },
      { text: 'Créez une application « Repéré », puis dans « Configuration de l’API Admin » cochez', path: 'write_products, write_content, write_online_store_navigation' },
      { text: 'Installez l’application, puis cliquez sur « Révéler le jeton une fois » et copiez le jeton (il commence par shpat_).' },
    ],
    tip: 'robots.txt et llms.txt passent par l’export : Shopify réserve l’écriture des fichiers du thème aux applications autorisées.',
    fields: [
      { name: 'shop', group: 'config', label: 'Adresse de la boutique', placeholder: 'ma-boutique.myshopify.com', pattern: /^[a-z0-9][a-z0-9-]*(\.myshopify\.com)?$/i, error: 'Indiquez l’adresse en .myshopify.com.' },
      { name: 'token', group: 'credentials', label: 'Jeton d’accès de l’API Admin', placeholder: 'shpat_…', type: 'password', pattern: /^shp(at|ca|ss)_[A-Za-z0-9]{20,}$/, error: 'Le jeton commence par shpat_.' },
    ],
    can: ['meta.title', 'meta.description', 'rewrite', 'redirect'],
  },
  {
    id: 'webflow',
    monogram: 'Wf',
    pitch: 'Titres et descriptions des pages, publiés en une fois.',
    steps: [
      { text: 'Dans Webflow, ouvrez les réglages du site, puis', path: 'Apps et intégrations > Accès à l’API' },
      { text: 'Générez un jeton avec les droits Pages (lecture et écriture), Sites (écriture, pour publier) et CMS (écriture).' },
      { text: 'Copiez aussi l’identifiant du site (24 caractères), dans', path: 'Réglages du site > Général' },
    ],
    tip: 'Webflow n’accepte qu’une publication par minute : l’agent publie une seule fois, après toutes les modifications validées.',
    fields: [
      { name: 'siteId', group: 'config', label: 'Identifiant du site', placeholder: '24 caractères', pattern: /^[a-f0-9]{24}$/i, error: 'L’identifiant fait 24 caractères (chiffres et lettres a à f).' },
      { name: 'token', group: 'credentials', label: 'Jeton d’API du site', type: 'password', pattern: /^.{20,}$/, error: 'Collez le jeton d’API complet.' },
    ],
    can: ['meta.title', 'meta.description'],
  },
  {
    id: 'prestashop',
    monogram: 'P',
    pitch: 'Titres et descriptions des produits, catégories et pages.',
    steps: [
      { text: 'Dans l’administration PrestaShop, ouvrez', path: 'Paramètres avancés > Webservice' },
      { text: 'Activez le webservice, puis cliquez sur « Ajouter une nouvelle clé webservice » et générez une clé.' },
      { text: 'Cochez « Afficher » et « Modifier » pour products, categories et content_management_system, puis enregistrez.' },
    ],
    tip: 'Ne donnez pas d’autre droit à cette clé : l’agent n’en a pas besoin.',
    fields: [
      { name: 'siteUrl', group: 'config', label: 'Adresse de la boutique', placeholder: 'https://www.votre-boutique.fr', type: 'url', pattern: /^https:\/\/[^\s/]+\.[^\s]+$/i, error: 'Adresse en https requise.' },
      { name: 'apiKey', group: 'credentials', label: 'Clé webservice', placeholder: '32 caractères', type: 'password', pattern: /^[A-Z0-9]{32}$/i, error: 'La clé fait 32 caractères.' },
      { name: 'languageId', group: 'config', label: 'Langue (identifiant)', placeholder: '1', optional: true, help: 'Facultatif : 1 = langue principale.', pattern: /^\d{0,3}$/, error: 'Un nombre (ex. 1).' },
    ],
    can: ['meta.title', 'meta.description'],
  },
  {
    id: 'gbp',
    monogram: 'G',
    pitch: 'Description et horaires de votre fiche Google.',
    steps: [{ text: 'Bientôt : Google ouvre l’accès à son API sur dossier. En attendant, l’agent prépare les textes à coller dans votre fiche.' }],
    fields: [],
    can: ['gbp.description', 'gbp.hours'],
  },
];

export const guideFor = (p: Platform) => GUIDES.find((g) => g.id === p) ?? null;

/** Erreurs de saisie (contrôle rapide, le serveur revalide). */
export function fieldErrors(g: PlatformGuide, values: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of g.fields) {
    const v = (values[f.name] ?? '').trim();
    if (!v) {
      if (!f.optional) out[f.name] = 'À remplir.';
      continue;
    }
    if (f.pattern && !f.pattern.test(v)) out[f.name] = f.error ?? 'Format inattendu.';
  }
  return out;
}

/** Corps de la requête POST /api/v5/publish/connections (config / credentials séparés). */
export function connectBody(g: PlatformGuide, values: Record<string, string>): { platform: Platform; config: Record<string, string>; credentials: Record<string, string> } {
  const config: Record<string, string> = {};
  const credentials: Record<string, string> = {};
  for (const f of g.fields) {
    const v = (values[f.name] ?? '').trim();
    if (!v) continue;
    (f.group === 'config' ? config : credentials)[f.name] = v;
  }
  return { platform: g.id, config, credentials };
}
