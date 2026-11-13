/**
 * Faux serveur HTTP local (127.0.0.1, port éphémère) pour tester les fournisseurs réels sans Internet.
 * Les réponses sont « enregistrées » d'après la documentation officielle de chaque API (formes et champs).
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';

export interface FakeRequest { method: string; path: string; query: URLSearchParams; headers: http.IncomingHttpHeaders; body: string; json: unknown }
export type FakeReply = { status?: number; json?: unknown; text?: string } | undefined;
export type Route = (r: FakeRequest) => FakeReply | Promise<FakeReply>;

export interface FakeServer {
  url: string;
  requests: FakeRequest[];
  on(method: string, path: string | RegExp, route: Route): void;
  close(): Promise<void>;
}

export async function startFakeServer(): Promise<FakeServer> {
  const routes: { method: string; path: string | RegExp; route: Route }[] = [];
  const requests: FakeRequest[] = [];
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', async () => {
      const u = new URL(req.url ?? '/', 'http://127.0.0.1');
      const body = Buffer.concat(chunks).toString('utf8');
      let json: unknown = null;
      try {
        json = body ? JSON.parse(body) : null;
      } catch {
        json = null;
      }
      const fr: FakeRequest = { method: req.method ?? 'GET', path: decodeURIComponent(u.pathname), query: u.searchParams, headers: req.headers, body, json };
      requests.push(fr);
      const hit = [...routes].reverse().find((r) => r.method === fr.method && (typeof r.path === 'string' ? r.path === fr.path : r.path.test(fr.path)));
      const reply = hit ? await hit.route(fr) : { status: 404, json: { error: { code: 404, message: `pas de route ${fr.method} ${fr.path}` } } };
      res.statusCode = reply?.status ?? 200;
      res.setHeader('content-type', 'application/json');
      res.end(reply?.text ?? JSON.stringify(reply?.json ?? {}));
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    on: (method, path, route) => routes.push({ method, path, route }),
    close: () => new Promise((r) => server.close(() => r())),
  };
}
