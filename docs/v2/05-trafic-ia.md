# 05 - Trafic IA : detection, mesure, preuve

Agent TRAFIC IA, 2026-11-09. Regles machine : `05-ai-sources.json`. Les affirmations marquees *(non verifie)* viennent de ma connaissance, pas d'une source lue ce jour : a controler sur donnees reelles avant la prod.

## 1. Ce qu'on peut et ne peut pas detecter

| Source | Signal cote site | Fiabilite |
|---|---|---|
| ChatGPT | `utm_source=chatgpt.com` ajoute par OpenAI aux liens de recherche (sans `utm_medium`) ; referrer `chatgpt.com` souvent absent | Bonne via l'UTM. Un bug mi-oct. 2026 a retire UTM et referrer des liens du texte de reponse ~1 semaine : prevoir un trou dans les courbes |
| Perplexity, Gemini, Copilot, Claude, You.com | Referrer `perplexity.ai`, `gemini.google.com`, `copilot.microsoft.com`, `claude.ai`, `you.com` quand transmis | Moyenne : appli mobile et `noreferrer` retombent en Direct *(non verifie)* |
| Google AI Mode / AI Overviews | Aucun | **Indiscernable de l'organique.** AI Mode envoyait des liens `noreferrer` (Direct), corrige fin mai 2025 ; depuis juin 2025 les clics sont comptes dans Search Console, type "Web", sans filtre dedie |

Regle produit : le trafic IA affiche est un **plancher mesure**, jamais un total. Le "Direct" n'est jamais attribue a une IA. Pour Google, afficher "non mesurable" + la courbe Search Console globale.

GA4 : le tag `utm_source` seul donne `chatgpt.com / (not set)`, parfois Unassigned ; un canal "AI Assistant" aurait ete ajoute le 13 mai 2026 *(source secondaire unique)*. Le connecteur doit donc filtrer par regex sur `sessionSource`, pas sur le canal par defaut.

## 2. Robots d'IA : trois natures differentes

- **Entrainement** (GPTBot, ClaudeBot, Bytespider, meta-externalagent, CCBot) : aucun trafic en retour.
- **Indexation** (OAI-SearchBot, PerplexityBot, Claude-SearchBot, Applebot) : condition pour etre cite. Bloque = invisible dans cette IA (OpenAI : delai ~24 h).
- **Visite temps reel** (ChatGPT-User, Perplexity-User, Claude-User) : une personne vient de poser une question qui implique votre page. Ignore souvent robots.txt (action utilisateur). C'est le meilleur signal de citation en cours.
- **Jetons robots.txt, jamais dans les logs** : Google-Extended (entrainement + grounding Gemini ; sans effet sur Search, AI Overviews, AI Mode) et Applebot-Extended. On les lit dans robots.txt, pas dans les logs.
- Une UA est usurpable : "verifie" = IP comparee aux listes JSON publiees (OpenAI, Perplexity), puis IP jetee.

Table complete (UA, categorie, listes IP, niveau de verification) : `05-ai-sources.json`. Anthropic ne publie pas de chaine UA dans la page lue : valider sur logs.

## 3. Architecture du snippet (mesure a)

```
<script async src="https://app.repere.fr/t.js" data-k="SITE_KEY"></script>
```

1. Le snippet lit referrer + `utm_source`, pre-filtre cote client, et n'envoie **que les visites venant d'une IA** (minimisation : on ne mesure pas l'audience generale).
2. `POST /api/t` (sendBeacon, `text/plain`, pas de preflight CORS). Payload : `{k, p, r, u, m, c?}` = cle site, chemin sans query, host referrer, utm_source, utm_medium, conversion facultative.
3. Serveur : `k` -> site (verifier `Origin` = domaine enregistre) ; reclassement par `05-ai-sources.json` ; rejet si l'UA en-tete est un robot ; **IP lue en memoire pour le rate-limit puis jamais ecrite** (ni log, ni DB).
4. Ecriture : un upsert agrege `ai_visits_daily(site_id, day, engine, signal, path, visits, conversions)`, jour en Europe/Paris. Aucune ligne par visiteur, aucun identifiant, aucune session.
5. Retention : 13 mois (plafond CNIL 25 mois). Purge mensuelle.

**Limite assumee** : sans stockage, une conversion n'est rattachee a l'IA que si elle a lieu sur **la meme page vue** (`repere("lead")`). Pour une attribution multi-pages, utiliser GA4/CRM du client (section 6) ou des champs caches remplis par le site lui-meme avec ses propres UTM.

### Code (1 158 octets commente, ~800 minifie ; limite 1 500)

```js
/*! Repere t.js - sans cookie, sans stockage, sans identifiant */
(function (w, d, n) {
  var s = d.currentScript, k = s && s.dataset.k, l = location, q, r = "", u;
  if (!k || n.doNotTrack == "1" || n.webdriver) return; // site inconnu, DNT, robot
  q = new URLSearchParams(l.search);
  u = (q.get("utm_source") || "").slice(0, 40);
  try { r = new URL(d.referrer).hostname.replace(/^www\./, ""); } catch (e) {}
  if (r == l.hostname.replace(/^www\./, "")) r = ""; // navigation interne
  // Pre-filtre: seules les visites venant d'une IA partent. Le serveur reclasse.
  if (!/chatgpt|openai|perplexity|gemini|copilot|claude|you\.com|meta\.ai|mistral|deepseek|grok|phind|kagi/i.test(r + u)) return;
  function t(c) { // c = nom de conversion (facultatif), meme page vue uniquement
    var b = JSON.stringify({ k: k, p: l.pathname.slice(0, 200), r: r, u: u, m: (q.get("utm_medium") || "").slice(0, 20), c: c });
    var e = new URL(s.src).origin + "/api/t";
    n.sendBeacon ? n.sendBeacon(e, b) : fetch(e, { method: "POST", body: b, keepalive: true });
  }
  t(); w.repere = t; // w.repere("lead") au succes d'un formulaire
})(window, document, navigator);
```

## 4. Mesure par canal

| Canal | Methode | Notes |
|---|---|---|
| (a) Snippet | Section 3 | Zero dependance au client analytics ; marche sur WordPress, Shopify (theme) et sites custom |
| (b) GA4 | Section 5 | Rapport "source" ; historique et conversions deja chez le client |
| (c) Search Console | API `searchAnalytics.query`, scope `webmasters.readonly` | Ne separe **pas** l'IA : AI Mode et AI Overviews sont fondus dans "Web". Sert de base : impressions/clics requetes, pages. Pas d'indicateur "IA" a en tirer |
| (d) Logs robots | Next.js : `middleware.ts` ; WordPress : plugin lisant `HTTP_USER_AGENT` tot (hook `init`), regex du JSON, lot quotidien signe HMAC vers Repere ; Cloudflare/Vercel : export de logs | Stocker `bot, category, path, day, count, verified` ; jamais l'IP. Les caches/CDN masquent des hits : mesure a la source (edge) quand possible. Lire aussi robots.txt pour Google-Extended/Applebot-Extended |
| (e) Shopify | ShopifyQL : sessions par `utm_source` (filtre sur chatgpt, openai, gemini, claude, perplexity, grok), avec visiteurs, sessions, ajouts panier, checkouts, taux de conversion | Source tierce : filtre `human_or_bot_session` inclut les robots par defaut, a restreindre a `human`. Les sessions sans UTM ne sont pas captees. Acces via Admin API (scope `read_reports`) *(non verifie)* |

## 5. Connecteur GA4

- **Auth** : OAuth 2 Google, scope `https://www.googleapis.com/auth/analytics.readonly`, acces hors ligne. Refresh token chiffre (colonne chiffree Supabase / KMS). Revocation en un clic. Verifier si la verification d'application Google est requise pour ce scope *(non verifie)*.
- **Choix de propriete** : Admin API `accountSummaries` -> l'utilisateur choisit la propriete GA4.
- **Requete** (Data API v1beta `properties/{id}:runReport`), 1 appel/jour/site :
  - dimensions : `date`, `sessionSource`, `sessionMedium`, `landingPagePlusQueryString`
  - metriques : `sessions`, `engagedSessions`, `keyEvents`, `totalRevenue`
  - `dimensionFilter` : `sessionSource` correspond a la regex construite depuis le JSON (`chatgpt|openai|perplexity|gemini|copilot|claude|you\.com|...`)
  - Utiliser les dimensions de **session**, pas "first user".
- **Normalisation** : `chatgpt.com / (not set)` et `chatgpt.com / referral` -> meme moteur ; `landingPage` sans query ; ecriture dans la meme table agregee que le snippet, colonne `origin='ga4'`.
- **Doublons** : si snippet et GA4 coexistent, ne jamais additionner ; afficher GA4 comme chiffre de reference, le snippet comme controle (ecart > 30 % = alerte "consentement ou bloqueurs").
- **Donnees** : sauvegarde de l'agrege uniquement, pas de donnees utilisateur. Backfill 90 jours, sync nocturne, gestion des quotas par propriete *(valeurs non verifiees)*, seuils de confidentialite GA4 possibles.
- **Limite** : GA4 est derriere le bandeau cookies du client : sous-compte structurel si refus. Le dire a l'ecran.
- **Phase 2** : audience/evenement "conversion" au choix du client (ex. `generate_lead`, `purchase`).

## 6. Attribution des conversions

- **Formulaire** : snippet `repere("lead")` au succes (meme page vue) ; ou evenement cle GA4 filtre sur source IA ; ou champ cache `utm_source` rempli par le site lui-meme vers son CRM (HubSpot...) : cette derniere option est la plus fiable en multi-pages.
- **Appel** : numero de suivi dynamique = cookies + sous-traitant + cout ; hors MVP. Alternative honnete : question "comment nous avez-vous connus ? ChatGPT / Perplexity..." a l'accueil telephonique, saisie dans l'outil (declaratif, a marquer comme tel).
- **Achat** : GA4 `totalRevenue` / `ecommercePurchases` par source ; Shopify : commandes par `utm_source` (ShopifyQL). Presenter comme "attribue au dernier clic, plancher".
- Aucune promesse de causalite : "visites IA suivies de X conversions", pas "l'IA a genere X EUR".

## 7. Indicateurs a afficher

1. **Visites IA par moteur** (ChatGPT, Perplexity, Gemini, Copilot, Claude, autres), 30 j, avec mention "plancher mesure".
2. **Pages d'arrivee** : top 10 chemins, croise avec les pages "citables" creees par Repere (preuve de l'execution).
3. **Tendance** : courbe hebdo, repere vertical a la date de chaque action Repere (avant/apres), annotation du bug ChatGPT d'oct. 2026.
4. **Conversions** : formulaires/achats suivis, taux par moteur (seuil min. d'echantillon avant d'afficher un taux).
5. **Robots IA qui lisent le site** : par categorie (indexation / temps reel / entrainement), par bot, pages les plus lues, derniere visite ; alerte "OAI-SearchBot n'a jamais visite" ou "robots.txt bloque PerplexityBot" (action : corriger).
6. **Part non mesurable** : encart Google AI Mode / AI Overviews + Direct, explicite.

## 8. Conformite

**Conditions CNIL de l'exemption "mesure d'audience"** (page CNIL lue ce jour) : finalite limitee a la mesure d'audience pour le seul compte de l'editeur ; aucun suivi de la navigation sur plusieurs sites ; statistiques anonymes uniquement ; pas de croisement avec d'autres traitements ni transmission a des tiers ; duree de vie du traceur ~13 mois, non prolongee automatiquement ; conservation 25 mois maximum ; information recommandee (politique de confidentialite) ; un prestataire peut servir plusieurs editeurs si donnees et traceurs sont independants par editeur et s'il s'engage contractuellement a ne pas reutiliser les donnees ; verifier les transferts hors UE. La page ne detaille pas le traitement de l'IP : design = aucune IP stockee.

**Notre position** : le snippet n'ecrit rien dans le terminal (pas de cookie, localStorage, ID), n'envoie que des agregats de visites IA, heberge en UE (Supabase region UE, a verifier), donnees cloisonnees par site, aucun usage propre. Il devrait donc entrer dans l'exemption ; **a faire valider par un juriste/DPO** avant lancement (ceci n'est pas un avis juridique).

A faire : mention dans la politique de confidentialite du client (texte fourni) ; contrat de sous-traitance (art. 28 RGPD) ; ne pas ajouter d'ID de session ni d'empreinte navigateur (sortirait de l'exemption) ; GA4 reste soumis au consentement chez le client (CNIL SAN-2020-008 : GA non strictement necessaire) : le connecteur ne lit que ses agregats ; logs robots : pas de donnee personnelle si IP non conservee ; CGU des API Google/Shopify : usage des donnees limite a la fourniture du service, pas de revente.

## 9. Sources

- OpenAI, Overview of OpenAI Crawlers : https://developers.openai.com/api/docs/bots.md
- Perplexity, Crawlers : https://docs.perplexity.ai/docs/resources/perplexity-crawlers.md
- Anthropic crawlers (via Search Engine Roundtable) : https://www.seroundtable.com/anthropic-updates-its-crawler-docs-40978.html
- CNIL, Mesurer la frequentation de vos sites web : https://www.cnil.fr/fr/mesurer-la-frequentation-de-vos-sites-web-et-de-vos-applications
- CNIL, Solutions pour la mesure d'audience : https://www.cnil.fr/fr/solutions-pour-la-mesure-daudience (non lue, bloquee)
- Search Engine Land, AI Mode traffic untrackable : https://searchengineland.com/googles-ai-mode-traffic-untrackable-455883
- Search Engine Journal, AI Mode dans Search Console : https://www.searchenginejournal.com/google-adds-ai-mode-traffic-to-search-console-reports/549089/
- Clickport, ChatGPT en Direct dans GA4 (secondaire) : https://clickport.io/blog/chatgpt-direct-traffic-ga4
- PPC Land, Google-Extended : https://ppc.land/google-extended/ ; Applebot : https://ppc.land/applebot/
- Highview Apps, sessions IA Shopify : https://www.highviewapps.com/kb/how-can-i-generate-an-analytics-report-of-sessions-from-ai-sources-for-my-shopify-store/
- Google Analytics Data API : https://developers.google.com/analytics/devguides/reporting/ (non lue en detail)
