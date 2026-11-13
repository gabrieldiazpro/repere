"use client";

import { typedLength, typingDuration } from "./lib";
import { useClock } from "./useClock";
import { useScene } from "./SceneContext";

/**
 * Machine à écrire (primitive 4). Hors lecture (`play` faux) : texte complet, rendu serveur compris.
 * Question : 32 ms par caractère ; réponse en « streaming » : `msPerStep={18} chunk={2}`.
 * Le texte complet est toujours dans le DOM pour les lecteurs d'écran (sr-only) ; la partie animée est aria-hidden.
 */
export function Typewriter({
  text,
  play = false,
  msPerStep = 32,
  chunk = 1,
  cursor = true,
  className = "",
}: {
  text: string;
  play?: boolean;
  msPerStep?: number;
  chunk?: number;
  cursor?: boolean;
  className?: string;
}) {
  const { playing } = useScene();
  const total = typingDuration(text.length, msPerStep, chunk);
  const active = !!play; // le texte s'écrit aussi en mouvement réduit (pas de déplacement)
  const t = useClock(active, total);
  // Dans une scène en cours de lecture, avant son étape : rien d'écrit (la place reste réservée).
  const waiting = playing && !play;
  const n = waiting ? 0 : active ? typedLength(text.length, t, msPerStep, chunk) : text.length;
  const typing = active && n < text.length;
  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {text.slice(0, n)}
        {typing && cursor ? (
          <span className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[2px] bg-current animate-blink" />
        ) : null}
        {/* Réserve la place du texte restant : aucune variation de hauteur pendant la frappe (CLS 0). */}
        {n < text.length ? <span className="invisible">{text.slice(n)}</span> : null}
      </span>
    </span>
  );
}

export default Typewriter;
