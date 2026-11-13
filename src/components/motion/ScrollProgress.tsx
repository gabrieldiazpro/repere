/**
 * Barre de progression de lecture (primitive 8), 100 % CSS (animation-timeline: scroll()).
 * Sans support : la barre reste vide (aucun coût). Mouvement réduit : pas d'animation.
 */
export function ScrollProgress() {
  return (
    <div className="scroll-progress" aria-hidden="true">
      <div className="scroll-progress-fill" />
    </div>
  );
}

export default ScrollProgress;
