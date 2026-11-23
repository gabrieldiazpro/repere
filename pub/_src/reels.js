// Scénarios des 6 reels (1080×1920). Coordonnées des captures en pixels source (largeur 720).
// Toute donnée chiffrée vient des comptes démo et reste étiquetée « Démo » pendant qu'elle est visible.
window.REELS = {
  // 1 — Local · peur de l'invisibilité / de l'erreur (format « Voilà ce qui est arrivé »)
  'r1-local-horaires': {
    dur: 15.6,
    scenes: [
      { type: 'card', start: 0, dur: 3.4, blocks: [
        { text: 'Une IA donnait de {red|faux horaires} pour ce plombier.', cls: 'big m' },
        { text: 'Voilà ce qui est arrivé.', cls: 'sub', at: 1.5 },
        { text: 'Entreprise fictive · compte de démonstration', cls: 'legal', at: 1.9 },
      ] },
      { type: 'screen', start: 3.4, dur: 4.6, still: 'lundi-local', demo: 'Démo · entreprise fictive',
        scroll: [[0, 70], [4.6, 110]], zoom: [[0, 1.0], [0.5, 1.0], [1.3, 1.25], [4.6, 1.27]],
        focus: [{ at: 1.0, x: 18, y: 126, w: 530, h: 138, until: 2.5 }, { at: 2.7, x: 30, y: 362, w: 210, h: 52 }],
        captions: [
          { at: 0, text: 'Gemini annonçait {red|ouvert le samedi jusqu’à 20 h.} Il ferme à 13 h.' },
          { at: 2.5, text: 'Repéré l’a repéré, et a {green|déjà rédigé} la correction.' },
        ] },
      { type: 'screen', start: 8.0, dur: 4.0, still: 'lundi-local', demo: 'Démo · entreprise fictive',
        scroll: [[0, 110], [1.2, 1335], [4, 1345]],
        focus: [{ at: 1.5, x: 30, y: 1440, w: 660, h: 105 }],
        captions: [
          { at: 0, text: 'Et vous lisez, {mot|mot pour mot,} ce que chaque IA dit de vous.' },
        ] },
      { type: 'end', start: 12.0, dur: 3.6, noFadeOut: true, title: 'Et votre commerce, que disent les IA&nbsp;?', cta: 'Tester gratuitement', url: 'repere-ia.fr · 60 s, sans carte' },
    ],
  },

  // 2 — Tous · gratuit en 60 s sans carte (vraie analyse rejouée sur un site fictif)
  'r2-60-secondes': {
    dur: 17.6,
    scenes: [
      { type: 'card', start: 0, dur: 2.7, blocks: [
        { text: 'Tapez l’adresse de votre site.', cls: 'big' },
        { text: 'C’est tout.', cls: 'sub', at: 1.2 },
      ] },
      { type: 'screen', start: 2.7, dur: 3.6, seq: 'analyse', seqKeys: [[0, 0.5], [3.6, 3.5]], demo: 'Démo · site fictif',
        focus: [{ at: 0.3, x: 10, y: 372, w: 660, h: 64, until: 3.2 }],
        captions: [{ at: 0, text: 'Gratuit. Sans inscription. {green|Sans carte.}' }] },
      { type: 'screen', start: 6.3, dur: 4.0, seq: 'analyse', seqKeys: [[0, 3.6], [4.0, 14.6]], demo: 'Démo · site fictif',
        captions: [
          { at: 0, text: 'Repéré explore le site {mot|pour de vrai,} page par page.' },
          { at: 2.1, text: 'Ce que voit Google. Ce que lisent les IA.' },
        ] },
      { type: 'screen', start: 10.3, dur: 3.9, seq: 'analyse', seqKeys: [[0, 14.75], [3.9, 20.0]], demo: 'Démo · site fictif',
        captions: [
          { at: 0, text: 'Le verdict, 3 scores et {mot|vos 5 priorités.}' },
          { at: 2.1, text: 'Chacune expliquée : pourquoi, et quoi faire.' },
        ] },
      { type: 'end', start: 14.2, dur: 3.4, noFadeOut: true, title: 'Votre site en 60&nbsp;secondes. Gratuit.', cta: 'Analyser mon site', url: 'repere-ia.fr · sans carte bancaire' },
    ],
  },

  // 3 — Local / PME · « on fait le travail pour vous » (vraie validation dans l'agent démo)
  'r3-agent': {
    dur: 18.2,
    scenes: [
      { type: 'card', start: 0, dur: 3.2, blocks: [
        { text: 'Pas le temps de vous occuper de votre site&nbsp;?', cls: 'big m' },
        { text: 'Repéré fait le travail. {mot|Vous dites oui ou non.}', cls: 'sub', at: 1.4 },
      ] },
      { type: 'screen', start: 3.2, dur: 3.3, seq: 'agent', seqKeys: [[0, 0.1], [1.7, 1.1], [1.71, 2.9], [3.3, 3.0]], demo: 'Démo simulée · site fictif',
        captions: [{ at: 0, text: 'L’agent repère ce qui bloque et {mot|prépare la correction.}' }] },
      { type: 'screen', start: 6.5, dur: 4.2, seq: 'agent', seqKeys: [[0, 3.0], [4.2, 6.85]], zoom: [[0, 1], [0.8, 1], [1.6, 1.22], [4.2, 1.22]], demo: 'Démo simulée · site fictif',
        captions: [
          { at: 0, text: 'Avant / après, {mot|mot pour mot.}' },
          { at: 2.1, text: 'Vous relisez, vous modifiez si besoin.' },
        ] },
      { type: 'screen', start: 10.7, dur: 4.1, seq: 'agent', seqKeys: [[0, 6.9], [4.1, 12.8]], demo: 'Démo simulée · site fictif',
        captions: [
          { at: 0, text: 'Vous validez. Il publie, {green|puis vérifie.}' },
          { at: 2.2, text: 'Tout est journalisé et {mot|annulable.}' },
        ] },
      { type: 'end', start: 14.8, dur: 3.4, noFadeOut: true, title: 'On mesure. On explique. {mot|On le fait.}', cta: 'Tester mon site gratuitement', url: 'Offres dès 29 €/mois · repere-ia.fr' },
    ],
  },

  // 4 — E-commerce · trafic et ventes venus des IA (compte démo)
  'r4-ecommerce': {
    dur: 17.4,
    scenes: [
      { type: 'card', start: 0, dur: 3.4, blocks: [
        { text: 'Des clients arrivent déjà de ChatGPT et Perplexity.', cls: 'big m' },
        { text: 'Voilà ce qu’une boutique peut mesurer en 30 jours.', cls: 'sub', at: 1.6 },
        { text: 'Boutique fictive · compte de démonstration', cls: 'legal', at: 2.0 },
      ] },
      { type: 'screen', start: 3.4, dur: 4.2, still: 'trafic-ecom', demo: 'Démo · boutique fictive',
        scroll: [[0, 150], [4.2, 165]],
        focus: [{ at: 0.6, x: 18, y: 178, w: 684, h: 260 }],
        captions: [
          { at: 0, text: 'Les visites venues des IA, {mot|et les commandes.}' },
          { at: 2.2, text: 'Mesurées commande par commande, {green|avec la marge d’erreur.}' },
        ] },
      { type: 'screen', start: 7.6, dur: 3.8, still: 'trafic-ecom', demo: 'Démo · boutique fictive',
        scroll: [[0, 165], [1.1, 690], [3.8, 700]],
        captions: [{ at: 0, text: 'ChatGPT, Perplexity, Gemini, Claude : {mot|chaque IA à part.}' }] },
      { type: 'screen', start: 11.4, dur: 3.0, still: 'ventes-ecom', demo: 'Démo · boutique fictive',
        scroll: [[0, 1060], [3, 1075]],
        focus: [{ at: 0.5, x: 18, y: 1100, w: 684, h: 300 }],
        captions: [{ at: 0, text: 'Et les produits que les IA recommandent.' }] },
      { type: 'end', start: 14.4, dur: 3.0, noFadeOut: true, title: 'Que disent les IA de votre boutique&nbsp;?', cta: 'Diagnostic gratuit', url: 'repere-ia.fr · 60 s, sans carte' },
    ],
  },

  // 5 — PME · « qui est cité à votre place »
  'r5-pme': {
    dur: 15.8,
    scenes: [
      { type: 'card', start: 0, dur: 3.4, blocks: [
        { text: '{q|« Quel est le meilleur logiciel de paie pour une PME&nbsp;? »}', cls: 'big m' },
        { text: 'Un prospect pose la question à ChatGPT. {mot|Qui est cité ?}', cls: 'sub', at: 1.6 },
      ] },
      { type: 'screen', start: 3.4, dur: 4.6, still: 'reponses-pme', demo: 'Démo · entreprises fictives',
        scroll: [[0, 800], [2.2, 820], [2.9, 1330], [4.6, 1340]], zoom: [[0, 1], [0.4, 1.28], [4.6, 1.28]],
        focus: [{ at: 0.8, x: 18, y: 1010, w: 520, h: 40, until: 2.3 }, { at: 3.1, x: 18, y: 1365, w: 520, h: 40 }],
        captions: [
          { at: 0, text: 'ChatGPT cite 7 éditeurs. {mot|Paysia arrive 3e.}' },
          { at: 2.5, text: 'Perplexity, lui, {red|ne la cite pas.}' },
        ] },
      { type: 'screen', start: 8.0, dur: 4.2, still: 'concurrents-pme', demo: 'Démo · entreprises fictives',
        scroll: [[0, 160], [2.0, 170], [2.7, 990], [4.2, 1000]],
        focus: [{ at: 0.5, x: 18, y: 200, w: 684, h: 260, until: 2.1 }],
        captions: [
          { at: 0, text: 'Repéré mesure qui passe devant vous.' },
          { at: 2.3, text: 'Et pourquoi : {mot|les sites que les IA lisent.}' },
        ] },
      { type: 'end', start: 12.2, dur: 3.6, noFadeOut: true, title: 'Votre entreprise est-elle citée par les IA&nbsp;?', cta: 'Tester ma marque · 60 s', url: 'repere-ia.fr · sans carte' },
    ],
  },

  // 6 — Agences · marque blanche
  'r6-agences': {
    dur: 15.4,
    scenes: [
      { type: 'card', start: 0, dur: 3.6, blocks: [
        { text: 'Vos clients vont vous demander : {q|« On est dans ChatGPT ? »}', cls: 'big m' },
        { text: 'Ayez la réponse. {mot|Pour chacun.}', cls: 'sub', at: 1.8 },
      ] },
      { type: 'screen', start: 3.6, dur: 4.4, still: 'lundi-agence', demo: 'Démo · agence et clients fictifs',
        scroll: [[0, 190], [2.2, 200], [2.9, 740], [4.4, 750]],
        focus: [{ at: 0.6, x: 18, y: 210, w: 684, h: 200, until: 2.3 }],
        captions: [
          { at: 0, text: 'Tous vos clients, {mot|Google et IA,} sur un écran.' },
          { at: 2.5, text: 'Une alerte quand une IA se trompe sur l’un d’eux.' },
        ] },
      { type: 'screen', start: 8.0, dur: 3.8, still: 'lundi-agence', demo: 'Démo · agence et clients fictifs',
        scroll: [[0, 750], [1.0, 60], [3.8, 60]],
        focus: [{ at: 1.3, x: 18, y: 135, w: 684, h: 92 }],
        captions: [{ at: 0, text: 'En marque blanche : {mot|vos rapports, votre marque.}' }] },
      { type: 'end', start: 11.8, dur: 3.6, noFadeOut: true, title: 'Ajoutez la visibilité IA à vos offres.', cta: 'Devenir partenaire · 0 €', url: 'Offre Agence 149 €/mois · repere-ia.fr' },
    ],
  },
};
