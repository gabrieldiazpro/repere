# Plugin WordPress Repéré

Plugin minimal qui insère **côté serveur** le JSON-LD de la fiche de vérité d'un client Repéré, et relaie
optionnellement les visites des robots IA vers le module TRACKING.

Pourquoi côté serveur : les robots des IA (GPTBot, ClaudeBot, PerplexityBot…) n'exécutent pas le JavaScript ;
un JSON-LD injecté par script n'est lu que par Google (docs/v2/04-execution.md § 4).

## Contenu

```
repere-ia/
  repere-ia.php   plugin (réglages, wp_head, relais robots)
  uninstall.php   suppression des options et transients
  readme.txt      en-tête au format wordpress.org
build.sh          fabrique dist/repere-ia.zip
dist/repere-ia.zip
```

## Fonctionnement

| Élément | Détail |
|---|---|
| Source | `GET {api_base}/api/schema/{businessId}` (`?faq=1` si l'option FAQ est cochée) — `application/ld+json` |
| Cache | transient `repere_ia_ld_<md5>` 12 h ; dernière version valide gardée dans l'option `repere_ia_jsonld_last` ; nouvel essai 15 min après un échec |
| Délai | `wp_remote_get` avec timeout 3 s (premier affichage après expiration du cache seulement) |
| Insertion | `wp_head` priorité 1, page d'accueil par défaut (option « toutes les pages ») ; `wp_json_encode` avec `JSON_HEX_TAG` |
| Relais robots | `template_redirect` : si le User-Agent contient un robot IA connu, `POST {api_base}/api/t/bot` **non bloquant** avec `{ businessId, ua, path }` et l'en-tête `x-repere-key` (clé de relais fournie dans Repéré → Trafic IA). Aucune IP, aucun visiteur humain transmis. |
| Champs SEO (1.1.0, agent de publication V5) | `init` : `register_post_meta` avec `show_in_rest` pour `_yoast_wpseo_title`, `_yoast_wpseo_metadesc`, `_yoast_wpseo_canonical` (si Yoast actif) et `rank_math_title`, `rank_math_description`, `rank_math_canonical_url` (si Rank Math actif), sur chaque type de contenu exposé à l'API ; `auth_callback` = `current_user_can('edit_post')` ; nettoyage `sanitize_text_field` / `esc_url_raw` ; filtre `repere_ia_seo_meta_keys`. Lu par src/lib/publish/connectors/wordpress.ts (champ `meta`). |
| Désinstallation | options et transients supprimés |

Le endpoint `/api/t/bot` appartient au module TRACKING ; ce plugin n'en dépend que par son URL et son format.

## Construire le zip

```bash
cd integrations/wordpress && ./build.sh
```

Pour le proposer au téléchargement depuis l'app, copier `dist/repere-ia.zip` dans
`app/public/integrations/repere-ia-wordpress.zip` (lien renvoyé par `GET /api/exec/settings`).

## Tester sans WordPress

```bash
php -l repere-ia/repere-ia.php
curl -s https://repere-ia.fr/api/schema/demo | head
```

## Limites

- Si un autre plugin SEO (Yoast, Rank Math) produit déjà un balisage Organization/LocalBusiness, garder un seul
  des deux pour éviter les entités en double, ou limiter Repéré à la FAQ.
- Diffusion sur wordpress.org : revue manuelle à prévoir (docs/v2/04-execution.md § 2).
