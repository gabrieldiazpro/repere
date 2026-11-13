# 07 — Benchmark design des meilleurs SaaS et spécification design V3

Auteur : agent BENCHMARK DES MEILLEURS SITES SAAS. Date : 9 novembre 2026. Langue : français.
Entrées : `docs/v3/00-BRIEF-V3.md`, `docs/01-marque.md`, le site V2 servi sur http://localhost:3000 (build du 9 nov.), le code de
`src/app/page.tsx`, `src/components/site/**`, `src/app/globals.css` et `src/components/app/app.css`.
Captures : `/home/claude/auditia/qa/v3/benchmark/` (`<page>-desk-fold.png`, `<page>-desk-full.png`, `<page>-mob-fold.png`,
`<page>-mob-full.png`, et des découpes `*-part<N>.png` pour l'accueil, /pme et /tarifs).

---

## 0. Résumé

### Les 10 écarts les plus visibles (ordre d'impact)

| # | Écart | Chez les références | Chez Repéré V2 |
|---|---|---|---|
| 1 | **Pas d'appel à l'action dans le hero de l'accueil** | Un bouton principal + un secondaire au-dessus de la ligne de flottaison (Attio : 3 entrées ; Clerk : « Start building for free ») | Accueil : aucun bouton ni champ dans le hero ; le sélecteur de parcours commence à ~700 px (bureau) et après 2 écrans sur mobile. (/pme, /local et /e-commerce ont, eux, deux boutons.) |
| 2 | **Le produit ne bouge pas** | Hero = produit animé (Linear, Attio, Framer : « le produit fait le spectacle ») | Hero et 4 piliers = maquettes HTML statiques ; seule animation : le cadre `lock-on` (1,1 s, une fois). `ChatScene.tsx` (typewriter) existe mais **n'est utilisé nulle part**. |
| 3 | **Aucune vidéo** | Vidéo courte en boucle muette ou vidéo de démo derrière « Voir la démo » | Zéro `<video>` sur le site. |
| 4 | **Aucune démo cliquable** | 48 % des démos interactives sont sur la page d'accueil, 80 % des meilleures sont au-dessus de la ligne de flottaison ou dans la nav (Navattic 2026) | 3 comptes démo très riches dans /app… mais aucun lien « Visiter le compte démo » ni visite guidée depuis le site. |
| 5 | **Pas de bandeau « IA suivies »** | Bandeau de logos (clients ou intégrations) en gris, juste sous le hero | ChatGPT, Gemini, Perplexity, Claude ne sont cités qu'en texte. |
| 6 | **Pas de système d'animation** | Tokens de durée/courbe (Clerk : 100/150/200/300/450 ms, `cubic-bezier(.33,1,.68,1)`), reveal au scroll avec décalage de 80 ms (Vercel, PostHog) | 2 keyframes (`reveal-up`, `lock-on`) ; aucun reveal au scroll ; aucun token. |
| 7 | **Fonctionnalités en liste, pas en grille vivante** | Grille bento de 5 à 10 cellules, visuel animé dans chaque cellule | 6 fonctionnalités en `<dl>` texte sur 2 colonnes. |
| 8 | **Preuve sociale limitée à des chiffres d'études** | Logos clients, métriques clients nommés (Linear V3), cas clients | Chiffres d'études sourcés (bien), mais pas de « mur de preuves » : méthode ouverte, garanties, journal public, compteur d'audits réels. |
| 9 | **Tarifs sans calculateur ni ROI** | Calculateur (PostHog), bascule mensuel/annuel | Bascule mensuel/annuel et onglets de parcours **déjà présents** (bien) ; pas de calculateur « combien vaut un client venu d'une IA ». |
| 10 | **Pas de changelog public** | Journal daté, étiqueté, avec capture (Linear, Vercel, Resend) | Aucun /nouveautes ; le rythme de livraison réel (V1 → V2 → V3) est invisible. |

Ce qui est déjà au niveau et qu'il faut garder : la typographie (Bricolage Grotesque serrée à −0,035 em, comparable aux
références), la palette sobre, les maquettes produit étiquetées « Démo »/« Exemple », la rigueur des sources, le tableau
comparatif avec colonne Repéré mise en avant, la page tarifs à onglets, l'app /app (très bonne « phrase de la semaine »,
jauge en cadre de visée, barre d'onglets mobile).

### Ce que la V3 doit livrer (aperçu)
1. Un **système d'animation** sans dépendance (CSS + Web Animations API + IntersectionObserver, ~6 ko gzip au total) : 12 primitives,
   tokens, respect de `prefers-reduced-motion` et bouton pause (WCAG 2.2.2).
2. Un **hero joué** : question tapée → 4 IA répondent → votre nom est « repéré » → la jauge monte, avec le formulaire de test
   à gauche et deux boutons.
3. **4 scènes produit animées** (Mesurer, Comprendre, Agir, Prouver) en HTML/SVG, pilotées par le curseur fantôme.
4. **1 vidéo de 52 s + 4 clips de 12 s** enregistrés dans l'app réelle (compte démo) avec Playwright `page.screencast`, sous-titres
   incrustés par ffmpeg et piste VTT.
5. **Une visite guidée de 8 étapes** du compte démo, sans outil tiers.
6. **7 nouvelles sections** : IA suivies, bento, avant/après, calculateur de ROI, comparatif, changelog public, mur de preuves honnêtes.
7. **Micro-interactions de l'app** (tâche cochée, copie, jauge, transitions d'onglets).

---

## 1. Méthode et limites

- 26 recherches et lectures web (liste en §9). Je n'ai pas pu ouvrir les sites des références dans un navigateur depuis cette
  session : l'analyse s'appuie sur des teardowns, des fiches de design system publiées par les éditeurs (Clerk `design.md`),
  leurs blogs (Linear), des rapports de benchmark (Navattic, Arcade) et des articles d'analyse. **Plusieurs analyses tierces
  (webtrends.pages.dev, one-page-orpin.vercel.app, uirip.pages.dev) sont des sites d'analyse automatisée, de fiabilité moyenne** :
  leurs valeurs chiffrées (ex. « décalage de 80 ms ») sont reprises comme ordres de grandeur, pas comme mesures.
- Pour Pennylane, Qonto, Alan, Swile, Profound et Peec, les recherches n'ont pas donné de teardown de la landing. Ce qui est dit
  d'eux ci-dessous est marqué **(connaissance générale, à vérifier en visitant le site)** quand ça ne vient pas d'une source citée.
- Aucune de ces références n'est à copier : on reprend des **idées fonctionnelles** (règle du brief), jamais textes, visuels ou code.

---

## 2. Les références, une par une

Légende : ✅ source citée ; (≈) connaissance générale à vérifier.

### 2.1 Linear (linear.app)
- **Structure** : hero → grille de fonctionnalités → vitrine produit → preuve sociale → intégrations → teaser tarifs → CTA final ✅[1].
  Version 3 (avril 2026) : abandon de la longue narration au profit de « voici la preuve », chiffres insérés dans le récit ✅[2].
- **Hero** : fond sombre, une seule capture produit lumineuse, « le produit EST le hero » ✅[1] ; titres très grands (≈120 px bureau) ✅[2].
- **Animation** : fondu au scroll, captures UI animées, halo au survol des cartes, lueur derrière le bouton du CTA final ✅[1].
- **Preuve sociale** : logos en gris/opacité réduite, témoignages d'une phrase, pas d'étoiles ✅[1] ; métriques clients nommées
  (« −34 % de temps de résolution P0 ») ✅[2].
- **Changelog** : timeline, titre court + 2–3 phrases, étiquettes Feature/Improvement/Fix ✅[17].
- **Principe de design (blog Linear, mars 2026)** : « ne pas rivaliser pour une attention qu'on n'a pas méritée », séparateurs
  moins contrastés, densité sans surcharge ✅[3].
- **À retenir pour Repéré** : le produit au centre, les chiffres dans le récit, un changelog sec et régulier.

### 2.2 Stripe
- **Hero** : grand titre, ruban dégradé animé en WebGL (bruit cyclique ≈ 8 s), mots en gras dans le titre ✅[4] ; technique
  reproductible documentée ✅[5].
- **Animation** : uniquement fondu à l'entrée des sections ; **pas de parallaxe, pas de compteurs, pas de vidéo de fond** :
  le mouvement confirme ou attire, il n'amuse pas ✅[4].
- **À retenir** : la retenue. Un seul élément « signature » animé (pour Repéré : le cadre de visée), le reste immobile.

### 2.3 Vercel
- **Hero** : titre ≈72 px, maillage dégradé en arrière-plan à 0,85× de la vitesse de scroll ✅[6].
- **Animation** : cartes en fondu-montée (opacité 0→1, +20 px→0, 300 ms, décalage 80 ms) ; boutons qui montent de 1 px au survol
  (200 ms) ; ombre des cartes de prix qui s'élargit (250 ms) ; transitions de page instantanées ✅[6].
- **Changelog** : quasi quotidien, titre + date + description structurée ✅[17].
- **Transitions de vue** : Vercel/Next documentent le morphing d'éléments partagés, l'asymétrie sortie 150 ms / entrée 210 ms /
  déplacement 400 ms ✅[18].

### 2.4 Attio
- **Structure** : répétition « nom de fonctionnalité → description → démo produit » ✅[7].
- **Hero** : titre abstrait (« Customer relationship magic ») + sous-titre de catégorie ; 3 entrées (« Start for free », « Send me a
  demo », « Talk to sales ») ✅[7].
- **Démo** : captures et démos interactives explorables sans rendez-vous ✅[7].
- **Faiblesses relevées** : copie centrée sur le produit plutôt que sur le résultat, pas de coût de l'inaction, pas de comparaison
  directe ✅[7]. Repéré fait déjà mieux sur ces trois points.

### 2.5 Raycast
- Principes publiés de l'app : réponse < 50 ms, raccourcis visibles en ligne, confirmations HUD qui disparaissent seules à 1,5 s,
  célébrations « méritées et brèves » ✅[8].
- (≈) Landing : hero sombre avec la fenêtre de commande animée et des touches de clavier en 3D ; grille d'extensions.
- **À retenir** : micro-célébration brève quand une tâche est faite dans l'app ; raccourcis visibles.

### 2.6 Framer
- Fond noir, un seul accent bleu pour les CTA, titres 96–120 px, fondu au scroll de 500 ms, ni rebond ni parallaxe : « la démo
  produit fait le spectacle » ✅[9].
- (≈) Vidéos produit en boucle dans des cadres, galerie de modèles.

### 2.7 Clerk (le plus documenté : design system publié)
- **Tokens de mouvement** ✅[10] : 100 ms (survol entrant), 150 ms (sortie), 200 ms (icônes, retour de formulaire), 300 ms (reflet de
  bouton), 450 ms (couleur de thème). Courbes : `cubic-bezier(0.33, 1, 0.68, 1)` pour l'UI ; `cubic-bezier(0.4, 0.36, 0, 1)` pour le
  reflet ; `cubic-bezier(0.175, 0.885, 0.32, 1.275)` (léger dépassement) pour la flèche des cartes. Ressorts via motion/react.
  Animations nommées : `letter-reveal` (0,3 s, opacité + flou 2 px→0), `blink` du curseur (1 s).
- **Règles** : le mouvement guide l'attention, ne décore pas ; tout derrière `prefers-reduced-motion` ; jamais `transition: all` ✅[10].
- **Sections** : sur-titre monospace en capitales → H2 en casse de phrase → texte gris (max 2xl) → CTA optionnel ; séparateur 0,5 px ✅[10].
- **Composants en démo** : posés sur des halos dégradés ; bouton principal avec reflet et flèche qui glisse au survol ✅[10].
- **Ombres** : toujours multicouches (4 couches pour une carte bento) ✅[10].

### 2.8 Resend
- Hero en 3D (cube) réalisé avec Spline, recréé par la communauté en three.js ✅[11].
- Changelog hebdomadaire : titre, 1–2 phrases, une capture, cohérence visuelle stricte ✅[17].
- **À retenir** : la constance du changelog ; pas la 3D (coût et poids hors budget pour un fondateur solo).

### 2.9 PostHog
- Ton et visuel décalés (hérisson dessiné, jaune #F9BD2B) ; annotations manuscrites tracées au scroll (≈600 ms), cartes décalées de
  80 ms, boutons qui montent de 2 px (180 ms) ✅[12].
- **Tarifs** : calculateur d'usage, paliers gratuits détaillés produit par produit, prix marginaux par tranche ✅[13].
- **À retenir** : la transparence tarifaire et un calculateur qui répond à « combien je paierai / combien je gagnerai ».

### 2.10 Pennylane, Qonto, Alan, Swile (références françaises)
- **Qonto** ✅[14] : refonte d'identité avec ~80 pages réécrites et illustrées, illustrations en 3 usages (métaphore, pas-à-pas
  littéral, UI produit avec ombres légères et contours gris), photos de clients réels en noir et blanc au flash.
- (≈) **Pennylane** : hero avec capture de l'interface en grand, onglets par profil (TPE, PME, experts-comptables), « Demander une
  démo » très visible, logos de clients et note d'avis.
- (≈) **Alan** : illustrations maison, ton chaleureux, transparence (pages « mémos » publiques), prix affichés.
- (≈) **Swile** : couleurs vives, cartes produit en 3D, vidéos courtes en boucle.
- **À retenir** : vouvoiement et clarté, illustrations au service de l'explication pas-à-pas, preuves françaises.

### 2.11 Profound et Peec (concurrents directs en visibilité IA)
- **Profound** ✅[15] : recrute pour une équipe design très orientée mouvement (« obsède sur un easing de 2 images »), interface
  sombre (#08090A), sujets : agents, visibilité, tableaux de bord, recherche de prompts ; nav « Get a Demo » + « Log in ».
- **Peec** ✅[16] : titre « AI search analytics for marketing teams », tableau de bord avec courbe de visibilité et classement,
  vue sources par domaine, 4 paliers de 95 à 495 $/mois (+ entreprise), pas d'essai gratuit (selon une revue écrite par un
  concurrent : à recouper). Micro-animations au survol citées comme exemple ✅[19].
- **À retenir** : les deux montrent le **tableau de bord** dès le hero. Repéré a un avantage visible à exploiter : test gratuit,
  français, travail fait — mais il doit le **montrer en mouvement**.

### 2.12 Démos interactives (Navattic, Arcade)
- **Navattic 2026** ✅[20] : 5 à 13 étapes par parcours (top 10 %) ; infobulles de 25–30 mots, étape 1 de 10–20 mots ; 72 % ouvrent
  par une modale d'intro ; 66 % des meilleures ne sont pas protégées par formulaire ; CTA « au-dessus de la ligne » et nav : 68 % de
  clic ; démos multi-parcours : 57 % de complétion contre 35 % ; mobile : 1,2 min contre 2,7 sur bureau.
- **Arcade 2026** ✅[21] (14 M de sessions) : 9–12 étapes = 40 % de complétion ; passé l'étape 7, ×2,3 de chances de finir ; libellés
  < 60 caractères ; formulés en question, +40 % de clics ; le contenu « payant » ne doit pas être enfoui aux étapes 8–10.
- **Choix pour Repéré** : 8 étapes, non protégée, ouverte depuis le hero et la nav, contenu clé aux étapes 2–6.

### 2.13 Tendances transverses 2026
- Hero narratif « problème → solution » avec animation du flux produit ; aperçus produit immersifs ; avant/après en vis-à-vis
  (curseur glissant) ; captures réelles plutôt que 3D abstraite ; CTA collant ✅[19].
- Bento : 5 à 10 cellules, la plus importante la plus grande, visuel = 60–70 % de la hauteur, survol 200–300 ms (montée 4–8 px),
  1 colonne sous 768 px en réordonnant par importance ✅[22].

### Tableau de synthèse

| | Hero | Animation | Vidéo | Démo cliquable | Preuve | Tarifs | Changelog |
|---|---|---|---|---|---|---|---|
| Linear | capture produit lumineuse | fondu scroll, UI animée, halo | — | — | logos gris + métriques nommées | teaser | ✅ étiqueté |
| Stripe | ruban WebGL | fondu seul | non | — | — | — | — |
| Vercel | dégradé parallaxe 0,85× | fondu 300 ms / 80 ms | — | — | — | survol carte | ✅ quotidien |
| Attio | produit + 3 CTA | — | — | ✅ | logos + citations | essai 14 j | — |
| Clerk | composants sur halo | tokens publiés | — | composants réels | — | — | — |
| Resend | 3D Spline | — | — | — | — | — | ✅ hebdo + capture |
| PostHog | illustration | annotations tracées | — | — | — | ✅ calculateur | — |
| Peec/Profound | tableau de bord | survol | — | « Get a demo » | levées, nb de marques | 4 paliers | — |
| **Repéré V2** | maquette statique, **sans CTA** | 1 keyframe | **non** | **non** (mais comptes démo) | chiffres d'études sourcés | onglets + bascule | **non** |

---

## 3. Le site actuel, section par section

| Section (accueil) | Constat (captures `home-desk-*`) | Écart / action V3 |
|---|---|---|
| En-tête | Propre, CTA « Test gratuit » ; pas d'entrée « Démo » | Ajouter « Voir la démo » (ouvre la visite guidée) |
| Hero | Titre fort ; carte ChatGPT statique à droite ; **aucun CTA** ; mobile : la carte commence à 610 px, sélecteur après 2 écrans | Storyboard §5.2 : formulaire + 2 boutons, scène jouée |
| Sélecteur « Vous êtes plutôt » | Bonnes cartes avec la question type | Remonter dans le hero sous forme d'onglets qui changent la scène |
| « Vos clients ont changé de réflexe » + chiffres | Texte en 2×2, chiffres sourcés | Compteurs animés (primitive 3) + bandeau IA suivies avant |
| Méthode 4 piliers | Belle alternance texte/maquette, frise 1-2-3-4 | Maquettes → scènes animées §5.3 ; frise collante qui se remplit (primitive 8) ; bouton « Voir en vrai (12 s) » vers le clip |
| « Les IA disent-elles des choses fausses ? » | Section sombre forte | Scène « faux → vrai » en avant/après (§5.6.3) |
| Lundi + fonctionnalités | Liste `<dl>` + digest | Remplacer la liste par la **grille bento** (§5.6.2) |
| Comparatif | Bon tableau | Garder ; ajouter la ligne « Démo visitable sans inscription » et « Prix publics » |
| Parcours et prix | Bien | Ajouter le lien vers le calculateur de ROI |
| FAQ, ressources, CTA final | Corrects | CTA final : formulaire inline + « Visiter le compte démo » |
| Absent | — | IA suivies, bento, avant/après, ROI, changelog, mur de preuves, vidéo |

Autres pages :
- **/pme, /local, /e-commerce** (`SegmentLanding.tsx`) : hero avec 2 boutons et maquette statique ; les 3 pages partagent la même
  structure → un seul composant à animer, gain ×3.
- **/tarifs** : onglets par parcours + bascule Mensuel/Annuel (« 2 mois offerts ») + carte « Recommandé » + tableau détaillé :
  au niveau des références. Manque : calculateur de ROI, animation du prix au changement de bascule, FAQ tarifs.
- **/geo** : page éditoriale propre (sommaire, sources). Manque : barre de progression de lecture, sommaire collant au bureau,
  schémas animés des « 7 leviers ».
- **/app** : très bonne base (phrase de la semaine, rang en cadre de visée, tâches, alertes, barre mobile). Animations limitées à
  `rp-settle` (0,5 s) ; `prefers-reduced-motion` déjà respecté. Voir §5.7.

---

## 4. Principes de mouvement Repéré (à afficher en tête du code)

1. **Le mouvement montre le produit, pas la décoration** (Stripe, Framer). Une seule signature : le **cadre de visée qui se resserre**.
2. **Chaque animation a une fin** : rien ne boucle indéfiniment sans bouton pause (WCAG 2.2.2 : tout mouvement automatique de
   plus de 5 s doit pouvoir être mis en pause).
3. **Honnêteté** : toute scène est étiquetée « Exemple » ou « Démo » ; les vidéos montrent l'app réelle sur un compte démo, badge
   « Démo » visible ; une transcription texte accompagne chaque scène.
4. **Lisible sans animation** : l'état final est le rendu serveur ; l'animation n'est qu'un chemin vers cet état
   (pas de contenu caché si le JS ne charge pas).
5. **Budget** : +8 ko gzip de JS maximum pour l'accueil ; aucune vidéo chargée avant interaction ou entrée à l'écran ; LCP inchangé
   (le titre reste l'élément LCP, jamais animé en opacité).

---

## 5. Spécification design V3

### 5.1 Système d'animation

#### 5.1.1 Tokens (à ajouter dans `globals.css`, bloc `:root`)

```css
:root {
  /* Durées */
  --dur-instant: 100ms;  /* survol entrant, pression */
  --dur-fast:    150ms;  /* sortie, fermeture */
  --dur-base:    220ms;  /* icônes, retours de formulaire, onglets */
  --dur-slow:    400ms;  /* déplacements, morphing, reveal */
  --dur-scene:   700ms;  /* entrée de scène, jauge, tracé de courbe */
  --stagger:      70ms;  /* décalage entre éléments frères */

  /* Courbes */
  --ease-out:     cubic-bezier(.2, .8, .2, 1);   /* déjà utilisée dans lock-on / reveal-up : on la garde comme courbe maison */
  --ease-ui:      cubic-bezier(.33, 1, .68, 1);  /* transitions d'interface */
  --ease-in-out:  cubic-bezier(.65, 0, .35, 1);  /* déplacements du curseur fantôme, caméra */
  --ease-spring:  cubic-bezier(.175, .885, .32, 1.275); /* léger dépassement : flèches, coches, badges */
  --ease-linear:  linear;                        /* marquee, progression */

  /* Distances */
  --rise: 12px;     /* reveal */
  --lift: 2px;      /* survol bouton */
  --lift-card: 4px; /* survol carte */
}
@media (prefers-reduced-motion: reduce) {
  :root { --rise: 0px; --lift: 0px; --lift-card: 0px; --stagger: 0ms; }
}
```

Règles : jamais `transition: all` ; n'animer que `transform`, `opacity`, `filter` (≤ 4 px), `clip-path`, `stroke-dashoffset`,
`background-color`. Entrée plus lente que la sortie (asymétrie 150/210 ms, cf. [18]).

#### 5.1.2 Architecture (zéro dépendance)

```
src/lib/motion/
  prefs.ts          // reduced(): boolean ; onReducedChange(cb)
  inview.ts         // inView(el, cb, {threshold, once}) : IntersectionObserver partagé
  timeline.ts       // runScene(steps, {signal}) : orchestrateur async, pause/reprise, hors écran = pause
  primitives.ts     // countUp, typeText, drawPath, morphGauge, ghostCursor, tilt
src/components/motion/
  Reveal.tsx        // <Reveal as="li" delay={i}> ; data-in posé par IO ; CSS fait le reste
  Counter.tsx
  Typewriter.tsx    // remplace la logique de ChatScene.tsx (à réutiliser)
  Marquee.tsx
  ScrollProgress.tsx
  ScenePlayer.tsx   // cadre + bouton pause/rejouer + transcription sr-only
  GhostCursor.tsx
```

Poids estimé : ~5,5 ko gzip pour l'ensemble (mesuré sur des implémentations équivalentes ; à vérifier au build).
**`motion` (framer-motion) n'est pas nécessaire.** Si un jour on veut des ressorts physiques dans l'app, prendre `useAnimate`
« mini » (≈2,3 ko) et non `motion` complet (≈34 ko) ; `m` + `LazyMotion` = ≈6 ko + 15 ko (`domAnimation`) [23].

`timeline.ts` (cœur des scènes) :

```ts
export type Step = (ctx: { signal: AbortSignal; wait: (ms: number) => Promise<void> }) => Promise<void> | void;

export async function runScene(steps: Step[], opts: { signal: AbortSignal; isPaused: () => boolean }) {
  const wait = (ms: number) =>
    new Promise<void>((res, rej) => {
      let left = ms, last = performance.now();
      const tick = (t: number) => {
        if (opts.signal.aborted) return rej(new DOMException('abort', 'AbortError'));
        if (!opts.isPaused() && !document.hidden) left -= t - last;
        last = t;
        left <= 0 ? res() : requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  for (const s of steps) await s({ signal: opts.signal, wait });
}
```

`ScenePlayer` : met la scène en pause quand elle sort de l'écran (IO à 0,25) ou quand l'onglet est masqué ; affiche un bouton
« Pause / Lecture / Rejouer » (44×44 px, `aria-pressed`) ; rend la **transcription** en `sr-only` ; en mouvement réduit, rend
directement l'état final et remplace « Lecture » par « Voir étape par étape » (flèches précédent/suivant, sans mouvement).

#### 5.1.3 Les 12 primitives

| # | Primitive | Implémentation | Paramètres par défaut | Mouvement réduit |
|---|---|---|---|---|
| 1 | **Reveal au scroll** | IO (seuil 0,15, `rootMargin: 0px 0px -10% 0px`, une fois) pose `data-in`. CSS : `[data-reveal]{opacity:0;translate:0 var(--rise)}` `[data-reveal][data-in]{opacity:1;translate:0 0;transition:opacity var(--dur-slow) var(--ease-out),translate var(--dur-slow) var(--ease-out)}`. Classe `js` sur `<html>` posée en ligne dans `<head>` : sans JS, rien n'est masqué. | 400 ms, 12 px | opacité seule, 150 ms |
| 2 | **Stagger** | `style="--i:3"` sur chaque enfant ; `transition-delay: calc(var(--i) * var(--stagger))`, plafonné à 6 enfants (`min(var(--i),6)`) | 70 ms | 0 |
| 3 | **Compteur** | rAF, `easeOutCubic`, 900 ms, formaté `Intl.NumberFormat('fr-FR')` (espace insécable, virgule décimale), chiffres tabulaires ; le nombre final est dans le HTML serveur ; `aria-hidden` sur la valeur animée + valeur finale en `sr-only` | 900 ms | valeur finale directe |
| 4 | **Typewriter** | Généraliser `ChatScene` : tokens texte/nom ; 32 ms/caractère pour la question, 2 caractères/18 ms pour la réponse (vitesse « streaming » d'IA) ; curseur `blink` 1 s steps(1) ; bouton « Passer » | 32 ms/car. | texte complet |
| 5 | **Tilt** | `pointermove` throttlé rAF, `rotateX/Y` ±4°, `perspective: 1200px`, reflet radial qui suit le pointeur (`--mx --my`) ; activé seulement si `(hover:hover) and (pointer:fine)` ; retour en 400 ms `--ease-out` | ±4° | désactivé |
| 6 | **Marquee** | 2 copies de la liste dans une piste `display:flex; width:max-content`, `@keyframes marquee { to { translate: -50% } }`, 40 s linéaire ; masque dégradé aux bords ; pause au survol et au focus ; 2e copie `aria-hidden` + `inert` | 40 s | liste statique centrée qui passe à la ligne |
| 7 | **Parallaxe légère** | `@supports (animation-timeline: view())` : `animation: plx linear both; animation-timeline: view(); animation-range: cover` avec `@keyframes plx { from{translate:0 24px} to{translate:0 -24px} }` sur la trame `scope-grid` et les halos ; **jamais sur du texte** ; sans support : rien (statique) | ±24 px | désactivée |
| 8 | **Progression de scroll** | CSS : `animation-timeline: scroll(root)` sur une barre `scaleX(0→1)` (pages /geo, /guides) ; et `view()` sur la frise des 4 piliers (chaque segment se remplit pendant que son pilier traverse l'écran). Repli : IO qui pose `data-active` sur l'étape courante | — | barre visible, sans remplissage animé ; étape active surlignée |
| 9 | **Morphing de jauge** | Étendre `ScoreGauge` : arc SVG `pathLength=100`, `stroke-dashoffset` animé 0→score (700 ms `--ease-out`) ; la couleur change **aux seuils** (39→40, 69→70) avec un fondu de 150 ms, et le libellé (« Invisible » → « Peu visible » → « Bien recommandé ») bascule en `letter-reveal` (opacité + flou 2 px→0, 300 ms) ; le cadre de visée se resserre à l'arrivée (`lock-on`) | 700 ms | valeur finale |
| 10 | **Graphique qui se trace** | `<path pathLength="1" stroke-dasharray="1" stroke-dashoffset="1">` → 0 en 900 ms `--ease-in-out` ; l'aire sous la courbe en `clip-path: inset(0 100% 0 0)` → `inset(0 0 0 0)` synchronisée ; le point final apparaît en `--ease-spring` 220 ms ; l'annotation (« Semaine 6 : 20 fiches réécrites ») tombe après | 900 ms | tracé complet |
| 11 | **Curseur fantôme** | `GhostCursor` : SVG de flèche 20 px (encre #1B1F2E, contour blanc 1,5 px, ombre douce) en `position:absolute` dans le cadre de la scène ; `moveTo(target)` calcule le centre de `target.getBoundingClientRect()` relatif au cadre et anime avec WAAPI (`el.animate([{translate:a},{translate:b}], {duration: clamp(dist*1.1, 350, 900), easing:'cubic-bezier(.65,0,.35,1)'})`) ; `click()` = cercle de 28 px qui s'étend et s'efface (300 ms) + `scale(.94)` du cadre de la cible 100 ms ; `type(text)` délègue au typewriter. Toujours `aria-hidden`. Ne s'affiche que dans les scènes, jamais par-dessus du vrai contenu cliquable | voir scènes | absent ; état final |
| 12 | **Transitions de page** | Next 15.5 + React 19.1 : `<ViewTransition>` de React exige React 19.3 [18] → **pas maintenant**. V3 : (a) site : `app/(site)/template.tsx` qui joue `reveal-up` 210 ms sur `<main>` (l'en-tête ne bouge pas) ; (b) app : changement d'onglet et de compte démo enveloppé dans `document.startViewTransition` si disponible (Chrome 111, Firefox 130, Safari 18 [24]), fondu enchaîné 150/210 ms, en-tête et barre latérale nommés `view-transition-name` et figés. Migration vers `<ViewTransition>` à la montée de version React (ticket à ouvrir) | 150/210 ms | instantané |

CSS commun de réduction (remplace le bloc actuel, plus fin que le « tout à 0,01 ms ») :

```css
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  [data-reveal] { translate: none !important; transition-duration: 150ms !important; }
  .marquee-track { animation: none !important; flex-wrap: wrap; justify-content: center; }
  .plx, .scroll-progress-fill { animation: none !important; }
  ::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*) { animation-duration: 0s !important; }
}
```
On garde les fondus d'opacité courts (ils ne déclenchent pas les troubles vestibulaires), on supprime tout déplacement.

---

### 5.2 Storyboard du nouveau hero (accueil)

**Mise en page bureau (≥1024 px)** : grille 1,1 fr / 1 fr.
- Gauche : pastille « Le référencement IA des entreprises françaises » → H1 inchangé (LCP, jamais animé) → sous-titre → **onglets
  de parcours** (« Commerce », « PME et services », « E-commerce ») → **mini-formulaire** (1 champ « Votre entreprise ou votre site »
  + bouton « Tester gratuitement ») → lien secondaire « ▶ Voir la démo (52 s) » + « Visiter le compte démo » → réassurance
  (« Gratuit · Sans carte · Résultat en quelques minutes »).
- Droite : **scène « Qui l'IA recommande ? »** dans un cadre `app-frame`, sur un halo radial indigo→ambre très doux, trame de visée en
  parallaxe légère.
- Sous le hero : **bandeau des IA suivies** (§5.6.1).

**Mobile** : H1 réduit à 2,1 rem (5 lignes max), formulaire juste sous le sous-titre (au-dessus de 700 px de hauteur), scène en
dessous, en version compacte (1 IA à la fois, en carrousel).

**Scène du hero (durée totale 9,6 s, puis s'arrête sur l'état final ; bouton Rejouer)** — exemple PME par défaut, change selon l'onglet :

| t (s) | État | Détail |
|---|---|---|
| 0,0 | Cadre vide, barre « Exemple » | Le cadre entre en fondu-montée 400 ms |
| 0,4 | Question tapée | « Quel logiciel de paie pour une PME de 40 salariés ? » en typewriter (32 ms/car., ≈1,7 s), curseur clignotant |
| 2,2 | 4 onglets d'IA apparaissent | ChatGPT, Gemini, Perplexity, Claude (pastilles monochromes, nom écrit) en stagger 70 ms |
| 2,6 | « Réflexion » | 3 points `dot` 700 ms sous chaque onglet, décalés de 120 ms |
| 3,3 | Réponses en streaming | 4 mini-réponses de 3 noms chacune s'écrivent en parallèle (2 car./18 ms) ; ChatGPT au premier plan, les 3 autres en cartes empilées décalées (8 px, 92 % d'échelle) |
| 5,0 | **Repéré** | Dans les réponses où l'entreprise apparaît, son nom passe en `lock-on` (cadre qui se resserre 1,1 s) ; dans Gemini, une pastille « Absent » rouge entre en `--ease-spring` |
| 6,2 | Synthèse | Les cartes se rangent en ligne (transition 400 ms) ; une barre récapitulative glisse du bas : « Cité par 3 IA sur 4 · 13 réponses sur 36 · Confiance moyenne » |
| 7,0 | Jauge | Mini-jauge à droite de la barre : 0 → 46, la couleur passe de rouge à orange au seuil 40, libellé « Peu visible » |
| 8,2 | Appel | Flèche discrète vers le formulaire : « Et vous ? » (texte, 220 ms) |
| 9,6 | Fin | État final figé. Bouton « Rejouer » |

Variantes par onglet (données d'exemple déjà dans `HERO_ANSWERS`) : Local = Plomberie Martin (question « plombier dans le 11e, le
dimanche ? »), E-commerce = Maison Sora (« crème solaire bio sans traces blanches ? »). Changer d'onglet relance la scène avec
fondu enchaîné 150/210 ms et met à jour le placeholder et l'action du formulaire (`/audit?segment=…`).

Accessibilité : transcription complète en `sr-only` ; `aria-live` **désactivé** sur la scène (sinon le lecteur d'écran lit le
streaming) ; bouton Pause atteignable au clavier en 2 tabulations depuis le H1 ; étiquette « Exemple fictif ».

Performance : la scène est un Client Component chargé après hydratation (`dynamic(() => import(...), { ssr: true })` avec état final
rendu serveur) ; aucune image ; pastilles d'IA en SVG inline monochromes (pas les logos officiels, voir §5.6.1).

---

### 5.3 Les 4 scènes produit animées (piliers)

Cadre commun : `AppFrame` existant (compte, chemin, badge « Démo »), 560×420 px max, `ScenePlayer` (déclenchée quand 45 % visible,
pause hors écran, Rejouer). Le curseur fantôme « utilise » le produit. Chaque scène se termine sur l'état qu'affiche aujourd'hui la
maquette statique (donc aucune régression si le JS échoue). Sous chaque scène : lien « Voir en vrai dans l'app (12 s) » qui ouvre le
clip vidéo correspondant (§5.4) en modale.

#### Scène 1 — Mesurer (compte Paysia, `/app/ia`) — 8,0 s

| t | État | Primitive |
|---|---|---|
| 0,0 | Titre « Question suivie, posée 12 fois cette semaine » ; la question se tape : « Meilleur logiciel de paie pour PME ? » | typewriter |
| 1,6 | 3 colonnes ChatGPT / Gemini / Perplexity entrent en stagger | reveal + stagger |
| 2,0 | Dans chaque colonne, les 3 noms s'empilent ; « Paysia » arrive 3e chez ChatGPT, absent chez Gemini, 2e chez Perplexity | stagger 90 ms |
| 3,0 | Badges « ✓ Cité, 3e », « ✗ Absent », « ✓ Cité, 2e » en léger rebond | `--ease-spring` |
| 3,8 | Le curseur glisse vers « Part de voix, 50 questions » et clique | curseur fantôme |
| 4,4 | Barres de part de voix qui poussent depuis 0 (Paylo 34 %, Netpaie 22 %, **Paysia 18 %**, Silva RH 14 %, Bulletin+ 12 %), pourcentages en compteur | compteur + `scaleX` 700 ms |
| 5,6 | La barre Paysia prend la couleur primaire, cadre de visée autour de la ligne | lock-on |
| 6,4 | Mention « 600 réponses analysées · Confiance : moyenne » en fondu | reveal |
| 8,0 | Fin | — |

#### Scène 2 — Comprendre (Paysia, `/app/sources` puis comparaison) — 9,0 s

| t | État |
|---|---|
| 0,0 | Tableau « Les pages que lisent les IA » : 5 lignes en stagger (domaine, type, nombre de citations en compteur) |
| 1,2 | Les pastilles « Absent » / « Présent » se posent ligne par ligne (rouge / vert, 120 ms d'écart) |
| 2,4 | Le curseur survole « meilleurs-logiciels-rh.fr — 14× — Absent » : la ligne se surligne, infobulle « Lu par ChatGPT dans 14 réponses » |
| 3,4 | Clic → la carte « Pourquoi Paylo passe devant » se déplie en dessous (hauteur via `grid-template-rows: 0fr → 1fr`, 400 ms) |
| 4,2 | 3 comparaisons apparaissent en vis-à-vis : Avis publics **412 contre 38**, Sources citées **9/15 contre 4/15**, Page comparatif **Oui contre Non** ; les chiffres comptent, les écarts sont soulignés en ambre |
| 6,0 | Bouton « Créer la tâche » apparaît en `--ease-spring` ; le curseur le survole (montée 2 px) |
| 7,0 | Clic → toast « Tâche ajoutée à la semaine » en bas à droite (fondu-montée, part après 1,5 s, comme le HUD de Raycast [8]) |
| 9,0 | Fin |

#### Scène 3 — Agir (Paysia, `/app/taches`) — 9,5 s

| t | État |
|---|---|
| 0,0 | Carte de tâche « Publier la page « Paysia ou Paylo : lequel choisir ? » », étiquettes « Page citable », « 15 min de relecture » |
| 0,8 | « Pourquoi : 3 IA citent un comparatif pour cette question, et vous n'en avez aucun » en fondu |
| 1,6 | Le bloc « Texte prêt, extrait » s'écrit (typewriter rapide, 2 lignes), puis la ligne « + balisage FAQPage prêt (JSON-LD) » se déplie en `<details>` animé montrant 4 lignes de code colorées |
| 4,0 | Le curseur clique « Copier le texte » → le bouton devient « Copié ✓ » (coche tracée 220 ms), revient après 1,5 s |
| 5,4 | Le curseur clique « Valider la publication » → le bouton se transforme en barre de progression (600 ms) → « Publié le 9 nov. · Page en ligne » avec lien |
| 7,0 | La tâche glisse dans la colonne « Fait » ; le compteur « 1/3 faites » s'incrémente ; anneau de progression se remplit |
| 8,0 | Mention « Rien n'est publié sans votre accord » soulignée |
| 9,5 | Fin |

#### Scène 4 — Prouver (Maison Sora, `/app/trafic` puis rapport) — 9,0 s

| t | État |
|---|---|
| 0,0 | « Visites venues des IA, 12 semaines » ; axe et grille en fondu |
| 0,4 | La courbe se trace (900 ms), l'aire suit |
| 1,4 | Repère vertical ambre « Semaine 6 : 20 fiches produit réécrites et balisées » tombe de 8 px |
| 2,2 | Le total compte jusqu'à **772** + badge « en hausse » ; « Commandes attribuées : 19 » compte |
| 3,4 | Répartition par source : 4 barres (chatgpt.com 81 %, perplexity.ai 9 %, Gemini 6 %, Copilot 4 %) |
| 4,6 | Le curseur clique « Rapport de novembre » → transition de vue : le graphique se réduit et devient la vignette de la 1re page du rapport PDF (morphing 400 ms) |
| 6,4 | La page de rapport affiche « Travail fait ce mois : 6 tâches » et « Citations : +5 » ; bouton « Télécharger le PDF » |
| 9,0 | Fin |

Mention sous la scène (honnêteté) : « Données de démonstration. Les effets réels varient ; nous ne promettons pas de résultat. »

---

### 5.4 Plan des vidéos de démo

#### 5.4.1 Formats et intégration

| Vidéo | Durée | Où | Lecture |
|---|---|---|---|
| **Héros « Repéré en 52 secondes »** | 52 s | bouton « ▶ Voir la démo (52 s) » du hero, page /methode, partage social | dans une `<dialog>` modale, **avec contrôles**, son coupé par défaut (il n'y a pas de voix ; option voix off plus tard), sous-titres VTT activés par défaut + version sous-titres incrustés pour réseaux sociaux |
| **Clip Mesurer / Comprendre / Agir / Prouver** | 12 s chacun | lien « Voir en vrai » sous chaque scène ; pages /local /pme /e-commerce ; changelog | `autoplay muted loop playsinline` **seulement quand visible** (IO : `play()` à 50 %, `pause()` à 0 %), `preload="none"`, poster obligatoire, bouton pause visible |

Encodage (pour chaque vidéo) :
- `*.mp4` H.264 High, `yuv420p`, CRF 20, `-movflags +faststart` (Safari et tous) ; `*.webm` AV1 (`libaom-av1` CRF 34) ou VP9
  (CRF 33) en premier `<source>` ; poster `*.jpg` (qualité 82) extrait de l'image finale (pas de la première, qui est vide).
- Résolution : 1920×1080 pour la vidéo héros (et 1080×1350 recadrée pour LinkedIn) ; 1280×800 pour les clips.
- Cibles de poids : héros ≤ 6 Mo, clip ≤ 1,2 Mo (texte d'UI net : préférer CRF bas + 30 i/s plutôt que 60 i/s).
- Hébergement : `public/media/` (Vercel sert en CDN) ; si le poids total dépasse 25 Mo, passer sur un stockage Supabase public.

```html
<video class="clip" muted loop playsinline preload="none" poster="/media/clip-agir.jpg"
       aria-label="Démo : une tâche préparée puis validée dans Repéré (compte démo, 12 s)">
  <source src="/media/clip-agir.webm" type="video/webm; codecs=av01.0.05M.08">
  <source src="/media/clip-agir.mp4" type="video/mp4">
  <track kind="captions" srclang="fr" label="Français" src="/media/clip-agir.fr.vtt" default>
</video>
```

#### 5.4.2 Chaîne d'enregistrement (Playwright 1.63 installé, ffmpeg 6.1 avec libass installé)

Pourquoi pas `recordVideo` seul : l'encodeur intégré est figé en VP8 à 1 Mb/s, texte d'UI baveux [25]. Utiliser
**`page.screencast`** (Playwright ≥ 1.59) qui livre des JPEG à injecter dans ffmpeg x264 [25] ; `recordVideo` reste le repli.

Fichier `scripts/video/record.mjs` (à créer dans une **copie isolée** du projet, jamais dans `/home/claude/auditia/app`, serveur lecture
seule sur :3000 utilisable tel quel) :

```js
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const BASE = 'http://localhost:3000';
const W = 1280, H = 720, DSF = 1.5;            // capture 1920×1080 nette
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DSF, locale: 'fr-FR',
  reducedMotion: 'no-preference', colorScheme: 'light' });
await ctx.addCookies([{ name: 'rp_demo_segment', value: 'local', url: BASE }]); // compte démo Plomberie Martin
await ctx.addInitScript(cursorScript);         // curseur visible (voir plus bas)
const page = await ctx.newPage();

// ffmpeg : JPEG sur stdin → mp4 intermédiaire de haute qualité
const ff = spawn('ffmpeg', ['-y', '-f', 'image2pipe', '-framerate', '30', '-i', '-', '-fps_mode', 'passthrough',
  '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '14', '-pix_fmt', 'yuv420p', 'raw.mp4']);
// horloge murale → numéro d'image ; on répète la dernière image pour combler les trous (CDP n'émet rien sur page immobile)
let last = null, n = 0; const t0 = performance.now();
const push = () => { const due = Math.floor((performance.now() - t0) / (1000 / 30)); while (last && n <= due) { ff.stdin.write(last); n++; } };
await page.screencast.start({ size: { width: 1920, height: 1080 }, quality: 92, onFrame: (buf) => { last = buf; push(); } });
const filler = setInterval(push, 33);

await shots(page);                              // le script plan par plan ci-dessous

clearInterval(filler); await page.screencast.stop(); ff.stdin.end(); await browser.close();
```

Vérifier au premier lancement la taille réelle des JPEG reçus (le premier client CDP peut l'imposer [25]) ; si l'API `screencast`
diffère dans 1.63, repli : `recordVideo: { dir, size: { width: 1920, height: 1080 } }` puis ré-encodage.

**Curseur visible** (Chromium sans tête n'affiche pas le pointeur) — `cursorScript` injecté :

```js
const cursorScript = () => addEventListener('DOMContentLoaded', () => {
  const c = Object.assign(document.createElement('div'), { id: '__cur' });
  c.innerHTML = '<svg width="22" height="22" viewBox="0 0 22 22"><path d="M3 2l15 8-6.5 1.6L9 18z" fill="#1B1F2E" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>';
  Object.assign(c.style, { position: 'fixed', left: 0, top: 0, zIndex: 2147483647, pointerEvents: 'none', transition: 'transform 40ms linear' });
  document.body.append(c);
  addEventListener('mousemove', (e) => (c.style.transform = `translate(${e.clientX - 3}px, ${e.clientY - 2}px)`), true);
  addEventListener('mousedown', (e) => { const r = document.createElement('div');
    Object.assign(r.style, { position: 'fixed', left: e.clientX - 14 + 'px', top: e.clientY - 14 + 'px', width: '28px', height: '28px',
      borderRadius: '50%', border: '2px solid #F5A524', zIndex: 2147483646, pointerEvents: 'none' });
    document.body.append(r);
    r.animate([{ transform: 'scale(.4)', opacity: 1 }, { transform: 'scale(1.4)', opacity: 0 }], { duration: 380, easing: 'ease-out' }).onfinish = () => r.remove(); }, true);
});
```

Déplacements naturels : `moveTo(page, locator)` = centre de la `boundingBox()`, `page.mouse.move(x, y, { steps: 28 })` après un
léger arc (point de contrôle décalé de 40 px) ; pause de 350 ms avant chaque clic ; `locator.pressSequentially(text, { delay: 45 })`
pour la frappe ; attendre un **état** (`expect(locator).toBeVisible()`) plutôt qu'une durée quand c'est possible.

**Zoom et « caméra »** : on capture en 1920×1080 (DSF 1,5) et on cadre en post-production par plan, sans flou :
`crop=1280:720:x:y,scale=1920:1080:flags=lanczos` pour les gros plans (zoom ×1,5 net grâce au DSF) ; transitions de cadrage
par fondu enchaîné de 300 ms (`xfade=fade`) plutôt que par travelling (plus sobre, plus lisible). Les cadrages sont décrits dans
`scripts/video/shots.json` (début, fin, x, y, zoom).

**Sous-titres** : un `hero.fr.srt` (et `.vtt` pour le web). Incrustation :

```bash
ffmpeg -i edit.mp4 -vf "subtitles=hero.fr.srt:fontsdir=./fonts:force_style='FontName=Inter,FontSize=20,Bold=1,PrimaryColour=&H00FFFFFF,BackColour=&H402E1F1B,BorderStyle=4,Outline=0,Shadow=0,MarginV=48'" \
  -c:v libx264 -crf 20 -preset slow -pix_fmt yuv420p -movflags +faststart hero-subbed.mp4
ffmpeg -i hero-subbed.mp4 -c:v libaom-av1 -crf 34 -b:v 0 -cpu-used 4 -row-mt 1 hero.webm
ffmpeg -sseof -0.1 -i hero-subbed.mp4 -frames:v 1 -q:v 3 hero.jpg   # poster = image finale
```
(`BackColour` en `&HAABBGGRR`, alpha 00 = opaque : `40` = encre #1B1F2E à 75 % d'opacité.) Polices : copier Inter 600 depuis
`@fontsource/inter` dans `./fonts`. Règles de sous-titres : 2 lignes max, 38 caractères par ligne, 1,2 à 6 s par carton,
vouvoiement, phrases du ton de marque.

Honnêteté : la barre « Compte démo. Données d'exemple réalistes » reste visible au moins dans le premier et le dernier plan ;
carton final « Données de démonstration. Testez votre entreprise gratuitement : repere… ». Pas de fausse donnée client ; pas de
musique sous licence douteuse (si musique : piste libre de droits, citée dans les mentions).

#### 5.4.3 Vidéo héros « Repéré en 52 secondes » — compte démo Local (Plomberie Martin), 1920×1080

| Plan | t (s) | URL / action Playwright | Cadrage | Sous-titre |
|---|---|---|---|---|
| 1 | 0–5 | Page d'accueil, scène hero jouée (onglet « Commerce ») | plein cadre puis zoom ×1,3 sur la scène | « Vos clients demandent à ChatGPT quel plombier appeler. » |
| 2 | 5–9 | Fin de scène : « Absent » sur Gemini, jauge 46 | gros plan jauge | « Repéré vérifie si les IA vous citent. Chaque semaine. » |
| 3 | 9–14 | `goto('/app')` ; laisser la « phrase de la semaine » apparaître | plein cadre | « Le lundi, une phrase : ce qui a changé pour vous. » |
| 4 | 14–19 | survol du rang « 3e sur 10 plombiers du 11e » | zoom ×1,5 sur le cadre de rang | « Votre rang face aux concurrents du quartier. » |
| 5 | 19–25 | clic « Ce que disent les IA » (nav) ; défiler jusqu'à « Question par question » | plein cadre puis zoom tableau | « Question par question : qui est cité, qui ne l'est pas. » |
| 6 | 25–31 | clic « Vérité » ; l'erreur d'horaires de Gemini en rouge face à la fiche de vérité en vert | zoom ×1,4 | « Une IA donne de mauvais horaires ? Vous êtes prévenu. » |
| 7 | 31–36 | clic « Sources » ; survol de la 1re source « Absent » | zoom ligne | « Les sites que lisent les IA, et ceux où il vous manque. » |
| 8 | 36–43 | clic « Tâches » ; ouvrir la 1re tâche ; « Copier le texte » ; « C'est fait » | plein cadre puis zoom bouton | « Chaque action arrive prête. Ou nous la faisons pour vous. » |
| 9 | 43–48 | clic « Trafic IA » ; la courbe est visible | zoom courbe | « Les visites venues des IA, mesurées sur votre site. » |
| 10 | 48–52 | carton final (page HTML locale `scripts/video/end.html` : logo, « Testez votre entreprise gratuitement », mention démo) | plein cadre | « Données de démonstration. Résultat en quelques minutes. » |

#### 5.4.4 Les 4 clips de 12 s — 1280×800, sans carton, boucle propre (dernière image ≈ première)

| Clip | Compte (cookie) | Plans |
|---|---|---|
| **Mesurer** | `pme` (Paysia) | 0–4 s `/app/ia` haut de page, notes par IA ; 4–9 s défilement doux (`mouse.wheel` par pas de 80 px) jusqu'à « Question par question », survol d'une ligne ; 9–12 s retour en haut (fondu). Sous-titre : « Vos vraies questions, posées aux IA chaque semaine. » |
| **Comprendre** | `pme` | 0–5 s `/app/sources`, survol d'une source « Absent » ; 5–12 s `/app/concurrents`, courbe de part de voix, survol du concurrent devant. « Pourquoi eux, et pas vous. » |
| **Agir** | `local` | 0–3 s `/app/taches` ; 3–8 s ouvrir une tâche « Prêt à coller », « Copier » ; 8–12 s « C'est fait », la barre « 1/3 faites » avance. « Le travail, prêt ou fait pour vous. » |
| **Prouver** | `ecommerce` (Maison Sora) | 0–6 s `/app/trafic`, survol de la courbe ; 6–12 s `/app/rapports`, ouverture du rapport du mois. « La preuve, chaque mois. » |

Les sélecteurs exacts sont à écrire avec `getByRole('link', { name: 'Tâches' })` etc. sur la barre latérale réelle (libellés vus sur
`app-desk-fold.png`) ; si une action modifie l'état (cocher « C'est fait »), réinitialiser le compte démo entre deux prises
(rechargement de la page : le mode démo est local au navigateur, `localDemo.ts`).

---

### 5.5 Démo interactive guidée (visite du compte démo)

**Pourquoi maison** : Navattic/Storylane/Arcade sont payants et capturent des copies HTML figées ; nous avons déjà l'app réelle en
mode démo sans clé. On construit une visite **par-dessus l'app vivante**.

**Entrées** : bouton « Visiter le compte démo » (hero, en-tête, CTA final, pages segments) → `/app?visite=1` ; non protégée par
formulaire (66 % des meilleures démos ne le sont pas [20]). Segment pris depuis l'onglet du hero.

**Composant** `src/components/app/Tour.tsx` (~3 ko) : cible par `data-tour="…"` ; anneau de focus autour de la cible (`box-shadow:
0 0 0 4px var(--accent), 0 0 0 9999px rgba(27,31,46,.45)` sur un calque, avec trou à la taille de la cible, transition 400 ms
`--ease-in-out` d'une cible à l'autre) ; infobulle ancrée (haut/bas/gauche/droite selon la place, flèche 8 px) ; « Étape n/8 »,
« Précédent », « Suivant » (Entrée), « Quitter » (Échap) ; focus piégé dans l'infobulle, `role="dialog"` `aria-labelledby` ;
progression sauvegardée en `sessionStorage` ; sur mobile (< 640 px) : feuille du bas plein largeur au lieu d'une infobulle,
la cible défile au centre. Mouvement réduit : pas de glissement de l'anneau, saut direct.

Copie : ≤ 25 mots par infobulle, titre ≤ 50 caractères, formulé quand c'est naturel en question [21].

| # | Cible (`data-tour`) | Page | Titre | Texte (vouvoiement) | Action attendue |
|---|---|---|---|---|---|
| 0 | modale d'intro | /app | Bienvenue chez Plomberie Martin | « Un compte fictif, des données réalistes. 8 étapes, 90 secondes. » | « Commencer » |
| 1 | `phrase` | /app | Qu'est-ce qui a changé cette semaine ? | « Chaque lundi, une phrase résume ce qui a bougé. Ici, Gemini donne de mauvais horaires. » | Suivant |
| 2 | `rang` | /app | Où en êtes-vous face aux voisins ? | « 3e sur 10 plombiers du 11e. Fournier & Fils est juste devant, avec 2 citations de plus. » | Suivant |
| 3 | `nav-ia` → `grille-questions` | /app/ia | Qui est cité, question par question ? | « Nous posons vos vraies questions clients à 4 IA, plusieurs fois. Cliquez une ligne. » | clic sur une ligne (étape interactive) |
| 4 | `verite-ecart` | /app/verite | L'IA se trompe sur vous ? | « À gauche ce que dit Gemini, à droite votre fiche de vérité. L'écart déclenche une alerte. » | Suivant |
| 5 | `sources-absent` | /app/sources | Quels sites lisent les IA ? | « Les sources classées par opportunité. Rouge : vous n'y êtes pas encore. » | Suivant |
| 6 | `tache-1` | /app/taches | Que faire cette semaine ? | « Chaque tâche arrive prête : texte à coller, 15 minutes. Essayez « Copier ». » | clic « Copier » (interactive) |
| 7 | `trafic-courbe` | /app/trafic | Est-ce que ça marche ? | « Les visites venues de ChatGPT, Perplexity ou Gemini, mesurées sur votre site, sans cookie. » | Suivant |
| 8 | modale de fin | — | Et votre entreprise ? | « Testez gratuitement : résultat en quelques minutes, sans carte. » | « Tester mon entreprise » (→ /audit) ; secondaire « Continuer à explorer » |

Contenu clé aux étapes 1 à 6, deux étapes interactives (3 et 6) pour franchir le cap de l'étape 7 [21]. Mesure : événements
`tour_start`, `tour_step_n`, `tour_complete`, `tour_cta` dans le tracking sans cookie existant.

---

### 5.6 Nouvelles sections

#### 5.6.1 « Les IA que nous interrogeons » (sous le hero)
- Ligne : « Nous posons vos questions à » + pastilles **ChatGPT · Gemini · Perplexity · Claude** + « Bientôt : Copilot, Mistral Le Chat »
  (n'afficher « bientôt » que si c'est au plan produit).
- **Marques** : les logos officiels sont des marques déposées ; leur usage pour indiquer une compatibilité est courant mais chaque
  éditeur a ses règles. **Par défaut : nom écrit en Inter 600 + pastille monochrome générique** (pas le logo). Logos officiels
  seulement après lecture des chartes de marque de chaque éditeur (à faire par l'agent juridique).
- Animation : marquee (primitive 6) uniquement sur mobile si ça déborde ; sur bureau, ligne fixe avec stagger d'apparition ;
  chaque pastille au survol affiche une infobulle « Mode utilisé : avec recherche web / sans ancrage (Gemini) » — l'honnêteté sur la
  méthode est un argument.

#### 5.6.2 Grille bento des fonctionnalités (remplace la `<dl>` de la section « Lundi »)
Grille 4 colonnes bureau (unité 120 px, gouttière 20 px), 2 colonnes tablette, 1 colonne mobile réordonnée [22]. 7 cellules :

| Cellule | Taille | Visuel animé (au survol ou à l'entrée) |
|---|---|---|
| Le rendez-vous du lundi (digest) | 2×2 | l'e-mail du lundi s'écrit ligne par ligne (typewriter) |
| Ce que disent les IA | 2×1 | 4 pastilles d'IA, coche/croix qui basculent |
| Sources des IA | 1×1 | liste de domaines qui défile lentement (marquee vertical) |
| Fiche de vérité | 1×1 | « 01 43 57 … » barré → « 01 48 05 … » (avant/après en 600 ms) |
| Tâches prêtes | 2×1 | bouton « Copier » → « Copié ✓ » |
| Trafic IA (sans cookie) | 1×1 | sparkline qui se trace |
| Copilote | 1×1 | question → réponse en 2 lignes |

Visuel 60–70 % de la hauteur, titre 1–6 mots, 1 ligne de texte. Survol : montée 4 px, ombre multicouche, bordure primaire 1 px,
220 ms ; visuel animé joué **une fois** à l'entrée, rejoué au survol (pas de boucle infinie). Chaque cellule est un lien vers la
section de /methode correspondante.

#### 5.6.3 « Avant / après » (section sombre « Les IA disent-elles des choses fausses ? »)
Composant comparateur à poignée : deux états d'une réponse d'IA superposés (`clip-path: inset(0 0 0 var(--pos))`), poignée
draggable (pointer events) **et** `<input type="range">` natif pour le clavier (flèches ±5 %). Avant : « Plomberie Martin, 01 43 57 … 12,
fermé le dimanche » (faux, souligné rouge). Après : bonnes coordonnées, « urgences le dimanche » (vert). Légende obligatoire :
« Illustration. Corriger la source augmente les chances que l'IA se corrige ; le délai varie de quelques semaines à plusieurs mois. »
Animation d'invite : la poignée glisse de 50 % à 35 % puis revient (1,2 s) une seule fois à l'entrée. Mouvement réduit : les deux
états côte à côte.

#### 5.6.4 Calculateur de ROI (accueil, section prix, et /tarifs)
Titre : « Combien vaut un client recommandé par une IA ? »
Entrées (curseurs + champs numériques liés) : panier moyen ou valeur d'un client (€) ; nouveaux clients par mois aujourd'hui ;
parcours (Local/PME/E-commerce, pré-rempli depuis l'onglet). Paramètre affiché et modifiable : « part des demandes qui passent par
une IA » (valeur par défaut issue d'une étude citée dans `facts.ts`, avec lien source).
Sortie : « Pour couvrir l'Accompagné (99 €/mois), il suffit de **N client(s) de plus par an** venu(s) d'une IA » — calcul :
`ceil(prix_annuel / valeur_client)`. **On ne calcule pas de gain promis** : on calcule le **seuil de rentabilité**, ce qui respecte
« aucune promesse de résultat ». Animation : le résultat compte (primitive 3, 400 ms) à chaque changement ; barre « seuil »
qui se remplit. Lien « Comment nous calculons » (formule en clair).

#### 5.6.5 Comparatif
Garder `ComparisonTable`. Ajouts : colonne collante « Repéré » au défilement horizontal mobile ; lignes « Démo visitable sans
inscription », « Prix publics », « En français, vouvoiement », « Travail fait » ; lien vers /comparatif (concurrents nommés, prix
sourcés et datés — travail de l'agent concurrents). Révélation : lignes en stagger, coche de la colonne Repéré tracée.

#### 5.6.6 Changelog public `/nouveautes`
- Format Linear/Resend : une entrée = date, étiquette (`Nouveau` / `Amélioré` / `Corrigé`), titre ≤ 60 caractères, 1–3 phrases,
  une capture ou un clip de 6–12 s (même chaîne Playwright), lien vers la doc. Fichier source `content/nouveautes/*.md` (front-matter
  `date`, `tag`, `media`), page statique, flux RSS `/nouveautes/rss.xml`, JSON-LD `BlogPosting`.
- Amorcer avec l'historique réel : V1, V2 (9 nov. 2026 : 3 parcours, fiche de vérité, tracking sans cookie, digest du lundi…), V3.
- Bloc sur l'accueil : « Dernières nouveautés » (3 entrées, date relative « il y a 3 jours »), preuve d'un produit vivant.
- Rythme tenable par un fondateur solo : **une entrée par semaine** au maximum, une par mois au minimum.

#### 5.6.7 Mur de preuves honnêtes (remplace l'absence de logos clients)
Aucun faux client. Cinq tuiles :
1. **Méthode ouverte** : « 12 questions × 4 IA × 3 passages : comment nous calculons votre score » → /methode (avec schéma animé).
2. **Chiffres sourcés** : 3 chiffres d'études (déjà dans `FACTS`), compteur à l'entrée, source et date sous chaque chiffre.
3. **Garanties** : « Remboursé sous 14 jours si non satisfait (audit) », « Sans engagement (Essentiel) », « Rien publié sans votre
   accord », « Données hébergées dans l'UE ». Icône + phrase, aucune promesse de rang.
4. **Compteur réel** : « N audits réalisés depuis le JJ/MM » — **uniquement si le chiffre vient de la base** (requête Supabase,
   mise en cache 1 h) ; masqué en dessous d'un seuil (ex. 50) pour ne pas afficher un chiffre gênant. Jamais de chiffre inventé.
5. **On se teste nous-mêmes** : le score de Repéré mesuré par Repéré, mis à jour chaque semaine (dogfooding déjà présent dans le
   balisage de l'organisation), avec la courbe.
Quand de vrais clients existeront : témoignages avec nom, entreprise, ville et accord écrit, rangés au même endroit.

---

### 5.7 Micro-interactions de l'app (/app)

| Élément | Interaction | Détail |
|---|---|---|
| Bouton principal (`rp-btn-primary`) | survol / pression | montée 1 px + ombre plus profonde 150 ms ; pression `scale(.97)` 100 ms ; reflet diagonal 300 ms `cubic-bezier(.4,.36,0,1)` au survol (1 fois) |
| « C'est fait » (tâche) | cocher | coche SVG tracée 220 ms (`--ease-spring`), la ligne se replie (`grid-template-rows: 1fr→0fr` 300 ms) et file vers le compteur « n/3 faites » ; la barre de progression avance 400 ms ; à 3/3 : brève célébration (6 particules ambre + « Semaine bouclée », 900 ms, une fois par semaine, désactivable dans Réglages) — « célébration méritée et brève » [8] ; annuler 5 s (toast) |
| « Copier » | clic | libellé → « Copié ✓ » 1,5 s (`aria-live="polite"`), la coche se trace |
| Jauge et rang | arrivée | morphing de jauge (primitive 9) une fois par session ; le cadre de visée du rang se resserre |
| Chiffres (score, réponses, visites) | arrivée | compteur 600 ms ; deltas « ↑ +9 » en `--ease-spring` |
| Graphiques (part de voix, trafic) | arrivée / survol | tracé 900 ms ; survol : ligne verticale + infobulle qui suit (rAF), points 6 px |
| Changement d'onglet (barre latérale, barre mobile) | navigation | View Transition 150/210 ms si disponible ; indicateur de l'onglet actif qui glisse (position mesurée, 220 ms) ; en-tête et barre figés |
| Bascule de compte démo (Local/PME/E-commerce) | clic | fondu enchaîné du contenu, `aria-busy` déjà présent → ajouter un squelette 300 ms min pour éviter le flash |
| Squelettes de chargement | attente | reflet qui balaie 1,2 s, arrêt en mouvement réduit |
| Alertes | arrivée | entrée par la droite 12 px + fondu, pastille de compteur qui « rebondit » une fois |
| Copilote | réponse | streaming réel (déjà) + curseur clignotant ; suggestions de questions qui apparaissent en stagger |
| Toasts | confirmation | bas-droite (bureau) / au-dessus de la barre (mobile), disparaissent à 1,5–4 s selon la longueur, pause au survol/focus |
| Erreur de formulaire | validation | secousse horizontale ±4 px 240 ms **uniquement** si pas de mouvement réduit, + message lié par `aria-describedby` |

Tous ces effets passent par les tokens §5.1.1 ; le bloc `prefers-reduced-motion` existant de `app.css` est conservé.

---

### 5.8 Accessibilité, performance, contrôle qualité

- **WCAG** : 2.2.2 (pause pour tout mouvement > 5 s : scènes, marquee, vidéos en boucle) ; 2.3.3 (mouvement réduit) ; sous-titres
  pour toutes les vidéos (1.2.2) ; transcription texte des scènes ; focus visible conservé ; cibles ≥ 44 px.
- **Perf** : LCP = H1 (rendu serveur, police préchargée) ; scènes et visite chargées en différé ; vidéos `preload="none"` ;
  pas de `will-change` permanent (posé au début d'une animation, retiré à la fin) ; IO partagé ; animations limitées au composite.
  Budget : JS ajouté ≤ 8 ko gzip (accueil), CLS 0 (hauteur des scènes réservée par `min-height`/`aspect-ratio`).
- **Tests** : Playwright (dans la copie isolée) — instantanés visuels en `reducedMotion: 'reduce'` (état final stable) et
  `no-preference` après `ScenePlayer` « Passer » ; test que le H1 est visible à t=0 ; test clavier de la visite (Échap, Entrée) ;
  Lighthouse mobile ≥ 90 performance sur /.

### 5.9 Ordre de livraison conseillé

| Lot | Contenu | Effort estimé |
|---|---|---|
| L1 | Tokens + primitives 1, 2, 3, 6 + reveal sur tout le site + CTA dans le hero | 1 j |
| L2 | Hero joué (scène + onglets + formulaire) + bandeau IA suivies | 1,5 j |
| L3 | 4 scènes piliers + curseur fantôme + frise collante | 2 j |
| L4 | Visite guidée 8 étapes + entrées « Visiter le compte démo » | 1,5 j |
| L5 | Chaîne vidéo + 1 vidéo héros + 4 clips + sous-titres | 1,5 j |
| L6 | Bento, avant/après, calculateur, mur de preuves | 2 j |
| L7 | /nouveautes + bloc accueil + RSS | 0,5 j |
| L8 | Micro-interactions de l'app + transitions de vue | 1 j |

---

## 6. Fichiers concernés

- À modifier : `src/app/page.tsx` (hero, sections), `src/app/globals.css` (tokens, primitives, réduction), `src/components/site/mockups.tsx`
  (états initiaux/finaux des scènes), `src/components/site/blocks.tsx` (PillarRow : slot vidéo ; FactsRow : compteur),
  `src/components/site/SegmentLanding.tsx` (hero des 3 pages), `src/components/site/ScoreGauge.tsx` (morphing par seuils),
  `src/components/site/PricingExplorer.tsx` (prix qui comptent à la bascule, calculateur), `src/components/ui/Button.tsx`
  (survol/pression), `src/components/app/app.css`, `TaskBoard.tsx`, `Shell.tsx` (visite, transitions).
- À réutiliser : `src/components/site/ChatScene.tsx` (logique typewriter, aujourd'hui non utilisée).
- À créer : `src/lib/motion/*`, `src/components/motion/*`, `src/components/app/Tour.tsx`, `src/app/nouveautes/*`,
  `scripts/video/*` (record.mjs, shots.json, *.srt, end.html), `public/media/*`.

---

## 7. Captures de référence (site V2)

`/home/claude/auditia/qa/v3/benchmark/` : `home-desk-fold.png` (hero sans CTA), `home-desk-full-part1.png` (piliers statiques),
`home-desk-full-part2.png` (section sombre, digest, comparatif), `home-mob-fold.png` (hero mobile : aucune action dans le 1er écran),
`pme-desk-full-part0.png` (hero segment avec 2 CTA), `tarifs-desk-full-part0.png` (onglets + bascule), `geo-desk-fold.png`,
`app-desk-fold.png`, `app-mob-fold.png`.

---

## 8. Ce que je n'ai pas pu vérifier

- Le rendu actuel des sites des références (pas de navigation directe ; analyses tierces de fiabilité variable, cf. §1).
- Les valeurs exactes de Pennylane, Qonto (site), Alan, Swile : marquées (≈).
- La signature exacte de `page.screencast` en Playwright 1.63 (présente depuis 1.59 selon [25]) : à confirmer au premier essai.
- Les règles d'usage des logos de chaque IA : à faire valider avant d'afficher un logo officiel.

---

## 9. Sources

1. Linear — teardown de la landing : https://uirip.pages.dev/blog/teardowns/linear
2. Linear — refonte de la page d'accueil (avril 2026) : https://webtrends.pages.dev/news/2026-04-28-linear-homepage-redesign
3. Linear — « Behind the latest design refresh » (blog Linear, mars 2026) : https://linear.app/now/behind-the-latest-design-refresh
4. Stripe — analyse du design du site : https://webtrends.pages.dev/posts/stripe-website-design-analysis
5. Stripe — technique du dégradé : https://www.bram.us/2021/10/13/how-to-create-the-stripe-website-gradient-effect
6. Vercel — analyse de la page d'accueil : https://one-page-orpin.vercel.app/blog/vercel
7. Attio — teardown de la page d'accueil : https://signalscore.pages.dev/blog/attio-gtm-analysis
8. Raycast — principes d'interface : https://blakecrosley.com/guides/design/raycast
9. Framer — analyse de la page d'accueil : https://one-page-orpin.vercel.app/blog/framer
10. Clerk — design system publié (`design.md`) : https://clerk.com/design.md
11. Resend — 3D avec Spline : https://spline.design/customers/resend (redirection de blog.spline.design) ; recréation three.js : https://dev.to/sal_paradise/making-the-resend-cube-from-scratch-using-threejs-5a4f
12. PostHog — analyse du design : https://one-page-orpin.vercel.app/blog/posthog
13. PostHog — teardown des tarifs 2026 : https://dev.to/beton/posthog-pricing-teardown-2026-57oo
14. Qonto — nouvelle identité de marque : https://medium.com/qonto-way/forging-a-new-identity-for-the-qonto-brand-762852d3ec41
15. Profound — page design / recrutement : https://www.tryprofound.com/design
16. Peec AI — revue 2026 (écrite par un concurrent, FixAEO) : https://fixaeo.com/blogs/peec-ai-review/
17. Exemples de changelogs (Linear, Vercel, Resend) : https://www.productlift.dev/blog/best-changelog-examples/
18. Next.js — guide des View Transitions (màj 15 oct. 2026) : https://nextjs.org/docs/app/guides/view-transitions
19. SaaSFrame — 10 tendances de landing SaaS 2026 : https://www.saasframe.io/blog/10-saas-landing-page-trends-for-2026-with-real-examples
20. Navattic — State of the Interactive Product Demo 2026 : https://www.navattic.com/report/state-of-the-interactive-product-demo-2026
21. Arcade — 2026 Benchmarks Report : https://www.arcade.software/post/2026-arcade-benchmarks
22. SaaSFrame — guide pratique des grilles bento 2026 : https://www.saasframe.io/blog/designing-bento-grids-that-actually-work-a-2026-practical-guide
23. Motion — réduire la taille du bundle (copie de la doc) : https://app.unpkg.com/skaya@1.5.4/files/dist/src/ai/llm/motion/docs/react-reduce-bundle-size.md
24. Support navigateurs View Transitions et scroll-driven animations 2026 : https://blog.codercops.com/blog/css-view-transitions-scroll-animations-2026
25. Limites de `recordVideo` et API `page.screencast` : https://dev.to/mutsuntsai/replacing-playwrights-hardcoded-vp8-encoder-a-deep-dive-into-pagescreencast-43ee
26. Enregistrer une démo produit avec Playwright (ffmpeg, poster) : https://flaviocopes.com/record-demo-video-playwright.md
