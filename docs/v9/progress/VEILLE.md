# VEILLE — journal (V9)

## Fait
- Veille : src/lib/veille (20 fiches sourcées, sources relues le 23/11/2026, contrôle de cohérence `entryProblems`), /veille (filtres activité/thème, frise, échéances, RSS /veille/rss.xml, CollectionPage+ItemList), /veille/[slug] (NewsArticle, sources datées, « ce qui reste incertain »), /veille/lettre.
- Lettre : src/lib/newsletter (store `newsletter.*`, jetons HMAC, double opt-in, désinscription un clic GET+POST, e-mails sans pixel, envoi par lots confirmé), formulaire réutilisable `@/lib/newsletter/ui/NewsletterForm`, API /api/newsletter/{subscribe,confirm,unsubscribe,ressource}, admin /admin/newsletter (+ /maj, /export, /apercu). Premier numéro : brouillon `numero-1` créé à l'ouverture de l'admin (src/lib/newsletter/issue.ts `firstIssueDraft`).
- Ressources : /ressources, /ressources/guide-2027 (consentements distincts), /lire (lien signé, imprimable A4), /pdf (react-pdf, ≥ 20 pages, testé).
- Tests : src/lib/veille/__tests__, src/lib/newsletter/__tests__, src/app/api/newsletter/__tests__.

## Décisions
- Statuts limités à en vigueur / annoncé / à venir ; nuance dans `statusNote`.
- Sources officielles inaccessibles le 23/11 (Légifrance, DGCCRF, pages aide OpenAI) : signalé dans `uncertain`, jamais affirmé.
- Envoi « marketing » → liste d'opposition générale respectée ; confirmation et guide = « transactional » (demandés à l'instant).

## Variables d'environnement
- NEWSLETTER_SECRET (facultative ; à défaut UNSUBSCRIBE_SECRET).

## À faire par d'autres
- SITE : voir /home/claude/auditia/docs/v9/demandes-SITE.md (menu, pied de page, sitemap, llms.txt, formulaire dans les guides).

## Vérifications (23/11/2026)
- tsc 0 erreur ; vitest complet 163 fichiers / 2 354 tests verts ; eslint 0 erreur (avertissements préexistants hors périmètre).
- Captures 1440/390 : /home/claude/auditia/qa/v9/VEILLE/ (hub, fiches, lettre, ressources, guide, lecture, admin) ; aucun défilement horizontal.
- Guide 2027 : 25 pages A4 à l'impression, PDF 24 pages (qa/v9/VEILLE/guide-2027*.pdf).
