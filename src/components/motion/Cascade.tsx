/**
 * Cascade d'apparition (CSS seule, composant serveur) : chaque enfant direct apparaît en fondu (+ légère montée hors
 * mouvement réduit) avec 70 ms de décalage. Contrairement à <Reveal>, fonctionne en navigation client (app) et ne
 * dépend pas de <MotionRoot>. À utiliser une fois par écran, sur la grille principale — pas sur chaque liste.
 */
import type { CSSProperties, ElementType, ReactNode } from "react";

export function Cascade({
  as: Tag = "div",
  className = "",
  style,
  children,
  ...rest
}: {
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  id?: string;
  "aria-label"?: string;
}) {
  return (
    <Tag className={`ui-cascade ${className}`} style={style} {...rest}>
      {children}
    </Tag>
  );
}

export default Cascade;
