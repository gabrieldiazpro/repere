# Baromètres Repéré : « Qui les IA recommandent » (V5)

Des données que personne d'autre n'a, publiées chaque mois : les entreprises que ChatGPT, Perplexity, Gemini et Claude
citent quand on leur demande un artisan dans une ville, un logiciel pour PME ou une marque. Objectif : trafic, liens,
prospects, et preuve de la méthode. Règle absolue : **aucune donnée inventée**. Tant qu'un baromètre n'a pas été réellement
mesuré, sa page n'existe pas (404), n'est ni dans le sitemap ni dans llms.txt.

Code : `src/lib/barometre/**`, `scripts/barometre/run.ts`, `src/app/barometre/**`, `src/app/api/v5/barometre/**`.

## 1. Catalogue (src/lib/barometre/catalog.ts)

50 baromètres en V1, par ordre de priorité (utile quand le budget ne suffit pas) :

| Parcours | Découpage | Liste |
|---|---|---|
| Local (40) | métier × ville | plombiers, électriciens, serruriers, chauffagistes, garagistes, agences immobilières, coiffeurs, déménageurs × Paris, Lyon, Marseille, Toulouse, Bordeaux |
| PME (5) | catégorie d'offre | logiciels de paie, CRM, facturation, comptabilité, signature électronique (pour PME) |
| E-commerce (5) | catégorie de produits | cosmétiques solides, café en grains, matelas, baskets éco-responsables, croquettes pour chien |

Slugs : `plombiers-lyon`, `logiciels-de-paie-pour-pme`, `marques-de-cosmetiques-solides`… Professions réglementées
(santé, avocats, experts-comptables, notaires…) exclues, comme dans l'audit (`isRegulatedTrade`, vérifié par
`validateCatalog`). Un baromètre peut être mis en pause (`active: false`), recevoir ses propres questions, IA ou passages,
et des alias de noms validés à la main (`aliases`).

## 2. Questions (8 à 20 par baromètre)

Par défaut 12 questions, tirées des gabarits du moteur, **sans aucun nom d'entreprise** (pas de biais) :
- local : T1–T10 + 2 variantes géographiques (`buildQueries`) — « Quel est le meilleur plombier à Lyon ? »,
  « Urgent : fuite d'eau, quel plombier peut intervenir rapidement à Lyon ? », « Quel plombier a les meilleurs avis à Lyon ? » ;
- PME : P1–P12 (`buildPmeQueries`, sans concurrent déclaré) — « Quel est le meilleur logiciel de paie pour une PME en France ? » ;
- e-commerce : E1–E12 (`buildEcomQueries`) — « Quelle marque française de cosmétiques solides recommandes-tu ? ».
Les questions sont figées au début du mois (stockées avec la collecte) : identifiants stables, comparaison mois à mois.

## 3. IA et passages

- IA : ChatGPT, Perplexity, Gemini, Claude (+ Mistral si `MISTRAL_API_KEY`) ; surcharge par `BAROMETRE_PROVIDERS`.
- 3 passages par question et par IA (les réponses varient) : 12 × 4 × 3 = **144 réponses** par baromètre.
- Localisation : ville transmise aux IA qui l'acceptent (local), pays FR.
- Mesure réelle : seules les IA dont la clé est configurée ; **jamais de repli sur le simulé** (refus explicite).

## 4. Extraction, fusion des noms, exclusions (names.ts, extract.ts)

- Extraction : extracteur LLM le moins cher du moteur avec un prompt « sans cible », validé par `parseExtraction`
  (tout nom absent du texte est rejeté) ; heuristique du moteur en repli.
- Normalisation : accents, casse, formes juridiques (SARL, SAS…), préfixes (« chez », « ets »), ville et arrondissement en fin de nom.
- Fusion (union-find) : même clé ; alias manuels ; même site associé ; même « cœur » (mots hors métier, ordre indifférent) ;
  faute de frappe sur UN mot d'au moins 5 lettres (similarité ≥ 0,88). Jamais de fusion par simple inclusion
  (« Martin » ≠ « Martin Frères ») ni sur des mots courts (« Beta » ≠ « Zeta »). Libellé = orthographe la plus fréquente.
- Site associé : seulement un domaine dont le libellé correspond strictement au nom (pas de similarité floue), hors annuaires et médias connus.
- **Exclusions** (comptées, jamais listées) :
  - nom non vérifiable : publié seulement s'il est cité par **au moins 2 IA**, ou dans **au moins 2 réponses avec son site** ;
  - personne physique (« Jean Dupont » seul) ;
  - nom générique (« Plombier », « Lyon ») ;
  - entreprise ayant demandé son retrait.

## 5. Indicateurs et marges d'erreur (aggregate.ts)

- **Taux de citation** = réponses valides qui citent l'entreprise / réponses valides.
- **Part de voix** = citations de l'entreprise / toutes les citations d'entreprises (y compris les noms non publiés).
- **Marge** : intervalle à 90 % par bootstrap **par question** (on rééchantillonne les questions avec toutes leurs réponses,
  car les passages d'une même question ne sont pas indépendants), 500 tirages, graine fixe (résultat reproductible).
- Classement par taux de citation ; « ≈ » quand l'intervalle chevauche celui de la ligne au-dessus. Détail par IA (n/N),
  position moyenne, nombre de questions. 50 lignes au plus.
- **Sources les plus citées** : domaines (hors Gemini : liens de redirection et conditions d'utilisation), part des
  réponses avec sources qui les citent, type (annuaire, avis, comparatif, média…) via `classifyDomain` du moteur.
- **Évolution** : comparaison avec la dernière édition publiée (même identifiant, même site, variante commune ou même cœur) ;
  écart en points, « significatif » seulement si les intervalles ne se chevauchent pas ; entrées et sorties du classement.

## 6. Publication (storage.ts, public.ts)

Une édition est **publiable** si : réelle (`demo: false` et aucun modèle simulé), méthode courante, collecte complète,
≥ 48 réponses valides et ≥ 90 % des réponses prévues, ≥ 3 entreprises vérifiées. Sinon : pas de page (404), pas d'entrée
de sitemap ni de llms.txt (`publishedEntries()` renvoie `[]`). L'index `/barometre` affiche alors « Premiers baromètres en
préparation » + la méthode, en `noindex`.

Garde-fous démo (testés) : le simulé écrit dans `barometre.demo` ; `saveEdition(…, { target: 'public' })` lève
`DemoPublicationError` ; une édition « déguisée » (drapeau retiré) est détectée par son modèle ; l'aperçu d'une simulation
n'est rendu qu'avec `BAROMETRE_DEMO_PREVIEW=1`, hors production et hors Vercel, avec bandeau, `noindex` et sans JSON-LD.

Versionnage : une édition par baromètre et par mois (`slug:AAAA-MM`), `version` +1 à chaque recalcul, version remplacée
archivée (`barometre.archive`). Une collecte inachevée (budget) n'est jamais enregistrée comme édition.

## 7. Pages et données

- `/barometre` : index (liste des éditions publiées, ou « en préparation »).
- `/barometre/[slug]` : classement avec taux de citation et part de voix et leurs marges, barres d'intervalle, détail par IA,
  évolution, sources citées, méthode (questions, IA et modèles, dates, nombre de réponses, exclusions), téléchargement CSV
  (mois courant et précédents), partage (LinkedIn, X, e-mail), appel « Testez votre entreprise » (/audit), mention
  « Ce classement reflète les réponses des IA, pas la qualité des entreprises », procédure de retrait.
- JSON-LD : WebPage + **Dataset** (distribution CSV, couverture temporelle et spatiale, technique de mesure) + fil d'Ariane.
- `/barometre/[slug]/donnees.csv?periode=AAAA-MM` : CSV « ; », UTF-8 avec BOM, protégé contre l'injection de formules.
- API : `GET /api/v5/barometre` (publiés), `GET /api/v5/barometre/[slug]?periode=` (404 sinon), `GET /api/v5/barometre/plan` (admin : coûts, budget).

## 8. Données d'entreprises tierces, retrait et rectification

Seuls les noms tels qu'écrits par les IA et les sites qu'elles citent publiquement. Aucune autre donnée, aucun nom de
personne. Demande de retrait ou de rectification : lien sur chaque page (e-mail de contact + page contact), traitement
sous 30 jours ; `run.ts --withdraw "Nom" [--slug …]` l'enregistre (`barometre.withdrawals`) : appliqué immédiatement au
rendu et au CSV, puis aux calculs suivants. Une rectification de nom se fait par un alias (`aliases`) dans le catalogue.

## 9. Coût et budget

Coût par appel = celui déclaré par chaque fournisseur du moteur (pire cas, 1 $ = 0,92 €) : ChatGPT 0,0129 €,
Perplexity 0,0064 €, Gemini 0,0147 €, Claude 0,0184 €, Mistral 0,0304 € ; extraction 0,0003 € par réponse (un test
vérifie que la table recopie les fournisseurs).

| Configuration | Appels / baromètre | Coût / baromètre | 50 baromètres / mois |
|---|---|---|---|
| 4 IA × 12 questions × 3 passages | 144 | ≈ 1,93 € | **≈ 96,50 €** (7 200 appels) |
| + Mistral (5 IA) | 180 | ≈ 3,03 € | ≈ 151,50 € |

Budget mensuel : `BAROMETRE_BUDGET_EUR` (défaut 120 €). Le plan retient les baromètres par priorité tant que leur
estimation tient dans le budget restant ; pendant la collecte, chaque appel réserve son coût avant d'être lancé, la
collecte s'arrête avant tout dépassement et reprend le mois suivant ou après hausse du budget.

## 10. Exploitation

```
npx vite-node --config vitest.config.ts scripts/barometre/run.ts --plan          # coût, budget, sans appel
npx vite-node --config vitest.config.ts scripts/barometre/run.ts                 # passe mensuelle réelle (reprend si interrompue)
npx vite-node --config vitest.config.ts scripts/barometre/run.ts --demo --slug plombiers-lyon   # simulation, jamais publiée
BAROMETRE_DEMO_PREVIEW=1 (développement local) → /barometre/plombiers-lyon affiche la simulation avec bandeau
```

Variables : `BAROMETRE_BUDGET_EUR`, `BAROMETRE_PROVIDERS`, `BAROMETRE_DEMO_PREVIEW` (+ clés des IA et Supabase existantes).

Décisions ouvertes (fondateur) : licence du jeu de données (CC BY 4.0 conseillée, absente tant que non décidée) ;
liste des villes et catégories de la V2 ; fréquence d'éventuels baromètres trimestriels plus profonds (20 questions).
