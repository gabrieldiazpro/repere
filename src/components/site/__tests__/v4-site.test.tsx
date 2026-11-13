import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { storyCues, storyText } from "@/components/motion/scenes/story-data";
import { StoryScene } from "@/components/motion/scenes/StoryScene";
import { demoCompetitorMatrix, demoHeroStory, demoLocalMap } from "../demo-figures";
import { AnswerPath } from "../AnswerPath";
import { HomeHero } from "../HomeHero";
import { CompetitorMatrix, NeighborhoodMap, ProductsCited } from "../segment-visuals";
import { SiteTabs } from "../SiteTabs";
import { VideoShowcase } from "../VideoShowcase";

const story = demoHeroStory("local")!;

describe("V4 : scène « Absent, puis cité »", () => {
  it("les étapes sont croissantes et la scène se termine après la dernière", () => {
    for (const seg of ["local", "pme", "ecommerce"] as const) {
      const d = demoHeroStory(seg)!;
      const { cues, total } = storyCues(d);
      expect(cues).toHaveLength(7);
      for (let i = 1; i < cues.length; i++) expect(cues[i]).toBeGreaterThan(cues[i - 1]);
      expect(total).toBeGreaterThan(cues[cues.length - 1]);
      // Lisible : la scène complète dure moins de 20 s.
      expect(total).toBeLessThan(20000);
    }
  });
  it("le texte « streamé » contient chaque nom de la réponse", () => {
    const t = storyText(story.after);
    for (const it of story.after.items) expect(t).toContain(it.name);
  });
  it("le rendu serveur montre l'état final (cité) et une transcription complète", () => {
    const html = renderToStaticMarkup(<StoryScene segment="local" data={story} />);
    expect(html).toContain(story.business);
    expect(html).toContain("Absent");
    expect(html).toContain("Cité, ");
    expect(html).toContain("ce n&#x27;est pas une promesse de résultat");
    expect(html).toContain(`${story.after.score}`);
  });
});

describe("V4 : accueil", () => {
  it("le hero (V5) garde le H1 serveur et un seul appel principal : analyser le site", () => {
    const html = renderToStaticMarkup(
      <HomeHero preview={<p>Aperçu</p>}>
        <h1>Google et les IA décident qui vos clients trouvent.</h1>
      </HomeHero>,
    );
    expect(html).toContain("<h1>Google et les IA");
    expect(html.match(/type="submit"/g)).toHaveLength(1);
    expect(html).toContain("Analyser mon site");
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("Aperçu");
  });
  it("le schéma question → IA → sources → réponse → vous est en HTML, sans logo d'IA", () => {
    const html = renderToStaticMarkup(<AnswerPath />);
    for (const t of ["Une question", "Une IA", "Des sources", "Trois à cinq noms", "Et vous ?"]) expect(html).toContain(t.replace("'", "&#x27;"));
    expect(html).not.toMatch(/openai|anthropic|perplexity-logo|gemini-logo/i);
  });
  it("les onglets rendent tous les panneaux côté serveur, un seul visible", () => {
    const html = renderToStaticMarkup(
      <SiteTabs
        label="Test"
        numbered
        tabs={[
          { id: "a", label: "Mesurer", panel: <p>Panneau A</p> },
          { id: "b", label: "Comprendre", panel: <p>Panneau B</p> },
        ]}
      />,
    );
    expect(html).toContain("Panneau A");
    expect(html).toContain("Panneau B");
    expect(html.match(/role="tabpanel"[^>]*hidden/g)).toHaveLength(1);
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1);
  });
  it("la vidéo n'est jamais préchargée et propose le plein écran", () => {
    const html = renderToStaticMarkup(
      <VideoShowcase files={{ mp4: "/videos/x.mp4", webm: null, poster: "/videos/x.jpg", vtt: null }} label="Démo" title="Titre" />,
    );
    expect(html).toContain('preload="none"');
    expect(html).toContain('poster="/videos/x.jpg"');
    expect(html).toContain("Plein écran");
  });
});

describe("V4 : visuels des parcours (données des comptes démo)", () => {
  it("carte de quartier : chaque zone et son taux sont dans le HTML", async () => {
    const map = (await demoLocalMap())!;
    const html = renderToStaticMarkup(<NeighborhoodMap map={map} />);
    for (const z of map.zones) expect(html).toContain(z.n);
    expect(html).toContain("Compte démo");
  });
  it("matrice concurrents : vous êtes mis en avant", () => {
    const m = demoCompetitorMatrix("pme");
    const html = renderToStaticMarkup(<CompetitorMatrix m={m} />);
    expect(html).toContain(">vous<");
    for (const e of m.engines) expect(html).toContain(e);
  });
  it("produits cités : la fréquence est écrite en clair", () => {
    const html = renderToStaticMarkup(<ProductsCited d={{ account: "Maison Sora", products: [{ name: "Shampoing", appearances: 8, answers: 36 }] }} />);
    expect(html).toContain("cité dans 8 réponses sur 36");
  });
});

describe("V4 : pied de page", () => {
  it("le lien vers /dpa est présent", () => {
    const src = readFileSync(path.join(process.cwd(), "src/components/site/Footer.tsx"), "utf8");
    expect(src).toContain('href: "/dpa"');
  });
});
