/**
 * Pages d'accueil réduites, relevées sur de vrais sites français pendant la campagne TESTS-REELS (23 nov. 2026).
 * Seuls les éléments qui comptent pour la détection sont gardés (titre, H1, og:site_name, description, JSON-LD
 * d'organisation, signatures de plateforme). Aucune donnée personnelle : les fiches « Person » (fondateurs, équipe)
 * ont été retirées, comme les téléphones et adresses.
 */
const page = (head: string, body: string) => `<!doctype html><html lang="fr"><head><meta charset="utf-8">${head}</head><body>${body}</body></html>`;
const ld = (o: unknown) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`;

/** Boutique de box de vin sur Shopify, déclarée Organization + LiquorStore avec l'adresse du siège, sans horaires. */
export const LE_PETIT_BALLON = page(
  `<title>Abonnement de box de vin et bière | Cadeaux et achat de vin en ligne &ndash; Le Petit Ballon</title>
  <meta property="og:site_name" content="Le Petit Ballon">
  <meta name="description" content="Spécialiste français de l'abonnement de box de vin et de la vente de vins, champagnes, spiritueux et coffrets cadeaux en ligne.">
  ${ld({ '@context': 'https://schema.org', '@type': ['Organization', 'LiquorStore'], name: 'Le Petit Ballon', url: 'https://www.lepetitballon.com', address: { '@type': 'PostalAddress', postalCode: '75008', addressLocality: 'Paris', addressCountry: 'FR' } })}
  <link rel="stylesheet" href="//www.lepetitballon.com/cdn/shop/t/1/assets/base.css"><script src="https://cdn.shopify.com/s/files/shop.js"></script><script>window.Shopify = window.Shopify || {}; Shopify.theme = {"name":"lpb"};</script>`,
  `<header><a href="/cart">Panier</a></header><h1>Les box de vins du Petit Ballon - Abonnement et cadeau</h1><p>Chaque mois, deux bouteilles sélectionnées par nos sommeliers.</p><button>Ajouter au panier</button>`,
);

/** Néobanque : Product + SoftwareApplication avec des offres d'abonnement (pas une boutique en ligne). */
export const NEOBANQUE = page(
  `<title>Gérez toutes vos finances depuis votre compte pro | Qonto</title>
  ${ld({ '@context': 'https://schema.org', '@type': 'Brand', name: 'Qonto' })}
  ${ld({ '@context': 'https://schema.org', '@type': ['Product', 'SoftwareApplication', 'WebApplication'], name: 'Qonto', offers: { '@type': 'AggregateOffer', lowPrice: '9', priceCurrency: 'EUR' } })}`,
  `<h1>
La banque pro qui connecte tous vos chiffres.
</h1><p>Compte pro, cartes, factures.</p>`,
);

/** Praticienne sur Wix (avec un petit e-shop) : nom en capitales avec forme juridique, H1 écrit lettre par lettre
 * dans des <span> colorés (lu « f l e u r s » avant correction). */
export const PRATICIENNE_WIX = page(
  `<title>Accueil | FLEURS DE VIES | biorésonance</title><meta name="generator" content="Wix.com Website Builder">
  ${ld({ '@context': 'https://schema.org', '@type': 'LocalBusiness', name: 'FLEURS DE VIES SAS', address: { '@type': 'PostalAddress', addressLocality: 'Domats' } })}
  <script src="https://static.parastorage.com/services/wix-thunderbolt/dist/main.js"></script><script>var x = "wixstores";</script>`,
  `<h1><span style="font-size:80px;"><span style="color:#E21C21;"><span style="font-weight:bold;">F</span></span><span style="color:#FFC917;"><span style="font-weight:bold;">L</span></span><span><b>E</b></span><span><b>U</b></span><span><b>R</b></span><span><b>S</b></span><br>
<span><b>DE<span> </span>VIES</b></span><br>
<span><b>NUTRITION</b></span></span></h1><p>Séances de biorésonance et conseils en nutrition.</p>`,
);

/** Réseau de salons de coiffure (WordPress) : le métier est dans le nom, le H1 parle de soins, un slogan anglais. */
export const COIFFEUR_RESEAU = page(
  `<title>Coiffeur Jean Louis David | Make a Difference</title>
  ${ld({ '@context': 'https://schema.org', '@type': 'Organization', name: 'Coiffeur Jean Louis David' })}
  <link rel="stylesheet" href="/wp-content/themes/jld/style.css">`,
  `<h1>Les soins cuir chevelu</h1>`,
);

/** Restaurant (Squarespace-like) : H1 décoré, pas de JSON-LD. */
export const RESTAURANT_DECORE = page(`<title>Septime</title>`, `<h1>. x x Septime x x</h1><p>Réservations en ligne, 80 rue de Charonne.</p>`);

/** Défi anti-robots servi en 200 par un hébergeur WordPress (LiteSpeed) : 9 mots, titre « Un instant… ». */
export const DEFI_UN_INSTANT = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Un instant, s'il vous plaît…</title><script src="/challenge.js"></script><script>setTimeout(function(){location.reload()},3000)</script></head><body><p>Vérification de votre navigateur en cours.</p><noscript>Activez JavaScript pour continuer.</noscript></body></html>`;

/** Serveur qui liste ses fichiers au lieu d'afficher le site (Apache « Index of / »). */
export const INDEX_OF = `<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 3.2 Final//EN"><html><head><title>Index of /</title></head><body><h1>Index of /</h1><table><tr><th><a href="?C=N;O=D">Name</a></th></tr><tr><td><a href="cgi-bin/">cgi-bin/</a></td></tr><tr><td><a href="ancien-site/">ancien-site/</a></td></tr></table></body></html>`;
