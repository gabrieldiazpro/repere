# Repéré V3 — brief commun (source de vérité)

## Demande du fondateur (9 nov. 2026, soir)
« Améliore le site, fais un audit puis ajoute tout ce qu'il manque pour en faire le SaaS de référence dans son
domaine, audite les concurrents et clone les meilleures features. Ajoute des animations, vidéos démos, et tout ce
qu'il faut. »

## Où on en est (V2, livrée le 9 nov.)
Repéré — « le référencement IA clé en main des entreprises françaises ». Next.js 15 / TS / Tailwind v4 / Supabase /
Stripe / Resend. Code : /home/claude/auditia/app. Build OK (217 pages), 302 tests.
- Site : landing + /local /pme /e-commerce, /tarifs, /geo, /glossaire, /questions, /comparatif, /etudes, /guides,
  /methode, /a-propos. SEO technique 88/100.
- Moteur : audit multi-IA (ChatGPT, Perplexity, Gemini, Claude), 3 parcours, score, sources citées (436 domaines
  classés), perception, vérification des faits (fiche de vérité), gaps concurrents, benchmark.
- Exécution : 12–15 tâches avec livrables (fiche Google, JSON-LD servi, plugin WordPress, page FAQ hébergée /p/[slug],
  kit avis, réponses aux avis, comparatif, fiches produits).
- Tracking : script sans cookie t.js, robots IA, connecteur GA4 préparé.
- Rétention : digest du lundi, alertes, copilote, 3 comptes démo (demo = Plomberie Martin, demo-pme = Paysia,
  demo-ecom = Maison Sora).
- Espace client /app : Lundi, Ce que disent les IA, Vérité, Sources, Concurrents, Tâches, Trafic IA, Copilote,
  Rapports, Réglages.
Docs : /home/claude/auditia/docs (V1), docs/v2 (V2 : marché, sources, exécution, trafic, indispensable,
positionnement, contrats). Revues : /home/claude/auditia/qa/v2/*.md (regard client, sécurité, SEO/GEO).

## Ambition V3
Devenir **le SaaS de référence du référencement IA en France** : parité (ou mieux) avec les meilleures fonctions
des concurrents, expérience produit et site au niveau des meilleurs SaaS (animations, vidéos de démo, démo
interactive), outils gratuits qui attirent, onboarding qui active.

## Contraintes
- Fondateur solo, budget minimal ; tout doit tourner en mode démo sans clé (données étiquetées « démo »).
- Honnêteté : aucun faux logo client, faux témoignage, faux chiffre ; aucune promesse de résultat ; prix concurrents
  sourcés et datés. « Cloner une fonctionnalité » = reproduire l'idée fonctionnelle avec notre design et notre code,
  jamais copier textes, visuels, marques ou code d'un concurrent.
- Français, vouvoiement. Conformité CNIL / CGU des API (Gemini sans ancrage).
- Serveur d'audit partagé (lecture seule) : http://localhost:3000 (build V2). Ne jamais lancer `next build` ni
  `next dev` dans /home/claude/auditia/app pendant les vagues ; pour tester du code modifié, travailler dans une copie
  isolée (rsync sans .next ni node_modules + lien symbolique vers node_modules).
- Docs V3 : /home/claude/auditia/docs/v3/.
