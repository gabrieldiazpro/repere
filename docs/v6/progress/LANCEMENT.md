# LANCEMENT — journal (V6, 15 nov. 2026)
## Fait
- src/lib/pilots : validate (pur), store (`pilots.applications`, statuts, notes, doublons 30 j, J0 à l'activation), notify (e-mail fondateur via sendEmail), measures (J0/J30/J90 depuis `analysis.runs` + audits IA, fenêtres, jamais d'interpolation, écart dans/au-delà des marges). 19 tests.
- /pilotes (page + PilotForm + POST /pilotes/candidature : piège, 5/h et 20/j par IP, même origine, consentement horodaté). Compteur de places réel.
- /admin/pilotes (+ POST /admin/pilotes/maj) : statut, notes, rattachement espace, tableau J0/J30/J90.
- /presse : 3 phrases, chiffres lus dans le code (185 contrôles, 12 familles, 60 pages / 45 s) + études sourcées, fondateur (env), contact presse, logos SVG vectorisés (routes /presse/*.svg), 3 captures de la démo (static import).
- docs/lancement/ : README (décisions), plan-30-jours, prospection-email (CNIL citée), linkedin, script-appel, objections, kpi.
- Demande SITE-SEO-90 (menu, pied de page, sitemap, llms.txt) écrite. Captures qa/v6/LANCEMENT (1440 + 390 ; le site public n'a pas de mode sombre).
## Propositions à valider par le fondateur
- Offre pilote = Accompagné offert 3 mois (297 € Local, 1 170 € e-commerce, 1 470 € PME au tarif public) — PROPOSITION, non validée. Changer `PILOT_MONTHS` sinon.
## Env nouvelles (facultatives)
- PILOTS_NOTIFY_EMAIL, NEXT_PUBLIC_PRESS_EMAIL.
## À faire par d'autres
- Propriétaire de /admin (route /admin/messages) : les pages /admin ont `Referrer-Policy: no-referrer`, Chrome envoie `Origin: null` sur les formulaires POST → « Origine refusée » sur « Marquer comme répondu ». Correctif appliqué chez moi (/admin/pilotes/maj : accepter `Origin: null` si `Sec-Fetch-Site: same-origin`), à reprendre dans src/app/admin/messages/route.ts.
- Observé en dev (qa-site) : /app/seo en compte démo PME s'est affiché sans CSS 2 fois (pas d'erreur serveur) ; à revérifier en build.
## Vérifications (15 nov., 01 h 40)
- tsc : 0 erreur. eslint : 0 erreur (45 avertissements anciens, aucun dans mon périmètre). vitest pilots + candidature : 19/19.
- vitest complet : 1 963/1 966 ; 3 échecs hors périmètre, liés aux chantiers en cours des autres agents :
  v4-site.test.tsx (hero accueil, SITE-SEO-90), robustesse.test.ts (cookie/meta refresh, ROBUSTESSE),
  content.test.ts (attend 9 pages /outils, en trouve 20 : OUTILS/SITE-SEO-90).
- Serveur 4101 : tué par OOM (build seo90 concurrent) pendant mes captures, relancé puis arrêté après usage.
