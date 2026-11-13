# CORRECTIFS-LIB — journal (10 lignes de qa/v3/a-corriger-*.md traitées, relues en fin de travail)

**Fait** (vitest src/lib src/app/api src/app/audit src/app/connexion : 772 verts ; src/components 156 verts ; tsc propre sur ces chemins)
- Mock/démo : `engine/providers/mock-align.ts` (nom injecté au rang voulu ou retiré du TEXTE) + `createMockAudit({rewrite, measuredAt})` ; demo-v2 ne force plus `mentioned` : cité/rang dérivés par la détection. Rang hors liste = position du nom (detect.ts). Dates = date de la mesure. D5 `capLeader` (leader absent de ≈15 %), D7 PagesJaunes ≈60 %. `norm()` mis en cache (démo 3× plus rapide). Test `engine/__tests__/mock-invariants.test.ts`.
- store.ts : `writeFileAtomic` + `readJsonSafe` (aussi db.ts, ratelimit.ts) ; test `lib/__tests__/store.test.ts`.
- plans.ts (+ docs/v2/07-plans-v2.json) : « N IA » = getEntitlements ; test `plans-engines.test.ts`.
- badge.ts 3 lignes avec note ; ecommerce : accord, `plainQuote`, CA démo par IA cohérent (tracking/index.ts).
- audit/actions.ts : getClientIp ; callback : confirmation POST pour `token_hash` (`as` signé, Origin vérifié).
- Tests copilote ajustés (48/48 = défaut D5 ; « /100 » = échelle).
**Reste** : rien.
**À faire par d'autres** : SITE — src/components/site/plans-v2.ts : recopier les lignes « 4 IA / 5 IA » ajoutées à docs/v2/07-plans-v2.json.
