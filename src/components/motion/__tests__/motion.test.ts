import { describe, expect, it } from "vitest";
import {
  clamp01,
  counterValue,
  cursorDuration,
  easeOutCubic,
  formatFr,
  gaugeBand,
  looksLikeSite,
  phaseAt,
  typedLength,
  typingDuration,
  validCues,
} from "../lib";
import { findDemoVideo } from "../videos";
import { heroCues, citedCount } from "../scenes/hero-data";
import { demoHeroScene, demoMeasure, measureSceneData, proveSceneData } from "@/components/site/demo-figures";

const HERO_SCENES = { local: demoHeroScene("local"), pme: demoHeroScene("pme"), ecommerce: demoHeroScene("ecommerce") };
import { MEASURE_CUES, MEASURE_TOTAL } from "../scenes/MeasureScene";
import { UNDERSTAND_CUES, UNDERSTAND_TOTAL } from "../scenes/UnderstandScene";
import { ACT_CUES, ACT_TOTAL } from "../scenes/ActScene";
import { PROVE_CUES, PROVE_TOTAL } from "../scenes/ProveScene";
import { bandFor } from "@/components/site/score-bands";

describe("courbes et compteurs", () => {
  it("easeOutCubic est bornée", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(2)).toBe(1);
    expect(clamp01(-1)).toBe(0);
  });
  it("le compteur arrive exactement à la valeur finale", () => {
    expect(counterValue(0, 772, 0, 900)).toBe(0);
    expect(counterValue(0, 772, 900, 900)).toBe(772);
    expect(counterValue(0, 772, 5000, 900)).toBe(772);
    const mid = counterValue(0, 100, 450, 900);
    expect(mid).toBeGreaterThan(50);
    expect(mid).toBeLessThan(100);
    expect(counterValue(0, 12.5, 900, 900, 1)).toBe(12.5);
  });
  it("formate en français", () => {
    expect(formatFr(1234).replace(/\s/g, " ")).toBe("1 234");
    expect(formatFr(3.5, 1)).toBe("3,5");
  });
});

describe("machine à écrire", () => {
  it("avance par pas et s'arrête au total", () => {
    expect(typedLength(10, 0, 32)).toBe(0);
    expect(typedLength(10, 64, 32)).toBe(2);
    expect(typedLength(10, 10_000, 32)).toBe(10);
    expect(typedLength(10, 36, 18, 2)).toBe(4);
    expect(typingDuration(10, 18, 2)).toBe(90);
  });
});

describe("jauge et curseur", () => {
  it("les seuils de la jauge sont ceux des tranches de score", () => {
    for (const v of [0, 39, 40, 69, 70, 100]) {
      expect(["Invisible", "Peu visible", "Bien recommandé"][gaugeBand(v)]).toBe(bandFor(v).label);
    }
  });
  it("le curseur fantôme se déplace entre 350 et 900 ms", () => {
    expect(cursorDuration(0, 0)).toBe(350);
    expect(cursorDuration(3000, 0)).toBe(900);
    expect(cursorDuration(500, 0)).toBe(550);
  });
});

describe("scènes", () => {
  const scenes = [
    ["Mesurer", MEASURE_CUES, MEASURE_TOTAL, 8000],
    ["Comprendre", UNDERSTAND_CUES, UNDERSTAND_TOTAL, 9000],
    ["Agir", ACT_CUES, ACT_TOTAL, 9500],
    ["Prouver", PROVE_CUES, PROVE_TOTAL, 9000],
  ] as const;
  it.each(scenes)("%s : instants croissants, durée de la spécification", (_n, cues, total, spec) => {
    expect(validCues(cues)).toBe(true);
    expect(total).toBe(spec);
    expect(cues[cues.length - 1]).toBeLessThan(total);
    expect(phaseAt(cues, total)).toBe(cues.length);
    expect(phaseAt(cues, -1)).toBe(0);
  });
  it("hero : instants croissants, sous 12 s, pour les 3 parcours", () => {
    for (const d of Object.values(HERO_SCENES)) {
      const { cues, total } = heroCues(d);
      expect(validCues(cues)).toBe(true);
      expect(cues).toHaveLength(8);
      expect(total).toBeGreaterThan(cues[7]);
      expect(total).toBeLessThan(12_000);
    }
  });
  it("hero : données des comptes démo cohérentes (IA principale présente, rang conforme à la réponse)", () => {
    for (const d of Object.values(HERO_SCENES)) {
      expect(d.engines.map((e) => e.ia)).toEqual(["ChatGPT", "Gemini", "Perplexity"]);
      const main = d.engines.find((e) => e.ia === d.main.ia);
      expect(main).toBeDefined();
      const youIdx = d.main.items.findIndex((it) => it.you);
      expect(main!.rank).toBe(youIdx + 1);
      for (const e of d.engines) {
        const idx = e.names.findIndex((n) => n.startsWith(d.business));
        expect(e.rank).toBe(idx === -1 ? null : idx + 1);
      }
      expect(citedCount(d)).toBeGreaterThan(0);
      expect(d.score).toBeGreaterThanOrEqual(0);
      expect(d.score).toBeLessThanOrEqual(100);
    }
  });
  it("Mesurer : badges cohérents avec les listes, part de voix décroissante, chiffres du compte démo", () => {
    const d = measureSceneData();
    for (const a of d.answers) {
      const idx = a.names.indexOf(d.account);
      expect(a.you).toBe(idx + 1);
    }
    const v = d.sov.filter((x) => !x.you).map((x) => x.v);
    expect([...v].sort((a, b) => b - a)).toEqual(v);
    const m = demoMeasure("pme");
    expect(d.sov.find((x) => x.you)?.v).toBe(m.shareOfVoice);
    expect(d.analysed).toBe(m.answers);
  });
  it("Prouver : chiffres du trafic démo, 12 semaines", async () => {
    const d = await proveSceneData();
    expect(d.weekly).toHaveLength(12);
    expect(d.visits30).toBeGreaterThan(0);
    expect(d.engines.reduce((a, e) => a + e.v, 0)).toBeLessThanOrEqual(100);
  });
});

describe("formulaire du hero", () => {
  it("distingue un site d'un nom", () => {
    expect(looksLikeSite("paysia.fr")).toBe(true);
    expect(looksLikeSite("https://www.maisonsora.fr/produits")).toBe(true);
    expect(looksLikeSite("www.plomberie-martin.fr")).toBe(true);
    expect(looksLikeSite("Plomberie Martin")).toBe(false);
    expect(looksLikeSite("Paysia")).toBe(false);
    expect(looksLikeSite("")).toBe(false);
  });
});

describe("DemoVideo : détection des fichiers", () => {
  it("sans fichier : null (repli sur la scène)", () => {
    expect(findDemoVideo("mesurer", () => false, "/x")).toBeNull();
  });
  it("avec mp4 et poster", () => {
    const have = new Set(["/x/videos/agir.mp4", "/x/videos/agir.jpg"]);
    expect(findDemoVideo("agir", (p) => have.has(p), "/x")).toEqual({ mp4: "/videos/agir.mp4", webm: null, poster: "/videos/agir.jpg", vtt: null });
  });
  it("webm seul suffit ; une erreur de lecture vaut absence", () => {
    expect(findDemoVideo("hero", (p) => p.endsWith("hero.webm"), "/x")?.webm).toBe("/videos/hero.webm");
    expect(
      findDemoVideo("hero", () => {
        throw new Error("EACCES");
      }, "/x"),
    ).toBeNull();
  });
  it("refuse un identifiant inconnu", () => {
    expect(findDemoVideo("../secret" as never, () => true, "/x")).toBeNull();
  });
});
