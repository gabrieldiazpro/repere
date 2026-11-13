import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { computeRoi, eur, sanitize } from "../roi";
import { CHANGELOG, changelogRss, frDate, sortedChangelog } from "../changelog";
import { contactMailto, leadPayload, validateContact, type ContactFields } from "../contact";
import { merciSteps, purchaseKind, spaceHref } from "../merci";
import { FEATURES, HUB_ANCHORS, getFeature } from "../features-data";
import { HELP_ARTICLES } from "../aide-data";
import { USE_CASES } from "../cas-usage-data";
import { DEMO_ACCOUNTS, demoAppHref } from "../demo-data";
import { compareRows } from "../pricing-data";
import { FOOTER_COLUMNS, NAV_GROUPS, PRODUCT, RESOURCES, signupHrefFor } from "@/components/site/nav";

const APP = path.join(process.cwd(), "src", "app");

/** Une route interne existe si un page.tsx / route.ts correspond (segments dynamiques acceptés). */
function routeExists(href: string): boolean {
  const clean = href.split(/[?#]/)[0];
  if (clean === "/") return true;
  const parts = clean.split("/").filter(Boolean);
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

describe("calculateur de rentabilité", () => {
  it("calcule le seuil et la valeur de l'hypothèse", () => {
    const r = computeRoi({ clientValue: 180, clientsPerMonth: 1, monthlyPriceCents: 9900 });
    expect(r.yearlyCost).toBe(1188);
    expect(r.yearlyValue).toBe(2160);
    expect(r.breakEvenClientsPerYear).toBe(7);
    expect(r.balance).toBe(972);
    expect(r.ratio).toBe(1.8);
  });
  it("gère les valeurs nulles, négatives ou invalides sans promesse", () => {
    expect(computeRoi({ clientValue: 0, clientsPerMonth: 3, monthlyPriceCents: 2900 }).breakEvenClientsPerYear).toBeNull();
    expect(computeRoi({ clientValue: -50, clientsPerMonth: -2, monthlyPriceCents: 2900 }).yearlyValue).toBe(0);
    expect(computeRoi({ clientValue: 100, clientsPerMonth: 1, monthlyPriceCents: 0 }).ratio).toBeNull();
    expect(sanitize("12,5", 0, 100)).toBe(12.5);
    expect(sanitize("abc", 0, 100, 7)).toBe(7);
    expect(sanitize(1e9, 0, 100)).toBe(100);
  });
  it("formate en euros avec espace insécable", () => {
    expect(eur(1188)).toBe("1 188 €");
  });
});

describe("journal des nouveautés", () => {
  it("a des identifiants uniques et des dates valides", () => {
    const ids = CHANGELOG.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of CHANGELOG) expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("trie du plus récent au plus ancien, V3 avant V1 à date égale", () => {
    const s = sortedChangelog();
    expect(s[0].version).toBe("V3");
    expect(s[s.length - 1].version).toBe("V1");
  });
  it("produit un flux RSS échappé", () => {
    const xml = changelogRss("https://exemple.fr", [{ id: "a", date: "2026-11-09", version: "V3", tag: "Nouveau", title: "A & B <c>", text: "t" }]);
    expect(xml).toContain("<rss version=\"2.0\">");
    expect(xml).toContain("A &amp; B &lt;c&gt;");
    expect(xml).toContain("https://exemple.fr/nouveautes#a");
  });
  it("écrit les dates en français", () => {
    expect(frDate("2026-11-09")).toBe("9 novembre 2026");
    expect(frDate("2026-01-01")).toBe("1er janvier 2026");
  });
  it("ne lie que des pages existantes", () => {
    for (const e of CHANGELOG) if (e.href) expect(routeExists(e.href), e.href).toBe(true);
  });
});

describe("contact", () => {
  const ok: ContactFields = { name: "Karim", email: "karim@exemple.fr", company: "", subject: "question", message: "Bonjour, une question sur les tarifs." };
  it("valide les champs", () => {
    expect(validateContact(ok)).toEqual({});
    const e = validateContact({ ...ok, email: "karim@", message: "court", name: " " });
    expect(Object.keys(e).sort()).toEqual(["email", "message", "name"]);
  });
  it("prépare l'envoi et le repli mailto", () => {
    expect(leadPayload(ok)).toMatchObject({ source: "contact", businessName: "Karim", email: "karim@exemple.fr" });
    const m = contactMailto("contact@repere-ia.fr", ok);
    expect(m.startsWith("mailto:contact@repere-ia.fr?subject=")).toBe(true);
    expect(decodeURIComponent(m)).toContain("une question sur les tarifs");
  });
});

describe("/merci", () => {
  it("reconnaît le type d'achat", () => {
    expect(purchaseKind({ id: "local_accompagne_month", interval: "month", segment: "local" })).toBe("accompagne");
    expect(purchaseKind({ id: "pme_essentiel_month", interval: "month", segment: "pme" })).toBe("abonnement");
    expect(purchaseKind({ id: "local_audit_deep", interval: "one_time", segment: "local" })).toBe("audit-local");
    expect(purchaseKind({ id: "pme_audit_deep", interval: "one_time", segment: "pme" })).toBe("audit-approfondi");
    expect(purchaseKind({ id: "pme_decouverte", interval: "month", segment: "pme" })).toBe("decouverte");
    expect(purchaseKind(undefined)).toBe("inconnu");
  });
  it("oriente vers l'espace ou la connexion", () => {
    expect(spaceHref(true)).toBe("/app");
    expect(spaceHref(false)).toBe("/connexion?next=%2Fapp");
    expect(merciSteps("abonnement", { loggedIn: false })).toHaveLength(3);
    expect(merciSteps("decouverte", { loggedIn: true })[0]).toContain("gratuit");
  });
});

describe("données des pages", () => {
  it("fonctionnalités : slugs uniques, limites et étapes présentes", () => {
    const slugs = FEATURES.map((f) => f.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs.length).toBe(17);
    for (const f of FEATURES) {
      expect(f.limits.length).toBeGreaterThan(0);
      expect(f.how.length).toBeGreaterThanOrEqual(3);
      expect(f.description.length).toBeLessThanOrEqual(160);
      for (const r of f.related) expect(getFeature(r), `${f.slug} → ${r}`).toBeDefined();
    }
  });
  it("ancres liées par l'accueil (MOTION) présentes dans le hub", () => {
    const ids = HUB_ANCHORS.map((a) => a.id);
    for (const id of ["mesurer", "sources", "verite", "trafic", "copilote", "taches"]) expect(ids).toContain(id);
  });
  it("aide : 15 articles uniques", () => {
    expect(HELP_ARTICLES).toHaveLength(15);
    expect(new Set(HELP_ARTICLES.map((a) => a.slug)).size).toBe(15);
  });
  it("cas d'usage : 6 métiers", () => {
    expect(USE_CASES).toHaveLength(6);
  });
  it("démo : liens vers l'app en compte démo avec visite", () => {
    expect(DEMO_ACCOUNTS.map((a) => a.id)).toEqual(["demo", "demo-pme", "demo-ecom"]);
    expect(demoAppHref(DEMO_ACCOUNTS[1])).toBe("/app?compte=demo-pme&visite=1&segment=pme");
  });
  it("comparatif : Découverte toujours à 5 questions", () => {
    for (const s of ["local", "pme", "ecommerce"] as const) expect(compareRows(s).find((r) => r.label === "Questions suivies")?.decouverte).toBe("5");
  });
});

describe("navigation", () => {
  it("essai gratuit vers l'inscription", () => {
    expect(signupHrefFor()).toBe("/inscription");
    expect(signupHrefFor("ecommerce")).toBe("/inscription?parcours=ecommerce");
  });
  it("menu produit : démo en entrée", () => {
    expect(PRODUCT.some((p) => p.href === "/demo")).toBe(true);
    expect(NAV_GROUPS.map((g) => g.label)).toEqual(["Produit", "Solutions", "Outils gratuits"]);
  });
  it("tous les liens du site (hors /outils, prévus au contrat) mènent à une page existante", () => {
    const hrefs = new Set<string>();
    for (const g of NAV_GROUPS) g.items.forEach((i) => hrefs.add(i.href));
    RESOURCES.forEach((i) => hrefs.add(i.href));
    FOOTER_COLUMNS.forEach((c) => c.links.forEach((l) => hrefs.add(l.href)));
    for (const f of FEATURES) for (const r of f.related) hrefs.add(`/fonctionnalites/${r}`);
    HELP_ARTICLES.forEach((a) => a.related?.forEach((r) => hrefs.add(r.href)));
    USE_CASES.forEach((u) => hrefs.add(u.resource.href));
    const missing = [...hrefs].filter((h) => !h.startsWith("/outils") && !routeExists(h));
    expect(missing).toEqual([]);
  });
});
