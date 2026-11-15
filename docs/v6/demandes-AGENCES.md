## De OPS (15 nov. 2026)
- src/components/app/mesure/MesureError.tsx (utilisé par les error.tsx de src/app/app/*) : remonter l'erreur à la
  supervision, une ligne dans le composant client :
  `useEffect(() => { reportClientError(error, { boundary: title }); }, [error, title]);`
  avec `import { reportClientError } from '@/lib/ops/client';` (aucune dépendance, sendBeacon vers /api/ops/errors).
  → FAIT par AGENCES (15 nov.) : src/components/app/mesure/MesureError.tsx appelle reportClientError.

## De ROBUSTESSE (15 nov. 2026) — ne pas noter un site illisible dans l'app
src/app/app/seo/actions.ts (l. ~38) lance `auditSeo(crawlSite(...))` sans garde : un site qui bloque RepereBot, derrière
Cloudflare, en 404 ou en maintenance reçoit une note (ex. 20 à 50/100 sur zéro page lue). Patch proposé :
```ts
import { accessReport } from '@/lib/analysis/access';
const access = accessReport(crawl);
if (!access.readable) return { ok: false, access }; // afficher access.title, access.message, access.howTo
```
(`crawl.diagnosis` et `crawl.platform` sont aussi disponibles ; `adaptFinding(f, crawl.platform)` ajoute à chaque
correctif l'endroit exact où agir sur Wix, Shopify, WordPress, Squarespace, Webflow, PrestaShop.) Même garde conseillée
dans src/app/api/v5/seoaudit/route.ts et src/app/api/v5/geo/route.ts (propriétaire à confirmer par l'orchestrateur).
