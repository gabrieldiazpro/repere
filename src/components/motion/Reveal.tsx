/**
 * Reveal au scroll (primitive 1) + décalage (primitive 2). Composant serveur : il ne pose que des attributs ;
 * <MotionRoot /> (une fois par page) fait le reste. Sans JavaScript, le contenu est visible.
 */
import type { CSSProperties, ElementType, ReactNode } from "react";

type RevealProps = {
  as?: ElementType;
  /** Rang dans la fratrie : décalage de i × 70 ms (plafonné à 6). */
  i?: number;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  href?: string;
};

export function Reveal({ as: Tag = "div", i = 0, style, children, ...rest }: RevealProps) {
  return (
    <Tag data-reveal="" style={{ ...style, ["--i" as string]: i }} {...rest}>
      {children}
    </Tag>
  );
}

export default Reveal;
