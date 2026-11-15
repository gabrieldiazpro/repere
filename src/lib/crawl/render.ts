/**
 * Rendu JavaScript optionnel (ROBUSTESSE V6) : quelques pages clés vides côté serveur sont ouvertes dans un Chromium
 * sans tête, piloté directement par le protocole DevTools (CDP, WebSocket natif de Node : aucune dépendance npm).
 *
 * Désactivé par défaut (CRAWL_RENDER=off). Budget strict : 3 pages, 10 s par page, 15 s au total (réglables).
 *
 * Sécurité : le navigateur n'a PAS d'accès réseau. Chaque requête qu'il émet est interceptée (Fetch.requestPaused)
 * et servie par notre propre récupérateur (src/lib/crawl/fetcher.ts : DNS validé et épinglé, anti-SSRF, robots.txt
 * de RepereBot, tailles et délais bornés). Images, polices, feuilles de style et médias ne sont pas chargés. Défense
 * en profondeur : proxy « trou noir » et résolveur DNS désactivé au lancement, pour tout ce qui échapperait à
 * l'interception (WebSocket, préchargements). Un seul navigateur à la fois par processus.
 *
 * Hébergement : voir docs/MISE-EN-LIGNE.md (« Rendu JavaScript »). En local : Chromium installé (CRAWL_RENDER_CHROME
 * ou google-chrome / chromium dans le PATH). À distance : CRAWL_RENDER_WS=ws(s)://… (navigateur hébergé, même
 * protocole ; l'interception garantit que ce navigateur ne sort pas sur le réseau pour nous).
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { HopResult } from './fetcher';

export interface RenderConfig {
  enabled: boolean;
  maxPages: number;
  pageTimeoutMs: number;
  totalMs: number;
  /** requêtes servies au navigateur par page (scripts, XHR…) */
  maxSubrequests: number;
  chromePath?: string;
  wsEndpoint?: string;
}

const num = (v: string | undefined, d: number, lo: number, hi: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.max(lo, Math.min(hi, Math.round(n))) : d;
};

function findChrome(): string | undefined {
  const candidates = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ];
  return candidates.find((c) => existsSync(c));
}

export function renderConfig(env: Record<string, string | undefined> = process.env): RenderConfig {
  const on = /^(on|1|true|oui)$/i.test(env.CRAWL_RENDER ?? '');
  const wsEndpoint = env.CRAWL_RENDER_WS?.trim() || undefined;
  return {
    enabled: on,
    maxPages: num(env.CRAWL_RENDER_MAX_PAGES, 3, 1, 5),
    pageTimeoutMs: num(env.CRAWL_RENDER_TIMEOUT_MS, 10_000, 2_000, 15_000),
    totalMs: num(env.CRAWL_RENDER_BUDGET_MS, 15_000, 3_000, 30_000),
    maxSubrequests: num(env.CRAWL_RENDER_MAX_REQUESTS, 40, 5, 150),
    ...(wsEndpoint ? { wsEndpoint } : { chromePath: env.CRAWL_RENDER_CHROME?.trim() || findChrome() }),
  };
}

/** Requête d'une ressource pour le navigateur, par le récupérateur sûr du crawl. */
export type SubFetch = (url: string, accept: string) => Promise<HopResult>;

export interface RenderOutcome {
  url: string;
  html?: string;
  error?: string;
  ms: number;
  subrequests: number;
}

/* ------------------------------------------------------------------ */
/* Client CDP minimal                                                  */
/* ------------------------------------------------------------------ */

type Json = Record<string, unknown>;

class Cdp {
  private id = 0;
  private pending = new Map<number, { ok: (v: Json) => void; ko: (e: Error) => void }>();
  private listeners: ((method: string, params: Json, sessionId?: string) => void)[] = [];
  private closed = false;
  constructor(private ws: WebSocket) {
    ws.addEventListener('message', (ev) => {
      let msg: { id?: number; result?: Json; error?: { message: string }; method?: string; params?: Json; sessionId?: string };
      try {
        msg = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      if (msg.id !== undefined) {
        const p = this.pending.get(msg.id);
        if (!p) return;
        this.pending.delete(msg.id);
        if (msg.error) p.ko(new Error(msg.error.message));
        else p.ok(msg.result ?? {});
      } else if (msg.method) for (const l of this.listeners) l(msg.method, msg.params ?? {}, msg.sessionId);
    });
    const fail = () => {
      this.closed = true;
      for (const p of this.pending.values()) p.ko(new Error('navigateur fermé'));
      this.pending.clear();
    };
    ws.addEventListener('close', fail);
    ws.addEventListener('error', fail);
  }
  static connect(url: string, timeoutMs: number): Promise<Cdp> {
    return new Promise((ok, ko) => {
      const ws = new WebSocket(url);
      const t = setTimeout(() => {
        try {
          ws.close();
        } catch {
          /* déjà fermé */
        }
        ko(new Error('connexion au navigateur impossible (délai)'));
      }, timeoutMs);
      ws.addEventListener('open', () => {
        clearTimeout(t);
        ok(new Cdp(ws));
      });
      ws.addEventListener('error', () => {
        clearTimeout(t);
        ko(new Error('connexion au navigateur impossible'));
      });
    });
  }
  send(method: string, params: Json = {}, sessionId?: string): Promise<Json> {
    if (this.closed) return Promise.reject(new Error('navigateur fermé'));
    const id = ++this.id;
    return new Promise((ok, ko) => {
      this.pending.set(id, { ok, ko });
      this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
  on(fn: (method: string, params: Json, sessionId?: string) => void): () => void {
    this.listeners.push(fn);
    return () => (this.listeners = this.listeners.filter((l) => l !== fn));
  }
  close(): void {
    this.closed = true;
    try {
      this.ws.close();
    } catch {
      /* déjà fermé */
    }
  }
}

/**
 * Adresse WebSocket d'un navigateur distant. `ws(s)://…` : utilisée telle quelle. `http(s)://hôte[:port][/préfixe]` :
 * lue dans `/json/version` (l'identifiant du navigateur change à chaque redémarrage), puis réécrite sur l'hôte public
 * configuré (le navigateur annonce son adresse interne). URL fixée par l'exploitant, jamais par un visiteur.
 */
export async function resolveWsEndpoint(endpoint: string, timeoutMs = 4_000): Promise<string> {
  if (/^wss?:\/\//i.test(endpoint)) return endpoint;
  const base = new URL(endpoint);
  const prefix = base.pathname.replace(/\/+$/, '');
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const r = await fetch(`${base.origin}${prefix}/json/version${base.search}`, { signal: ac.signal, headers: { Host: 'localhost' } });
    const j = (await r.json()) as { webSocketDebuggerUrl?: string };
    if (!j.webSocketDebuggerUrl) throw new Error('réponse /json/version sans webSocketDebuggerUrl');
    const inner = new URL(j.webSocketDebuggerUrl);
    return `${base.protocol === 'https:' ? 'wss:' : 'ws:'}//${base.host}${prefix}${inner.pathname}${base.search}`;
  } finally {
    clearTimeout(t);
  }
}

/* ------------------------------------------------------------------ */
/* Navigateur : lancement local ou connexion distante                  */
/* ------------------------------------------------------------------ */

const g = globalThis as unknown as { __repereRenderLock?: Promise<void> };

/** Un seul navigateur à la fois dans le processus (mémoire). */
async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const prev = g.__repereRenderLock ?? Promise.resolve();
  let release!: () => void;
  const mine = new Promise<void>((r) => (release = r));
  g.__repereRenderLock = prev.then(() => mine);
  await prev;
  try {
    return await fn();
  } finally {
    release();
  }
}

async function launchLocal(chrome: string, timeoutMs: number): Promise<{ cdp: Cdp; proc: ChildProcess; dir: string }> {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'repere-render-'));
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-default-apps',
    '--disable-sync',
    '--disable-dev-shm-usage',
    '--mute-audio',
    '--hide-scrollbars',
    '--window-size=1280,900',
    '--force-device-scale-factor=1',
    // Défense en profondeur : rien ne sort sans passer par l'interception.
    '--proxy-server=http://127.0.0.1:9',
    '--proxy-bypass-list=<-loopback>',
    '--host-resolver-rules=MAP * ~NOTFOUND',
    '--js-flags=--max-old-space-size=256',
    '--renderer-process-limit=1',
    `--user-data-dir=${dir}`,
    '--remote-debugging-port=0',
    ...(process.getuid?.() === 0 ? ['--no-sandbox'] : []),
    'about:blank',
  ];
  const proc = spawn(chrome, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  const wsUrl = await new Promise<string>((ok, ko) => {
    let buf = '';
    const t = setTimeout(() => ko(new Error('le navigateur ne démarre pas (délai)')), timeoutMs);
    proc.stderr!.on('data', (d: Buffer) => {
      buf += d.toString();
      const m = /DevTools listening on (ws:\/\/\S+)/.exec(buf);
      if (m) {
        clearTimeout(t);
        ok(m[1]);
      }
      if (buf.length > 64_000) buf = buf.slice(-8_000);
    });
    proc.on('error', (e) => {
      clearTimeout(t);
      ko(e);
    });
    proc.on('exit', (code) => {
      clearTimeout(t);
      ko(new Error(`le navigateur s'est arrêté (code ${code})`));
    });
  });
  proc.stderr!.removeAllListeners('data');
  proc.stderr!.resume();
  const cdp = await Cdp.connect(wsUrl, timeoutMs);
  return { cdp, proc, dir };
}

/** Arrête le navigateur local (fermeture propre, puis SIGKILL après 1,5 s) et efface son profil temporaire. */
async function killLocal(proc: ChildProcess | null, dir: string | null): Promise<void> {
  if (proc && proc.exitCode === null && proc.signalCode === null) {
    const exited = new Promise<void>((r) => proc.once('exit', () => r()));
    const t = setTimeout(() => {
      try {
        proc.kill('SIGKILL');
      } catch {
        /* déjà arrêté */
      }
    }, 1_500);
    try {
      proc.kill('SIGTERM');
    } catch {
      /* déjà arrêté */
    }
    await Promise.race([exited, new Promise((r) => setTimeout(r, 3_000))]);
    clearTimeout(t);
  }
  if (dir) {
    for (let i = 0; i < 3; i++) {
      try {
        rmSync(dir, { recursive: true, force: true });
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 200));
      }
    }
  }
}

const BLOCKED_TYPES = new Set(['Image', 'Media', 'Font', 'Stylesheet', 'Manifest', 'Ping', 'CSPViolationReport', 'TextTrack', 'Prefetch', 'EventSource', 'WebSocket', 'SignedExchange']);
const DROP_HEADERS = /^(content-encoding|content-length|transfer-encoding|connection|keep-alive|set-cookie|strict-transport-security|alt-svc)$/i;

/** Rend une page dans un onglet neuf ; toutes les requêtes passent par `fetchSub`. */
async function renderOne(cdp: Cdp, url: string, timeoutMs: number, maxSub: number, fetchSub: SubFetch): Promise<RenderOutcome> {
  const t0 = Date.now();
  let sub = 0;
  let inflight = 0;
  let lastActivity = Date.now();
  const { targetId } = (await cdp.send('Target.createTarget', { url: 'about:blank' })) as { targetId: string };
  const { sessionId } = (await cdp.send('Target.attachToTarget', { targetId, flatten: true })) as { sessionId: string };
  let loaded = false;
  const off = cdp.on((method, params, sid) => {
    if (sid !== sessionId) return;
    if (method === 'Page.loadEventFired') loaded = true;
    if (method !== 'Fetch.requestPaused') return;
    const p = params as { requestId: string; resourceType: string; request: { url: string; method: string } };
    lastActivity = Date.now();
    const fail = (reason = 'BlockedByClient') => cdp.send('Fetch.failRequest', { requestId: p.requestId, errorReason: reason }, sessionId).catch(() => undefined);
    if (BLOCKED_TYPES.has(p.resourceType) || p.request.method !== 'GET' || !/^https?:/i.test(p.request.url) || sub >= maxSub || Date.now() - t0 > timeoutMs) {
      void fail();
      return;
    }
    sub++;
    inflight++;
    const accept = p.resourceType === 'Document' ? 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5' : p.resourceType === 'Script' ? '*/*' : 'application/json,text/plain,*/*';
    void fetchSub(p.request.url, accept)
      .then(async (r) => {
        if (r.error || !r.status) return fail(r.blockedByRobots ? 'AccessDenied' : 'Failed');
        const headers = Object.entries(r.headers)
          .filter(([k]) => !DROP_HEADERS.test(k))
          .map(([name, value]) => ({ name, value: String(value).replace(/\n/g, ', ') }));
        await cdp.send('Fetch.fulfillRequest', { requestId: p.requestId, responseCode: r.status, responseHeaders: headers, body: r.body.toString('base64') }, sessionId);
      })
      .catch(() => fail('Failed'))
      .finally(() => {
        inflight--;
        lastActivity = Date.now();
      });
  });
  try {
    await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] }, sessionId);
    await cdp.send('Network.enable', {}, sessionId).catch(() => undefined);
    await cdp.send('Network.setBypassServiceWorker', { bypass: true }, sessionId).catch(() => undefined);
    await cdp.send('Page.enable', {}, sessionId);
    const nav = (await cdp.send('Page.navigate', { url }, sessionId)) as { errorText?: string };
    if (nav.errorText) return { url, error: `navigation impossible (${nav.errorText})`, ms: Date.now() - t0, subrequests: sub };
    // Attente : chargement + calme réseau (500 ms sans requête), dans la limite du délai de la page.
    while (Date.now() - t0 < timeoutMs) {
      await new Promise((r) => setTimeout(r, 100));
      if (loaded && inflight === 0 && Date.now() - lastActivity > 500) break;
    }
    const ev = (await cdp.send(
      'Runtime.evaluate',
      { expression: 'document.documentElement ? document.documentElement.outerHTML.slice(0, 1500000) : ""', returnByValue: true, timeout: 2_000 },
      sessionId,
    )) as { result?: { value?: unknown } };
    const html = typeof ev.result?.value === 'string' ? ev.result.value : '';
    return { url, ...(html ? { html: `<!doctype html>${html}` } : { error: 'page vide après rendu' }), ms: Date.now() - t0, subrequests: sub };
  } finally {
    off();
    await cdp.send('Target.closeTarget', { targetId }).catch(() => undefined);
  }
}

/**
 * Rend jusqu'à `cfg.maxPages` adresses, l'une après l'autre, sous le budget le plus court entre `cfg.totalMs` et
 * `deadline`. Ne lève jamais : chaque échec est décrit dans `error` (navigateur absent, délai…).
 */
export async function renderPages(
  urls: string[],
  fetchSub: SubFetch,
  opts: { cfg?: RenderConfig; deadline?: number; signal?: AbortSignal } = {},
): Promise<{ outcomes: RenderOutcome[]; ms: number; error?: string }> {
  const cfg = opts.cfg ?? renderConfig();
  const t0 = Date.now();
  const end = Math.min(t0 + cfg.totalMs, opts.deadline ?? Infinity);
  const list = urls.slice(0, cfg.maxPages);
  if (!list.length) return { outcomes: [], ms: 0 };
  if (!cfg.wsEndpoint && !cfg.chromePath) return { outcomes: [], ms: 0, error: 'aucun navigateur Chromium trouvé (CRAWL_RENDER_CHROME ou CRAWL_RENDER_WS)' };
  return withLock(async () => {
    let cdp: Cdp | null = null;
    let proc: ChildProcess | null = null;
    let dir: string | null = null;
    const outcomes: RenderOutcome[] = [];
    try {
      const startLeft = end - Date.now();
      if (startLeft < 2_000 || opts.signal?.aborted) return { outcomes, ms: Date.now() - t0, error: 'budget de temps insuffisant pour le rendu' };
      if (cfg.wsEndpoint) cdp = await Cdp.connect(await resolveWsEndpoint(cfg.wsEndpoint, Math.min(4_000, startLeft)), Math.min(5_000, startLeft));
      else ({ cdp, proc, dir } = await launchLocal(cfg.chromePath!, Math.min(8_000, startLeft)));
      for (const u of list) {
        const left = end - Date.now();
        if (left < 1_500 || opts.signal?.aborted) break;
        try {
          outcomes.push(await renderOne(cdp, u, Math.min(cfg.pageTimeoutMs, left - 500), cfg.maxSubrequests, fetchSub));
        } catch (e) {
          outcomes.push({ url: u, error: (e as Error).message.slice(0, 160), ms: 0, subrequests: 0 });
        }
      }
      return { outcomes, ms: Date.now() - t0 };
    } catch (e) {
      return { outcomes, ms: Date.now() - t0, error: (e as Error).message.slice(0, 200) };
    } finally {
      if (cdp && proc) await Promise.race([cdp.send('Browser.close').catch(() => undefined), new Promise((r) => setTimeout(r, 1_000))]);
      cdp?.close();
      await killLocal(proc, dir);
    }
  });
}
