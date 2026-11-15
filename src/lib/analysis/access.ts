/**
 * ROBUSTESSE (V6) — état d'accès de l'analyse et conseils adaptés à la plateforme. Fonctions pures.
 *
 * - `accessReport` : à partir du diagnostic du crawl (src/lib/crawl/diagnose.ts), un état explicite, un titre et un
 *   message en français, la marche à suivre (adaptée à Wix, Shopify, WordPress…) et les signaux secondaires.
 *   Quand le site n'a pas pu être lu, `readable` est faux : l'orchestrateur ne calcule AUCUN score.
 * - `adaptFinding` : ajoute au correctif d'un constat l'endroit exact où le faire sur la plateforme détectée.
 * Rien n'est inventé : une plateforme inconnue donne des conseils génériques.
 */
import type { AccessState, CrawlDiagnosis, Finding, PlatformId, PlatformInfo, SiteCrawl } from '@/lib/crawl/types';
import { isAllowed, parseRobots } from '@/lib/siteaudit/robots';

export type AccessTone = 'ok' | 'info' | 'warn' | 'block';

export interface AccessReport {
  state: AccessState;
  /** du contenu a été lu : les scores ont un sens */
  readable: boolean;
  tone: AccessTone;
  /** phrase-résultat courte */
  title: string;
  /** explication, 1 à 3 phrases */
  message: string;
  /** marche à suivre, étape par étape (peut être vide) */
  howTo: string[];
  /** signaux secondaires, en français */
  notes: string[];
  platform?: { id: PlatformId; name: string; confidence: 'high' | 'medium'; ecommerce?: boolean; plugins?: string[]; evidence: string[]; publishable: boolean };
  /** pages lues / statut de l'accueil (transparence) */
  pagesRead: number;
  homeStatus: number;
}

/** Plateformes sur lesquelles l'agent de Repéré sait publier (src/lib/publish). */
const PUBLISHABLE: PlatformId[] = ['wordpress', 'shopify', 'webflow', 'prestashop', 'wix'];

/* ------------------------------------------------------------------ */
/* Où modifier quoi, par plateforme                                    */
/* ------------------------------------------------------------------ */

type Topic = 'robots' | 'meta' | 'sitemap' | 'schema' | 'redirects' | 'alt' | 'noindex' | 'ai_bots';

const WHERE: Partial<Record<PlatformId, Partial<Record<Topic, string>>>> = {
  wordpress: {
    robots: 'Sur WordPress : avec Yoast SEO, Yoast SEO › Outils › Éditeur de fichiers ; avec Rank Math, Rank Math › Réglages généraux › Modifier robots.txt ; sinon, le fichier robots.txt à la racine du site (FTP).',
    meta: 'Sur WordPress : dans le bloc de votre extension SEO (Yoast SEO, Rank Math…) sous l’éditeur de chaque page.',
    sitemap: 'Sur WordPress : Yoast SEO et Rank Math publient /sitemap_index.xml ; sans extension, WordPress publie /wp-sitemap.xml.',
    schema: 'Sur WordPress : Yoast SEO et Rank Math ajoutent l’organisation (Organization ou LocalBusiness) dans leurs réglages « Apparence dans les moteurs de recherche » / « Titres et méta ».',
    redirects: 'Sur WordPress : l’extension « Redirection » (ou le gestionnaire de redirections de Rank Math / Yoast SEO Premium).',
    alt: 'Sur WordPress : Médias › Médiathèque, champ « Texte alternatif » de chaque image.',
    noindex: 'Sur WordPress : Réglages › Lecture, décochez « Demander aux moteurs de recherche de ne pas indexer ce site ».',
  },
  shopify: {
    robots: 'Sur Shopify : Boutique en ligne › Thèmes › Modifier le code, gabarit robots.txt.liquid (à créer depuis « Ajouter un modèle » s’il n’existe pas).',
    meta: 'Sur Shopify : section « Référencement » (aperçu sur les moteurs de recherche) en bas de chaque produit, collection ou page.',
    sitemap: 'Sur Shopify : /sitemap.xml est généré automatiquement ; soumettez-le dans la Search Console.',
    schema: 'Sur Shopify : les thèmes récents balisent les produits ; pour l’entreprise, ajoutez un bloc JSON-LD Organization dans theme.liquid.',
    redirects: 'Sur Shopify : Boutique en ligne › Navigation › Redirections d’URL.',
    alt: 'Sur Shopify : sur chaque produit, cliquez sur l’image puis « Ajouter un texte alternatif ».',
  },
  wix: {
    robots: 'Sur Wix : tableau de bord › Marketing et SEO › Outils SEO › Éditeur de robots.txt.',
    meta: 'Sur Wix : dans l’éditeur, Pages › (page) › SEO › titre et description.',
    sitemap: 'Sur Wix : /sitemap.xml est généré automatiquement quand le site est publié sur un domaine.',
    schema: 'Sur Wix : paramètres SEO de la page › onglet Avancé › Balisage de données structurées.',
    redirects: 'Sur Wix : Marketing et SEO › Outils SEO › Gestionnaire de redirections d’URL.',
    alt: 'Sur Wix : cliquez sur l’image › Paramètres › Texte alternatif.',
  },
  squarespace: {
    robots: 'Squarespace ne permet pas de modifier le robots.txt ; vérifiez Paramètres › Robots d’exploration (Crawlers) : une option y bloque les robots d’IA.',
    ai_bots: 'Sur Squarespace : Paramètres › Robots d’exploration (Crawlers), option qui bloque les robots d’intelligence artificielle.',
    meta: 'Sur Squarespace : paramètres de la page › SEO.',
    sitemap: 'Sur Squarespace : /sitemap.xml est généré automatiquement.',
    schema: 'Sur Squarespace : Paramètres › Avancé › Injection de code (selon votre offre) pour ajouter un bloc JSON-LD.',
    redirects: 'Sur Squarespace : Paramètres › Outils pour développeurs › Raccourcis d’URL (URL Mappings).',
  },
  webflow: {
    robots: 'Sur Webflow : Paramètres du site › SEO › Indexation, champ robots.txt.',
    meta: 'Sur Webflow : paramètres de la page (roue dentée) › SEO.',
    sitemap: 'Sur Webflow : Paramètres du site › SEO › Sitemap, activez la génération automatique.',
    schema: 'Sur Webflow : paramètres de la page › Code personnalisé, partie <head>, pour un bloc JSON-LD.',
    redirects: 'Sur Webflow : Paramètres du site › Publication › Redirections 301.',
  },
  prestashop: {
    robots: 'Sur PrestaShop : Paramètres de la boutique › Trafic et SEO › « Générer le fichier robots.txt », ou le fichier à la racine (FTP).',
    meta: 'Sur PrestaShop : onglet SEO de chaque produit, catégorie ou page CMS.',
    sitemap: 'Sur PrestaShop : module « Google sitemap » (gsitemap).',
    redirects: 'Sur PrestaShop : un module de redirections 301, ou le fichier .htaccess.',
  },
};

const PLATFORM_JS_FIX: Partial<Record<PlatformId, string>> = {
  nextjs: 'Avec Next.js : rendez ces pages côté serveur ou en statique (rendu serveur par défaut de l’App Router, getStaticProps / getServerSideProps), pas uniquement dans le navigateur.',
  nuxt: 'Avec Nuxt : vérifiez que le rendu serveur est actif (ssr: true) ou générez le site en statique (nuxi generate).',
  gatsby: 'Avec Gatsby : le contenu doit être présent dans le HTML généré au build, pas chargé après coup.',
};

function topicOf(id: string): Topic | null {
  if (/robots|search_blocked|user_blocked/.test(id)) return 'robots';
  if (/\.(title|meta)\./.test(id) || /^seo\.(title|meta)/.test(id)) return 'meta';
  if (/sitemap/.test(id)) return 'sitemap';
  if (/^seo\.sd\.|jsonld|\.entite\.(no_|missing)|schema/.test(id)) return 'schema';
  if (/redirect|broken/.test(id)) return 'redirects';
  if (/img\.alt|alt_missing/.test(id)) return 'alt';
  if (/noindex/.test(id)) return 'noindex';
  if (/training_blocked|ai_blocked/.test(id)) return 'ai_bots';
  return null;
}

/** Endroit précis où agir sur la plateforme (une phrase), ou null si rien de sûr à dire. */
export function platformTip(findingId: string, platform: PlatformInfo | null | undefined): string | null {
  if (!platform) return null;
  const t = topicOf(findingId);
  if (!t) return null;
  const w = WHERE[platform.id];
  return w?.[t] ?? (t === 'ai_bots' ? w?.robots ?? null : null);
}

/**
 * Constat enrichi pour la plateforme détectée : l'endroit où agir est ajouté au correctif, et, si Repéré sait
 * l'appliquer sur cette plateforme, on le dit (sans promesse : après connexion et validation).
 */
export function adaptFinding<T extends Finding>(f: T, platform: PlatformInfo | null | undefined): T {
  const tip = platformTip(f.id, platform);
  const agent = platform && f.autoFix && PUBLISHABLE.includes(platform.id) ? ` Repéré peut l’appliquer pour vous sur ${platform.name}, une fois le site connecté et après votre validation.` : '';
  if (!tip && !agent) return f;
  if (f.fix.includes(tip ?? '\u0000')) return f;
  return { ...f, fix: `${f.fix}${tip ? ` ${tip}` : ''}${agent}`.trim() };
}

/* ------------------------------------------------------------------ */
/* État d'accès                                                        */
/* ------------------------------------------------------------------ */

const AI_BOTS = ['GPTBot', 'OAI-SearchBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended'];

function robotsScope(crawl: SiteCrawl | null): { allBlocked: boolean; googleBlocked: boolean; aiBlocked: string[] } {
  const text = crawl?.robots?.text;
  if (!text) return { allBlocked: false, googleBlocked: false, aiBlocked: [] };
  const parsed = parseRobots(text);
  return {
    allBlocked: !isAllowed(parsed, 'SomeUnknownBot', '/'),
    googleBlocked: !isAllowed(parsed, 'Googlebot', '/'),
    aiBlocked: AI_BOTS.filter((b) => !isAllowed(parsed, b, '/')),
  };
}

const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);

function noteText(code: CrawlDiagnosis['notes'][number]['code'], detail: string | undefined, platform: PlatformInfo | null | undefined): string | null {
  const n = Number(detail ?? 0);
  switch (code) {
    case 'robots_timeout':
      return 'Votre robots.txt a mis plus de 4 secondes à répondre : nous l’avons considéré comme absent. Des robots plus stricts peuvent considérer tout le site comme interdit.';
    case 'robots_unreachable':
      return 'Votre robots.txt est injoignable : nous l’avons considéré comme absent.';
    case 'robots_server_error':
      return `Votre robots.txt répond par une erreur serveur (HTTP ${detail}) : selon la norme, les robots doivent alors considérer tout le site comme interdit. Pour cette analyse ponctuelle, nous avons quand même lu vos pages.`;
    case 'robots_html':
      return 'L’adresse /robots.txt renvoie une page HTML au lieu d’un fichier texte : aucune règle n’y est lue par les robots (ni Google, ni les IA).';
    case 'robots_blocks_some':
      return 'Votre robots.txt interdit certaines sections à notre robot : elles n’ont pas été lues.';
    case 'moved':
      return `Votre adresse redirige vers ${detail} : c’est ce site que nous avons analysé.`;
    case 'js_redirect':
      return `Votre page d’accueil redirige en JavaScript${detail ? ` (vers ${detail})` : ''} : la plupart des robots d’IA ne suivent pas ce type de redirection. Préférez une redirection 301 côté serveur.`;
    case 'meta_refresh':
      return 'Une redirection se fait par balise « meta refresh » : préférez une redirection 301 côté serveur, que tous les robots comprennent.';
    case 'cookie_required':
      return 'Votre site exige un cookie avant d’afficher ses pages (redirection sur lui-même) : Googlebot et les robots d’IA ne conservent pas les cookies d’une page à l’autre et risquent de ne rien voir. Nous avons rejoué la demande avec le cookie pour l’analyse.';
    case 'rate_limited_partial':
      return `Votre serveur a limité nos requêtes (HTTP 429) ${n > 1 ? `${n} fois` : 'une fois'} : nous avons ralenti puis arrêté pour ne pas le surcharger. L’analyse porte sur les pages lues avant.`;
    case 'firewall_partial':
      return `Certaines pages ont été refusées par ${detail ?? 'un pare-feu anti-robots'} : si les robots des IA sont traités de la même façon, ces pages leur sont invisibles.`;
    case 'slow_pages':
      return `${n} ${plural(n, 'page a mis', 'pages ont mis')} plus de 5 secondes à répondre : les robots d’IA, pressés, abandonnent souvent avant.`;
    case 'huge_page':
      return `${n} ${plural(n, 'page dépasse', 'pages dépassent')} 2 Mo de HTML : seule la première partie est analysée (et lue par la plupart des robots).`;
    case 'binary_pages':
      return `${n} ${plural(n, 'adresse renvoie', 'adresses renvoient')} un fichier binaire déclaré comme page HTML : non analysé.`;
    case 'url_traps':
      return `${n} ${plural(n, 'lien ignoré', 'liens ignorés')} : variantes infinies d’une même page (filtres, calendrier, tri, identifiants de session ou liens relatifs récursifs). Une balise canonical et des liens « nofollow » sur ces filtres évitent que les robots s’y perdent.`;
    case 'js_pages':
      return `${n} ${plural(n, 'page n’affiche', 'pages n’affichent')} son contenu qu’avec JavaScript : la plupart des robots d’IA la voient vide.${platform && PLATFORM_JS_FIX[platform.id] ? ` ${PLATFORM_JS_FIX[platform.id]}` : ''}`;
    case 'rendered':
      return `Nous avons aussi ouvert ${n} ${plural(n, 'page', 'pages')} dans un navigateur (exécution de JavaScript) : leurs titres et textes reflètent ce que voit Google.`;
    case 'http_only':
      return 'Votre site répond sans https : les navigateurs l’affichent « non sécurisé » et les moteurs préfèrent les pages en https.';
    default:
      return null;
  }
}

function where(platform: PlatformInfo | null | undefined, t: Topic): string[] {
  const w = platform ? WHERE[platform.id]?.[t] : undefined;
  return w ? [w] : [];
}

/**
 * Rapport d'accès. `crawl` null (exploration impossible) : état déduit de `fallbackError` (message du module).
 */
export function accessReport(crawl: SiteCrawl | null, fallbackError?: string): AccessReport {
  const d: CrawlDiagnosis = crawl?.diagnosis ?? {
    state: crawl && crawl.pages.length ? 'ok' : /délai|timeout/i.test(fallbackError ?? '') ? 'timeout' : /site public|ports? 80|identifiants|http et https/i.test(fallbackError ?? '') ? 'blocked_address' : /domaine introuvable/i.test(fallbackError ?? '') ? 'dns' : 'unreachable',
    readable: !!crawl && crawl.pages.some((p) => p.status === 200),
    pagesRead: crawl ? crawl.pages.filter((p) => p.status === 200).length : 0,
    homeStatus: crawl?.pages[0]?.status ?? 0,
    notes: [],
  };
  const platform = crawl?.platform ?? null;
  const notes = d.notes.map((n) => noteText(n.code, n.detail, platform)).filter((x): x is string => !!x);
  const status = d.homeStatus;
  const retry = d.retryAfterS !== undefined ? (d.retryAfterS >= 120 ? `dans environ ${Math.round(d.retryAfterS / 60)} minutes` : d.retryAfterS > 0 ? `dans ${d.retryAfterS} secondes` : 'plus tard') : 'plus tard';
  let tone: AccessTone = 'ok';
  let title = 'Site lu normalement';
  let message = `Nous avons lu ${d.pagesRead} ${plural(d.pagesRead, 'page', 'pages')} de votre site, en respectant votre robots.txt.`;
  let howTo: string[] = [];
  const rs = robotsScope(crawl);

  switch (d.state) {
    case 'ok':
      tone = notes.length ? 'info' : 'ok';
      break;
    case 'js_only':
      tone = 'warn';
      title = 'Site construit en JavaScript : nous voyons ce que voient la plupart des robots d’IA';
      message =
        'Votre page d’accueil n’affiche son contenu qu’après l’exécution de JavaScript. Google l’exécute (avec un délai), mais la plupart des robots d’IA (GPTBot, ClaudeBot, PerplexityBot…) lisent le HTML brut : ils voient une page presque vide. Les constats ci-dessous décrivent ce HTML brut.';
      howTo = [
        'Faites produire le texte principal par le serveur (rendu serveur, génération statique ou pré-rendu des pages publiques), pas seulement dans le navigateur.',
        ...(platform && PLATFORM_JS_FIX[platform.id] ? [PLATFORM_JS_FIX[platform.id]!] : []),
        'Vérifiez le résultat : affichez le code source de la page (Ctrl+U) ; votre texte doit y apparaître.',
      ];
      break;
    case 'blocked_robots':
      tone = 'block';
      title = 'Le site bloque les robots : voici comment autoriser RepereBot';
      message = rs.allBlocked
        ? `Votre robots.txt interdit tout le site à tous les robots (règle « User-agent: * / Disallow: / »)${rs.googleBlocked ? ', y compris Google' : ''}. Nous respectons ce choix : aucune page n’a été lue et aucun score n’est calculé.`
        : 'Votre robots.txt interdit l’accès à notre robot RepereBot. Nous respectons ce choix : aucune page n’a été lue et aucun score n’est calculé.';
      howTo = [
        'Ajoutez en tête de votre robots.txt les deux lignes « User-agent: RepereBot » puis « Allow: / ».',
        ...(rs.allBlocked ? ['Si ce blocage général n’est pas voulu (site sorti de préproduction, réglage oublié), remplacez « Disallow: / » par « Allow: / » : en l’état, Google et les IA ne peuvent pas lire votre site non plus.'] : []),
        ...where(platform, 'robots'),
        'Relancez ensuite l’analyse.',
      ];
      break;
    case 'blocked_firewall': {
      tone = 'block';
      const fw = d.firewall ?? 'une protection anti-robots';
      title = `Le site bloque les robots : ${fw} a refusé notre robot`;
      message = `Votre site a répondu par une page de vérification anti-robots${status ? ` (HTTP ${status})` : ''} au lieu de son contenu. Si ${fw === 'une protection anti-robots' ? 'cette protection' : fw} traite de la même façon les robots des IA (OAI-SearchBot, PerplexityBot, ClaudeBot…), votre site leur est invisible. Aucun score n’est calculé.`;
      howTo =
        fw === 'Cloudflare'
          ? [
              'Dans votre tableau de bord Cloudflare, rubrique Sécurité › Bots : vérifiez les réglages « Bot Fight Mode » et le blocage des robots d’IA.',
              'Ajoutez une règle de pare-feu (WAF) qui laisse passer l’agent utilisateur contenant « RepereBot », et ceux des IA que vous voulez voir citer votre site.',
              'Relancez ensuite l’analyse.',
            ]
          : [
              `Demandez à votre hébergeur ou à votre prestataire d’autoriser l’agent utilisateur « RepereBot » dans ${fw === 'une protection anti-robots' ? 'la protection anti-robots' : fw}.`,
              'Profitez-en pour vérifier que les robots de Google, de Bing et des IA ne sont pas bloqués non plus.',
              'Relancez ensuite l’analyse.',
            ];
      break;
    }
    case 'rate_limited':
      tone = 'block';
      title = 'Votre serveur a limité nos requêtes';
      message = `Le site a répondu « trop de requêtes » (HTTP 429). Nous nous sommes arrêtés pour ne pas le surcharger. Réessayez ${retry}. Si cela se répète, votre hébergeur limite peut-être aussi les robots de Google et des IA.`;
      howTo = ['Relancez l’analyse un peu plus tard.', 'Si le blocage persiste, demandez à votre hébergeur d’assouplir la limitation pour les robots identifiés (RepereBot, Googlebot, Bingbot, robots des IA).'];
      break;
    case 'auth_required':
      tone = 'block';
      title = 'Le site demande un identifiant et un mot de passe';
      message = `La page d’accueil répond « accès protégé » (HTTP ${status || 401}). Il s’agit peut-être d’une version de test : ni Google ni les IA ne peuvent la lire. Aucun score n’est calculé.`;
      howTo = ['Analysez l’adresse publique de votre site, celle que vos clients utilisent.', 'Si ce site doit être public, retirez la protection par mot de passe chez votre hébergeur.'];
      break;
    case 'password_protected':
      tone = 'block';
      title = 'Votre boutique est protégée par un mot de passe';
      message = 'Toutes les pages redirigent vers la page « mot de passe » de Shopify : tant qu’elle est active, ni Google ni les IA ne voient vos produits. Aucun score n’est calculé.';
      howTo = ['Sur Shopify : Boutique en ligne › Préférences › Protection par mot de passe, désactivez-la quand la boutique est prête.', 'Relancez ensuite l’analyse.'];
      break;
    case 'maintenance':
      tone = 'block';
      title = 'Le site est en maintenance';
      message = `La page d’accueil répond « service indisponible »${status ? ` (HTTP ${status})` : ''}. Réessayez ${retry}. Une maintenance qui dure fait sortir des pages de Google. Aucun score n’est calculé.`;
      howTo = ['Relancez l’analyse quand le site est revenu.'];
      break;
    case 'server_error':
      tone = 'block';
      title = `Le site répond par une erreur serveur (HTTP ${status})`;
      message = 'La page d’accueil renvoie une erreur de votre serveur. Google et les IA voient la même erreur : si elle dure, vos pages sortent des résultats. Aucun score n’est calculé.';
      howTo = ['Prévenez votre hébergeur ou votre prestataire, avec l’heure de cette analyse.', 'Relancez l’analyse une fois le site rétabli.'];
      break;
    case 'http_error':
      tone = 'block';
      title = `La page d’accueil répond « ${status === 404 ? 'page introuvable' : status === 410 ? 'page supprimée' : status === 403 ? 'accès interdit' : 'erreur'} » (HTTP ${status})`;
      message = 'Nous n’avons trouvé aucune page lisible à partir de cette adresse. Vérifiez l’adresse saisie : il manque peut-être une partie (/fr/, www…). Aucun score n’est calculé.';
      howTo = ['Vérifiez l’adresse dans votre navigateur, puis relancez l’analyse avec l’adresse exacte de votre page d’accueil.'];
      break;
    case 'parked':
      tone = 'block';
      title = 'Ce domaine affiche une page de parking';
      message = 'L’adresse affiche une page publicitaire ou « domaine à vendre », pas votre site. Aucun score n’est calculé.';
      howTo = ['Vérifiez l’orthographe du domaine.', 'Si c’est bien le vôtre, reliez-le à votre site chez votre registraire (réglages DNS) ou chez votre plateforme.'];
      break;
    case 'not_html':
      tone = 'block';
      title = 'Cette adresse ne renvoie pas une page web';
      message = 'Le serveur renvoie un fichier (données, document ou binaire) au lieu d’une page HTML. Aucun score n’est calculé.';
      howTo = ['Saisissez l’adresse de la page d’accueil de votre site.'];
      break;
    case 'empty':
      tone = 'block';
      title = 'La page d’accueil est vide';
      message = 'Le serveur renvoie une page sans texte, sans titre et sans lien. Google et les IA n’y trouvent rien. Aucun score n’est calculé.';
      howTo = ['Vérifiez que le site est bien publié et que l’adresse est la bonne.'];
      break;
    case 'redirect_loop':
      tone = 'block';
      title = 'La page d’accueil redirige en boucle';
      message = 'Votre adresse renvoie vers elle-même sans fin. Les navigateurs, Google et les IA abandonnent de la même façon. Aucun score n’est calculé.';
      howTo = ['Vérifiez les règles de redirection (http vers https, avec ou sans www) chez votre hébergeur ou dans votre CMS : deux règles se contredisent souvent.', ...where(platform, 'redirects')];
      break;
    case 'cookie_loop':
      tone = 'block';
      title = 'Le site exige un cookie pour s’afficher';
      message = 'Votre site redirige sur lui-même tant qu’un cookie n’est pas accepté, même en le renvoyant. Googlebot et les robots d’IA, qui ne gardent pas les cookies, ne voient aucune page. Aucun score n’est calculé.';
      howTo = ['Servez vos pages publiques sans condition de cookie (le bandeau de consentement ne doit pas bloquer l’affichage).'];
      break;
    case 'too_many_redirects':
      tone = 'block';
      title = 'Trop de redirections avant la page d’accueil';
      message = 'Votre adresse enchaîne plus de 10 redirections : Google abandonne au-delà. Aucun score n’est calculé.';
      howTo = ['Remplacez la chaîne par une seule redirection 301 vers l’adresse finale.', ...where(platform, 'redirects')];
      break;
    case 'timeout':
      tone = 'block';
      title = 'Le site n’a pas répondu à temps';
      message = 'Votre serveur n’a pas répondu en 8 secondes. Il est peut-être surchargé ou hors service ; les robots d’IA abandonnent souvent plus vite encore. Aucun score n’est calculé.';
      howTo = ['Relancez l’analyse dans quelques minutes.', 'Si la lenteur persiste, parlez-en à votre hébergeur : un site lent est aussi moins bien exploré par Google.'];
      break;
    case 'dns':
      tone = 'block';
      title = 'Nom de domaine introuvable';
      message = 'Ce nom de domaine ne pointe vers aucun serveur. Vérifiez l’orthographe, ou la configuration DNS si le domaine vient d’être créé ou déplacé. Aucun score n’est calculé.';
      howTo = ['Vérifiez l’adresse dans votre navigateur.', 'Si le domaine est récent, la propagation DNS peut prendre jusqu’à 48 heures.'];
      break;
    case 'blocked_address':
      tone = 'block';
      title = 'Cette adresse ne mène pas à un site public';
      message = 'L’adresse (ou une redirection en chemin) pointe vers un réseau privé, un port non standard ou une forme d’adresse refusée : par sécurité, notre robot ne la suit pas. Aucun score n’est calculé.';
      howTo = ['Saisissez l’adresse publique de votre site, en https, sans port ni identifiant.'];
      break;
    case 'unreachable':
    default:
      tone = 'block';
      title = 'Le site est injoignable';
      message = 'Nous n’avons pas pu établir de connexion avec votre serveur (connexion refusée, interrompue ou certificat invalide). Aucun score n’est calculé.';
      howTo = ['Vérifiez que le site s’ouvre dans votre navigateur, en https.', 'Relancez l’analyse dans quelques minutes.'];
      break;
  }
  if (d.state === 'ok' && rs.aiBlocked.length && !notes.length) tone = 'info';
  return {
    state: d.state,
    readable: d.readable && !['blocked_robots', 'blocked_firewall', 'rate_limited', 'auth_required', 'password_protected', 'maintenance', 'server_error', 'http_error', 'parked', 'not_html', 'empty', 'redirect_loop', 'cookie_loop', 'too_many_redirects', 'timeout', 'dns', 'unreachable', 'blocked_address'].includes(d.state),
    tone,
    title,
    message,
    howTo,
    notes,
    ...(platform
      ? {
          platform: {
            id: platform.id,
            name: platform.name,
            confidence: platform.confidence,
            evidence: platform.evidence,
            publishable: PUBLISHABLE.includes(platform.id),
            ...(platform.ecommerce ? { ecommerce: true } : {}),
            ...(platform.plugins?.length ? { plugins: platform.plugins } : {}),
          },
        }
      : {}),
    pagesRead: d.pagesRead,
    homeStatus: status,
  };
}

/** Constat synthétique « accès » (en tête des priorités quand l'accès est dégradé), au format commun `Finding`. */
export function accessFinding(a: AccessReport): Finding | null {
  if (a.state === 'ok') return null;
  return {
    id: `access.${a.state}`,
    category: 'geo.acces',
    severity: a.tone === 'block' ? 'critical' : 'high',
    title: a.title,
    why: a.message,
    fix: a.howTo.join(' ') || 'Relancez l’analyse une fois le problème réglé.',
    affected: [],
    affectedCount: 1,
    impact: 3,
    effort: a.state === 'js_only' ? 3 : 1,
  };
}
