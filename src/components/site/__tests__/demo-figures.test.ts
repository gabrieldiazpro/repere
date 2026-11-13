import { describe, expect, it } from "vitest";
import { buildDemoWorkspace } from "@/lib/demo-v2";
import { auditStats, mentionRateOf, shareOfVoiceOf } from "@/lib/digest/stats";
import {
  demoAbsentAnswer,
  demoHeroAnswer,
  demoHeroScene,
  demoMeasure,
  demoSources,
  demoTraffic,
  measureSceneData,
  orNull,
  topRows,
  understandSceneData,
} from "../demo-figures";

const SEGS = ["local", "pme", "ecommerce"] as const;
const statsOf = (seg: (typeof SEGS)[number]) => auditStats(buildDemoWorkspace(seg).audits.at(-1)!);

describe("le site montre les chiffres des comptes démo (B9, amélioration 13)", () => {
  it("rang, taux de mention et part de voix = auditStats du compte", () => {
    for (const seg of SEGS) {
      const m = demoMeasure(seg);
      const s = statsOf(seg);
      expect(m.rank).toBe(s.rank);
      expect(m.of).toBe(s.of);
      expect(m.citations).toBe(s.citations);
      expect(m.answers).toBe(s.answers);
      expect(m.mentionRate).toBe(Math.round(mentionRateOf(s) * 100));
      expect(m.shareOfVoice).toBe(Math.round(shareOfVoiceOf(s) * 100));
      expect(m.rows.map((r) => r.name)).toEqual(s.rows.map((r) => r.name));
    }
  });

  it("aucun nom de concurrent absent du compte (plus de Silva RH, Bulletin+, Plombier Express Bastille…)", () => {
    for (const seg of SEGS) {
      const known = new Set(statsOf(seg).rows.map((r) => r.name));
      for (const a of demoMeasure(seg).question.answers) for (const n of a.names) expect(known.has(n), `${seg} : ${n}`).toBe(true);
      for (const it of demoHeroAnswer(seg).items) expect(known.has(it.name), `${seg} : ${it.name}`).toBe(true);
      const chat = demoAbsentAnswer(seg);
      if (chat) {
        for (const it of chat.items) expect(known.has(it.name)).toBe(true);
        expect(chat.items.some((it) => it.name === chat.business)).toBe(false);
      }
    }
    const pme = JSON.stringify([measureSceneData(), understandSceneData(), demoHeroScene("pme")]);
    expect(pme).not.toMatch(/Silva RH|Bulletin\+/);
  });

  it("hero : la réponse au premier plan et les badges disent le même rang", () => {
    for (const seg of SEGS) {
      const d = demoHeroScene(seg);
      const main = d.engines.find((e) => e.ia === d.main.ia)!;
      const idx = d.main.items.findIndex((it) => it.you);
      expect(main.rank).toBe(idx === -1 ? null : idx + 1);
      expect(d.answers).toBe(`Cité dans ${demoMeasure(seg).citations} réponses sur ${demoMeasure(seg).answers}`);
    }
  });

  it("le classement montré contient toujours le compte", () => {
    for (const seg of SEGS) expect(topRows(demoMeasure(seg), 5).some((r) => r.you)).toBe(true);
  });

  it("sources : la présence affichée vient du rapport de sources du compte", () => {
    const s = demoSources("pme");
    const domains = buildDemoWorkspace("pme").audits.at(-1)!.sources!.domains;
    for (const r of s.rows) expect(r.here).toBe(domains.find((d) => d.domain === r.d)!.clientPresence === "present");
    expect(s.ahead).toBe(statsOf("pme").ahead?.name);
  });

  it("trafic : 30 jours et 12 semaines, mêmes fenêtres que l'écran du compte", async () => {
    const t = await demoTraffic("ecommerce");
    expect(t.weekly).toHaveLength(12);
    expect(t.orders30).not.toBeNull();
    expect(t.engines.reduce((a, e) => a + e.v, 0)).toBeLessThanOrEqual(100);
  });

  it("orNull : un calcul impossible n'affiche rien plutôt qu'un chiffre faux", async () => {
    expect(await orNull(Promise.reject(new Error("store indisponible")))).toBeNull();
  });
});

import { demoHeroStory as _story, demoCompetitorMatrix as _matrix } from "../demo-figures";
describe("V4 : histoire du hero et matrice", () => {
  it("chaque parcours a une vraie histoire absent → cité, sur la même question et la même IA", () => {
    for (const seg of ["local", "pme", "ecommerce"] as const) {
      const st = _story(seg);
      expect(st, seg).not.toBeNull();
      expect(st!.before.rank).toBeNull();
      expect(st!.after.rank).toBeGreaterThan(0);
      expect(st!.before.items.some((i) => i.you)).toBe(false);
      expect(st!.after.items.some((i) => i.you)).toBe(true);
      expect(st!.after.score).toBeGreaterThan(st!.before.score);
    }
  });
  it("la matrice contient vous et des taux entre 0 et 100", () => {
    const m = _matrix("pme");
    expect(m.rows.some((r) => r.you)).toBe(true);
    for (const r of m.rows) for (const v of r.rates) expect(v).toBeGreaterThanOrEqual(0), expect(v).toBeLessThanOrEqual(100);
    expect(m.rows[0].rates.length).toBe(m.engines.length);
  });
});
