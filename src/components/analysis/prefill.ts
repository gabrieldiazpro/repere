/** Pré-remplissage de /analyse depuis l'adresse (?site=, ?nom=, ?segment=, ?ville=) — formulaires d'entrée du site. */
import type { AnalysisPrefill } from './AnalysisApp';

export type SearchParams = Record<string, string | string[] | undefined>;
const first = (sp: SearchParams, ...keys: string[]) => {
  for (const k of keys) {
    const v = sp[k];
    const x = Array.isArray(v) ? v[0] : v;
    if (x && x.trim()) return x.trim().slice(0, 200);
  }
  return undefined;
};

export function resolveAnalysisPrefill(sp: SearchParams): AnalysisPrefill {
  const out: AnalysisPrefill = {};
  const site = first(sp, 'site', 'url', 'website');
  if (site) out.site = site;
  const nom = first(sp, 'nom', 'name');
  if (nom) out.name = nom.slice(0, 80);
  const seg = (first(sp, 'segment', 'parcours') ?? '').toLowerCase();
  if (seg === 'local' || seg === 'pme' || seg === 'ecommerce') out.siteType = seg;
  else if (seg === 'b2b') out.siteType = 'pme';
  else if (seg === 'e-commerce' || seg === 'ecom') out.siteType = 'ecommerce';
  const ville = first(sp, 'ville', 'city');
  if (ville) out.city = ville.slice(0, 60);
  return out;
}

