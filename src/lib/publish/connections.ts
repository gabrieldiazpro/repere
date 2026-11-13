/**
 * Connexions de publication par commerce et plateforme. Les secrets (mot de passe d'application, clé webservice,
 * jeton) sont chiffrés au repos (AES-256-GCM, `INTEGRATIONS_SECRET`, src/lib/integrations) et jamais renvoyés.
 * Collection `publish.connections`, id `<businessId>__<plateforme>`.
 */
import { decryptSecret, encryptSecret } from '@/lib/integrations';
import { deleteDoc, getDoc, listDocs, putDoc } from '@/lib/store';
import { isDemoBusinessId } from '@/lib/demo-v2';
import { PublishError, type ChangeKind, type Platform, type TestResult } from './types';

export const CONNECTIONS = 'publish.connections';

export interface PublishConnection {
  businessId: string;
  platform: Platform;
  config: Record<string, string>;
  /** JSON des identifiants, chiffré */
  secretEnc: string | null;
  /** indice d'affichage : identifiant + 4 derniers caractères du secret */
  hint: string;
  createdAt: string;
  lastTest: { ok: boolean; at: string; detail: string; capabilities: ChangeKind[]; info?: Record<string, string> } | null;
}

export interface PublishConnectionView {
  platform: Platform;
  config: Record<string, string>;
  hint: string;
  createdAt: string;
  lastTest: PublishConnection['lastTest'];
}

const docId = (businessId: string, platform: Platform) => `${businessId}__${platform}`;

export function toView(c: PublishConnection): PublishConnectionView {
  return { platform: c.platform, config: { ...c.config }, hint: c.hint, createdAt: c.createdAt, lastTest: c.lastTest };
}

function hintOf(credentials: Record<string, string>): string {
  const user = credentials.username ?? '';
  const secret = credentials.password ?? credentials.apiKey ?? credentials.token ?? credentials.accessToken ?? '';
  return `${user ? `${user} · ` : ''}…${secret.slice(-4)}`;
}

export async function saveConnection(businessId: string, platform: Platform, config: Record<string, string>, credentials: Record<string, string>, now = new Date()): Promise<PublishConnection> {
  if (isDemoBusinessId(businessId)) throw new PublishError(403, 'Compte de démonstration : les modifications ne sont pas enregistrées.', 'demo_read_only');
  const hasSecret = Object.keys(credentials).length > 0;
  const c: PublishConnection = {
    businessId,
    platform,
    config,
    secretEnc: hasSecret ? encryptSecret(JSON.stringify(credentials)) : null,
    hint: hasSecret ? hintOf(credentials) : '',
    createdAt: now.toISOString(),
    lastTest: null,
  };
  await putDoc<PublishConnection>(CONNECTIONS, docId(businessId, platform), c, businessId);
  return c;
}

export async function getConnection(businessId: string, platform: Platform): Promise<PublishConnection | null> {
  if (isDemoBusinessId(businessId)) return null;
  const d = await getDoc<PublishConnection>(CONNECTIONS, docId(businessId, platform));
  return d && d.data.businessId === businessId ? d.data : null;
}

export async function listConnections(businessId: string): Promise<PublishConnection[]> {
  if (isDemoBusinessId(businessId)) return [];
  return (await listDocs<PublishConnection>(CONNECTIONS, { businessId })).map((d) => d.data).filter((c) => c.businessId === businessId);
}

export async function removeConnection(businessId: string, platform: Platform): Promise<boolean> {
  if (!(await getConnection(businessId, platform))) return false;
  await deleteDoc(CONNECTIONS, docId(businessId, platform));
  return true;
}

export async function recordTest(businessId: string, platform: Platform, r: TestResult, now = new Date()): Promise<void> {
  const c = await getConnection(businessId, platform);
  if (!c) return;
  c.lastTest = { ok: r.ok, at: now.toISOString(), detail: r.detail, capabilities: r.capabilities, ...(r.info ? { info: r.info } : {}) };
  await putDoc<PublishConnection>(CONNECTIONS, docId(businessId, platform), c, businessId);
}

export function credentialsOf(c: PublishConnection): Record<string, string> {
  if (!c.secretEnc) return {};
  try {
    return JSON.parse(decryptSecret(c.secretEnc)) as Record<string, string>;
  } catch {
    throw new PublishError(409, 'Connexion illisible : supprimez-la puis reconnectez la plateforme.', 'secret_unreadable');
  }
}
