# OUTILS — journal (mission terminée)
Fait : reprise agent 1 (registry.ts, tools.css gardés et corrigés) ; api.ts réaligné sur les routes réelles (`{ok:false, error: string, code}`), types importés de @/lib/siteaudit.
Fait : ui.tsx (console de visée, états chargement/erreur/limite/injoignable, jauge, contrôles dépliables, copie, partage ?url=, e-mail facultatif, pont audit), ToolPage (FAQ, sources, JSON-LD WebPage+WebApplication+FAQPage+BreadcrumbList), examples.ts (exemples fictifs .example calculés par les vraies fonctions AUDIT-SITE).
Fait : hub /outils (filtre par parcours) + /outils/[slug] statique : lien-avis-google (QR SVG, affichette A5 print), robots-ia, pret-pour-les-ia (`cap` affiché), citabilite (`passed/total`, `disclaimer`, surlignage), json-ld (générer/valider), rendu-sans-javascript (via readiness.render), comparateur, llms-txt (encadré honnête), fiche-produit.
Fait : 20 tests vitest verts (src/components/tools/__tests__) ; tsc propre sur mes chemins.
Non livré : simulateur de trafic IA (hors liste de la mission). Variables d'env nouvelles : aucune.
À faire par d'autres :
- Propriétaire de src/app/api/leads/route.ts : ajouter 'tool' à l'enum `source` (refusé aujourd'hui → envoi en 'site', avec commerce/métier/ville demandés car exigés).
- CONTENU : ajouter /outils et les 9 /outils/<slug> à src/app/sitemap.ts et public/llms.txt (+ PAGE_UPDATED si utilisé).
- PAGES-SITE : lien « Outils gratuits » (/outils) dans nav.ts / Footer.
- Note : tools.css contient `@page { size: A5 }` (impression de l'affichette), chargé seulement par /outils.
