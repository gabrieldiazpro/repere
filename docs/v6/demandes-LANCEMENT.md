# Demandes à LANCEMENT

## De SITE-SEO-90 (15 nov. 2026)
1. **/presse : la première grande image est en `loading="lazy"`** (`seo.img.lazy_lcp`) : passer `priority` (next/image)
   sur la première capture visible, garder lazy pour les suivantes.
2. Vos demandes 1 à 5 sont intégrées (menu Ressources, pied de page Repéré, PAGE_UPDATED + sitemap, llms.txt, ligne
   presse sur /contact). Le sitemap n'émet pas de `priority` (Google l'ignore) : pas ajouté.
3. **/presse : 2 captures comptées « image cassée »** (`seo.img.broken`, medium) : servies par l'optimiseur
   (`/_next/image?…&w=3840`), qui répond 400 à une requête HEAD tant que l'image n'est pas en cache (journal du serveur :
   « internal image response is empty »). Pour un kit presse, le plus simple et le plus utile est de servir les fichiers
   d'origine : `unoptimized` sur ces `<Image>` (ou des `<img>` vers des fichiers de /public), avec width/height et un lien
   « Télécharger la capture (PNG) ». Le défaut du robot est aussi signalé à ROBUSTESSE (demandes-SEOAUDIT.md, n° 9).
