/**
 * Aides de test : UN serveur HTTP local qui joue plusieurs hôtes (API WordPress/Shopify/Webflow/PrestaShop/Google et
 * pages publiques), un client de publication qui y envoie les requêtes (en gardant l'en-tête Host d'origine), et le
 * routage du fetch sûr de siteaudit (relecture publique) vers ce même serveur. Aucun accès Internet.
 */
import http from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { nodeTransport, setFetchDeps, type Resolver, type Transport } from '@/lib/siteaudit/fetch';
import type { HttpClient } from '../types';

export interface FakeReq {
  method: string;
  host: string;
  path: string;
  query: URLSearchParams;
  headers: http.IncomingHttpHeaders;
  body: string;
}
export interface FakeRes {
  status?: number;
  headers?: Record<string, string>;
  body?: string | object;
}
export type FakeHandler = (r: FakeReq) => FakeRes | Promise<FakeRes>;

export interface Fake {
  port: number;
  hosts: Map<string, FakeHandler>;
  log: string[];
  close(): Promise<void>;
}

export async function startFake(): Promise<Fake> {
  const hosts = new Map<string, FakeHandler>();
  const log: string[] = [];
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', async () => {
      const host = String(req.headers.host ?? '').split(':')[0];
      const u = new URL(req.url ?? '/', 'http://x');
      log.push(`${req.method} ${host}${u.pathname}${u.search}`);
      const h = hosts.get(host);
      try {
        const out: FakeRes = h ? await h({ method: req.method ?? 'GET', host, path: u.pathname, query: u.searchParams, headers: req.headers, body: Buffer.concat(chunks).toString('utf8') }) : { status: 404, body: 'no host' };
        const isObj = out.body !== undefined && typeof out.body === 'object';
        res.writeHead(out.status ?? 200, { 'content-type': isObj ? 'application/json' : 'text/html; charset=utf-8', ...(out.headers ?? {}) });
        res.end(isObj ? JSON.stringify(out.body) : (out.body as string | undefined) ?? '');
      } catch (e) {
        res.writeHead(500, { 'content-type': 'text/plain' });
        res.end(String(e));
      }
    });
  });
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', () => ok()));
  const port = (server.address() as { port: number }).port;
  return { port, hosts, log, close: () => new Promise<void>((ok) => server.close(() => ok())) };
}

/** Client de publication vers le serveur local (l'URL https://hôte/… devient http://127.0.0.1:port/… + Host). */
export function localHttp(port: number): HttpClient {
  return (req) =>
    new Promise((resolve, reject) => {
      const u = new URL(req.url);
      const r = http.request(
        { host: '127.0.0.1', port, method: req.method, path: `${u.pathname}${u.search}`, headers: { ...(req.headers ?? {}), host: u.host, ...(req.body !== undefined ? { 'content-length': String(Buffer.byteLength(req.body)) } : {}) } },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => {
            const headers: Record<string, string> = {};
            for (const [k, v] of Object.entries(res.headers)) if (v !== undefined) headers[k] = Array.isArray(v) ? v.join(', ') : String(v);
            resolve({ status: res.statusCode ?? 0, headers, text: Buffer.concat(chunks).toString('utf8') });
          });
        },
      );
      r.on('error', reject);
      r.end(req.body);
    });
}

/** Relecture publique (safeFetch) routée vers le serveur local ; renvoie la fonction de restauration. */
export function routePublicFetch(port: number): () => void {
  const resolver: Resolver = async (host) => {
    if (host.endsWith('.test') || host.endsWith('.myshopify.com')) return [{ address: '93.184.216.34', family: 4 }];
    throw new Error('ENOTFOUND');
  };
  const transport: Transport = (req) => {
    const u = new URL(req.url.toString());
    const host = u.hostname;
    u.protocol = 'http:';
    u.hostname = '127.0.0.1';
    u.port = String(port);
    return nodeTransport({ ...req, url: u, address: { address: '127.0.0.1', family: 4 }, headers: { ...req.headers, host } });
  };
  return setFetchDeps({ resolver, transport });
}

/** Dossier de données isolé (store en fichiers) — à appeler avant tout import du store. */
export function isolateStore(name: string): void {
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), `repere-publish-${name}-`));
  for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY', 'MISTRAL_API_KEY']) delete process.env[k];
}

export const html = (o: { title?: string; description?: string; canonical?: string; body?: string; jsonld?: string[] }) =>
  `<!doctype html><html lang="fr"><head><title>${o.title ?? ''}</title>${o.description !== undefined ? `<meta name="description" content="${o.description.replace(/"/g, '&quot;')}">` : ''}${o.canonical ? `<link rel="canonical" href="${o.canonical}">` : ''}${(o.jsonld ?? []).map((j) => `<script type="application/ld+json">${j}</script>`).join('')}</head><body><main>${o.body ?? ''}</main></body></html>`;

export const basicOk = (headers: http.IncomingHttpHeaders, user: string, pass: string) => headers.authorization === `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
