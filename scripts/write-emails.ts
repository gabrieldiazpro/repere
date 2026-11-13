/**
 * Génère l'e-mail 1 (docs/09 §5) pour chaque ligne auditée. N'ENVOIE RIEN : produit un CSV et des .eml à relire.
 * Usage : node --experimental-strip-types scripts/write-emails.ts .data/audited-43.22A-75011.csv
 * Env : SENDER_NAME, SENDER_ADDRESS (adresse postale), SENDER_SIREN, SENDER_EMAIL, SITE_URL
 * Exclus : pas d'e-mail générique renseigné, EI (règle E8), audit en erreur/sans concurrent, adresse dans .data/suppression.txt.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { createHash, createHmac } from 'node:crypto';
import { basename } from 'node:path';

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows;
  return body.filter((r) => r.some(Boolean)).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}
// Neutralise les formules tableur (=, +, -, @) : qa/securite.md F4.
const csvCell = (v: unknown) => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const EMAIL_RE = /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[a-z]{2,}$/i;
const todo = (v: string | undefined, label: string) => v || `[${label} À COMPLÉTER]`;
const GENERIC = /^(contact|info|bonjour|hello|accueil|reservation|reservations|agence|cabinet|devis)@/i;

const file = process.argv[2];
if (!file) { console.error('Usage : write-emails.ts <audited.csv>'); process.exit(1); }
const site = (process.env.SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const sender = todo(process.env.SENDER_NAME, 'NOM EXPÉDITEUR');
const address = todo(process.env.SENDER_ADDRESS, 'ADRESSE POSTALE');
const siren = todo(process.env.SENDER_SIREN, 'SIREN');
const contact = todo(process.env.SENDER_EMAIL, 'E-MAIL EXPÉDITEUR');
const today = new Date().toLocaleDateString('fr-FR');
const sha = (e: string) => createHash('sha256').update(e.trim().toLowerCase()).digest('hex');
// Liste d'opposition : .data/suppression.txt (saisie manuelle + export de la table Supabase `suppression`)
// et .data/suppression.json (store démo, alimenté par /desinscription et /api/unsubscribe).
// Avec Supabase, l'export (select email_hash from suppression) doit dater de moins de 24 h.
if (process.env.SUPABASE_URL) {
  const fresh = existsSync('.data/suppression.txt') && Date.now() - statSync('.data/suppression.txt').mtimeMs < 86_400_000;
  if (!fresh) { console.error('Exportez la table `suppression` (email_hash) dans .data/suppression.txt (moins de 24 h) avant de générer.'); process.exit(1); }
}
const suppressed = new Set(existsSync('.data/suppression.txt') ? readFileSync('.data/suppression.txt', 'utf8').split('\n').map((s) => s.trim()).filter(Boolean) : []);
try { for (const h of Object.keys(JSON.parse(readFileSync('.data/suppression.json', 'utf8')))) suppressed.add(h); } catch { /* absent */ }
// Même jeton que src/lib/email.ts (unsubscribeToken) : lien signé HMAC vérifié par la page /desinscription (E5).
const unsubSecret = process.env.UNSUBSCRIBE_SECRET;
if (!unsubSecret) { console.error('UNSUBSCRIBE_SECRET requis (même valeur que sur le site, sinon les liens de désinscription seront refusés).'); process.exit(1); }
const unsubToken = (e: string) => createHmac('sha256', unsubSecret).update(e).digest('base64url').slice(0, 32);
const unsubscribeUrl = (email: string) => {
  const e = email.trim().toLowerCase();
  return `${site}/desinscription?e=${encodeURIComponent(e)}&t=${unsubToken(e)}`;
};
const oneClickUrl = (email: string) => {
  const e = email.trim().toLowerCase();
  return `${site}/api/unsubscribe?e=${encodeURIComponent(e)}&t=${unsubToken(e)}`;
};

const rows = parseCsv(readFileSync(file, 'utf8'));
const out: Record<string, string>[] = [];
const skipped: string[] = [];
mkdirSync('.data/eml', { recursive: true });

for (const r of rows) {
  const email = (r.email_generique ?? '').trim();
  const why =
    !email ? 'pas d\'e-mail générique renseigné'
    : !EMAIL_RE.test(email) ? 'e-mail invalide'
    : suppressed.has(sha(email)) ? 'adresse en liste d\'opposition'
    : r.erreur || !r.audit_id ? 'audit absent ou en erreur'
    : r.demo === 'oui' ? 'audit de démonstration (données simulées) : jamais envoyé'
    : r.ei === 'oui' ? 'entrepreneur individuel (règle E8, validation humaine requise)'
    : !r.email_source_url ? 'email_source_url manquante (preuve de la source, E11)'
    : !r.concurrents ? 'aucun concurrent cité (ne jamais en inventer)'
    : '';
  if (why) { skipped.push(`${r.nom} : ${why}`); continue; }
  const warn = GENERIC.test(email) ? '' : 'adresse non générique : vérifier qu\'elle est publiée par le commerce comme contact pro';
  const [A, B] = r.concurrents.split(' | ');
  const arr = /^750(\d\d)$/.exec(r.code_postal ?? '');
  const n = arr ? Number(arr[1]) : 0;
  const quartier = n >= 1 && n <= 20 ? `Paris ${n === 1 ? '1er' : `${n}e`}` : r.code_postal ? `Paris ${r.code_postal}` : 'Paris';
  const stop = unsubscribeUrl(email);
  const subject = `${r.nom} : ${r.score}/100 de visibilité IA, ${A} est cité à votre place`.replace(/[\r\n]+/g, ' ');
  const body = `Bonjour,

J'ai demandé à ChatGPT, Perplexity et Gemini « meilleur ${r.metier} ${quartier} » (interrogations du ${today}) et j'ai regardé quels établissements ils citent.

Votre score de visibilité : ${r.score}/100.
Établissements cités par les assistants IA : ${[A, B].filter(Boolean).join(', ')}.

Le rapport complet pour ${r.nom} (questions posées, réponses obtenues, méthode et limites) est ici, sans inscription ni engagement : ${r.rapport_url}

Pourquoi je vous écris : de plus en plus de clients demandent une adresse à une IA plutôt qu'à Google. Ce résultat est un instantané, pas un jugement sur la qualité de votre travail.

Si cela vous parle, répondez à ce message : je vous envoie 3 actions concrètes.

${sender}, Repéré, ${address}

--
Vous recevez ce message à titre professionnel : votre établissement « ${r.nom} » (${r.metier}, Paris) figure dans l'annuaire public des entreprises (Sirene/INSEE) et l'adresse ${email} est publiée sur ${r.email_source_url} comme adresse de contact. Notre message concerne votre visibilité sur les assistants IA (ChatGPT, Gemini, Perplexity).
Pour ne plus rien recevoir de notre part : ${stop} ou répondez « STOP ».
Responsable du traitement : ${sender}, ${address}, SIREN ${siren}, ${contact}.
Vos droits (accès, rectification, effacement, opposition) : ${site}/confidentialite ou ${contact}.
`;
  const slug = r.siren || sha(email).slice(0, 10);
  const eml = `From: ${sender} <${contact}>\nTo: ${email}\nSubject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=\nList-Unsubscribe: <${oneClickUrl(email)}>, <mailto:${contact}?subject=STOP>\nList-Unsubscribe-Post: List-Unsubscribe=One-Click\nMIME-Version: 1.0\nContent-Type: text/plain; charset=UTF-8\nContent-Transfer-Encoding: 8bit\nX-Draft: ne-pas-envoyer-sans-relecture\n\n${body}`;
  writeFileSync(`.data/eml/${slug}.eml`, eml);
  out.push({ nom: r.nom, siren: r.siren, to: email, subject, body, lien_stop: stop, audit_id: r.audit_id, source_email: r.email_source_url, avertissement: warn });
}

const dest = `.data/emails-${basename(file).replace(/^audited-/, '')}`;
const cols = ['nom', 'siren', 'to', 'subject', 'body', 'lien_stop', 'audit_id', 'source_email', 'avertissement'];
writeFileSync(dest, [cols.join(','), ...out.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n') + '\n');
console.log(`${out.length} e-mails préparés (rien n'est envoyé) -> ${dest} et .data/eml/`);
if (skipped.length) console.log(`${skipped.length} lignes ignorées :\n- ${skipped.join('\n- ')}`);
if ([sender, address, siren, contact].some((v) => v.includes('À COMPLÉTER'))) console.warn('Attention : variables SENDER_* manquantes, mentions légales incomplètes.');
