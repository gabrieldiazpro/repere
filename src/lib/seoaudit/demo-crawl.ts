/**
 * Explorations de DÉMONSTRATION (`SiteCrawl`) des 3 comptes démo — fichier de données ajouté par APP-SEO (V5 vague B).
 *
 * Sites FICTIFS (Plomberie Martin, Paysia, Maison Sora), cohérents avec src/lib/demo-v2.ts (nom, ville, fiche de vérité)
 * et avec les mots-clés démo de src/lib/seodata/demo.ts (mêmes pages). Le HTML est construit ici puis passé à
 * l'extracteur réel de CRAWL (`extractPage`), pour que SEO-AUDIT et GEO-OPT tournent pour de vrai sur ces pages.
 *
 * `stage` : 0 = il y a 12 semaines … 3 = aujourd'hui. Les anciennes étapes portent des défauts corrigés depuis (et une
 * régression récente), ce qui donne une évolution et un « ce qui a changé » crédibles. Toujours étiqueté démo à l'écran.
 * Jamais utilisé pour un vrai compte.
 */
import type { DemoId } from '@/lib/demo-v2';
import { buildDemoWorkspace, segmentForDemoId } from '@/lib/demo-v2';
import { extractPage, hasNoindex } from '@/lib/crawl/extract';
import { normalizeUrl } from '@/lib/crawl/url';
import type { CrawledPage, SiteCrawl } from '@/lib/crawl/types';

export const DEMO_CRAWL_NOTE = 'Exploration de démonstration : site fictif construit pour illustrer le produit, aucune donnée réelle.';
/** Nombre d'étapes d'historique (une toutes les 4 semaines). */
export const DEMO_CRAWL_STAGES = 4;
export const DEMO_STAGE_WEEKS = 4;

type Img = { src: string; alt?: string; w?: number; h?: number; lazy?: boolean; bytes?: number };
interface Spec {
  path: string;
  title?: string;
  desc?: string;
  /** null : pas de H1 */
  h1?: string | null;
  h1b?: string;
  sections?: [string, string][];
  jsonLd?: unknown[];
  images?: Img[];
  status?: number;
  redirectTo?: string;
  hops?: number;
  inSitemap?: boolean;
  /** liens ajoutés dans le contenu : [chemin ou URL, ancre] */
  links?: [string, string][];
  head?: string;
  noindex?: boolean;
  canonical?: string;
  bytes?: number;
  fetchMs?: number;
  spa?: boolean;
  scripts?: number;
  /** date de mise à jour visible */
  updated?: string;
  /** contenu volontairement maigre (pas de paragraphe de rassurance) */
  thin?: boolean;
}
interface SiteDef {
  origin: string;
  name: string;
  nav: [string, string][];
  footer: string;
  robots: string;
  pages: Spec[];
  og?: boolean;
  /** paragraphe propre au site ajouté aux pages de contenu (rassurance), paramétré par le H1 */
  blurb?: (h1: string) => string;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const ld = (o: unknown) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`;
const p = (...xs: string[]) => xs.map((x) => `<p>${x}</p>`).join('');

function factsOf(id: DemoId): Record<string, string> {
  const f = buildDemoWorkspace(segmentForDemoId(id)).facts.facts as Record<string, string>;
  return f;
}

// ---------------------------------------------------------------------------
// Plomberie Martin (commerce local, Paris 11e)
// ---------------------------------------------------------------------------

function local(stage: number): SiteDef {
  const f = factsOf('demo');
  const origin = 'https://plomberie-martin.fr';
  const tel = f.telephone ?? '01 43 55 12 34';
  const adr = f.adresse ?? '42 rue Oberkampf, 75011 Paris';
  const hours = f.horaires ?? 'Du lundi au vendredi 8 h – 19 h, samedi 9 h – 13 h';
  const since = f.creation ?? '2012';
  const telHref = `tel:+33${tel.replace(/\D/g, '').slice(1)}`;
  const lb = {
    '@context': 'https://schema.org',
    '@type': 'Plumber',
    name: 'Plomberie Martin',
    url: `${origin}/`,
    telephone: tel,
    address: { '@type': 'PostalAddress', streetAddress: adr.split(',')[0], postalCode: '75011', addressLocality: 'Paris', addressCountry: 'FR' },
    openingHours: ['Mo-Fr 08:00-19:00', 'Sa 09:00-13:00'],
    areaServed: ['Paris 11e', 'Paris 10e', 'Paris 20e', 'Paris 3e'],
    ...(stage >= 2 ? { sameAs: ['https://www.facebook.com/plomberie-martin-demo', 'https://www.pagesjaunes.fr/demo/plomberie-martin'] } : {}),
  };
  const svc = (path: string, kw: string, title: string, h1: string, a: string, b: string, c: string, extra: Partial<Spec> = {}): Spec => ({
    path,
    title,
    desc: `${h1} à Paris 11e par Plomberie Martin : devis gratuit, intervention rapide, artisan déclaré depuis ${since}. Appelez le ${tel}.`,
    h1,
    sections: [
      [`${kw.charAt(0).toUpperCase()}${kw.slice(1)} : comment nous intervenons`, p(a)],
      ['Combien ça coûte ?', p(b)],
      ['Délais et zone d’intervention', p(c)],
    ],
    images: [{ src: `/img/${path.slice(1)}-chantier.webp`, alt: `${h1} par un plombier de Plomberie Martin`, w: 1200, h: 800, lazy: true, bytes: 92_000 }],
    jsonLd: stage >= 1 ? [{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Accueil', item: `${origin}/` }, { '@type': 'ListItem', position: 2, name: h1, item: `${origin}${path}` }] }] : [],
    updated: '2026-09-18',
    ...extra,
  });
  const pages: Spec[] = [
    {
      path: '/',
      title: 'Plombier Paris 11 – Plomberie Martin, dépannage et installation',
      desc: stage >= 3 ? `Plombier dans le 11e arrondissement de Paris depuis ${since} : fuites, débouchage, chauffe-eau, salles de bain. Devis gratuit, intervention en moins de 2 h. ${tel}.` : undefined,
      h1: 'Votre plombier dans le 11e arrondissement de Paris',
      sections: [
        ['Dépannage et installation, du lundi au samedi', p(`Plomberie Martin est une entreprise artisanale installée au ${adr} depuis ${since}. Nous intervenons pour les particuliers, les syndics et les commerces du 11e et des arrondissements voisins : recherche de fuite, débouchage, remplacement de chauffe-eau, rénovation de salle de bain.`, `En 2025, nous avons réalisé 1 140 interventions, dont 38 % en urgence. Notre délai moyen d’arrivée en journée est de 1 h 40.`)],
        ['Des prix annoncés avant de commencer', p('Chaque intervention commence par un diagnostic et un devis écrit. Le déplacement dans Paris 11e est facturé 39 € TTC et déduit si vous acceptez le devis. Aucune majoration le samedi matin.')],
        ['Horaires et contact', p(`${hours}. Pour une urgence (fuite, dégât des eaux), appelez le <a href="${telHref}">${tel}</a> : un plombier vous rappelle en moins de 15 minutes.`)],
      ],
      jsonLd: [lb],
      images: [
        { src: '/img/equipe-plomberie-martin.webp', alt: 'L’équipe de Plomberie Martin devant la camionnette', w: 1600, h: 900, bytes: 140_000 },
        { src: '/img/IMG_2041.jpg', ...(stage >= 3 ? { alt: 'Chauffe-eau thermodynamique installé dans une cave du 11e' } : {}), w: 1200, h: 900, lazy: true, bytes: 680_000 },
      ],
      links: [['/avis', 'Lire les avis de nos clients'], ['/tarifs', 'Voir nos tarifs'], ...(stage >= 2 ? ([['https://g.page/plomberie-martin-demo', 'Notre fiche Google']] as [string, string][]) : [])],
      updated: '2026-10-28',
    },
    svc('/urgence', 'plombier en urgence', stage >= 3 ? 'Plombier urgence Paris 11 – intervention en moins de 2 h | Plomberie Martin' : 'Plomberie Martin', 'Plombier en urgence à Paris 11e',
      'Fuite sous un évier, canalisation bouchée, chauffe-eau qui fuit : nous coupons d’abord l’eau et sécurisons l’installation, puis nous réparons. Le plombier arrive avec les pièces courantes dans sa camionnette, ce qui permet de régler 8 urgences sur 10 en une seule visite.',
      'Le déplacement en urgence coûte 69 € TTC en journée et 119 € TTC après 19 h. La main-d’œuvre est facturée 58 € TTC de l’heure. Le devis est signé avant toute réparation, même en urgence.',
      'Nous intervenons dans le 11e, le 10e, le 20e et le 3e arrondissement. Délai moyen d’arrivée constaté en 2025 : 1 h 40 en journée, 2 h 15 le soir.'),
    svc('/recherche-de-fuite', 'recherche de fuite', 'Recherche de fuite Paris – détection sans casse | Plomberie Martin', 'Recherche de fuite sans casse à Paris',
      'Nous localisons les fuites encastrées avec une caméra thermique, un gaz traceur et un corrélateur acoustique. Dans la plupart des cas, la fuite est trouvée sans ouvrir de mur ni de sol, et vous recevez un rapport avec photos pour votre assurance.',
      'Une recherche de fuite non destructive coûte entre 290 € et 450 € TTC selon la surface et l’accès. Le rapport est accepté par les principaux assureurs habitation dans le cadre de la convention IRSI.',
      'Intervention sous 48 h dans Paris intra-muros, sous 24 h en cas de dégât des eaux actif chez un voisin.', { links: [['/urgence', 'plombier en urgence']] }),
    svc('/chauffe-eau', 'remplacement de chauffe-eau', 'Remplacement chauffe-eau Paris 11 | Plomberie Martin', 'Remplacement de chauffe-eau à Paris',
      'Nous remplaçons les chauffe-eau électriques, thermodynamiques et les chaudières murales à production d’eau chaude. La pose comprend la vidange, l’évacuation de l’ancien appareil, le groupe de sécurité neuf et la mise en service.',
      'Comptez de 890 € à 1 450 € TTC pour un chauffe-eau électrique de 150 à 200 litres posé, et à partir de 2 600 € TTC pour un modèle thermodynamique, avant aides éventuelles.',
      'La pose se fait en une demi-journée. Nous reprenons l’ancien appareil et le déposons en filière de recyclage.'),
    svc('/debouchage', 'débouchage de canalisation', 'Débouchage canalisation Paris 11 | Plomberie Martin', 'Débouchage de canalisation à Paris 11e',
      'Évier, douche, WC ou colonne d’immeuble : nous utilisons un furet électrique et, pour les colonnes, un hydrocureur. Nous vérifions ensuite l’écoulement à la caméra pour éviter que le bouchon ne revienne.',
      'Un débouchage simple coûte 120 € TTC, déplacement compris dans le 11e. L’hydrocurage d’une colonne commence à 380 € TTC.',
      'Intervention le jour même pour les appels reçus avant 15 h.'),
    svc('/salle-de-bain', 'rénovation de salle de bain', 'Plomberie Martin', 'Rénovation de salle de bain', 'Nous rénovons les salles de bain des appartements anciens du quartier.', 'Sur devis.', 'Dans Paris 11e.', {
      thin: true,
      desc: stage >= 3 ? 'Rénovation de salle de bain à Paris 11e : plomberie, douche à l’italienne, meubles. Devis gratuit sous 72 h par Plomberie Martin.' : undefined,
    }),
    {
      path: '/tarifs',
      title: 'Tarifs plombier Paris 11 – prix des interventions | Plomberie Martin',
      desc: 'Nos prix TTC : déplacement, main-d’œuvre, débouchage, recherche de fuite, chauffe-eau. Devis écrit avant chaque intervention.',
      h1: stage >= 1 ? 'Nos tarifs' : null,
      sections: [
        ['Déplacement et main-d’œuvre', p('Déplacement dans le 11e : 39 € TTC en journée, 69 € TTC en urgence, 119 € TTC après 19 h. Main-d’œuvre : 58 € TTC de l’heure, décomptée par quart d’heure après la première heure.')],
        ['Interventions courantes', p('Débouchage simple : 120 € TTC. Recherche de fuite non destructive : de 290 € à 450 € TTC. Remplacement de chauffe-eau électrique posé : de 890 € à 1 450 € TTC. Remplacement de mécanisme de WC : 140 € TTC.')],
        ['Ce qui est toujours inclus', p('Le diagnostic, le devis écrit, la garantie de 2 ans sur la main-d’œuvre et le nettoyage du chantier. Prix en vigueur au 1er septembre 2026.')],
      ],
      updated: '2026-09-01',
    },
    {
      path: '/zone-intervention',
      title: 'Zone d’intervention – Paris 11, 10, 20 et 3 | Plomberie Martin',
      desc: 'Plomberie Martin intervient dans les 11e, 10e, 20e et 3e arrondissements de Paris : quartiers, délais et frais de déplacement.',
      h1: 'Où intervenons-nous ?',
      sections: [
        ['Les arrondissements couverts', p('Notre atelier est rue Oberkampf. Nous couvrons le 11e en priorité (Oberkampf, Bastille, Voltaire, Charonne, Belleville), puis le 10e, le 20e et le 3e arrondissement.')],
        ['Délais selon le quartier', p('Dans le 11e, le délai moyen d’arrivée est de 1 h 20. Dans les arrondissements voisins, comptez 2 h en journée. Au-delà, nous vous orientons vers un confrère.')],
        ['Frais de déplacement', p('Le déplacement coûte 39 € TTC dans le 11e et 49 € TTC dans les arrondissements voisins ; il est déduit de la facture si vous acceptez le devis.')],
      ],
    },
    {
      path: '/avis',
      title: 'Avis clients – Plomberie Martin, plombier Paris 11',
      desc: 'Ce que disent nos clients du 11e : délais, propreté, respect des devis. Avis vérifiés recueillis après intervention.',
      h1: 'Avis de nos clients',
      sections: [
        ['Note moyenne', p('Nos clients nous attribuent une note moyenne de 4,8 sur 5 sur 212 avis recueillis depuis 2019 sur notre fiche Google.')],
        ['Ce qui revient le plus', p('La ponctualité, la propreté du chantier et le respect du devis reviennent dans la majorité des avis. Les délais en période de froid sont la principale critique, que nous traitons en gardant un plombier d’astreinte de novembre à février.')],
      ],
      ...(stage < 2 ? { jsonLd: [{ '@context': 'https://schema.org', '@type': 'LocalBusiness', name: 'Plomberie Martin', aggregateRating: { '@type': 'AggregateRating', ratingValue: 4.8, reviewCount: 212 } }] } : {}),
    },
    {
      path: '/contact',
      title: 'Contact – Plomberie Martin, 11e arrondissement',
      desc: `Appelez le ${tel} ou écrivez-nous : réponse sous 2 h ouvrées. ${adr}.`,
      h1: 'Nous contacter',
      sections: [['Coordonnées', p(`${adr}. Téléphone : <a href="${telHref}">${tel}</a>. ${hours}.`)]],
    },
    {
      path: '/a-propos',
      title: 'Qui sommes-nous ? – Plomberie Martin',
      desc: `Entreprise artisanale fondée en ${since} : trois plombiers qualifiés, un atelier rue Oberkampf.`,
      h1: 'Une entreprise artisanale du 11e',
      sections: [
        ['Notre histoire', p(`${f.dirigeant ?? 'Le fondateur'} a fondé Plomberie Martin en ${since} après quinze ans comme compagnon plombier. L’entreprise compte aujourd’hui trois plombiers salariés et une assistante.`)],
        ['Nos qualifications', p('Qualification RGE pour les chauffe-eau thermodynamiques, assurance décennale et responsabilité civile professionnelle. Attestations disponibles sur demande.')],
      ],
    },
    {
      path: '/blog/entretien-chaudiere',
      title: 'Entretien de chaudière : obligatoire chaque année ? | Plomberie Martin',
      desc: 'L’entretien annuel d’une chaudière gaz est obligatoire depuis 2009 : ce que vérifie le technicien, le prix et l’attestation.',
      h1: 'Entretien annuel de chaudière : ce qu’il faut savoir',
      sections: [
        ['Une obligation légale', p('Le décret du 9 juin 2009 impose l’entretien annuel des chaudières dont la puissance est comprise entre 4 et 400 kW. Le technicien remet une attestation dans les 15 jours.')],
        ['Ce que nous vérifions', p('Nettoyage du corps de chauffe et du brûleur, contrôle des organes de sécurité, mesure du monoxyde de carbone et réglage de la combustion. Prix : 129 € TTC dans le 11e.')],
      ],
      inSitemap: true,
      updated: '2024-02-12',
    },
    { path: '/blog/fuite-chasse-eau', title: 'Chasse d’eau qui fuit : 3 causes | Plomberie Martin', desc: 'Joint, flotteur ou mécanisme : comment savoir ce qui fuit et quand appeler un plombier.', h1: 'Chasse d’eau qui fuit : les 3 causes', sections: [['Les causes', p('Un joint usé, un flotteur mal réglé ou un mécanisme entartré. Une chasse d’eau qui coule en continu peut consommer jusqu’à 600 litres par jour.')]], updated: '2023-11-02' },
    { path: '/devis', title: 'Demande de devis plombier | Plomberie Martin', desc: 'Décrivez votre besoin : devis gratuit sous 24 h ouvrées.', h1: 'Demander un devis', sections: [['Votre demande', p('Décrivez votre besoin, ajoutez une photo si possible : nous vous répondons sous 24 h ouvrées avec un devis ou une proposition de visite.')]], noindex: true, inSitemap: false },
    { path: '/mentions-legales', title: 'Mentions légales – Plomberie Martin', desc: 'Mentions légales du site plomberie-martin.fr.', h1: 'Mentions légales', sections: [['Éditeur', p(`Plomberie Martin, ${adr}. Directeur de la publication : ${f.dirigeant ?? 'le gérant'}.`)]] },
    { path: '/confidentialite', title: 'Politique de confidentialité – Plomberie Martin', desc: 'Données collectées par le formulaire de devis et leur durée de conservation.', h1: 'Politique de confidentialité', sections: [['Données collectées', p('Nom, téléphone et description du besoin, conservés 3 ans.')]] },
    // Défauts : ancienne page qui redirige (chaîne), lien cassé.
    { path: '/plombier-paris-11.html', redirectTo: '/', hops: stage >= 2 ? 1 : 2, inSitemap: stage < 3 },
    { path: '/promo-hiver-2024', status: 404 },
  ];
  // Lien cassé présent depuis le début ; la page « promo » a été retirée du menu à l'étape 3 mais reste liée depuis le blog.
  pages.find((x) => x.path === '/blog/fuite-chasse-eau')!.links = [['/promo-hiver-2024', 'notre offre hiver'], ['/plombier-paris-11.html', 'plombier Paris 11']];
  return {
    origin,
    name: 'Plomberie Martin',
    nav: [['/', 'Accueil'], ['/urgence', 'Urgence'], ['/recherche-de-fuite', 'Recherche de fuite'], ['/chauffe-eau', 'Chauffe-eau'], ['/debouchage', 'Débouchage'], ['/salle-de-bain', 'Salle de bain'], ['/tarifs', 'Tarifs'], ['/zone-intervention', 'Zone'], ['/a-propos', 'Qui sommes-nous'], ['/contact', 'Contact']],
    footer: `<footer><p>Plomberie Martin, ${adr}</p><p>Téléphone : <a href="${telHref}">${tel}</a> · ${hours}</p><a href="/avis">Avis</a> <a href="/blog/fuite-chasse-eau">Conseils</a> <a href="/mentions-legales">Mentions légales</a> <a href="/confidentialite">Confidentialité</a></footer>`,
    robots: `User-agent: *\nDisallow: /devis\n\nSitemap: ${origin}/sitemap.xml\n`,
    pages,
    blurb: (h1) =>
      `Pour « ${h1.toLowerCase()} », vous avez affaire à des plombiers salariés de l’entreprise, formés et couverts par notre assurance décennale. Le même interlocuteur suit votre dossier du devis à la facture, et l’atelier reste joignable après l’intervention : une question sur la garantie, un réglage à reprendre ou un conseil d’entretien, il suffit d’appeler. Nos devis détaillent séparément les pièces, la main-d’œuvre et le déplacement.`,
  };
}

// ---------------------------------------------------------------------------
// Paysia (PME B2B, logiciel de paie)
// ---------------------------------------------------------------------------

function pme(stage: number): SiteDef {
  const f = factsOf('demo-pme');
  const origin = 'https://paysia.fr';
  const prix = f.prix ?? 'À partir de 12 € HT par utilisateur et par mois';
  const org = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Paysia',
    url: `${origin}/`,
    logo: `${origin}/logo.png`,
    address: { '@type': 'PostalAddress', streetAddress: (f.adresse ?? '18 rue de la Chaussée-d’Antin, 75009 Paris').split(',')[0], postalCode: '75009', addressLocality: 'Paris', addressCountry: 'FR' },
    ...(stage >= 2 ? { sameAs: ['https://www.linkedin.com/company/paysia-demo'] } : {}),
  };
  const sw = { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Paysia', applicationCategory: 'BusinessApplication', operatingSystem: 'Web', offers: { '@type': 'Offer', price: '12', priceCurrency: 'EUR' } };
  const page = (path: string, title: string, h1: string, desc: string, secs: [string, string][], extra: Partial<Spec> = {}): Spec => ({ path, title, h1, desc, sections: secs, updated: '2026-10-06', images: [{ src: `/img/${path.slice(1).replace(/\//g, '-') || 'accueil'}.webp`, alt: `Capture d’écran Paysia : ${h1}`, w: 1440, h: 900, lazy: true, bytes: 120_000 }], ...extra });
  const pages: Spec[] = [
    page('/', 'Paysia – logiciel de paie en ligne pour les PME', 'Le logiciel de paie des PME de 10 à 250 salariés', 'Paysia calcule vos bulletins, envoie la DSN et gère les absences. Pour les PME de 10 à 250 salariés. Essai gratuit 30 jours.', [
      ['Vos bulletins, la DSN et les absences au même endroit', p('Paysia est un logiciel de paie en ligne conçu pour les PME françaises de 10 à 250 salariés. Il calcule les bulletins à partir des conventions collectives, prépare et envoie la DSN mensuelle, et suit les congés et absences de vos équipes.', 'En 2025, 640 entreprises ont édité 1,9 million de bulletins avec Paysia. Le taux de DSN rejetées est de 0,4 %, contre une moyenne nationale proche de 2 % selon net-entreprises.')],
      ['Combien coûte Paysia ?', p(`${prix}, sans engagement. La reprise de vos données et la paramétrisation de la convention collective sont incluses dans les offres annuelles.`)],
      ['Pour qui ?', p('Les responsables RH et gestionnaires de paie des PME, les experts-comptables qui gèrent la paie de leurs clients, et les dirigeants qui veulent internaliser la paie sans recruter.')],
    ], { jsonLd: [org, sw], links: [['/demo', 'Demander une démonstration'], ['/clients', 'Nos clients']] }),
    page('/logiciel-paie-pme', 'Logiciel de paie PME : bulletins, DSN, absences | Paysia', 'Logiciel de paie pour PME', 'Un logiciel de paie pour PME qui calcule les bulletins selon votre convention collective et envoie la DSN. Démo en 30 min.', [
      ['Ce que fait le logiciel', p('Calcul des bulletins, gestion des 230 conventions collectives les plus courantes, déclarations sociales nominatives, exports comptables vers les principaux logiciels de comptabilité, coffre-fort numérique pour les salariés.')],
      ['Combien de temps pour démarrer ?', p('Trois semaines en moyenne entre la signature et la première paie, reprise des cumuls de l’année comprise. Un chef de projet vous accompagne jusqu’à la deuxième paie.')],
      ['Sécurité des données', p('Données hébergées en France chez un hébergeur certifié HDS et ISO 27001, chiffrement au repos, double authentification obligatoire pour les gestionnaires.')],
    ], { links: [['/comparatif', 'comparer les logiciels de paie'], ['/dsn', 'la DSN automatique']] }),
    page('/dsn', 'DSN automatique : logiciel DSN pour PME | Paysia', 'La DSN envoyée automatiquement chaque mois', 'Paysia prépare, contrôle et envoie votre DSN mensuelle et vos DSN événementielles. 0,4 % de rejets en 2025.', [
      ['Comment fonctionne l’envoi ?', p('La DSN est générée à partir des bulletins validés, contrôlée avec l’outil DSN-Val, puis déposée sur net-entreprises. Vous recevez les comptes rendus métier dans Paysia.')],
      ['DSN événementielles', p('Arrêts de travail, fins de contrat et reprises sont déclarés en quelques clics, dans les 5 jours prévus par la réglementation.')],
    ]),
    page('/absences', 'Gestion des absences et congés des salariés | Paysia', 'Gestion des absences des salariés', 'Demandes de congés, validation par le manager, compteurs à jour et report automatique en paie.', [
      ['Demandes et validation', p('Le salarié pose sa demande depuis son téléphone, le manager valide, la paie est mise à jour sans ressaisie. Les compteurs de congés payés et de RTT sont recalculés chaque nuit.')],
      ['Arrêts maladie', p('Les arrêts sont reçus et intégrés à la DSN événementielle ; les indemnités journalières sont subrogées si vous le choisissez.')],
    ]),
    page('/comparatif', 'Comparatif logiciel de paie 2026 | Paysia', 'Comparatif des logiciels de paie', 'Comparatif des logiciels de paie pour PME en 2026 : fonctions, prix et accompagnement.', [], { spa: stage < 3, sections: stage >= 3 ? [['Comment nous comparons', p('Nous comparons les logiciels de paie sur 12 critères publics : conventions collectives couvertes, DSN, absences, exports comptables, hébergement, prix public et durée de mise en place. Tableau mis à jour en octobre 2026.')], ['Les critères qui comptent pour une PME', p('Pour une PME de 10 à 250 salariés, la couverture de la convention collective et l’accompagnement à la mise en place pèsent plus que le nombre de fonctions.')]] : [] }),
    page('/tarifs', 'Tarifs Paysia – prix du logiciel de paie', 'Tarifs', `${prix}. Sans engagement, reprise de données incluse dans l’offre annuelle.`, [
      ['Nos offres', p(`${prix}. Offre Essentielle : bulletins et DSN. Offre Complète : absences, notes de frais et coffre-fort salarié en plus.`)],
      ['Ce qui est inclus', p('Mises à jour légales, support par téléphone et par messagerie du lundi au vendredi de 9 h à 18 h, formation de deux gestionnaires.')],
    ]),
    page('/blog/externaliser-paie', 'Externaliser la paie : avantages, coût et alternatives', 'Externaliser la paie ou l’internaliser ?', 'Coût d’un cabinet, risques, et quand un logiciel de paie devient plus rentable que l’externalisation.', [
      ['Combien coûte l’externalisation ?', p('Un cabinet facture en général entre 20 € et 45 € HT par bulletin selon la complexité. Pour 50 salariés, cela représente de 12 000 € à 27 000 € HT par an.')],
      ['Quand internaliser ?', p('Au-delà de 30 salariés, une PME qui dispose d’un gestionnaire RH internalise souvent la paie avec un logiciel pour réduire les coûts et les délais de correction.')],
    ], { updated: '2025-03-14', jsonLd: stage >= 1 ? [{ '@context': 'https://schema.org', '@type': 'Article', headline: 'Externaliser la paie ou l’internaliser ?', datePublished: '2025-03-14', author: { '@type': 'Person', name: 'Équipe paie Paysia' } }] : [] }),
    page('/blog/bulletin-de-paie', 'Bulletin de paie 2026 : ce qui change', 'Bulletin de paie 2026 : ce qui change au 1er janvier', 'Plafond de la Sécurité sociale, taux, mentions obligatoires : les changements du bulletin de paie en 2026.', [
      ['Les nouveaux montants', p('Le plafond mensuel de la Sécurité sociale passe à 4 005 € au 1er janvier 2026. Le SMIC horaire brut est fixé à 11,88 €.')],
      ['Les mentions obligatoires', p('Le bulletin doit afficher le montant net social, le net à payer avant impôt et le taux de prélèvement à la source appliqué.')],
    ], { updated: '2026-01-05' }),
    page('/blog/bulletin-de-paie-2025', 'Bulletin de paie 2026 : ce qui change', 'Bulletin de paie 2025', 'Les changements du bulletin de paie en 2025.', [['Les montants 2025', p('Le plafond mensuel de la Sécurité sociale était de 3 925 € en 2025.')]], { updated: '2025-01-06', inSitemap: true }),
    page('/demo', 'Demander une démo de Paysia', 'Demander une démonstration', 'Une démonstration de 30 minutes avec un expert paie, sur vos cas réels.', [['Comment se passe la démo', p('Un expert paie vous montre Paysia sur des cas proches des vôtres : convention collective, temps partiels, primes. Durée : 30 minutes, en visioconférence.')]]),
    page('/clients', 'Clients Paysia : ils gèrent leur paie avec nous', 'Ils gèrent leur paie avec Paysia', 'Cabinets d’expertise comptable, PME industrielles, réseaux de franchise.', [['Qui utilise Paysia', p('640 entreprises clientes en 2025, dont 70 % de PME de 10 à 50 salariés. Principaux secteurs : services, commerce de gros, industrie légère, hôtellerie-restauration.')]]),
    page('/securite', 'Sécurité et hébergement des données | Paysia', 'Sécurité de vos données', 'Hébergement en France, chiffrement, double authentification, sauvegardes quotidiennes.', [['Hébergement', p('Données hébergées en France, sauvegardées chaque nuit sur deux sites distincts, conservées 6 ans.')]]),
    page('/a-propos', 'À propos de Paysia', 'Qui sommes-nous ?', `Paysia, éditeur français de logiciel de paie fondé en ${f.creation ?? '2016'}.`, [['Notre histoire', p(`Paysia a été fondée en ${f.creation ?? '2016'} à Paris par ${f.dirigeant ?? 'deux anciens gestionnaires de paie'}. L’équipe compte 48 personnes, dont 12 experts paie.`)]]),
    page('/contact', 'Contact – Paysia', 'Nous contacter', 'Écrivez-nous ou appelez le support du lundi au vendredi.', [['Coordonnées', p(`${f.adresse ?? '18 rue de la Chaussée-d’Antin, 75009 Paris'}. Support : du lundi au vendredi, 9 h – 18 h.`)]]),
    page('/mentions-legales', 'Mentions légales – Paysia', 'Mentions légales', 'Mentions légales de paysia.fr.', [['Éditeur', p('Paysia SAS, Paris.')]]),
    page('/confidentialite', 'Politique de confidentialité – Paysia', 'Confidentialité', 'Traitement des données personnelles.', [['Vos données', p('Nous traitons les données de paie en qualité de sous-traitant de nos clients.')]]),
    { path: '/fonctionnalites', redirectTo: '/logiciel-paie-pme', hops: 1, inSitemap: stage < 2 },
    { path: '/en/', title: 'Paysia – payroll software', h1: 'Payroll software for French SMEs', desc: 'Payroll software for French SMEs.', sections: [['Payroll', p('Paysia computes payslips and files the DSN for companies with 10 to 250 employees in France.')]], inSitemap: false, head: '<link rel="alternate" hreflang="fr" href="https://paysia.fr/">' },
  ];
  // Liens profonds : le comparatif et les articles ne sont liés que depuis le blog (profondeur 3+).
  pages.find((x) => x.path === '/blog/externaliser-paie')!.links = [['/blog/bulletin-de-paie', 'Bulletin de paie 2026'], ['/fonctionnalites', 'nos fonctionnalités']];
  pages.find((x) => x.path === '/blog/bulletin-de-paie')!.links = [['/blog/bulletin-de-paie-2025', 'l’édition 2025'], ['/en/', 'English']];
  return {
    origin,
    name: 'Paysia',
    nav: [['/', 'Accueil'], ['/logiciel-paie-pme', 'Logiciel'], ['/dsn', 'DSN'], ['/absences', 'Absences'], ['/tarifs', 'Tarifs'], ['/clients', 'Clients'], ['/blog/externaliser-paie', 'Blog'], ['/demo', 'Démo']],
    footer: `<footer><a href="/a-propos">À propos</a> <a href="/securite">Sécurité</a> <a href="/contact">Contact</a> <a href="/comparatif">Comparatif</a> <a href="/mentions-legales">Mentions légales</a> <a href="/confidentialite">Confidentialité</a></footer>`,
    robots: `User-agent: *\nAllow: /\n${stage < 1 ? 'User-agent: GPTBot\nDisallow: /\n' : ''}\nSitemap: ${origin}/sitemap.xml\n`,
    pages,
    blurb: (h1) =>
      `« ${h1} » fait partie de l’offre Paysia, utilisée par 640 entreprises en 2025. Chaque client dispose d’un chef de projet pendant la mise en place puis d’un support assuré par des experts paie, joignables par téléphone et par messagerie du lundi au vendredi. Les mises à jour légales (taux, plafonds, nouvelles rubriques DSN) sont livrées sans surcoût avant leur date d’entrée en vigueur. Vos données restent hébergées en France, sauvegardées chaque nuit, et vous pouvez les exporter à tout moment au format CSV ou DSN : vous n’êtes jamais captif de l’outil. Un essai gratuit de 30 jours permet de tester la paie de votre entreprise sur vos propres salariés avant de vous engager.`,
  };
}

// ---------------------------------------------------------------------------
// Maison Sora (e-commerce, cosmétiques solides, Lyon)
// ---------------------------------------------------------------------------

function ecom(stage: number): SiteDef {
  const f = factsOf('demo-ecom');
  const origin = 'https://www.maison-sora.fr';
  const liv = f.livraison ?? 'France et Belgique ; offerte dès 39 € ; expédition sous 48 h';
  const org = { '@context': 'https://schema.org', '@type': 'Organization', name: 'Maison Sora', url: `${origin}/`, logo: `${origin}/logo.png`, ...(stage >= 2 ? { sameAs: ['https://www.instagram.com/maisonsora.demo'] } : {}) };
  const products: [string, string, string, number, string][] = [
    ['shampoing-solide-ortie', 'Shampoing solide à l’ortie – cheveux gras', 'Shampoing solide ortie et argile verte pour cheveux gras, 75 g, environ 60 lavages. Fabriqué à Lyon.', 12.9, 'shampoings-solides'],
    ['shampoing-solide-avoine', 'Shampoing solide à l’avoine – cuir chevelu sensible', 'Shampoing solide doux à l’avoine pour cuir chevelu sensible, 75 g, environ 60 lavages.', 12.9, 'shampoings-solides'],
    ['shampoing-solide-rhassoul', 'Shampoing solide au rhassoul – cheveux normaux', 'Shampoing solide au rhassoul, 75 g, environ 60 lavages.', 11.9, 'shampoings-solides'],
    ['apres-shampoing', 'Après-shampoing solide au karité', 'Après-shampoing solide au karité et à l’huile de camélia, 50 g.', 13.9, 'shampoings-solides'],
    ['deodorant-solide-palmarosa', 'Déodorant solide palmarosa', 'Déodorant solide sans sels d’aluminium, palmarosa et bicarbonate, 50 g.', 10.9, 'deodorants'],
    ['deodorant-solide-sans-bicarbonate', 'Déodorant solide sans bicarbonate', 'Déodorant solide sans bicarbonate pour peaux sensibles, 50 g.', 11.9, 'deodorants'],
    ['nettoyant-visage-solide', 'Nettoyant visage solide au charbon', 'Pain nettoyant visage au charbon végétal, 90 g.', 14.9, 'soins-visage'],
    ['baume-visage-solide', 'Baume visage solide nourrissant', 'Baume visage solide au beurre de cacao, 40 g.', 18.9, 'soins-visage'],
    ['coffret-decouverte', 'Coffret découverte zéro déchet', 'Coffret de 4 soins solides : shampoing, après-shampoing, déodorant, nettoyant visage.', 44.9, 'coffrets'],
  ];
  const prod = ([slug, name, desc, price, coll]: (typeof products)[number], i: number): Spec => {
    const noSchema = stage < 3 && (slug === 'apres-shampoing' || slug === 'coffret-decouverte');
    const thin = slug === 'shampoing-solide-rhassoul';
    return {
      path: `/produits/${slug}`,
      title: `${name} | Maison Sora`,
      desc: thin ? 'Shampoing solide au rhassoul.' : `${desc} Livraison offerte dès 39 €.`,
      h1: name,
      thin,
      sections: thin
        ? [['Description', p(desc)]]
        : [
            ['Pourquoi vous allez l’aimer', p(`${desc} Saponifié à froid dans notre atelier lyonnais, sans conservateur ni parfum de synthèse. Un pain remplace en moyenne 2 flacons de 250 ml.`)],
            ['Composition et utilisation', p('Liste complète des ingrédients (INCI) sur l’étiquette et en photo. Faites mousser entre les mains, appliquez, rincez. Laissez sécher le pain sur un porte-savon ajouré entre deux utilisations.')],
            ['Livraison et retours', p(`${liv}. Retour gratuit sous 30 jours si le produit n’a pas été ouvert.`)],
          ],
      links: [[`/collections/${coll}`, 'Voir la collection'], [`/collections/${coll}?sort=prix-croissant`, 'Trier par prix']],
      jsonLd: noSchema ? [] : [{ '@context': 'https://schema.org', '@type': 'Product', name, description: desc, image: `${origin}/img/${slug}.webp`, sku: `SORA-${100 + i}`, brand: { '@type': 'Brand', name: 'Maison Sora' }, offers: { '@type': 'Offer', price: price.toFixed(2), priceCurrency: 'EUR', availability: 'https://schema.org/InStock', url: `${origin}/produits/${slug}` } }],
      images: [{ src: `/img/${slug}.webp`, ...(i % 3 === 2 && stage < 3 ? {} : { alt: name }), w: 1200, h: 1200, bytes: slug === 'coffret-decouverte' ? 910_000 : 110_000 }, { src: `/img/${slug}-texture.jpg`, alt: i % 2 ? '' : `Texture du ${name.toLowerCase()}`, lazy: true, bytes: 240_000 }],
      head: `<p hidden>${price.toFixed(2).replace('.', ',')} €</p>`,
      updated: '2026-10-15',
    };
  };
  const coll = (slug: string, title: string, h1: string, intro: string, kids: string[], extra: Partial<Spec> = {}): Spec => ({
    path: `/collections/${slug}`,
    title,
    h1,
    desc: `${intro.slice(0, 140)}`,
    sections: [['Notre sélection', p(intro)], ['Comment choisir ?', p('Cheveux gras : préférez l’ortie ou l’argile verte. Cuir chevelu sensible : l’avoine. Cheveux secs : complétez avec un après-shampoing au karité. Chaque fiche indique le type de cheveux ou de peau concerné.')]],
    links: [...kids.map((k) => [`/produits/${k}`, products.find((x) => x[0] === k)?.[1] ?? k] as [string, string]), [`/collections/${slug}?sort=prix-croissant`, 'Prix croissant'], [`/collections/${slug}?page=2`, 'Page 2']],
    updated: '2026-10-15',
    ...extra,
  });
  const pages: Spec[] = [
    {
      path: '/',
      title: 'Maison Sora – cosmétiques solides zéro déchet fabriqués à Lyon',
      desc: `Shampoings, déodorants et soins visage solides, saponifiés à froid dans notre atelier lyonnais. ${liv}.`,
      h1: 'Cosmétiques solides fabriqués à Lyon',
      sections: [
        ['Des soins sans flacon, fabriqués à la main', p('Maison Sora fabrique des cosmétiques solides dans son atelier de la Croix-Rousse depuis 2019 : shampoings, après-shampoings, déodorants et soins du visage. Chaque pain est saponifié à froid, en petites séries de 300 pièces, avec des ingrédients d’origine végétale.', 'Un shampoing solide de 75 g dure environ 60 lavages, soit l’équivalent de 2 flacons de 250 ml. En 2025, nos clients ont évité plus de 180 000 flacons plastiques.')],
        ['Livraison et retours', p(`${liv}. Retours gratuits sous 30 jours.`)],
      ],
      jsonLd: [org, { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Maison Sora', url: `${origin}/` }],
      images: [{ src: '/img/hero-atelier.jpg', alt: 'Pains de shampoing solide en train de sécher à l’atelier', w: 2400, h: 1200, loading: undefined, bytes: stage >= 1 ? 380_000 : 1_400_000 } as Img, { src: '/img/bandeau-promo.png', w: 1200, h: 300, lazy: true, bytes: 520_000 }],
      links: [['/produits/coffret-decouverte', 'Coffret découverte'], ['/collections/shampoings-solides', 'Shampoings solides']],
      updated: '2026-10-30',
      scripts: 24,
      fetchMs: 980,
    },
    coll('shampoings-solides', 'Shampoings solides naturels – Maison Sora', 'Shampoings solides', 'Nos shampoings solides sont saponifiés à froid à Lyon, pour cheveux gras, normaux ou sensibles. Chaque pain de 75 g dure environ 60 lavages et remplace deux flacons.', ['shampoing-solide-ortie', 'shampoing-solide-avoine', 'shampoing-solide-rhassoul', 'apres-shampoing'], { scripts: 22, fetchMs: 1_150 }),
    coll('deodorants', 'Déodorants solides naturels – Maison Sora', 'Déodorants solides', 'Déodorants solides sans sels d’aluminium, avec ou sans bicarbonate, efficaces 24 h selon nos tests d’usage menés sur 40 volontaires.', ['deodorant-solide-palmarosa', 'deodorant-solide-sans-bicarbonate']),
    coll('soins-visage', 'Soins visage solides – Maison Sora', 'Soins visage solides', 'Nettoyants et baumes visage solides, sans eau ajoutée, donc sans conservateur.', ['nettoyant-visage-solide', 'baume-visage-solide']),
    coll('coffrets', 'Coffrets cadeaux zéro déchet – Maison Sora', 'Coffrets', 'Coffrets prêts à offrir, emballés dans du papier recyclé.', ['coffret-decouverte']),
    ...products.map(prod),
    { path: '/collections/shampoings-solides?sort=prix-croissant', title: 'Shampoings solides naturels – Maison Sora', h1: 'Shampoings solides', desc: 'Nos shampoings solides sont saponifiés à froid à Lyon, pour cheveux gras, normaux ou sensibles.', sections: [['Notre sélection', p('Nos shampoings solides triés par prix croissant.')]], inSitemap: false, canonical: stage >= 2 ? '/collections/shampoings-solides' : undefined },
    { path: '/collections/shampoings-solides?page=2', title: 'Shampoings solides naturels – Maison Sora', h1: 'Shampoings solides', desc: 'Page 2.', sections: [['Notre sélection', p('Suite de la collection shampoings solides.')]], inSitemap: false },
    { path: '/pages/notre-atelier', title: 'Notre atelier à Lyon – Maison Sora', h1: 'Notre atelier à la Croix-Rousse', desc: 'Comment nous fabriquons nos cosmétiques solides, en petites séries, à Lyon.', sections: [['Fabrication', p('Nous saponifions à froid et laissons sécher chaque pain 4 semaines. L’atelier emploie 6 personnes et produit environ 9 000 pains par mois.')], ['Nos fournisseurs', p('Huiles et beurres certifiés biologiques, argiles françaises, huiles essentielles de Provence quand c’est possible.')]] },
    { path: '/pages/livraison', title: 'Livraison et retours – Maison Sora', h1: 'Livraison et retours', desc: liv, sections: [['Livraison', p(`${liv}. Point relais à 4,90 €, domicile à 6,90 €.`)], ['Retours', p('Retours gratuits sous 30 jours pour les produits non ouverts.')]] },
    { path: '/pages/cgv', title: 'Conditions générales de vente – Maison Sora', h1: 'Conditions générales de vente', desc: 'CGV de la boutique maison-sora.fr.', sections: [['Objet', p('Les présentes conditions régissent les ventes de la boutique en ligne Maison Sora.')]] },
    { path: '/pages/contact', title: 'Contact – Maison Sora', h1: 'Nous contacter', desc: 'Une question sur un produit ou une commande ?', sections: [['Service client', p('Réponse sous 24 h ouvrées par courriel, du lundi au vendredi.')]] },
    { path: '/pages/mentions-legales', title: 'Mentions légales – Maison Sora', h1: 'Mentions légales', desc: 'Mentions légales.', sections: [['Éditeur', p('Maison Sora SAS, Lyon.')]] },
    { path: '/search?q=shampoing', title: 'Recherche – Maison Sora', h1: 'Résultats de recherche', desc: 'Recherche', sections: [['Résultats', p('4 produits trouvés pour « shampoing ».')]], inSitemap: false },
    { path: '/produits/savon-lavande-2023', status: 404, inSitemap: stage < 3 },
    { path: '/products/shampoing-solide-ortie', redirectTo: '/produits/shampoing-solide-ortie', hops: 1, inSitemap: false },
  ];
  pages.find((x) => x.path === '/pages/notre-atelier')!.links = [['/produits/savon-lavande-2023', 'notre ancien savon lavande'], ['/products/shampoing-solide-ortie', 'shampoing à l’ortie'], ['/search?q=shampoing', 'tous nos shampoings']];
  return {
    origin,
    name: 'Maison Sora',
    nav: [['/', 'Accueil'], ['/collections/shampoings-solides', 'Shampoings'], ['/collections/deodorants', 'Déodorants'], ['/collections/soins-visage', 'Visage'], ['/collections/coffrets', 'Coffrets'], ['/pages/notre-atelier', 'L’atelier']],
    footer: `<footer><a href="/pages/livraison">Livraison et retours</a> <a href="/pages/cgv">CGV</a> <a href="/pages/contact">Contact</a> <a href="/pages/mentions-legales">Mentions légales</a></footer>`,
    robots: `User-agent: *\nDisallow: /cart\nDisallow: /checkout\n\nSitemap: ${origin}/sitemap.xml\n`,
    pages,
    blurb: (h1) =>
      `« ${h1} » est fabriqué dans notre atelier de la Croix-Rousse, à Lyon, en petites séries de 300 pièces. Nos pains solides ne contiennent ni conservateur ni parfum de synthèse et voyagent sans flacon, dans un étui en carton recyclé. Une question sur un ingrédient, une allergie ou le choix d’un soin ? Notre service client vous répond sous 24 h ouvrées. Chaque pain porte un numéro de lot et une date de fabrication, et la liste complète des ingrédients figure sur la fiche produit comme sur l’étui.`,
  };
}

// ---------------------------------------------------------------------------
// Assemblage → SiteCrawl
// ---------------------------------------------------------------------------

function htmlOf(site: SiteDef, s: Spec): string {
  const url = `${site.origin}${s.path}`;
  const canonical = s.canonical ? `${site.origin}${s.canonical}` : url;
  const head = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    s.title ? `<title>${esc(s.title)}</title>` : '',
    s.desc ? `<meta name="description" content="${esc(s.desc)}">` : '',
    `<link rel="canonical" href="${esc(canonical)}">`,
    s.noindex ? '<meta name="robots" content="noindex">' : '',
    s.title ? `<meta property="og:title" content="${esc(s.title)}"><meta property="og:site_name" content="${esc(site.name)}"><meta property="og:image" content="${site.origin}/og.jpg">` : '',
    ...(s.jsonLd ?? []).map(ld),
    ...Array.from({ length: Math.max(0, (s.scripts ?? 3) - 1) }, (_, i) => `<script src="/assets/app-${i}.js" defer></script>`),
    s.head && !s.head.startsWith('<p') ? s.head : '',
  ].join('');
  if (s.spa) return `<!DOCTYPE html><html lang="fr"><head>${head}</head><body><div id="root"></div><script type="module" src="/assets/comparatif.js"></script></body></html>`;
  const nav = `<header><a href="/" aria-label="${esc(site.name)}"><img src="/logo.svg" alt="${esc(site.name)}" width="120" height="32"></a><nav>${site.nav.map(([h, l]) => `<a href="${h}">${esc(l)}</a>`).join(' ')}</nav></header>`;
  const imgs = (s.images ?? []).map((i) => `<img src="${i.src}"${i.alt !== undefined ? ` alt="${esc(i.alt)}"` : ''}${i.w ? ` width="${i.w}"` : ''}${i.h ? ` height="${i.h}"` : ''}${i.lazy ? ' loading="lazy"' : ''}>`).join('');
  const h1 = s.h1 === null ? '' : `<h1>${esc(s.h1 ?? s.title ?? '')}</h1>`;
  const blurb = site.blurb && !s.thin && (s.sections?.length ?? 0) >= 1 && !/mentions|confidentialite|cgv|contact|devis|search|\/en\//.test(s.path) ? `<h2>${esc(site.name)}, en pratique</h2>${p(site.blurb(s.h1 ?? s.title ?? ''))}` : '';
  const secs = (s.sections ?? []).map(([h, body]) => `<h2>${esc(h)}</h2>${body}`).join('') + blurb;
  const links = (s.links ?? []).map(([h, a]) => `<a href="${h}">${esc(a)}</a>`).join(' ');
  const price = s.head?.startsWith('<p') ? s.head.replace(' hidden', '') : '';
  const upd = s.updated ? `<p>Mis à jour le <time datetime="${s.updated}">${new Date(`${s.updated}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}</time></p>` : '';
  return `<!DOCTYPE html><html lang="fr"><head>${head}</head><body>${nav}<main>${h1}${price}${imgs}${secs}${links ? `<p>${links}</p>` : ''}${upd}</main>${site.footer}</body></html>`;
}

const cache = new Map<string, SiteCrawl>();

/** Exploration démo d'un compte démo à une étape d'historique (3 = aujourd'hui). */
export function demoSiteCrawl(id: DemoId, stage: number = DEMO_CRAWL_STAGES - 1, now: Date = new Date()): SiteCrawl {
  const st = Math.max(0, Math.min(DEMO_CRAWL_STAGES - 1, Math.round(stage)));
  const at = new Date(now.getTime() - (DEMO_CRAWL_STAGES - 1 - st) * DEMO_STAGE_WEEKS * 7 * 86_400_000);
  const key = `${id}:${st}:${at.toISOString().slice(0, 10)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const site = id === 'demo' ? local(st) : id === 'demo-pme' ? pme(st) : ecom(st);
  const host = new URL(site.origin).host;
  const abs = (path: string) => normalizeUrl(path, `${site.origin}/`) ?? `${site.origin}${path}`;
  const pages: CrawledPage[] = [];
  const links: SiteCrawl['links'] = [];
  const redirects: NonNullable<SiteCrawl['redirects']> = [];
  const redirectMap = new Map<string, string>();
  for (const s of site.pages) {
    const url = abs(s.path);
    if (s.redirectTo) {
      const to = abs(s.redirectTo);
      const chain = s.hops && s.hops > 1 ? [{ url, status: 301 }, { url: `${url.replace(/\.html$/, '')}/`, status: 302 }] : [{ url, status: 301 }];
      redirects.push({ from: url, to, chain });
      redirectMap.set(url, to);
      continue;
    }
    const status = s.status ?? 200;
    const fetchMs = s.fetchMs ?? Math.round(140 + hash(`${id}:${s.path}`) * 360);
    const headers: Record<string, string> = { 'content-type': 'text/html; charset=utf-8', 'content-encoding': 'br', 'cache-control': 'max-age=600', 'strict-transport-security': 'max-age=31536000' };
    if (status !== 200) {
      const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Page introuvable – ${site.name}</title></head><body><h1>Page introuvable</h1></body></html>`;
      const x = extractPage(html, url);
      const { links: _l, baseUrl: _b, ...fields } = x;
      void _l;
      void _b;
      pages.push({ url, finalUrl: url, status, redirectChain: [], depth: -1, contentType: headers['content-type'], bytes: html.length, fetchMs, headers, ...fields, internalLinks: 0, externalLinks: 0, isIndexable: false });
      continue;
    }
    const html = htmlOf(site, s);
    const x = extractPage(html, url);
    const { links: ls, baseUrl: _b, ...fields } = x;
    void _b;
    let inC = 0;
    let outC = 0;
    for (const l of ls) {
      const internal = (() => {
        try {
          return new URL(l.to).host === host;
        } catch {
          return false;
        }
      })();
      if (internal) inC++;
      else outC++;
      links.push({ from: url, to: l.to, anchor: l.anchor, rel: l.rel, internal });
    }
    const canonicalKey = fields.canonical ? normalizeUrl(fields.canonical) : null;
    pages.push({
      url,
      finalUrl: url,
      status,
      redirectChain: [],
      depth: -1,
      contentType: headers['content-type'],
      bytes: s.bytes ?? html.length * 6,
      fetchMs,
      headers,
      ...fields,
      images: fields.images.map((im) => {
        const spec = (s.images ?? []).find((i) => im.src.endsWith(i.src));
        return spec?.bytes ? { ...im, bytes: spec.bytes } : im;
      }),
      internalLinks: inC,
      externalLinks: outC,
      isIndexable: !hasNoindex(fields.metaRobots, undefined) && (!canonicalKey || canonicalKey === url),
    });
  }
  // Profondeur de clic depuis l'accueil (liens internes suivis, redirections résolues).
  const adj = new Map<string, string[]>();
  for (const l of links) {
    if (!l.internal || l.rel.includes('nofollow')) continue;
    const to = normalizeUrl(l.to) ?? l.to;
    const target = redirectMap.get(to) ?? to;
    const list = adj.get(l.from) ?? [];
    list.push(target);
    adj.set(l.from, list);
  }
  const home = abs('/');
  const depth = new Map<string, number>([[home, 0]]);
  const q = [home];
  for (let i = 0; i < q.length; i++) {
    const d = depth.get(q[i])!;
    const pg = pages.find((x) => x.url === q[i]);
    if (pg && pg.status !== 200) continue;
    for (const n of adj.get(q[i]) ?? []) if (!depth.has(n)) (depth.set(n, d + 1), q.push(n));
  }
  for (const pg of pages) pg.depth = depth.get(pg.url) ?? -1;
  // Pages jamais liées ni déclarées : un vrai robot ne les verrait pas.
  const sitemapUrls = site.pages.filter((s) => s.inSitemap !== false && !(s.status && s.status !== 200 && s.inSitemap === undefined) && !(s.redirectTo && s.inSitemap === undefined)).map((s) => abs(s.path));
  const visible = pages.filter((pg) => pg.depth >= 0 || sitemapUrls.includes(pg.url));
  const kept = new Set(visible.map((pg) => pg.url));
  const crawl: SiteCrawl = {
    startUrl: `${site.origin}/`,
    origin: site.origin,
    finalOrigin: site.origin,
    startedAt: at.toISOString(),
    durationMs: 4_000 + visible.length * 180,
    truncated: false,
    robots: { url: `${site.origin}/robots.txt`, status: 200, text: site.robots, sitemaps: [`${site.origin}/sitemap.xml`] },
    sitemaps: [{ url: `${site.origin}/sitemap.xml`, status: 200, urlCount: sitemapUrls.length, errors: [] }],
    sitemapUrls,
    pages: visible,
    links: links.filter((l) => kept.has(l.from)),
    errors: [],
    redirects,
  };
  cache.set(key, crawl);
  return crawl;
}

/** Date de l'exploration démo d'une étape. */
export function demoStageDate(stage: number, now: Date = new Date()): string {
  return new Date(now.getTime() - (DEMO_CRAWL_STAGES - 1 - stage) * DEMO_STAGE_WEEKS * 7 * 86_400_000).toISOString();
}
