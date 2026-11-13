# 04 — API IA : OpenAI, Perplexity, Gemini, Claude

*Vérifié le 9 novembre 2026 dans la documentation officielle (liens en fin de section). Le code prêt à copier est dans `docs/04-providers-snippets.ts` (type-check en `--strict` : OK).*

> **Légende** : ✅ = vérifié dans la doc officielle · ⚠️ NON VÉRIFIÉ = non confirmé dans la doc officielle (source tierce, déduction ou page inaccessible). Tous les prix sont en **USD** et hors taxes.

## Synthèse

| Moteur | Modèle retenu | Prix tokens (entrée / sortie, par million) | Prix de la recherche | Localisation | Citations |
|---|---|---|---|---|---|
| ChatGPT (OpenAI) | `gpt-5.6-luna` ✅ (alternative `gpt-6-luna` ⚠️) | 0,20 $ / 1,20 $ ✅ | 10 $ / 1 000 appels + tokens de contenu de recherche ✅ | `user_location` {city, country, region, timezone} ✅ | `url_citation` ✅ |
| Perplexity | `perplexity/sonar` via **Agent API** ✅ | 0,25 $ / 2,50 $ ✅ | `web_search` : 0,0025 $ par appel (0,001 $ en mode fast) ✅ | `user_location` {country, city, region, lat, lon} ✅ | `search_results` + annotations ✅ (format exact ⚠️) |
| Gemini | `gemini-3.5-flash-lite` ✅ | 0,30 $ / 2,50 $ ✅ | 5 000 requêtes gratuites par mois, puis 14 $ / 1 000 **requêtes de recherche** ✅ | aucune option documentée ⚠️ → ville dans le prompt | `url_citation` ✅ (Interactions API) |
| Claude | `claude-haiku-5-5` ✅ (id ⚠️) | 0,10 $ / 0,50 $ (prompts de 100 000 tokens ou moins) ✅ | 10 $ / 1 000 recherches ✅ | `user_location` {city, region, country, timezone} ✅ | `web_search_result_location` ✅ |

**Coût par audit** (10 requêtes × 2 exécutions × 3 IA = 60 appels) : **≈ 0,65 à 1,50 $**, et **≈ 0,35 à 0,65 $** tant que le quota gratuit Gemini n'est pas épuisé (détail au §6).

**Point bloquant** : les conditions Gemini interdisent d'« analyser » et de « revendre » les résultats ancrés sur Google Search (§5).

---

## 1. OpenAI : Responses API + outil `web_search`

### Points clés
- Endpoint : `POST https://api.openai.com/v1/responses` ✅
- Outil : `{"type": "web_search"}`. `web_search_preview` reste disponible pour les anciennes intégrations, mais ne prend pas en charge les nouveaux contrôles (`filters`…) ✅.
- `user_location` : `{type: "approximate", country: "FR" (ISO 2 lettres), city, region (texte libre), timezone (IANA)}` ✅
- `search_context_size` : `low` | `medium` (défaut) | `high`. Il règle la quantité de contexte injectée, donc les tokens facturés ✅.
- `include: ["web_search_call.action.sources"]` renvoie **toutes** les URL consultées, souvent plus nombreuses que les citations ✅.
- Modèles :
  - `gpt-6-astra` est le modèle « recommandé » par la doc web search, mais coûte 10 $ / 50 $ par million de tokens : trop cher pour nous ✅.
  - `gpt-5.6-luna` (0,20 $ / 1,20 $) liste `web_search` parmi ses outils ✅. **C'est notre choix par défaut.**
  - `gpt-6-luna` (0,10 $ / 0,50 $) figure sur la page de prix ✅, mais sa fiche modèle n'a pas pu être lue, donc le support de `web_search` n'est pas confirmé ⚠️. Passez-y via `OPENAI_MODEL=gpt-6-luna` après un test.
  - Dépréciés : `gpt-4o-search-preview` et `gpt-4o-mini-search-preview` (arrêtés le 23/07/2026), `o4-mini` (arrêté le 23/10/2026) ✅.
  - La doc signale qu'un effort de raisonnement `none` « peut dégrader la qualité » avec la recherche : on utilise `low`.
- Prix de l'outil : **10 $ / 1 000 appels, et les tokens de contenu de recherche sont facturés au tarif du modèle** ✅. La variante `web_search_preview` sur un modèle sans raisonnement coûte 25 $ / 1 000 appels, avec les tokens de contenu gratuits ✅.

### Requête exacte
```ts
const res = await fetch('https://api.openai.com/v1/responses', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
  body: JSON.stringify({
    model: 'gpt-5.6-luna',
    input: 'Quel est le meilleur plombier à Paris 11e ?',
    tools: [{
      type: 'web_search',
      search_context_size: 'low',
      user_location: { type: 'approximate', country: 'FR', city: 'Paris', timezone: 'Europe/Paris' },
    }],
    reasoning: { effort: 'low' },
    store: false,
  }),
  signal: AbortSignal.timeout(60_000),
});
```

### Format de réponse (extrait)
```json
{
  "status": "completed",
  "output": [
    { "type": "web_search_call", "id": "ws_…", "status": "completed", "action": { "type": "search", "query": "…" } },
    { "type": "message", "role": "assistant", "content": [
      { "type": "output_text", "text": "…",
        "annotations": [ { "type": "url_citation", "start_index": 120, "end_index": 180, "url": "https://…", "title": "…" } ] }
    ]}
  ]
}
```
**Extraction** : parcourir `output[]` → items `type === "message"` → `content[]` de type `output_text` : prendre `text` et `annotations[].url` (filtre `type === "url_citation"`).

Sources : [Guide web search](https://developers.openai.com/api/docs/guides/tools-web-search) · [Pricing](https://developers.openai.com/api/docs/pricing) · [GPT-5.6 Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna) · [GPT-6 Astra](https://developers.openai.com/docs/models/gpt-6-astra)

---

## 2. Perplexity : Sonar, désormais via l'Agent API

### Changement important
- **« Sonar Chat Completions support ended on September 27, 2026 »** ✅. Les requêtes synchrones vers `/v1/sonar` « continuent de fonctionner », mais elles sont reformulées en requêtes Agent API ; les requêtes asynchrones ne sont plus prises en charge. Il faut donc coder directement sur **`POST https://api.perplexity.ai/v1/agent`** ✅.
- Le modèle `perplexity/sonar` est listé dans l'Agent API à **0,25 $ / 2,50 $** par million de tokens (cache 0,0625 $) ✅. `sonar-pro`, `sonar-reasoning-pro` et `sonar-deep-research` n'apparaissent plus que dans le tableau de migration (correspondance avec `effort`) ✅.
- Outil `web_search` : **0,0025 $ par appel**, ou 0,001 $ en Fast Search (`search_type: "fast"`) ✅. Il n'y a plus de « request fee » par taille de contexte : ce modèle tarifaire de l'ancienne API Sonar n'apparaît plus dans la doc actuelle ✅.
- On peut aussi envoyer `effort: "fast"` (l'équivalent de `sonar`) sans `model` ✅. Quand on fixe `model`, l'interaction exacte avec `effort` n'est pas documentée ⚠️.
- **Localisation** : `user_location` se place dans l'outil `web_search`, à côté de `filters` : `{country (ISO 2), region, city, latitude, longitude}`. Latitude et longitude exigent `country` ✅. La documentation montre l'exemple avec `model: "openai/gpt-5.6-sol"` ; qu'il s'applique aussi à `perplexity/sonar` n'est pas testé ⚠️. Des retours de la communauté signalent un filtre de localisation peu efficace ⚠️.
- La réponse contient `usage.cost.total_cost`, ce qui permet de **logger le coût réel** de chaque appel ✅.
- Remarque : l'Agent API sert aussi des modèles OpenAI, Anthropic et Google, mais avec la recherche de Perplexity. Cela ne représente **pas** ChatGPT ni Gemini, donc on ne l'utilise pas pour simuler ces moteurs.

### Requête exacte
```ts
const res = await fetch('https://api.perplexity.ai/v1/agent', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}` },
  body: JSON.stringify({
    model: 'perplexity/sonar',
    input: 'Quel est le meilleur plombier à Paris 11e ?',
    tools: [{ type: 'web_search', user_location: { country: 'FR', city: 'Paris' } }],
  }),
  signal: AbortSignal.timeout(60_000),
});
```

### Format de réponse (extrait)
```json
{
  "id": "…", "model": "…", "object": "response", "status": "completed",
  "output": [
    { "type": "search_results", "queries": ["…"], "results": [ { "id": 1, "title": "…", "url": "https://…", "snippet": "…", "date": "…", "source": "web" } ] },
    { "type": "message", "role": "assistant", "content": [ { "type": "output_text", "text": "… [1]", "annotations": [ { "type": "citation", "url": "https://…" } ] } ] }
  ],
  "usage": { "input_tokens": 0, "output_tokens": 0, "cost": { "currency": "USD", "total_cost": 0.0, "tool_calls_cost": 0.0 } }
}
```
**Extraction** : texte = `message.content[].text` (type `output_text`) ; citations = `annotations[].url`, avec repli sur `search_results.results[].url`, car les annotations sont parfois vides dans les exemples de la doc. Dans le texte, les marqueurs de citation sont `[1]` (effort fast) ou `[web:1]` (low, medium, high) ✅.

Sources : [Sonar overview (dépréciation)](https://docs.perplexity.ai/docs/sonar/overview) · [Quickstart](https://docs.perplexity.ai/docs/getting-started/quickstart) · [Agent API models & prix](https://docs.perplexity.ai/docs/agent-api/models.md) · [Pricing (outils)](https://docs.perplexity.ai/docs/getting-started/pricing.md) · [User location filter](https://docs.perplexity.ai/docs/grounded-llm/filters/user-location-filter) · [Migration Sonar → Agent](https://docs.perplexity.ai/docs/agent-api/migrate-from-sonar/how-to.md)

---

## 3. Google Gemini : ancrage Google Search

### Points clés
- La doc actuelle documente l'**Interactions API** : `POST https://generativelanguage.googleapis.com/v1beta/interactions`, avec les en-têtes `x-goog-api-key` et `Api-Revision: 2026-05-20` ✅. Outil : `{"type": "google_search"}` ✅.
- L'ancien `generateContent` + `groundingMetadata` (`webSearchQueries`, `groundingChunks[].web.uri/title`, `groundingSupports[].segment`, `searchEntryPoint.renderedContent`) n'est plus montré dans cette page : nos snippets le gardent seulement comme **repli de parsing** ⚠️.
- Modèles : Google recommande **`gemini-3.5-flash-lite`** ou `gemini-3.8-flash` pour les nouveaux projets ✅.
  - `gemini-3.5-flash-lite` : 0,30 $ / 2,50 $ ✅. **C'est notre choix.**
  - `gemini-3.1-flash-lite` coûte 0,25 $ / 1,50 $, mais son arrêt est prévu le 07/05/2027 ✅ : à éviter.
  - Les modèles 2.5 sont réservés aux utilisateurs qui les utilisaient déjà, et `gemini-2.0-flash` a été arrêté le 01/06/2026 ✅.
  - Prix de `gemini-3.8-flash` : 0,75 $ / 3,75 $ selon la grille Perplexity ; non lu sur la page Google ⚠️.
- **Prix de l'ancrage (Gemini 3 et suivants)** : facturation **pour chaque requête de recherche que le modèle décide d'exécuter**, et non par prompt. Les 5 000 premières requêtes par mois sont gratuites, partagées entre les modèles 3.x, puis c'est **14 $ / 1 000** ✅. Le tier payant est plafonné par défaut à 1 500 requêtes par jour et par projet ✅. L'ancrage n'est **pas disponible sur le tier gratuit** pour les modèles 3.x ✅. Une clé avec facturation activée est donc nécessaire.
- **Localisation** : aucun paramètre documenté dans l'Interactions API ⚠️. On ajoute la ville dans le prompt, et les requêtes AuditIA la contiennent déjà. L'ancien `toolConfig.retrievalConfig.latLng` n'a pas pu être vérifié ⚠️.
- La réponse contient `search_suggestions` (HTML) : les conditions d'utilisation **exigent son affichage** à l'utilisateur (§5).

### Requête exacte
```ts
const res = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-goog-api-key': process.env.GEMINI_API_KEY!,
    'Api-Revision': '2026-05-20',
  },
  body: JSON.stringify({
    model: 'gemini-3.5-flash-lite',
    input: "Quel est le meilleur plombier à Paris 11e ?\n\n(Contexte : l'utilisateur se trouve à Paris, France.)",
    tools: [{ type: 'google_search' }],
  }),
  signal: AbortSignal.timeout(60_000),
});
```

### Format de réponse (d'après la doc)
```json
{
  "steps": [
    { "type": "thought", "summary": [ { "type": "text", "text": "…" } ], "signature": "…" },
    { "type": "google_search_call", "arguments": { "queries": ["plombier Paris 11"] } },
    { "type": "google_search_result", "call_id": "search_001", "result": [ { "search_suggestions": "<!-- HTML -->" } ] },
    { "type": "model_output", "content": [
      { "type": "text", "text": "…",
        "annotations": [ { "type": "url_citation", "url": "https://…", "title": "exemple.fr", "start_index": 0, "end_index": 56 } ] }
    ]}
  ]
}
```
**Extraction** : `steps[]` → `type === "model_output"` → `content[]` de type `text` : `text` et `annotations[].url`. Le nombre de `google_search_call.arguments.queries` détermine le coût. Les URL peuvent être des redirections `vertexaisearch.cloud.google.com/grounding-api-redirect/…` ⚠️ : pour la détection, s'appuyer sur `title` (le domaine) plutôt que sur l'URL.

Sources : [Grounding with Google Search (Interactions)](https://ai.google.dev/gemini-api/docs/interactions/google-search.md.txt) · [google-search](https://ai.google.dev/gemini-api/docs/google-search) · [Pricing](https://ai.google.dev/pricing) · [Deprecations](https://ai.google.dev/gemini-api/docs/deprecations)

---

## 4. Anthropic Claude : Messages API + outil web search

### Points clés
- Endpoint : `POST https://api.anthropic.com/v1/messages`, avec les en-têtes `x-api-key` et `anthropic-version: 2023-06-01`. Cette version d'en-tête est la valeur standard de l'API, mais la page de l'outil ne la rappelle pas ⚠️.
- Versions de l'outil : `web_search_20250305` (base), `web_search_20260209` (filtrage dynamique ; `allowed_callers` vaut par défaut `["code_execution_20260120"]`) et `web_search_20260318` (ajoute `response_inclusion`) ✅. Nous prenons **`web_search_20250305`** pour un appel direct, plus simple et plus économe en tokens. On peut aussi passer `20260318` avec `allowed_callers: ["direct"]`.
- Paramètres : `max_uses`, `allowed_domains` **ou** `blocked_domains`, `user_location {type: "approximate", city, region, country (ISO 2), timezone}` ✅.
- Prix : **10 $ / 1 000 recherches**, plus les tokens. Les résultats de recherche comptent comme tokens d'entrée ; une recherche échouée n'est pas facturée ✅.
- Modèle bon marché : **Claude Haiku 5.5**, à 0,10 $ / 0,50 $ par million de tokens pour les prompts de 100 000 tokens ou moins, et 0,50 $ / 2,50 $ au-delà ✅. Autres prix : Sonnet 5.5 à 2 $ / 10 $, Haiku 4.5 à 1 $ / 5 $ ✅. L'identifiant `claude-haiku-5-5` vient de la grille de l'Agent API Perplexity, pas de la page Anthropic ⚠️.
- Erreurs : une erreur de recherche arrive **en HTTP 200**, sous la forme d'un bloc `web_search_tool_result_error` (`too_many_requests`, `unavailable`, `max_uses_exceeded`…) ✅. Le `stop_reason` `pause_turn` impose de renvoyer le message pour continuer ✅.

### Requête exacte
```ts
const res = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': process.env.ANTHROPIC_API_KEY!,
    'anthropic-version': '2023-06-01',
  },
  body: JSON.stringify({
    model: 'claude-haiku-5-5',
    max_tokens: 1500,
    messages: [{ role: 'user', content: 'Quel est le meilleur plombier à Paris 11e ?' }],
    tools: [{
      type: 'web_search_20250305', name: 'web_search', max_uses: 3,
      user_location: { type: 'approximate', city: 'Paris', country: 'FR', timezone: 'Europe/Paris' },
    }],
  }),
  signal: AbortSignal.timeout(60_000),
});
```

### Format de réponse (extrait)
```json
{
  "stop_reason": "end_turn",
  "content": [
    { "type": "server_tool_use", "id": "srvtoolu_…", "name": "web_search", "input": { "query": "meilleur plombier Paris 11" } },
    { "type": "web_search_tool_result", "tool_use_id": "srvtoolu_…", "content": [ { "type": "web_search_result", "url": "https://…", "title": "…", "page_age": "…", "encrypted_content": "…" } ] },
    { "type": "text", "text": "Voici quelques plombiers…", "citations": [ { "type": "web_search_result_location", "url": "https://…", "title": "…", "cited_text": "…", "encrypted_index": "…" } ] }
  ],
  "usage": { "input_tokens": 0, "output_tokens": 0, "server_tool_use": { "web_search_requests": 1 } }
}
```
**Extraction** : concaténer les blocs `type === "text"` ; citations = `citations[].url`, avec repli sur `web_search_tool_result.content[].url`. Le champ `usage.server_tool_use.web_search_requests` est le format habituel de l'API, non relu sur la page ⚠️.

Sources : [Web search tool](https://platform.claude.com/docs/zh-CN/agents-and-tools/tool-use/web-search-tool) · [Pricing](https://platform.claude.com/docs/zh-CN/about-claude/pricing)

---

## 5. Conditions d'utilisation : peut-on mesurer automatiquement et revendre l'analyse ?

> Analyse de lecture, **pas un avis juridique**. À faire valider avant le lancement payant.

| Fournisseur | Ce qui est permis | Points de vigilance |
|---|---|---|
| **OpenAI** (Services Agreement, qui s'applique à l'API ✅) | Le client « owns all Output » ; usage de l'API dans ses propres applications | Interdit de revendre l'accès au compte ou aux clés, d'« extract data from the Services other than as permitted through the Services », de contourner les limites de débit, ou d'utiliser les outputs pour entraîner un modèle concurrent. L'appel via l'API est un usage prévu, ce qui est OK. La clause « automatically or programmatically extract… Output » figure dans les **Terms of Use grand public** et vise le scraping de ChatGPT : ne **jamais** automatiser l'interface chatgpt.com. |
| **Perplexity** (API Terms, mis à jour le 23/01/2026 ✅) | Le client « owns all Output » | Licence « non-sublicensable » ; output affiché « solely within the Customer Applications » ; Perplexity peut résilier toute application « competitive with Perplexity » ; limites de débit et throttling possibles. Vendre un rapport issu de notre application semble compatible ; vendre des données brutes en gros est plus risqué. |
| **Google Gemini** (Additional Terms ; version du 07/10/2025 lue ⚠️, version en vigueur non accessible) | — | **BLOQUANT** : interdit de « cache, copy, frame, syndicate, resell, **analyze**, train on » les *Grounded Results* et les Search Suggestions ; ceux-ci ne s'affichent que dans une application qu'on opère, **avec les Search Suggestions, et seulement à l'utilisateur qui a soumis le prompt** ; texte conservé 30 jours au maximum (6 mois dans un historique de chat) ; pas de suivi de clics ; pas de collecte des liens pour construire un index. Un audit mensuel comparatif, avec historique et revente, entre frontalement en conflit avec ces clauses. **De plus, les utilisateurs de l'EEE et du Royaume-Uni exigent les services payants** (pas de quota gratuit côté produit). |
| **Anthropic** (Commercial Terms, en vigueur au 17/06/2025 ✅) | Le client « owns its Outputs » ; pas d'entraînement sur les données client | Revente des « Services » interdite sans accord : revendre une *analyse* n'est pas revendre l'accès, mais à confirmer. Interdit de « build a competing product ». Aucune clause spécifique aux résultats de recherche web trouvée. |

**Points transverses**
1. **Représentativité / pratique commerciale trompeuse** : l'API avec recherche ≠ l'application ChatGPT, Gemini ou Perplexity grand public. Les modèles, la personnalisation et la localisation diffèrent. Le rapport doit dire « mesuré via l'API officielle de X, modèle Y, le JJ/MM » et ne pas promettre « ce que ChatGPT répond à vos clients ».
2. **Marques** : citer « ChatGPT », « Gemini » ou « Perplexity » de façon descriptive ; pas de logos sans vérifier les chartes de marque ⚠️.
3. **RGPD** : beaucoup d'artisans sont des entrepreneurs individuels, donc leur nom est une donnée personnelle. Stocker les réponses qui citent des concurrents demande une base légale et une durée de conservation. C'est aussi compatible avec la limite de 30 jours de Google si on ne garde que des agrégats.
4. **Gemini, options** :
   - (a) utiliser Gemini **sans** ancrage (on mesure la « mémoire » du modèle ; les clauses Grounded Results ne s'appliquent alors pas, mais le résultat est moins réaliste) ;
   - (b) passer par Vertex AI, dont les conditions diffèrent ⚠️ non vérifié ;
   - (c) demander une autorisation à Google ;
   - (d) remplacer Gemini par Claude dans le trio.
   **Recommandation : (a) pour le MVP + (d) en option**, et ne jamais stocker ni revendre les Grounded Results.

Sources : [OpenAI Services Agreement (PDF)](https://cdn.openai.com/osa/openai-services-agreement.pdf) · [OpenAI ToU, clause d'extraction (relevé ConductAtlas)](https://conductatlas.com/platform/openai/openai-terms-of-use/provision/CA-P-078686/no-automated-extraction-of-data-or-output/) · [Perplexity API Terms](https://www.perplexity.ai/en-GB/hub/legal/perplexity-api-terms-of-service) · [Gemini API Additional Terms (archive 10/2025)](https://ai.google.dev/gemini-api/terms-archive/terms_10_07_25) · [Anthropic Commercial Terms](https://www.anthropic.com/legal/commercial-terms)

---

## 6. Coût par audit (10 requêtes × 2 exécutions × 3 IA = 60 appels, soit 20 par IA)

Hypothèses par appel : prompt d'environ 50 tokens, réponse de 500 à 700 tokens (raisonnement compris). Contexte de recherche : environ 3 000 à 8 000 tokens d'entrée pour OpenAI et Perplexity, 10 000 à 20 000 par recherche pour Claude. Le volume réel est **à mesurer** (`usage`) ⚠️.

| IA | Coût par appel | Coût pour 20 appels |
|---|---|---|
| ChatGPT (`gpt-5.6-luna`, 1 à 2 recherches) | 0,012 à 0,025 $ | **0,24 à 0,50 $** |
| Perplexity (`perplexity/sonar`, 1 à 2 `web_search`) | 0,0045 à 0,007 $ | **0,09 à 0,14 $** |
| Gemini (`3.5-flash-lite`, 1 à 3 requêtes de recherche à 0,014 $) | 0,016 à 0,045 $ (≈ 0,002 $ dans le quota gratuit) | **0,32 à 0,90 $** (≈ 0,04 $ dans le quota) |
| Claude (`haiku-5-5`, 1 à 3 recherches) | 0,012 à 0,035 $ | 0,24 à 0,70 $ |

- **Trio ChatGPT + Perplexity + Gemini : ≈ 0,65 à 1,55 $ par audit.** Tant que le quota de 5 000 recherches Gemini par mois tient (environ 80 à 250 audits par mois), le coût tombe à **≈ 0,35 à 0,65 $**.
- Trio ChatGPT + Perplexity + Claude : ≈ 0,55 à 1,35 $.
- Les quatre IA : ≈ 0,90 à 2,25 $.
- Leviers d'économie :
  - `search_context_size: "low"` (OpenAI) ;
  - `max_uses` (Claude) et un plafond de recherches côté OpenAI (`max_tool_calls` ⚠️) ;
  - Fast Search chez Perplexity (0,001 $) ;
  - mise en cache des audits gratuits par le couple métier + ville. Attention : la mise en cache est interdite pour Gemini ancré.
- Rentabilité : l'abonnement à 29 € par mois couvre largement un audit mensuel par client (moins de 2 $). Le vrai risque vient de l'**audit gratuit** : il faut le limiter (captcha, une fois par e-mail) ou le réduire, par exemple à 5 requêtes × 1 exécution.

## Récapitulatif des points NON VÉRIFIÉS
1. Support de `web_search` par `gpt-6-luna` (fiche modèle inaccessible).
2. Paramètre `max_tool_calls` d'OpenAI.
3. Format exact des annotations Perplexity, et effet de `user_location` combiné à `model: "perplexity/sonar"`.
4. Absence d'option de localisation dans l'Interactions API Gemini ; `retrievalConfig.latLng` de l'ancien `generateContent` ; format des URL de redirection.
5. Prix de `gemini-3.8-flash` sur la page Google.
6. Identifiant exact `claude-haiku-5-5` et champ `usage.server_tool_use`.
7. Version en vigueur des Additional Terms Gemini (seule l'archive d'octobre 2025 a été lue), et conditions Vertex AI.
8. Volumes de tokens réels : les fourchettes de coût sont des estimations à recaler sur les premiers appels.
