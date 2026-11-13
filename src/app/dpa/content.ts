import type { LegalSection } from '@/lib/seo/shell';
import { LEGAL, LEGAL_ADDRESS, SIREN_DISPLAY, orTodo } from '@/lib/seo/site';

/**
 * Modèle d'accord de sous-traitance (annexe 1 des CGV). Couvre les seuls traitements réalisés pour le compte du
 * Client (CGV, article 9). Les traitements dont Repéré est responsable sont décrits dans /confidentialite.
 * Tout changement de sous-traitant ultérieur doit être reporté ici ET dans /confidentialite (article 7).
 */
export const SUBPROCESSORS: { name: string; role: string; data: string; place: string; transfer: string }[] = [
  {
    name: 'Vercel Inc.',
    role: "Hébergement de l'application et exécution du code",
    data: 'Toutes les données du service, en transit',
    place: '[À VÉRIFIER : région d\'exécution choisie]',
    transfer: '[À VÉRIFIER : certification Data Privacy Framework, sinon clauses contractuelles types]',
  },
  {
    name: 'Supabase Inc.',
    role: 'Base de données et authentification',
    data: 'Toutes les données du service, au repos',
    place: '[À VÉRIFIER : région UE du projet]',
    transfer: '[À VÉRIFIER : clauses contractuelles types de son DPA pour l\'accès du support]',
  },
  {
    name: 'Resend',
    role: "Envoi des e-mails (demandes d'avis, alertes, résumés)",
    data: "E-mail et prénom des destinataires, contenu du message",
    place: '[À VÉRIFIER : région d\'envoi]',
    transfer: '[À VÉRIFIER : Data Privacy Framework ou clauses contractuelles types]',
  },
  {
    name: '[À COMPLÉTER : prestataire SMS]',
    role: "Envoi des SMS de demande d'avis, si l'option est activée",
    data: 'Numéro de téléphone, prénom, contenu du message',
    place: '[À COMPLÉTER]',
    transfer: '[À COMPLÉTER]',
  },
  {
    name: 'OpenAI, Anthropic, Google, Perplexity',
    role: "Modèles d'IA : Copilote, analyse de contenus, brouillons de réponses aux avis",
    data: "Questions posées au Copilote, données d'audit, texte des avis et prénom affiché de leur auteur (jamais l'e-mail ni le téléphone des destinataires)",
    place: 'États-Unis',
    transfer: "[À VÉRIFIER pour chaque fournisseur : certification Data Privacy Framework ou clauses contractuelles types de son accord de traitement ; conditions API excluant l'entraînement sur les données]",
  },
  {
    name: 'Mistral AI',
    role: "Modèle d'IA (offres qui le mentionnent)",
    data: 'Idem ligne précédente',
    place: '[À VÉRIFIER : France / UE]',
    transfer: 'Sans objet si les données restent dans l\'UE [À VÉRIFIER]',
  },
];

export const DPA_SECTIONS: LegalSection[] = [
  {
    title: '1. Parties et objet',
    paras: [
      `Le présent accord est conclu entre le Client, responsable de traitement, et l'éditeur de Repéré, la société ${orTodo(LEGAL.name, 'dénomination exacte (NEXT_PUBLIC_LEGAL_NAME)')}, ${orTodo(LEGAL.form, 'forme juridique et capital (NEXT_PUBLIC_LEGAL_FORM)')}, immatriculée sous le numéro ${orTodo(SIREN_DISPLAY, 'SIREN (NEXT_PUBLIC_LEGAL_SIREN)')}, dont le siège est situé ${orTodo(LEGAL_ADDRESS, 'adresse (NEXT_PUBLIC_LEGAL_STREET, NEXT_PUBLIC_LEGAL_POSTAL_CODE, NEXT_PUBLIC_LEGAL_CITY)')} (« le Sous-traitant »). Il forme l'annexe 1 des conditions générales de vente (/cgv) et est accepté avec elles ; il peut aussi être signé séparément à la demande du Client.`,
      "Il fixe les conditions dans lesquelles le Sous-traitant traite des données personnelles pour le compte du Client, conformément à l'article 28 du règlement (UE) 2016/679 (RGPD). Il ne concerne pas les traitements dont le Sous-traitant est lui-même responsable (compte, facturation, prospection, sécurité), décrits dans la politique de confidentialité (/confidentialite).",
    ],
  },
  {
    title: '2. Description des traitements',
    table: {
      head: ['Point', 'Contenu'],
      rows: [
        [
          'Finalités',
          "Fournir au Client les fonctions qu'il active : envoi de demandes d'avis à ses clients ; lecture des avis publiés et préparation de réponses ; mesure agrégée des visites venues d'assistants IA sur son site (script, connecteurs Google Analytics 4 et Shopify, journaux de robots) ; traitement de ses contenus dans le Copilote ; envoi des messages Slack ou webhook qu'il demande. Aucune autre finalité, aucun usage pour le compte du Sous-traitant, aucune revente, aucun entraînement de modèle d'IA.",
        ],
        ['Nature des opérations', 'Collecte, enregistrement, organisation, agrégation, consultation, envoi de messages, hébergement, effacement.'],
        [
          'Catégories de personnes',
          "Clients et prospects du Client (destinataires des demandes d'avis) ; auteurs d'avis ; visiteurs du site du Client (données agrégées sans identifiant) ; salariés ou mandataires du Client utilisateurs du service.",
        ],
        [
          'Catégories de données',
          "Prénom ou nom, e-mail ou téléphone des destinataires ; date des demandes ; texte et nom affiché des avis publics ; totaux de visites par jour, moteur et page (sans adresse IP ni identifiant) ; e-mail des utilisateurs. Aucune donnée sensible (article 9 du RGPD) ni relative à des infractions : le Client s'interdit d'en confier.",
        ],
        ['Durée', "Durée du contrat, puis restitution ou effacement (article 10). Agrégats du script de mesure : 13 mois au plus. Destinataires de demandes d'avis : 12 mois au plus après la dernière demande, sauf instruction contraire du Client."],
      ],
    },
  },
  {
    title: '3. Instructions du Client',
    paras: [
      "Le Sous-traitant ne traite les données que sur instruction documentée du Client, y compris pour les transferts hors de l'Union européenne. Les instructions résultent du contrat, du présent accord et des réglages du Client dans le service ; toute instruction supplémentaire est donnée par écrit. Si le Sous-traitant est tenu par le droit de l'Union ou d'un État membre de procéder à un traitement, il en informe le Client avant le traitement, sauf interdiction légale.",
      "Le Sous-traitant informe immédiatement le Client s'il estime qu'une instruction constitue une violation du RGPD ou d'une autre disposition relative à la protection des données.",
    ],
  },
  {
    title: '4. Obligations du Client',
    list: [
      "Disposer d'une base légale pour chaque traitement confié, en particulier pour l'envoi de demandes d'avis à ses clients (relation client existante, information préalable et droit d'opposition, ou consentement selon le cas).",
      "Informer les personnes concernées (article 13 ou 14 du RGPD), notamment les visiteurs de son site sur la mesure d'audience et les destinataires des demandes d'avis.",
      "Ne fournir que des données exactes, nécessaires et licitement collectées ; ne jamais confier de données sensibles.",
      "Ne pas modifier le script de mesure (ajout d'identifiant, combinaison avec d'autres traitements), ce qui lui ferait perdre l'exemption de consentement décrite dans la politique de confidentialité.",
    ],
  },
  {
    title: '5. Confidentialité',
    paras: [
      "Le Sous-traitant veille à ce que les personnes autorisées à traiter les données s'engagent à respecter la confidentialité ou soient soumises à une obligation légale de confidentialité, et ne leur donne accès qu'aux données nécessaires à leur mission.",
    ],
  },
  {
    title: '6. Sécurité (article 32 du RGPD)',
    list: [
      'Chiffrement des échanges (HTTPS) ; jetons d\'accès aux services tiers et secrets de webhook chiffrés en base (AES-256-GCM).',
      "Cloisonnement des données par client et par site ; contrôle d'accès à la base de données ; connexion des utilisateurs par lien à usage unique.",
      "Script de mesure sans cookie, sans identifiant, sans écriture de l'adresse IP.",
      'Journalisation des modifications faites sur les comptes et fiches du Client (date, auteur, avant, après).',
      'Sauvegardes [À COMPLÉTER : fréquence, durée, lieu] ; procédure de gestion des incidents [À COMPLÉTER].',
    ],
    after: ['Le Sous-traitant peut faire évoluer ces mesures, sans diminuer le niveau global de sécurité.'],
  },
  {
    title: '7. Sous-traitants ultérieurs',
    paras: [
      "Le Client donne une autorisation écrite générale au recours aux sous-traitants ultérieurs listés ci-dessous. Le Sous-traitant informe le Client de tout ajout ou remplacement envisagé au moins [À COMPLÉTER : 15] jours à l'avance, par e-mail ou dans l'espace client ; le Client peut s'y opposer pour un motif lié à la protection des données et, à défaut d'accord, résilier sans frais le service concerné avant la prise d'effet du changement.",
      "Le Sous-traitant impose à chaque sous-traitant ultérieur, par contrat, les mêmes obligations de protection des données que celles du présent accord, notamment des garanties suffisantes de sécurité. Il demeure pleinement responsable envers le Client de leur exécution.",
    ],
    table: {
      head: ['Sous-traitant ultérieur', 'Rôle', 'Données', 'Lieu', 'Encadrement du transfert'],
      rows: SUBPROCESSORS.map((p) => [p.name, p.role, p.data, p.place, p.transfer]),
    },
  },
  {
    title: "8. Transferts hors de l'Union européenne",
    paras: [
      "Les données sont hébergées dans l'Union européenne lorsque le prestataire le permet [À VÉRIFIER : région de chaque prestataire]. Un transfert vers un pays tiers n'a lieu que s'il est encadré : décision d'adéquation de la Commission européenne (pour les États-Unis, uniquement vers un destinataire certifié au Data Privacy Framework, certification vérifiée sur la liste du ministère américain du commerce), ou clauses contractuelles types adoptées par la Commission, complétées si nécessaire par des mesures supplémentaires. Le Sous-traitant tient à la disposition du Client la liste à jour des mécanismes utilisés.",
    ],
  },
  {
    title: '9. Assistance au Client',
    list: [
      "Droits des personnes : le Sous-traitant aide le Client, par des mesures techniques et organisationnelles appropriées (export, suppression, liste d'opposition), à répondre aux demandes d'exercice des droits. Il lui transmet sans délai toute demande reçue directement et n'y répond pas lui-même sans instruction.",
      "Violation de données : le Sous-traitant notifie au Client toute violation de données personnelles dans les meilleurs délais et au plus tard [À COMPLÉTER : 48] heures après en avoir pris connaissance, avec les informations prévues à l'article 33.3 du RGPD disponibles à ce moment, complétées ensuite. Le Client reste seul chargé de la notification à la CNIL et aux personnes.",
      "Analyses d'impact et consultation préalable : assistance raisonnable, dans la limite des informations dont dispose le Sous-traitant.",
      "Registre : le Sous-traitant tient un registre des catégories de traitements effectués pour le compte de ses clients (article 30.2 du RGPD).",
    ],
  },
  {
    title: '10. Fin du contrat',
    paras: [
      "À la fin du contrat, au choix du Client, le Sous-traitant lui restitue les données (export dans l'espace client) puis les efface, ou les efface directement, dans un délai de [À COMPLÉTER : 30] jours, sauf obligation légale de conservation. Il supprime ses accès et jetons de connexion aux comptes du Client. Il confirme l'effacement par écrit sur demande.",
    ],
  },
  {
    title: '11. Audit',
    paras: [
      "Le Sous-traitant met à la disposition du Client les informations nécessaires pour démontrer le respect du présent accord et permet la réalisation d'audits, y compris des inspections, par le Client ou un auditeur qu'il mandate et qui est tenu au secret, sur préavis écrit de [À COMPLÉTER : 30] jours, au plus une fois par an sauf violation avérée, dans des conditions qui préservent la sécurité et la confidentialité des autres clients. Les frais de l'audit sont à la charge du Client.",
    ],
  },
  {
    title: '12. Durée, responsabilité et ordre de priorité',
    paras: [
      "Le présent accord s'applique pendant toute la durée du contrat et, après celle-ci, tant que le Sous-traitant détient des données du Client. Chaque partie répond de ses propres manquements au RGPD (article 82). Sur les traitements qu'il couvre, le présent accord prévaut sur les conditions générales de vente ; pour le reste, les conditions générales s'appliquent, y compris leurs clauses de responsabilité, sous réserve des dispositions impératives du RGPD.",
    ],
  },
];

