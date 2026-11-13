# Demandes à PUBLICATION

## De GEO-OPT (2026-11-13) — charges utiles `autoFix` émises par src/lib/geo
Toutes reprennent `url` et `value` (vocabulaire de publication.md) ; rien n'est inventé, les « [à compléter] » bloquent la publication sans validation.
- `robots.txt` : `{ url, value: string (profil « cité, sans entraînement »), alternatives: { cite, citeNoTraining } }`.
- `jsonld` : `{ url, value: objet JSON-LD, script, notes }` (entité, produit) ; ou `{ url, merge: { sameAs: string[] } }` (fusion dans le bloc d'entité existant).
- `faq` : `{ url, value: { question, answer, from: 'fiche' | 'a_completer' }[], jsonld?: FAQPage (réponses de la fiche seulement), notes }`.
- `rewrite` : `{ items: { url, passageId, before, value, mode: 'ia' | 'deterministe', notes }[] }` — plusieurs passages par constat ; remplacer `before` par `value` dans la page.
- `llms.txt` : `{ url, value: string, honest }` (constat informatif uniquement).
Merci de les accepter telles quelles dans `AutoFixPayload` (ou de signaler l'écart dans ce fichier).

## Réponse de PUBLICATION (2026-11-13)
Pris en charge tels quels (normalisation : src/lib/publish/autofix.ts, tests : src/lib/publish/__tests__/autofix-formats.test.ts) :
- GEO-OPT : robots.txt `{url, value, alternatives}`, jsonld `{url, value: objet|chaîne}` et `{url, merge: {sameAs}}` (fusion avec le bloc
  d'entité relevé par CRAWL dans `CrawledPage.jsonLd` → **export uniquement** : remplacer un bloc existant n'est pas sûr à distance),
  faq `{url, value: {question, answer, from}[]}` (réponses `fiche` acceptées sans contrôle de la page ; `a_completer` → « [à compléter] »),
  rewrite `{items: {url, passageId, before, value, mode, notes}[]}` (plusieurs passages par page, appliqués et annulés en pile ; `mode: 'ia'`
  passe le contrôle anti-invention contre le texte de la page + `site.description`), llms.txt `{url, value, honest}`.
- SEO-AUDIT : forme `{items: […]}` pour meta.title / meta.description / canonical (`href`) / jsonld (`jsonld`) / redirect (`from`, `to`) ;
  alias `img.alt` → image.alt, `robots` (`text`) → robots.txt, `sitemap` (`xml`) → sitemap.xml (export), `link.update` (`page`, `from`, `to`)
  → réécriture de toutes les occurrences ; nouveau type `meta.robots` (export).
- Règle commune : tout changement contenant « [à compléter] » ne peut pas être validé (409 `incomplete`) tant que le client ne l'a pas saisi.
- Écart signalé : redirect `http://x/ → https://x/` (même chemin) est écarté (réglage d'hébergeur, pas une redirection de page).
