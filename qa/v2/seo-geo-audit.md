# Audit SEO + GEO du site Repéré (V2)

Date : 9 novembre 2026. Périmètre : site public de `/home/claude/auditia/app` (Next.js 15.5, App Router). Audit en lecture seule : aucun fichier de l'app n'a été modifié.

## 0. Conditions de mesure (à lire avant les chiffres)

- Le build indiqué n'était plus utilisable : un `next dev` lancé par un autre agent a réécrit `app/.next` (pas de `BUILD_ID`, les chunks de l'ancien `next start -p 3700` répondent 400). Pour mesurer sans toucher au `.next` partagé, j'ai construit une **copie fantôme isolée** (`scratchpad/seo/shadow` : `src`, `public` et `node_modules` en liens symboliques, `.next` propre, `tsconfig.json` copié) puis lancé `next start -p 4100`. Le serveur 4100 a été arrêté à la fin (`fuser -k 4100/tcp`). Les sources ont été compilées à 12 h 07 : elles incluent les pages ajoutées entre-temps par les autres agents (`/a-propos`, `/geo`, `/glossaire`, `/questions`, `/etudes`, `/comparatif`, `lib/seo/jsonld.ts`).
- Le serveur tournait **sans `NEXT_PUBLIC_SITE_URL`**, comme le ferait une production mal configurée. Cela a révélé le problème T1.
- Outils : crawler maison (BeautifulSoup, 61 pages et 391 pages métier × ville sur un premier passage), Playwright Chromium (mobile 390 px, CPU ×4, latence de 150 ms ; desktop 1 366 px). L'INP ne se mesure pas en labo : il est estimé à partir du JavaScript client.
- Les pages ajoutées par les autres agents sont auditées dans l'état où elles étaient à 12 h 07. Revérifiez-les après leur livraison.

## 1. Scores par axe

| Axe | Score | En une ligne |
|---|---|---|
| Technique | **55/100** | Bonne base (lang fr, slash final en 308, noindex justifiés, un seul h1 par page). Mais les canonicals partent vers localhost si la variable d'env manque, il n'y a aucune image OG, le sitemap contient des pages noindex et n'a pas de vrai lastmod, et le nouveau cluster GEO est orphelin. |
| Performance | **84/100** | LCP en labo < 1 s sur les pages de contenu, CLS ≈ 0, 114 Ko de JS gzip. Points faibles : 5 polices (119 Ko) sans preload, `/tarifs` rendue dynamiquement, `/rapport` à 2,1 s en mobile. |
| Données structurées | **50/100** | `lib/seo/jsonld.ts`, avec des @id stables, est bien conçu mais n'est branché que sur les nouvelles pages. L'accueil, les pages segments, les guides et `/tarifs` n'ont ni Organization ni WebSite, et pas d'Offer. sameAs est vide. Deux helpers de breadcrumb coexistent. |
| GEO (contenu citable) | **66/100** | Points forts : chiffres sourcés, méthode publique, guides avec références numérotées, `/geo`, `/glossaire`, `/questions`. Points faibles : ce cluster n'est relié ni depuis l'accueil, ni par le sitemap, ni par llms.txt ; pas de date visible sur les pages commerciales ; `/a-propos` est indexable avec des [À COMPLÉTER] ; aucune donnée propre publiée pour l'instant. |
| Dogfooding | **10/100** | t.js n'est pas installé sur notre site, aucun business « repere », `/p/repere` renvoie 404, notre JSON-LD n'est pas produit par le module execution. Le snippet de repli de l'app est cassé (`data-k` au lieu de `data-site`). |

## 2. Recherche : ce qui compte en 2026 (synthèse utile au plan)

1. **Google, AI Overviews et AI Mode** : il n'y a ni exigence spéciale, ni balisage dédié, ni « fichier IA » à créer. Il faut une page indexée, éligible à un extrait, crawlable, avec un bon maillage, une bonne expérience de page, le contenu important en texte, et des données structurées **conformes au texte visible**. Google-Extended ne règle que l'entraînement et l'ancrage de Gemini, pas la présence dans Search ni dans les AI Overviews. [S1]
2. **Core Web Vitals** : bon si LCP ≤ 2,5 s, INP ≤ 200 ms et CLS ≤ 0,1, au 75e centile des données terrain. [S2]
3. **Robots** : OpenAI recommande d'autoriser `OAI-SearchBot` ; un site qui le bloque est exclu des réponses de recherche ChatGPT, et un changement est pris en compte en 24 h environ. `GPTBot` (entraînement) est indépendant. `ChatGPT-User` agit à la demande d'un utilisateur : robots.txt peut ne pas s'y appliquer. [S3] Perplexity : `PerplexityBot` (à autoriser pour la recherche) et `Perplexity-User`, qui ignore généralement robots.txt. [S4]
4. **JavaScript** : les robots IA (GPTBot, ClaudeBot, PerplexityBot) n'exécutent pas le JavaScript. Ce qui est rendu côté client leur est invisible. [S5]
5. **llms.txt** : sur 300 000 domaines (SE Ranking, nov. 2025), aucune corrélation avec la fréquence de citation ; Google le dit inutile pour ses fonctions IA. [S6][S1] Le garder pour la cohérence du discours (Repéré le livre à ses clients), mais en faire un fichier **généré**, pas une priorité.
6. **Contenu citable** : l'article GEO (KDD 2024) mesure environ +41 % de visibilité avec l'ajout de citations, +31 % avec des statistiques et +27 % avec des sources citées. [S7] Fraîcheur : sur 17 M de citations (Ahrefs, 2025), ChatGPT cite des pages en moyenne 393 à 458 jours plus récentes que les résultats organiques ; les AI Overviews y sont peu sensibles. [S8]
7. **Entité et marque** : sur 75 000 marques (Ahrefs, 2025), les mentions de la marque sur le web sont le facteur le plus corrélé à la visibilité dans les AI Overviews (ρ = 0,664), loin devant les backlinks (0,218). [S9] Il faut donc un nom, un descripteur et un sameAs cohérents partout, et des données propres reprises par d'autres sites.
8. **schema.org pour un SaaS** : le rich result SoftwareApplication exige `name`, `offers.price` **et** `aggregateRating` ou `review`. [S10] Repéré n'a pas d'avis : il faut donc baliser SoftwareApplication et Offer pour la compréhension, sans espérer de rich result, et surtout sans inventer de note.

---

## 3. Problèmes : liste exhaustive

Gravité : **C** critique · **H** haute · **M** moyenne · **B** basse. Chaque entrée donne la page, la preuve, la gravité et le patch.

### A. Technique

**T1 [C] Canonicals et og:url vers `http://localhost:3000` dès que `NEXT_PUBLIC_SITE_URL` manque.** Toutes les pages sont touchées.
Preuve : sur le build fantôme, la page `/` contient `<link rel="canonical" href="http://localhost:3000"/>`, alors que `/sitemap.xml` sort `https://repere-ia.fr`. En cause, deux replis différents : `src/app/layout.tsx:13` (`|| "http://localhost:3000"`) et `src/lib/seo/index.ts:23` (`?? 'https://repere-ia.fr'`).
Patch `src/app/layout.tsx` :
```diff
-const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
+import { SITE_URL } from "@/lib/seo";
 ...
-  metadataBase: new URL(siteUrl),
+  metadataBase: new URL(SITE_URL),
```
Dans `src/lib/seo/index.ts`, remplacer `??` par `||` pour qu'une chaîne vide retombe aussi sur le domaine :
```diff
-export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://repere-ia.fr').replace(/\/$/, '');
+export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://repere-ia.fr').replace(/\/$/, '');
```
Ajouter un garde-fou au build, en tête de `next.config.ts` : `if (process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV === 'production' && !process.env.NEXT_PUBLIC_SITE_URL) throw new Error('NEXT_PUBLIC_SITE_URL manquant');`.

**T2 [H] Domaine de repli incohérent `app.repere.fr` et snippet cassé.** Concerne l'app, mais le snippet est distribué aux clients.
Preuve : `src/components/app/adapters.ts:175` génère `<script … data-k="…">` avec le repli `https://app.repere.fr`, alors que `public/t.js` lit `s.dataset.site` : le tracking ne part jamais. `src/lib/tracking/index.ts:271` utilise le même repli `app.repere.fr`. `src/lib/tracking/ga4.ts:14` et `src/lib/email.ts:45` se replient sur localhost.
Patch : partout, `import { SITE_URL } from '@/lib/seo'` ; dans `adapters.ts`, renvoyer `snippetFor(businessId)` (de `@/lib/tracking`) au lieu de construire la balise :
```diff
-  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.repere.fr';
-  return `<script async src="${origin.replace(/\/$/, '')}/t.js" data-k="${businessId}"></script>`;
+  return snippetFor(businessId); // data-site, domaine canonique
```
Dans `tracking/index.ts:271` : `const base = SITE_URL;`.

**T3 [H] Aucune image Open Graph et og:title identique sur ~50 pages.**
Preuve : sur toutes les pages hors `/rapport`, `og:image` et `twitter:image` sont absents, et `GET /opengraph-image` renvoie 404. Les pages sans bloc `openGraph` (`/pme`, `/local`, `/e-commerce`, `/tarifs`, `/methode`, `/guides/*`, `/visibilite-ia/*`, `/audit`) héritent de `og:title` « Les IA recommandent. On travaille pour que ce soit vous. » et n'ont pas d'`og:url`. Le merge des métadonnées Next est superficiel : un `openGraph` défini dans le layout n'est jamais complété page par page.
Patch :
1. Créer `src/app/opengraph-image.tsx` (image par défaut, à 1 200 × 630, qui s'applique à toutes les routes enfants) :
```tsx
import { ImageResponse } from 'next/og';
export const alt = 'Repéré, le référencement IA des entreprises françaises';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export default function Image() {
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 80, background: '#3730A3', color: '#fff', fontFamily: 'sans-serif' }}>
      <div style={{ fontSize: 40, opacity: 0.85 }}>Repéré</div>
      <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.05, marginTop: 24 }}>Les IA recommandent. On travaille pour que ce soit vous.</div>
      <div style={{ fontSize: 30, marginTop: 32, opacity: 0.85 }}>Référencement IA (GEO) · ChatGPT · Gemini · Perplexity</div>
    </div>, size);
}
```
2. Créer des images OG par titre de page : `src/app/guides/[slug]/opengraph-image.tsx`, `src/app/visibilite-ia/[metier]/opengraph-image.tsx`, `src/app/geo/opengraph-image.tsx`, `src/app/etudes/[slug]/opengraph-image.tsx`. Même gabarit ; le titre vient de `getGuide(slug).title`, `getTrade(metier).nom`, etc. Pour factoriser : `src/lib/seo/og.tsx` exporte `ogCard(title, kicker)`.
3. Créer `src/lib/seo/meta.ts` et l'utiliser sur **toutes** les pages publiques :
```ts
import type { Metadata } from 'next';
import { abs } from './index';
export function pageMeta(p: { title: string; description: string; path: string; type?: 'website' | 'article'; absoluteTitle?: boolean; noindex?: boolean }): Metadata {
  return {
    title: p.absoluteTitle ? { absolute: p.title } : p.title,
    description: p.description,
    alternates: { canonical: p.path },
    openGraph: { title: p.title, description: p.description, url: abs(p.path), type: p.type ?? 'website', locale: 'fr_FR', siteName: 'Repéré' },
    twitter: { card: 'summary_large_image', title: p.title, description: p.description },
    ...(p.noindex ? { robots: { index: false, follow: true } } : {}),
  };
}
```
Exemple, `src/app/tarifs/page.tsx` :
```diff
-export const metadata: Metadata = {
-  title: "Tarifs",
-  description: "…",
-  alternates: { canonical: "/tarifs" },
-};
+export const metadata = pageMeta({ path: '/tarifs', title: 'Tarifs Repéré : référencement IA dès 29 €/mois', description: 'Test gratuit, Essentiel dès 29 €/mois, Accompagné dès 99 €/mois (on fait le travail). Commerce local, PME, e-commerce. Prix nets, sans promesse de classement.' });
```

**T4 [H] Le nouveau cluster GEO est orphelin : absent du sitemap, de llms.txt, du header, du footer et de l'accueil.**
Pages : `/a-propos`, `/geo`, `/glossaire`, `/questions`, `/etudes`, `/etudes/*`, `/comparatif`.
Preuve : ces pages ne sont liées qu'entre elles (inlinks = les 6 autres) ; un parcours depuis `/` ne les atteint pas (profondeur = ∞) ; `sitemap.ts` (modifié à 11 h 05) ne les liste pas ; `public/llms.txt` non plus. Les guides sont à une profondeur de 3 et ne sont liés ni par le footer ni par l'accueil.
Patch `src/components/site/Footer.tsx` :
```diff
   {
     title: "Repéré",
     links: [
       { href: "/audit", label: "Test gratuit" },
       { href: "/tarifs", label: "Tarifs" },
       { href: "/methode", label: "Méthode" },
-      { href: "/visibilite-ia", label: "Guides par métier" },
+      { href: "/a-propos", label: "À propos" },
+      { href: "/comparatif", label: "Comparatif" },
       { href: "/app", label: "Connexion" },
     ],
   },
+  {
+    title: "Ressources",
+    links: [
+      { href: "/geo", label: "Qu'est-ce que le GEO ?" },
+      { href: "/guides", label: "Guides" },
+      { href: "/questions", label: "Questions fréquentes" },
+      { href: "/glossaire", label: "Glossaire" },
+      { href: "/etudes", label: "Études et baromètre" },
+      { href: "/visibilite-ia", label: "Visibilité IA par métier" },
+    ],
+  },
```
Passer la grille en `sm:grid-cols-4`. Dans `Header.tsx`, ajouter à `LINKS` : `{ href: "/geo", label: "Le GEO" }` ou un menu « Ressources ». Sur l'accueil (`src/app/page.tsx`), sous la FAQ, ajouter un lien « Toutes les réponses : /questions » et, dans la réponse « Qu'est-ce que le référencement IA ? », un lien vers `/geo`.

**T5 [H] Le sitemap contient des pages noindex et un lastmod fictif.**
Preuve : `/mentions-legales`, `/cgv` et `/confidentialite` (en `noindex, follow`) figurent dans `/sitemap.xml`. Le lastmod de toutes les pages statiques vaut `2026-11-09T11:07:53.569Z`, soit la date du build ; Google ignore un lastmod qui n'est pas fiable.
Patch `src/app/sitemap.ts` :
```diff
-  const now = new Date();
-  const staticPages = [
-    '', '/local', '/pme', '/e-commerce', '/audit', '/tarifs', '/visibilite-ia', '/guides', '/methode',
-    '/mentions-legales', '/cgv', '/confidentialite',
-  ];
-  const entries: MetadataRoute.Sitemap = staticPages.map((p) => ({ url: `${SITE_URL}${p}`, lastModified: now }));
+  // Date réelle de dernière modification éditoriale (à mettre à jour avec le contenu). Jamais de page noindex ici.
+  const entries: MetadataRoute.Sitemap = Object.entries(PAGE_UPDATED).map(([p, d]) => ({ url: `${SITE_URL}${p}`, lastModified: new Date(d) }));
```
Créer `src/lib/seo/updated.ts` :
```ts
/** Dates de dernière modification réelle des pages statiques (ISO). Source unique : sitemap, JSON-LD dateModified, mention « Mis à jour le ». */
export const PAGE_UPDATED: Record<string, string> = {
  '/': '2026-11-09', '/local': '2026-11-09', '/pme': '2026-11-09', '/e-commerce': '2026-11-09',
  '/audit': '2026-11-09', '/tarifs': '2026-11-09', '/methode': '2026-11-09', '/guides': '2026-11-09',
  '/visibilite-ia': '2026-11-09', '/a-propos': '2026-11-09', '/geo': '2026-11-09', '/glossaire': '2026-11-09',
  '/questions': '2026-11-09', '/comparatif': '2026-11-09', '/etudes': '2026-11-09',
};
```
Ajouter les études (`ETUDES.map`) avec leur propre date, puis `/p/repere` (voir D2). Retirer les pages légales : elles restent en noindex tant qu'elles contiennent des placeholders.

**T6 [H] `/rapport/` est bloqué dans robots.txt, ce qui casse les aperçus de partage et cache le noindex.**
Preuve : `robots.ts` contient `DISALLOW = ['/api/', '/app/', '/rapport/']`. Les rapports se partagent (`ShareButtons`) et disposent d'une `opengraph-image`, mais LinkedInBot et Twitterbot respectent robots.txt : pas de carte de prévisualisation. Google ne peut pas lire le `noindex` d'une URL bloquée et peut l'indexer « sans contenu » quand elle est partagée.
Patch `src/app/robots.ts` : `const DISALLOW = ['/api/', '/app/', '/admin'];`. Dans `next.config.ts`, ajouter un en-tête :
```diff
       { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
+      { source: "/rapport/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
+      { source: "/app/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
+      { source: "/(merci|desinscription)", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
```
Attention : un X-Robots-Tag sur `/rapport/:path*` s'applique aussi à `/rapport/x/opengraph-image`. C'est sans effet pour les réseaux sociaux, qui ne lisent pas cet en-tête.

**T7 [M] robots.txt incomplet face aux agents IA de 2026.**
Preuve : la liste `AI_BOTS` ne contient pas `Perplexity-User`, `Applebot-Extended`, `MistralAI-User` (Le Chat, acteur français), `DuckAssistBot`, `CCBot` ni `Bingbot` (moteur de Copilot, couvert par `*` mais à nommer, puisque nous recommandons ce réglage).
Patch `src/app/robots.ts` :
```diff
-const AI_BOTS = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'PerplexityBot', 'Google-Extended'];
+// Recherche et réponses en temps réel (à autoriser pour être cité) puis entraînement (choix assumé : autorisé).
+const AI_BOTS = [
+  'OAI-SearchBot', 'ChatGPT-User', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Perplexity-User',
+  'MistralAI-User', 'DuckAssistBot', 'Bingbot', 'Applebot',
+  'GPTBot', 'ClaudeBot', 'Google-Extended', 'Applebot-Extended', 'CCBot',
+];
```
Documenter ce choix sur `/methode` ou `/geo` (« ce que nous faisons sur notre propre site »).

**T8 [M] Titles hors de la plage 50-60 caractères (34 pages indexables) et fautes d'accord.**
Preuve : voir le tableau ci-dessous. Les titles des pages métier contiennent « agences immobilières recommandés », « auto-écoles recommandés », « instituts de beauté recommandés » ; celui de `/visibilite-ia/pme/esn` donne « Visibilité IA : esn et services numériques… », à cause de `c.name.toLowerCase()`.

| Page | Long. | Title proposé (avec « \| Repéré » quand il n'est pas absolu) |
|---|---|---|
| `/` | 71 | `Référencement IA (GEO) : être cité par ChatGPT \| Repéré` (absolu, 52) |
| `/pme` | 80 | `Référencement IA des PME : être cité par ChatGPT \| Repéré` (absolu, 54) |
| `/local` | 79 | `Artisans et commerces : être recommandé par ChatGPT \| Repéré` (58) |
| `/e-commerce` | 76 | `E-commerce : faire recommander vos produits par l'IA \| Repéré` (58) |
| `/tarifs` | 15 | `Tarifs du référencement IA : dès 29 €/mois \| Repéré` (51) |
| `/audit` | 45 | `Audit de visibilité IA gratuit : ChatGPT, Gemini \| Repéré` (56) |
| `/methode` | 72 | `Méthode : comment Repéré mesure la visibilité IA` (+ suffixe = 57) |
| `/guides` | 68 | `Guides pratiques du référencement IA (GEO)` (+ suffixe = 51) |
| `/guides/ia-disent-des-choses-fausses` | 74 | `Quand l'IA dit des choses fausses sur vous` (+ suffixe = 51), le h1 restant long |
| `/guides/apparaitre-dans-chatgpt-pme` | 61 | `Apparaître dans ChatGPT quand on est une PME` (+ suffixe = 53) |
| `/visibilite-ia/pme` | 80 | `Visibilité IA par secteur B2B : sources et leviers` (+ suffixe = 59). Cela supprime aussi la cannibalisation avec `/pme` (T9). |
| `/visibilite-ia/e-commerce` | 71 | `Visibilité IA par catégorie e-commerce` (+ suffixe = 47) |
| `/visibilite-ia/[metier]` | 60-71 | gabarit `${cap(nom_pluriel)} : qui ChatGPT recommande-t-il ?`, ex. « Plombiers : qui ChatGPT recommande-t-il ? \| Repéré » (50) |
| `/visibilite-ia/pme/[categorie]` | 78-93 | `${c.name} : visibilité dans ChatGPT et sources citées` sans `toLowerCase()` |
| `/a-propos` | 76 | `À propos de Repéré, référencement IA français` (+ suffixe = 54) |
| `/geo` | 80 | `GEO (référencement IA) : définition et leviers` (+ suffixe = 55) |
| `/questions` | 76 | `Référencement IA : 25 questions, 25 réponses` (+ suffixe = 53) |
| `/comparatif` | 82 | `Repéré vs Peec, Otterly, agences GEO : comparatif` (+ suffixe = 58) |
| `/etudes/ce-que-nous-savons-deja` | 89 | `Recherche IA en France : ce que disent les études` (+ suffixe = 58) |
| `/etudes/barometre-visibilite-ia` | 72 | `Baromètre de la visibilité IA en France` (+ suffixe = 48) |
| `/etudes` | 70 | `Études sur la visibilité IA en France` (+ suffixe = 46) |

Patch `src/app/visibilite-ia/[metier]/page.tsx:22` :
```diff
-    title: `Visibilité IA : ${t.nom_pluriel.toLowerCase()} recommandés par ChatGPT ?`,
+    title: `${t.nom_pluriel} : qui ChatGPT recommande-t-il ?`,
```
Patch `src/lib/seo/segment-pages.tsx:71` :
```diff
-    title: `Visibilité IA : ${c.name.toLowerCase()}, questions types et sources citées`,
+    title: `${c.name} : visibilité dans ChatGPT et sources citées`,
```
Patch `src/app/layout.tsx`, title par défaut hérité de la V1 (orienté commerce local) :
```diff
-    default: "Repéré : votre commerce est-il recommandé par ChatGPT ?",
+    default: "Repéré, le référencement IA des entreprises françaises",
```

**T9 [M] Cannibalisation `/pme` ↔ `/visibilite-ia/pme`** (et dans une moindre mesure `/e-commerce` ↔ `/visibilite-ia/e-commerce`).
Preuve : même title de base, « Référencement IA pour PME : être cité par ChatGPT, Gemini et Perplexity », dans `src/app/pme/page.tsx:8` et `src/lib/seo/segment-pages.tsx:15`.
Patch : appliquer les titles de T8. Le h1 de `/visibilite-ia/pme` devient « Visibilité IA des PME par secteur : questions, sources, leviers », et un lien en tête renvoie vers `/pme` (« Notre offre pour les PME »).

**T10 [M] Les pages noindex ont un canonical qui pointe vers une autre URL** : 391 pages métier × ville et 10 pages catégorie PME ou e-commerce.
Preuve : sur `/visibilite-ia/plombier/paris-11e`, on trouve `robots=noindex, follow` avec `canonical=/visibilite-ia/plombier`. Google déconseille de combiner noindex et canonical vers une autre URL (signaux contradictoires).
Patch : dans `src/app/visibilite-ia/[metier]/[ville]/page.tsx:36` et `segment-pages.tsx:74`, utiliser un canonical auto-référent dans tous les cas :
```diff
-    alternates: { canonical: indexable ? pairPath(t, c) : tradePath(t) },
+    alternates: { canonical: pairPath(t, c) },
```
Réduire aussi le budget de crawl : sur la page métier, lier 6 villes (Paris et les 5 plus grandes) au lieu de 25 tant qu'aucune n'est indexable.

**T11 [M] Page 404 en anglais, sans navigation.**
Preuve : `GET /existe-pas` renvoie le title « 404: This page could not be found. » ; il n'y a pas de `src/app/not-found.tsx`.
Patch : créer `src/app/not-found.tsx`, avec `PageShell`, le h1 « Page introuvable », des liens vers `/`, `/audit`, `/guides`, `/questions`, et `export const metadata = { title: 'Page introuvable', robots: { index: false } }`.

**T12 [M] Descriptions par défaut dupliquées** : 7 pages (`/cgv`, `/confidentialite`, `/mentions-legales`, `/merci`, `/desinscription`, `/rapport/demo`).
Preuve : elles reprennent la description du layout.
Patch : ajouter une `description` propre dans les 3 pages légales (les autres sont noindex, et c'est sans importance).

**T13 [B] Hiérarchie des titres.**
Preuve : `/tarifs` passe de h1 à h3 (onglets de `PricingExplorer`) ; le footer emploie des `h2` (« Solutions », « Repéré », « Légal ») sur toutes les pages, ce qui pollue le plan de chaque page.
Patch : dans `Footer.tsx`, `<h2 className="font-display …">` devient `<p className="font-display …" role="heading" aria-level={2}>`, ou mieux, un simple `<p>`, puisque `nav aria-label` suffit. Dans `PricingExplorer.tsx`, ajouter un `<h2 className="sr-only">Nos offres {segment}</h2>` avant les cartes.

**T14 [B] Faute visible, reprise dans le JSON-LD de l'accueil.**
Preuve : la FAQ de `src/app/page.tsx` contient « Que devenez-vous de mes données ? ».
Patch : `q: "Que deviennent mes données ?"`.

**T15 [B] hreflang.** Le site est monolingue : `lang="fr"` et `og:locale fr_FR` suffisent. Ne pas ajouter de hreflang (Google ne l'exige que pour les variantes linguistiques).

**T16 [Info, vérifié OK]** Un seul h1 sur chaque page (100 %). Aucune `<img>` sans `alt` (le site n'utilise que du SVG inline). `/pme/` renvoie un 308 vers `/pme`. Les pages métier inconnues (`/visibilite-ia/medecin`) renvoient 404. Les métiers réglementés sont exclus. `/merci` et `/desinscription` sont en `noindex, nofollow`. L'espace `/app` est en noindex dans son layout. `/rapport/*` est en `noindex, nocache`. Aucun lien interne cassé avec les sources actuelles : les 404 de guides observés sur l'ancien serveur 3700 venaient d'un build périmé.

### B. Performance

Mesures sur le build de production fantôme. Mobile : CPU ×4, latence 150 ms. Les tailles sont compressées.

| Page | LCP mobile | LCP desktop | CLS | JS | Polices | Total | Élément LCP |
|---|---|---|---|---|---|---|---|
| `/` | 0,95 s | 0,48 s | 0 | 114 Ko | 119 Ko (5 fichiers) | 284 Ko | h1 (Bricolage 700) |
| `/pme` | 0,81 s | 0,26 s | 0 / 0,018 | 114 Ko | 119 Ko | 292 Ko | p hero / h1 |
| `/tarifs` | 0,74 s | 0,29 s | 0 | 128 Ko | 119 Ko | 304 Ko | p hero |
| `/guides/apparaitre-dans-chatgpt-pme` | 0,61 s | 0,21 s | 0 | 114 Ko | 119 Ko | 292 Ko | premier paragraphe |
| `/geo` | 0,69 s | 0,16 s | 0 | 114 Ko | 119 Ko | 303 Ko | définition |
| `/rapport/demo-1` | **2,08 s** (6,9 s à froid) | 0,62 s | 0,001 | 114 Ko | 119 Ko | 315 Ko (HTML de 58 Ko gzip, 245 Ko brut) | p « shock » |
| `/audit` | 0,60 s | 0,22 s | 0 | 127 Ko | 72 Ko | 252 Ko | texte du formulaire |

JS partagé : 102 Ko (React et Next). Le JS client propre au site reste faible : `Header` (en `use client`, 202 lignes), `PricingExplorer` (442), `AuditForm` (800) et les composants du rapport. Le risque INP est faible ; le seul point à surveiller est le changement d'onglet de `/tarifs`.

**P1 [M] 5 fichiers de police (119 Ko) sans preload ni métriques de repli.** Sur l'accueil et `/tarifs`, l'élément LCP est un h1 en Bricolage. `font-display: swap` sans `size-adjust` produit un repaint du LCP et un micro-CLS (0,018 mesuré sur `/pme`, en desktop).
Preuve : `layout.tsx` importe `@fontsource/inter/latin-{400,500,600}.css` et `@fontsource/bricolage-grotesque/latin-{600,700}.css`. Les objets `bricolage`/`inter` sont factices (`{ variable: "font-vars" }`).
Patch : passer à `next/font/local` (toujours auto-hébergé, donc compatible RGPD), avec preload et `adjustFontFallback` automatiques. Copier 4 woff2 dans `src/app/fonts/` (supprimer Inter 500 si `font-medium` peut passer à 400 ou 600 ; sinon garder 5 fichiers, mais seuls 2 sont préchargés) :
```tsx
import localFont from 'next/font/local';
const inter = localFont({ src: [
  { path: './fonts/inter-latin-400-normal.woff2', weight: '400' },
  { path: './fonts/inter-latin-600-normal.woff2', weight: '600' },
], variable: '--font-sans', display: 'swap' });
const bricolage = localFont({ src: [
  { path: './fonts/bricolage-grotesque-latin-700-normal.woff2', weight: '700' },
  { path: './fonts/bricolage-grotesque-latin-600-normal.woff2', weight: '600', preload: false },
], variable: '--font-display', display: 'swap' });
// <html lang="fr" className={`${bricolage.variable} ${inter.variable}`}>
```
Dans `globals.css`, ne plus fixer `--font-sans` et `--font-display` en dur, ou s'appuyer sur les variables injectées.

**P2 [M] `/tarifs` est rendue dynamiquement (ƒ, `Cache-Control: private, no-store`) parce qu'elle lit `searchParams`.** Il n'y a ni cache CDN ni rendu statique, et le TTFB se dégrade sous charge.
Patch : rendre la page statique ; `PricingExplorer` lit `useSearchParams()` côté client, dans un `<Suspense>`, avec `initial="pme"` par défaut. Voir aussi G3 : toutes les grilles doivent figurer dans le HTML.

**P3 [B] `/rapport/[id]` : 245 Ko de HTML brut, et un LCP mobile de 2,1 s à chaud (6,9 s à froid).** Ce n'est pas un enjeu SEO (noindex), mais c'est la page partagée.
Patch : à faire dans un lot dédié à la page rapport. Les sections sous la ligne de flottaison (matrice des requêtes, réponses complètes) passent dans un `<details>`, ou sont chargées à la demande via une route. Ajouter un `loading.tsx` léger (il existe déjà, à vérifier).

**P4 [B] `Header` est entièrement en `use client`.** Toute la navigation est hydratée pour gérer deux menus.
Patch : garder `Header` en composant serveur (logo, liens, CTA) et n'extraire que `MobileMenu` et `SolutionsMenu` en composants clients. Gain estimé : quelques Ko et moins d'hydratation sur toutes les pages.

### C. Données structurées

Inventaire, sur le build du 9 novembre à 12 h 07 :

| Page | Blocs JSON-LD | Problèmes |
|---|---|---|
| `/` | FAQPage | pas d'Organization, de WebSite ni de WebPage ; FAQ sans `@id` |
| `/pme`, `/local`, `/e-commerce` | FAQPage | pas de WebPage, de Service ni de breadcrumb ; pas d'`@id` |
| `/tarifs` | FAQPage | **aucune Offer** ni SoftwareApplication |
| `/methode` | BreadcrumbList (sans `@id`) | pas d'Article ni de TechArticle (ce contenu de méthode, versionné, s'y prête) |
| `/guides` | BreadcrumbList | pas de CollectionPage ni d'ItemList |
| `/guides/[slug]` | BreadcrumbList + Article | pas de `datePublished` ni d'`image` ; `author` et `publisher` en objets inline (`name`, `url`) au lieu de `@id` ; `mainEntityOfPage` est une chaîne |
| `/visibilite-ia/[metier]`, catégories | BreadcrumbList + FAQPage + Service | `Service.provider` inline, sans `@id` |
| `/a-propos` | @graph Organization + WebSite + AboutPage + BreadcrumbList | correct ; il manque Person, `sameAs`, `address`, `identifier` (SIREN) |
| `/geo` | @graph WebPage + Article + FAQPage + BreadcrumbList + Organization | correct |
| `/glossaire` | @graph WebPage + DefinedTermSet + BreadcrumbList | correct |
| `/questions` | @graph WebPage + FAQPage + BreadcrumbList | correct |
| `/comparatif` | @graph WebPage + Article + FAQPage + BreadcrumbList | correct (`citation` présent) |
| `/etudes/*` | @graph WebPage + Report + BreadcrumbList | ajouter Dataset quand les données seront publiées |
| `/p/[slug]` | graphe du module execution | `/p/repere` n'existe pas (D2) |

**S1 [H] Pas d'Organization ni de WebSite sur l'accueil.** C'est pourtant la page qui porte l'entité.
Patch `src/app/page.tsx` : remplacer `<FaqJsonLd items={FAQ} />` par :
```tsx
import { JsonLd } from '@/lib/seo/shell';
import { graph, organizationLd, websiteLd, webPageLd, faqPageLd } from '@/lib/seo/jsonld';
// …
<JsonLd data={graph([
  organizationLd({ withContext: false }),
  websiteLd({ withContext: false }),
  { ...webPageLd('/', { name: 'Repéré, le référencement IA des entreprises françaises', description: metadata.description as string, dateModified: PAGE_UPDATED['/'] }, { withContext: false }), about: { '@id': ORG_ID } },
  faqPageLd('/', FAQ, { withContext: false }),
])} />
```
Retirer `breadcrumb: { '@id': … }` de `webPageLd` quand la page n'a pas de BreadcrumbList : l'accueil n'en a pas, et la référence pointerait dans le vide. Patch `jsonld.ts` : ajouter une option `breadcrumb?: boolean`, à `true` par défaut.

**S2 [H] Unifier les helpers JSON-LD : tout passer par `lib/seo/jsonld.ts`, avec des @id stables.**
Fichiers : `src/lib/seo/index.ts` (`breadcrumbLd`, `faqLd`, `serviceLd`), `src/components/site/blocks.tsx` (`FaqJsonLd`), `src/app/guides/[slug]/page.tsx`, `src/app/guides/page.tsx`, `src/app/methode/page.tsx`, `src/app/visibilite-ia/**`, `src/lib/seo/segment-pages.tsx`, `src/lib/seo/segments.ts` (`categoryServiceLd`).
Patch `serviceLd` (`index.ts`) :
```diff
-    provider: { '@type': 'Organization', name: BRAND, url: SITE_URL },
+    '@id': `${abs(path)}#service`,
+    provider: { '@id': `${SITE_URL}/#organization` },
```
Même chose dans `categoryServiceLd`. Patch de l'Article du guide :
```diff
-  const articleLd = { '@context': 'https://schema.org', '@type': 'Article', headline: g.title, … author: { '@type': 'Organization', name: BRAND, url: SITE_URL }, publisher: { … } };
+  const ld = graph([
+    webPageLd(path, { name: g.title, description: g.description, dateModified: g.updated }, { withContext: false }),
+    { ...articleLd({ path, headline: g.title, description: g.description, datePublished: g.published ?? g.updated, dateModified: g.updated, wordCount: guideWordCount(g), citation: g.sources.map((s) => s.url), withContext: false }), image: abs(`${path}/opengraph-image`) },
+    breadcrumbListLd(path, [{ name: 'Accueil', path: '/' }, { name: 'Guides', path: '/guides' }, { name: g.title, path }], { withContext: false }),
+  ]);
```
Ajouter `published: string` à l'interface `Guide` (`guides.ts`). `FaqJsonLd` (`blocks.tsx`) devient un mince wrapper de `faqPageLd(path, items)` et prend un `path` en prop.

**S3 [H] `/tarifs` : baliser les offres.** Le rich result est impossible sans avis, mais ce balisage sert l'entité et les IA, et il doit correspondre au texte visible (voir G3).
Patch `src/app/tarifs/page.tsx`, à générer depuis `SITE_PLANS` :
```ts
const offers = SITE_PLANS.filter((p) => p.segment !== 'agence' && p.interval !== 'year').map((p) => ({
  '@type': 'Offer', name: `${p.name} (${SEGMENT_LABEL[p.segment]})`, price: (p.priceCents / 100).toFixed(2), priceCurrency: 'EUR',
  ...(p.interval === 'month' ? { priceSpecification: { '@type': 'UnitPriceSpecification', price: (p.priceCents / 100).toFixed(2), priceCurrency: 'EUR', unitCode: 'MON', valueAddedTaxIncluded: false } } : {}),
  url: abs(`/tarifs?segment=${p.segment}`), availability: 'https://schema.org/InStock', seller: { '@id': ORG_ID },
}));
const appLd = { '@type': 'SoftwareApplication', '@id': `${SITE_URL}/#software`, name: 'Repéré', applicationCategory: 'BusinessApplication', operatingSystem: 'Web', inLanguage: 'fr-FR', publisher: { '@id': ORG_ID }, offers };
// <JsonLd data={graph([webPageLd('/tarifs', …), appLd, faqPageLd('/tarifs', FAQ, { withContext: false }), breadcrumbListLd(…)])} />
```
Ne jamais ajouter d'`aggregateRating` tant qu'il n'y a pas de vrais avis recueillis sur le site.

**S4 [H] L'entité Organization est incomplète, et sameAs est vide.**
Preuve : `SAME_AS` est lu depuis `NEXT_PUBLIC_SAME_AS` (non défini) ; `FOUNDER.name` est vide ; ni `address`, ni `legalName`, ni `identifier`.
Patch `src/lib/seo/jsonld.ts`, dans `organizationLd()` :
```ts
...(LEGAL.name ? { legalName: LEGAL.name } : {}),
...(LEGAL.siren ? { identifier: { '@type': 'PropertyValue', propertyID: 'SIREN', value: LEGAL.siren }, taxID: LEGAL.siren } : {}),
...(LEGAL.street ? { address: { '@type': 'PostalAddress', streetAddress: LEGAL.street, postalCode: LEGAL.postalCode, addressLocality: LEGAL.city, addressCountry: 'FR' } } : {}),
...(LEGAL.foundingDate ? { foundingDate: LEGAL.foundingDate } : {}),
```
`LEGAL` est lu depuis les variables d'env, sur le modèle de `FOUNDER` : rien n'est publié tant qu'une valeur est vide. sameAs, à créer puis à renseigner : page LinkedIn de l'entreprise, profil LinkedIn du fondateur (dans Person), fiche `annuaire-entreprises.data.gouv.fr/entreprise/<SIREN>` (source officielle française), Pappers, Crunchbase, chaîne YouTube. Une entrée Wikidata pourra suivre si la notoriété le justifie. Publier aussi le nœud Person (`founderLd()`) sur `/a-propos` dès que le nom est renseigné.

**S5 [M] Deux helpers de breadcrumb coexistent** : `breadcrumbLd` (`index.ts`, sans `@id`) et `breadcrumbListLd` (`jsonld.ts`). Les pages anciennes et nouvelles ne sont donc pas cohérentes.
Patch : supprimer `breadcrumbLd`, `faqLd` et `jsonLdString` en double, et réexporter ceux de `jsonld.ts`. L'item de la page d'accueil dans les breadcrumbs vaut `https://repere-ia.fr/`, alors que le canonical vaut `https://repere-ia.fr` : harmoniser en écrivant `abs('/')`, qui renvoie `SITE_URL + '/'`, et garder la même forme partout (sitemap compris).

**S6 [B] `/methode`** : ajouter un `TechArticle` (`articleLd({ type: 'TechArticle', … })`) avec `dateModified` = date de la dernière version de la méthode (historique déjà présent sur la page) et `version: METHOD_VERSION`.

### D. Dogfooding

**D1 [H] Notre snippet t.js n'est pas installé sur notre site.**
Preuve : aucune référence à `t.js` dans `src/app/**` hors espace `/app`.
Patch :
1. Créer un business « maison » `repere`. Supabase impose des id en uuid, donc on suit le modèle des démos (`DEMO_SLUGS`, `DEMO_TRACK_IDS`). Dans `src/lib/db.ts`, `getBusinessRecord` :
```ts
export const HOUSE_BUSINESS_ID = 'repere';
// en tête de getBusinessRecord(id) :
if (id === HOUSE_BUSINESS_ID) return houseBusinessRecord(); // name 'Repéré', trade 'Logiciel de référencement IA', segment 'pme', website SITE_URL, plan 'accompagne', city 'Paris' [À VÉRIFIER]
```
`isDemoBusinessId('repere')` doit rester `false` : c'est une entreprise réelle, donc indexable.
2. Dans `src/app/layout.tsx`, juste avant `</body>`, sur les pages publiques seulement (l'espace `/app` a son propre layout, mais le snippet doit être exclu de `/app`, `/admin` et `/rapport`) :
```tsx
<Script src="/t.js" data-site="repere" strategy="afterInteractive" />
```
`next/script` transmet bien `data-*` ; `document.currentScript` est défini pour un script `async` chargé par Next, mais **ce point est à tester** (sinon utiliser une balise `<script async src="/t.js" data-site="repere" />` brute). La CSP (`script-src 'self'`, `connect-src 'self'`) l'autorise déjà. `originAllowed('repere', origin)` passera, puisque `website = SITE_URL`.
3. Côté robots, brancher `/api/t/bot` (journal des robots IA) sur notre propre middleware ou dans nos logs Vercel. Nous pourrons alors publier « ce que lisent les robots IA sur repere-ia.fr » : ce sont des données originales pour `/etudes`.

**D2 [H] `/p/repere` renvoie 404.**
Patch : dans `src/lib/execution/repo.ts`, mapper le slug :
```diff
-const DEMO_SLUGS: Record<string, string> = { demo: 'plomberie-martin', 'demo-pme': 'paysia', 'demo-ecom': 'maison-sora' };
+const DEMO_SLUGS: Record<string, string> = { demo: 'plomberie-martin', 'demo-pme': 'paysia', 'demo-ecom': 'maison-sora', repere: 'repere' };
```
Renommer ensuite `DEMO_SLUGS` en `STATIC_SLUGS`, puisqu'il contient un compte réel. Renseigner la fiche de vérité de Repéré par `saveFacts('repere', …)`, ou un repli statique dans `getFacts` pour `repere` : adresse, site, prix (« Essentiel dès 29 €/mois »), services, création, statut, dirigeant. Les mêmes valeurs alimentent `/a-propos`, le footer et llms.txt (**une seule source de vérité**, `src/lib/seo/entity.ts`). Ajouter `/p/repere` au sitemap. Son canonical reste auto-référent ; la page renvoie vers `/a-propos`, et inversement.

**D3 [M] Notre JSON-LD ne passe pas par notre module execution.** Aujourd'hui, `organizationLd()` est rédigé à la main.
Patch : dans `src/app/page.tsx` et `src/app/a-propos/page.tsx`, fusionner les deux sources.
```ts
const exec = await schemaForBusiness('repere'); // @id = https://repere-ia.fr/#organization (même @id que ORG_ID, vérifié dans buildJsonLd)
const org = { ...organizationLd({ withContext: false }), ...(pickOrg(exec)) }; // pickOrg : nœud dont @id === ORG_ID
```
Ou plus simple : faire produire `organizationLd()` à partir de `buildJsonLd(houseBusiness, houseFacts, 'pme')`, puis ajouter `knowsAbout` et `slogan`. Ajouter un test vitest qui vérifie que `@id`, `name`, `url` et `sameAs` sont identiques entre `/api/schema/repere` et le JSON-LD de l'accueil. Cette page devient la démonstration vivante du plugin : « le balisage de cette page est produit par Repéré ».

**D4 [B] Le plugin WordPress (`public/integrations/repere-ia-wordpress.zip`) n'est pas mentionné sur le site.** Lui créer une page de documentation indexable plus tard ; hors périmètre immédiat.

### E. GEO (contenu citable)

| Page | Définition nette en tête | Chiffre sourcé | Réponse directe sous les h2 | Auteur | Date visible | Verdict |
|---|---|---|---|---|---|---|
| `/` | oui (FAQ « Qu'est-ce que le référencement IA ? »), mais en bas de page | oui (FactsRow, sources liées) | partiel (h2 slogans) | non | non | moyen |
| `/pme` `/local` `/e-commerce` | non | oui | non (h2 marketing) | non | non | faible |
| `/tarifs` | — | prix visibles pour **un seul** parcours sans JS | FAQ oui | non | non | faible (G3) |
| `/methode` | oui | formule, poids | oui | non | version, oui ; date, non | bon |
| `/guides/*` | oui (intro) | oui, sources numérotées | h2 en question, partiel | « rédigé avec l'aide d'un outil d'IA », pas de nom | « Sources vérifiées le » (sans `<time>`) | bon |
| `/geo` `/glossaire` `/questions` `/comparatif` | oui | oui | oui (h2 en question) | « L'équipe Repéré » | oui (`<time>`) | très bon, mais orphelin (T4) |
| `/a-propos` | oui | — | oui | placeholders | oui | indexable avec [À COMPLÉTER] (G2) |
| `/etudes/barometre-visibilite-ia` | oui | pas encore de données | oui | équipe | oui | à alimenter (G5) |

**G1 [H] Pas de date de mise à jour visible ni d'auteur sur les pages commerciales et les guides.**
Patch : créer un composant `src/components/site/Byline.tsx` (serveur) :
```tsx
export function Byline({ updated, published }: { updated: string; published?: string }) {
  return <p className="text-sm text-muted">Par <a href="/a-propos">l&apos;équipe Repéré</a>{published && <> · Publié le <time dateTime={published}>{fmtDate(published)}</time></>} · Mis à jour le <time dateTime={updated}>{fmtDate(updated)}</time></p>;
}
```
Le placer sous le h1 de `/guides/[slug]` (en remplaçant la ligne « Sources vérifiées le » par Byline, suivie de cette phrase), de `/methode`, de `/tarifs` (« Prix en vigueur au … ») et des hubs `/visibilite-ia/*`. La date vient de `PAGE_UPDATED` (T5), qui alimente aussi `dateModified`. Une fois le fondateur renseigné, l'auteur des guides devient le fondateur (Person et lien `/a-propos#fondateur`), ce qui apporte un signal E-E-A-T.

**G2 [H] `/a-propos` est indexable alors qu'elle affiche `[À COMPLÉTER : nom du fondateur]`, `[À COMPLÉTER : photo]`, etc.** C'est incohérent avec la règle appliquée aux pages légales, et cela nuit à la page qui porte l'entité.
Patch `src/app/a-propos/page.tsx` : tant que `FOUNDER.name` est vide, **ne pas rendre** la section « Qui a fondé Repéré ? » (plutôt que d'afficher des placeholders) ; la page reste alors indexable. Sinon, ajouter `robots: { index: false, follow: true }` tant que `FOUNDER.name === ''`. Bloquant avant le lancement : nom, parcours vérifiable, LinkedIn, SIREN, adresse (cohérents avec `/mentions-legales`).

**G3 [H] `/tarifs` : sans JavaScript, seuls les prix PME sont dans le HTML.** Les robots IA ne voient donc pas « 29 €/mois », alors que c'est la promesse de la meta description.
Preuve : dans le HTML servi, on trouve uniquement 0 €, 390 €, 99 € et 490 €. `PricingExplorer` ne rend que le segment actif ; les panneaux des autres segments sont `hidden` et vides.
Patch : ajouter, sous `PricingExplorer`, un tableau statique rendu côté serveur, « Tous les prix en un coup d'œil » (`<table>` parcours × offre, généré depuis `SITE_PLANS`, `<caption>` « Prix nets HT, en vigueur au <time> »). Les IA citent volontiers les tableaux, et S3 peut s'y adosser. Autre option : rendre les 4 panneaux dans le HTML et n'en masquer que 3 en CSS (`hidden` côté client après hydratation).

**G4 [M] Descripteur de marque incohérent.**
Preuve, avec les formulations relevées :
- title par défaut : « votre commerce est-il recommandé par ChatGPT ? » (local, V1) ;
- OG du layout : « Le référencement IA clé en main des entreprises françaises » ;
- badge du hero : « Le référencement IA des entreprises françaises » ;
- footer : « le référencement IA des entreprises françaises » ;
- `organizationLd.description` : « service français de référencement IA (GEO) » ;
- llms.txt : « référencement IA clé en main » ;
- `alternateName` : « Repéré IA » ;
- domaines de repli `app.repere.fr` et `repere-ia.fr`.

Patch : créer `src/lib/seo/entity.ts` avec `BRAND = 'Repéré'`, `DESCRIPTOR = 'le référencement IA (GEO) des entreprises françaises'` et `ONE_LINER = 'Repéré est un service français de référencement IA (GEO) : il mesure si ChatGPT, Gemini et Perplexity recommandent une entreprise, explique pourquoi ils citent ses concurrents et fait les corrections, validées par le client.'`. Les importer dans : layout (title par défaut, OG), Footer, `organizationLd`, llms.txt (G6), `/a-propos` (premier paragraphe), `/p/repere`. Placer `ONE_LINER` mot pour mot comme premier paragraphe visible de `/a-propos` et en paragraphe sous le hero de l'accueil.

**G5 [M] Pas encore de données originales publiées.** C'est l'avantage concurrentiel de Repéré : des audits agrégés impossibles à copier.
Constat : `getSeoStats()` et `getSegmentStats()` renvoient `null` ; le baromètre annonce une publication « à partir de 200 audits ».
Patch (contenu et données, pas de code bloquant) :
1. Publier dès maintenant des **chiffres sur notre propre méthode** : nombre de requêtes posées, nombre de réponses analysées, part des réponses sans aucune entreprise citée, domaines les plus cités tous audits confondus (avec k ≥ 5 et sans nom d'entreprise). Tout cela se calcule à partir des audits de prospection déjà lancés (`scripts/batch-audit.ts`). Cible : `/etudes/barometre-visibilite-ia`, section « Premiers chiffres (n = …, du … au …) ».
2. Chaque chiffre est écrit comme une phrase autonome et citable : « Sur 1 240 réponses de ChatGPT, Gemini et Perplexity analysées par Repéré entre le … et le …, 38 % ne citaient aucune entreprise. »
3. Ajouter un `Dataset` (schema.org) avec `temporalCoverage`, `variableMeasured` et `license` (CC BY 4.0, pour encourager la reprise, donc les mentions de marque [S9]).

**G6 [M] llms.txt statique, au domaine codé en dur et incomplet** : il manque `/geo`, `/glossaire`, `/questions`, `/a-propos`, `/comparatif`, `/etudes` et `/p/repere`.
Patch : supprimer `public/llms.txt` et créer `src/app/llms.txt/route.ts` (`export const dynamic = 'force-static'`), qui génère le fichier depuis `SITE_URL`, `ONE_LINER`, `GUIDES`, `ETUDES`, `SEGMENTS`, `CATEGORIES` et `PAGE_UPDATED`. Ajouter en tête une section « Faits clés » : prix d'entrée, segments, ce que nous ne promettons pas, contact, SIREN (quand il est connu), date de mise à jour. Le fichier reste une hygiène, pas un levier prouvé [S6] : ne pas le survendre sur `/geo`.

**G7 [M] Les pages segments (`/pme`, `/local`, `/e-commerce`) ont des h2 slogans, sans réponse directe.**
Patch (`src/components/site/SegmentLanding.tsx` et les trois pages) : sous chaque h2 marketing, ajouter une première phrase factuelle et autonome. Exemple pour PME : « Repéré pose 10 questions d'acheteurs B2B de votre secteur à ChatGPT, Gemini et Perplexity, relève qui est cité et sur quelles sources, puis réalise les actions (pages, fiches comparateurs, balisage) avec l'offre Accompagné, à 490 €/mois. » Ajouter aussi en bas de page un bloc « En bref » sous forme de `<dl>` : pour qui, prix, délai, ce qui est inclus, ce qui ne l'est pas.

**G8 [B] FAQ : la page `/questions` (25 Q/R) et les FAQ des pages se recoupent.** C'est acceptable si les réponses sont identiques mot pour mot ; mieux encore, chaque FAQ locale renvoie à `/questions#<id>` pour la réponse longue. Vérifier qu'aucune réponse ne se contredit : par exemple « Combien de temps avant de voir un effet ? » sur l'accueil et sur `/questions`.

**G9 [B] Le site applique-t-il ce qu'il recommande ?** Voici la checklist des recommandations faites aux clients, appliquée à notre site :

| Recommandation client | Notre site | Lot |
|---|---|---|
| Autoriser OAI-SearchBot, PerplexityBot… | oui, à compléter | T7 |
| Fiche de vérité cohérente partout | non (descripteur et domaines incohérents) | G4, D2 |
| Page officielle `/p/` | non | D2 |
| JSON-LD Organization, FAQ, Offer | partiel | S1-S4 |
| llms.txt | oui, mais périmé | G6 |
| Mesure du trafic IA (t.js) | non | D1 |
| FAQ claire, pages citables, sources | oui (nouveau cluster) | T4 (maillage) |
| Avis clients | aucun avis, et c'est normal à ce stade | plus tard : page « Avis » réelle ; jamais d'avis inventés |
| Présence sur les sources tierces (annuaires B2B, comparatifs, G2, Capterra, LinkedIn) | inconnue | hors code : fiches G2, Capterra, Appvizer, LinkedIn, annuaire-entreprises |

---

## 4. Plan d'implémentation en lots indépendants

Ordre conseillé : 1 → 2 → 3, puis le reste en parallèle. Chaque lot peut être livré et testé seul. Les fichiers listés sont ceux qui seront modifiés ; les lots touchent des zones distinctes, sauf mention.

**Lot 1. URL canonique et domaine (T1, T2).** 15 min. Bloquant.
- `src/app/layout.tsx`, `src/lib/seo/index.ts`, `next.config.ts`, `src/components/app/adapters.ts`, `src/lib/tracking/index.ts`, `src/lib/tracking/ga4.ts`, `src/lib/email.ts`.
- Test : `grep -rn "localhost:3000\|app.repere.fr" src` ne renvoie plus que les tests ; le canonical de `/` vaut `https://repere-ia.fr` sans variable d'env.

**Lot 2. Métadonnées et images OG (T3, T8, T9, T12, T14, et le title par défaut de T8).** 2 h.
- Créer : `src/lib/seo/meta.ts`, `src/lib/seo/og.tsx`, `src/app/opengraph-image.tsx`, `src/app/guides/[slug]/opengraph-image.tsx`, `src/app/visibilite-ia/[metier]/opengraph-image.tsx`, `src/app/geo/opengraph-image.tsx`, `src/app/etudes/[slug]/opengraph-image.tsx`.
- Modifier, pour leurs métadonnées seulement : `src/app/{page,pme/page,local/page,e-commerce/page,tarifs/page,audit/page,methode/page,guides/page,guides/[slug]/page,visibilite-ia/page,visibilite-ia/[metier]/page,a-propos/page,geo/page,glossaire/page,questions/page,comparatif/page,etudes/page,etudes/[slug]/page,cgv/page,confidentialite/page,mentions-legales/page}.tsx`, `src/lib/seo/segment-pages.tsx`, `src/app/layout.tsx` (title par défaut).
- Test : le crawler (section 5) affiche `og:image` et `og:url` partout et des titles de 50 à 60 caractères.

**Lot 3. Sitemap, robots, en-têtes et 404 (T5, T6, T7, T10, T11).** 1 h.
- Créer : `src/lib/seo/updated.ts`, `src/app/not-found.tsx`.
- Modifier : `src/app/sitemap.ts`, `src/app/robots.ts`, `next.config.ts` (en-têtes X-Robots-Tag), `src/app/visibilite-ia/[metier]/[ville]/page.tsx`, `src/lib/seo/segment-pages.tsx` (canonical), `src/app/visibilite-ia/[metier]/page.tsx` (6 villes).
- Test : aucune URL du sitemap n'a de `noindex` ; les lastmod sont distincts et réels ; `/robots.txt` ne contient plus `/rapport/` ; un aperçu LinkedIn Post Inspector d'un rapport fonctionne.

**Lot 4. Maillage du cluster GEO (T4, T13).** 45 min. Dépend des pages livrées par l'agent GEO.
- Modifier : `src/components/site/Footer.tsx`, `src/components/site/Header.tsx`, `src/app/page.tsx` (liens sous la FAQ), `src/components/site/PricingExplorer.tsx` (h2 sr-only).
- Test : profondeur ≤ 2 depuis `/` pour `/geo`, `/questions`, `/glossaire`, `/a-propos`, `/comparatif`, `/etudes`, `/guides/*`.

**Lot 5. Données structurées unifiées (S1, S2, S3, S5, S6).** 3 h.
- Modifier : `src/lib/seo/jsonld.ts` (option `breadcrumb`, exports), `src/lib/seo/index.ts` (suppression des doublons, `serviceLd`), `src/lib/seo/segments.ts` (`categoryServiceLd`), `src/components/site/blocks.tsx` (`FaqJsonLd`), `src/lib/seo/guides.ts` (`published`), `src/app/page.tsx`, `src/app/tarifs/page.tsx`, `src/app/guides/[slug]/page.tsx`, `src/app/guides/page.tsx`, `src/app/methode/page.tsx`, `src/app/visibilite-ia/**/page.tsx`, `src/lib/seo/segment-pages.tsx`, `src/app/{pme,local,e-commerce}/page.tsx`.
- Test : validation de chaque page via le Rich Results Test et le validateur schema.org ; un test vitest vérifie que chaque `@id` référencé existe dans le graphe ou dans `ORG_ID`/`WEBSITE_ID`.

**Lot 6. Entité, à propos et descripteur (S4, G2, G4).** 1 h de code, plus la saisie des informations par le fondateur.
- Créer : `src/lib/seo/entity.ts` (`ONE_LINER`, `DESCRIPTOR`, `LEGAL`).
- Modifier : `src/lib/seo/jsonld.ts` (`LEGAL`, `identifier`, `address`), `src/app/a-propos/page.tsx` (masquer les placeholders), `src/components/site/Footer.tsx` (descripteur ; attention, même fichier que le lot 4, à livrer après), `src/app/layout.tsx` (OG), `src/app/mentions-legales/page.tsx` (mêmes valeurs `LEGAL`), `.env.example` (`NEXT_PUBLIC_SAME_AS`, `NEXT_PUBLIC_FOUNDER_*`, `NEXT_PUBLIC_LEGAL_*`).
- Hors code : créer la page LinkedIn de l'entreprise et récupérer le SIREN et l'URL annuaire-entreprises.

**Lot 7. Dogfooding (D1, D2, D3).** 2 h.
- Modifier : `src/lib/db.ts` (`HOUSE_BUSINESS_ID`, `houseBusinessRecord`), `src/lib/execution/repo.ts` (slug `repere`), `src/lib/facts.ts` (repli statique des faits `repere` depuis `entity.ts`), `src/app/layout.tsx` (snippet `t.js`, exclu de `/app`, `/admin` et `/rapport` : le placer plutôt dans un `src/components/site/SiteTracking.tsx` inclus par `Header`/`PageShell`, et non dans le layout racine), `src/app/page.tsx` et `src/app/a-propos/page.tsx` (fusion avec `schemaForBusiness('repere')`), `src/app/sitemap.ts` (`/p/repere`).
- Test : `/p/repere` renvoie 200 et est indexable ; `/api/schema/repere` renvoie le même `@id` que l'accueil ; une visite avec `?utm_source=chatgpt.com` apparaît dans `/api/t/summary` pour `repere`.

**Lot 8. Contenu citable (G1, G3, G7, G8).** 3 h.
- Créer : `src/components/site/Byline.tsx`, `src/components/site/PriceTable.tsx` (serveur).
- Modifier : `src/app/guides/[slug]/page.tsx`, `src/app/methode/page.tsx`, `src/app/tarifs/page.tsx`, `src/components/site/SegmentLanding.tsx`, `src/app/{pme,local,e-commerce}/page.tsx`, `src/app/visibilite-ia/page.tsx`.
- Test : `curl /tarifs | grep "29"` trouve les prix des 3 parcours ; un `<time datetime>` est présent sur toutes les pages éditoriales.

**Lot 9. llms.txt généré (G6).** 30 min. Dépend du lot 6 (`entity.ts`).
- Supprimer `public/llms.txt` ; créer `src/app/llms.txt/route.ts`.

**Lot 10. Performance (P1, P2, P4).** 2 h.
- Créer : `src/app/fonts/*.woff2` (copiés depuis `node_modules/@fontsource/...`), `src/components/site/MobileMenu.tsx` (client).
- Modifier : `src/app/layout.tsx` (`next/font/local`, à coordonner avec les lots 1 et 7, qui touchent le même fichier), `src/app/globals.css`, `src/app/tarifs/page.tsx` et `src/components/site/PricingExplorer.tsx` (`useSearchParams` + Suspense), `src/components/site/Header.tsx`.
- Test : `/tarifs` apparaît en ○ (statique) dans `next build` ; les deux polices du LCP sont en `<link rel="preload" as="font">` ; CLS = 0 sur `/pme` en desktop.

**Lot 11. Données originales (G5).** Continu : contenu et requêtes d'agrégation.
- Modifier : `src/lib/seo/index.ts` (`getSeoStats`), `src/lib/seo/segments.ts` (`getSegmentStats`), page `/etudes/barometre-visibilite-ia`, ajout d'un `Dataset`.

**Lot 12. Rapport (P3).** Hors SEO pur, à confier à l'agent rapport.

## 5. Re-mesure

Scripts réutilisables, dans le scratchpad de la session (`/tmp/claude-0/-home-claude/1613138e-8209-5786-b4b6-a2bbf8070257/scratchpad/seo/`) :
- `crawl_dev.py <base> <out.json>` : statut, title, description, canonical, robots, OG, h1-h3, alt, JSON-LD, ancres, inlinks ;
- `perf.py <base> "/,/pme,…" <out.json>` : LCP, élément LCP, CLS, poids JS, CSS et polices, en mobile throttlé et en desktop ;
- `shadow/` : copie fantôme pour un build isolé (`node node_modules/next/dist/bin/next build`, puis `next start -p 4100`) qui ne touche pas `app/.next`.

## 6. Sources

- [S1] Google Search Central, *AI features and your website* : https://developers.google.com/search/docs/appearance/ai-features
- [S2] Seuils des Core Web Vitals (LCP 2,5 s, INP 200 ms, CLS 0,1, 75e centile) : https://specification.website/spec/performance/core-web-vitals/ ; https://corewebvitals.io/core-web-vitals
- [S3] OpenAI, *Overview of OpenAI Crawlers* : https://developers.openai.com/api/docs/bots.md
- [S4] Perplexity, *Perplexity crawlers* : https://docs.perplexity.ai/docs/resources/perplexity-crawlers.md
- [S5] Vercel, *The rise of the AI crawler* : https://vercel.com/blog/the-rise-of-the-ai-crawler
- [S6] Search Engine Journal (SE Ranking, 300 000 domaines), *llms.txt shows no clear effect on AI citations* : https://www.searchenginejournal.com/llms-txt-shows-no-clear-effect-on-ai-citations-based-on-300k-domains/561542/
- [S7] Aggarwal et al., *GEO: Generative Engine Optimization*, KDD 2024 : https://arxiv.org/html/2311.09735v3
- [S8] Ahrefs, *Do AI assistants prefer to cite fresh content?* (17 M de citations) : https://ahrefs.com/blog/do-ai-assistants-prefer-to-cite-fresh-content/
- [S9] Ahrefs, *An analysis of AI Overview brand visibility factors (75K brands)* : https://ahrefs.com/blog/ai-overview-brand-correlation/
- [S10] Google Search Central, *Software app (SoftwareApplication) structured data* : https://developers.google.com/search/docs/appearance/structured-data/software-app
- Complément sur la fraîcheur par plateforme : https://nogood.io/blog/content-freshness-ai-citations/
