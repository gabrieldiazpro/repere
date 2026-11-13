# MOTEUR — journal (src/lib/engine/**)

**Fait** (106 tests moteur verts, dont __tests__/v3.test.ts)
1. Questions perso : `runAudit(input,{queries,queriesMode:'replace'|'append',measuredAt})`, `resolveAuditQueries`, thème+tags sur chaque QuerySpec (queries-v3.ts) ; ids `C-`/`CB-` (marque).
2. Mistral (providers/mistral.ts, Conversations API + web_search) : `MISTRAL_API_KEY`, `MISTRAL_MODEL` (défaut mistral-small-latest), `MISTRAL_EXTRACTOR_MODEL` ; suivi payant seulement, budgété.
3–4. analytics.ts : `computeMargins` (bootstrap, `result.margins`), `buildVoiceMatrix` (thème × IA + top 10, `result.voice`), `mergeUrlHistory`.
5. `sources.urls` (UrlStat) via `aggregateUrls`.
6. explain.ts : `explainChange(prev,next)`. 7. brief.ts : `buildContentBrief(target,input,audit?)`, `queryGaps`.
8. coherence.ts : `auditCounts` (`result.counts`), `reconcilePerception` (erreur factuelle = négatif), dates = date de mesure (`factCheck.checkedAt`, verbatims).
9. `createMockAudit(input, seed, {queries,providers,measuredAt})` déterministe, 3 segments.

**En cours** : rien. **Reste** : D5/D7 (plafonds du mock) non traités (hors mission explicite).

**À faire par d'autres** (ProviderId inclut 'mistral' → ajouter une clé `mistral: …` aux Record<ProviderId,…>) :
- src/components/app/tokens.ts:18, src/components/report/adapters.ts:142, src/components/report/derive.ts:15, src/lib/alerts.ts:29, src/lib/email.ts:34, src/lib/pdf/derive.ts:3 ; src/components/app/demo-data.ts:452 (lecture `.mistral`).
- src/app/app/ia/page.tsx:88 : `a.subScores[pr] ?? null` (mistral optionnel).
