import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CHECKS, SECTIONS } from "@/lib/seoaudit";
import { getEntitlements } from "@/lib/entitlements";
import { SOFTWARE_FEATURES } from "@/lib/seo/jsonld";
import { GUIDES, getGuide } from "@/lib/seo/guides";
import { GUIDES_V5 } from "@/lib/seo/guides-v5";
import { CELLS, COMPETITORS, FEATURES as CMP_FEATURES } from "@/lib/seo/competitors";
import { FEATURES, getFeature } from "@/components/pages/features-data";
import { GUIDE_FIGURE_IDS, GuideFigure } from "@/components/pages/guide-figures";
import { seoOfferRows } from "@/components/pages/SeoOfferTable";
import { v5OfferFacts } from "../offer-facts";
import { ChecksMap, FamilyCompare, GEO_SECTIONS, HeroAnalysisPreview, SEO_CHECK_COUNT, TwoReaders, seoSectionCounts } from "../v5-blocks";

describe("V5 : chiffres du produit lus dans le code", () => {
  it("le nombre de contrôles affiché est celui du catalogue SEO-AUDIT, partout", () => {
    expect(SEO_CHECK_COUNT).toBe(CHECKS.length);
    expect(seoSectionCounts().reduce((a, s) => a + s.count, 0)).toBe(CHECKS.length);
    expect(seoSectionCounts()).toHaveLength(SECTIONS.length);
    // JSON-LD et llms.txt : le texte recopié doit suivre le catalogue.
    expect(SOFTWARE_FEATURES.join(" ")).toContain(`${CHECKS.length} contrôles en ${SECTIONS.length} familles`);
    expect(SOFTWARE_FEATURES.join(" ")).toContain(`${GEO_SECTIONS.length} familles`);
  });
  it("les familles GEO du site sont celles du module (llms.txt hors note)", () => {
    expect(GEO_SECTIONS.map((g) => g.id).sort()).toEqual(["acces", "donnees", "entite", "fraicheur", "hors_site", "llms", "passages", "questions"]);
    expect(GEO_SECTIONS.find((g) => g.id === "llms")!.weight).toBe(0);
  });
  it("les droits SEO et agent affichés sur /tarifs viennent des entitlements", () => {
    const ent = (plan: string, segment: string) => getEntitlements({ id: `t-${plan}-${segment}`, plan, segment, planId: null } as never);
    expect(v5OfferFacts("local", "essentiel").keywords).toBe(ent("essentiel", "local").seoData.keywords);
    expect(v5OfferFacts("pme", "accompagne").pages).toBe(ent("accompagne", "pme").analysis.maxPages);
    expect(v5OfferFacts("local", "decouverte").apply).toBe(false);
    const rows = seoOfferRows();
    const agent = rows.find((r) => r.label === "Agent de publication")!;
    expect(agent.cells[0]).toMatch(/télécharger/);
    expect(agent.cells[2]).toContain(String(ent("accompagne", "pme").publish.changeSetsPerMonth));
  });
});

describe("V5 : accueil", () => {
  it("l'aperçu d'analyse est étiqueté comme exemple fictif et dit pour quel lecteur compte chaque priorité", () => {
    const html = renderToStaticMarkup(<HeroAnalysisPreview />);
    expect(html).toContain("Exemple illustratif sur un site fictif");
    expect(html).toContain("Compte pour : Google");
    expect(html).toContain("Compte pour : IA");
  });
  it("les schémas sont en HTML, sans logo d'IA ni d'outil concurrent", () => {
    const html = renderToStaticMarkup(
      <>
        <TwoReaders />
        <ChecksMap />
        <FamilyCompare />
      </>,
    );
    expect(html).toContain("Les IA citent des passages");
    expect(html).toContain(`${CHECKS.length} contrôles`);
    expect(html).not.toMatch(/<img|logo/i);
  });
});

describe("V5 : fonctionnalités", () => {
  it("les 7 nouvelles fonctions existent, avec limites, étapes et un title court", () => {
    for (const slug of ["analyse-60-secondes", "audit-seo", "positions-et-search-console", "performance", "geo-avance", "agent-de-publication", "barometres"]) {
      const f = getFeature(slug)!;
      expect(f.kind).toBe("socle");
      expect(f.limits.length).toBeGreaterThan(0);
      expect(f.how.length).toBeGreaterThanOrEqual(3);
      expect(`${f.seoTitle ?? f.title}`.length).toBeLessThanOrEqual(60);
      for (const r of f.related) expect(FEATURES.some((x) => x.slug === r)).toBe(true);
    }
  });
});

describe("V5 : guides", () => {
  it("le pilier et les satellites ont sources, FAQ, schéma et appel vers l'analyse", () => {
    const slugs = ["seo-geo-sites-pros-2026", "seo-local-et-ia", "fiche-produit-et-ia", "donnees-structurees-utiles", "robots-ia-robots-txt", "search-console-debutants", "core-web-vitals-sans-jargon"];
    for (const s of slugs) {
      const g = getGuide(s)!;
      expect(g, s).toBeTruthy();
      expect(g.faq?.length ?? 0).toBeGreaterThanOrEqual(2);
      expect(g.sections.some((x) => x.figure && (GUIDE_FIGURE_IDS as readonly string[]).includes(x.figure))).toBe(true);
      expect(g.cta.href).toBe("/analyse");
      for (const r of g.related) expect(getGuide(r), `${s} → ${r}`).toBeTruthy();
    }
    expect(GUIDES[0].slug).toBe("seo-geo-sites-pros-2026");
  });
  it("chaque renvoi [n] des nouveaux guides pointe vers une source existante, toutes officielles ou datées", () => {
    for (const g of GUIDES_V5) {
      const text = [...g.intro, ...g.sections.flatMap((s) => [...(s.paras ?? []), ...(s.list ?? []), ...(s.after ?? [])])].join(" ");
      const refs = [...text.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
      expect(Math.max(...refs), g.slug).toBeLessThanOrEqual(g.sources.length);
      expect(text).not.toMatch(/(résultats?|positions?|citations?) garantie?s?|n° ?1 sur|explosez/i);
      for (const s of g.sources) expect(s.url).toMatch(/^https:\/\//);
    }
  });
  it("les schémas SVG ont un titre et une description accessibles", () => {
    for (const id of GUIDE_FIGURE_IDS) {
      const html = renderToStaticMarkup(<GuideFigure id={id} />);
      expect(html, id).toMatch(/<title id="[^"]+">[^<]+<\/title><desc/);
      expect(html).toContain("figcaption");
    }
  });
});

describe("V5 : comparatifs", () => {
  it("Semrush, Ahrefs et Screaming Frog sont renseignés sur chaque ligne, avec date de relevé", () => {
    for (const slug of ["semrush", "ahrefs", "screaming-frog"] as const) {
      const c = COMPETITORS.find((x) => x.slug === slug)!;
      expect(c.checked).toBe("2026-11-13");
      expect(c.strengths.length).toBeGreaterThanOrEqual(3);
      for (const f of CMP_FEATURES) expect(CELLS[slug][f.id], `${slug}.${f.id}`).toBeTruthy();
      expect(CELLS[slug].prix).toMatch(/\[@\w+\]/);
    }
  });
});

describe("V5 : métadonnées dans les limites de notre propre audit", () => {
  it("fitDescription garde des phrases entières, ne coupe pas « robots.txt », et tient en 160 caractères", async () => {
    const { fitDescription, pageMeta } = await import("@/lib/seo/meta");
    const long = "Vérifiez votre robots.txt pour les robots d’IA en une minute, gratuitement et sans inscription, avec la correction prête. Deuxième phrase assez longue pour dépasser la limite fixée par Google aujourd’hui.";
    const d = fitDescription(long);
    expect(d.length).toBeLessThanOrEqual(160);
    expect(d.startsWith("Vérifiez votre robots.txt")).toBe(true);
    expect(d.endsWith(".")).toBe(true);
    const cut = fitDescription("x".repeat(10) + " mot".repeat(60));
    expect(cut.length).toBeLessThanOrEqual(160);
    expect(cut.endsWith("…")).toBe(true);
    const m = pageMeta({ path: "/x", title: "Un titre bien trop long pour tenir avec le suffixe de la marque", description: long });
    expect(m.title).toEqual({ absolute: "Un titre bien trop long pour tenir avec le suffixe de la marque" });
  });
});
