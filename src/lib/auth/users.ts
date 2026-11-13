/**
 * Comptes utilisateurs, quel que soit le mode :
 * - Supabase : auth.users (création non confirmée, confirmation au premier clic sur le lien magique) ;
 * - local    : « compte local de développement », collection `auth.users` du store (src/lib/store.ts),
 *              identifiant déterministe dérivé de l'e-mail.
 */
import crypto from 'node:crypto';
import { deleteDoc, getDoc, putDoc } from '@/lib/store';
import { authMode } from './config';
import * as sbAuth from './supabase';

export interface AuthUser {
  id: string;
  email: string;
  /** L'adresse a été prouvée (clic sur un lien magique envoyé à cette adresse). */
  confirmed: boolean;
}

const LOCAL_USERS = 'auth.users';

export function normEmail(email: string): string {
  return email.trim().toLowerCase();
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isEmail(v: unknown): v is string {
  return typeof v === 'string' && v.length <= 254 && EMAIL_RE.test(v.trim());
}

/** Identifiant (format UUID) stable d'un compte local. */
export function localUserId(email: string): string {
  const h = crypto.createHash('sha256').update(`repere-local:${normEmail(email)}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

interface LocalUserDoc {
  email: string;
  confirmedAt: string | null;
}

export async function findUser(email: string): Promise<AuthUser | null> {
  const e = normEmail(email);
  if (authMode() === 'supabase') return sbAuth.findUserByEmail(e);
  if (authMode() === 'off') return null;
  const id = localUserId(e);
  const doc = await getDoc<LocalUserDoc>(LOCAL_USERS, id);
  return doc ? { id, email: e, confirmed: Boolean(doc.data.confirmedAt) } : null;
}

/** Trouve ou crée le compte (jamais confirmé à la création). */
export async function ensureUser(email: string): Promise<AuthUser & { created: boolean }> {
  const e = normEmail(email);
  const existing = await findUser(e);
  if (existing) return { ...existing, created: false };
  if (authMode() === 'supabase') return { ...(await sbAuth.createUser(e)), created: true };
  if (authMode() === 'off') throw new Error('[auth] aucun fournisseur de comptes configuré');
  const id = localUserId(e);
  await putDoc<LocalUserDoc>(LOCAL_USERS, id, { email: e, confirmedAt: null });
  return { id, email: e, confirmed: false, created: true };
}

/** Mode local : marque l'adresse confirmée (clic sur le lien). Supabase le fait lui-même à la vérification. */
export async function markLocalConfirmed(email: string): Promise<AuthUser> {
  const e = normEmail(email);
  const id = localUserId(e);
  const doc = await getDoc<LocalUserDoc>(LOCAL_USERS, id);
  const confirmedAt = doc?.data.confirmedAt ?? new Date().toISOString();
  await putDoc<LocalUserDoc>(LOCAL_USERS, id, { email: e, confirmedAt });
  return { id, email: e, confirmed: true };
}

/** Supprime le compte (droit à l'effacement, M7 de qa/v3/securite-v3.md). Les adhésions sont retirées par l'appelant. */
export async function deleteUserAccount(userId: string, email: string): Promise<void> {
  if (authMode() === 'supabase') {
    const { error } = await sbAuth.adminClient().auth.admin.deleteUser(userId);
    if (error) throw new Error(`[auth] suppression du compte : ${error.message}`);
    return;
  }
  if (authMode() === 'off') return;
  await deleteDoc(LOCAL_USERS, localUserId(email));
}
