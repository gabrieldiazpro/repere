import { pageMeta } from '@/lib/seo/meta';
import type { LegalSection } from '@/lib/seo/shell';
import { LegalDocument } from '@/components/pages/v4/LegalDocument';
import { LEGAL, LEGAL_ADDRESS, SIREN_DISPLAY, orTodo } from '@/lib/seo/site';

export const metadata = pageMeta({
  path: '/confidentialite',
  title: 'Politique de confidentialité',
  description: "Politique de confidentialité de Repéré : données traitées, finalités, durées, sous-traitants, mesure d'audience IA sans cookie et exercice de vos droits RGPD.",
  // Placeholders [À COMPLÉTER] : noindex (et hors sitemap) tant que le texte n'est pas validé.
  noindex: true,
});

const sections: LegalSection[] = [
  {
    title: '1. Responsable du traitement, sous-traitant : qui est quoi ?',
    paras: [
      `Repéré est édité par la société ${orTodo(LEGAL.name, 'dénomination exacte (NEXT_PUBLIC_LEGAL_NAME)')}, ${orTodo(LEGAL.form, 'forme juridique (NEXT_PUBLIC_LEGAL_FORM)')}, RCS ${orTodo(LEGAL.rcsCity, 'ville (NEXT_PUBLIC_LEGAL_RCS_CITY)')} ${orTodo(SIREN_DISPLAY, 'SIREN (NEXT_PUBLIC_LEGAL_SIREN)')}, siège : ${orTodo(LEGAL_ADDRESS, 'adresse (NEXT_PUBLIC_LEGAL_STREET, NEXT_PUBLIC_LEGAL_POSTAL_CODE, NEXT_PUBLIC_LEGAL_CITY)')}, contact : ${orTodo(LEGAL.email, 'e-mail (NEXT_PUBLIC_LEGAL_EMAIL)')}. Pas de délégué à la protection des données (DPO) désigné [À VÉRIFIER : non obligatoire à notre taille].`,
      'Nous sommes responsables de traitement pour nos propres traitements (compte, facturation, audits gratuits, prospection, sécurité). Nous sommes sous-traitant de nos clients pour les traitements réalisés pour leur compte : demandes d\'avis envoyées à leurs clients, mesure agrégée des visites venues des assistants IA sur leur site, connecteurs qu\'ils autorisent. Le cadre contractuel de cette sous-traitance est l\'accord de sous-traitance (DPA) publié à l\'adresse /dpa, annexe 1 de nos CGV (/cgv).',
      'Repéré est réservé aux professionnels : les données traitées sont principalement des données professionnelles (nom de l\'entreprise, adresse e-mail et coordonnées professionnelles), qui restent des données personnelles lorsqu\'elles se rapportent à une personne identifiable, par exemple un entrepreneur individuel.',
    ],
  },
  {
    title: '2. Quelles données, pourquoi, sur quelle base légale, combien de temps ?',
    table: {
      head: ['Traitement', 'Données', 'Finalité', 'Base légale', 'Durée'],
      rows: [
        ['Audit gratuit demandé par le visiteur', 'nom de l\'entreprise, métier ou secteur, ville, site, e-mail', 'réaliser et envoyer l\'audit', 'mesures précontractuelles prises à votre demande (art. 6.1.b)', '12 mois, puis suppression ou anonymisation'],
        ['Compte gratuit (offre Découverte) et connexion', 'e-mail, nom de l\'entreprise, site, métier, ville, questions suivies, historique des mesures ; cookie de session strictement nécessaire (httpOnly)', 'créer le compte, vous connecter par lien envoyé par e-mail, vous donner accès à vos mesures', 'contrat (conditions d\'utilisation)', 'tant que le compte existe ; suppression en libre-service (article 10)'],
        ['Abonnement, audit approfondi, accompagnement', 'identité, e-mail, facturation, historique d\'audits, fiche de vérité, tâches', 'exécuter le contrat', 'contrat', 'durée du contrat, puis 5 ans (prescription), factures 10 ans'],
        ['Réponses et sources collectées lors des audits', 'réponses des assistants IA, adresses et titres de pages citées (peuvent contenir le nom d\'un entrepreneur individuel)', 'mesurer la visibilité, classer les sources, vérifier les faits', 'contrat / intérêt légitime', 'adresses de pages brutes : 90 jours, puis totaux par domaine seulement ; rapports : durée du contrat'],
        ['Outils gratuits et RepereBot', 'adresse saisie, contenu public de la page lue (HTML, robots.txt, sitemap), résultat de l\'audit ; adresse IP en mémoire pour limiter les abus', 'auditer la page ou le site demandé, vérifier la présence d\'une entreprise sur une source citée', 'intérêt légitime / mesures précontractuelles', 'résultats : durée du compte ou 12 mois sans compte ; contenu des pages : non conservé ; cache mémoire 10 minutes'],
        ['Lien de partage public (rapport ou tableau de bord)', 'jeton aléatoire (seule son empreinte est conservée), expiration, mot de passe éventuel (haché), nombre de consultations ; nom, logo et couleur de marque blanche si activés', 'permettre au client de montrer ses résultats à un tiers de son choix', 'contrat', 'jusqu\'à expiration (90 jours par défaut) ou révocation, puis suppression du jeton ; aucun lecteur identifié'],
        ['Exports CSV', 'données de mesure du client (sans donnée de contact)', 'permettre au client de récupérer ses données', 'contrat', 'générés à la demande, non conservés'],
        ['Slack et webhook sortant [sous-traitance]', 'adresse de réception et secret de signature (chiffrés), messages envoyés (titre, score, lien), journal des livraisons', 'envoyer au client les alertes et résumés demandés', 'pour le compte du client', 'jusqu\'à suppression de l\'intégration ; journal des livraisons : 30 jours [À VÉRIFIER]'],
        ['Mesure avant/après et annotations', 'questions liées à une tâche, mesures à 14 et 30 jours, notes saisies par le client sur ses courbes', 'montrer l\'évolution après une action', 'contrat', 'durée du compte'],
        ['Parrainage', 'code de parrainage, lien parrain-filleul, statut de la récompense', 'attribuer et créditer la récompense', 'contrat / intérêt légitime (anti-fraude)', 'durée du compte, puis 5 ans pour les écritures comptables'],
        ['Classement public et badge (facultatifs)', 'nom d\'affichage, métier, ville, score et date de la dernière mesure', 'publier un classement par métier et par ville, afficher un badge', 'consentement (inscription volontaire, révocable à tout moment)', 'jusqu\'au retrait de l\'inscription ; le retrait est immédiat'],
        ['Benchmark entre clients', 'rangs et scores agrégés et anonymisés', 'situer le client face à ses pairs', 'intérêt légitime', 'moyenne publiée seulement à partir de 5 clients par cohorte'],
        ['Mesure du trafic IA (script sur le site du client) [sous-traitance]', 'jour, moteur d\'origine, page d\'arrivée, conversion éventuelle : totaux uniquement', 'montrer au client les visites venues des assistants IA', 'pour le compte du client', '13 mois au plus'],
        ['Connecteur Google Analytics 4 (lecture) [sous-traitance]', 'sessions, sources, pages, événements clés agrégés', 'idem, avec l\'historique du client', 'pour le compte du client', 'jetons : jusqu\'à révocation ; agrégats : 13 mois'],
        ['Demandes d\'avis envoyées pour le client [sous-traitance]', 'prénom, e-mail ou téléphone des clients du client, date de la demande', 'envoyer la demande d\'avis, éviter les relances en double', 'définie par le client, responsable de traitement', 'selon instruction du client, 12 mois au plus par défaut [À VÉRIFIER]'],
        ['Copilote (assistant intégré)', 'questions posées, données d\'audit du client', 'répondre au client à partir de ses propres données', 'contrat', 'conversations : 12 mois [À VÉRIFIER]'],
        ['E-mail hebdomadaire et alertes', 'e-mail, préférences, ouverture et clics', 'envoyer le résumé de la semaine et les alertes demandés', 'contrat / intérêt légitime ; désinscription en un clic', 'jusqu\'à désinscription'],
        ['Prospection B2B', 'nom de l\'entreprise, métier, ville, SIREN (répertoire Sirene), adresse e-mail ou téléphone professionnels publiés par l\'entreprise elle-même, adresse de la page source', 'proposer, par un message en rapport avec votre activité professionnelle, un audit de visibilité IA', 'intérêt légitime (art. 6.1.f) ; information dans chaque message et opposition gratuite, à tout moment, par lien de désinscription ou réponse « STOP » (art. L34-5 du Code des postes et des communications électroniques)', '3 ans après le dernier contact venant de vous [À VÉRIFIER], opposition prise en compte immédiatement'],
        ['Liste d\'opposition', 'e-mail ou téléphone (hashé), date', 'respecter votre refus', 'obligation légale / intérêt légitime', 'tant que nécessaire'],
        ['Sécurité et journaux', 'adresse IP, logs du service', 'sécurité du service, limitation des abus', 'intérêt légitime', '12 mois maximum'],
        ['Paiement', 'via Stripe ; nous ne conservons pas le numéro de carte', 'encaisser', 'contrat', 'selon Stripe'],
        ['Liste d\'attente (offre Agence)', 'e-mail, offre attendue', 'vous prévenir à l\'ouverture de l\'offre (un seul e-mail)', 'consentement', 'jusqu\'à l\'ouverture de l\'offre, 12 mois maximum'],
        ['Notifications (facultatives)', 'jeton d\'abonnement push, préférences', 'vous alerter sur votre appareil', 'consentement', 'jusqu\'à désactivation'],
      ],
    },
  },
  {
    title: '3. D\'où viennent les données ?',
    paras: [
      'De vous (formulaires, fiche de vérité), des connecteurs que vous autorisez, de sources publiques (annuaire des entreprises / Sirene (INSEE), informations publiées par l\'entreprise elle-même : site, e-mail professionnel de contact) et des réponses des assistants IA que nous interrogeons. Nous ne collectons pas de données de Google Maps en dehors des conditions de l\'API. Nous n\'utilisons aucune donnée sensible.',
    ],
  },
  {
    title: '4. Mesure d\'audience IA : le script de Repéré',
    paras: [
      'Nous proposons à nos clients un petit script à installer sur leur site pour mesurer les visites venues d\'un assistant IA. Il est conçu pour entrer dans l\'exemption de consentement que la CNIL admet pour certaines mesures d\'audience, aux conditions suivantes, que nous respectons et que nos clients s\'engagent à respecter :',
    ],
    list: [
      'Finalité limitée à la mesure d\'audience, pour le seul compte du site mesuré : aucun suivi de la navigation sur plusieurs sites, aucun usage pour notre compte, aucun croisement avec d\'autres traitements, aucune transmission à des tiers.',
      'Aucun écrit dans le terminal du visiteur : pas de cookie, pas de stockage local, pas d\'identifiant, pas d\'empreinte de navigateur, pas d\'identifiant de session.',
      'Chaque page vue envoie un signal minimal (page, référent, utm_source). Pour les visites ordinaires, seul un compteur total par jour est incrémenté (il sert à calculer la part des visites venues des IA) ; le détail (moteur, page d\'arrivée, conversion) n\'est conservé que pour les visites dont le référent ou l\'utm_source indique un assistant IA.',
      'Données agrégées uniquement (jour, moteur, page d\'arrivée, conversion éventuelle sur la même page vue). Aucune ligne par visiteur. L\'adresse IP n\'est lue qu\'en mémoire pour limiter les abus : elle n\'est jamais écrite en base ni dans les journaux.',
      'Conservation de 13 mois au plus (la CNIL admet jusqu\'à 25 mois). Données cloisonnées par site : un client ne voit jamais celles d\'un autre.',
      'Hébergement dans l\'Union européenne [À VÉRIFIER : région de la base de données] ; contrat de sous-traitance (DPA) avec chaque client.',
      'Le script n\'est pas activé si le navigateur signale « Do Not Track » ou s\'il s\'agit d\'un robot.',
    ],
    after: [
      'Réserves : cette analyse repose sur les recommandations publiées par la CNIL pour la mesure d\'audience. Elle n\'est pas un avis juridique et doit être confirmée par un juriste ou un DPO avant le lancement [À VÉRIFIER]. Si l\'une des conditions ci-dessus n\'était plus remplie (par exemple l\'ajout d\'un identifiant), le script serait soumis au consentement et nous le désactiverions sur les sites concernés.',
      'Texte à reprendre dans la politique de confidentialité du site mesuré : « Nous mesurons le nombre de visites, et en particulier celles provenant d\'assistants d\'intelligence artificielle (ChatGPT, Perplexity, Gemini, etc.), avec un service qui n\'utilise ni cookie ni identifiant et ne conserve pas votre adresse IP. Seuls des totaux par jour, par moteur et par page sont enregistrés, pendant 13 mois au plus, pour notre seul compte. Prestataire : Repéré [À COMPLÉTER : coordonnées]. » [À VÉRIFIER]',
    ],
  },
  {
    title: '5. Connecteurs et accès délégués (OAuth)',
    paras: [
      'Certaines fonctions s\'appuient sur des connexions que vous autorisez explicitement, sur les pages de consentement de chaque service :',
    ],
    list: [
      'Google Analytics 4 : accès en lecture seule (étendue « analytics.readonly ») pour récupérer des agrégats de sessions venues des assistants IA. Nous ne lisons ni n\'enregistrons de données de visiteurs individuels. Nous gardons l\'agrégat quotidien et un jeton d\'accès chiffré. Vous pouvez révoquer l\'accès en un clic dans Repéré ou dans votre compte Google, ce qui supprime le jeton.',
      'Shopify : accès en lecture seule pour relire les rapports de sessions par source et, en option, le catalogue de produits ; il n\'est utilisé que pour mesurer les visites venues des assistants IA et préparer les fiches de vos produits. Google Business Profile, WordPress et autres services nécessaires à l\'offre Accompagné : accès de gestionnaire ou application connectée, limités à ce que prévoit votre offre. Vous restez titulaire de vos comptes ; rien n\'est publié sans votre validation (CGV, article 5).',
      'Les données obtenues par ces connexions servent à fournir le service à votre compte, et à rien d\'autre : pas de revente, pas de publicité, pas d\'entraînement de modèle d\'IA. Cette limite d\'usage est aussi une condition des interfaces de programmation de Google et de Shopify [À VÉRIFIER : conditions applicables à la date de mise en service].',
    ],
  },
  {
    title: '6. Intelligence artificielle, Copilote',
    paras: [
      'Nous utilisons des modèles d\'IA de tiers (OpenAI, Google, Perplexity, Anthropic et, en option, Mistral AI) pour interroger les assistants, analyser leurs réponses (sources, ton, faits), rédiger des brouillons que vous validez, et faire fonctionner le Copilote. Le Copilote est une IA : il répond à partir des seules données de votre compte (audits, sources, fiche de vérité, tâches) et peut se tromper ; il cite les données utilisées.',
      'Nous envoyons aux fournisseurs d\'IA le minimum nécessaire : nom commercial, secteur, ville, extraits d\'audit et contenu de vos questions au Copilote. Nous ne leur envoyons ni les coordonnées des destinataires de vos demandes d\'avis, ni de données de paiement. Nous avons choisi, quand le fournisseur le permet, des réglages et des conditions API excluant l\'entraînement des modèles sur ces données [À VÉRIFIER pour chaque fournisseur].',
      'Les décisions (publier un contenu, modifier une fiche) restent les vôtres.',
    ],
  },
  {
    title: '7. Destinataires et sous-traitants',
    table: {
      head: ['Prestataire', 'Rôle', 'Données', 'Lieu'],
      rows: [
        ['Vercel', 'hébergement de l\'application', 'toutes, techniquement', '[À VÉRIFIER : région]'],
        ['Supabase', 'base de données', 'toutes les données du service', '[À VÉRIFIER : région UE]'],
        ['Stripe', 'paiement', 'identité, facturation', '[À VÉRIFIER]'],
        ['Resend', 'envoi d\'e-mails (résumé hebdomadaire, alertes, demandes d\'avis)', 'e-mail, contenu des messages', '[À VÉRIFIER]'],
        ['[À COMPLÉTER : prestataire SMS]', 'envoi de SMS de demande d\'avis, si activé', 'téléphone, message', '[À COMPLÉTER]'],
        ['OpenAI, Google, Perplexity, Anthropic, Mistral AI (option)', 'modèles d\'IA (interrogation, analyse, Copilote)', 'voir article 6', 'États-Unis, selon le service'],
        ['Slack, ou le service de réception de votre webhook', 'destinataire des messages que vous demandez', 'titre, score, lien : voir article 2', 'choisi par vous'],
        ['Google (Analytics 4, Business Profile), Shopify', 'connecteurs autorisés par vous', 'voir article 5', 'selon le service'],
      ],
    },
    after: ['Accords de sous-traitance (DPA) signés ou acceptés avec chacun : [À COMPLÉTER avant lancement].'],
  },
  {
    title: '8. Transferts hors Union européenne',
    paras: ['Certains prestataires sont situés aux États-Unis ou peuvent y accéder aux données. Un transfert n\'a lieu que s\'il est encadré : soit par la décision d\'adéquation de la Commission européenne du 10 juillet 2023 (Data Privacy Framework), pour les seuls prestataires certifiés sur la liste du ministère américain du commerce, soit par les clauses contractuelles types de la Commission européenne intégrées à l\'accord de traitement du prestataire. Mécanisme retenu pour chacun : [À VÉRIFIER : certification et accord de traitement de chaque prestataire, voir le tableau de l\'article 7 de l\'accord de sous-traitance (/dpa)]. Vous pouvez obtenir une copie des garanties en nous écrivant.'],
  },
  {
    title: '9. Décision automatisée',
    paras: ['Le score, le rang, la classification des sources et la détection d\'erreurs sont calculés automatiquement mais n\'ont aucun effet juridique et ne vous privent d\'aucun droit ; un humain peut réexaminer sur demande.'],
  },
  {
    title: '10. Vos droits',
    paras: [
      `Accès, rectification, effacement, limitation, opposition (y compris à la prospection, sans motif), portabilité, directives post-mortem. Écrivez à ${orTodo(LEGAL.email, 'e-mail (NEXT_PUBLIC_LEGAL_EMAIL)')} ; réponse sous 1 mois. Dans l'espace client, vous pouvez télécharger l'ensemble de vos données (export complet) et supprimer votre compte vous-même ; cette suppression efface aussi vos liens de partage et vos intégrations. Pour contester ou supprimer un audit vous concernant : écrivez-nous avec l'objet « Suppression rapport » et le lien du rapport (lien « Contester ou supprimer cet audit » en bas de chaque rapport) ; réponse sous 30 jours au plus. Si vous êtes le client d'un de nos clients (destinataire d'une demande d'avis), adressez-vous d'abord à l'entreprise qui vous a écrit : nous transmettrons toute demande reçue. Vous pouvez introduire une réclamation auprès de la CNIL : www.cnil.fr.`,
    ],
  },
  {
    title: '11. Cookies et traceurs sur ce site',
    paras: [
      'Le site n\'utilise que des cookies strictement nécessaires (session de connexion, httpOnly). Votre progression dans le plan d\'action est mémorisée dans le stockage local de votre appareil, parce que vous utilisez cette fonction : rien n\'en est transmis à des tiers. Aucun cookie publicitaire, aucun réseau social, aucune police ni aucun outil de mesure tiers.',
      'Mesure d\'audience de ce site : les pages publiques (hors espace client, administration et rapports) chargent notre propre script de mesure, le même que celui décrit à l\'article 4, pour notre seul compte. Il ne dépose ni ne lit aucun cookie ni identifiant, ne conserve pas votre adresse IP et ne produit que des totaux par jour, par page et par source (13 mois au plus). Il entre, selon notre analyse, dans l\'exemption de consentement admise par la CNIL pour la mesure d\'audience (finalité limitée, données statistiques anonymes, aucun recoupement, aucune transmission à des tiers, aucun suivi sur plusieurs sites) [À VÉRIFIER]. Vous pouvez vous y opposer en activant le réglage « Ne pas me suivre » (Do Not Track) de votre navigateur : le script ne s\'exécute alors pas.',
    ],
  },
  {
    title: '11 bis. Caractère obligatoire des données et retrait du consentement',
    paras: [
      'Les champs obligatoires sont signalés dans chaque formulaire : sans eux, nous ne pouvons pas réaliser l\'audit, créer le compte ou exécuter la commande. Les autres sont facultatifs. Lorsqu\'un traitement repose sur votre consentement (conseils par e-mail, classement public, notifications, liste d\'attente), vous pouvez le retirer à tout moment, aussi simplement que vous l\'avez donné, sans que cela remette en cause les traitements déjà effectués.',
    ],
  },
  {
    title: '12. Sécurité et violation',
    paras: ['Chiffrement en transit, accès restreint, jetons chiffrés, sauvegardes. En cas de violation à risque, notification à la CNIL sous 72 h et information du client concerné dans les meilleurs délais.'],
  },
];

export default function Page() {
  return <LegalDocument path="/confidentialite" title="Politique de confidentialité" updated="[À COMPLÉTER : JJ/MM/AAAA], version 3.0" sections={sections} />;
}
