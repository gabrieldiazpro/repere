/**
 * Animations propres au site public V4 (SITE-ACCUEIL). Injectées par <Header /> via une balise <style> hissée et
 * dédupliquée par React (href + precedence) plutôt qu'un import .css : les tests vitest importent des pages, et un
 * import CSS y déclencherait PostCSS. Règle V4 : le mouvement réduit coupe les DÉPLACEMENTS, jamais les fondus.
 */
export const SITE_CSS = `/*
 * Site public V4 (SITE-ACCUEIL) : quelques animations propres au site. Règle V4 : le mouvement réduit coupe les
 * DÉPLACEMENTS (glissements, zooms), jamais les fondus, compteurs ou tracés. N'anime que transform/opacity.
 */

/* Panneau d'onglet qui entre (fondu + légère montée ; fondu seul en mouvement réduit) */
.site-tab-in:not([hidden]) { animation: site-fade-up var(--dur-slow) var(--ease-out) both; }
@keyframes site-fade-up { from { opacity: 0; transform: translateY(8px); } }
@keyframes site-fade { from { opacity: 0; } }

/* Prix qui change (bascule mensuel / annuel, onglet de parcours) */
.site-swap { display: inline-block; animation: site-swap var(--dur-base) var(--ease-out) both; }
@keyframes site-swap { from { opacity: 0; transform: translateY(-6px); } }

/* Menu mobile : panneau qui descend, liens en cascade */
.site-menu[data-open] { animation: site-menu var(--dur-base) var(--ease-out) both; }
.site-menu[data-open] .site-menu-item { animation: site-fade-up var(--dur-base) var(--ease-out) both; animation-delay: calc(min(var(--i, 0), 8) * 35ms); }
@keyframes site-menu { from { opacity: 0; transform: translateY(-8px); } }

/* FAQ et blocs dépliables : contenu qui s'ouvre en douceur (navigateurs récents) */
@supports (interpolate-size: allow-keywords) {
  .site-details { interpolate-size: allow-keywords; }
  .site-details::details-content {
    block-size: 0;
    overflow: clip;
    opacity: 0;
    transition: block-size var(--dur-slow) var(--ease-out), opacity var(--dur-base) var(--ease-out), content-visibility var(--dur-slow) allow-discrete;
  }
  .site-details[open]::details-content { block-size: auto; opacity: 1; }
}

/* Barres de données qui se remplissent à l'entrée (cartes de parcours) */
.site-bar { transform-origin: 0 50%; }
html[data-motion] .bx-scope[data-in] .site-bar { animation: site-grow 700ms var(--ease-out) both; animation-delay: var(--d, 0ms); }
@keyframes site-grow { from { transform: scaleX(0); } }

/* Pastilles de carte qui apparaissent du centre vers l'extérieur */
html[data-motion] .bx-scope[data-in] .site-dot { animation: site-fade 500ms var(--ease-out) both; animation-delay: var(--d, 0ms); }

@media (prefers-reduced-motion: reduce) {
  .site-tab-in:not([hidden]), .site-menu[data-open], .site-menu[data-open] .site-menu-item, .site-swap { animation-name: site-fade; }
}
`;
