/**
 * scripts/write-emails.ts exécuté pour de vrai (node --experimental-strip-types) dans un dossier isolé.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash, createHmac } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SCRIPT = path.resolve(__dirname, '../write-emails.ts');
const SECRET = 'test-unsub-secret';
const HEAD = 'nom,siren,code_postal,metier,ei,email_generique,email_source_url,audit_id,score,concurrents,rapport_url,demo,erreur';
const row = (o: Record<string, string>) =>
  [o.nom, o.siren, '75011', 'plombier', o.ei ?? 'non', o.email ?? '', o.src ?? 'https://x.fr/mentions', o.audit ?? 'a1', '44', o.conc ?? 'Plomberie Bonnet | Atelier Bernard', 'http://localhost:3000/rapport/a1', o.demo ?? 'non', '']
    .map((v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v))
    .join(',');

function setup() {
  const dir = mkdtempSync(path.join(tmpdir(), 'repere-emails-'));
  mkdirSync(path.join(dir, '.data'));
  const csv = [
    HEAD,
    row({ nom: 'Alpha', siren: '111', email: 'contact@alpha.fr' }),
    row({ nom: 'Beta EI', siren: '222', email: 'contact@beta.fr', ei: 'oui' }),
    row({ nom: 'Gamma démo', siren: '333', email: 'contact@gamma.fr', demo: 'oui' }),
    row({ nom: 'Delta', siren: '444', email: 'contact@delta.fr\nBcc: liste@x.fr' }),
    row({ nom: 'Epsilon', siren: '555', email: 'stop@epsilon.fr' }),
    row({ nom: '=HYPERLINK("http://x")', siren: '666', email: 'contact@zeta.fr' }),
    row({ nom: 'Eta', siren: '777', email: '' }),
  ].join('\n');
  writeFileSync(path.join(dir, '.data/audited-qa.csv'), csv + '\n');
  // désinscrit via le lien (store démo)
  const h = createHash('sha256').update('stop@epsilon.fr').digest('hex');
  writeFileSync(path.join(dir, '.data/suppression.json'), JSON.stringify({ [h]: '2026-11-09T00:00:00Z' }));
  return dir;
}

const env = (extra: Record<string, string> = {}) => {
  const e: NodeJS.ProcessEnv = { ...process.env, SITE_URL: 'https://repere.test', SENDER_NAME: 'QA', SENDER_ADDRESS: '1 rue X', SENDER_SIREN: '000', SENDER_EMAIL: 'qa@repere.test', ...extra };
  delete e.SUPABASE_URL;
  return e;
};

describe('scripts/write-emails.ts', () => {
  it('refuse de tourner sans UNSUBSCRIBE_SECRET', () => {
    const dir = setup();
    const e = env();
    delete e.UNSUBSCRIBE_SECRET;
    const r = spawnSync('node', ['--experimental-strip-types', '--no-warnings', SCRIPT, '.data/audited-qa.csv'], { cwd: dir, env: e, encoding: 'utf8' });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('UNSUBSCRIBE_SECRET');
  });

  it('produit les brouillons, exclut EI / démo / opposition / e-mail invalide, liens signés', () => {
    const dir = setup();
    const out = execFileSync('node', ['--experimental-strip-types', '--no-warnings', SCRIPT, '.data/audited-qa.csv'], {
      cwd: dir,
      env: env({ UNSUBSCRIBE_SECRET: SECRET }),
      encoding: 'utf8',
    });
    expect(out).toContain('2 e-mails préparés');
    expect(out).toMatch(/Beta EI : entrepreneur individuel/);
    expect(out).toMatch(/Gamma démo : audit de démonstration/);
    expect(out).toMatch(/Delta : e-mail invalide/);
    expect(out).toMatch(/Epsilon : adresse en liste d'opposition/);
    expect(out).toMatch(/Eta : pas d'e-mail/);

    const emls = readdirSync(path.join(dir, '.data/eml'));
    expect(emls.sort()).toEqual(['111.eml', '666.eml']);
    const eml = readFileSync(path.join(dir, '.data/eml/111.eml'), 'utf8');
    const t = createHmac('sha256', SECRET).update('contact@alpha.fr').digest('base64url').slice(0, 32);
    expect(eml).toContain(`https://repere.test/desinscription?e=contact%40alpha.fr&t=${t}`);
    expect(eml).toContain(`List-Unsubscribe: <https://repere.test/api/unsubscribe?e=contact%40alpha.fr&t=${t}>`);
    expect(eml).toContain('List-Unsubscribe-Post: List-Unsubscribe=One-Click');
    expect(eml).toContain('Paris 11e');
    expect(eml).toContain('Repéré');
    expect(eml).not.toMatch(/^Bcc:/m);

    const csv = readFileSync(path.join(dir, '.data/emails-qa.csv'), 'utf8');
    expect(csv).toContain(`'=HYPERLINK`); // formule neutralisée
  });
});
