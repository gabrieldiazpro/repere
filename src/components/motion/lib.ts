/**
 * Repéré — système d'animation (docs/v3/07-design-benchmark.md §4 et §5.1). Zéro dépendance.
 *
 * Principes (à respecter dans chaque composant de ce dossier) :
 * 1. Le mouvement montre le produit, pas la décoration. Une seule signature : le cadre de visée qui se resserre.
 * 2. Chaque animation a une fin ; tout mouvement automatique de plus de 5 s peut être mis en pause (WCAG 2.2.2).
 * 3. Honnêteté : toute scène est étiquetée « Exemple » ou « Démo », avec une transcription texte.
 * 4. Lisible sans animation : l'état final est le rendu serveur ; l'animation n'est qu'un chemin vers cet état.
 * 5. Budget : composants client minuscules, aucune vidéo chargée avant d'être visible, H1 jamais animé (LCP), CLS 0.
 *
 * Ce module ne contient que des fonctions pures ou des utilitaires navigateur sans état React (testables avec vitest).
 */

/* ---------- Préférences ---------- */

export function reducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Règle V4 « mouvement réduit » (prioritaire, tout le projet) : prefers-reduced-motion coupe le MOUVEMENT
 * (déplacements, zooms, rebonds, parallaxe, défilement fluide, inclinaison, curseur qui se déplace, vidéo en lecture
 * automatique), PAS les animations sans déplacement : fondus, compteurs qui montent, texte qui s'écrit, courbes et
 * jauges qui se tracent, barres qui se remplissent, coche qui se dessine, changement de couleur.
 * Les primitives ne sautent donc jamais l'animation entière : elles ne sautent que la composante de mouvement.
 */
export type MotionKind =
  | "fade" | "count" | "type" | "draw" | "fill" | "color" // sans déplacement : toujours jouées
  | "translate" | "scale" | "bounce" | "parallax" | "tilt" | "smooth-scroll" | "cursor" | "autoplay-video"; // mouvement
export const MOVEMENT_KINDS: readonly MotionKind[] = ["translate", "scale", "bounce", "parallax", "tilt", "smooth-scroll", "cursor", "autoplay-video"];

/** Vrai si une animation de ce type doit jouer (`reduced` : préférence « réduire les animations »). */
export function motionAllowed(kind: MotionKind, reduced: boolean = reducedMotion()): boolean {
  return !reduced || !MOVEMENT_KINDS.includes(kind);
}

export function finePointer(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;
}

/* ---------- Courbes ---------- */

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
export const easeInOutCubic = (t: number) => {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
export function clamp01(t: number) {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}
export function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

/** Mêmes valeurs que les jetons CSS de globals.css (pour la Web Animations API). */
export const EASE = {
  out: "cubic-bezier(.2, .8, .2, 1)",
  ui: "cubic-bezier(.33, 1, .68, 1)",
  inOut: "cubic-bezier(.65, 0, .35, 1)",
  spring: "cubic-bezier(.175, .885, .32, 1.275)",
} as const;

/* ---------- Nombres ---------- */

const nf = new Map<number, Intl.NumberFormat>();
/** Format français : espace insécable fine pour les milliers, virgule décimale. */
export function formatFr(v: number, decimals = 0): string {
  let f = nf.get(decimals);
  if (!f) {
    f = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    nf.set(decimals, f);
  }
  return f.format(v);
}

/** Valeur d'un compteur au temps t (ms) : part de `from`, arrive exactement à `to` à `duration`. */
export function counterValue(from: number, to: number, t: number, duration: number, decimals = 0): number {
  if (duration <= 0 || t >= duration) return to;
  const v = from + (to - from) * easeOutCubic(t / duration);
  const p = Math.pow(10, decimals);
  return Math.round(v * p) / p;
}

/* ---------- Machine à écrire ---------- */

/**
 * Nombre de caractères visibles après `elapsed` ms.
 * `msPerStep` ms par pas de `chunk` caractères (question : 32 ms / 1 car. ; réponse « streaming » : 18 ms / 2 car.).
 */
export function typedLength(total: number, elapsed: number, msPerStep: number, chunk = 1): number {
  if (elapsed <= 0) return 0;
  if (msPerStep <= 0) return total;
  return Math.min(total, Math.floor(elapsed / msPerStep) * chunk);
}

/** Durée totale de frappe d'un texte. */
export function typingDuration(total: number, msPerStep: number, chunk = 1): number {
  return Math.ceil(total / Math.max(1, chunk)) * msPerStep;
}

/* ---------- Jauge ---------- */

export const GAUGE_THRESHOLDS = [40, 70] as const;

/** Tranche d'un score (mêmes seuils que score-bands.ts). */
export function gaugeBand(v: number): 0 | 1 | 2 {
  return v >= GAUGE_THRESHOLDS[1] ? 2 : v >= GAUGE_THRESHOLDS[0] ? 1 : 0;
}

/* ---------- Curseur fantôme ---------- */

/** Durée d'un déplacement du curseur fantôme : proportionnelle à la distance, bornée 350–900 ms. */
export function cursorDuration(dx: number, dy: number): number {
  return Math.round(clamp(Math.hypot(dx, dy) * 1.1, 350, 900));
}

/* ---------- Scènes ---------- */

/**
 * Index de l'étape atteinte au temps t pour une liste d'instants (ms) croissants.
 * Avant le premier instant : 0 ; à partir du dernier : cues.length (état final).
 */
export function phaseAt(cues: readonly number[], t: number): number {
  let n = 0;
  for (const c of cues) if (t >= c) n++;
  return n;
}

/** Valide qu'une liste d'instants de scène est croissante et positive (utilisé par les tests). */
export function validCues(cues: readonly number[]): boolean {
  return cues.every((c, i) => c >= 0 && (i === 0 || c > cues[i - 1]));
}

/**
 * Horloge de scène pausable : n'avance que si `isPaused()` est faux et l'onglet visible.
 * `wait(ms)` se résout après ms de temps « joué ». Rejette avec AbortError si le signal est annulé.
 */
export function makeWait(signal: AbortSignal, isPaused: () => boolean) {
  return (ms: number) =>
    new Promise<void>((resolve, reject) => {
      let left = ms;
      let last = performance.now();
      const tick = (t: number) => {
        if (signal.aborted) return reject(new DOMException("abort", "AbortError"));
        if (!isPaused() && !document.hidden) left -= t - last;
        last = t;
        if (left <= 0) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
}

/* ---------- Observateur partagé ---------- */

type IOCallback = (entry: IntersectionObserverEntry) => void;
const observers = new Map<string, { io: IntersectionObserver; cbs: Map<Element, IOCallback> }>();

/**
 * IntersectionObserver partagé par jeu d'options. Renvoie une fonction de désinscription.
 * Sans IntersectionObserver (vieux navigateur, test) : appelle immédiatement le rappel comme visible.
 */
export function observe(el: Element, cb: IOCallback, opts: { threshold?: number | number[]; rootMargin?: string } = {}) {
  if (typeof IntersectionObserver === "undefined") {
    cb({ isIntersecting: true, intersectionRatio: 1, target: el } as unknown as IntersectionObserverEntry);
    return () => {};
  }
  const key = JSON.stringify([opts.threshold ?? 0, opts.rootMargin ?? "0px"]);
  let o = observers.get(key);
  if (!o) {
    const cbs = new Map<Element, IOCallback>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) cbs.get(e.target)?.(e);
      },
      { threshold: opts.threshold ?? 0, rootMargin: opts.rootMargin ?? "0px" },
    );
    o = { io, cbs };
    observers.set(key, o);
  }
  o.cbs.set(el, cb);
  o.io.observe(el);
  const ref = o;
  return () => {
    ref.cbs.delete(el);
    ref.io.unobserve(el);
  };
}

/* ---------- Formulaire du hero ---------- */

/** Vrai si la saisie ressemble à une adresse de site (« paysia.fr », « https://… ») plutôt qu'à un nom. */
export function looksLikeSite(v: string): boolean {
  const s = v.trim().toLowerCase();
  if (!s || /\s/.test(s)) return false;
  return /^https?:\/\//.test(s) || /^(www\.)?[a-z0-9àâçéèêëîïôûùüÿñæœ-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(\/.*)?$/.test(s);
}
