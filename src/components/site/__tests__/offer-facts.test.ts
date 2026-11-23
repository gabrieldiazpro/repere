import { describe, expect, it } from "vitest";
import { getEntitlements } from "@/lib/entitlements";
import {
  enginesLabel,
  frequencyAdverb,
  frequencySummary,
  offerEntitlements,
  offersIncluding,
  promptsCount,
} from "../offer-facts";
import { compareRows } from "@/components/pages/pricing-data";
import { GRID, GRID_ENGINES, GRID_PASSES, GRID_QUESTIONS } from "../ProofWall";

describe("promesses du site = table des droits", () => {
  it("lit la fréquence et les IA dans getEntitlements", () => {
    const e = getEntitlements({ id: "x", plan: "essentiel", segment: "local", planId: null } as never);
    expect(offerEntitlements("local", "essentiel").frequency).toBe(e.frequency);
    expect(frequencyAdverb("local", "essentiel")).toBe(e.frequency === "monthly" ? "chaque mois" : "chaque semaine");
    expect(promptsCount("local", "decouverte")).toBe(5);
    expect(enginesLabel("local", "decouverte")).toBe("ChatGPT, Gemini, Perplexity");
  });

  it("Claude n'est pas annoncé pour Découverte ni pour Essentiel local", () => {
    expect(enginesLabel("local", "essentiel")).not.toMatch(/Claude/);
    expect(offersIncluding("claude")).not.toMatch(/Découverte/);
    expect(offersIncluding("chatgpt")).toBe("toutes les offres");
  });

  it("la phrase de fréquence dit « chaque mois » pour Essentiel et « chaque semaine » pour Accompagné", () => {
    expect(frequencySummary()).toBe("chaque mois en Découverte et en Essentiel, chaque semaine en Accompagné");
  });

  it("le tableau comparatif /tarifs reprend les droits", () => {
    for (const seg of ["local", "pme", "ecommerce"] as const) {
      const rows = compareRows(seg);
      const freq = rows.find((r) => r.label === "Fréquence des mesures")!;
      expect(String(freq.essentiel).toLowerCase()).toBe(frequencyAdverb(seg, "essentiel"));
      expect(String(freq.accompagne).toLowerCase()).toBe(frequencyAdverb(seg, "accompagne"));
      const q = rows.find((r) => r.label === "Questions suivies")!;
      expect(q.essentiel).toBe(String(promptsCount(seg, "essentiel")));
      expect(q.accompagne).toBe(String(promptsCount(seg, "accompagne")));
    }
  });

  it("le comparatif des fonctionnalités (V10) reprend les IA, les passages et les quotas des droits", () => {
    for (const seg of ["local", "pme", "ecommerce"] as const) {
      const rows = compareRows(seg);
      const ia = rows.find((r) => r.label === "IA interrogées")!;
      const opt = rows.find((r) => r.label === "IA en option")!;
      for (const tier of ["decouverte", "essentiel", "accompagne"] as const) {
        const e = offerEntitlements(seg, tier);
        expect(/Claude/.test(String(ia[tier]))).toBe(e.engines.includes("claude"));
        expect(/AI Overviews/.test(String(ia[tier]))).toBe(e.engines.includes("google_aio"));
        expect(opt[tier] === false).toBe(e.optionalEngines.length === 0);
        const runs = rows.find((r) => r.label === "Passages par question et par IA")!;
        expect(runs[tier]).toBe(`${e.runs} passages`);
      }
    }
  });

  it("V10 : Essentiel mensuel (3 passages), Accompagné hebdomadaire (2 passages), Google dans les offres payantes", () => {
    for (const seg of ["local", "pme", "ecommerce"] as const) {
      expect(frequencyAdverb(seg, "essentiel")).toBe("chaque mois");
      expect(frequencyAdverb(seg, "accompagne")).toBe("chaque semaine");
      expect(offerEntitlements(seg, "essentiel").runs).toBe(3);
      expect(offerEntitlements(seg, "accompagne").runs).toBe(2);
    }
    expect(offersIncluding("google_aio")).toBe("toutes les offres payantes");
    expect(offersIncluding("google_ai_mode")).toBe("toutes les offres payantes");
  });

  it("la grille de méthode du mur de preuves compte 8 × 3 × 2 = 48 réponses", () => {
    expect(GRID.length).toBe(GRID_QUESTIONS);
    expect(GRID.every((r) => r.length === GRID_ENGINES * GRID_PASSES)).toBe(true);
    expect(GRID_QUESTIONS * GRID_ENGINES * GRID_PASSES).toBe(48);
  });
});
