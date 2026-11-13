'use server';

// Pré-remplissage du formulaire d'audit depuis le site du client.
// Récupération sûre par @/lib/siteaudit (anti-SSRF, robots.txt respecté, délai et taille bornés), limitée par IP.
// En cas d'échec, on se rabat sur le nom déduit de l'adresse : jamais d'erreur bloquante pour le formulaire.
import { headers } from 'next/headers';
import { getClientIp, HOUR_MS, rateLimit } from '@/lib/ratelimit';
import { prefillFromSignals, type PageSignals, type SitePrefill } from './prefill';

const SITE_RE = /^(https?:\/\/)?([a-z0-9¡-￿](-*[a-z0-9¡-￿])*\.)+[a-z¡-￿]{2,}(:\d+)?(\/\S*)?$/i;

export async function prefillFromSite(rawUrl: string): Promise<SitePrefill | null> {
  const url = String(rawUrl ?? '').trim().slice(0, 200);
  if (!url || !SITE_RE.test(url)) return null;
  const offline = prefillFromSignals(url, null);
  try {
    const h = await headers();
    // Même lecture d'IP que les routes API (en-têtes de confiance seulement, IPv6 regroupée par /64).
    const ip = getClientIp({ headers: h } as unknown as Request);
    const rl = await rateLimit('audit-prefill', ip, 30, HOUR_MS);
    if (!rl.ok) return offline;
  } catch {
    return offline;
  }
  try {
    const [{ tryFetch }, { parseHtml }, { topNodes, typesOf }] = await Promise.all([
      import('@/lib/siteaudit/fetch'),
      import('@/lib/siteaudit/html'),
      import('@/lib/siteaudit/jsonld'),
    ]);
    const res = await tryFetch(/^https?:\/\//i.test(url) ? url : `https://${url}`, { timeoutMs: 5000, maxBytes: 600_000, accept: 'text/html' });
    if (!res || res.status >= 400 || !/html/i.test(res.contentType)) return offline;
    const page = parseHtml(res.body);
    const names: string[] = [];
    const types: string[] = [];
    for (const raw of page.jsonLdRaw.slice(0, 8)) {
      try {
        for (const n of topNodes(JSON.parse(raw))) {
          const t = typesOf(n);
          types.push(...t);
          const name = (n as Record<string, unknown>).name;
          if (typeof name === 'string' && t.some((x) => /organization|business|store|restaurant|plumber|electrician|salon|bakery|brand|corporation/i.test(x) || /^[A-Z][a-zA-Z]+$/.test(x))) names.push(name);
        }
      } catch {
        /* bloc JSON-LD invalide : ignoré */
      }
    }
    const signals: PageSignals = { title: page.title, siteName: page.og['og:site_name'] ?? page.og.site_name ?? null, jsonLdNames: names, jsonLdTypes: types };
    return prefillFromSignals(url, signals);
  } catch {
    return offline;
  }
}
