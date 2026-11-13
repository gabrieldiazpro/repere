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
import { DETAILS } from "../PricingExplorer";
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

  it("la phrase de fréquence dit « chaque mois » pour l'Essentiel local", () => {
    expect(frequencySummary()).toMatch(/chaque mois en Essentiel commerce local/);
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

  it("le détail des offres (composant client) ne contredit pas les droits", () => {
    for (const seg of ["local", "pme", "ecommerce"] as const) {
      const qRow = DETAILS[seg][0];
      for (const [col, tier] of [[2, "essentiel"], [3, "accompagne"]] as const) {
        const cell = String(qRow.v[col]);
        expect(cell.startsWith(String(promptsCount(seg, tier)))).toBe(true);
        expect(cell).toContain(frequencyAdverb(seg, tier));
        const ia = String(DETAILS[seg][1].v[col]);
        const hasClaude = offerEntitlements(seg, tier).engines.includes("claude");
        expect(/Claude/.test(ia) || (tier === "accompagne" && /Les 3, plus Claude|4 IA/.test(ia))).toBe(hasClaude);
      }
    }
  });

  it("la grille de méthode du mur de preuves compte 8 × 3 × 2 = 48 réponses", () => {
    expect(GRID.length).toBe(GRID_QUESTIONS);
    expect(GRID.every((r) => r.length === GRID_ENGINES * GRID_PASSES)).toBe(true);
    expect(GRID_QUESTIONS * GRID_ENGINES * GRID_PASSES).toBe(48);
  });
});
