# LOCAL — journal (src/lib/local/**, src/app/api/local/**)

**Fait** (21 tests verts, tsc propre) — reprise de l'agent 1 (types, util, places conservés ; auth rebranché sur @/lib/auth + getEntitlements)
1. gbp.ts : audit /100 (6 familles, critères {id,label,status,detail,fix,task}), sources Places / saisie guidée / démo ; `toStorableAudit` (Places : place_id + scores seulement).
2. zones.ts + map.ts : grilles Paris/Lyon/Marseille (arr.) + 12 villes (quartiers) + repli cardinal ; un seul `runAudit(input,{queries})`, plafonds par offre (MAP_CAPS, cartes/mois), agrégat par zone, modèle SVG, démo déterministe, étiquette « simulation ».
3. directories.ts + nap.ts : annuaires par métier, vérifié/déclaré/absent via safeFetch, incohérences, score.
4. posts.ts : calendrier hebdo par métier × saison (+LLM option), rappels (notification + e-mail) `processDueReminders`.
5. reviews.ts : thèmes par règles (+LLM option), brouillons `draftReviewReply`.
6. Routes /api/local/{gbp,map,nap,posts,reviews,reminders}, demo.ts (Plomberie Martin), repo.ts (collections local.*).
**En cours** : rien. **Reste** : écrans (vague 2b).
**Env** : `GOOGLE_PLACES_KEY` (facultatif), `LOCAL_MAP_BUDGET_EUR` (facultatif).
**À faire par d'autres** : TACHES-FOND : cron quotidien vers `/api/local/reminders` (vercel.json) + 2 variables dans .env.example. Écrans 2b : lien `/app/local/posts?post=<id>`. Fondateur : faire valider par Google le stockage d'historique de scores issus de Places (zone grise « contenu dérivé »).
