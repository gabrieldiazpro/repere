/**
 * Format des sauvegardes chiffrées de Repéré (scripts/ops/sauvegarde.mjs). Fonctions pures, testées.
 *
 * Fichier `.repere-sauv` :  "REPSAV01" (8 octets) | sel (16) | iv (12) | étiquette GCM (16) | données chiffrées
 * Données = gzip(JSON { version, createdAt, source, tables: { <table>: [lignes…] } }).
 * Chiffrement AES-256-GCM, clé dérivée de la phrase secrète par scrypt (N=2^15, r=8, p=1). Sans la phrase,
 * le fichier est illisible ; une modification d'un seul octet est détectée (étiquette GCM).
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';

export const MAGIC = Buffer.from('REPSAV01', 'ascii');
const SCRYPT = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

/**
 * Tables exportées, dans l'ordre de restauration (parents avant enfants).
 * Exclues : rate_events (compteurs éphémères). Les comptes (schéma auth) ne sont pas accessibles par l'API :
 * ils relèvent du PITR / des sauvegardes Supabase ou du dump `pg_dump` (scripts/ops/backup.md, option B).
 */
export const TABLES = [
  'businesses',
  'subscriptions',
  'memberships',
  'invitations',
  'audits',
  'audit_runs',
  'actions_progress',
  'alerts',
  'leads',
  'documents',
  'jobs',
  'stripe_events',
  'suppression',
  'push_subscriptions',
];

export function checkPassphrase(p) {
  if (typeof p !== 'string' || p.length < 16) return 'BACKUP_PASSPHRASE doit faire au moins 16 caractères (openssl rand -base64 32).';
  return null;
}

function key(passphrase, salt) {
  return scryptSync(passphrase, salt, 32, SCRYPT);
}

/** @param {object} payload @param {string} passphrase @returns {Buffer} */
export function encryptBackup(payload, passphrase) {
  const err = checkPassphrase(passphrase);
  if (err) throw new Error(err);
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(passphrase, salt), iv);
  const body = Buffer.concat([cipher.update(gzipSync(Buffer.from(JSON.stringify(payload), 'utf8'))), cipher.final()]);
  return Buffer.concat([MAGIC, salt, iv, cipher.getAuthTag(), body]);
}

/** @param {Buffer} buf @param {string} passphrase */
export function decryptBackup(buf, passphrase) {
  if (!Buffer.isBuffer(buf) || buf.length < 52 || !buf.subarray(0, 8).equals(MAGIC)) throw new Error('Ce fichier n’est pas une sauvegarde Repéré (en-tête REPSAV01 absent).');
  const salt = buf.subarray(8, 24);
  const iv = buf.subarray(24, 36);
  const tag = buf.subarray(36, 52);
  const decipher = createDecipheriv('aes-256-gcm', key(passphrase, salt), iv);
  decipher.setAuthTag(tag);
  let plain;
  try {
    plain = Buffer.concat([decipher.update(buf.subarray(52)), decipher.final()]);
  } catch {
    throw new Error('Déchiffrement impossible : phrase secrète incorrecte ou fichier modifié.');
  }
  return JSON.parse(gunzipSync(plain).toString('utf8'));
}

export function summarize(payload) {
  const tables = payload?.tables ?? {};
  return Object.fromEntries(Object.entries(tables).map(([t, rows]) => [t, Array.isArray(rows) ? rows.length : 0]));
}

export function backupFileName(d = new Date()) {
  return `repere-${d.toISOString().slice(0, 16).replace(/[:T]/g, (c) => (c === 'T' ? '-' : ''))}.repere-sauv`;
}

/**
 * Lit toutes les lignes d'une table par pages (PostgREST plafonne une réponse à 1000 lignes).
 * @param {(from:number,to:number)=>Promise<{data:any[]|null,error:{message:string}|null}>} fetchPage
 */
export async function readAll(fetchPage, pageSize = 1000, max = 2_000_000) {
  const rows = [];
  for (let from = 0; from < max; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

/** Découpe en lots (restauration par upsert). */
export function chunks(rows, n = 500) {
  const out = [];
  for (let i = 0; i < rows.length; i += n) out.push(rows.slice(i, i + n));
  return out;
}
