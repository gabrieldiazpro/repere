import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MOVEMENT_KINDS, motionAllowed } from "../lib";

const root = join(__dirname, "..", "..", "..", "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

/** Contenu des blocs @media (prefers-reduced-motion: reduce) { … } d'une feuille. */
function reducedBlocks(css: string): string[] {
  const out: string[] = [];
  const re = /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    while (i < css.length && depth) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}") depth--;
      i++;
    }
    out.push(css.slice(start, i - 1));
  }
  return out;
}

describe("mouvement réduit (règle V4) : on coupe le mouvement, pas l'animation", () => {
  it("les animations sans déplacement jouent toujours", () => {
    for (const k of ["fade", "count", "type", "draw", "fill", "color"] as const) {
      expect(motionAllowed(k, true)).toBe(true);
      expect(motionAllowed(k, false)).toBe(true);
    }
  });
  it("les déplacements sont coupés seulement en mouvement réduit", () => {
    for (const k of MOVEMENT_KINDS) {
      expect(motionAllowed(k, true)).toBe(false);
      expect(motionAllowed(k, false)).toBe(true);
    }
  });
  it("aucune feuille racine ne coupe toutes les animations d'un coup", () => {
    for (const f of ["src/app/globals.css", "src/components/ui/ui.css", "src/components/app/app.css"]) {
      for (const block of reducedBlocks(read(f))) {
        // Sélecteur universel + animation/transition coupée = l'ancienne règle interdite.
        expect(block).not.toMatch(/(^|[\s,};])\*(::?(before|after))?\s*[,{][^}]*(animation|transition)(-duration)?\s*:\s*(none|0\.01ms|0s)/);
      }
    }
  });
  it("les keyframes de déplacement sont redéfinies en fondu sous la préférence", () => {
    const block = reducedBlocks(read("src/app/globals.css")).join("\n");
    for (const k of ["sc-enter", "sc-pop", "ui-fade-up", "rp-settle"]) expect(block).toContain(`@keyframes ${k}`);
    expect(block).not.toMatch(/@keyframes[^{]+\{[^@]*(translate|scale)\(/);
  });
  it("les primitives ne sautent plus l'animation entière", () => {
    for (const f of ["Counter.tsx", "ChartDraw.tsx", "GaugeMorph.tsx", "Typewriter.tsx"]) {
      const src = read(`src/components/motion/${f}`);
      expect(src).not.toMatch(/reducedMotion\(\)|scene\.reduced|!reduced/);
    }
  });
});
