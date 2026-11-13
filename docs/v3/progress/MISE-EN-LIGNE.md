# MISE-EN-LIGNE — journal (terminé)

## Fait
- Migrations : schema.sql + 0003→0005 prouvés sur Postgres réel (PGlite 0.5.13) : ordre, idempotence, RLS sur chaque table, politiques, rôles anon/authenticated/service_role. Aucune correction SQL nécessaire. migrate.mjs (pg 8.23.1, `--dry-run`, `--tout-en-un`, `--cron`) prouvé de bout en bout via socket PGlite ; supabase/TOUT-EN-UN.sql généré et testé.
- secrets.mjs (9 secrets, `--completer`, `--liste`, `--vercel`, `--vercel-fichier`), check-env.mjs `--prod`, stripe-setup.mjs (14 prix de plans.ts, webhook 8 événements dont invoice.paid, portail ; client simulé : stripe-mock ininstallable, réseau refusé), verifier-prod.mjs.
- Identité : site.ts (LEGAL.form/siret/rcsCity/email/phone/publicationDirector, LEGAL_ADDRESS, orTodo) branché dans mentions légales, CGV, confidentialité. GBP : repli saisie guidée testé.
- docs/MISE-EN-LIGNE.md. tsc 0 erreur, vitest 77 fichiers / 1145 tests verts.
- Nouvelles variables : NEXT_PUBLIC_LEGAL_FORM, _SIRET, _RCS_CITY, _EMAIL, _PHONE, _PUBLICATION_DIRECTOR ; DATABASE_URL (scripts).

## À faire par d'autres
- JURIDIQUE : src/app/dpa/content.ts l.57 « société Mycelo » en dur → `orTodo(LEGAL.name, …)` (et son test l.35).
- src/components/app/Settings.tsx l.248 vend l'offre V1 `suivi_month` (sans prix créé) → offre Essentiel du parcours.
- README §2 : liste des événements webhook sans `invoice.paid`.
