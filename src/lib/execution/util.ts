import crypto from 'node:crypto';

export function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' et ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function shortHash(s: string, n = 10): string {
  return crypto.createHash('sha256').update(s).digest('hex').slice(0, n);
}

/** Coupe proprement à `max` caractères (sur une fin de phrase ou un mot). */
export function clip(s: string, max: number): string {
  const t = s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const dot = cut.lastIndexOf('. ');
  if (dot > max * 0.6) return cut.slice(0, dot + 1);
  const sp = cut.lastIndexOf(' ');
  return `${cut.slice(0, sp > 0 ? sp : max - 1).replace(/[,;:]$/, '')}…`.slice(0, max);
}

/** Lundi (UTC) de la semaine ISO de `d`, au format YYYY-MM-DD. */
export function isoMonday(d: Date = new Date()): string {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (x.getUTCDay() + 6) % 7; // 0 = lundi
  x.setUTCDate(x.getUTCDate() - day);
  return x.toISOString().slice(0, 10);
}

export function addWeeks(monday: string, n: number): string {
  const x = new Date(`${monday}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + 7 * n);
  return x.toISOString().slice(0, 10);
}

export function splitList(s: string | undefined): string[] {
  if (!s) return [];
  return s
    .split(/[,;\n•]| et (?=[a-zà-ÿ])/i)
    .map((x) => x.trim())
    .filter(Boolean);
}

export function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/**
 * Échappement HTML pour du texte et des attributs entre guillemets doubles (seul usage du module).
 * L'apostrophe n'est PAS échappée : le code est lu tel quel par le client (« Qu'est-ce que… », pas « Qu&#39;est-ce que… »).
 */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
}

export function cleanUrl(u: string | undefined): string | undefined {
  if (!u) return undefined;
  const t = u.trim();
  if (!t) return undefined;
  return /^https?:\/\//i.test(t) ? t : `https://${t.replace(/^\/+/, '')}`;
}
