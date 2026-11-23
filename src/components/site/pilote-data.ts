/**
 * Page /tout-fait-pour-vous (V10, PILOTE-AUTO) : ce que le pilote automatique sait faire seul selon la plateforme du
 * site (dit AVANT le paiement), d'après les connecteurs réels (src/lib/publish/connectors, docs/v5/publication.md).
 * « auto » : appliqué sur votre site ; « email » : fichiers ou marche à suivre envoyés par e-mail, à déposer vous-même
 * ou par votre prestataire. Pur, sans dépendance serveur (importé côté navigateur).
 */
export type PlatformId = "wordpress" | "shopify" | "wix" | "webflow" | "prestashop" | "magento" | "autre";

export interface PlatformFit {
  id: PlatformId;
  label: string;
  /** connectable : le pilote applique lui-même une partie du travail */
  connectable: boolean;
  /** comment se connecte-t-on (assistant de l'app) */
  how: string;
  auto: string[];
  email: string[];
}

export const PLATFORM_FITS: readonly PlatformFit[] = [
  {
    id: "wordpress",
    label: "WordPress (WooCommerce compris)",
    connectable: true,
    how: "Un mot de passe d'application, créé en 1 minute dans votre profil WordPress : l'assistant vous montre où cliquer.",
    auto: ["Titres et descriptions (avec Rank Math, ou Yoast et la petite extension fournie)", "Textes alternatifs des images", "Données structurées issues de votre fiche", "Pages et articles (brouillon, puis en ligne après 72 h)"],
    email: ["robots.txt, llms.txt et redirections : fichiers prêts envoyés par e-mail, à déposer chez votre hébergeur"],
  },
  {
    id: "shopify",
    label: "Shopify",
    connectable: true,
    how: "Vous installez l'accès Repéré depuis votre administration Shopify, en 2 clics.",
    auto: ["Titres et descriptions des produits, pages et articles", "Redirections des pages cassées", "Pages et articles de blog (masqués, puis en ligne après 72 h)"],
    email: ["Textes alternatifs et données structurées : fichiers et marche à suivre par e-mail", "robots.txt et llms.txt : par e-mail tant que Shopify n'ouvre pas l'accès au thème"],
  },
  {
    id: "wix",
    label: "Wix",
    connectable: true,
    how: "Une clé créée dans votre compte Wix (réglages, clés API) : l'assistant vous guide pas à pas.",
    auto: ["Titres et descriptions des pages, articles et produits", "Données structurées issues de votre fiche", "Redirections des pages cassées", "robots.txt et llms.txt", "Articles de blog (brouillon, puis en ligne après 72 h)"],
    email: ["Textes alternatifs et pages statiques : marche à suivre pas à pas dans l'éditeur Wix"],
  },
  {
    id: "webflow",
    label: "Webflow",
    connectable: true,
    how: "Un jeton de site créé dans les réglages Webflow : l'assistant vous montre où.",
    auto: ["Titres et descriptions des pages", "Articles de votre CMS (brouillon, puis en ligne après 72 h)"],
    email: ["Le reste (textes alternatifs, données structurées, fichiers) : par e-mail, à déposer dans Webflow"],
  },
  {
    id: "prestashop",
    label: "PrestaShop",
    connectable: true,
    how: "Une clé de service web limitée aux produits, catégories et pages : l'assistant indique les cases à cocher.",
    auto: ["Titres et descriptions des produits, catégories et pages", "Pages CMS (désactivées, puis en ligne après 72 h)"],
    email: ["Le reste (textes alternatifs, données structurées, fichiers) : par e-mail"],
  },
  {
    id: "magento",
    label: "Magento / Adobe Commerce",
    connectable: true,
    how: "Un jeton d'intégration créé dans votre administration : l'assistant vous guide.",
    auto: ["Titres et descriptions des produits et catégories", "Textes alternatifs des images"],
    email: ["Pages, articles, données structurées et fichiers : préparés et envoyés par e-mail"],
  },
  {
    id: "autre",
    label: "Autre outil, site fait sur mesure, ou je ne sais pas",
    connectable: false,
    how: "Sans connexion, rien ne peut être appliqué automatiquement sur votre site.",
    auto: [],
    email: ["Toutes les corrections et tous les contenus, prêts à déposer, envoyés par e-mail (à vous ou à votre prestataire)"],
  },
];

export function platformFit(id: string | null | undefined): PlatformFit | undefined {
  return PLATFORM_FITS.find((p) => p.id === id);
}
