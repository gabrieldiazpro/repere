# 10 — Stratégie SEO / GEO d'AuditIA Local

Agent SEO, vague 1. Données de référence : `docs/10-seo-data.json` (20 métiers, 20 arrondissements, 15 villes).
Date de rédaction : 9 novembre 2026. Aucun volume de recherche n'a pu être sourcé : la colonne n'existe donc pas. À mesurer dans Google Search Console dès les premières impressions.

## 0. Constat d'honnêteté (à lire avant tout)

1. **Au lancement, nous avons zéro audit.** Une page `/visibilite-ia/[metier]/[ville]` « différenciée par des données agrégées » n'a aucune donnée à afficher tant que les audits n'existent pas. Conséquence : ces pages sont générées à la demande, **en `noindex` par défaut**, et ne passent en `index` que lorsque le seuil de données est atteint (section 5). Le SEO programmatique est donc un levier de **mois 3 à 6**, pas de la semaine 1.
2. **Le levier de départ est le contenu écrit à la main** : 20 pages métier (national), 10 articles piliers, et quelques pages métier × ville rédigées par nous pour Paris.
3. Les chiffres cités ci-dessous viennent de sources secondaires (blogs d'agences, résumés d'études). Ils servent à orienter, pas à prouver. Chaque chiffre porte sa source.

## 1. Ce que disent les sources (recherches du 9 nov. 2026)

**Core Update de mars 2026 et « scaled content abuse »**
- La mise en application de la politique contre le contenu produit à grande échelle a durement touché les sites de pages programmatiques : baisses de trafic estimées entre 50 et 80 % pour les annuaires de pages « mot-clé + lieu » ([Alex Cloudstar](https://alexcloudstar.com/blog/programmatic-seo-2026-indie-hackers/)). Un autre acteur avance 87 % de perte moyenne pour les sites touchés, chiffre non vérifié ([Digital Applied](https://www.digitalapplied.com/blog/programmatic-seo-after-march-2026-surviving-scaled-content-ban)).
- Le critère est l'intention et la valeur, pas la méthode (IA ou non). La détection de quasi-doublons comparerait désormais le **sens** : des pages qui ne diffèrent que par le nom de la ville comptent pour une seule page.
- Ce qui a survécu : des pages de lieu bâties sur des données locales non interchangeables, des agrégateurs qui ajoutent une vraie synthèse, des pages avec date de mise à jour visible. Facteur commun : **une donnée unique par page**.
- Règles opérationnelles reprises : la donnée spécifique en haut de page ; fusionner les pages sœurs qui ne diffèrent que d'une variable ; 3 à 6 liens internes fondés sur des relations réelles ; ne générer une page que s'il existe des données ; JSON-LD conforme au contenu visible ; texte rédigé par IA acceptable seulement autour de vraies données ; publier par lots (20 pages à la main, 3 semaines d'observation, puis lots d'environ 100).
- Le seuil « 30 à 40 % de contenu unique » avancé par Digital Applied est une heuristique d'agence, pas une règle Google. Nous visons plutôt : **chaque page contient au moins 5 chiffres propres à son couple métier × ville**.

**Guide officiel de Google sur l'IA (15 mai 2026, via [Frase](https://www.frase.io/blog/google-ai-optimization-guide), non relu à la source)**
- Optimiser pour AI Overviews / AI Mode reste du SEO. Pas de balisage spécial, pas besoin de `llms.txt`, pas de découpage artificiel en « chunks », pas de longueur idéale.
- Facteur le plus durable : du contenu « non banal », issu d'une expérience de première main. Pour le local : Google Business Profile à jour.
- Ce guide ne dit rien sur ChatGPT ou Perplexity.

**Ce qui fait citer une page par une IA**
- Étude de 21 143 citations sur 602 requêtes ([résumé](https://news.lavx.hu/article/what-21-000-ai-citations-reveal-about-generative-engine-optimization)) : les pages les plus citées ont des chiffres/statistiques (+61 %), des définitions claires (+57 %), des comparaisons structurées (+55 %), des étapes pratiques (+41 %), beaucoup de titres (en moyenne 10,6) et environ 1 900 mots. Ce sont des corrélations, pas des causes.
- Aggarwal et al. (arXiv 2311.09735) : jusqu'à +40 % de visibilité avec des méthodes comme citer des sources et ajouter des statistiques, très variable selon le domaine ([cité par Scroll](https://agence-scroll.com/fr/blog/geo-seo-moteurs-ia)).
- Ahrefs (août 2025) : seulement 12 % des URL citées par ChatGPT, Gemini et Copilot sont dans le top 10 Google pour la même question. Être bien classé sur Google ne suffit pas, et inversement.
- Leviers techniques : pages indexables, contenu lisible côté serveur, ne pas bloquer OAI-SearchBot, Claude-SearchBot, PerplexityBot. Cohérence du nom, de l'adresse et de la description partout (site, annuaires, avis).

**`llms.txt`**
- Google confirme (juin 2026) qu'il n'a aucun effet sur le référencement. Sur 137 000 domaines, 97 % des fichiers n'ont reçu aucune requête en mai 2026 et les robots de récupération IA représentent 1,1 % des requêtes ([PPC Land](https://ppc.land/llms-txt-adoption-rises-8-8x-but-97-of-files-get-zero-ai-requests/), données Ahrefs/Originality.ai).
- Décision : on en publie un (coût quasi nul, utile pour les agents), **sans en attendre aucun gain de trafic**. Ne pas y investir de temps.

**Vocabulaire français**
Les agences francophones utilisent GEO, « référencement IA », « visibilité IA », « moteurs génératifs », « part de voix » ([Scroll](https://agence-scroll.com/fr/blog/geo-seo-moteurs-ia), [JDN](https://www.journaldunet.com/seo/1555503-geo-comment-suivre-et-optimiser-sa-visibilite-ia/), [GEO Toolbox](https://geotoolbox.ai/fr/blog/visibilite-ia)). Notre cible (artisans) ne dit pas « GEO » : elle dit « apparaître sur ChatGPT ». Le site parle donc la langue du client et explique GEO en une phrase.

## 2. Stratégie : rendre chaque page réellement unique

**Principe : une page métier × ville n'existe que si elle porte une information qu'aucune autre page n'a.** Pas de paragraphe gabarit dont seule la ville change.

### Données dynamiques issues de nos audits (agrégées, jamais nominatives)
Calculées par une vue SQL `seo_stats(trade_slug, city_slug)` sur la table des audits terminés, hors audits `demo = true` et hors doublons (même établissement, même mois).

| Donnée | Définition |
|---|---|
| `audit_count` | Nombre d'audits du métier dans la ville (période : 12 mois glissants) |
| `avg_score` | Score moyen /100 |
| `median_score`, `p25`, `p75` | Pour situer un lecteur |
| `mention_rate` | % de requêtes où l'établissement audité est cité par au moins une IA |
| `zero_visibility_share` | % d'établissements audités jamais cités |
| `harshest_provider` | IA au score moyen le plus bas pour ce couple, avec son score |
| `friendliest_provider` | IA au score moyen le plus haut |
| `top_competitors_cited` | Les 3 noms les plus cités **à la place** des audités : ce sont des commerces publics, donc affichables. Seuil : cités dans au moins 3 audits distincts |
| `top_sources` | Types de sources citées par les IA (annuaire, site de l'établissement, presse, avis) en % |
| `delta_vs_trade_national` | Écart du score moyen local par rapport au score moyen national du métier |
| `delta_vs_city` | Écart par rapport à la moyenne de tous les métiers dans cette ville |
| `trend_90d` | Évolution du score moyen sur 90 jours (si au moins 2 mois de données) |
| `last_updated` | Date du dernier audit pris en compte, affichée et reprise dans `lastmod` |

### Garde-fous de confidentialité et d'honnêteté
- **K-anonymat** : on n'affiche jamais une statistique calculée sur moins de 5 audits. Aucun nom d'établissement audité n'est publié (le RGPD et la confiance l'exigent ; voir l'agent juridique).
- Les noms de concurrents cités ne viennent que des réponses des IA (informations publiques) et jamais d'un jugement de notre part. Mention : « cités par les IA lors de nos tests, pas un classement de qualité ».
- Chaque chiffre est accompagné de sa base (« sur 14 audits, du 2 au 31 octobre »). Aucune donnée inventée : sans données, pas de page indexable.
- Le biais d'échantillon est dit clairement : nos audits concernent les commerces qui ont voulu se tester, pas l'ensemble du marché.

### Sources de différenciation hors audits (pour les pages sans assez de données)
Ces éléments alimentent la page **métier** (niveau national) et les premières pages rédigées à la main :
1. Requêtes réelles testées : la liste exacte des requêtes envoyées aux IA pour ce métier × cette ville, et ce que les IA ont répondu (extraits courts, anonymisés).
2. Quartiers : les requêtes « près de Bastille » ne donnent pas les mêmes résultats que « Paris 11e ». Un tableau par quartier quand il y a des données.
3. Études de cas réels (avec accord écrit) : avant/après d'un commerce.
4. Éditorial de 100 à 150 mots **écrit par une personne** pour les 20 combinaisons les plus importantes (Paris × métiers prioritaires).

### Ce que nous ne faisons pas
- Pas de paragraphes générés par IA qui paraphrasent « pourquoi la visibilité IA est importante pour un plombier à Lyon ».
- Pas de pages pour des combinaisons sans donnée (35 villes × 20 métiers = 700 URL possibles ; on indexera peut-être 40 la première année, et c'est très bien).
- Pas de pages « près de moi » ni de pages quartier × métier tant que le couple n'a pas ses propres données.
- Pas de faux avis, pas d'astuce de manipulation des réponses IA (la politique de Google la nomme désormais explicitement).

## 3. Arborescence

```
/                                      Landing (audit gratuit)
/audit                                 Formulaire d'audit
/tarifs
/visibilite-ia                         Hub : explication + liste des métiers
/visibilite-ia/[metier]                Page métier nationale (20) — toujours indexée, rédigée à la main
/visibilite-ia/[metier]/[ville]        Page métier × ville — indexée seulement si seuil atteint
/visibilite-ia/ville/[ville]           Page ville tous métiers (optionnelle, phase 2) — indexée si ≥ 15 audits cumulés
/blog                                  Liste
/blog/[slug]                           10 articles piliers (section 7)
/methodologie                          Comment on mesure (requêtes, nombre de passes, limites) — page de confiance, citée par les autres
/a-propos                              Qui est derrière AuditIA (entité, contact)
/mentions-legales, /cgv, /confidentialite
/sitemap.xml, /robots.txt, /llms.txt
/rapport/[id], /app/*, /api/*          noindex, disallow
```

Arrondissements : `paris-11e`, `paris-1er`... Pas de page « Paris » agrégée au départ : elle est créée en phase 2 comme page ville (`/visibilite-ia/ville/paris`) et sert de parent aux 20 arrondissements.

## 4. 15 mots-clés prioritaires (sans volumes)

Aucun volume sourcé. Ordre = priorité de production, pas de trafic. Intention : I = informationnelle, C = comparaison/évaluation, T = transactionnelle, L = locale/commerciale.

| # | Mot-clé | Intention | Page cible |
|---|---|---|---|
| 1 | apparaître dans ChatGPT (commerce local) | I, déjà sensibilisé : veut une méthode | Article pilier 1 |
| 2 | visibilité ChatGPT entreprise | I/C : cherche à mesurer | Article pilier 2 + landing |
| 3 | référencement IA | I : terme générique des agences | Article pilier 3 |
| 4 | GEO c'est quoi / generative engine optimization | I : définition | Article pilier 4 |
| 5 | mon entreprise est-elle visible sur ChatGPT | T : veut tester, fort potentiel de conversion | `/audit` + landing |
| 6 | audit visibilité IA gratuit | T | `/audit` |
| 7 | comment être recommandé par ChatGPT | I | Article pilier 1 |
| 8 | ChatGPT recommande mes concurrents | I/T : douleur précise | Article pilier 5 |
| 9 | SEO local et IA | I | Article pilier 6 |
| 10 | référencement ChatGPT artisan | L | `/visibilite-ia/[metier]` (tous) |
| 11 | visibilité IA plombier Paris | L | `/visibilite-ia/plombier/paris-11e` et suivants |
| 12 | outil suivi visibilité IA (alternative aux outils d'agence) | C | Page comparatif (pilier 9) |
| 13 | Perplexity référencement entreprise | I | Article pilier 7 |
| 14 | Google AI Overviews commerce local | I | Article pilier 8 |
| 15 | meilleur restaurant Paris ChatGPT / « ChatGPT recommande quel restaurant » | I/L : curiosité, bon pour la presse locale | Page métier restaurant + étude |

À valider par Search Console et un outil gratuit (Google Keyword Planner via compte Ads, ou Google Trends pour la comparaison relative entre « GEO » et « référencement IA »). Hypothèse non vérifiée : « référencement IA » est plus recherché par les non-spécialistes que « GEO ».

## 5. Gabarit d'une page métier × ville

URL : `/visibilite-ia/plombier/paris-11e`
Rendu : Next.js, rendu serveur (le contenu doit être dans le HTML initial, pas chargé côté client). `generateStaticParams` limité aux couples éligibles ; les autres répondent en rendu dynamique avec `noindex`.

**Éligibilité à l'indexation** (calculée côté serveur)
- `audit_count >= 5` sur 12 mois, ET au moins 3 requêtes distinctes testées, ET `last_updated` de moins de 90 jours → `index, follow`.
- Entre 1 et 4 audits : la page s'affiche avec un bloc « données en cours de collecte », en `noindex, follow`, avec canonical vers la page métier.
- 0 audit : renvoie une 302 vers `/visibilite-ia/[metier]`, ou 404 si le couple n'est pas dans la liste.

**Sections (ordre fixe, la donnée en premier)**
1. **H1** : « Plombier à Paris 11e : sont-ils visibles sur ChatGPT, Gemini et Perplexity ? » Sous-titre avec base et date : « Sur 14 audits réalisés du 2 au 31 octobre 2026. »
2. **Chiffres clés** (bloc de 4 : score moyen, % jamais cité, IA la plus sévère, écart vs national). Chaque chiffre avec sa définition au survol.
3. **Ce que répondent les IA** : 2 à 3 extraits courts de vraies réponses à « meilleur plombier Paris 11e », sans nom d'établissement audité.
4. **Qui est cité à la place** : top 3 des concurrents cités (seuil de 3 audits) avec le nombre de fois cité. Note de lecture.
5. **Par IA** : tableau ChatGPT / Gemini / Perplexity (/ Claude) : score moyen et part de réponses citant au moins un plombier du 11e.
6. **Par quartier** (si ≥ 3 audits par quartier) : Bastille, Oberkampf, Voltaire, Charonne. Sinon section masquée, pas de remplissage.
7. **Éditorial humain** (100 à 150 mots, écrit à la main pour les couples prioritaires, sinon section absente) : ce qu'on a remarqué, un exemple.
8. **Que faire pour remonter** : 3 actions concrètes, **les mêmes que celles des plans d'action**, choisies selon la source dominante mesurée (par exemple : « dans le 11e, les IA citent surtout des annuaires : voici lesquels »).
9. **CTA** : « Testez votre plomberie en 2 minutes. » Audit gratuit.
10. **FAQ** (4 à 5 questions, section 5.2).
11. **Maillage** : 3 à 6 liens (section 6).
12. **Méthode et mise à jour** : lien vers `/methodologie`, date de dernière mise à jour, limites (échantillon, nombre de passes).

### 5.1 Données dynamiques (contrat JSON passé à la page)
```ts
interface SeoPageData {
  trade: { slug: string; nom: string; nomPluriel: string };
  city: { slug: string; nom: string; quartiers: string[] };
  stats: { auditCount: number; avgScore: number; medianScore: number; zeroVisibilityShare: number;
           harshestProvider: { id: ProviderId; avgScore: number } | null;
           friendliestProvider: { id: ProviderId; avgScore: number } | null;
           deltaVsNational: number; deltaVsCity: number | null; trend90d: number | null;
           topCompetitors: { name: string; auditsCiting: number }[];      // seuil >= 3
           topSources: { type: string; share: number }[];
           byProvider: { id: ProviderId; avgScore: number; mentionRate: number }[];
           byDistrict: { name: string; auditCount: number; avgScore: number }[]; // seuil >= 3
           periodStart: string; periodEnd: string; lastUpdated: string };
  editorial?: string;      // 100-150 mots écrits à la main, optionnel
  indexable: boolean;
}
```

### 5.2 FAQ (la réponse contient toujours un chiffre local, sinon la question est supprimée)
1. « Les plombiers du Paris 11e apparaissent-ils sur ChatGPT ? » → « Sur {auditCount} audits, {100 - zeroVisibilityShare} % ont été cités au moins une fois. »
2. « Quelle IA cite le moins les plombiers du Paris 11e ? » → `harshestProvider`.
3. « Comment un plombier peut-il être recommandé par ChatGPT à Paris 11e ? » → 3 actions, source dominante mesurée.
4. « Comment est calculé le score ? » → renvoi vers `/methodologie`.
5. « Ces données concernent-elles tous les plombiers ? » → non, échantillon d'établissements audités, limites.

### 5.3 schema.org (JSON-LD, uniquement ce qui est visible sur la page)
- `BreadcrumbList` : Accueil > Visibilité IA > Plombier > Paris 11e.
- `FAQPage` pour la FAQ ci-dessus. Attention : Google a fortement réduit l'affichage des résultats enrichis FAQ ; on le garde pour la cohérence de structure, sans en attendre un gain visible.
- `Dataset` ou `Article` (choisir `Article`, plus sûr) avec `dateModified` = `last_updated`, `author` = `Organization` AuditIA Local, `about` = le métier.
- `Organization` (site entier, sur la page d'accueil et `/a-propos`) avec `sameAs`.
- **Interdits** : `LocalBusiness`, `AggregateRating` ou `Review` pour des commerces tiers (nous ne sommes pas ce commerce ; risque d'action manuelle). Pas de balisage `Product` sur des audits.
- Rappel (guide Google, mai 2026) : le JSON-LD n'est pas requis pour les fonctionnalités IA. Il sert à la lisibilité et aux fils d'Ariane.

## 6. Règles techniques

**Sitemap**
- `sitemap.xml` en index : `sitemap-pages.xml` (statiques, métiers, blog) et `sitemap-seo-[n].xml` (pages métier × ville éligibles seulement, 500 URL max par fichier).
- Ne jamais lister une page `noindex`. `lastmod` = date réelle du dernier audit pris en compte, jamais la date du build.
- Régénération quotidienne par Vercel Cron (après le cron d'audit mensuel).

**Canonical**
- Chaque page : canonical auto-référent, absolu, sans paramètres, en minuscules, sans slash final.
- Les variantes (`?utm=`, `?ville=`) : canonical vers l'URL propre.
- Pages sous le seuil : `noindex, follow` + canonical vers la page métier.

**noindex et suppression**
- Pas d'indexation sans données : règle d'éligibilité de la section 5. Un couple qui retombe sous le seuil (peu d'audits récents) repasse en `noindex` après 90 jours sans mise à jour, avec 302 vers la page métier plutôt qu'un 404 si la page avait été indexée.
- Fusion : si deux villes voisines (par exemple deux arrondissements) ont chacune moins de 5 audits, on ne les indexe pas séparément ; on les regroupe dans la page ville.
- Toujours en `noindex` : `/rapport/*`, `/app/*`, `/api/*`, `/audit?*`, pages de remerciement, résultats de recherche internes.
- `robots.txt` : autoriser GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-SearchBot, PerplexityBot, Google-Extended (nous voulons être cités). Disallow `/api/`, `/app/`, `/rapport/`.

**Maillage interne** (3 à 6 liens fondés sur des relations réelles)
- Page métier × ville → page métier nationale ; même métier dans 2 à 3 villes voisines **ayant des données** ; 2 métiers proches dans la même ville (plombier ↔ chauffagiste, serrurier ↔ électricien) ; 1 article pilier pertinent.
- Page métier → top 5 villes par nombre d'audits (pas la liste complète).
- Articles de blog → pages métier concernées ; pages métier → articles piliers.
- Jamais de bloc de pied de page avec 700 liens identiques.

**Performance et rendu**
- HTML complet côté serveur, pas de contenu dans des onglets chargés en JS. Core Web Vitals verts (LCP < 2,5 s). Pas de popup bloquante.
- Pas de graphique en image seule : un tableau HTML accompagne chaque graphique (les IA lisent le texte).
- Titres : `<title>` ≤ 60 caractères, avec le chiffre local si existant (« Plombier Paris 11e : score IA moyen 38/100 (14 audits) »). Meta description avec la date.
- `hreflang` inutile (français uniquement). `lang="fr"`.

**Déploiement progressif** (recommandé par les sources)
1. Semaines 1 à 4 : hub, 20 pages métier, `/methodologie`, 3 articles, 5 pages métier × Paris écrites à la main (même avec peu d'audits, en `noindex` tant que le seuil n'est pas atteint).
2. Semaine 4 à 8 : lecture Search Console (impressions, pages découvertes non indexées). Seulement ensuite, ouvrir les couples éligibles par lots d'environ 20 à 50 selon l'indexation observée.
3. Surveiller le ratio « explorée, actuellement non indexée » : s'il dépasse 40 % sur un lot, arrêter d'élargir et enrichir les pages existantes.

## 7. 10 articles de blog piliers

Chaque article : 1 500 à 2 500 mots, au moins une donnée propre (audit, test, captures de réponses), un tableau, une définition claire en début, une date de mise à jour, un auteur nommé, des sources. Pas de remplissage (les sources n'établissent pas de longueur idéale ; viser la complétude).

| # | Titre de travail | Mot-clé principal | Contenu propre |
|---|---|---|---|
| 1 | Comment apparaître dans ChatGPT quand on est un commerce local | apparaître dans ChatGPT | Méthode en 7 étapes ; test avant/après sur un commerce partenaire |
| 2 | Visibilité ChatGPT : comment savoir si votre entreprise est citée (et mesurer) | visibilité ChatGPT | Notre protocole : requêtes, nombre de passes, limites |
| 3 | Référencement IA : ce qui change pour une TPE (et ce qui ne change pas) | référencement IA | Position nuancée : Google dit que c'est du SEO ; données Ahrefs (12 % de recouvrement avec le top 10) |
| 4 | GEO, c'est quoi ? L'explication sans jargon | GEO | Glossaire GEO / SEO / AEO ; ce que les études prouvent (et celles qui ne prouvent rien) |
| 5 | ChatGPT recommande vos concurrents : que faire ? | ChatGPT recommande mes concurrents | Analyse des concurrents cités dans nos audits (agrégée) |
| 6 | SEO local et IA : fiche Google, avis, annuaires, cohérence des informations | SEO local IA | Quelles sources les IA citent le plus pour 5 métiers (données d'audit) |
| 7 | Perplexity et les commerces : pourquoi il cite des sources différentes de ChatGPT | Perplexity référencement | Comparaison mesurée entre IA sur les mêmes requêtes |
| 8 | Google AI Overviews et recherche locale : ce que Google dit vraiment | Google AI Overviews commerce local | Résumé du guide officiel de mai 2026, avec ses limites |
| 9 | Outils de suivi de visibilité IA : comparatif honnête pour une TPE | outil visibilité IA | Grille de critères et prix publics, nos limites déclarées. Vérifier chaque tarif avant publication |
| 10 | Étude : à quel point les commerces parisiens sont-ils visibles dans les IA ? | étude visibilité IA commerces Paris | Étude annuelle issue des audits agrégés ; seule pièce « relations presse » ; à publier quand au moins 200 audits |

Ordre de production : 1, 2, 4, 5, 3, 6, 7, 8, 9, 10. L'article 10 dépend des données ; ne pas le publier avant.

## 8. `llms.txt`

À placer dans `app/public/llms.txt`. Aucun gain de référencement attendu (voir section 1). Nous le publions parce qu'il coûte une minute et aide certains agents à naviguer.

```
# AuditIA Local

> AuditIA Local mesure si un commerce ou un artisan local est recommandé par les assistants IA (ChatGPT, Gemini, Perplexity) quand un client demande par exemple « meilleur plombier Paris 11e ». Audit gratuit avec un score de visibilité sur 100, suivi mensuel et plan d'action. Service en français, pour les TPE locales en France.

Les scores publiés sur le site sont des moyennes calculées sur nos audits, avec le nombre d'audits et la période toujours indiqués. Ils ne constituent ni un classement de qualité des commerces, ni un échantillon représentatif du marché.

## Produit
- [Audit gratuit](https://auditia-local.fr/audit): score de visibilité IA sur 100, concurrents cités à votre place
- [Tarifs](https://auditia-local.fr/tarifs): audit gratuit, suivi mensuel, plan d'action
- [Méthodologie](https://auditia-local.fr/methodologie): requêtes testées, nombre de passes, limites

## Données par métier et par ville
- [Visibilité IA par métier](https://auditia-local.fr/visibilite-ia): plombier, électricien, restaurant, coiffeur, dentiste, avocat et 14 autres métiers
- Format des pages : https://auditia-local.fr/visibilite-ia/[metier]/[ville], par exemple /visibilite-ia/plombier/paris-11e

## Guides
- [Blog](https://auditia-local.fr/blog): comment apparaître dans ChatGPT, GEO expliqué simplement, SEO local et IA

## Informations légales
- [À propos](https://auditia-local.fr/a-propos)
- [Mentions légales](https://auditia-local.fr/mentions-legales)
- [Confidentialité](https://auditia-local.fr/confidentialite)

## Optional
- [CGV](https://auditia-local.fr/cgv)
```

Remplacer `auditia-local.fr` par le domaine réel une fois acheté (non décidé à ce jour).

## 9. Mesure et suites

- Search Console dès le jour 1 ; segment par type de page (regex sur `/visibilite-ia/`).
- Chaque mois : nombre de pages éligibles, taux d'indexation, impressions par type de page, requêtes réelles → mises à jour de la liste de mots-clés.
- Mesurer notre propre visibilité IA avec notre propre produit (requêtes « audit visibilité IA », « outil visibilité ChatGPT »). C'est aussi le meilleur contenu de démonstration.
- Risques : (1) pas assez d'audits → peu de pages indexables ; réponse : concentrer l'effort sur Paris et 5 métiers (plombier, restaurant, coiffeur, dentiste, agence immobilière) ; (2) concurrents d'agences GEO déjà installés sur les requêtes génériques ; réponse : viser le long tail métier × ville et la démonstration par la donnée ; (3) publier trop vite et être dégradé : appliquer le calendrier progressif.

## Sources
- [Digital Applied : programmatic SEO après la mise à jour de mars 2026](https://www.digitalapplied.com/blog/programmatic-seo-after-march-2026-surviving-scaled-content-ban)
- [Alex Cloudstar : programmatic SEO 2026](https://alexcloudstar.com/blog/programmatic-seo-2026-indie-hackers/)
- [Frase : guide Google sur l'optimisation pour l'IA](https://www.frase.io/blog/google-ai-optimization-guide)
- [Résumé de l'étude sur 21 000 citations](https://news.lavx.hu/article/what-21-000-ai-citations-reveal-about-generative-engine-optimization)
- [Agence Scroll : GEO et SEO](https://agence-scroll.com/fr/blog/geo-seo-moteurs-ia)
- [PPC Land : adoption de llms.txt](https://ppc.land/llms-txt-adoption-rises-8-8x-but-97-of-files-get-zero-ai-requests/)
- [GEO Toolbox : visibilité IA](https://geotoolbox.ai/fr/blog/visibilite-ia), [JDN : GEO](https://www.journaldunet.com/seo/1555503-geo-comment-suivre-et-optimiser-sa-visibilite-ia/)
