import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getPlan } from "@/lib/plans";
import { WE_NEVER, YOU_VALIDATE, accompagneFeatures, deliverableExamples, firstMonth } from "../accompagne-data";

const APP = path.join(process.cwd(), "src", "app");
function routeExists(href: string): boolean {
  const parts = href.split(/[?#]/)[0].split("/").filter(Boolean);
  function walk(dir: string, i: number): boolean {
    if (i === parts.length) return existsSync(path.join(dir, "page.tsx")) || existsSync(path.join(dir, "route.ts"));
    const exact = path.join(dir, parts[i]);
    if (existsSync(exact) && walk(exact, i + 1)) return true;
    if (!existsSync(dir)) return false;
    return readdirSync(dir)
      .filter((d) => /^\[[^.]+\]$/.test(d))
      .some((d) => walk(path.join(dir, d), i + 1));
  }
  return walk(APP, 0);
}

const SEGS = ["local", "pme", "ecommerce"] as const;
const ALL_TEXT = (s: (typeof SEGS)[number]) =>
  JSON.stringify([deliverableExamples(s), firstMonth(s), accompagneFeatures(s), YOU_VALIDATE, WE_NEVER]);

describe("rassurer avant Accompagné (amélioration 15)", () => {
  it("chaque livrable d'exemple pointe vers une route qui existe", () => {
    for (const s of SEGS) for (const e of deliverableExamples(s)) expect(routeExists(e.href), e.href).toBe(true);
  });

  it("au moins un livrable réel (Repéré pour lui-même) et tout le reste étiqueté démo", () => {
    for (const s of SEGS) {
      const ex = deliverableExamples(s);
      expect(ex.some((e) => e.kind === "reel")).toBe(true);
      for (const e of ex.filter((x) => x.kind === "demo")) expect(e.title).toMatch(/compte démo/);
    }
  });

  it("le premier mois compte 5 étapes, chacune dit ce que le client valide", () => {
    for (const s of SEGS) {
      const steps = firstMonth(s);
      expect(steps).toHaveLength(5);
      for (const st of steps) expect(st.you.length).toBeGreaterThan(20);
    }
  });

  it("le contenu mensuel vient de la grille", () => {
    for (const s of SEGS) {
      const id = s === "ecommerce" ? "ecom_accompagne_month" : (`${s}_accompagne_month` as const);
      const plan = getPlan(id).features;
      for (const f of accompagneFeatures(s)) expect(plan).toContain(f);
    }
  });

  it("aucune fausse preuve : ni client, ni avis, ni chiffre de résultat promis", () => {
    for (const s of SEGS) {
      const t = ALL_TEXT(s);
      expect(t).not.toMatch(/\bnos clients\b|témoign|étoiles|\+\s?\d+\s?%|garanti(e|ssons)? (une|la) (position|place)/i);
      expect(t).not.toMatch(/\[à compléter\]/i);
    }
  });
});
