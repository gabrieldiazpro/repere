# Méthode GEO de Repéré (V5) — ce qui est démontré, probable ou supposé

Version 2026-11-13 (agent GEO-OPT). Implémentation : `app/src/lib/geo/**`. Chaque constat produit par `auditGeo`
porte le niveau de preuve de la recommandation qu'il applique (champ `evidence` des sections, voir § 9).

**Niveaux de preuve**
- **démontré** : documentation officielle de l'opérateur (règle de fonctionnement), ou expérience contrôlée publiée et
  relue (ex. KDD 2024). Pour un accès robot, « démontré » signifie : si c'est bloqué, l'opérateur dit lui-même que la page
  ne sera pas utilisée.
- **probable** : corrélation observée sur de grands volumes (études d'éditeurs d'outils, prépublications), ou
  recommandation explicite d'un opérateur sans mesure publiée. Corrélation ≠ causalité.
- **hypothèse** : bonne pratique raisonnable, sans preuve publique d'effet sur les citations.

Règle produit : on ne promet jamais d'être cité. Bing le dit lui-même : le GEO ne garantit pas les citations, pas plus que
le SEO ne garantit des positions.

---

## 1. Accès des robots d'IA

| Opérateur | Robot | Rôle | robots.txt | Source |
|---|---|---|---|---|
| OpenAI | `OAI-SearchBot` | index de la recherche ChatGPT | respecté ; bloqué ⇒ absent des réponses de recherche (liens de navigation possibles) ; prise en compte ~24 h | [developers.openai.com/api/docs/bots](https://developers.openai.com/api/docs/bots.md) |
| OpenAI | `ChatGPT-User` | lecture à la demande d'un utilisateur | « peut ne pas s'appliquer » ; ne décide pas de la présence dans la recherche | idem |
| OpenAI | `GPTBot` | entraînement | respecté ; indépendant d'OAI-SearchBot | idem |
| Perplexity | `PerplexityBot` | index de recherche (pas d'entraînement) | respecté ; ~24 h ; IP publiées ; WAF : autoriser explicitement | [docs.perplexity.ai — crawlers](https://docs.perplexity.ai/docs/resources/perplexity-crawlers.md) |
| Perplexity | `Perplexity-User` | lecture à la demande | « ignore généralement » robots.txt | idem |
| Anthropic | `Claude-SearchBot` | index de recherche de Claude | respecté ; bloqué ⇒ moins de visibilité dans les réponses avec recherche | [support.claude.com/…/8896518](https://support.claude.com/en/articles/8896518) |
| Anthropic | `Claude-User` | lecture à la demande | respecté | idem |
| Anthropic | `ClaudeBot` | entraînement | respecté ; Crawl-delay pris en charge ; ne contourne pas les CAPTCHA | idem |
| Mistral | `MistralAI-User` | lecture à la demande (Le Chat / Vibe) | gouverné par robots.txt | [docs.mistral.ai/robots](https://docs.mistral.ai/robots) |
| Mistral | `MistralAI-Index` | index de recherche (pas d'entraînement) | non précisé | idem |
| Google | `Googlebot` | Recherche, **AI Overviews et AI Mode** | robots.txt de Googlebot = contrôle des fonctions IA de la Recherche | [Google — AI features](https://developers.google.com/search/docs/appearance/ai-features) |
| Google | `Google-Extended` | jeton : entraînement et ancrage de Gemini (hors Recherche) | sans effet sur AI Overviews / AI Mode | idem |
| Microsoft | `Bingbot` | index Bing ⇒ Copilot et API d'ancrage | `NOARCHIVE` exclut des réponses Copilot ; `NOCACHE` limite à URL/titre/extrait | [SEJ — consignes Bing 02/2026](https://searchenginejournal.com/bing-adds-geo-to-official-guidelines-expands-ai-abuse-definitions/568442/) |

Recommandations :
1. **Autoriser les robots de recherche** (OAI-SearchBot, PerplexityBot, Claude-SearchBot, Googlebot, Bingbot) — **démontré**.
   Bloquer l'entraînement (GPTBot, ClaudeBot, Google-Extended, CCBot) est un choix légitime sans effet documenté sur les
   réponses avec recherche — **démontré** (OpenAI : réglages indépendants).
2. **Pare-feu / CDN** : un blocage réseau annule un robots.txt permissif. Cloudflare bloque les robots d'IA par défaut pour
   ses **nouveaux clients** depuis le 1er juillet 2025 ([SER](https://www.seroundtable.com/cloudflare-block-ai-crawlers-39673.html)) ;
   Perplexity demande d'autoriser ses IP dans le WAF — **démontré** (mécanisme). Limite : notre robot n'est pas un robot
   d'IA ; un défi anti-robot servi à RepereBot est un **indice**, pas une preuve, que les robots d'IA sont bloqués.
3. **Contenu rendu côté serveur** : les robots d'OpenAI, d'Anthropic et de Perplexity n'exécutent pas le JavaScript
   (Vercel × MERJ, déc. 2024, sur nextjs.org surtout ; Gemini/Googlebot et Applebot le rendent) — **probable** (mesure
   d'un hébergeur, échantillon limité, cohérente avec les docs). Microsoft déconseille aussi les réponses cachées dans des
   onglets/accordéons, les PDF et les images seules — **probable** (recommandation d'opérateur).
4. **En-têtes et méta** : `X-Robots-Tag`/`meta robots` `noindex`, `nosnippet`, `noarchive` (Bing/Copilot), `max-snippet:0`
   limitent ou suppriment l'usage des pages — **démontré** (docs Google, consignes Bing).

## 2. Entité (qui êtes-vous ?)
- Nom, adresse, téléphone cohérents entre pages et avec le JSON-LD `Organization`/`LocalBusiness` ; noms d'entité clairs
  et constants (consignes Bing 2026) — **probable** (recommandation d'opérateur, pas de mesure publiée).
- `sameAs` vers les profils officiels, page « à propos », auteurs identifiés — **hypothèse** utile (désambiguïsation ;
  aucun opérateur ne publie d'effet).
- Fiches Google Business Profile et flux Merchant Center aident à apparaître dans les réponses IA de Google — **démontré**
  comme voie d'éligibilité (guide Google « ai-optimization-guide », 10/07/2026), effet non chiffré.
- Le JSON-LD n'est **pas requis** par Google pour ses fonctions IA, mais doit concorder avec le texte visible —
  **démontré** (Google). Bing recommande le JSON-LD (produit, avis, FAQ, événement) — **probable**.

## 3. Contenu citable au niveau du passage
Les moteurs récupèrent des pages puis en extraient des passages (RAG, décrit par Google). Constats :
- **GEO (Aggarwal et al., KDD 2024, [arXiv 2311.09735](https://arxiv.org/pdf/2311.09735))** — expérience contrôlée sur un
  moteur simulé (GPT-3.5 + 5 premiers résultats Google) et sur Perplexity (200 requêtes) : ajouter des **citations**
  (+41 % de visibilité mesurée), des **statistiques** (+31 %), des **sources** (+27 %) et améliorer la **fluidité** (+28 %)
  augmente la part de la réponse attribuée à la source ; le **bourrage de mots-clés** fait baisser (−8 %). Gains plus
  forts pour les sources mal classées. — **démontré** (en laboratoire ; transposition aux moteurs actuels : probable).
- **Réponse directe, phrases autonomes** (compréhensibles hors contexte), Q/R, listes, tableaux, une idée par URL,
  l'essentiel en haut — **probable** (consignes Microsoft, oct. 2025 et fév. 2026).
- **Position** : 44 % des citations ChatGPT viennent du premier tiers de la page ; passages cités plus riches en entités
  nommées (~21 % de noms propres), plus souvent définitoires et en Q/R (K. Indig, 18 012 citations vérifiées,
  [Search Engine Land](https://searchengineland.com/chatgpt-citations-content-study-469483)) — **probable**
  (corrélation, ChatGPT seul).
- **Ce qu'il ne faut pas faire** : Google dit qu'il n'est pas nécessaire de découper en « petits morceaux » ni d'écrire
  « pour l'IA » ; Bing classe le « langage artificiellement fabriqué pour déclencher des citations » et l'injection de
  consignes parmi les abus — **démontré**. ⇒ Repéré propose des réécritures pour la clarté et les faits, jamais du
  bourrage ni des pages en masse.

Score de passage Repéré (0–100, **heuristique**, critères ci-dessus) : autonomie (sujet nommé, pas de pronom initial,
pas de formule creuse) 20 ; chiffre précis 15 ; date 10 ; source citée ou citation attribuée 15 ; réponse directe à
une question (titre-question + première phrase qui répond) 20 ; longueur 40–300 mots 10 ; entités nommées 10.

## 4. Couverture des questions (« query fan-out »)
Google décrit l'« éventail de requêtes » : le modèle lance plusieurs recherches liées par sous-thème (AI Overviews, AI
Mode) — **démontré** (mécanisme documenté). Couvrir les sous-questions probables d'un client — prix, délais, zone,
garanties, comparaison, avis, étapes — augmente les chances qu'une de vos pages soit récupérée : **probable**.
Avertissement Google : produire des pages en masse pour chaque sous-requête relève de l'abus de contenu à grande
échelle. ⇒ Repéré propose une FAQ ou des sections sur des pages existantes, pas de nouvelles pages en série.
Sous-questions générées par le fournisseur d'IA configuré ; sans clé (démo), par modèles par type de site (étiquetées).

## 5. Fraîcheur
- Les assistants citent des pages en moyenne plus récentes que la recherche classique (25,7 % plus jeunes ; ChatGPT
  le plus marqué ; AI Overviews proche de l'organique) — Ahrefs, 17 M de citations, juillet 2025 — **probable**.
- Les reclasseurs à base de LLM favorisent les passages datés récemment, toutes choses égales (jusqu'à 25 % de
  préférences inversées) — Fang et al., [arXiv 2509.11353](https://arxiv.org/abs/2509.11353v1) — **démontré** en
  laboratoire. ⇒ Date visible + `dateModified` honnêtes. Google met en garde contre le changement de date sans changement
  réel : Repéré ne propose jamais de rajeunir une date.

## 6. Données structurées utiles aux IA
Organization/LocalBusiness (entité), Product + Offer (e-commerce), Article/BlogPosting avec auteur et dates, FAQPage si
les Q/R sont visibles, BreadcrumbList. Non requis par Google pour l'IA — **démontré** ; recommandé par Bing — **probable** ;
effet direct sur les citations des autres assistants — **hypothèse**.

## 7. llms.txt
Google : n'utilise pas llms.txt, « ni ne nuit ni n'aide » — **démontré**. SE Ranking (300 000 domaines, nov. 2025) : aucune
corrélation avec la fréquence de citation ([SEJ](https://www.searchenginejournal.com/llms-txt-shows-no-clear-effect-on-ai-citations-based-on-300k-domains/561542/)).
⇒ Constat **informatif uniquement** (sévérité `info`, n'entre pas dans le score), fichier proposé, sans promesse.

## 8. Présence hors site
- Les moteurs d'IA citent surtout des médias tiers (« earned media ») plutôt que les sites de marque, bien plus que Google
  (Chen et al., Univ. Toronto, [arXiv 2509.08919](https://arxiv.org/html/2509.08919v1), sept. 2025) — **probable**.
- Les mentions de la marque sur le web corrèlent plus avec la visibilité dans AI Overviews (ρ = 0,664) que les liens
  (0,218) — Ahrefs, 75 000 marques, mai 2025 — **probable** (corrélation).
- Google : chercher des « mentions » artificielles est inefficace — **démontré**.
⇒ Repéré part des **sources réellement citées par les IA** (moteur d'audit) : catégories (annuaires, avis, forums/Reddit,
Wikipédia, médias, comparateurs, marketplaces), domaines qui comptent, et où le client n'a ni lien ni présence vérifiée.
Sans réponses d'IA mesurées, la section est marquée « non mesurée » (pas de liste générique présentée comme réelle).

## 9. Mise en œuvre et limites
- `auditGeo` est pur (aucun réseau). Sections : `acces`, `entite`, `passages`, `questions`, `fraicheur`, `donnees`,
  `llms`, `hors_site`. Score de section = 100 − pénalités (critique 45, élevé 22, moyen 10, faible 4, info 0), plafond 0 ;
  score global = moyenne pondérée des sections mesurées ; un blocage des robots de recherche plafonne le global à 35.
- Réécritures (`rewritePassage`) : IA configurée avec garde-fou anti-invention (tout chiffre, date, prix absent du passage
  et de la fiche de vérité ⇒ réécriture rejetée, repli déterministe) ; sinon repli déterministe avec `[à compléter]`.
- Le rendu « sans JavaScript » est jugé sur le HTML brut de l'exploration ; le pare-feu sur les réponses servies à notre
  robot. Aucune mesure de journaux serveur (log analysis) dans cette version.
