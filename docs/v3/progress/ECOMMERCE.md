# ECOMMERCE — journal (src/lib/ecommerce/**, src/app/api/ecommerce/**)

**Fait** (23 tests verts, tsc propre sur le périmètre) — reprise : types.ts et match.ts gardés, fetch.ts délègue à `@/lib/siteaudit`.
1. Catalogue (catalog.ts, `ecom.catalog`) : saisie, import par URL (audit de fiche), sitemap, `/products.json`, Shopify. 2. Suivi produit (tracking.ts). 3. Revendeurs (retailers.ts). 4. Prix/notes cités → `factItems` (prices.ts, LLM facultatif). 5. CA IA (revenue.ts) : Shopify (shopify.ts : OAuth, jetons expirants chiffrés, `ecom.shopify`), t.js, démo. 6. Livrables (deliverables.ts). 7. Démo Maison Sora (demo.ts) + routes `/api/ecommerce/{catalog,products,retailers,prices,revenue,deliverables,shopify,shopify/start,shopify/callback}`.
**Env nouvelles** : `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`, `SHOPIFY_API_VERSION` (défaut 2026-10). **En cours / Reste** : rien.

**À faire par d'autres**
- t.js (public/t.js) : `w.repere=function(a,b,v){…t(String(b||"conversion").slice(0,40),v)}` ; dans `t(c,v)` ajouter `v:typeof v=="number"&&v>0&&v<1e6?Math.round(v*100):void 0` au JSON.
- src/lib/tracking/handlers.ts `handleBeacon` : lire `o.v` (entier 1..1e8) → `recordHit({…, valueCents})`. src/lib/tracking/index.ts `recordHit` (conversion) : moteur IA → `incrDoc(DAILY,id,{[`c.${e}`]:1,[`r.${e}`]:valueCents})` ; sinon `{'xc.other':1,'xr.other':valueCents}` (clés lues par `revenueReport`).
- TACHES-FOND : `.env.example`/env.ts (3 variables ci-dessus) ; export/suppression RGPD des collections `ecom.catalog`, `ecom.shopify`.
- Vérité (écrans 2b / src/lib/facts) : fusionner `priceReport().factItems` (champ « prix ») dans la vérification des faits. Écran 2b : retour OAuth `/app/reglages?shopify=connected|error`.
