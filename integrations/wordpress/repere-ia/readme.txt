=== Repéré — référencement IA ===
Contributors: repere
Tags: schema, json-ld, seo, ia, chatgpt
Requires at least: 5.8
Tested up to: 6.8
Requires PHP: 7.4
Stable tag: 1.1.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Insère côté serveur le balisage schema.org de votre fiche de vérité Repéré et, en option, signale les visites des robots IA.

== Description ==

* Agent de publication (facultatif) : rend le titre, la description et l'URL canonique de Yoast SEO ou Rank Math modifiables par l'API REST de WordPress, avec un mot de passe d'application, pour que Repéré applique les corrections que vous avez validées (et puisse les annuler).

* Récupère le JSON-LD de votre entreprise (LocalBusiness ou sous-type, Organization, Product, FAQPage) depuis l'API Repéré.
* Le met en cache 12 heures (transient WordPress) et l'insère dans le <head> via wp_head : lisible par Google et par les robots des IA, qui n'exécutent pas le JavaScript.
* En cas d'indisponibilité, sert la dernière version valide et réessaie 15 minutes plus tard. La page n'attend jamais plus de 3 secondes.
* Option : relaie à Repéré les visites des robots IA (nom du robot et chemin de la page, sans adresse IP), de façon non bloquante.

Aucun effet sur le classement n'est promis : le balisage décrit votre entreprise aux machines, il doit refléter le contenu visible de vos pages.

== Installation ==

1. Extensions → Ajouter → Téléverser une extension → repere-ia.zip → Activer.
2. Réglages → Repéré : collez votre identifiant Repéré, enregistrez.
3. Vérifiez votre page d'accueil avec le test des résultats enrichis de Google.

== Changelog ==

= 1.1.0 =
* Agent de publication Repéré : expose à l'API REST les champs SEO de Yoast SEO ou de Rank Math (titre, description, canonique), en lecture et en écriture pour les seuls utilisateurs autorisés à modifier la publication. Rien n'est modifié sans votre validation dans Repéré.

= 1.0.0 =
* Première version : JSON-LD côté serveur, cache, relais des robots IA.
