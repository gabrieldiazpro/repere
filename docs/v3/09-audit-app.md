# 09 — Audit produit de l'espace client /app (V3)

Agent AUDIT PRODUIT, 9 novembre 2026. Lecture seule : aucun fichier de code modifié.
Regard : chef de produit senior venu d'un outil GEO concurrent (Profound, Peec).

**Méthode**
- Parcours Playwright sur http://localhost:3000/app (build V2) : 3 comptes démo (Local = Plomberie Martin, PME = Paysia, E-commerce = Maison Sora) × 12 écrans (Lundi, IA, Vérité, Sources, Concurrents, Tâches, Trafic, Copilote, Rapports, Réglages, Connexion, Plus) × bureau 1440 et mobile 390. Soit 72 vues, chacune capturée « pli » et « page entière ».
- Copilote : 30 questions posées par l'API (10 par compte), mêlant le script et le hors-script.
- Lecture du code : `src/app/app/**`, `src/components/app/**`, `src/lib/{engine,execution,tracking,digest,copilot}`, `db.ts`, `plans.ts`, `supabase/schema.sql`, les routes `api/{audit,copilot,cron,stripe}`.

**Preuves** (`qa/v3/app/`)
- `{local|pme|ecommerce}-{desk|mob}-{écran}-{fold|full}.png` : 144 captures.
- `_texts.json` : texte de chaque écran en bureau.
- `_copilote.json` : les 30 questions et leurs réponses.
- `_run.json` : temps de chargement, erreurs console, débordement horizontal.

**Santé technique.** Aucune erreur JavaScript. Aucun débordement horizontal en mobile. Chaque écran charge en moins de 1,6 s. La console ne remonte qu'un avertissement CSP sans conséquence (`upgrade-insecure-requests` dans une politique report-only).

---

## 0. Verdict en une page

L'espace V2 est **une bonne V1 de produit « dirigeant »**. Points forts :
- l'erreur d'IA en phrase de la semaine ;
- les sources nommées avec les concurrents présents ;
- les tâches livrées avec un texte prêt ;
- le ton honnête.

Les corrections de la revue V2 sont en grande partie faites : un seul calcul du rang (`digest/stats.ts`), « Nouveau » limité aux vrais entrants, la vérité e-commerce sur la livraison, le digest activé par défaut avec son aperçu, et les appels et commandes dans Trafic.

Face à Profound ou Peec, il manque trois choses :

1. **Le client ne pilote rien.** Il ne peut pas choisir ses questions, ses IA ou sa période, ni consulter une réponse brute ou une URL citée. Tout est « ce que Repéré a décidé de mesurer ». Pour Claire (PME), c'est éliminatoire en démo commerciale.
2. **Il ne peut rien sortir.** Pas de CSV, pas de lien de partage, pas de rapport planifié, pas d'invitation d'un collègue. Le verrou n° 5 du doc 06 (« utilisé par plus d'une personne ») est absent.
3. **La mise en production multi-clients est bloquée par le code d'authentification et de rattachement**, pas par l'interface (§4). Exemple : un client qui paie avec une adresse puis se connecte avec une autre voit… la démo de Plomberie Martin.

**Les chiffres ne tiennent pas encore tous d'un écran à l'autre** (§3). Ce n'est plus le rang. Restent le nombre de questions (8, 9 ou 10), le ton (0 % négatif à côté d'un verbatim « Négatif »), la date des verbatims, et un concurrent cité dans 48 réponses sur 48.

**Le copilote répond hors sujet à 17 questions sur 30** (réponse générique `other`), dont « Quel est mon rang ? » et « Merci ».

---

## 1. Fonctions absentes : valeur client × effort

Valeur : ★★★ = décide l'achat ou la rétention ; ★★ = attendu d'un SaaS sérieux ; ★ = confort.
Effort : S < ½ j · M ≈ 1–3 j · L ≈ 1–2 semaines · XL > 2 semaines.
« Existe ? » : ✗ absent · ◐ partiel (détail donné).

### 1.1 Mesure et exploration (cœur GEO)

| Fonction | Existe ? | Ce qui manque | Valeur | Effort | Priorité |
|---|---|---|---|---|---|
| **Gestion des questions (prompts)** : ajouter, modifier, désactiver, taguer ; suggestions | ✗ | Les questions sont générées par `engine/queries-v2.ts` et figées. `/app/requetes` redirige vers `/app/ia`. Aucun écran ni aucune route | ★★★ | M | **P0** |
| Suggestions de questions (depuis l'audit, Search Console, questions des concurrents) | ✗ | Les questions générées existent mais ne sont pas proposées comme « à suivre » | ★★ | S (si gestion des questions) | P1 |
| **Historique par question et par IA** | ✗ | `/app/ia` ne montre que le dernier audit. Les 6 audits sont stockés (`ws.audits`) mais aucune vue « cette question, mois par mois, par IA » | ★★★ | M | **P0** |
| **Réponses brutes consultables, avec surlignage** (marque, concurrents, URL) | ✗ | Seuls des extraits (`perception.quotes`) sont visibles. `Highlighted.tsx` existe dans le rapport public, mais l'app ne permet pas d'ouvrir une réponse complète | ★★★ | M | **P0** |
| **Explorateur de citations, URL par URL** | ◐ | Sources liste des **domaines**. Il manque l'URL exacte, la question, l'IA, la date de première et de dernière citation, et un lien sortant | ★★★ | M | **P0** |
| Filtres par IA, période, tag, intention | ◐ | Filtre IA et ton sur les verbatims seulement. Rien sur Sources, Concurrents, Tâches. Aucune période | ★★ | M | P1 |
| **Comparaison de périodes** (ce mois contre le mois dernier, ou le trimestre) | ◐ | Deltas codés en dur (« sur un mois », « sur le trimestre »). Pas de sélecteur de période ni d'écran avant/après | ★★ | M | P1 |
| Part de voix par IA et par intention | ◐ | Note par IA (anneaux) ; la part de voix n'est jamais découpée par IA ou par intention | ★★ | S | P1 |
| Fréquence de mesure choisie (hebdomadaire ou quotidienne sur un échantillon) | ✗ | Audit mensuel par cron, digest hebdomadaire sans nouvelle mesure | ★★ | M (coût API) | P2 |
| Sentiment par attribut (prix, délai, qualité) | ◐ | Les thèmes sont des puces, sans polarité ni verbatim cliquable | ★ | S | P2 |
| ChatGPT Shopping, AI Overviews, Copilot, Mistral | ✗ | 3 IA mesurées (ChatGPT, Perplexity, Gemini). Claude en option. Le copilote ne sait pas dire si la marque est dans ChatGPT Shopping | ★★ (e-commerce ★★★) | L | P2 |

### 1.2 Sortir les données

| Fonction | Existe ? | Ce qui manque | Valeur | Effort | Priorité |
|---|---|---|---|---|---|
| **Export CSV** (classement, sources, réponses, tâches, trafic) | ✗ | Aucun. Le copilote répond « générique » à « Exporte la part de voix en CSV ». Les graphiques ont un « Voir les données » non exportable | ★★★ (PME) | S | **P0** |
| Export PDF | ◐ | PDF par audit (`/api/report/[id]/pdf`). Ni PDF du bilan trimestriel, ni « point comité » | ★★ | M | P1 |
| **Rapports planifiés** (mensuel ou trimestriel, à N destinataires) | ◐ | Digest du lundi au seul contact principal. « Transférer à » stocké en `localStorage` (`Settings.tsx:264`), donc **jamais utilisé par le serveur** | ★★★ | M | **P0** |
| **Partage par lien public** (lecture seule, expirable) | ◐ | `/rapport/[id]` est public par identifiant, sans expiration, sans révocation, sans vue « tableau de bord » | ★★ | M | P1 |

### 1.3 Équipe et périmètre

| Fonction | Existe ? | Ce qui manque | Valeur | Effort | Priorité |
|---|---|---|---|---|---|
| **Multi-utilisateurs et rôles** (propriétaire, contributeur, lecteur) | ✗ | `businesses.owner_id` unique. `canAccessBusiness` compare à un seul propriétaire. Aucune table de membres | ★★★ | L | **P0** (PME et e-commerce) |
| Multi-marques, multi-établissements, sélecteur | ◐ | `loadDashboard` lit `rp_business`, mais **aucun sélecteur** dans l'interface (seul le sélecteur démo existe). `MAX_BUSINESSES` est défini et jamais appliqué | ★★ (Local Réseau ★★★) | M | P1 |
| Espace agence (clients, marque blanche) | ✗ | Hors V3 (liste d'attente) | ★ | XL | P3 |

### 1.4 Notifications et intégrations

| Fonction | Existe ? | Ce qui manque | Valeur | Effort | Priorité |
|---|---|---|---|---|---|
| **Notifications dans l'app** (cloche, centre d'activité) | ✗ | Les alertes vivent sur Lundi, en liste calculée. Pas de « lu / non lu » ni d'historique | ★★ | M | P1 |
| Push PWA | ◐ | `pushManager.subscribe` est appelé (`Settings.tsx:89`), mais **l'abonnement n'est envoyé à aucun serveur** et aucun émetteur n'existe. Les préférences d'alerte restent en `localStorage` : le cron ne les lit pas | ★★ | M | P1 |
| **Slack et Teams** (digest et alertes) | ✗ | Promis dans le doc 06 (PME et plus), absent | ★★★ (PME) | S (webhook entrant) | **P0** |
| Webhook sortant | ✗ | — | ★ | S | P2 |
| API publique (lecture) | ✗ | — | ★ | L | P3 |
| GA4, Shopify, Search Console | ◐ | GA4 préparé (bouton). Shopify : données démo. Search Console : absent | ★★★ (e-commerce) | L | P1 |

### 1.5 Outils d'action

| Fonction | Existe ? | Ce qui manque | Valeur | Effort | Priorité |
|---|---|---|---|---|---|
| **Audit de page** (URL → score de citabilité + corrections) | ✗ | Rien dans `/app`. Bon outil gratuit d'acquisition (cf. brief V3) | ★★★ | M | **P0** |
| **Audit technique « prêt pour les IA »** (robots.txt, schema, rendu sans JS, llms.txt, sitemap, temps de réponse) | ◐ | Tâche « Vérifier que les robots… » (texte) et tableau des robots vus. Pas de **contrôle automatique** du site | ★★★ | M | **P0** |
| Éditeur de contenu avec score | ✗ | Les livrables se copient seulement. Pas d'édition ni de score en direct | ★★ | L | P2 |
| Calendrier d'actions | ✗ | Tâches en 3 groupes (semaine, plus tard, faites), sans échéance ni assignation | ★ | M | P2 |
| **Annotations sur les courbes** (action → effet) | ◐ | Repères sur la courbe de Trafic uniquement, tirés des tâches faites. Ni sur la part de voix ni sur le score. Pas d'annotation manuelle | ★★ | S | P1 |
| **Objectifs et cibles** (« 3ᵉ d'ici mars », « 20 % de part de voix ») | ✗ | — | ★★ | S | P1 |
| Plan d'action trimestriel (copilote « plan sur 3 mois ») | ✗ | Réponse générique | ★★ | S | P1 |

### 1.6 Expérience SaaS

| Fonction | Existe ? | Ce qui manque | Valeur | Effort | Priorité |
|---|---|---|---|---|---|
| **Onboarding guidé** (checklist, première valeur en moins de 5 min) | ✗ | Un compte réel sans audit voit un seul état vide (« Lancer un audit » vers `/audit`, le formulaire public). Pas de fiche de vérité guidée, pas de snippet guidé, pas de checklist | ★★★ | M | **P0** |
| États vides utiles | ◐ | Présents mais passifs (« apparaîtra après… »), sans action ni exemple | ★★ | S | P1 |
| Recherche globale et palette Cmd+K | ✗ | Aucun raccourci clavier | ★ (★★ PME) | M | P2 |
| Raccourcis (`g t` vers Tâches, `j/k` dans la liste des tâches, `x` pour « c'est fait ») | ✗ | — | ★ | S | P2 |
| Mode sombre | ✗ | Tokens en dur dans `app.css` et en hexadécimal dans le JSX (`#F7F7FD`, `#FFFAFA`…). Il faut d'abord tokeniser | ★ | M | P3 |
| **Facturation et gestion du plan** | ◐ | Lien vers le portail Stripe si `NEXT_PUBLIC_STRIPE_PORTAL_URL`. Pas de factures, de changement de plan, d'usage ni de quotas affichés. En démo : « Offre Local · 49 € par mois », alors que la grille dit Essentiel 29 € et Accompagné 99 € | ★★ | M | P1 |
| **Verrouillage des fonctions par plan** (paywall, montée en gamme) | ✗ | `planTier` existe. Aucun écran ne teste le plan. `COPILOT_MONTHLY_QUOTA` n'est jamais lu (`grep` : zéro usage) | ★★★ (revenu) | M | **P0** |
| Centre d'aide intégré (« ? » contextuel, glossaire, méthode) | ✗ | Les pages /methode et /glossaire existent sur le site, sans lien depuis l'app | ★★ | S | P1 |
| Journal des changements (« Nouveautés ») | ✗ | — | ★ | S | P3 |

**P0 retenus (10)** : gestion des questions · historique par question et par IA · réponses brutes · explorateur d'URL · CSV · rapports planifiés et destinataires serveur · Slack · audit de page et audit technique · onboarding · plans et quotas. Le multi-utilisateurs vient juste après, avec l'architecture (§4).

---

## 2. Défauts par écran, avec leur correction

Format : **constat**, puis la correction précise et le fichier. Captures : `qa/v3/app/<segment>-<desk|mob>-<écran>-*.png`.

### 2.1 Coquille (barre latérale, onglets mobiles, bandeau démo)

| # | Constat | Correction |
|---|---|---|
| S1 | En mobile, les onglets sont Accueil · Tâches · Sources · Copilote · Plus. **Vérité et Concurrents** sont relégués dans « Plus », alors que l'erreur d'IA et le rang sont les deux déclencheurs n° 1 du doc 06. Seul un point rouge sur « Plus » signale l'erreur | `nav.ts` `TAB_HREFS = ['/app','/app/taches','/app/verite','/app/concurrents']`. Sources et Copilote passent dans « Plus ». Le badge d'erreurs passe sur l'onglet Vérité |
| S2 | Aucun sélecteur d'établissement ou de marque pour un compte réel, aucun menu utilisateur | `Shell.tsx` : la carte « nom du commerce » devient un menu (changer d'établissement → cookie `rp_business` ; Réglages ; Déconnexion) |
| S3 | Pas d'indicateur d'usage du plan | Pied de barre latérale : « Offre Essentiel · Copilote 12/20 ce mois · Questions 8/25 » + « Passer à Accompagné » |
| S4 | Le titre de l'onglet du navigateur est « Le lundi \| Repéré » : le gabarit `'%s · Repéré'` de `app/layout.tsx` est écrasé par la racine | Vérifier l'ordre des `metadata.title.template` : `title: { absolute: 'Le lundi · Repéré' }` sur chaque page, ou supprimer le gabarit de la racine pour `/app` |
| S5 | Le badge Vérité utilise `latest.factCheck.errors`. Après correction de la fiche, Lundi masque l'erreur (filtre sur `ws.facts`) mais le badge affiche toujours « 1 » | Un seul calcul : exporter `openFactErrors(ws)` dans `workspace.ts`, l'utiliser dans `layout.tsx`, `page.tsx`, `verite/page.tsx` et `plus/page.tsx` |

### 2.2 Lundi (`src/app/app/page.tsx`)

| # | Constat | Correction |
|---|---|---|
| L1 | Trois bases de comptage côte à côte : « ChatGPT vous cite dans 4 questions sur 8 », « 23 réponses sur 45 », « Part de voix 13 % ». Personne ne comprend pourquoi 23/45 donne 13 % | Garder **une** métrique héros, la part de voix, avec cette infobulle : « 13 % = vos 23 citations sur les 177 citations de marques dans 45 réponses ». La ligne « ChatGPT… » ne garde que les questions, avec son IA |
| L2 | Les verbatims sont datés « 9 nov. » (aujourd'hui), alors que la mesure est du 5 novembre | `Quote.tsx` : afficher `auditDate(latest)`, pas `quote.at ?? now`. Corriger aussi la génération démo (`demo-data.ts` / `mock-v2.ts`) |
| L3 | Le score 61 n'a pas d'étiquette ici, mais Rapports dit « Peu visible ». Un 3ᵉ sur 10 lit « Peu visible » | `bandFor` : ajuster les paliers (≥ 55 « Visible ») ou nommer « Visibilité en progrès ». L'étiquette doit être cohérente avec le rang |
| L4 | E-commerce : « −1 place sur un mois. Vous progressez (+6), mais Comptoir Argile progresse plus vite. » Or Comptoir Argile est **nouveau**, il n'était pas là le mois précédent. L'explication est fausse | `digest/stats.ts rankMove().explanation` : si le concurrent passé devant est dans `newEntrants`, écrire « Comptoir Argile, nouvel entrant, s'intercale devant vous ». Si le nombre d'acteurs passe de 9 à 10 et que vous restez dernier, écrire « Vous restez dernier, sur 10 acteurs au lieu de 9 » |
| L5 | Aucune donnée n'est actionnable en dehors des liens. Le rang ne dit pas quoi faire | Sous « X est juste devant » : bouton « Voir ce qui lui manque pour vous » (`/app/concurrents#<slug>`) et « Ajouter la tâche n° 1 » |
| L6 | Pas d'onboarding ni de progression (« 2 tâches faites sur 12, 0 source gagnée ») | Bloc « Votre progression » (voir §5), masquable une fois terminé |
| L7 | Mobile : l'indicateur « Exactitude » est sous le pli, ce qui reste acceptable puisque la phrase de la semaine est l'erreur. Mais les 4 indicateurs font 2 × 2 en petit | En mobile, remplacer les 4 indicateurs par une seule ligne défilante (puces horizontales) pour remonter les tâches |

### 2.3 Ce que disent les IA (`src/app/app/ia/page.tsx`)

| # | Constat | Correction |
|---|---|---|
| I1 | **« 9 questions × 3 IA » (Local), « 10 × 3 » (PME, e-commerce)**, contre « 8 questions » partout ailleurs. Ce sont les questions factuelles de vérification, comptées avec les questions de visibilité | Séparer `a.queries` en `visibility` et `factual` (champ `intent`). En-tête : « 8 questions de visibilité + 2 vérifications × 3 IA ». Le tableau « Question par question » ne garde que la visibilité ; les vérifications vont dans Vérité |
| I2 | **Ton : « Négatif 0 % »** (Local) alors que Lundi affiche un verbatim Gemini marqué « Négatif ». Le verbatim d'erreur factuelle n'est pas compté dans le ton | Dans `perception`, compter les citations `fact_error` dans `negatif`, ou bien étiqueter ce verbatim « Erreur factuelle » (pas « Négatif ») sur Lundi. Un seul vocabulaire |
| I3 | Pas de réponse complète. On ne voit qu'un extrait d'une ligne. Pas de surlignage ni d'URL citées | Clic sur un verbatim ou une cellule du tableau : tiroir « Réponse complète » (texte intégral surligné : vous en ambre, concurrents en indigo, URL soulignées avec numéro de citation), avec l'IA, la date, le passage 1 ou 2, et un bouton « Copier ». Voir amélioration n° 3 |
| I4 | La grille ✓ / ✗ ne montre ni historique ni tendance | Chaque ligne affiche une mini-frise des 6 derniers mois par IA (●○). Clic sur la ligne : historique de la question (amélioration n° 2) |
| I5 | PME et e-commerce n'ont que 4 verbatims : la page paraît vide | Afficher aussi les **mentions neutres** extraites des réponses brutes. Si moins de 6, montrer « Voir les 48 réponses » |
| I6 | Les anneaux de note par IA occupent beaucoup de place pour 3 chiffres | Barres horizontales + delta sur un mois. Le clic filtre (comportement actuel conservé) |

### 2.4 Vérité (`verite/page.tsx`, `TruthEditor.tsx`)

| # | Constat | Correction |
|---|---|---|
| V1 | « Vérifié le 9 novembre » alors que la mesure est du 5 novembre (`fc.checkedAt` = maintenant en démo) | Démo : `checkedAt = auditDate(latest)`. Réel : afficher la date de la dernière revérification |
| V2 | « 20 informations justes » en e-commerce, pour 11 champs : ce sont des paires champ × IA, alors que le lecteur comprend « 20 champs » | « 11 informations vérifiées sur 3 IA : 32 réponses justes, 1 fausse ». Afficher une grille champ × IA (✓ / ✗ / ?) |
| V3 | Pas d'historique de l'erreur (détectée le…, toujours présente le…, corrigée le…) | Frise par erreur : « Détectée 5 oct. · toujours présente 5 nov. · tâche faite 4 nov. ». Donnée : `facts.history` (nouvelle collection `facts.events`) |
| V4 | Mobile : la fiche fait 2 000 px ; un bouton « Modifier » par champ | Mode « Modifier la fiche » global (formulaire unique, enregistrer une fois) ; en lecture, liste compacte libellé : valeur |
| V5 | Pas d'action « Revérifier maintenant » | Bouton qui lance une vérification ciblée (1 question × 3 IA, environ 0,02 €), limitée à 3 par jour, en file (§4) |

### 2.5 Sources (`sources/page.tsx`)

| # | Constat | Correction |
|---|---|---|
| SO1 | **« Cité dans 32 réponses sur 32 (100 %) »** (PagesJaunes). Le dénominateur 32 (ChatGPT + Perplexity) n'est pas expliqué, alors que les autres écrans disent 48. Score « 100/100 » : un score absolu sonne faux | « Cité dans 32 des 32 réponses de ChatGPT et Perplexity (Gemini ne donne pas ses sources) ». Supprimer « Score x/100 » de la carte (le rang suffit) ou le renommer « Priorité » |
| SO2 | Domaine seulement : pas d'URL, pas de question, pas de date | Explorateur d'URL : onglet « Pages citées » (amélioration n° 4) |
| SO3 | « Déjà présents » liste jusqu'à 9 concurrents en puces : un bruit visuel qui ne dit rien de plus | Afficher les 3 concurrents les mieux classés + « +6 » ; mettre en gras ceux qui sont devant vous |
| SO4 | Le titre dit « Vos 10 sources prioritaires » (« Vos 7 » en PME) mais la carte affiche « Opportunités classées : 10 », sans tri ni filtre (catégorie, effort, présent / absent) | Barre de filtres : catégorie · effort S/M/L · « je suis absent ». Tri : priorité, citations, effort |
| SO5 | Rien ne dit si une source « gagnée » a été citée ensuite | Colonne « Évolution » : présence passée d'absent à présent (date), puis citations de votre fiche sur cette source depuis |
| SO6 | Le bouton « Ajouter à mes tâches » ne signale pas l'état « déjà ajoutée » | `CreateTaskButton` : état désactivé « Dans vos tâches ✓ » si `tasks.some(t => t.sourceDomain === o.domain)` |

### 2.6 Concurrents (`concurrents/page.tsx`)

| # | Constat | Correction |
|---|---|---|
| C1 | **« Pourquoi ils passent devant » : textes identiques** pour chaque concurrent (« Présent sur G2, Capterra France et Journal du Net… », même liste de domaines). Ça ressemble à un gabarit, et c'en est un | `engine/insights.ts` : ne garder que les sources où **ce** concurrent est présent et vous absent, avec le nombre de citations du concurrent par source. Classer par écart. Ajouter 1 verbatim propre au concurrent et sa meilleure question |
| C2 | E-commerce : Savonnerie Alba est cité **48 fois sur 48 réponses** (16/16 par IA, d'après le copilote) : invraisemblable | `mock-v2.ts` : plafonner le leader à environ 70 % des réponses et varier par IA |
| C3 | Noms démo trop proches : « Savonnerie Alba » / « Maison Alba », « Pain de Lune » / « Terre de Lune », « Ets Perrin » / « Perrin & Fils » | Pools de noms dédupliqués par racine (`mock-v2.ts`) |
| C4 | Pas de vue détaillée d'un concurrent (son historique, ses sources, ses verbatims, les questions où il gagne) | Page `/app/concurrents/[slug]` (amélioration n° 8) |
| C5 | Pas de concurrents **suivis** choisis par le client (« je veux voir PayFit même s'il n'est pas cité ») | Réglage « Concurrents suivis » (5 maximum) : toujours affichés dans la courbe |
| C6 | La courbe de part de voix n'a ni repères d'action ni sélecteur IA | Réutiliser `markers` de `LineChart` (déjà pris en charge) + puces IA (toutes / ChatGPT / Perplexity / Gemini) |

### 2.7 Tâches (`TaskBoard.tsx`, `execution/tasks.ts`)

| # | Constat | Correction |
|---|---|---|
| T1 | PME : « Obtenir des avis sur G2 » **et** « Demander un avis à vos clients sur G2 et Capterra » : doublon. « Obtenir des avis sur Trustpilot » passe en tâche de la semaine avant G2 | `generateTasks` : dédupliquer par `sourceDomain` et par `kind`. Pour `pme`, prioriser G2 et Capterra avant Trustpilot |
| T2 | Trustpilot et G2 sont rangés en catégorie « Annuaire » | `CATEGORY_LABEL` : utiliser la catégorie `avis` de `classifyDomain` |
| T3 | Ni échéance, ni assigné, ni commentaire, ni « pourquoi pas faite » | Champs `dueAt`, `assigneeId` (après multi-utilisateurs), `note`. Bouton « Reporter d'une semaine » |
| T4 | « C'est fait » est déclaratif, sans vérification | Pour les tâches vérifiables (balisage présent sur l'URL, page hébergée publiée, fiche annuaire trouvée), lancer une vérification automatique et afficher « Vérifié ✓ le… » ou « Pas encore détecté » |
| T5 | Pas d'effet mesuré | Sur une tâche faite : « Depuis : +4 citations sur PagesJaunes » ou « Gemini donne toujours l'ancienne valeur » (lié à V3 et SO5) |

### 2.8 Trafic IA (`trafic/page.tsx`, `TrafficClient.tsx`)

| # | Constat | Correction |
|---|---|---|
| TR1 | Axe Y aux graduations non rondes (« 1,3 · 2,5 · 3,8 · 5 ») | `ChartsClient.tsx` : fonction `niceTicks(max)` (1, 2, 2,5 ou 5 × 10ⁿ) |
| TR2 | La légende dit « Repères : ce que vous avez fait », mais le 1ᵉʳ repère est « Bug ChatGPT… », un événement externe | Deux styles : action (pointillé ambre) et événement externe (pointillé gris), avec une légende pour chacun. Le libellé apparaît au survol du repère |
| TR3 | Pas de filtre par moteur ni par page. Le CSV est absent | Puces moteur (filtrent la courbe et les pages) + export CSV |
| TR4 | PME : la carte « Conversions suivies 54 » porte le libellé « démo, contact », sans définition | Définir la conversion (formulaire, démo réservée) dans Réglages > Suivi. Libellé : « 54 demandes de démo » |
| TR5 | E-commerce : 16 commandes pour 244 visites IA, soit 6,6 % de conversion, au-dessus de la moyenne e-commerce (environ 1 à 3 %). Le prospect averti tique | Démo : environ 6 commandes, 230 € |
| TR6 | Pas de lien entre les pages d'arrivée et les questions IA qui y mènent | Colonne « Probablement depuis » : la question d'audit dont la réponse cite cette URL (jointure avec l'explorateur de citations) |

### 2.9 Copilote (`Copilot.tsx`, `lib/copilot/demo.ts`)

Résultats des 30 questions (`_copilote.json`) :

| Compte | Bien routées | Générique (`other`) | Fausses |
|---|---|---|---|
| Local | 3 / 10 | 7 / 10 : rang, note Gemini, URL citées, ajout d'une question, comparaison de mois, « ouvert le dimanche ? », « Merci » | Avis 1★ « Jamais venu, injoignable » : la réponse dit « en particulier sur le délai » |
| PME | 4 / 10 | 5 / 10 : questions absentes de ChatGPT, concurrent le plus rapide, CSV, idées d'articles, robots | « Notre page tarifs est-elle citable ? » routée vers `prices` |
| E-commerce | 5 / 10 | 4 / 10 : composition, ChatGPT Shopping, rang, plan à 3 mois | **« Pourquoi Lamazuna… » répond sur Savonnerie Alba** sans le dire |

| # | Constat | Correction |
|---|---|---|
| CP1 | 17 réponses sur 30 sont génériques. La réponse `other` répète le score et liste des exemples : c'est un échec visible | `detectIntent` : ajouter `rank`, `provider_score`, `citations_urls`, `track_question`, `period_compare`, `fact_lookup` (« dit-il que je suis ouvert le dimanche » → chercher dans les réponses et la fiche), `missing_queries`, `fastest_competitor`, `export`, `content_ideas`, `crawlers`, `plan_quarter`, `thanks`. Chacune lit des données déjà présentes dans le contexte (`copilot/context.ts`) |
| CP2 | Un concurrent nommé mais inconnu est remplacé silencieusement par le premier | `why_competitor` : rapprochement approximatif du nom avec `rows`. Si absent : « Lamazuna n'apparaît dans aucune des 48 réponses de votre audit. Les plus cités sont… Voulez-vous le suivre ? » |
| CP3 | Avis : la réponse reprend « le délai » quel que soit le grief | `draftReviewReply` : extraire le grief (délai, injoignable, prix, qualité, absence) avec un lexique, ou reprendre la phrase de l'avis entre guillemets |
| CP4 | Pas d'historique des conversations (`threads` existe côté API, absent de l'interface), pas d'action « Ajouter à mes tâches » sur les tâches proposées, pas de copie de la réponse ni de téléchargement du livrable | Panneau « Conversations » + boutons d'action sous chaque réponse (`deliverables` déjà renvoyés par l'API) |
| CP5 | Pas de citations de données (« d'après l'audit du 5 nov. » seulement) | Notes de bas de réponse liées (« [1] Concurrents · [2] Réponse ChatGPT du 5 nov. ») |
| CP6 | Pas de quota affiché ni appliqué (`COPILOT_MONTHLY_QUOTA` inutilisé) | Compteur « 12 / 20 ce mois » sous la zone de saisie ; refus poli au-delà, avec montée en gamme |

### 2.10 Rapports (`rapports/page.tsx`)

| # | Constat | Correction |
|---|---|---|
| R1 | « Bilan trimestriel » libellé « août – novembre » (4 mois nommés pour 3 mois d'écart) | « Du 5 août au 5 novembre 2026 » |
| R2 | « Tâches faites 2 · 0 source ou fiche obtenue » : la carte dévalorise le produit | Si 0, afficher la prochaine source à gagner (« Prochaine : PagesJaunes, 30 min ») plutôt que « 0 » |
| R3 | Le bilan n'existe qu'à l'écran. Ni PDF, ni lien, ni envoi planifié | « Télécharger le bilan (PDF) » + « Programmer l'envoi » (destinataires, fréquence) + « Copier le lien » (amélioration n° 6) |
| R4 | L'historique est un tableau de scores : pas de comparaison entre deux audits | Cases à cocher sur deux lignes → « Comparer » (amélioration n° 9) |
| R5 | Rang « 3ᵉ sur 10 » puis « 3ᵉ sur 9 » : le dénominateur change sans explication | Infobulle « Le nombre d'acteurs cités varie d'un mois à l'autre » ou rang en centile |

### 2.11 Réglages (`reglages/page.tsx`, `Settings.tsx`)

| # | Constat | Correction |
|---|---|---|
| RG1 | **Préférences d'alerte et « Transférer à » stockées dans `localStorage`** : le serveur ne les connaît pas, le cron ne les respecte pas. L'écran le dit (« enregistrés sur cet appareil »), mais c'est un faux réglage | Route `PATCH /api/settings` → `businesses.alert_prefs` (jsonb) + table `digest_recipients`. Le cron lit les deux |
| RG2 | Le bandeau « Notifications sur cet appareil : bloquées » s'affiche en tête, même sur bureau sans push | Ne l'afficher qu'au clic sur un interrupteur Push |
| RG3 | Démo : « Offre Local · 49 € par mois ». La grille V2 dit Essentiel 29 € et Accompagné 99 €. Pour un compte réel, `planLabel` ne connaît que `free/suivi/pro/agency` : un client Essentiel lirait « essentiel » en minuscules | `demo-data.ts:103` → « Essentiel · 29 € par mois ». `workspace.ts` : libellé via `getPlan(planId).name` |
| RG4 | Il manque : membres, établissements, questions suivies, concurrents suivis, intégrations (Slack, GA4, Shopify, snippet), facturation (factures, usage), export RGPD et suppression du compte | Réglages en onglets : Général · Alertes · Équipe · Questions et concurrents · Intégrations · Abonnement · Données |

### 2.12 Connexion (`connexion/page.tsx`)

| # | Constat | Correction |
|---|---|---|
| CX1 | Pas de lien « Je n'ai pas de compte » ni « J'ai payé mais je n'ai pas accès » | Deux liens : « Faire mon audit gratuit » (`/audit`) et « J'ai payé : utilisez l'e-mail du reçu Stripe » + `mailto:` du support |
| CX2 | Si l'e-mail de connexion ne possède aucun commerce, **l'utilisateur connecté voit la démo** (`loadDashboard` → `getDemoBusiness`), sans explication | État dédié : « Aucun espace n'est rattaché à {email}. » Actions : lancer un audit, ou saisir l'e-mail utilisé au paiement (§4.2) |

---

## 3. Incohérences de données démo restantes

| # | Où | Constat | Correction |
|---|---|---|---|
| D1 | IA / Lundi / Concurrents | 9 ou 10 « questions » sur IA contre 8 ailleurs | I1 |
| D2 | IA / Lundi | Ton à 0 % négatif, mais verbatim « Négatif » sur Lundi | I2 |
| D3 | Lundi / IA | Verbatims datés du 9 nov. pour une mesure du 5 nov. | L2 |
| D4 | Vérité | « Vérifié le 9 novembre » pour une mesure du 5 nov. | V1 |
| D5 | Concurrents (e-com) | Leader cité dans 48 réponses sur 48 | C2 |
| D6 | Lundi / Concurrents (e-com) | Nouvel entrant présenté comme « progresse plus vite » | L4 |
| D7 | Sources (local) | PagesJaunes cité dans 100 % des réponses ChatGPT et Perplexity, « Score 100/100 » | SO1 + plafonner dans `mock-v2.ts` |
| D8 | Rapports / Lundi | Score 61 « Peu visible » pour un 3ᵉ sur 10 | L3 |
| D9 | Réglages | 49 €/mois, hors grille | RG3 |
| D10 | Copilote | « Lamazuna » (vraie marque, saisie par l'utilisateur) répondu avec Savonnerie Alba | CP2 |
| D11 | Trafic (e-com) | Taux de conversion IA de 6,6 % | TR5 |
| D12 | Concurrents | Noms quasi identiques | C3 |
| D13 | E-commerce | Dernier sur 9 ou 10 pendant 6 mois malgré un score passé de 12 à 36 : démo démotivante, et le scénario « on progresse » ne se voit pas | Faire gagner 2 places à Maison Sora entre juin et septembre, puis le −1 de novembre (nouvel entrant) |
| D14 | PME | Rapport 90 j = 2 086 visites ; 30 j = 1 093 (+62 %) ; 7 j = 286. Cohérent. **Pas d'incohérence**, à conserver | — |
| D15 | Local | Rang : Lundi « stable », Concurrents « +2 sur le trimestre », Rapports « 5ᵉ → 3ᵉ ». **Cohérent depuis `stats.ts`** | — |

**Garde-fou à ajouter.** Un test `src/app/api/__tests__/coherence-demo.test.ts` qui, pour les 3 comptes, rend les adaptateurs et vérifie l'égalité :
- du nombre de questions de visibilité ;
- des réponses et des citations ;
- du rang ;
- du nombre d'erreurs (badge, Lundi, Vérité, Plus, digest, copilote) ;
- des dates (verbatim, vérification et audit identiques).

---

## 4. Architecture : ce qui bloque une vraie mise en production multi-clients

### 4.1 Authentification

| # | Constat (code) | Risque | Correction |
|---|---|---|---|
| A1 | Le jeton d'accès Supabase est copié en JavaScript dans un cookie `rp_session` lisible par le client (`SessionSync.tsx`). Il n'est ni `HttpOnly` ni rafraîchi côté serveur | Vol de session en cas de XSS ; expiration au bout d'environ 1 h si l'onglet n'est pas ouvert, d'où un retour silencieux à la démo | `@supabase/ssr` avec cookies `HttpOnly` gérés par un middleware (`middleware.ts` qui rafraîchit la session sur `/app/**` et `/api/**`) |
| A2 | `loadDashboard` : toute erreur ou absence de commerce **retombe sur la démo** | Un client payant voit Plomberie Martin et croit à une fuite de données | Trois états distincts : non connecté → démo ; connecté sans espace → écran de rattachement (CX2) ; erreur → page d'erreur avec nouvelle tentative |
| A3 | `canAccessBusiness` renvoie `ok` **si Supabase n'est pas configuré** | Une mauvaise variable d'environnement en production ouvre tous les commerces | `if (!isSupabaseEnabled() && process.env.NODE_ENV === 'production') return 503` |
| A4 | Un seul `owner_id` par commerce, aucun rôle | Pas d'associé ni d'agence ; partage du mot de passe | Table `memberships(business_id, user_id, role: owner/editor/viewer, invited_email, accepted_at)` ; politiques RLS sur `memberships` ; `canAccessBusiness(req, id, minRole)` |

### 4.2 Rattachement d'un audit à un compte après paiement

Le chemin actuel :
1. Le webhook Stripe crée un commerce avec `contact_email` = l'e-mail Stripe, sans propriétaire.
2. Le déclencheur SQL `on_auth_user_created_claim` le rattache seulement **à la création** de l'utilisateur Supabase, et seulement si l'e-mail est **identique**.

Les cas cassés :
- un client déjà inscrit (2ᵉ achat, ou compte créé avant le paiement) n'est jamais rattaché ;
- un e-mail Stripe différent de l'e-mail de connexion n'est jamais rattaché ;
- un audit déjà rattaché à un autre client part en « rattachement manuel » (journal seulement, aucune file).

Le segment (`pme` ou `ecommerce`) n'est pas recopié par `ensureBusiness` (`createBusiness` sans `segment`), alors que l'audit le connaît. Un client PME se retrouve en `local`.

**Correction**
- Au `checkout.session.completed`, créer un **jeton de rattachement** à usage unique (`claims(token, business_id, email, expires_at)`). L'e-mail de confirmation contient un lien `/app/rejoindre?t=…` qui, une fois connecté (n'importe quel e-mail), crée le `membership owner`.
- Passer `segment: audit.input.segment` dans `ensureBusiness`.
- Garder le déclencheur SQL en filet de sécurité, et l'étendre à la **connexion** (pas seulement à la création), via un appel de rattachement au premier chargement de `/app`.
- Collection `ops.claims_pending` pour les cas ambigus, avec une page admin.

### 4.3 File d'attente des audits longs

- `POST /api/audit` exécute l'audit **dans la requête** (55 s maximum, `maxDuration = 60`). Le cron mensuel enchaîne les audits **en série** dans une fonction de 300 s (`PER_AUDIT_RESERVE_MS = 60 000`), soit environ 4 audits par appel et au plus 50 commerces « dus » par jour.
- À 200 clients, ça passe de justesse. À 1 000, non. Un audit élargi (25 à 150 questions × 4 IA × 2 passages) ne tient pas en 60 s.
- **Correction**
  - Table `jobs(id, kind: audit|factcheck|digest|page_audit, business_id, payload, status, attempts, run_after, locked_until, result_ref)`.
  - Les routes enfilent et renvoient `202 { jobId }`. L'interface interroge `GET /api/jobs/[id]` (ou s'abonne en temps réel via Supabase) et affiche une barre de progression (« ChatGPT 8/25… »).
  - Le traitement : cron Vercel chaque minute qui prend N tâches avec `for update skip locked`, ou un service de file (Inngest, QStash). Chaque appel IA devient une étape relançable : les réponses partielles sont stockées, la reprise est idempotente.
  - Plafond de coût par client et global (déjà esquissé dans `ratelimit`).

### 4.4 Planification par client

- Aujourd'hui, un rythme global : audit tous les 28 jours, digest le lundi à 7 h 30.
- **Correction** : `schedules(business_id, kind, rrule, tz, next_run_at)`, avec par défaut :

| Plan | Audit complet | Échantillon | Digest |
|---|---|---|---|
| Essentiel | mensuel | — | hebdo |
| Accompagné | mensuel | hebdomadaire (10 questions × 2 IA, doc 06 §2.1) | hebdo |

- Le cron horaire enfile ce qui est dû (`next_run_at <= now()`). Fuseau et jour d'envoi réglables par le client.

### 4.5 Quotas par plan

| Ressource | Défini ? | Appliqué ? |
|---|---|---|
| Copilote / mois | `COPILOT_MONTHLY_QUOTA` | ✗ (seul plafond : 60 par jour et par compte, variable d'environnement) |
| Questions suivies | doc 06 (25/100/150) | ✗ (pas de gestion des questions) |
| Établissements | `MAX_BUSINESSES` | ✗ |
| Utilisateurs | doc 06 | ✗ (pas de membres) |
| IA mesurées | doc 06 | ✗ |

**Correction.** Un module `src/lib/entitlements.ts` :
- `entitlements(business) → { questions, providers, copilotPerMonth, seats, businesses, features: Set<'csv'|'slack'|'share'|'compare'|'page_audit'|'scheduled_reports'> }`, dérivé de `getPlan(planId)` ;
- `assertEntitlement(business, feature)` côté routes ;
- `usage(business, resource, period)` via `incrDoc` du store (déjà présent).

### 4.6 Verrouillage des fonctions par plan

- Aucun écran ne teste le plan. En démo, tout est visible, ce qui est bien pour vendre. En réel, un client gratuit (`plan: 'free'`) a accès à tout l'espace.
- **Correction**
  - Composant `<Gate feature="csv">` : rend les enfants, ou une version floutée avec « Disponible avec Accompagné · Comparer les offres ».
  - Côté API : `assertEntitlement`.
  - Plan `free` = rapport + Lundi en lecture + 1 tâche ; le reste passe derrière un `Gate`.
  - En démo, `Gate` affiche une petite pastille « Accompagné », sans flou.

### 4.7 Autres préalables

- **Préférences, destinataires et push stockés côté serveur** (RG1).
- **Isolation du mode démo** : les identifiants `demo*` partagent le store. `localDemo` évite déjà les écritures, mais les routes `exec/tasks` acceptent les identifiants démo sans authentification. Vérifier qu'aucune écriture serveur n'est possible sur `demo*`.
- **Observabilité** : pas de journalisation structurée ni de suivi des erreurs (`console.error` seulement). Ajouter Sentry (ou équivalent), un identifiant de requête et des métriques de file.
- **Suppression du compte et export RGPD** : absents de l'app.

---

## 5. Parcours d'onboarding cible (première valeur en moins de 5 minutes)

**Principe.** Le client a déjà vu un rapport gratuit avant de payer. Il ne faut **rien lui redemander** de ce que l'audit sait, et lui faire vivre tout de suite la « peur utile » : l'erreur d'IA. Puis la première tâche faite.

| Minute | Écran | Ce qui se passe | Données / composant |
|---|---|---|---|
| 0:00 | E-mail de confirmation Stripe | « Votre espace est prêt » → lien magique `/app/rejoindre?t=…` (rattachement §4.2, sans mot de passe) | `claims`, `sendPurchaseConfirmationEmail` |
| 0:30 | `/app/bienvenue` (1/4) **« Vérifions vos informations »** | La fiche de vérité est **pré-remplie** avec ce que les IA ont dit (valeur majoritaire). Chaque champ : « Juste ✓ » ou « Corriger ». L'erreur d'IA apparaît en rouge **au moment où le client confirme la bonne valeur** | `TruthEditor` en mode assistant ; `factCheck` de l'audit acheté |
| 2:00 | 2/4 **« Vos questions »** | Les 8 questions de l'audit, cochées, + 5 suggestions + un champ « Ajouter la question que vos clients posent ». Tags proposés : marque, urgence, prix, comparatif | Gestion des questions (amélioration n° 1) |
| 3:00 | 3/4 **« Qui vous ressemble ? »** | Les concurrents cités par les IA ; cochez ceux à suivre (5 maximum) ; « Ajouter un concurrent » | `concurrents suivis` (C5) |
| 3:45 | 4/4 **« Où vous prévenir ? »** | E-mail (pré-rempli), + 1 destinataire (associé ou agence), Slack (bouton OAuth « Ajouter à Slack »), heure du lundi | `digest_recipients`, `integrations.slack` |
| 4:30 | **Lundi**, avec la carte « Votre première tâche (15 min) » | La tâche de correction de l'erreur, avec le texte prêt et « Copier ». Une fois cochée, confettis sobres + « Repéré revérifie Gemini lundi prochain » | `WeeklyTasks`, `jobs: factcheck` planifié à J+7 |
| Ensuite | Checklist « Bien démarrer » (Lundi, colonne de droite, 6 étapes, masquable) | ① Fiche de vérité vérifiée ② Questions choisies ③ 1ʳᵉ tâche faite ④ Snippet de trafic installé (bouton « Envoyer à mon développeur » par e-mail) ⑤ 1 collègue invité ⑥ 1ʳᵉ source gagnée. Barre « 3/6 », chaque étape mène à son écran | `onboarding.steps` dans `businesses.meta` |
| J+1 | E-mail « Installez le suivi du trafic en 2 minutes » (si ④ non fait) | Snippet, ou plugin WordPress, ou « Transférer à mon développeur » | `email.ts` |
| J+7 | Premier digest **avec résultat** : « Gemini donne-t-il toujours les mauvais horaires ? » (revérification ciblée) | Boucle de valeur visible | `jobs: factcheck` |

**États vides utiles** (compte réel sans audit, ou audit en cours) :
- Lundi : barre de progression du job d'audit (« ChatGPT 6/8 questions… »), estimation en minutes, et un **aperçu démo flouté** étiqueté « exemple ».
- Trafic sans snippet : capture de la courbe démo + 3 options d'installation.
- Concurrents au 1ᵉʳ audit : « La courbe démarre le mois prochain. En attendant, voici le classement. »

**Indicateurs d'activation à suivre** : part des clients ayant fini les étapes ①–③ en moins de 10 min ; 1ʳᵉ tâche faite sous 7 jours ; snippet installé sous 14 jours ; collègue invité sous 30 jours (PME).

---

## 6. Les 20 améliorations prioritaires, prêtes à implémenter

Ordre : valeur ÷ effort, avec les préalables d'architecture en tête. Effort : S < ½ j · M ≈ 1–3 j · L ≈ 1–2 semaines.

### 1. Gestion des questions suivies (M), P0
- **Écran.** `/app/questions` (remplace la redirection de `/app/requetes`). Entrée « Questions » dans le groupe Visibilité.
- **Composants.** `QuestionTable.tsx` (client) :
  - colonnes : texte, tags, intention, IA, présence sur le dernier audit (●○○), tendance sur 6 mois, actif ;
  - `QuestionDrawer` pour ajouter et modifier ;
  - `SuggestionList` : 10 suggestions issues de `engine/queries-v2.ts` avec les variantes non retenues, les questions où les concurrents gagnent, et les intentions manquantes.
- **Données.** Collection `track.queries` : `{ id, businessId, text, tags[], intent, providers[], active, source: 'audit'|'user'|'suggested', createdAt }`. `runAudit` lit les questions actives du commerce si elles existent, sinon celles générées. Quota : `entitlements.questions`.
- **Comportement.**
  - Ajout → validation (5 à 200 caractères, pas d'URL), détection de doublon (similarité de Jaccard > 0,8), puis mesure « à blanc » optionnelle (1 question × 3 IA, en job), avec résultat en moins d'une minute.
  - Désactivation : l'historique est conservé.
  - Tags libres + 4 proposés (marque, prix, urgence, comparatif). Filtre par tag partout via `?tag=`.
  - Démo : modifications en `localDemo`, avec la mention « non enregistré ».

### 2. Historique par question et par IA (M), P0
- **Écran.** Tiroir `/app/questions/[id]`, ouvert aussi depuis la grille de `/app/ia`.
- **Composant.** `QuestionHistory.tsx` : matrice mois × IA (cellule = cité ✓ avec rang / absent ✗), courbe « présence sur 2 passages », liste des concurrents cités sur cette question ce mois-ci, et le verbatim du mois pour chaque IA.
- **Données.** `ws.audits[].mentions` filtrées par `queryId`. Rapprochement des questions d'un audit à l'autre par `normalizeQuery(text)`, puisque l'identifiant change à chaque génération.
- **Comportement.** Clic sur une cellule → réponse brute (n° 3). Bouton « Créer une tâche pour cette question » (le copilote, intention `question_plan`, propose les sources citées où vous êtes absent).

### 3. Réponses brutes avec surlignage (M), P0
- **Écran.** Tiroir latéral `AnswerDrawer` (plein écran en mobile), ouvert depuis Lundi (verbatims), IA (verbatims et grille), Vérité (citation fautive), Concurrents (verbatim d'un concurrent).
- **Données.** Stocker `audit_runs.raw_answer` et `citations[]` (URL, titre, position), déjà reçus des API ChatGPT et Perplexity. Démo : générer des réponses de 80 à 150 mots dans `mock-v2.ts`.
- **Comportement.**
  - Surlignage : marque du client (ambre), concurrents (indigo, cliquables vers leur page), faits contredits (souligné rouge, avec infobulle « Votre fiche : … »), URL citées en exposant [1] [2] vers la liste en pied de réponse.
  - Navigation ← → entre les réponses de la même question (IA, passage).
  - Boutons « Copier », « Signaler une erreur de mesure » (`feedback`) et « Ajouter une tâche ».

### 4. Explorateur de citations, URL par URL (M), P0
- **Écran.** `/app/sources` passe en deux onglets : « Domaines » (existant) et « Pages citées » (nouveau).
- **Composant.** `CitationTable.tsx` :
  - colonnes : URL (titre + chemin), domaine, catégorie, citations (nombre), IA, questions (puces), première et dernière vue, vous mentionné sur la page (oui / non / inconnu), concurrents mentionnés ;
  - recherche plein texte, filtres (IA, catégorie, « je n'y suis pas »), export CSV.
- **Données.** Agrégation `audit_runs.citations` par URL normalisée, avec la ligne de vie sur 6 audits. `sources/index.ts` agrège déjà par domaine : ajouter `byUrl`.
- **Comportement.** Clic sur une ligne → panneau avec les réponses qui citent cette URL (n° 3). « Contacter l'auteur » (brouillon d'e-mail existant en e-commerce) et « Ajouter à mes tâches ».

### 5. Export CSV partout (S), P0
- **Composant.** `ExportButton({ href })`. Routes `GET /api/export/[kind].csv?businessId=&from=&to=`, avec `kind ∈ ranking | sov_history | sources | citations | answers | tasks | traffic_daily | questions`.
- **Données.** Fonctions pures `toCsv(rows, columns)` dans `src/lib/export/csv.ts` : séparateur `;`, BOM UTF-8 pour Excel français, dates ISO, nombres en virgule décimale.
- **Comportement.** Bouton dans l'en-tête de chaque tableau ou graphique, et à côté de « Voir les données ». Contrôle d'accès (`canAccessBusiness`), puis `Gate feature="csv"`. Démo autorisée. Le copilote « exporte en CSV » renvoie le lien.

### 6. Rapports planifiés, destinataires côté serveur, lien de partage (M), P0
- **Écran.** Rapports > panneau « Envoi automatique » ; Réglages > Alertes, branché sur le serveur.
- **Données.**
  - `PATCH /api/settings` → `businesses.alert_prefs` (jsonb) ;
  - table `report_schedules(business_id, kind: digest|monthly|quarterly, recipients[], channel: email|slack, day, hour, tz)` ;
  - table `share_links(token, business_id, scope: 'report'|'dashboard', audit_id?, expires_at, revoked_at, views)`.
- **Comportement.**
  - Destinataires : 5 maximum en Essentiel, 20 en Accompagné, avec double opt-in (e-mail de confirmation, obligation CNIL).
  - « Copier le lien » crée une page `/partage/[token]` en lecture seule (bilan + classement + courbe, sans tâches ni fiche de vérité), expirant à 90 jours, révocable, avec compteur de vues.
  - Le cron hebdomadaire lit `report_schedules` et non plus `contact_email` seul. `Settings.tsx` supprime l'usage de `localStorage`.

### 7. Copilote : 14 intentions manquantes, concurrent inconnu, quotas (M), P0
- **Fichiers.** `lib/copilot/demo.ts` (`detectIntent` + réponses), `copilot/context.ts`, `Copilot.tsx`, `api/copilot/route.ts`.
- **Intentions.** `rank`, `provider_score`, `citations_urls`, `track_question` (crée la question, n° 1), `period_compare`, `fact_lookup`, `missing_queries`, `fastest_competitor`, `export`, `content_ideas` (questions où aucun concurrent n'a de page citée), `crawlers`, `plan_quarter` (12 semaines tirées de `generateTasks`, triées par impact et effort), `page_citable` (redirige vers l'audit de page, n° 9), `thanks` (réponse courte).
- **Comportement.**
  - Concurrent inconnu : CP2.
  - Grief d'avis : CP3.
  - Sous chaque réponse : « Copier », « Ajouter à mes tâches » (sur chaque tâche citée), « Télécharger » (livrable), notes de sources [1] [2] vers l'écran.
  - Panneau « Conversations » (API `GET` existante).
  - Compteur de quota mensuel (`usage('copilot', month)` contre `COPILOT_MONTHLY_QUOTA[segment]`).
  - **Test** : les 30 questions de `qa/v3/app/_copilote.json` dans `copilot.test.ts`, avec l'intention attendue et une assertion sur le concurrent nommé.

### 8. Page détaillée d'un concurrent + « Pourquoi ils passent devant » spécifique (M)
- **Écran.** `/app/concurrents/[slug]`. Les cartes « Pourquoi » y mènent.
- **Contenu.**
  - Courbe de part de voix contre vous, par IA ;
  - questions où il gagne et vous pas (lien vers n° 2) ;
  - sources : lui ✓ / vous ✗, triées par nombre de citations **de lui sur cette source** ;
  - verbatims sur lui ;
  - 3 tâches « pour le rattraper », avec ajout.
- **Données.** `insights.ts` calcule `gap.sources = domains.filter(d => d.competitorsPresent.includes(c) && d.clientPresence !== 'present')` avec `citationsFor(c, d)`. Les phrases génériques sont supprimées (C1).
- **Plus.** « Suivre ce concurrent » (C5).

### 9. Audit de page : URL → score de citabilité (M), P0
- **Écran.** `/app/outils/page` (nouvelle entrée de groupe « Outils »). Version publique sans connexion sur `/outils/citabilite` (acquisition, cf. brief V3).
- **Moteur.** `src/lib/pageaudit/` : récupération côté serveur (timeout 8 s, 2 Mo maximum, liste blocante des IP privées contre le SSRF), puis analyse :

| Critère | Points |
|---|---|
| Titre et H1 répondent à une question | 10 |
| Réponse directe dans les 60 premiers mots | 15 |
| Faits chiffrés et datés | 10 |
| Listes et tableaux | 10 |
| FAQ + `FAQPage` | 10 |
| Schema (`Organization`, `LocalBusiness`, `Product`, `SoftwareApplication`) | 15 |
| Auteur et date de mise à jour | 10 |
| Lisible sans JavaScript (texte du HTML brut / texte rendu) | 10 |
| Liens vers des sources | 5 |
| Cohérence avec la fiche de vérité | 5 |

- **Sortie.** Score sur 100, et pour chaque critère : constat, correction et extrait prêt (bloc FAQ, JSON-LD via `buildJsonLd`).
- **Comportement.** Job asynchrone (§4.3), résultat en 10 à 20 s, historique des pages auditées, « Ajouter les corrections à mes tâches ». Quota : 5 par mois en Essentiel, 50 en Accompagné.

### 10. Audit technique « prêt pour les IA » (M), P0
- **Écran.** `/app/outils/technique` + une carte dans Lundi quand un point est bloquant.
- **Contrôles automatiques.**
  - `robots.txt` : GPTBot, OAI-SearchBot, ChatGPT-User, PerplexityBot, ClaudeBot, Claude-SearchBot, Google-Extended, Applebot-Extended ; distinction indexation et entraînement ;
  - sitemap présent et valide ;
  - réponse 200 avec l'agent utilisateur de chaque robot (détection des pare-feux applicatifs et de Cloudflare « Block AI bots ») ;
  - rendu : part de texte dans le HTML brut ;
  - JSON-LD valide et cohérent avec la fiche de vérité ;
  - `llms.txt` (bonus sans preuve d'effet) ;
  - balises meta `noai` / `noimageai` ;
  - temps de réponse.
- **Données.** Job hebdomadaire. Résultats en `exec.techcheck`. Croisement avec le tableau des robots vus de Trafic (« OAI-SearchBot jamais vu depuis 90 jours : robots.txt le bloque ligne 12 »).
- **Comportement.** Chaque point en échec propose une tâche avec livrable (`robots.txt` corrigé, prêt à coller).

### 11. Onboarding guidé + checklist (M), P0
Voir §5.
- **Fichiers.** `src/app/app/bienvenue/[step]/page.tsx` ; `Onboarding.tsx` (étapes) ; `Checklist.tsx` (colonne Lundi).
- **Données.** `businesses.meta.onboarding = { factsConfirmed, queriesChosen, competitorsChosen, notifications, firstTaskDone, snippetInstalled, memberInvited, firstSourceWon }`, mis à jour par les routes concernées.
- **Comportement.** Redirection vers `/app/bienvenue/1` tant que les étapes ①–③ ne sont pas faites, avec « Passer » possible.

### 12. Slack (et Teams) pour le digest et les alertes (S), P0
- **Écran.** Réglages > Intégrations > « Ajouter à Slack ».
- **Implémentation.** Webhook entrant : OAuth Slack `incoming-webhook` → URL stockée chiffrée dans `integrations(business_id, kind, secret_enc)`. Teams : URL de webhook collée par le client.
- **Format.** Blocs Slack : phrase de la semaine, rang, erreur (bouton « Corriger » vers l'app), 3 tâches.
- **Comportement.** Envoi via `report_schedules.channel = 'slack'`. Alertes critiques (erreur factuelle, concurrent qui passe devant) en temps réel. Message de test à la connexion.

### 13. Comparaison de périodes et sélecteur global (M)
- **Composant.** `PeriodPicker` dans `PageHeader` : dernier audit / 3 mois / 6 mois / personnalisé, plus « Comparer à » (audit précédent, il y a 3 mois). État dans l'URL (`?from=&to=&vs=`).
- **Écrans.** Lundi (indicateurs), IA (grille avec Δ), Concurrents (classement Δ, courbe sur la plage), Sources (domaines gagnés ou perdus), Trafic (déjà 30 / 90 j : unifier).
- **Données.** Fonction `diffAudits(a, b)` dans `digest/stats.ts` : questions gagnées et perdues, concurrents entrés et sortis, sources gagnées et perdues, erreurs ouvertes et fermées.
- **Rapports.** Cocher deux audits → `/app/rapports/comparer?a=&b=`.

### 14. Annotations sur toutes les courbes + annotations manuelles (S)
- **Composants.** `LineChart` prend déjà `markers` : les brancher sur la part de voix (Concurrents) et le score (sparkline de Lundi, version large dans Rapports).
- **Données.** `annotations(business_id, date, label, kind: action|external|manual, task_id?)`. Les tâches faites alimentent les actions ; Repéré alimente les événements externes (bug ChatGPT…) ; le client ajoute les siennes (« article Le Parisien paru »).
- **Comportement.**
  - Deux styles (TR2), libellé au survol et au focus clavier, liste sous le graphique.
  - « + Ajouter un repère » ouvre un mini-formulaire (date, texte de 80 caractères).
  - Effet mesuré : sur la prochaine mesure après un repère d'action, afficher « +3 citations depuis » quand la source concernée est citée.

### 15. Objectifs et cibles (S)
- **Écran.** Bloc « Votre objectif » sur Lundi + Réglages.
- **Données.** `goals(business_id, metric: rank|sov|score|ai_visits|errors, target, by_date)`. Valeur par défaut proposée selon le parcours : « Entrer dans le top 3 d'ici le 31 mars ».
- **Comportement.** Barre de progression. Ligne cible pointillée sur la courbe correspondante. Le digest mentionne l'écart (« il vous manque 3 citations »). Le copilote `plan_quarter` part de l'objectif. Aucune promesse : libellé « objectif que vous vous fixez ».

### 16. Plans, quotas et verrouillage (M), P0
Voir §4.5 et §4.6.
- **Fichiers.** `src/lib/entitlements.ts`, `src/components/app/Gate.tsx`, `src/components/app/UsageMeter.tsx`.
- **Écran.** Réglages > Abonnement : plan (nom tiré de `getPlan`), usage (questions, copilote, destinataires, audits de page), « Changer d'offre » (Checkout de mise à niveau), factures (portail Stripe).
- **Corrections.** RG3, et `MAX_BUSINESSES` appliqué à la création.

### 17. Multi-utilisateurs et rôles (L), prépare PME et e-commerce
- **Données.** `memberships` (§4.1, A4). Invitation par e-mail (`invites(token, email, role, expires_at)`). Politiques RLS `owns_business` → `is_member(business_id, min_role)`.
- **Écran.** Réglages > Équipe : liste, rôle, inviter, retirer.

| Rôle | Peut |
|---|---|
| Lecteur | voir et recevoir les rapports |
| Contributeur | cocher les tâches, modifier la fiche de vérité |
| Propriétaire | facturation, membres |

- **Plus.** Assignation des tâches (T3). Le digest de chaque membre ne contient que ses tâches.

### 18. Navigation : onglets mobiles, sélecteur d'établissement, centre de notifications (M)
- `nav.ts` : S1.
- `Shell.tsx` : menu établissement et compte (S2) ; cloche avec badge.
- `NotificationsPanel.tsx` lit `alerts` (déjà enregistrées par `detectAndRecordAlerts`) avec `read_at`, et propose « Tout marquer comme lu ».
- Push : enregistrer l'abonnement par `POST /api/push/subscribe` (table `push_subscriptions`) ; émetteur `web-push` dans le cron d'alertes, en respectant les heures calmes (20 h – 8 h).

### 19. Cohérence des chiffres et des dates : correctifs + test de garde (S)
- Corrections D1–D13 : I1, I2, L2, V1, C2, C3, L4, SO1, L3, RG3, CP2, TR5, D13.
- `openFactErrors(ws)` unique (S5).
- Test `coherence-demo.test.ts` (§3).
- `mock-v2.ts` : plafonds de vraisemblance (leader ≤ 70 % des réponses, source ≤ 85 %, conversion IA e-commerce ≤ 3 %).

### 20. Palette de commandes Cmd+K, raccourcis et aide contextuelle (M)
- **Composant.** `CommandPalette.tsx` (dialogue `role="dialog"`, liste `listbox`, piège de focus), ouvert par ⌘K / Ctrl+K et par une icône de recherche dans l'en-tête mobile.
- **Index.** Écrans, questions suivies, concurrents, domaines et URL, tâches, actions (« Exporter le classement », « Ajouter une question », « Inviter un collègue », « Poser au copilote : … »). Recherche floue côté client sur un index chargé avec la coquille (≤ 50 Ko).
- **Raccourcis.** `g` puis `l` / `i` / `v` / `s` / `c` / `t` / `r` pour naviguer ; `?` affiche l'aide ; dans Tâches, `j` / `k` pour se déplacer et `x` pour « c'est fait ».
- **Aide.** Icône « ? » dans `PageHeader`, qui ouvre un tiroir avec la définition des métriques de l'écran (part de voix, plancher mesuré, passages), un lien vers /methode et /glossaire, et un contact.
- **Mode sombre.** Reporté (P3), mais commencer par remplacer les hexadécimaux en dur du JSX par des tokens (`app.css`) pendant ces chantiers.

---

### Ordre de livraison suggéré

| Vague | Contenu | Nature |
|---|---|---|
| 1 (≈ 1 sem.) | 19, 7, 5, 12, 14, 15 | Correctifs, copilote, CSV, Slack, annotations, objectifs |
| 2 (≈ 2 sem.) | §4.1–4.2 (auth et rattachement), 16, 6, 11 | Production possible et payante |
| 3 (≈ 2 sem.) | 1, 2, 3, 4, 13 | Parité Profound et Peec sur la mesure |
| 4 (≈ 2 sem.) | 9, 10, 8, 18 | Outils différenciants + acquisition gratuite |
| 5 | 17, 20, §4.3–4.4 (file d'attente, planification) | Passage à plusieurs centaines de clients |

### Ne pas toucher
- La phrase de la semaine centrée sur l'erreur.
- La structure tâche, livrable copiable, « où coller ».
- Sources avec les concurrents présents.
- Le ton honnête (plancher mesuré, aucune promesse).
- La performance : chaque écran charge en moins de 1,6 s, sans débordement mobile ni erreur JS.
