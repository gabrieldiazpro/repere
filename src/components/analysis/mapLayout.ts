/**
 * Mini-carte du site : disposition STABLE (un nœud déjà placé ne bouge jamais quand d'autres arrivent).
 * Accueil au centre ; chaque section (1er segment du chemin) reçoit un rayon à l'angle d'or (137,5°) dans l'ordre
 * d'arrivée ; ses pages s'alignent en éventail le long de ce rayon.
 */
export interface MapNode {
  id: string; // chemin
  x: number;
  y: number;
  /** 0 = accueil, 1 = tête de section, 2 = page */
  level: 0 | 1 | 2;
  parent?: string;
  section: string;
}

export const MAP_W = 640;
export const MAP_H = 400;
const CX = MAP_W / 2;
const CY = MAP_H / 2;
const GOLDEN = (137.508 * Math.PI) / 180;

function pathKey(url: string): string {
  try {
    const p = new URL(url).pathname.replace(/\/+$/, '');
    return p || '/';
  } catch {
    return url;
  }
}

export function layoutMap(urls: string[]): MapNode[] {
  const nodes: MapNode[] = [{ id: '/', x: CX, y: CY, level: 0, section: '' }];
  const sections: string[] = [];
  const perSection = new Map<string, number>();
  const seen = new Set<string>(['/']);
  for (const u of urls) {
    const key = pathKey(u);
    if (seen.has(key)) continue;
    seen.add(key);
    const segs = key.split('/').filter(Boolean);
    const sec = segs[0] ?? '';
    let k = sections.indexOf(sec);
    if (k < 0) {
      sections.push(sec);
      k = sections.length - 1;
    }
    const angle = k * GOLDEN - Math.PI / 2;
    const hubId = `/${sec}`;
    // Tête de section (créée implicitement si une sous-page arrive d'abord)
    if (!nodes.some((n) => n.id === hubId)) {
      const r = 0.42;
      nodes.push({ id: hubId, x: CX + Math.cos(angle) * r * CX * 0.82, y: CY + Math.sin(angle) * r * CY * 0.92, level: 1, parent: '/', section: sec });
      seen.add(hubId);
    }
    if (segs.length <= 1) continue;
    const j = perSection.get(sec) ?? 0;
    perSection.set(sec, j + 1);
    const ring = Math.floor(j / 5);
    const slot = (j % 5) - 2;
    const r = 0.62 + ring * 0.12;
    const a = angle + slot * (0.16 / (1 + ring * 0.35));
    const x = CX + Math.cos(a) * Math.min(r, 1.02) * CX * 0.82;
    const y = CY + Math.sin(a) * Math.min(r, 1.02) * CY * 0.92;
    nodes.push({ id: key, x: clamp(x, 8, MAP_W - 8), y: clamp(y, 8, MAP_H - 8), level: 2, parent: hubId, section: sec });
  }
  return nodes;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
