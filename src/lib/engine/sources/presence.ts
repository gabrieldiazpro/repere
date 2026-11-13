/**
 * Vérification HTTP légère de la présence (docs/v2/03-sources.md § 5.3), OPTIONNELLE :
 * appelée seulement si runAudit reçoit `verifyPresence: true`. Une requête par URL, robots.txt respecté,
 * jamais sur les plateformes de la liste NO_FETCH, aucun HTML stocké.
 */
import { lookup } from 'node:dns/promises';
import net from 'node:net';
import type { NameVariants } from '../detect';
import type { Presence } from '../types-v2';
import { clientNamedIn, competitorNamedIn } from './index';
import { normalizeUrl } from './classify';

export const NO_FETCH =
  /(^|\.)(google\.[a-z.]+|facebook\.com|instagram\.com|linkedin\.com|x\.com|twitter\.com|tiktok\.com|reddit\.com|amazon\.[a-z.]+|tripadvisor\.[a-z.]+|yelp\.[a-z.]+|thefork\.[a-z.]+|doctolib\.fr|leboncoin\.fr|wikipedia\.org|youtube\.com)$/;

export const UA = 'RepereBot/1.0 (+https://repere-ia.fr/methode/robot)';

export interface PresenceVerdict {
  client: Presence;
  competitors: Record<string, Presence>;
  reason?: string;
}

/** Adresse privée, locale, de lien local, CGNAT, multicast ou IPv4 mappée (M3 : pas de SSRF). */
export function privateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80') || v.startsWith('::ffff:');
}

async function publicHost(host: string): Promise<boolean> {
  const h = host.replace(/^\[|\]$/g, '');
  if (net.isIP(h)) return !privateIp(h);
  if (/^localhost$|\.local(host)?$|\.internal$/i.test(h)) return false;
  try {
    return (await lookup(h, { all: true })).every((a) => !privateIp(a.address));
  } catch {
    return false;
  }
}

async function fetchText(url: string, timeoutMs: number, maxBytes: number, hops = 3): Promise<{ status: number; type: string; body: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' || !(await publicHost(u.hostname))) return null;
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html', 'Accept-Language': 'fr-FR' },
      redirect: 'manual', // chaque saut est revalidé (https, hôte public, même hôte que celui dont robots.txt a été lu)
      signal: controller.signal,
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc || hops <= 0) return null;
      const next = new URL(loc, url);
      if (next.hostname !== u.hostname) return null;
      clearTimeout(timer);
      return fetchText(next.toString(), timeoutMs, maxBytes, hops - 1);
    }
    const type = res.headers.get('content-type') ?? '';
    // Lecture bornée en octets (jamais tout le corps en mémoire).
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (reader) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      size += value.length;
      if (size >= maxBytes) {
        await reader.cancel().catch(() => undefined);
        break;
      }
    }
    const body = Buffer.concat(chunks).subarray(0, maxBytes).toString('utf8');
    return { status: res.status, type, body };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Analyse minimale de robots.txt pour RepereBot puis * (Disallow par préfixe). */
export function robotsAllows(robots: string, path: string): boolean {
  const groups: { agents: string[]; rules: { allow: boolean; path: string }[] }[] = [];
  let cur: (typeof groups)[number] | null = null;
  let lastWasAgent = false;
  for (const line of robots.split('\n')) {
    const l = line.replace(/#.*/, '').trim();
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(l);
    if (!m) continue;
    const k = m[1].toLowerCase();
    const v = m[2].trim();
    if (k === 'user-agent') {
      if (!cur || !lastWasAgent) {
        cur = { agents: [], rules: [] };
        groups.push(cur);
      }
      cur.agents.push(v.toLowerCase());
      lastWasAgent = true;
    } else if (cur && (k === 'disallow' || k === 'allow')) {
      cur.rules.push({ allow: k === 'allow', path: v });
      lastWasAgent = false;
    }
  }
  const g = groups.find((x) => x.agents.some((a) => a.startsWith('reperebot'))) ?? groups.find((x) => x.agents.includes('*'));
  if (!g) return true;
  let best: { allow: boolean; len: number } | null = null;
  for (const r of g.rules) {
    if (!r.path) continue;
    if (path.startsWith(r.path) && (!best || r.path.length > best.len)) best = { allow: r.allow, len: r.path.length };
  }
  return best ? best.allow : true;
}

function visibleText(html: string): { text: string; hrefs: string[] } {
  const cleaned = html
    .replace(/<(script|style|nav|footer|noscript)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  const hrefs = [...cleaned.matchAll(/href=["']([^"']+)["']/gi)].map((m) => m[1]);
  const text = cleaned.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  return { text, hrefs };
}

export async function verifyPresence(
  url: string,
  client: NameVariants,
  competitors: string[],
  opts: { timeoutMs?: number; maxBytes?: number } = {},
): Promise<PresenceVerdict> {
  const unknown = (reason: string): PresenceVerdict => ({
    client: 'unknown',
    competitors: Object.fromEntries(competitors.map((c) => [c, 'unknown' as Presence])),
    reason,
  });
  const n = normalizeUrl(url);
  if (!n || NO_FETCH.test(n.host)) return unknown('plateforme non vérifiable automatiquement');
  const timeoutMs = opts.timeoutMs ?? 5000;
  const robots = await fetchText(`https://${n.host}/robots.txt`, timeoutMs, 200_000);
  if (robots && robots.status === 200 && !robotsAllows(robots.body, n.path || '/')) return unknown('robots.txt');
  const page = await fetchText(n.urlNorm, timeoutMs, opts.maxBytes ?? 1_500_000);
  if (!page || page.status >= 400 || !page.type.startsWith('text/html')) return unknown(`HTTP ${page?.status ?? 'erreur'}`);
  const { text, hrefs } = visibleText(page.body);
  if (text.length < 2000) return unknown('page vide ou rendue en JavaScript');
  const clientHit = clientNamedIn(text, client) || (!!client.domain && hrefs.some((h) => h.includes(client.domain!)));
  return {
    client: clientHit ? 'present' : 'absent',
    competitors: Object.fromEntries(competitors.map((c) => [c, competitorNamedIn(text, c) ? 'present' : 'absent'] as [string, Presence])),
  };
}
