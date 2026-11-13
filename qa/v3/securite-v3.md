# Revue de sécurité V3 : Repéré (app/)

Date : 10 novembre 2026. Revue **en lecture seule** : aucun fichier de code modifié, ni build, ni tsc, ni vitest.
Périmètre : code nouveau de la V3 (docs/v3/12-CONTRATS-V3.md, mission docs/v3/missions/SECURITE-V3.md).
Les numéros de ligne correspondent à l'état des fichiers au moment de la lecture. Plusieurs agents écrivent en parallèle :
**revérifiez chaque bloc « avant » avant d'appliquer un patch.**

> Statut : **TERMINÉ**. Ordre d'application en fin de document.

## Synthèse

Aucun problème **critique** trouvé à ce stade : l'authentification (lien magique PKCE, session httpOnly, rattachement
lié à une adresse prouvée), `requireBusiness`, le webhook Stripe, la récupération d'URL anti-SSRF de `siteaudit`, les
jetons de partage et l'OAuth Shopify sont solides. Les problèmes trouvés sont des contournements d'offre (coût IA),
une redirection ouverte et des défauts de second rang.

| # | Gravité | Sujet | Fichier principal |
|---|---|---|---|
| E1 | **Élevé** | Mesure manuelle quotidienne ouverte à toutes les offres, Découverte comprise (« 1 mesure par mois » contourné, budget IA multiplié par compte gratuit) | `src/app/api/audit/route.ts:157-166` |
| M1 | Moyen | Redirection ouverte après connexion : `safeNext` laisse passer `/<TAB>/evil.fr` | `src/lib/auth/cookies.ts:347-351` |
| M2 | Moyen | Webhooks sortants : SSRF aveugle (rebinding DNS entre contrôle et envoi, filtre IP incomplet : NAT64, 6to4, fe80::/10 partiel…), oracle de ports par le bouton « Tester » | `src/lib/integrations/index.ts:129-175,329-347` |
| M3 | Moyen | Destinataires des rapports planifiés confirmés par un simple GET (les antivirus de messagerie cliquent : le double opt-in ne prouve rien). Régression du E3 de la V2 | `src/app/api/alerts/reports/confirm/route.ts:17-23` |
| M4 | Moyen | Paiement avec l'`auditId` (public) d'un tiers : l'attaquant récupère la saisie de l'audit (e-mail, téléphone du prospect) et bloque le rattachement légitime | `src/lib/auth/provision.ts:155-185` |
| M5 | Moyen | Déni de service mémoire de `safeFetch` : cache de 300 corps de 2 Mo (≈ 1,2 Go en chaînes UTF-16) et cache robots.txt sans borne | `src/lib/siteaudit/fetch.ts:264-269,339-357,451-454` |
| M6 | Moyen | Parrainage : auto-parrainage contournable (alias d'e-mail, autre carte), attribution possible après des mois d'abonnement payé | `src/lib/growth/referral.ts:97-123`, `src/app/api/growth/referral/attribute/route.ts` |
| M7 | Moyen (RGPD) | Effacement incomplet : le compte utilisateur (auth.users), les audits gratuits et prospects à la même adresse restent ; l'export du parrain révèle les filleuls | `src/app/api/account/data/gdpr.ts:197-219` |
| M8 | Moyen | Classement public « opt-in » publiable avec 10 faux comptes gratuits portant les noms de vrais commerces | `src/lib/growth/ranking.ts:83-101` |
| F1 | Faible | `AUTH_LOCAL_ACCOUNTS=1` active les comptes locaux en production (simple avertissement) : liens magiques complets dans les journaux | `src/lib/auth/config.ts:27-31`, `src/lib/env.ts:225` |
| F2 | Faible | Droits non revérifiés après rétrogradation : liens de partage (marque blanche), webhooks et Shopify continuent | `src/lib/share/index.ts:222-240`, `src/lib/integrations/index.ts:358` |
| F3 | Faible | Secrets : repli codé en dur (`repere-dev-*`), clés partagées (`AUTH_SECRET` → `AUDIT_SIGNING_SECRET`, `SHARE_SECRET` → `UNSUBSCRIBE_SECRET` → clé service_role) | `src/lib/auth/config.ts:42-47`, `src/lib/share/index.ts:95-97`, `src/lib/integrations/index.ts:77-80`, `src/lib/notify/reports.ts:98-100` |
| F4 | Faible | `/api/health` public : requête `count: 'exact'` sur `businesses` à chaque appel, SHA du commit exposé | `src/app/api/health/route.ts:81,113` |
| F5 | Faible | Déverrouillage des liens protégés : 10 essais/h par IP et par lien (contournable avec plusieurs /64 ou IP de cloud), `scryptSync` bloque la boucle d'événements | `src/app/api/share/unlock/route.ts:22`, `src/lib/share/index.ts:89-93` |
| F6 | Faible | Divers : CA « attribué aux IA » falsifiable par t.js, lecteur (viewer) déclenche des appels LLM e-commerce, jeton Supabase non révoqué à la déconnexion (HS256 local), connexion forcée (login CSRF) par les liens `token_hash`, `DELETE /api/account/data` sans `assertSameOrigin` | voir détail |

---

## E1. Élevé : mesure manuelle quotidienne ouverte à toutes les offres (offre Découverte comprise)

**Fichier** : `src/app/api/audit/route.ts:155-166`

```ts
  const businessId = (json as { businessId?: unknown } | null)?.businessId;
  if (typeof businessId === 'string' && businessId) {
    try {
      await requireBusiness(req, businessId, { write: true });
      const day = new Date().toISOString().slice(0, 10);
      const { id } = await enqueue('audit.run', { businessId, trigger: 'manual' }, { businessId, dedupeKey: `audit.run:manual:${businessId}:${day}` });
```

La décision 2 du contrat fixe Découverte à « 1 mesure par mois ». `handleAuditScheduled` respecte la fréquence de
l'offre (`isAuditDue`), mais la relance manuelle n'en tient aucun compte : un membre de n'importe quel espace,
gratuit compris, déclenche une mesure complète (questions suivies × IA de l'offre) **chaque jour**. Le traitant
`audit.run` (`src/lib/jobs/handlers.ts:103-146`) ne filtre pas non plus le déclencheur `manual`. Il n'existe aucun
plafond global de dépense IA pour la file (seulement un budget par audit dans `engine/audit.ts`).

**Exploitation** : un attaquant crée N comptes Découverte (adresses jetables ou alias `+n`, un clic sur le lien
magique chacun), puis appelle chaque jour `POST /api/audit {"businessId":"<id>"}` avec sa session. Coût ≈ 15 appels
IA par compte et par jour au lieu de 15 par mois, sans aucun paiement : facture API multipliée par 30, et les tâches
de ces comptes passent devant les ré-audits planifiés des clients payants. Un client payant mensuel (Essentiel local)
obtient lui aussi un suivi quotidien qu'il n'a pas acheté.

**Patch** (avant / après), `src/app/api/audit/route.ts` :

```ts
// AVANT
      await requireBusiness(req, businessId, { write: true });
      const day = new Date().toISOString().slice(0, 10);
      const { id } = await enqueue('audit.run', { businessId, trigger: 'manual' }, { businessId, dedupeKey: `audit.run:manual:${businessId}:${day}` });
      return NextResponse.json({ jobId: id }, { status: 202 });
```

```ts
// APRÈS
      const { business } = await requireBusiness(req, businessId, { write: true });
      const { getEntitlements } = await import('@/lib/entitlements');
      const { isAuditDue, periodKey } = await import('@/lib/jobs/platform');
      const { getLatestAuditForBusiness } = await import('@/lib/db');
      const ent = getEntitlements(business);
      const latest = await getLatestAuditForBusiness(business.id);
      const now = new Date();
      // Une mesure manuelle n'avance que la prochaine mesure due : jamais plus d'une par période de l'offre
      // (Découverte : 1 par mois, décision 2 ; Essentiel PME : 1 par semaine…).
      if (!isAuditDue(ent.frequency, latest?.createdAt, now)) {
        return NextResponse.json(
          { error: 'Votre offre comprend une mesure par période : la prochaine sera disponible plus tard.', code: 'quota_exceeded' },
          { status: 402 },
        );
      }
      const { id } = await enqueue(
        'audit.run',
        { businessId, trigger: 'manual' },
        { businessId, dedupeKey: `audit.run:${businessId}:${periodKey(ent.frequency, now)}` },
      );
      return NextResponse.json({ jobId: id }, { status: 202 });
```

Vérifier que `isAuditDue` et `periodKey` sont bien exportés par `src/lib/jobs/platform.ts` (lignes 29 et 43, c'est le
cas à la lecture) et que `getLatestAuditForBusiness` existe dans `src/lib/db.ts` (utilisé par `handlers.ts:237`).
Pour qu'une mesure manuelle et la mesure planifiée de la même période se dédoublonnent, donnez la même forme de clé
au cron : dans `src/lib/jobs/handlers.ts:245`, remplacer `audit.run:scheduled:${b.id}:${periodKey(ent.frequency, now)}`
par `audit.run:${b.id}:${periodKey(ent.frequency, now)}`. Le contrôle `isAuditDue` suffit déjà à empêcher le doublon
dans la plupart des cas ; l'alignement des clés couvre la course entre les deux.
En complément (recommandé) : un plafond global quotidien d'appels IA dans `runAudit` côté file, comme
`underDailyCap()` de `src/lib/execution/llm.ts`.

---

## M1. Moyen : redirection ouverte après connexion (`safeNext` contourné par une tabulation)

**Fichier** : `src/lib/auth/cookies.ts:346-351`

```ts
export function safeNext(next: string | null | undefined, fallback = '/app'): string {
  if (!next || typeof next !== 'string') return fallback;
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\') || /[\r\n]/.test(next)) return fallback;
  return next.slice(0, 500);
}
```

L'analyseur d'URL WHATWG (navigateurs et `new URL` de Node) **supprime les tabulations et retours à la ligne** avant
d'analyser. `"/\t/evil.fr"` commence par `/`, pas par `//` ni `/\`, ne contient ni `\r` ni `\n` : il passe. Ensuite :
- `src/app/connexion/callback/route.ts:175` : `new URL(to, url)` donne `https://evil.fr/` ;
- `src/app/connexion/page.tsx:40` : `<Link href={next}>` donne le même lien dans le navigateur.

**Exploitation** : l'attaquant envoie `https://<site>/connexion?next=%2F%09%2Fevil.fr%2Fsession-expiree`. La victime
saisit son adresse ; Supabase lui envoie un **vrai** lien magique (notre domaine, notre gabarit) qui porte `next`. Au
clic, la session s'ouvre puis le 303 l'envoie sur `evil.fr`, qui imite l'app (« reconnectez-vous », « carte refusée,
saisissez vos coordonnées »). Variante : `/%09/%5Cevil.fr`, `/%09%09/evil.fr`.

**Patch**, `src/lib/auth/cookies.ts` :

```ts
// AVANT
export function safeNext(next: string | null | undefined, fallback = '/app'): string {
  if (!next || typeof next !== 'string') return fallback;
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\') || /[\r\n]/.test(next)) return fallback;
  return next.slice(0, 500);
}
```

```ts
// APRÈS
export function safeNext(next: string | null | undefined, fallback = '/app'): string {
  if (!next || typeof next !== 'string' || next.length > 500) return fallback;
  // Caractères de contrôle (tabulation, retours…) et barres obliques inverses : refusés avant toute analyse,
  // car l'analyseur WHATWG les retire ou les traite comme « / » (« /\t/evil.fr » → « //evil.fr »).
  if (/[\u0000-\u001f\u007f\\]/.test(next)) return fallback;
  if (!next.startsWith('/') || next.startsWith('//')) return fallback;
  try {
    const base = 'https://repere.invalid';
    const u = new URL(next, base);
    if (u.origin !== base) return fallback;
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return fallback;
  }
}
```

Ajouter au test de `src/lib/auth/__tests__/comptes.test.ts` : `safeNext('/\t/evil.fr')`, `safeNext('/%09/evil.fr')`
décodé, `safeNext('/\\evil.fr')`, `safeNext('/\u0000/evil.fr')` → `/app`.

---

## M2. Moyen : webhooks sortants, SSRF aveugle (rebinding DNS, filtre IP incomplet) et oracle de ports

**Fichiers** : `src/lib/integrations/index.ts:129-140` (`isPrivateIp`), `:167-175` (`assertPublicHost`), `:329-347` (`post`),
`:404-414` (`sendTest`).

1. **Contrôle puis connexion séparés** : `assertPublicHost` résout le nom (`dns.lookup`), puis `fetch(url)` le
   résout **une seconde fois**. Un domaine à TTL 0 qui répond d'abord une IP publique puis `10.x`/`127.0.0.1`
   (rebinding) passe le contrôle. `siteaudit/fetch.ts` règle exactement ce cas par épinglage : il n'est pas réutilisé.
2. **Filtre IP incomplet** (`isPrivateIp`) : laisse passer `64:ff9b::a9fe:a9fe` (NAT64 vers 169.254.169.254),
   `2002:7f00:1::` (6to4 vers 127.0.0.1), `::7f00:1` (IPv4 compatible), `fe81::`…`febf::` (lien local : seul le
   préfixe texte `fe80` est testé), `fec0::/10`, `198.18.0.0/15`, `192.0.0.0/24`, et toute IPv6 hors `2000::/3`.
3. **Oracle** : `POST /api/integrations/test` est synchrone et renvoie `code` (statut HTTP) et `error` (message de
   l'exception, 200 caractères) ; `lastStatus` les garde. Un administrateur d'un espace payant peut donc sonder des
   hôtes et ports internes (le port est forcé à 443, mais pas l'hôte), 20 fois par heure et par IP.

**Exploitation** : webhook `https://rb.attaquant.fr/` (DNS alterné public/`10.0.0.5`), puis « Tester » en boucle :
la réponse `réponse 401` ou `fetch failed` indique quels services internes écoutent en 443. Sur un hébergement
autre que Vercel (VM, conteneur avec métadonnées), la cible `64:ff9b::a9fe:a9fe` atteint les métadonnées cloud par NAT64.

**Patch** : réutiliser la validation et l'épinglage de `siteaudit`, et ne plus renvoyer le message brut.

```ts
// AVANT (src/lib/integrations/index.ts:166-175)
/** Contrôle à l'envoi : l'hôte ne doit pas résoudre vers une adresse privée. */
async function assertPublicHost(url: string): Promise<void> {
  const host = new URL(url).hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error('adresse interne refusée');
    return;
  }
  const addrs = await dns.lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new Error('adresse interne refusée');
}
```

```ts
// APRÈS
import https from 'node:https';
import { isBlockedIp, resolvePublic, type ResolvedAddress } from '@/lib/siteaudit/fetch';

/** Envoi POST épinglé sur l'adresse validée (pas de seconde résolution DNS : rebinding sans effet). */
async function pinnedPost(url: string, headers: Record<string, string>, body: string): Promise<{ ok: boolean; status: number }> {
  const u = new URL(url);
  const address: ResolvedAddress = await resolvePublic(u.hostname); // lève si une adresse est privée
  return new Promise((resolve, reject) => {
    const req = https.request(
      u,
      {
        method: 'POST',
        headers: { ...headers, 'Content-Length': String(Buffer.byteLength(body)) },
        agent: false,
        signal: AbortSignal.timeout(10_000),
        lookup: (_h, opts, cb) =>
          (opts as { all?: boolean }).all
            ? (cb as unknown as (e: null, a: { address: string; family: number }[]) => void)(null, [{ address: address.address, family: address.family }])
            : cb(null, address.address, address.family),
      },
      (res) => {
        res.resume(); // corps ignoré, jamais lu
        const status = res.statusCode ?? 0;
        resolve({ ok: status >= 200 && status < 300, status });
      },
    );
    req.on('error', reject);
    req.end(body);
  });
}
```

```ts
// AVANT (src/lib/integrations/index.ts:129-140)
export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
  ...
  return true;
}
```

```ts
// APRÈS : une seule source de vérité (couvre NAT64, 6to4, fe80::/10, fec0::/10, hors 2000::/3…)
export function isPrivateIp(ip: string): boolean {
  return isBlockedIp(ip);
}
```

```ts
// AVANT (post, :330-346)
  const url = decryptSecret(t.urlEnc);
  if (!skipDns) await assertPublicHost(url);
  ...
  try {
    const res = await fetchImpl(url, { method: 'POST', headers, body, redirect: 'manual', signal: AbortSignal.timeout(10_000) });
    return res.ok ? { ok: true, code: res.status } : { ok: false, code: res.status, error: `réponse ${res.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message.slice(0, 200) : 'échec réseau' };
  }
```

```ts
// APRÈS
  const url = decryptSecret(t.urlEnc);
  ...
  try {
    const res = skipDns ? await fetchImpl(url, { method: 'POST', headers, body, redirect: 'manual', signal: AbortSignal.timeout(10_000) }) : await pinnedPost(url, headers, body);
    if (res.ok) return { ok: true, code: res.status };
    // Statut renvoyé seulement pour les réponses « applicatives » ; pas de détail réseau (oracle de ports).
    return { ok: false, code: res.status >= 400 ? res.status : undefined, error: 'Le serveur du webhook a refusé l’envoi.' };
  } catch {
    return { ok: false, error: 'Adresse injoignable ou refusée.' };
  }
```

`assertPublicHost` et l'import `dns` deviennent inutiles. Les tests qui utilisent `__setFetch` + `__skipDnsCheck(true)`
gardent le chemin `fetchImpl`. Ajouter `entitled('integrations')` dans `/api/integrations/test` (voir F2).

---

## M3. Moyen : double opt-in des rapports planifiés confirmé par un GET (antivirus de messagerie)

**Fichiers** : `src/app/api/alerts/reports/confirm/route.ts:17-23`, `src/lib/notify/reports.ts:102-122,210-220`.

`GET /api/alerts/reports/confirm?token=…` confirme le destinataire **sur simple chargement**. Les passerelles
(Microsoft Safe Links, Mimecast, Proofpoint, Gmail) ouvrent les liens des e-mails entrants : l'adresse ajoutée par un
administrateur est confirmée sans action humaine. C'est le même défaut que le E3 de la V2 (« C'est fait » en GET),
réintroduit dans le nouveau module. Le jeton n'expire pas non plus.

**Exploitation** : un compte payant ajoute 20 adresses de prospects ou de concurrents comme destinataires ; leurs
antivirus confirment ; ils reçoivent chaque semaine un e-mail de notre domaine dont le nom affiché (`business.name`,
marque blanche) est choisi par l'attaquant. Le « consentement » enregistré est faux (RGPD, réputation d'envoi).

**Patch** : GET affiche un bouton, POST confirme ; jeton daté.

```ts
// AVANT (src/app/api/alerts/reports/confirm/route.ts:17-23)
export async function GET(req: Request) {
  const rl = await rateLimit('report-confirm', getClientIp(req), 30, HOUR_MS);
  if (!rl.ok) return page('Trop de tentatives', 'Réessayez dans une heure.', 429);
  const token = new URL(req.url).searchParams.get('token') ?? '';
  const r = await confirmRecipient(token.slice(0, 1000)).catch(() => ({ ok: false as const, businessName: undefined }));
  if (!r.ok) return page('Lien invalide', 'Ce lien de confirmation est invalide ou l’adresse a été retirée des destinataires.', 400);
  return page('Adresse confirmée', `Vous recevrez désormais les rapports de visibilité dans les IA${r.businessName ? ` de ${r.businessName}` : ''}. Chaque e-mail contient un lien de désinscription.`);
}
```

```ts
// APRÈS
export async function GET(req: Request) {
  const token = (new URL(req.url).searchParams.get('token') ?? '').slice(0, 1000);
  // Aucune écriture sur GET : les antivirus de messagerie ouvrent les liens.
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Confirmer</title></head>
<body style="margin:0;font-family:system-ui,Arial,sans-serif;background:#F6F7FB;color:#1B1F2E"><main style="max-width:520px;margin:12vh auto;padding:28px;background:#fff;border:1px solid #D5D9E4;border-radius:14px">
<h1 style="font-size:22px;margin:0 0 12px">Recevoir les rapports ?</h1>
<form method="post"><input type="hidden" name="token" value="${esc(token)}"><button type="submit" style="font-size:16px;padding:10px 16px">Oui, je confirme mon adresse</button></form>
</main></body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
}

export async function POST(req: Request) {
  const rl = await rateLimit('report-confirm', getClientIp(req), 30, HOUR_MS);
  if (!rl.ok) return page('Trop de tentatives', 'Réessayez dans une heure.', 429);
  const form = await req.formData().catch(() => null);
  const token = String(form?.get('token') ?? '').slice(0, 1000);
  const r = await confirmRecipient(token).catch(() => ({ ok: false as const, businessName: undefined }));
  if (!r.ok) return page('Lien invalide', 'Ce lien de confirmation est invalide, expiré, ou l’adresse a été retirée des destinataires.', 400);
  return page('Adresse confirmée', `Vous recevrez désormais les rapports de visibilité dans les IA${r.businessName ? ` de ${r.businessName}` : ''}. Chaque e-mail contient un lien de désinscription.`);
}
```

La CSP statique autorise `form-action 'self'` : le formulaire sans `action` poste sur la même URL, c'est permis.

```ts
// AVANT (src/lib/notify/reports.ts:102-106)
export function confirmToken(businessId: string, email: string): string {
  const body = Buffer.from(JSON.stringify({ b: businessId, e: email })).toString('base64url');
```

```ts
// APRÈS : expiration à 14 jours
export function confirmToken(businessId: string, email: string, now: number = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ b: businessId, e: email, x: Math.floor(now / 1000) + 14 * 86_400 })).toString('base64url');
```

et dans `readConfirmToken`, après `JSON.parse` :

```ts
// AVANT
    const j = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as { b?: string; e?: string };
    return j.b && j.e ? { businessId: j.b, email: j.e } : null;
// APRÈS
    const j = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as { b?: string; e?: string; x?: number };
    if (typeof j.x !== 'number' || j.x * 1000 < Date.now()) return null;
    return j.b && j.e ? { businessId: j.b, email: j.e } : null;
```

Même revue à faire pour tout autre lien d'e-mail qui écrit sur GET (vérifié : `/api/digest/done` est passé en POST
depuis la V2 ; `/api/unsubscribe` en GET est accepté par l'usage RFC 8058 s'il reste idempotent et réversible).

---

## M4. Moyen : achat avec l'`auditId` d'un tiers (fuite de la saisie, rattachement légitime bloqué)

**Fichier** : `src/lib/auth/provision.ts:155-185` (`businessFromAudit`), appelé par le webhook avec
`meta.audit_id ?? session.client_reference_id` ; `src/app/api/checkout/route.ts:18` accepte tout UUID d'audit.

L'identifiant d'audit est public par construction (URL `/rapport/<id>` partagée, transférée, indexée par les
messageries). Si l'audit n'est encore rattaché à aucun commerce, `businessFromAudit` crée un commerce pour **l'acheteur**,
avec `auditInput: audit.input` complet (dont `email`, `phone` et le nom du prospect qui a fait l'audit), puis
`linkAuditToBusiness(auditId, b.id)`. Le correctif E1 de la V1 empêche de prendre un commerce déjà rattaché, pas
celui-ci.

**Exploitation** : un concurrent récupère le lien `/rapport/<uuid>` d'un commerçant, paie l'offre Essentiel la moins
chère avec sa propre adresse en passant `auditId=<uuid>`. Il obtient un espace au nom du commerçant, avec son e-mail et
son téléphone dans les réglages / l'export RGPD (`business.auditInput`), et l'audit est désormais lié à lui : quand le
vrai commerçant s'inscrit avec `/inscription?audit=<uuid>`, `afterSignup` (`claims.ts:413`) refuse le rattachement
(`owner` déjà présent), et son propre paiement crée un second commerce (`provision.ts:163`).

**Patch**, `src/lib/auth/provision.ts` :

```ts
// AVANT
  const audit = await getAudit(auditId);
  if (!audit) return null;
  const segment: Segment =
```

```ts
// APRÈS
  const audit = await getAudit(auditId);
  if (!audit) return null;
  // L'identifiant d'audit est public : on ne reprend la saisie (nom, e-mail, téléphone) et on ne lie l'audit que
  // si l'acheteur est la personne qui a demandé l'audit (même adresse). Sinon : espace « à compléter », sans données
  // du tiers (l'acheteur saisira lui-même son entreprise sur /bienvenue).
  const auditEmail = (audit.input as { email?: string }).email;
  if (!auditId.startsWith('demo-') && auditEmail && (!email || normEmail(auditEmail) !== normEmail(email))) {
    console.warn('[provision] audit demandé par une autre adresse : saisie non reprise', auditId);
    return null;
  }
  const segment: Segment =
```

Le cas « l'audit est demandé avec l'adresse A, le paiement fait avec l'adresse B » donne alors un espace à compléter :
c'est le comportement sûr, et le rapport reste consultable par son lien. Optionnel : dans le même cas, retirer
`email`/`phone` de `auditInput` plutôt que de refuser.

---

## M5. Moyen : déni de service mémoire par les caches de `safeFetch`

**Fichier** : `src/lib/siteaudit/fetch.ts:264-269` (cache des réponses), `:339-357` (cache robots.txt), `:451-454`.

- Le cache garde jusqu'à **300 réponses** de 2 Mo chacune, stockées en chaîne JS (UTF-16 : jusqu'à 4 Mo par corps
  binaire décodé), soit 600 Mo à 1,2 Go par instance.
- `robotsCache` n'est **jamais borné ni purgé** (les entrées expirées ne sont pas supprimées) et garde aussi des corps
  jusqu'à 2 Mo, une entrée par origine.
- Les appelants sont publics : 9 outils `/api/tools/*` (10/h/IP chacun), l'action serveur `prefillFromSite`
  (30/h/IP, `src/app/audit/actions.ts:19`), et `generateLlms` lit jusqu'à 12 pages + 2 sitemaps par appel.

**Exploitation** : un domaine joker `*.a.attaquant.fr` sert pour chaque sous-domaine un `robots.txt` et une page de
2 Mo (compressés en quelques Ko : la limite est appliquée après décompression, donc l'attaquant paie peu de bande).
Avec quelques dizaines d'IP (plusieurs /64 IPv6 ou IP de cloud : `getClientIp` regroupe déjà par /64), ou par l'action serveur `prefillFromSite` qui, elle, lit l'IP sans ce regroupement (F6), chaque appel ajoute 2 à 30 Mo en mémoire : l'instance
Node dépasse sa mémoire (1 à 2 Go sur Vercel) et tombe, avec toutes les requêtes en cours (paiement, app).

**Patch**, `src/lib/siteaudit/fetch.ts` :

```ts
// AVANT (:449-455)
  const res = await doFetch(u, opts, deadline, Math.min(opts.maxRedirects ?? MAX_REDIRECTS, MAX_REDIRECTS));
  if (useCache && res.status < 500) {
    cache.set(key, { at: Date.now(), res });
    if (cache.size > 300) cache.delete(cache.keys().next().value as string);
  }
  return res;
```

```ts
// APRÈS : budget global en octets, petites réponses seulement
  const res = await doFetch(u, opts, deadline, Math.min(opts.maxRedirects ?? MAX_REDIRECTS, MAX_REDIRECTS));
  if (useCache && res.status < 500 && res.body.length <= CACHE_MAX_ENTRY_CHARS) {
    cache.set(key, { at: Date.now(), res });
    cacheChars += res.body.length;
    while ((cache.size > 100 || cacheChars > CACHE_MAX_TOTAL_CHARS) && cache.size) {
      const oldest = cache.keys().next().value as string;
      cacheChars -= cache.get(oldest)?.res.body.length ?? 0;
      cache.delete(oldest);
    }
  }
  return res;
```

avec, près des constantes :

```ts
const CACHE_MAX_ENTRY_CHARS = 512 * 1024; // une page plus grosse n'est pas mise en cache
const CACHE_MAX_TOTAL_CHARS = 32 * 1024 * 1024; // ≈ 64 Mo en UTF-16
let cacheChars = 0;
```

(et `cacheChars = 0` dans `clearFetchCache` et `resetFetchState`). Pour le cache robots (:350-354) :

```ts
// AVANT
      entry = { at: Date.now(), body: r.status >= 200 && r.status < 300 ? r.body : null, status: r.status };
    ...
    if (useCache) robotsCache.set(origin, entry);
// APRÈS : corps tronqué à 512 Kio (minimum de lecture exigé par la RFC 9309), 500 origines au plus
      entry = { at: Date.now(), body: r.status >= 200 && r.status < 300 ? r.body.slice(0, 512 * 1024) : null, status: r.status };
    ...
    if (useCache) {
      robotsCache.delete(origin);
      robotsCache.set(origin, entry);
      if (robotsCache.size > 500) robotsCache.delete(robotsCache.keys().next().value as string);
    }
```

En complément : limite globale (toutes IP) par heure sur `/api/tools/*` (par exemple 2 000) pour couper un abus
réparti, et `maxDuration` déjà présent (30 s).

---

## M6. Moyen : fraude au parrainage

**Fichiers** : `src/lib/growth/referral.ts:97-123` (`isSelfReferral`, `attributeReferral`), `:193-224`
(`onReferredFirstPayment`), `src/app/api/growth/referral/attribute/route.ts:22-24`.

1. **Auto-parrainage** : la détection compare `ownerId`, `contactEmail` exact et `stripeCustomerId`. Un second
   compte avec `moi+2@gmail.com` (ou `m.oi@gmail.com`) et une autre carte (ou la même carte : l'empreinte de carte
   n'est pas comparée) passe.
2. **Attribution tardive** : `POST /api/growth/referral/attribute` est ouvert à tout **membre** (`write: true`) d'un
   espace, sans limite de date. Un client qui paie depuis un an attribue un code et la facture suivante (`invoice.paid`,
   montant > 0) déclenche la récompense des deux côtés.
3. Le parrain n'a pas besoin d'être client payant pour « gagner » des mois (ils sont appliqués quand il aura un
   abonnement, ou comptés comme accordés).

**Exploitation** : un client crée un second espace payant avec un alias, l'attribue à son code, paie un mois : il
reçoit les mois offerts prévus (`getRewardConfig`) sur son abonnement principal, à répéter jusqu'au plafond annuel.

**Patch** :

```ts
// AVANT (src/lib/growth/referral.ts:94)
const norm = (s: string | undefined | null) => (s ?? '').trim().toLowerCase();
```

```ts
// APRÈS : adresse canonique (alias « +tag », points Gmail)
const norm = (s: string | undefined | null) => {
  const e = (s ?? '').trim().toLowerCase();
  const at = e.lastIndexOf('@');
  if (at < 1) return e;
  let local = e.slice(0, at).replace(/\+.*$/, '');
  const domain = e.slice(at + 1).replace(/^googlemail\.com$/, 'gmail.com');
  if (domain === 'gmail.com') local = local.replace(/\./g, '');
  return `${local}@${domain}`;
};
```

```ts
// AVANT (attributeReferral, après les lectures)
  if (isSelfReferral(referee, referrer)) return { ok: false, reason: 'self_referral' };
```

```ts
// APRÈS : filleul neuf uniquement (30 jours, jamais payé), parrain payant
  if (isSelfReferral(referee, referrer)) return { ok: false, reason: 'self_referral' };
  const ageMs = Date.now() - Date.parse((referee as { createdAt?: string }).createdAt ?? '');
  if (!(ageMs >= 0 && ageMs <= 30 * 86_400_000)) return { ok: false, reason: 'already_referred' };
  if (referee.stripeCustomerId && !referee.stripeCustomerId.startsWith('guest_')) {
    const paid = await listSubscriptionsByCustomer(referee.stripeCustomerId).catch(() => []);
    if (paid.length) return { ok: false, reason: 'already_referred' };
  }
```

(`listSubscriptionsByCustomer` est déjà importé dans ce fichier, ligne utilisée par `onReferredFirstPayment`.) Dans la
route `attribute`, exiger le propriétaire : `requireBusiness(req, id, { write: true, minRole: 'owner' })`. Côté
Stripe, comparer en plus `payment_method.card.fingerprint` du filleul et du parrain avant d'appliquer le coupon.

---

## M7. Moyen (RGPD) : effacement incomplet, export trop large

**Fichier** : `src/app/api/account/data/gdpr.ts:197-219` (`deleteBusinessData`), `:137-162` (`exportBusinessData`).

L'effacement porte sur **un espace**, pas sur la personne :
- **Compte utilisateur** : la ligne `auth.users` (Supabase) ou `auth.users` du store local, avec l'adresse, n'est
  jamais supprimée ; aucune route ne le permet (`deleteUser` absent du code). Après suppression de son dernier espace,
  la personne garde un compte et ses adhésions aux espaces des autres.
- **Audits gratuits et prospects** demandés avec la même adresse mais non rattachés à l'espace (`audits.input.email`,
  table `leads`) restent ; `deleteBusinessRow` ne fait que les détacher.
- **Jetons à usage unique** `auth.signup_used`, `auth.magic_used` (identifiant utilisateur) et documents du store sans
  `businessId` ne sont jamais purgés (pas de rétention).
- **Export** : les documents `growth.referrals` sont stockés sous le `businessId` du **parrain**
  (`referral.ts:121,222`), donc l'export du parrain contient `refereeBusinessId` et le statut de paiement de chaque
  filleul, alors que `referralSummary` promet « sans identité des filleuls ».

**Patch** :

1. Nouvelle route `DELETE /api/account` (session, `assertSameOrigin`, confirmation par saisie de l'adresse) :
   refuse si l'utilisateur est **dernier propriétaire** d'un espace non supprimé, sinon retire ses adhésions, supprime
   les audits/prospects non rattachés à cette adresse, ajoute l'adresse à la liste d'opposition, puis
   `adminClient().auth.admin.deleteUser(userId)` (Supabase) ou `deleteDoc('auth.users', localUserId(email))`.
2. Dans `exportBusinessData`, après `byCollection` :

```ts
// AVANT
  for (const d of documents) (byCollection[d.collection] ??= []).push({ id: d.id, data: d.data, createdAt: d.createdAt, updatedAt: d.updatedAt });
```

```ts
// APRÈS : pas de donnée d'un autre commerce dans l'export (parrainages : compteurs seulement)
  for (const d of documents) {
    if (d.collection === 'growth.referrals') continue;
    (byCollection[d.collection] ??= []).push({ id: d.id, data: d.data, createdAt: d.createdAt, updatedAt: d.updatedAt });
  }
```

   (vérifier le nom exact de `COLLECTIONS.referrals` dans `src/lib/growth/constants.ts`.)
3. `deleteBusinessData` : supprimer aussi le document de parrainage dont l'espace est le **filleul**
   (`deleteDoc(COLLECTIONS.referrals, business.id)`, rangé sous le parrain) ; cron de purge des `auth.*_used` de plus
   de 30 jours.

---

## M8. Moyen : classement public « opt-in » alimentable par de faux comptes gratuits

**Fichiers** : `src/lib/growth/ranking.ts:83-101` (`buildRanking`), `src/app/api/growth/ranking/route.ts:38`.

Le seuil « publié à partir de 10 inscrits réels » compte des **espaces**, pas des commerces vérifiés : tout espace
Découverte (gratuit, une adresse jetable suffit) avec une mesure réelle récente (l'audit d'onboarding) et `optIn`
entre dans le classement, sous le **nom saisi librement** à l'inscription. L'opt-in est accepté d'un simple membre
(`write: true`). Rien ne vérifie que l'inscrit est le commerce nommé.

**Exploitation** : 10 comptes gratuits « Plombier Martin », « Plomberie Durand »… (vrais concurrents) à Lyon, puis
opt-in : la page publique `/classement/plombier/lyon` est publiée sous notre marque, avec les noms de commerces qui
n'ont jamais consenti (et le taux de citation mesuré pour leur nom). Risque juridique (usage du nom, dénigrement) et
contraire à « opt-in réel » du contrat CROISSANCE.

**Patch** (`buildRanking`, dans la boucle, avant `latestRealMeasure`) :

```ts
// AVANT
  for (const e of mine) {
    const m = await latestRealMeasure(e.businessId);
```

```ts
// APRÈS : seuls les espaces payants (client Stripe réel) comptent, un seul par client Stripe
  const seenCustomers = new Set<string>();
  for (const e of mine) {
    const b = await getBusinessRecord(e.businessId);
    const customer = b?.stripeCustomerId && !b.stripeCustomerId.startsWith('guest_') ? b.stripeCustomerId : null;
    if (!b || b.plan === 'free' || !customer || seenCustomers.has(customer)) continue;
    seenCustomers.add(customer);
    const m = await latestRealMeasure(e.businessId);
```

(importer `getBusinessRecord` depuis `@/lib/db`), et dans la route POST : `{ write: true, minRole: 'owner' }`.
Si les espaces gratuits doivent pouvoir figurer, exiger au minimum une preuve de lien avec le nom (domaine du site =
domaine de l'adresse du propriétaire, ou fiche Google vérifiée) et une modération avant la première publication.
`listDocs(..., { limit: 5000 })` tronque silencieusement au-delà : filtrer par couple métier × ville côté stockage.

---

## F1. Faible : comptes locaux de développement activables en production

**Fichiers** : `src/lib/auth/config.ts:27-31`, `src/lib/env.ts:225-227`, `src/lib/auth/magic.ts:396-401`.

`authMode()` renvoie `local` en production si `AUTH_LOCAL_ACCOUNTS=1` (le validateur ne fait qu'un avertissement).
Dans ce mode, chaque lien magique **complet** (jeton signé valable 30 min à 7 jours) est écrit par `console.info` :
quiconque lit les journaux (Vercel, Sentry, prestataire de logs) se connecte sous n'importe quel compte. L'usage
unique (`auth.magic_used`) est en mémoire par instance : rejouable sur une autre instance. Le `devLink` n'est bien
pas renvoyé en production (vérifié).

**Patch** : faire de `AUTH_LOCAL_ACCOUNTS=1` en production une **erreur** de `validateEnv`, et ne jamais l'honorer sur
Vercel :

```ts
// AVANT (src/lib/auth/config.ts:29)
  if (!isProduction() || process.env.AUTH_LOCAL_ACCOUNTS === '1') return 'local';
// APRÈS
  if (!isProduction()) return 'local';
  if (process.env.AUTH_LOCAL_ACCOUNTS === '1' && !process.env.VERCEL) return 'local'; // dépannage sur machine dédiée uniquement
```

et dans `magic.ts:400`, n'écrire le lien en console que hors production
(`if (!isProduction()) console.info(...)`, sinon `console.info('[auth:local] lien émis pour', normEmail(email))`).

## F2. Faible : droits non revérifiés après rétrogradation

**Fichiers** : `src/lib/share/index.ts:222-240` (`resolveShareToken`), `src/lib/integrations/index.ts:358-371`
(`dispatchEvent`), `src/app/api/integrations/test/route.ts:15`, `src/lib/ecommerce/shopify.ts:187` (`accessToken`).

À la fin de l'abonnement (`onSubscriptionChange` → `plan: 'free'`), les liens de partage déjà créés (avec marque
blanche) restent servis, les webhooks/Slack continuent d'être livrés, le bouton « Tester » marche, Shopify reste
connecté et lu. Patch : dans `buildPublicView`, renvoyer `null` si `!getEntitlements(business).shareLinks`, et ignorer
`branding` si `!whiteLabel` ; dans `dispatchEvent` et `sendTest`, sortir si `!getEntitlements(business).integrations`.

## F3. Faible : secrets de repli et clés partagées

- `src/lib/auth/config.ts:43` : `AUTH_SECRET || AUDIT_SIGNING_SECRET`. Même clé et même algorithme que
  `signPlanToken` (`src/lib/pdf/sign.ts:11`, HMAC hex de l'`auditId`, réencodable en base64url). Aucun oracle
  exploitable trouvé (les entrées signées sont des UUID), mais la séparation repose sur le hasard : préfixer
  (`hmac('auth|' + body)`) dans `cookies.ts:311-313`.
- `src/lib/share/index.ts:96`, `src/lib/integrations/index.ts:78`, `src/lib/notify/reports.ts:99` : replis sur
  `UNSUBSCRIBE_SECRET`, puis la **clé service_role** de Supabase, puis une chaîne codée en dur
  (`repere-dev-share-secret`, `repere-dev-integrations`, `repere-dev-reports`). Patch : en production, lever une
  erreur si `SHARE_SECRET` / `INTEGRATIONS_SECRET` manquent (comme `authSecret()`), et passer ces trois variables en
  `REQUIRED_IN_PRODUCTION` dans `src/lib/env.ts:166-177`. Ne jamais dériver une clé de la clé service_role.
- `unlockProof` (`share/index.ts:104`) n'a pas de préfixe de domaine : ajouter `share-unlock|`.

## F4. Faible : `/api/health` public coûteux et bavard

`src/app/api/health/route.ts:81` : `select('id', { head: true, count: 'exact' })` compte toute la table `businesses`
à chaque appel anonyme (non limité, exclu du middleware). `:113` expose le SHA du commit. Patch :
`.select('id').limit(1)` sans `count`, `release` seulement si `full`, et `rateLimit('health', ip, 120, HOUR_MS)`.

## F5. Faible : déverrouillage des liens protégés

`src/app/api/share/unlock/route.ts:22` : 10 essais/h par IP **et par préfixe de jeton** (le préfixe ne change rien
pour un attaquant qui vise un lien). Mot de passe de 6 caractères minimum. `checkPassword` utilise `scryptSync`
(≈ 50 ms de CPU bloquant par essai). Patch : ajouter un compteur par lien (`rateLimit('share-unlock-link', link.id, 50,
DAY_MS)` après résolution), passer à `crypto.scrypt` asynchrone (promisifié), et longueur minimale 8.

## F6. Faible : divers

- **CA attribué aux IA falsifiable** (`src/lib/tracking/handlers.ts:112-119`) : `Origin` se forge hors navigateur, la
  valeur `v` va jusqu'à 1 000 000 € par requête. L'écran Trafic/CA doit étiqueter ce chiffre « déclaratif (t.js) »
  et préférer Shopify quand il est connecté ; plafonner `valueCents` par jour et par commerce.
- **Lecteur qui déclenche des appels LLM** : `src/app/api/ecommerce/deliverables/route.ts:30` et
  `src/app/api/ecommerce/prices/route.ts:18` utilisent `readAccess` (viewer) pour `llm: true`. Remplacer par
  `writeAccess(req, businessId)` quand `llm` est demandé.
- **Déconnexion** : avec `SUPABASE_JWT_SECRET` (vérification HS256 locale, `supabase.ts:113-115`), le jeton d'accès
  reste valable jusqu'à son expiration (≈ 1 h) après `signOut`, et le cache `verified` garde 60 s. Acceptable si
  documenté ; sinon vérifier `session_id` contre `auth.sessions`.
- **Connexion forcée (login CSRF)** : les liens `token_hash` (achat, invitation) ouvrent une session sans être liés
  au navigateur. Un attaquant peut faire cliquer à la victime **son** lien d'accès : la victime travaille dans
  l'espace de l'attaquant (et y connecte GA4/Shopify). Afficher sur `/connexion/callback` une page « Continuer en tant
  que <adresse> ? » (POST) avant de poser les cookies pour les liens `token_hash` et `local`.
- **`DELETE /api/account/data`** (`route.ts:49`) et `PATCH /api/team` n'appellent pas tous `limit`/`assertSameOrigin`
  (DELETE sans `assertSameOrigin`). Le préflight CORS protège déjà les DELETE JSON ; ajouter `assertSameOrigin(req)`
  par cohérence.
- **Action serveur `prefillFromSite`** (`src/app/audit/actions.ts:18`) lit `x-forwarded-for` elle-même, sans le
  regroupement IPv6 /64 de `getClientIp` : utiliser `ipBucket` de `@/lib/ratelimit`.
- **Invitations** : l'acceptation ne revérifie pas le nombre de sièges (offre rétrogradée entre l'envoi et le clic).

---

## `requireBusiness` : routes `/api/**` qui lisent un `businessId` sans passer par lui

Toutes les routes de l'espace client passent par `requireBusiness` (directement, ou via `canEditBusiness`,
`canAccessBusiness`, `readAccess`/`writeAccess` d'e-commerce, `access()` de local, `requireBusiness` réexporté par
`notify/platform`, `prompts/adapters`, `growth/auth`). Les seules exceptions, toutes justifiées :

| Route | Origine du `businessId` | Verdict |
|---|---|---|
| `/api/stripe/webhook` | metadata Stripe posée par notre serveur (session propriétaire), signature vérifiée | OK |
| `/api/connect/ga4/callback`, `/api/ecommerce/shopify/callback` | `state` HMAC + nonce de cookie du navigateur, 10 min | OK |
| `/api/digest/done` (POST), `/api/alerts/reports/confirm` | jeton HMAC à domaine séparé | OK (voir M3 pour le GET) |
| `/api/schema/[businessId]` | public par conception, `published === false` respecté | OK |
| `/api/t`, `/api/t/bot` | balise publique (origine contrôlée, clé HMAC pour le robot) | OK (voir F6) |
| `/badge/[file]`, `/carte/[auditId]` | badge activé par le commerce / jeton de carte comparé en temps constant | OK |
| `/api/jobs/[id]` | `job.businessId` puis `requireBusiness` ; ni charge utile ni erreur brute renvoyées | OK |
| `/api/prompts/[id]`, `/api/prompts/[id]/history` | `prompt.businessId` puis `requireBusiness` | OK |

Rôles : écriture = `member` minimum, réglages/intégrations/partage = `admin`, facturation/RGPD = `owner`. Points à
durcir déjà listés : parrainage (M6) et classement (M8) acceptent `member`, LLM e-commerce accepte `viewer` (F6).

## Vérifié sans anomalie

- **Session** : cookies `httpOnly`, `SameSite=Lax`, `Secure` en production ; jamais posés par JavaScript (sauf
  `rp_business` et `rp_demo_segment`, sans valeur d'autorisation). Pas de fixation : la session est émise par le
  serveur après vérification du lien. Rafraîchissement dans le middleware, cookies effacés si Supabase refuse.
- **Lien magique** : PKCE (vérificateur en cookie httpOnly) pour les connexions depuis le navigateur ;
  `shouldCreateUser: false` ; réponse identique que le compte existe ou non (`/api/account/login`) ; liens locaux à
  usage unique et typés (`k: 'magic'` ≠ `k: 'session'`).
- **Rattachement** (A3/S1) : un commerce n'est rattaché qu'à une adresse prouvée ; `claim_business` et
  `claim_paid_businesses` revérifient `email_confirmed_at` côté SQL et sont révoquées pour `anon`/`authenticated`.
  Le webhook n'écrase jamais `contact_email` ni le client Stripe d'un commerce existant.
- **Invitations** : jeton aléatoire de 32 octets, seul le SHA-256 est stocké, liées à l'adresse invitée, 14 jours,
  révocables, jamais `owner` ; un admin ne nomme ni n'édite un admin ou un propriétaire ; dernier propriétaire
  protégé ; l'invitation ne rétrograde pas un membre existant.
- **Comptes démo** : lecture seule partout (`requireBusiness` refuse `write`/`minRole` > viewer) ; les calculs
  « compute » de local et les LLM e-commerce sont court-circuités pour la démo.
- **Anti-SSRF `siteaudit`** : http/https, ports 80/443, pas d'identifiants, résolution par nos soins avec refus de
  toute adresse non publique (IPv4 mappée/compatible, NAT64, 6to4, ULA, lien local, hors 2000::/3), **épinglage** de
  l'adresse validée (rebinding sans effet), redirections revalidées une à une, délai global de 8 s, taille bornée
  après décompression, robots.txt respecté. Formes décimales/octales normalisées par WHATWG puis contrôlées.
- **XSS** : `/r/[token]` et `/outils/*` passent tout par React ; seuls `dangerouslySetInnerHTML` : JSON-LD échappé,
  SVG de badge échappé (`esc`), QR SVG généré par nous (couleur contrôlée par expression régulière). Logo de marque
  blanche : `https:` seulement, affiché en `<img referrerPolicy="no-referrer">`, jamais récupéré par le serveur.
  Messages Slack échappés (`&`, `<`, `>`), aucun HTML dans les notifications.
- **Jetons de partage** : 256 bits, seul le SHA-256 est stocké, expiration ≤ 365 j, révocation, mot de passe scrypt
  salé, cookie de déverrouillage httpOnly limité au chemin du lien, vue publique sans e-mail ni téléphone
  (`scrubContact`), `noindex` et `no-referrer`.
- **Exports CSV** : neutralisation `= + - @ \t \r` par apostrophe, guillemets, `nosniff`, nom de fichier assaini.
- **Webhooks** : signature `t=…,v1=HMAC(t.body)` avec tolérance de 5 min et comparaison en temps constant ;
  URL et secrets chiffrés AES-256-GCM ; `redirect: 'manual'` ; Slack limité à `hooks.slack.com/services/…`.
- **Shopify** : `state` signé lié à la boutique et au nonce du navigateur, HMAC Shopify vérifié, horodatage ≤ 10 min,
  boutique `*.myshopify.com` uniquement, jetons chiffrés au repos, rafraîchissement.
- **Worker et crons** : `Bearer CRON_SECRET` comparé en temps constant, refus en production sans secret (y compris
  `VERCEL_ENV=production`). Charges utiles bornées en taille ; aucune route n'enfile une charge choisie par le client
  (types fixes, `businessId` contrôlé en amont) : pas d'empoisonnement de la file trouvé.
- **Copilote** : outils sans paramètre `businessId` (contexte chargé pour l'espace autorisé) ; fils filtrés par
  `businessId` ; délimiteur `</donnees_client>` neutralisé ; budget par espace et par jour.
- **CSP** : appliquée (non Report-Only) ; CSP à nonce + `strict-dynamic` sur `/app`, `/connexion`, `/inscription`,
  `/bienvenue`, `/r` ; `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action` restreint ;
  HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP. Reste de la dette connue : `'unsafe-inline'` pour les
  scripts des pages statiques du site (documenté dans `next.config.ts`).
- **t.js** : aucun `eval`, `innerHTML` ni `document.write`.

## Régressions V1 / V2 (10 points contrôlés)

| Point | État |
|---|---|
| V1 E1 : `businessId` du checkout jamais cru sur parole | OK (`checkout/route.ts:50-61` : propriétaire connecté seulement). Nouveau vecteur voisin : M4 |
| V1 E2 : e-mail absent de `GET /api/audit/:id` | OK (`toPublicAudit`) |
| V1 C1 : IP regroupées par /64, limite persistante | OK (`ratelimit.ts:99-126`) ; exception : action serveur (F6) |
| V1 M1 : en-têtes de sécurité | OK, CSP désormais appliquée |
| V1 F1 : comparaisons en temps constant (crons, santé) | OK (`cron/auth.ts`, `health/route.ts:66-72`) |
| V2 E1 : démos en lecture seule | OK (`requireBusiness`) |
| V2 E3 : actions déclenchées par GET dans les e-mails | OK pour `digest/done` ; **régression** dans le nouveau module (M3) |
| V2 E4 : délimiteur des données du copilote | OK (`copilot/context.ts:148-149`) |
| V2 M1 : `state` GA4 lié au navigateur | OK (nonce en cookie, usage unique) |
| V2 F5 : `javascript:`/`data:` dans les réglages | OK (`exec/settings/route.ts:44-57`) |

## Ordre d'application conseillé

1. **E1** (quota de mesures manuelles) : coût direct, une dizaine de lignes.
2. **M1** (`safeNext`) : une fonction, avec ses tests.
3. **M4** (achat sur l'audit d'un tiers) et **M3** (double opt-in en POST + expiration) : avant d'ouvrir les achats
   et les rapports planifiés.
4. **M2** (webhooks épinglés) et **M5** (bornes des caches) : réutilisent `siteaudit/fetch.ts`.
5. **M8** (classement) et **M6** (parrainage) : avant la première publication d'un classement ou d'une récompense.
6. **M7** (RGPD : suppression de compte, export) : route nouvelle, à faire avant la mise en production.
7. **F1, F3** (configuration de production : erreurs au lieu d'avertissements), puis F2, F4, F5, F6.
