/* eslint-disable @typescript-eslint/no-explicit-any -- script ponctuel hors application */
/**
 * Lance des audits RÉELS pour les lignes d'un CSV de leads et produit un CSV enrichi.
 * Usage : node --experimental-strip-types scripts/batch-audit.ts .data/leads-43.22A-75011.csv [--limit 10] [--api http://localhost:3000]
 * Mode par défaut : moteur en direct (runAudit + saveAudit). Avec --api : POST /api/audit puis GET /api/audit/[id]
 * (utile si les alias '@/' du moteur ne sont pas résolus hors Next).
 * Les audits demo (mock) sont rejetés : on n'envoie jamais un faux score à un prospect.
 * --allow-demo (tests en local uniquement) : conserve les audits démo, marqués demo=oui (write-emails les ignore).
 * Avec --api, ADMIN_TOKEN (env) est envoyé en x-admin-token pour ne pas être limité à 5 audits/IP/jour.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename } from 'node:path';

function arg(name: string, def = ''): string {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows;
  return body.filter((r) => r.some(Boolean)).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}
const csvCell = (v: unknown) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const names = (cs: any[]): string[] => (cs ?? []).map((c) => (typeof c === 'string' ? c : c?.name ?? '')).filter(Boolean);

async function main() {
  const file = process.argv[2];
  if (!file || file.startsWith('--')) { console.error('Usage : batch-audit.ts <leads.csv> [--limit N] [--api URL]'); process.exit(1); }
  const limit = Number(arg('limit', '1000'));
  const api = arg('api');
  const allowDemo = process.argv.includes('--allow-demo');
  const site = (process.env.SITE_URL ?? api ?? 'http://localhost:3000').replace(/\/$/, '');
  const leads = parseCsv(readFileSync(file, 'utf8')).slice(0, limit);

  let engine: any, db: any;
  if (!api) {
    const eng = '../src/lib/engine/index.ts', dbp = '../src/lib/db.ts'; // chemins en variable : évite l'erreur tsc sur l'extension .ts
    try {
      engine = await import(eng);
      db = await import(dbp);
    } catch (e) {
      console.error(`Moteur non chargeable hors Next (imports sans extension / alias @/) : relancez avec --api http://localhost:3000.\n${e instanceof Error ? e.message : e}`);
      process.exit(1);
    }
  }

  const out: Record<string, string>[] = [];
  for (const l of leads) {
    const input = { businessName: l.nom, trade: l.metier, city: 'Paris', district: l.code_postal, website: l.site || undefined };
    const r: Record<string, string> = { ...l, audit_id: '', score: '', fourchette: '', concurrents: '', confiance: '', rapport_url: '', demo: '', erreur: '' };
    try {
      let res: any;
      if (api) {
        const post = await fetch(`${api}/api/audit`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(process.env.ADMIN_TOKEN ? { 'x-admin-token': process.env.ADMIN_TOKEN } : {}) }, body: JSON.stringify({ ...input, consent: false }) });
        if (!post.ok) throw new Error(`POST /api/audit HTTP ${post.status}`);
        const { id } = (await post.json()) as { id: string };
        res = await (await fetch(`${api}/api/audit/${id}`)).json();
      } else {
        res = await engine.runAudit(input, { mode: 'free' });
        await db.saveAudit(res);
      }
      if (res.demo && !allowDemo) throw new Error('audit demo (mock) : rejeté pour la prospection');
      r.demo = res.demo ? 'oui' : 'non';
      r.audit_id = res.id;
      r.score = String(res.score);
      r.fourchette = res.range ? `${res.range.low}-${res.range.high}` : '';
      r.concurrents = names(res.competitors).slice(0, 3).join(' | ');
      r.confiance = String(res.confidence ?? '');
      r.rapport_url = `${site}/rapport/${res.id}`;
      console.log(`OK  ${l.nom} : ${r.score}/100`);
    } catch (e) {
      r.erreur = e instanceof Error ? e.message : String(e);
      console.error(`ERR ${l.nom} : ${r.erreur}`);
    }
    out.push(r);
  }
  mkdirSync('.data', { recursive: true });
  const dest = `.data/audited-${basename(file).replace(/^leads-/, '')}`;
  const cols = Object.keys(out[0] ?? {});
  writeFileSync(dest, [cols.join(','), ...out.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n') + '\n');
  console.log(`${out.length} lignes -> ${dest}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
