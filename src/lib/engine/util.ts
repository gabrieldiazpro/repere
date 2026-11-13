/** Utilitaires sans dépendance : hachage, aléa déterministe, normalisation de base. */

/** Hachage 32 bits (FNV-1a + mélange) d'une chaîne. */
export function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return h >>> 0;
}

/** Hachage court en hexadécimal (4 caractères par défaut). */
export function shortHash(s: string, len = 4): string {
  return hash32(s).toString(16).padStart(8, '0').slice(0, len);
}

/** Générateur pseudo-aléatoire mulberry32 initialisé par une graine textuelle. */
export function seededRandom(seed: string): () => number {
  let a = hash32(seed) || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Supprime les diacritiques (équivalent ES2017 de normalize('NFD') + \p{M}). */
export function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ᪰-᫿᷀-᷿⃐-⃿︠-︯]/g, '');
}

export function groupBy<T>(xs: T[], key: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of xs) {
    const k = key(x);
    const arr = m.get(k);
    if (arr) arr.push(x);
    else m.set(k, [x]);
  }
  return m;
}

export function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function env(k: string): string | undefined {
  return typeof process !== 'undefined' ? process.env?.[k] : undefined;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function newId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  const r = seededRandom(String(Date.now()) + Math.random());
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const v = Math.floor(r() * 16);
    return (ch === 'x' ? v : (v & 0x3) | 0x8).toString(16);
  });
}
