# 03 — Méthode de score AuditIA (v1.0)

> Agent MÉTHODOLOGIE DE SCORE. Document de référence pour `queries.ts`, `detect.ts`, `scoring.ts` et pour la page publique « Notre méthode ».
> Recherche web du 9 novembre 2026. Prix d'API indicatifs, à revérifier au lancement.

---

## 0. Résumé

| Élément | Audit gratuit | Suivi mensuel (29 €) |
|---|---|---|
| Requêtes | **8** (5 intentions) | 12 |
| IA interrogées | ChatGPT, Perplexity, Gemini | les mêmes + Claude |
| Exécutions par requête et par IA | **2** | 3 |
| Réponses analysées | **48** | 144 |
| Coût API estimé, au pire | **≈ 0,55 €** (plafond fixé à 0,60 €) | ≈ 2,10 € |
| Coût réel probable | ≈ 0,30 € (quota gratuit Gemini et cache) | ≈ 1,40 € |

**Score /100 = 100 × (0,45·M + 0,20·R + 0,20·V + 0,15·C)**
- M : taux de mention
- R : qualité du rang
- V : part de voix normalisée
- C : couverture des IA

Le score est toujours affiché avec une **fourchette** (bootstrap à 90 %), un **indice de confiance** (faible, moyenne ou bonne), une **date de mesure** et un **lien vers la méthode**.

---

## 1. Ce que fait le marché, et ce qu'on en retient

| Outil | Métriques publiées | Ce qu'on reprend |
|---|---|---|
| **Otterly.ai** | *Brand Mention* = drapeau 0/1 par prompt × jour × moteur, avec une seule mention comptée par réponse même si plusieurs variantes du nom apparaissent. *SoV* = mentions de la marque ÷ mentions de toutes les marques. *Avg. position* = somme des positions ÷ nombre de réponses où la marque apparaît. *Brand Coverage* et *Domain Coverage* séparées. Règle : **on additionne numérateurs et dénominateurs avant de diviser, on ne fait pas la moyenne des pourcentages** ([KPI Otterly](https://help.otterly.ai/brand-report-kpi-definition?hsLang=en), [insights](https://help.otterly.ai/insights-on-brand-reports)) | Mention 0/1 par réponse, SoV, rang moyen, agrégation en pool, distinction entre mention du nom et citation du domaine |
| **Peec AI** | *Visibility* = % des réponses où la marque apparaît. *Share of Voice*. *Position* = rang moyen quand la marque est présente (1 = citée en premier). *Sentiment* sur 0–100 ([docs Peec](https://docs.peec.ai/metrics-overview), [visibility](https://docs.peec.ai/metrics/brand-metrics/visibility)) | Mêmes définitions. Pas de sentiment en v1 (trop bruité pour 48 réponses) |
| **Profound** | *Visibility score* = réponses qui citent la marque ÷ réponses qui citent au moins une marque. SoV. Average position. Une réponse capturée chaque jour par prompt ([docs Profound](https://docs.tryprofound.com/answer-engine-insights/about), [blog](https://tryprofound.com/blog/how-to-track-your-visibility-in-ai-search)) | Exclure du dénominateur les réponses sans aucune recommandation (refus, « je ne peux pas ») |
| **BrightLocal** (Local AI Visibility, 2026) | Visibility score, mention rate, share of voice, average position, par plateforme, par type de prompt et par prompt. Plateformes : ChatGPT, Google AI Overview, AI Mode ([help BrightLocal](https://help.brightlocal.com/hc/en-us/articles/37989673412114-What-is-Local-AI-Visibility), [annonce](https://www.brightlocal.com/blog/new-local-ai-visibility-tracker/)) | Prompts typés par intention, sous-scores par plateforme. BrightLocal confirme que ces 4 métriques font référence en local |

**Ce qui distingue AuditIA** : les quatre acteurs affichent un chiffre ponctuel. Aucun ne publie de fourchette ni d'indice de confiance. Nous les affichons, ce qui rend notre score honnête et défendable.

### Ce qu'on sait sur la variance des réponses
- **SparkToro × Gumshoe (2026)** : 600 volontaires ont lancé 12 prompts identiques près de 3 000 fois sur ChatGPT, Claude et l'IA de Google. La probabilité d'obtenir deux fois la même liste est inférieure à 1 %, et d'environ 1 sur 1 000 dans le même ordre. En revanche, certaines marques apparaissent dans 60 à 90 % des réponses pour une intention donnée, et les petits marchés sont plus stables. Les auteurs recommandent donc de **mesurer une fréquence d'apparition sur plusieurs prompts et plusieurs exécutions, pas un rang exact** ([Search Engine Land](https://searchengineland.com/ai-recommendation-lists-rarely-repeat-study-468076), [SEJ](https://www.searchenginejournal.com/ai-recommendations-change-with-nearly-every-query-sparktoro/566242), [MediaPost](https://www.mediapost.com/publications/article/412364/ai-brand-recommendations-chaotic-inconsistent.html)).
- **Atil et al., « Non-Determinism of "Deterministic" LLM Settings »** : même à température 0 avec une graine fixée, la précision varie jusqu'à environ 15 % entre exécutions, et les sorties identiques au caractère près sont rares. Les sorties longues sont moins stables. Les distributions ne sont pas normales, donc moyenne ± écart-type les résume mal. Les auteurs recommandent de **publier le min et le max entre exécutions**, de parser les sorties de façon robuste et de limiter la longueur de génération ([arXiv 2408.04667](https://arxiv.org/html/2408.04667v5)). Voir aussi [Song et al., arXiv 2407.10457](https://arxiv.org/pdf/2407.10457) et [Ouyang et al., arXiv 2308.02828](https://arxiv.org/html/2308.02828v2).

**Conséquences pour la conception** :
1. Le score repose sur des **fréquences**. Le rang ne pèse que 20 %.
2. On interroge **plusieurs formulations par intention** : elles font remonter des ensembles proches, ce qui stabilise la mesure plus efficacement que de répéter une même requête.
3. On répète chaque requête **au moins 2 fois**. Sans cela, impossible de mesurer la stabilité et donc de calculer un indice de confiance.
4. On publie une **fourchette**, calculée par bootstrap et non par une formule gaussienne.
5. On plafonne la longueur de réponse (`max_output_tokens ≈ 700`) et on parse de façon tolérante.

---

## 2. Jeu de requêtes

### 2.1 Variables

| Variable | Exemple | Source |
|---|---|---|
| `{metier}` | plombier | saisi, normalisé via `TRADES` |
| `{metiers}` | plombiers | pluriel issu du dictionnaire |
| `{activite}` | plomberie | nom de l'activité issu du dictionnaire |
| `{ville}` | Paris | saisi |
| `{quartier}` | Bastille | `district` s'il n'est pas numérique |
| `{arr}` | Paris 11e | `district` numérique → « Paris 11e », ou CP 75011 → « Paris 11e » |
| `{zone}` | `{arr}`, sinon `{quartier} à {ville}`, sinon `{ville}` | dérivé |
| `{service}` | recherche de fuite | `TRADES[metier].services[0..1]` |
| `{urgence}` | fuite d'eau, porte claquée | `TRADES[metier].urgency` (ou `null`) |

Le dictionnaire `TRADES` couvre au départ environ 40 métiers : artisans du bâtiment, restaurants par cuisine, coiffeur, esthéticienne, garagiste, dentiste, ostéopathe, vétérinaire, agence immobilière, avocat, expert-comptable, fleuriste, boulanger, etc. Chaque entrée contient : pluriel, nom de l'activité, 2 à 4 services phares, une urgence possible et un booléen `hasUrgency`.

### 2.2 Les 10 gabarits (français naturel, comme un vrai client)

| # | Intention | Gabarit |
|---|---|---|
| T1 | `best` | « Quel est le meilleur {metier} à {zone} ? » |
| T2 | `best` | « Tu peux me conseiller un bon {metier} à {zone} ? » |
| T3 | `nearby` | « {metier} près de {quartier\|arr}, lequel choisir ? » |
| T4 | `nearby` | « Je cherche un {metier} pas loin de chez moi, j'habite {zone}. Des adresses ? » |
| T5 | `urgent` | « Urgent : {urgence}, quel {metier} peut intervenir rapidement à {zone} ? » |
| T6 | `urgent` (variante sans urgence métier) | « Quel {metier} à {zone} est disponible rapidement, même le samedi ? » |
| T7 | `specific` | « Qui fait de la {service} à {zone} ? » (ex. : « Qui fait de la recherche de fuite à Paris 11e ? ») |
| T8 | `specific` | « Je cherche un {metier} spécialisé en {service2} à {ville}, tu as des noms ? » |
| T9 | `review` | « Quel {metier} a les meilleurs avis à {zone} ? » |
| T10 | `review` | « {metiers} à {zone} : lesquels sont fiables et pas trop chers ? » |

Restaurants et commerces : T5 est remplacé par « Où manger {cuisine} ce soir près de {quartier} ? » (intention `urgent`, au sens d'un besoin immédiat).

### 2.3 Sélection

- **Audit gratuit, 8 requêtes** : T1, T2, T3, T4, (T5 si `hasUrgency`, sinon T6), T7, T8, T9.
  Répartition : best ×2, nearby ×2, urgent ×1, specific ×2, review ×1.
- **Suivi mensuel, 12 requêtes** : les 10 gabarits + 2 variantes géographiques (`{arr}` et `{quartier}` permutés, ou commune voisine hors Paris).
- La liste des requêtes est **figée par commerce** : on stocke `QuerySpec[]` à la première mesure et on le réutilise chaque mois. C'est la condition pour comparer d'un mois sur l'autre.
- `QuerySpec.id` = `"{gabarit}-{hash court du texte}"`, par exemple `T3-a91f`.

### 2.4 Règles d'envoi aux IA
- **Aucun prompt système** et aucune consigne de format : on reproduit un utilisateur réel. Une consigne « donne une liste » biaiserait les réponses.
- **Ne jamais inclure le nom du commerce** dans la requête. Avantage : les réponses deviennent **partageables entre tous les commerces d'un même couple métier × zone**, avec un cache de 24 h. Voir § 3.3.
- Localisation : OpenAI `web_search` avec `user_location: { country: "FR", city }` ; Perplexity `web_search_options.user_location` ; Gemini avec ancrage Google Search (`google_search`).
- Température par défaut du fournisseur (c'est ce que voient les utilisateurs) et `max_output_tokens = 700`.
- On enregistre `model`, la date et l'heure pour chaque `ProviderAnswer`, afin de permettre l'audit de la mesure.

---

## 3. Exécutions et budget

### 3.1 Pourquoi 8 requêtes × 2 exécutions × 3 IA
- **Diversité de formulations plutôt que répétition** : SparkToro montre que des formulations différentes d'une même intention convergent vers des ensembles proches, alors qu'une même requête produit une liste différente à chaque fois. Huit formulations couvrent les cinq intentions.
- **Deux exécutions** : c'est le minimum pour mesurer l'accord entre exécutions, qui alimente l'indice de confiance. Une troisième exécution coûterait 50 % de plus pour un gain de précision marginal sur le score global. Elle est réservée au suivi payant.
- **Précision obtenue** : avec n = 48 réponses, la demi-largeur de l'intervalle de Wilson à 90 % sur le taux de mention vaut au pire (p = 0,5) environ **±12 points**, et environ ±8 points pour p = 0,15. Par IA (n = 16), on est autour de ±19 points : les sous-scores par IA sont donc indicatifs et affichés comme tels.

### 3.2 Coût unitaire (pire cas, novembre 2026)

| IA | Appel | Prix publics retenus | Coût par appel |
|---|---|---|---|
| ChatGPT | `gpt-5-mini` (ou `gpt-4o-mini`) avec l'outil `web_search` | 10 $ pour 1 000 appels, plus les jetons de contenu de recherche au tarif du modèle ([nesyona, 26/10/2026](https://nesyona.com/articles/ai-web-search-tool-prices-per-1000-calls-2026)) | ≈ 0,014 $ |
| Perplexity | `sonar`, contexte de recherche *low* | frais de requête de 5 à 6 $ pour 1 000 appels, plus environ 1 $ par million de jetons ([activepieces](https://www.activepieces.com/blog/perplexity-sonar-api-cost-per-search-2026-guide.md), [puter](https://developer.puter.com/tutorials/perplexity-api-pricing/)) | ≈ 0,007 $ |
| Gemini | `gemini-flash` avec ancrage Google Search | 14 $ pour 1 000 appels **au-delà de 5 000 gratuits par mois** ([nesyona](https://nesyona.com/articles/ai-web-search-tool-prices-per-1000-calls-2026), [forum Google](https://discuss.ai.google.dev/t/gemini-api-grounding-billing-for-requests-exceeding-daily-free-tier/102927)) | ≈ 0,016 $ (0 $ dans le quota gratuit) |
| Extraction | `gpt-4o-mini` ou `gemini-flash-lite`, réponse en JSON | environ 1 200 jetons en entrée et 250 en sortie | ≈ 0,0003 $ |

**Audit gratuit, pire cas** : 16 × 0,014 + 16 × 0,007 + 16 × 0,016 + 48 × 0,0003 ≈ **0,61 $, soit environ 0,56 €** (avec 1 $ = 0,92 €, hypothèse prudente). C'est sous le plafond de 0,60 €.
**Cas réel** : avec le quota Gemini gratuit (environ 312 audits par mois) et le cache par couple métier × zone, on arrive à **environ 0,30 €**.

### 3.3 Garde-fous de coût (à implémenter dans `audit.ts`)
- `AUDIT_BUDGET_EUR = 0.60` : un compteur estime le coût avant chaque appel. Si le budget serait dépassé, on saute la seconde exécution des requêtes T8 puis T4, et la confiance baisse en conséquence.
- **Cache de 24 h** clé `(provider, model, query.text normalisé, run)` dans Supabase : deux plombiers du 11e audités le même jour partagent leurs 48 réponses. C'est honnête, puisque la requête ne contient pas le nom du commerce et que la date de mesure affichée est celle de la réponse en cache.
- Le **3ᵉ provider tombe en `mock`** si sa clé manque. La réponse est étiquetée `demo: true`, elle est exclue du score réel et elle force la confiance à « faible ».

---

## 4. Détection d'une mention (`detect.ts`)

### 4.1 Normalisation `norm(s)`
1. `s.normalize('NFD')`, suppression des diacritiques `\p{M}`, puis passage en minuscules.
2. `&` → ` et `, `'` `’` → espace, `-` `_` `.` `/` → espace, autre ponctuation supprimée, espaces compactés.
3. Suppression des **formes juridiques** : `sarl, sas, sasu, eurl, sa, snc, sci, ei, eirl, micro entreprise, auto entrepreneur, scop, selarl, selas`.
4. Suppression des **mots de liaison et préfixes** en début de chaîne : `le, la, les, l, chez, ets, etablissements, maison, societe, ste, cabinet, groupe`. On les conserve dans une variante, car « La Table d'Eugène » sans « la » reste reconnaissable.
5. Gestion des nombres : `2` ↔ `deux` uniquement pour les noms courts.

### 4.2 Variantes générées depuis `businessName`
- `full` : le nom normalisé complet.
- `core` : `full` privé des mots génériques du métier (`plomberie, plombier, restaurant, boulangerie, salon, coiffure, institut, agence, immobilier…`, tirés de `TRADES` et d'une liste commune). Exemple : « Plomberie Dupont SARL » → `dupont`.
- `acronym` : les initiales si le nom compte au moins 3 mots significatifs (« Société Dupont Plomberie Services » → `sdps`). Ne compte que si l'acronyme apparaît **en majuscules** dans le texte original.
- Variantes manuelles saisies dans le suivi payant (« aussi connu sous… »).

### 4.3 Algorithme de correspondance
On découpe la réponse en **segments** (éléments de liste, sinon phrases). Pour chaque segment normalisé :
1. **Correspondance exacte** de `full` ou `core` entre bornes de mot → score 1,0.
2. **Correspondance floue** : fenêtre glissante de *k* tokens (*k* = nombre de tokens de la variante ± 1), similarité **Jaro-Winkler** (on peut aussi prendre 1 − Levenshtein normalisé).
   - Seuil **≥ 0,90** si la variante fait au moins 8 caractères, **≥ 0,94** si elle en fait de 5 à 7.
   - Pour 4 caractères ou moins, exact uniquement.
3. **Acronyme** → score 0,85, valide seulement avec une preuve (voir § 4.4).
4. **Domaine** : `registrableDomain(input.website)`, par exemple `plomberie-dupont.fr`, sans `www.` ni `https`.
   - Domaine présent dans le **texte** → mention, score 1,0.
   - Domaine présent uniquement dans `citations[]` → `cited = true`. Cela **abaisse le seuil flou à 0,80** et confirme une homonymie (§ 4.4), mais **ne compte pas seul comme une mention** : le client n'a pas vu le nom. On le comptabilise à part dans une stat « site cité comme source ».

### 4.4 Homonymes et noms génériques
- **Nom générique** : le score est marqué ambigu si `core` fait 4 caractères ou moins, ou s'il figure dans la liste de mots courants et de chaînes connues (« Le Bistrot », « Paris Plomberie », « Franck Provost »…), ou si `core` est vide. Une mention ambiguë n'est validée que si le **même segment, ou ±200 caractères autour**, contient au moins une preuve : `{quartier}`, `{arr}`, le CP, la rue (si connue via la fiche Google, plus tard) ou le domaine (texte ou citation).
- **Contre-preuve** : si le segment associe le nom à **une autre ville ou un autre arrondissement** (« Dupont Plomberie (Lyon 3e) », ou « Paris 15e » alors que l'arrondissement saisi est le 11e) → rejet, et le nom est ajouté aux concurrents avec la mention « homonyme ».
- **Chaînes et franchises** : si `businessName` correspond à une enseigne, on exige l'adresse ou le quartier. Sinon, le rapport affiche « enseigne citée, établissement non identifié ».

### 4.5 Rang
1. Si la réponse contient une liste (`^\s*(\d+[.)]|[-*•])` ou des titres `**…**`/`###`), le rang est l'**index 1-based de l'élément** qui contient la mention.
2. Sinon, le rang est l'**ordre de première apparition** parmi toutes les entités extraites (commerce cible et concurrents), par position de caractère.
3. Si la réponse est jugée « sans recommandation » (aucune entité extraite, refus, conseil générique du type « regardez Google Maps »), elle est marquée `noRec` et **exclue du dénominateur**, comme chez Profound. On le signale dans `MentionResult.snippet = "[aucune recommandation]"`.

### 4.6 Concurrents : extraction par LLM (voie principale)
Modèle bon marché, `temperature: 0`, sortie JSON stricte (`response_format: json_schema` côté OpenAI, `responseSchema` côté Gemini). Un appel par réponse.

```text
SYSTEM
Tu es un extracteur d'entités. Tu lis une réponse d'assistant IA à une question
de recherche de commerce local et tu renvoies UNIQUEMENT du JSON valide.

USER
Question posée : «{query}»
Commerce audité : «{businessName}» (site : {website|aucun}, zone : {zone})
Réponse à analyser :
"""
{answer_text}
"""
Sources citées : {citations_json}

Liste, dans l'ordre d'apparition, chaque commerce, artisan ou établissement
précis recommandé ou cité (pas les plateformes : Google Maps, PagesJaunes,
Yelp, TheFork, Doctolib, Habitatpresto, StarOfService… vont dans "platforms").
Ne crée aucun nom qui n'est pas écrit dans la réponse.

Format :
{
  "recommends_businesses": true|false,
  "businesses": [
    {"name": "nom exact tel qu'écrit", "rank": 1,
     "is_target": true|false,
     "location_hint": "quartier/arrondissement/ville mentionné à côté ou null",
     "url": "url ou domaine associé ou null"}
  ],
  "platforms": ["..."]
}
"is_target" = true seulement si c'est très probablement le commerce audité
(même nom à l'orthographe près, même zone).
```

Garde-fous :
- On valide avec zod. Chaque `name` doit être retrouvé dans `answer_text` (normalisé, similarité ≥ 0,85), sinon il est rejeté comme hallucination.
- `is_target` produit par le LLM **ne remplace pas** `detectMention`. C'est un second avis : en cas de désaccord, la détection déterministe l'emporte et le cas est journalisé (`disagreement`) pour ajuster les seuils.

### 4.7 Repli heuristique (pas de clé, erreur ou JSON invalide)
1. On découpe en éléments de liste (regex du § 4.5). Pour chaque élément, le candidat est le premier texte **en gras**, sinon le texte avant le premier séparateur parmi ` – `, ` - `, `:`, `(`, `,`, limité à 6 tokens.
2. Sans liste : on cherche des suites de mots à majuscule initiale (2 à 5 tokens, en tolérant `de`, `du`, `des`, `d'`, `&`, `et`), hors début de phrase sauf si la suite est suivie d'un séparateur.
3. On filtre avec la liste noire des plateformes, des noms de lieux (`{ville}`, `{quartier}`, noms d'arrondissement, rues, « Paris »), des mots du métier seuls et des termes génériques (« Artisan », « Conseil », « Astuce »…).
4. On déduplique au niveau de l'audit : on regroupe les candidats dont les `norm()` ont une similarité Jaro-Winkler ≥ 0,92, et le libellé affiché est la forme la plus fréquente.

### 4.8 Agrégation des concurrents
`CompetitorStat.mentions` = nombre de réponses (avec `noRec` exclu) où le concurrent apparaît, compté au plus une fois par réponse. `share = mentions / totalMentionsToutesMarques`, cible comprise. On garde les 10 premiers.

---

## 5. Formule du score

Notations : *A* = l'ensemble des réponses valides (`!error && !demo && !noRec`), et *P* = les IA utilisées.

| Composante | Définition | Poids |
|---|---|---|
| **M** taux de mention | `|{a ∈ A : mentioned}| / |A|`, en pool sur toutes les IA (règle Otterly) | **0,45** |
| **R** qualité du rang | moyenne sur les réponses mentionnées de `q(r) = max(0, 1 − (r−1)/5)` (rang 1 → 1, rang 2 → 0,8, rang 6 et au-delà → 0). On applique un **rétrécissement** `R = R̄ · k/(k+2)`, où *k* est le nombre de mentions, pour qu'une mention unique au rang 1 ne vaille pas un R de 1. R = 0 si k = 0 | **0,20** |
| **V** part de voix | `SoV = mentionsCible / (mentionsCible + Σ mentionsConcurrents)`, puis `V = min(1, SoV / 0,25)`. Représenter un quart des citations sur un marché local revient à dominer la catégorie | **0,20** |
| **C** couverture des IA | `|{p ∈ P : M_p ≥ 0,125}| / |P|` : part des IA qui citent le commerce dans au moins 2 réponses sur 16 | **0,15** |

**Score = round(100 × (0,45·M + 0,20·R + 0,20·V + 0,15·C))**

Justification des poids : M est la métrique la plus stable selon SparkToro, d'où le poids principal. R est la plus volatile, d'où un poids réduit et un rétrécissement. V situe le commerce face à ses concurrents, ce que comprend immédiatement un commerçant. C récompense le fait d'être présent partout : les clients n'utilisent pas tous la même IA.

**Sous-score par IA** (`subScores[p]`) : même formule restreinte aux réponses de *p*, sans C, avec les poids renormalisés : `100 × (0,45·M_p + 0,20·R_p + 0,20·V_p) / 0,85`. La valeur est `null` si l'IA n'a pas été utilisée ou si elle n'a que des réponses `demo` ou `error`.
Le score global **n'est pas** la moyenne des sous-scores : on le calcule sur le pool.

**Lecture du score**, affichée dans le rapport :

| Score | Lecture |
|---|---|
| 0–19 | Invisible : les IA ne vous recommandent quasiment jamais |
| 20–39 | Rare : vous apparaissez parfois, souvent en bas de liste |
| 40–59 | Présent : cité régulièrement sur certaines IA |
| 60–79 | Bien placé : souvent cité, souvent dans le haut de la liste |
| 80–100 | Référence : recommandé partout et en premier |

---

## 6. Incertitude et indice de confiance

### 6.1 Fourchette (bootstrap par requête)
Les réponses à une même requête sont corrélées. On ré-échantillonne donc **les requêtes**, avec remise (*B* = 500 tirages, graine déterministe dérivée de `audit.id` pour qu'un même audit donne toujours la même fourchette). À chaque tirage, on reprend toutes les réponses (toutes IA et toutes exécutions) des requêtes tirées et on recalcule le score. **Fourchette = percentiles 5 et 95.** Cette méthode suit la recommandation d'Atil et al. de publier un intervalle plutôt qu'une moyenne ± écart-type, puisque les distributions ne sont pas normales.

### 6.2 Stabilité entre exécutions
`agreement` = sur chaque couple (requête, IA) qui a au moins 2 exécutions, part des couples où `mentioned` est identique dans toutes les exécutions.

### 6.3 Indice de confiance
```
n       = |A|                         (réponses valides)
hw      = (p95 − p5) / 2              (demi-largeur de la fourchette, en points)
demoOrErr = part des réponses demo/error/noRec parmi toutes les réponses

bonne   si n ≥ 40 et hw ≤ 8  et agreement ≥ 0,75 et demoOrErr ≤ 0,10
moyenne si n ≥ 20 et hw ≤ 15 et agreement ≥ 0,50
faible  sinon (et toujours si une réponse demo entre dans le score, ou si |P| < 2)
```
Ordre de grandeur : un audit gratuit complet (n = 48) obtient en général « moyenne ». Il obtient « bonne » lorsque le résultat est net (score très bas ou très haut, ce qui donne des intervalles serrés). Le suivi mensuel (n = 144) atteint « bonne » dans la plupart des cas.

### 6.4 Extension proposée au contrat (additive, sans modifier `AuditResult`)
`scoring.ts` exporte un type `ScoreDetails`, stocké dans une colonne JSON à côté de `AuditResult` :
```ts
export interface ScoreDetails {
  method: 'auditia-score-v1.0';
  scoreLow: number; scoreHigh: number;          // fourchette 90 %
  mentionRateLow: number; mentionRateHigh: number; // Wilson 90 %
  components: { M: number; R: number; V: number; C: number };
  validAnswers: number; agreement: number; excludedNoRec: number;
  citedDomainCount: number;                     // site cité comme source
  models: Partial<Record<ProviderId, string>>;  // ex. { chatgpt: 'gpt-5-mini' }
}
```
→ **À valider par l'agent ENGINE.** S'il refuse, `scoreLow` et `scoreHigh` peuvent être recalculés à l'affichage à partir de `mentions`.

---

## 7. Présenter l'incertitude honnêtement

**Bloc score du rapport (web et PDF), exemple :**
> **42 / 100**: fourchette probable **35 – 49**
> Confiance : **moyenne** · Mesuré le **9 novembre 2026 à 14 h 32** · 48 réponses analysées sur ChatGPT (gpt-5-mini), Perplexity (Sonar) et Gemini (Flash)
> Les IA ne répondent jamais deux fois exactement la même chose : nous posons donc chaque question plusieurs fois et donnons une fourchette. [Comment on calcule ce score →](/methode)

Règles :
1. **Jamais de score sans fourchette**, date et heure, ni lien vers la méthode. Le numéro de version de la méthode apparaît en pied de PDF.
2. **Montrer les preuves** : pour chaque requête et chaque IA, l'extrait (`snippet`) où le commerce ou ses concurrents apparaissent, avec « cité / non cité » et le rang. Le client peut reposer la question lui-même.
3. **Formulations prudentes** : « dans nos 48 mesures », « en moyenne », « souvent / rarement ». Jamais « ChatGPT ne vous recommande pas » au sens absolu. Pour les sous-scores par IA, indiquer « indicatif (16 réponses) ».
4. **Évolution mensuelle** : on n'annonce une hausse ou une baisse que si `|Δscore| > max(hw_mois1, hw_mois2)`, sinon on affiche « stable (variation dans la marge de mesure) ». Les alertes e-mail suivent la même règle, ce qui évite les fausses alertes, véritable source de résiliation.
5. **Limites dites clairement** sur la page publique : les réponses par API peuvent différer de l'application grand public (historique, mémoire, localisation précise de l'utilisateur) ; la mesure est un échantillon à un instant donné ; Google AI Overviews n'est pas encore mesuré.
6. **Page publique `/methode`** : requêtes types, nombre d'exécutions, formule et poids, règles de détection, liste des modèles et versions, changelog. Elle sert d'argument commercial et de protection contre un client qui contesterait son score.
7. Les réponses `demo` (mock) portent un **badge « Démo — données simulées »** et ne sont jamais présentées comme des mesures.

---

## 8. Pseudo-code TypeScript

```ts
// src/lib/engine/detect.ts
import type { AuditInput, ProviderAnswer, MentionResult } from './types';

const LEGAL = /\b(sarl|sasu|sas|eurl|sa|snc|sci|eirl|ei|scop|selarl|selas|micro entreprise|auto entrepreneur)\b/g;
const PREFIX = /^(le|la|les|l|chez|ets|etablissements|maison|societe|ste|cabinet|groupe)\s+/;

export function norm(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/&/g, ' et ').replace(/['’`]/g, ' ').replace(/[-_./]/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, '').replace(LEGAL, ' ')
    .replace(/\s+/g, ' ').trim();
}

export interface NameVariants { full: string; core: string; acronym?: string; ambiguous: boolean; domain?: string; }

export function buildVariants(input: AuditInput, tradeWords: string[], commonNames: Set<string>): NameVariants {
  const full = norm(input.businessName).replace(PREFIX, '');
  const core = full.split(' ').filter(t => !tradeWords.includes(t)).join(' ').trim() || full;
  const words = input.businessName.split(/\s+/).filter(w => w.length > 2 && !LEGAL.test(norm(w)));
  const acronym = words.length >= 3 ? words.map(w => w[0]).join('').toUpperCase() : undefined;
  const ambiguous = core.length <= 4 || commonNames.has(core) || core === full && tradeWords.some(w => full.includes(w));
  return { full, core, acronym, ambiguous, domain: input.website ? registrableDomain(input.website) : undefined };
}

interface Segment { text: string; norm: string; start: number; listIndex: number | null; }

export function detectMention(
  answer: ProviderAnswer,
  input: AuditInput,
  v: NameVariants,
  extracted: { name: string; rank: number; locationHint: string | null }[], // sortie § 4.6 / 4.7
  geo: { proofs: string[]; otherPlaces: string[] },  // proofs: quartier, "paris 11e", "75011"… (normalisés)
): MentionResult {
  const base = { provider: answer.provider, queryId: answer.queryId, run: answer.run };
  if (answer.error) return   // les réponses demo sont détectées normalement, puis exclues dans computeScore { ...base, mentioned: false, rank: null, competitors: [] };

  const segments = splitSegments(answer.text);             // liste numérotée/puces/titres, sinon phrases
  const citedDomain = !!v.domain && answer.citations.some(u => registrableDomain(u) === v.domain);
  const domainInText = !!v.domain && norm(answer.text).includes(norm(v.domain));

  let best: { seg: Segment; score: number } | null = null;
  for (const seg of segments) {
    const s = Math.max(
      matchScore(seg.norm, v.full),
      matchScore(seg.norm, v.core),
      v.acronym && new RegExp(`\\b${v.acronym}\\b`).test(seg.text) ? 0.85 : 0,
      domainInText && norm(seg.text).includes(norm(v.domain!)) ? 1 : 0,
    );
    if (!best || s > best.score) best = { seg, score: s };
  }

  const threshold = citedDomain ? 0.80 : thresholdFor(v.core);   // 0.90 (≥8 car.) | 0.94 (5–7) | 1.0 (≤4)
  let mentioned = !!best && best.score >= threshold;

  if (mentioned && best) {
    const ctx = norm(contextAround(answer.text, best.seg, 200));
    const hasProof = geo.proofs.some(p => ctx.includes(p)) || citedDomain || domainInText;
    const contradicts = geo.otherPlaces.some(p => ctx.includes(p)) && !geo.proofs.some(p => ctx.includes(p));
    if (contradicts) mentioned = false;                      // homonyme ailleurs
    else if (v.ambiguous && !hasProof) mentioned = false;    // nom générique : preuve géo/domaine exigée
    else if (best.score === 0.85 && !hasProof) mentioned = false; // acronyme seul : preuve exigée
  }

  // Concurrents = entités extraites ≠ cible (dédupliquées plus tard au niveau audit)
  const competitors = extracted
    .filter(e => !(mentioned && similarity(norm(e.name), v.core) >= 0.9))
    .map(e => e.name);

  let rank: number | null = null;
  if (mentioned && best) {
    rank = best.seg.listIndex ?? orderOfAppearance(answer.text, best.seg.start, extracted);
  }
  const noRec = extracted.length === 0 && !mentioned;
  return {
    ...base, mentioned, rank, competitors,
    snippet: noRec ? '[aucune recommandation]' : mentioned && best ? best.seg.text.slice(0, 280) : undefined,
  };
}

function matchScore(segNorm: string, variant: string): number {
  if (!variant) return 0;
  if (new RegExp(`(^|\\s)${escapeRe(variant)}(\\s|$)`).test(segNorm)) return 1;
  const k = variant.split(' ').length, toks = segNorm.split(' ');
  let best = 0;
  for (let w = Math.max(1, k - 1); w <= k + 1; w++)
    for (let i = 0; i + w <= toks.length; i++)
      best = Math.max(best, jaroWinkler(toks.slice(i, i + w).join(' '), variant));
  return best;
}
const thresholdFor = (core: string) => core.length >= 8 ? 0.90 : core.length >= 5 ? 0.94 : 1.0;
```

```ts
// src/lib/engine/scoring.ts
import type { ProviderId, ProviderAnswer, MentionResult, CompetitorStat, AuditResult } from './types';

export const W = { M: 0.45, R: 0.20, V: 0.20, C: 0.15 } as const;
const SOV_TARGET = 0.25, COVER_MIN = 0.125, B = 500;

type Scored = Pick<AuditResult, 'score' | 'subScores' | 'mentionRate' | 'avgRank' | 'shareOfVoice' | 'competitors' | 'confidence'>
  & { details: ScoreDetails };

export function computeScore(
  answers: ProviderAnswer[], mentions: MentionResult[], providers: ProviderId[], auditId: string,
): Scored {
  const valid = validMentions(answers, mentions);            // exclut error, demo, snippet '[aucune recommandation]'
  const used = providers.filter(p => valid.some(m => m.provider === p));

  const core = components(valid, used);
  const score = Math.round(100 * (W.M * core.M + W.R * core.R + W.V * core.V + W.C * core.C));

  const subScores = Object.fromEntries((['chatgpt', 'perplexity', 'gemini', 'claude'] as ProviderId[]).map(p => {
    const mp = valid.filter(m => m.provider === p);
    if (!providers.includes(p) || mp.length === 0) return [p, null];
    const c = components(mp, [p]);
    return [p, Math.round(100 * (W.M * c.M + W.R * c.R + W.V * c.V) / (W.M + W.R + W.V))];
  })) as Record<ProviderId, number | null>;

  // Bootstrap par requête
  const qIds = [...new Set(valid.map(m => m.queryId))];
  const rnd = seededRandom(auditId);
  const samples: number[] = [];
  for (let b = 0; b < B; b++) {
    const pick = qIds.map(() => qIds[Math.floor(rnd() * qIds.length)]);
    const res = pick.flatMap(q => valid.filter(m => m.queryId === q));
    const c = components(res, used);
    samples.push(100 * (W.M * c.M + W.R * c.R + W.V * c.V + W.C * c.C));
  }
  samples.sort((a, b) => a - b);
  const lo = Math.round(samples[Math.floor(0.05 * B)] ?? score), hi = Math.round(samples[Math.floor(0.95 * B)] ?? score);

  const agreement = runAgreement(valid);
  const n = valid.length, hw = (hi - lo) / 2;
  const badShare = 1 - n / Math.max(1, answers.length);
  const hasDemo = answers.some(a => a.demo);
  const confidence: AuditResult['confidence'] =
    hasDemo || used.length < 2 ? 'faible'
    : n >= 40 && hw <= 8 && agreement >= 0.75 && badShare <= 0.10 ? 'bonne'
    : n >= 20 && hw <= 15 && agreement >= 0.50 ? 'moyenne' : 'faible';

  const [wLo, wHi] = wilson(core.k, n, 1.645);
  return {
    score, subScores, mentionRate: core.M, avgRank: core.avgRank, shareOfVoice: core.sov,
    competitors: core.competitors, confidence,
    details: { method: 'auditia-score-v1.0', scoreLow: Math.min(lo, score), scoreHigh: Math.max(hi, score),
      mentionRateLow: wLo, mentionRateHigh: wHi, components: { M: core.M, R: core.R, V: core.V, C: core.C },
      validAnswers: n, agreement, excludedNoRec: mentions.filter(m => m.snippet === '[aucune recommandation]').length,
      citedDomainCount: 0 /* rempli par audit.ts */, models: {} },
  };
}

function components(ms: MentionResult[], used: ProviderId[]) {
  const n = ms.length, hits = ms.filter(m => m.mentioned);
  const k = hits.length;
  const M = n ? k / n : 0;
  const ranks = hits.map(m => m.rank).filter((r): r is number => r != null);
  const avgRank = ranks.length ? ranks.reduce((a, b) => a + b, 0) / ranks.length : null;
  const q = ranks.length ? ranks.map(r => Math.max(0, 1 - (r - 1) / 5)).reduce((a, b) => a + b, 0) / ranks.length : 0;
  const R = q * (k / (k + 2));

  const counts = new Map<string, { name: string; n: number }>();
  for (const m of ms) for (const key of new Set(m.competitors.map(clusterKey)))   // 1 fois par réponse
    counts.set(key, { name: displayName(key), n: (counts.get(key)?.n ?? 0) + 1 });
  const compTotal = [...counts.values()].reduce((a, c) => a + c.n, 0);
  const total = k + compTotal;
  const sov = total ? k / total : 0;
  const V = Math.min(1, sov / SOV_TARGET);

  const C = used.length
    ? used.filter(p => { const mp = ms.filter(m => m.provider === p); return mp.length && mp.filter(m => m.mentioned).length / mp.length >= COVER_MIN; }).length / used.length
    : 0;

  const competitors: CompetitorStat[] = [...counts.values()]
    .sort((a, b) => b.n - a.n).slice(0, 10)
    .map(c => ({ name: c.name, mentions: c.n, share: total ? c.n / total : 0 }));
  return { M, R, V, C, k, avgRank, sov, competitors };
}

function runAgreement(ms: MentionResult[]): number {
  const groups = groupBy(ms, m => `${m.provider}|${m.queryId}`);
  const multi = [...groups.values()].filter(g => g.length >= 2);
  if (!multi.length) return 0;
  return multi.filter(g => g.every(m => m.mentioned === g[0].mentioned)).length / multi.length;
}

function wilson(k: number, n: number, z: number): [number, number] {
  if (!n) return [0, 1];
  const p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), r = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return [Math.max(0, (c - r) / d), Math.min(1, (c + r) / d)];
}
```
Fonctions utilitaires à écrire : `splitSegments`, `contextAround`, `orderOfAppearance`, `jaroWinkler` (environ 30 lignes, sans dépendance), `registrableDomain` (suppression de `www.` et du schéma, puis les 2 derniers labels, 3 pour `.co.uk` / `.gouv.fr`), `clusterKey` (norm + regroupement Jaro-Winkler ≥ 0,92 au niveau audit), `seededRandom` (mulberry32 sur un hash de l'identifiant), `groupBy`.

---

## 9. Tests de recette (à fournir dans `engine/__tests__`)
- « Plomberie Dupont SARL » est reconnu dans « **Dupont Plomberie** (Paris 11e) » et dans « plomberie dupont », mais pas dans « Dupond Électricité ».
- « Le Bistrot » n'est reconnu dans « Le Bistrot, rue de Lappe » qu'avec la preuve « Bastille » ou « 11e ». Il est rejeté dans « Le Bistrot (Lyon) ».
- « Chez Gégé » est reconnu dans « chez gege » grâce aux accents normalisés.
- Domaine `dupont-plomberie.fr` présent seulement dans les citations : `mentioned=false`, `citedDomainCount += 1`. Si le texte contient en plus « Dupont Plombrie » (faute de frappe, similarité 0,82) : `mentioned=true`.
- Réponse « Je vous conseille de consulter Google Maps » : `noRec`, exclue du dénominateur.
- Un même audit relancé avec les mêmes réponses donne exactement le même score et la même fourchette (graine déterministe).
- Audit avec un provider `mock` : confiance « faible » et badge démo.

---

## Sources
- Otterly : [Brand Report KPI definitions](https://help.otterly.ai/brand-report-kpi-definition?hsLang=en) · [Insights on brand reports](https://help.otterly.ai/insights-on-brand-reports)
- Peec AI : [Metrics overview](https://docs.peec.ai/metrics-overview) · [Visibility](https://docs.peec.ai/metrics/brand-metrics/visibility)
- Profound : [Answer Engine Insights](https://docs.tryprofound.com/answer-engine-insights/about) · [How to track your visibility in AI search](https://tryprofound.com/blog/how-to-track-your-visibility-in-ai-search)
- BrightLocal : [What is Local AI Visibility](https://help.brightlocal.com/hc/en-us/articles/37989673412114-What-is-Local-AI-Visibility) · [New Local AI Visibility tracker](https://www.brightlocal.com/blog/new-local-ai-visibility-tracker/)
- Variance : [SparkToro/Gumshoe via Search Engine Land](https://searchengineland.com/ai-recommendation-lists-rarely-repeat-study-468076) · [Search Engine Journal](https://www.searchenginejournal.com/ai-recommendations-change-with-nearly-every-query-sparktoro/566242) · [MediaPost](https://www.mediapost.com/publications/article/412364/ai-brand-recommendations-chaotic-inconsistent.html) · [Atil et al., arXiv 2408.04667](https://arxiv.org/html/2408.04667v5) · [Song et al., arXiv 2407.10457](https://arxiv.org/pdf/2407.10457) · [Ouyang et al., arXiv 2308.02828](https://arxiv.org/html/2308.02828v2)
- Prix : [Prix des outils de recherche web par 1 000 appels, oct. 2026](https://nesyona.com/articles/ai-web-search-tool-prices-per-1000-calls-2026) · [Perplexity Sonar cost per search](https://www.activepieces.com/blog/perplexity-sonar-api-cost-per-search-2026-guide.md) · [Perplexity API pricing](https://developer.puter.com/tutorials/perplexity-api-pricing/) · [Gemini grounding billing](https://discuss.ai.google.dev/t/gemini-api-grounding-billing-for-requests-exceeding-daily-free-tier/102927)
