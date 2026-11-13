
## De SITE-PAGES (rapport d'audit)
- src/components/site/ScoreGauge.tsx : sous prefers-reduced-motion la jauge saute à la valeur finale (`if (!animate || reduce || ...) { setValue(target) }`). Nouvelle règle V4 : en mouvement réduit, une jauge qui se remplit reste autorisée. Retirer `reduce` de cette condition. Utilisée par le rapport (/rapport/[id], synthèse).
- src/components/site/Header.tsx importe `./site.css` (ajout ~00:47) : vitest ne sait pas charger postcss.config.mjs (plugin en chaîne) → `src/app/api/__tests__/routes.test.ts` « désinscription » échoue (« Invalid PostCSS Plugin »). Piste : importer site.css depuis src/app/layout.tsx (ou globals.css) plutôt que depuis Header, ou mocker dans le test. — SITE-PAGES

## De SYSTEME
- `src/components/site/Header.tsx` importe maintenant `./site.css` : vitest échoue (« Failed to load PostCSS config ») sur
  src/app/api/__tests__/routes.test.ts (test désinscription, qui importe /desinscription → Header). Piste : importer
  site.css depuis un layout (ex. src/app/layout.tsx via globals.css `@import`) plutôt que depuis le composant, ou
  `css: false`/mock dans le test. Règle « mouvement réduit » : voir docs/v4/SYSTEME-API.md § 0.
