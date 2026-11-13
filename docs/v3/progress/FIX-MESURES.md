# FIX-MESURES — journal
## Fait
- 1 Écarts de score : handlers.handleAuditRun calcule `comparableBase` (previousComparable) une fois ; afterScheduledAudit (exporté) reçoit la base comparable ou null → e-mail variante `first` « mesure de référence », sans écart ni palier. Aussi via previousComparable : alertes de digest.send, notifications démo (notify/center), rapport programmé (notify/reports), copilote (getRank, explainChange). Le PDF n'affiche aucun écart.
- 2 Grille thème × IA démo : engine/providers/mock-align.ts citationPlan + PROVIDER_CITATION_PROFILE (Perplexity ×1,25 comparatifs/avis, ChatGPT ×1, Gemini ×0,75 proximité/où acheter), branché dans demo-v2. La citation reste portée par le texte. Aucun chiffre figé trouvé dans le site.
- 3 Audit approfondi seul → 30 j d'Essentiel : entitlements.grantAuditOffer (idempotent, jamais de rétrogradation) + sweepAuditOffers (rappel J-5 par e-mail, alerte et notification vers /tarifs ; retour à Découverte ; « relayed » si un abonnement a pris le relais), appelé par audit.scheduled. webhook route : 1 appel (Edit minimal). Audits planifiés limités au quota de questions. Ligne ajoutée aux features des 3 audits (lib/plans.ts + docs/v2/07-plans-v2.json).
- Tests : src/lib/__tests__/fix-mesures.test.ts (20) ; tests copilot et handlers ajustés. tsc : 0 erreur hors scripts/ops ; vitest : 1119/1120.
## Échec hors périmètre
- env-log.test.ts « production complète » : src/lib/env.ts modifié à 00:19 par un autre agent (avertissement identité légale).
## À faire par d'autres
- components/app/data.ts:57 et app/app/rapports/page.tsx:137 : passer par previousComparable.
- components/pages/merci.ts, lib/auth/mail.ts, page CGV : mentionner le mois d'Essentiel offert.
