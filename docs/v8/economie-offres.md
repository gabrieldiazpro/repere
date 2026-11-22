# Économie des offres : coût réel de la mesure des IA face aux prix (V8, 22 nov. 2026)

Pour le fondateur. **Rien n'a été changé dans les prix ni dans les offres** : ce document propose. Le seul changement de
code est une variable désactivée par défaut (fin du document).

## 1. D'où viennent les chiffres

- **Coût par réponse** : coûts déclarés par chaque fournisseur dans le moteur (`costPerCallEur`, src/lib/engine/providers),
  tarifs publics relevés le 22 nov. 2026 par MOTEURS-IA (docs/MISE-EN-LIGNE.md, étape 6 bis), 1 $ = 0,92 €. Ce sont des
  estimations prudentes (pire cas), pas des factures : à recaler sur les premières factures réelles.
- **Volumes** : table des droits `src/lib/entitlements.ts` (questions, IA, fréquence) et moteur `src/lib/engine/audit.ts`
  (une mesure payante = chaque question posée **3 fois** à chaque IA). 4,33 semaines par mois.
- **Prix** : `src/lib/plans.ts` (identiques à /tarifs), prix nets, franchise de TVA.
- **Autres coûts variables comptés** : plafond mensuel de données SEO par compte (`src/lib/seodata/limits.ts` : 0 / 1 / 3 /
  10 / 40 €) et frais Stripe estimés à 1,5 % + 0,25 € (carte européenne standard). **Non comptés** : le travail humain
  d'Accompagné (le vrai coût de cette offre), l'hébergement et Supabase, les e-mails, le copilote, la rédaction de
  contenus (≈ quelques centimes par contenu), et les tests gratuits (plafonnés à 5 € par jour, soit 150 € par mois au
  plus, par `ANALYSIS_AI_DAILY_CAP_EUR`) qui sont un coût d'acquisition.

### Coût d'une réponse, par IA (extraction des noms comprise, ≈ 0,0003 €)

| IA | Méthode | € par réponse |
|---|---|---|
| ChatGPT | API OpenAI + recherche web | 0,0132 |
| Perplexity | API Sonar + recherche web | 0,0067 |
| Gemini | API, sans recherche web | 0,0150 |
| Claude | API Anthropic + recherche web | 0,0187 |
| Mistral Vibe | API + recherche web | 0,0306 |
| DeepSeek | API + recherche web (pire cas) | 0,0095 |
| Grok | API xAI + web_search (pire cas) | 0,0325 |
| Google AI Overviews | page de résultats, DataForSEO | 0,0040 |
| Google AI Mode | page de résultats, DataForSEO | 0,0040 |
| Copilot (Bing) | page de résultats Bing, DataForSEO | 0,0021 |

Une « question × passage » coûte donc 0,035 € sur 3 IA (ChatGPT, Perplexity, Gemini), 0,054 € sur 4 IA (+ Claude),
0,084 € sur 5 IA (+ Mistral). **Les deux IA de Google ajoutées ensemble coûtent 0,008 €**, soit moins qu'une seule IA
par API : c'est l'ajout le moins cher et, pour les commerces locaux, celui qui pèse le plus.

### Coût mensuel par client = questions × IA × passages × mesures par mois × coût par réponse

## 2. Aujourd'hui : les promesses des offres face au garde-fou de budget

| Offre | Prix/mois | Volume IA par mois | Coût IA/mois | Autres coûts variables | Marge brute (hors travail humain) |
|---|---|---|---|---|---|
| Découverte | 0 € | 5 q × 3 IA × 3 × 1 = 45 réponses | 0,52 € | 0 € | −0,52 € |
| Essentiel local | 29 € | 20 q × 3 IA × 3 × 1 = 180 | 2,09 € | 1,69 € | 25,22 € (87 %) |
| Accompagné local | 99 € | 30 q × 4 IA × 3 × 4,33 = 1 559 | 20,87 € | 11,73 € | 66,40 € (67 %) |
| Essentiel PME | 99 € | 50 q × 4 IA × 3 × 4,33 = 2 598 | 34,78 € | 4,73 € | 59,49 € (60 %) |
| Essentiel e-commerce | 79 € | 50 q × 4 IA × 3 × 4,33 = 2 598 | 34,78 € | 4,44 € | 39,79 € (50 %) |
| Accompagné PME | 490 € | 100 q × 5 IA × 3 × 4,33 = 6 495 | 109,35 € | 17,60 € | 363,05 € (74 %) |
| Accompagné e-commerce | 390 € | 100 q × 5 IA × 3 × 4,33 = 6 495 | 109,35 € | 16,10 € | 264,55 € (68 %) |
| **Agence** (droits actuels : 20 marques, 50 q, 5 IA, chaque semaine) | 149 € | 20 × 50 q × 5 IA × 3 × 4,33 = 64 950 | **1 093,50 €** | 42,48 € | **−986,98 €** |

Trois constats :

1. **Le garde-fou de budget rend aujourd'hui les promesses fausses.** `AUDIT_BUDGET_PAID_EUR` vaut par défaut 2,50 €
   (local) et 2,70 € (PME, e-commerce) **par mesure**. Une mesure complète coûte 4,82 € en Accompagné local, 8,03 € en
   Essentiel PME ou e-commerce et 25,25 € en Accompagné PME ou e-commerce (le « ≈ 25 € » de MOTEURS-IA). Le garde-fou
   retire alors des passages puis des IA : une mesure Accompagné PME n'utilise qu'environ 11 % du volume annoncé
   (« 100 questions, 5 IA, chaque semaine »), sans que l'offre le dise. Le nombre d'appels sautés est noté dans
   `details.skippedForBudget`, rien de plus.
2. **Essentiel PME et e-commerce chaque semaine** coûte plus d'un tiers du prix en IA seule (35 € sur 79 € en e-commerce),
   avant le reste. C'est la ligne la plus fragile.
3. **L'offre Agence est structurellement déficitaire** si chaque marque reçoit les droits Agence actuels
   (`entitlements.ts`, `AGENCE` : 50 questions, 5 IA, chaque semaine) : plus de 1 000 € de coût IA pour 149 €. Même
   plafonnée par le garde-fou (≈ 11,7 € par marque et par mois), 20 marques coûtent ≈ 234 € plus 40 € de données SEO.
   Elle n'est pas encore en vente (liste d'attente) : c'est le moment de la corriger.

Accompagné garde une forte marge sur la mesure, mais c'est l'offre où le travail humain domine (fiches, pages, démarches) :
la marge réelle dépend du temps passé par client, non mesuré ici.

## 3. Trois scénarios chiffrés

### S1 — Sobriété, prix inchangés

Essentiel (tous parcours) mesuré **chaque mois** ; Accompagné reste hebdomadaire mais avec **2 passages** au lieu de 3
(la marge d'erreur s'élargit un peu, elle reste affichée) ; Agence : 20 clients à 30 questions, 4 IA, chaque mois.

| Offre | Prix | Volume IA par mois | Coût IA | Autres | Marge brute |
|---|---|---|---|---|---|
| Découverte | 0 € | 45 réponses | 0,52 € | 0 € | −0,52 € |
| Essentiel local | 29 € | 180 | 2,09 € | 1,69 € | 25,22 € (87 %) |
| Accompagné local | 99 € | 30 q × 4 IA × 2 × 4,33 = 1 039 | 13,91 € | 11,73 € | 73,35 € (74 %) |
| Essentiel PME | 99 € | 50 q × 4 IA × 3 × 1 = 600 | 8,03 € | 4,73 € | 86,23 € (87 %) |
| Essentiel e-commerce | 79 € | 600 | 8,03 € | 4,44 € | 66,53 € (84 %) |
| Accompagné PME | 490 € | 100 q × 5 IA × 2 × 4,33 = 4 330 | 72,90 € | 17,60 € | 399,50 € (82 %) |
| Accompagné e-commerce | 390 € | 4 330 | 72,90 € | 16,10 € | 301,00 € (77 %) |
| Agence | 149 € | 20 × 30 q × 4 IA × 3 × 1 = 7 200 | 96,38 € | 42,48 € | 10,14 € (7 %) |

Inconvénient : « chaque semaine » disparaît de l'Essentiel PME et e-commerce, un argument de vente (à remplacer par
« chaque mois, et une alerte dès qu'un concurrent passe devant »).

### S2 — IA de Google incluses partout (volumes de S1)

Comme S1, plus **Google AI Overviews et Google AI Mode dans toutes les offres** (Découverte comprise).

| Offre | Prix | Volume IA par mois | Coût IA | Autres | Marge brute |
|---|---|---|---|---|---|
| Découverte | 0 € | 5 q × 5 IA × 3 = 75 | 0,64 € | 0 € | −0,64 € |
| Essentiel local | 29 € | 20 q × 5 IA × 3 = 300 | 2,57 € | 1,69 € | 24,75 € (85 %) |
| Accompagné local | 99 € | 30 q × 6 IA × 2 × 4,33 = 1 559 | 15,97 € | 11,73 € | 71,30 € (72 %) |
| Essentiel PME | 99 € | 50 q × 6 IA × 3 = 900 | 9,22 € | 4,73 € | 85,05 € (86 %) |
| Essentiel e-commerce | 79 € | 900 | 9,22 € | 4,44 € | 65,35 € (83 %) |
| Accompagné PME | 490 € | 100 q × 7 IA × 2 × 4,33 = 6 062 | 79,75 € | 17,60 € | 392,65 € (80 %) |
| Accompagné e-commerce | 390 € | 6 062 | 79,75 € | 16,10 € | 294,15 € (75 %) |
| Agence (20 clients) | 149 € | 20 × 30 q × 6 IA × 3 = 10 800 | 110,62 € | 42,48 € | −4,11 € (−3 %) |

L'ajout des deux IA de Google coûte moins d'1 € par mois sur l'Essentiel et ≈ 7 € sur l'Accompagné PME. Il rend vrai,
dans toutes les offres, l'argument « les 7 IA qu'on attend d'un outil sérieux ».

### S3 — Prix ajustés, volumes et rythme actuels, IA de Google incluses

On garde « chaque semaine » et les 3 passages ; Essentiel PME passe de 99 € à **149 €**, Essentiel e-commerce de 79 € à
**129 €** ; Agence : 249 € pour 10 clients hebdomadaires.

| Offre | Prix | Volume IA par mois | Coût IA | Autres | Marge brute |
|---|---|---|---|---|---|
| Essentiel local | 29 € | 300 | 2,57 € | 1,69 € | 24,75 € (85 %) |
| Accompagné local | 99 € | 30 q × 6 IA × 3 × 4,33 = 2 338 | 23,95 € | 11,73 € | 63,32 € (64 %) |
| Essentiel PME | 149 € | 50 q × 6 IA × 3 × 4,33 = 3 897 | 39,92 € | 5,48 € | 103,60 € (70 %) |
| Essentiel e-commerce | 129 € | 3 897 | 39,92 € | 5,18 € | 83,90 € (65 %) |
| Accompagné PME | 490 € | 100 q × 7 IA × 3 × 4,33 = 9 093 | 119,63 € | 17,60 € | 352,77 € (72 %) |
| Accompagné e-commerce | 390 € | 9 093 | 119,63 € | 16,10 € | 254,27 € (65 %) |
| Agence (10 clients hebdomadaires) | 249 € | 10 × 50 q × 6 IA × 3 × 4,33 = 38 970 | 399,16 € | 43,98 € | −194,14 € (−78 %) |

S3 tient pour les offres directes, mais un Essentiel PME à 149 € s'éloigne des 99 $ des outils de mesure d'entrée de
gamme (comparatif), et **aucun prix raisonnable ne rend une agence hebdomadaire rentable** : la mesure hebdomadaire de
dizaines de marques est le poste à éviter.

## 4. Recommandation

**S2, avec une Agence restructurée**, puis recaler sur les premières factures :

1. **IA de Google (AI Overviews et AI Mode) dans toutes les offres**, Découverte comprise : ≈ 0,008 € par question et par
   passage. Il faut alors (décision du fondateur, en attente dans MOTEURS-IA) : ajouter les deux IA à la ligne « N IA : … »
   de chaque offre dans `src/lib/plans.ts`, aux listes d'IA de `src/lib/entitlements.ts`, et lever le second test de
   `src/lib/__tests__/plans-engines.test.ts` (« aucune offre n'annonce AI Overviews… »). Le site affiche déjà ces IA
   « en option » et passera tout seul en « Toutes les offres » (liste lue dans les droits, `src/components/site/ai-coverage.ts`).
2. **Essentiel mesuré chaque mois** dans tous les parcours (déjà le cas en local) ; garder l'alerte quand un concurrent
   passe devant. Textes à changer : `plans.ts` (« 50 questions suivies chaque semaine » → « chaque mois »), entitlements
   (`frequency: 'monthly'`).
3. **Accompagné reste hebdomadaire, 2 passages par semaine** (soit 8 à 9 par mois, bien plus que 3). Demande un petit
   changement du moteur : le nombre de passages par offre (aujourd'hui fixé à 3 dans `runAudit`).
4. **Agence : 149 € pour 10 clients inclus** (30 questions, 6 IA, chaque mois), **+ 9 € par client au-delà** (au lieu de
   « 20 clients, +6 € »). Coût IA ≈ 55 € pour 10 clients, marge ≈ 51 € (34 %) avant travail ; chaque client de plus coûte
   ≈ 5,50 € de mesure. Aligner `AGENCE` dans `entitlements.ts` (aujourd'hui 50 questions, 5 IA, chaque semaine par
   marque) sur ces volumes.
5. **Budget par mesure aligné sur l'offre** : une fois 1 à 4 décidés, poser `AUDIT_BUDGET_PAID_MODE=offre` (voir 5.) pour
   que chaque mesure payante couvre tout le volume promis. Mesure la plus chère du scénario : Accompagné PME ou e-commerce,
   100 questions × 7 IA × 2 passages ≈ 18,40 € ; Essentiel PME ≈ 9,20 € ; Accompagné local ≈ 3,70 €.
6. Garder **Copilot et DeepSeek en option** (Accompagné et Agence sur demande, ≤ 0,01 € par réponse) et **Grok désactivé**
   (≈ 0,03 € par réponse pour une audience faible en France).

Résultat : toutes les offres payantes au-dessus de 70 % de marge brute sur la mesure (avant travail humain), des promesses
enfin entièrement mesurées, et un argument « 6 à 7 IA » vrai partout.

## 5. Ce qui a été fait dans le code (valeur par défaut inchangée)

- `AUDIT_BUDGET_PAID_MODE=offre` (src/lib/engine/audit.ts, `paidBudgetForPlan`) : le budget d'une mesure **payante** devient
  le coût prévu de toutes ses réponses + 10 %, plafonné par `AUDIT_BUDGET_PAID_MAX_EUR` (défaut 25 €), et jamais sous
  `AUDIT_BUDGET_PAID_EUR`. **Variable vide = comportement actuel** (2,50 € / 2,70 €). Documentée dans `.env.example` et
  `src/lib/env.ts` ; testée.
- Attention : avec les volumes actuels (3 passages), une mesure Accompagné PME coûte ≈ 27,60 € avec les IA de Google : le
  plafond de 25 € retirerait encore ≈ 10 % des appels. À poser **avec** la décision sur les passages, ou avec
  `AUDIT_BUDGET_PAID_MAX_EUR=30`.
- Avant de l'activer : fixer un plafond de dépense chez chaque fournisseur et vérifier le compteur « Audits (IA) » de
  /admin/ops (plafond journalier `OPS_DAILY_COST_CAP_EUR`) ; la dépense DataForSEO des relevés d'IA est désormais visible
  dans /admin/roi.
