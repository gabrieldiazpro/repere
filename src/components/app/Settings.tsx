'use client';

import { useEffect, useState } from 'react';
import { isIos, isStandalone } from './InstallPrompt';
import { formatPlanPrice, planTier, plansForSegment, VAT_NOTICE, type Plan, type PlanSegment } from '@/lib/plans';

// Préférences d'alerte CÔTÉ SERVEUR : GET / POST /api/alerts/prefs (module DONNEES). Session = cookie httpOnly.
// Comptes démo : lecture seule côté serveur ; l'écran le dit et garde les changements le temps de la visite.
type Channel = 'inApp' | 'email' | 'push' | 'slack' | 'webhook';
type ServerPrefs = { types: Record<string, Partial<Record<Channel, boolean>>>; threshold: number; copyTo: string[] };

interface Prefs {
  push: { score_change: boolean; milestone: boolean; new_competitor: boolean; competitor_overtook: boolean; actions_reminder: boolean };
  email: { audit_done: boolean; score_change: boolean; competitor_overtook: boolean; actions_reminder: boolean; weekly_digest: boolean };
  threshold: number;
}

const DEFAULT_PREFS: Prefs = {
  // Boucle de rétention n° 1 (doc 06 § 2) : résumé du lundi et « un concurrent vous dépasse » actifs par défaut.
  push: { score_change: true, milestone: true, new_competitor: true, competitor_overtook: true, actions_reminder: true },
  email: { audit_done: true, score_change: true, competitor_overtook: true, actions_reminder: true, weekly_digest: true },
  threshold: 5,
};

const ROWS: { key: string; label: string; push?: keyof Prefs['push']; email?: keyof Prefs['email'] }[] = [
  { key: 'audit', label: 'Audit du mois prêt', email: 'audit_done' },
  { key: 'score', label: 'Score en hausse ou en baisse', push: 'score_change', email: 'score_change' },
  { key: 'milestone', label: 'Nouveau palier atteint (par exemple 40 ou 70 sur 100)', push: 'milestone' },
  { key: 'newcomp', label: 'Nouveau concurrent dans le top 3', push: 'new_competitor' },
  { key: 'overtook', label: 'Un concurrent vous dépasse', push: 'competitor_overtook', email: 'competitor_overtook' },
  { key: 'reminder', label: 'Rappel d’action (max. 1 tous les 14 jours)', push: 'actions_reminder', email: 'actions_reminder' },
  { key: 'weekly', label: 'Résumé hebdomadaire', email: 'weekly_digest' },
];

function fromServer(p: ServerPrefs): Prefs {
  const get = (t: string, c: Channel, d: boolean) => p.types?.[t]?.[c] ?? d;
  const push = Object.fromEntries(Object.entries(DEFAULT_PREFS.push).map(([k, d]) => [k, get(k, 'push', d)])) as Prefs['push'];
  const email = Object.fromEntries(Object.entries(DEFAULT_PREFS.email).map(([k, d]) => [k, get(k, 'email', d)])) as Prefs['email'];
  return { push, email, threshold: typeof p.threshold === 'number' ? p.threshold : DEFAULT_PREFS.threshold };
}

function toServer(p: Prefs): { types: Record<string, Partial<Record<Channel, boolean>>>; threshold: number } {
  const types: Record<string, Partial<Record<Channel, boolean>>> = {};
  for (const [k, v] of Object.entries(p.push)) types[k] = { ...types[k], push: v };
  for (const [k, v] of Object.entries(p.email)) types[k] = { ...types[k], email: v };
  return { types, threshold: p.threshold };
}

async function fetchPrefs(businessId: string): Promise<ServerPrefs | null> {
  const r = await fetch(`/api/alerts/prefs?businessId=${encodeURIComponent(businessId)}`, { credentials: 'same-origin' }).catch(() => null);
  if (!r?.ok) return null;
  const j = (await r.json().catch(() => null)) as { prefs?: ServerPrefs } | null;
  return j?.prefs ?? null;
}

/** Enregistre un correctif ; renvoie un message d'état lisible (null si tout va bien). */
async function savePrefs(businessId: string, patch: Record<string, unknown>): Promise<string | null> {
  const r = await fetch('/api/alerts/prefs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ businessId, ...patch }),
  }).catch(() => null);
  if (!r) return 'Connexion impossible : réglage non enregistré. Réessayez.';
  if (r.ok) return null;
  if (r.status === 403) return 'Réglage non enregistré : compte de démonstration ou rôle insuffisant (administrateur requis).';
  return 'Enregistrement impossible. Réessayez dans un instant.';
}

type PushState = 'unknown' | 'unsupported' | 'ios-install' | 'default' | 'granted' | 'denied';

function urlB64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function AlertSettings({ businessId, demo = false }: { businessId: string; demo?: boolean }) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [push, setPush] = useState<PushState>('unknown');
  const [msg, setMsg] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void fetchPrefs(businessId).then((p) => {
      if (alive && p) setPrefs(fromServer(p));
    });
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setPush(isIos() && !isStandalone() ? 'ios-install' : 'unsupported');
    } else {
      setPush(Notification.permission as PushState);
    }
    return () => {
      alive = false;
    };
  }, [businessId]);

  function update(next: Prefs) {
    setPrefs(next);
    if (demo) {
      setSaveMsg('Compte de démonstration : vos choix ne sont pas enregistrés.');
      return;
    }
    void savePrefs(businessId, toServer(next)).then(setSaveMsg);
  }

  // Doit être appelé dans le handler du clic (exigence iOS).
  async function enablePush() {
    setMsg(null);
    const perm = await Notification.requestPermission();
    setPush(perm as PushState);
    if (perm !== 'granted') {
      setMsg('Notifications refusées. Vous recevrez les alertes par e-mail.');
      return;
    }
    const reg = await navigator.serviceWorker.getRegistration();
    const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (reg && vapid && 'pushManager' in reg) {
      try {
        await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(vapid) });
      } catch {
        /* l'inscription serveur sera branchée quand l'API push existera */
      }
    }
    await testNotification();
  }

  async function testNotification() {
    const reg = await navigator.serviceWorker.getRegistration();
    const opts = { body: 'Les notifications fonctionnent sur cet appareil.', icon: '/icons/icon-192.png', tag: 'test' };
    if (reg) await reg.showNotification('Repéré', opts);
    else new Notification('Repéré', opts);
  }

  return (
    <div className="flex flex-col gap-3">
      <section className="rp-card">
        <h2 className="font-semibold">Notifications sur cet appareil</h2>
        {push === 'ios-install' && (
          <p className="mt-1 text-sm text-[var(--muted)]">Pour recevoir des notifications sur iPhone, installez d’abord l’app (voir plus bas), puis ouvrez-la depuis son icône.</p>
        )}
        {push === 'unsupported' && <p className="mt-1 text-sm text-[var(--muted)]">Ce navigateur ne gère pas les notifications. Vous recevrez les alertes par e-mail.</p>}
        {push === 'denied' && (
          <p className="mt-1 text-sm text-[var(--muted)]">
            Les notifications sont bloquées. Pour les réactiver : Réglages du téléphone → Notifications → Repéré (ou les réglages du site dans votre navigateur). En attendant, les alertes arrivent par e-mail.
          </p>
        )}
        {push === 'default' && (
          <>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Voulez-vous être prévenu quand votre score change ? Nous n’envoyons qu’une notification par mois, sauf changement important.
            </p>
            <button type="button" onClick={enablePush} className="rp-tap mt-3 w-full rounded-xl bg-[var(--primary)] font-semibold text-[var(--on-primary)]">
              Oui, me prévenir
            </button>
          </>
        )}
        {push === 'granted' && (
          <div className="mt-2 flex items-center justify-between gap-3 text-sm">
            <span className="text-[var(--success-ink)]"><span aria-hidden="true">✓ </span>Activées</span>
            <button type="button" onClick={testNotification} className="rp-tap rounded-xl border border-[var(--line)] px-3 font-medium">
              Envoyer un test
            </button>
          </div>
        )}
        {msg && <p className="mt-2 text-sm" role="status">{msg}</p>}
      </section>

      <section className="rp-card p-0">
        <div className="grid grid-cols-[1fr_56px_56px] items-center gap-2 px-4 pb-1 pt-4 text-xs font-semibold text-[var(--muted)]">
          <h2 className="text-base font-semibold text-[var(--ink)]">Alertes</h2>
          <span className="text-center">Push</span>
          <span className="text-center">E-mail</span>
        </div>
        <ul className="divide-y divide-[var(--line)]">
          {ROWS.map((r) => (
            <li key={r.key} className="grid min-h-[52px] grid-cols-[1fr_56px_56px] items-center gap-2 px-4 py-1 text-sm">
              <span id={`l-${r.key}`}>{r.label}</span>
              <span className="flex justify-center">
                {r.push ? (
                  <input type="checkbox" role="switch" className="rp-switch" aria-label={`${r.label}, push`}
                    checked={prefs.push[r.push]}
                    onChange={(e) => update({ ...prefs, push: { ...prefs.push, [r.push!]: e.target.checked } })} />
                ) : <span className="text-[var(--line)]" aria-hidden="true">—</span>}
              </span>
              <span className="flex justify-center">
                {r.email ? (
                  <input type="checkbox" role="switch" className="rp-switch" aria-label={`${r.label}, e-mail`}
                    checked={prefs.email[r.email]}
                    onChange={(e) => update({ ...prefs, email: { ...prefs.email, [r.email!]: e.target.checked } })} />
                ) : <span className="text-[var(--line)]" aria-hidden="true">—</span>}
              </span>
            </li>
          ))}
        </ul>
        <label className="flex items-center justify-between gap-3 border-t border-[var(--line)] px-4 py-3 text-sm">
          <span>Me prévenir si le score bouge de</span>
          <select
            value={prefs.threshold}
            onChange={(e) => update({ ...prefs, threshold: Number(e.target.value) })}
            className="rp-tap min-w-[7.5rem] flex-none rounded-xl border border-[var(--line)] bg-[var(--surface)] pl-3 pr-8"
          >
            {[3, 5, 10].map((n) => <option key={n} value={n}>±{n} points</option>)}
          </select>
        </label>
        <p className="px-4 pb-4 text-xs text-[var(--muted)]">
          Heures calmes : aucune notification entre 20 h et 8 h. Les e-mails liés au paiement sont toujours envoyés. Réglages enregistrés sur votre compte.
        </p>
        <p role="status" className="min-h-[18px] px-4 pb-3 text-xs text-[var(--muted)]">{saveMsg}</p>
      </section>
    </div>
  );
}

/** Offres réelles (src/lib/plans.ts) d'un parcours : Essentiel et Accompagné, au mois ou à l'année. */
export function subscriptionPlans(segment: PlanSegment): Plan[] {
  return plansForSegment(segment).filter((p) => /_(essentiel|accompagne)_(month|year)$/.test(p.id));
}

/** Choix d'offre : l'offre actuelle mise en avant, chaque offre payante passe par /api/checkout (prix Stripe réels). */
export function PlanChoice({ segment, currentTier, businessId, demo = false, canBuy = true }: { segment: PlanSegment; currentTier: string; businessId: string; demo?: boolean; canBuy?: boolean }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const plans = subscriptionPlans(segment);
  async function checkout(planId: string) {
    setBusy(planId);
    setMsg(null);
    const r = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ planId, businessId }) }).catch(() => null);
    const j = r && r.ok ? ((await r.json().catch(() => null)) as { url?: string } | null) : null;
    if (j?.url) window.location.href = j.url;
    else {
      setBusy(null);
      setMsg('Le paiement n’a pas pu s’ouvrir. Réessayez, ou choisissez votre offre depuis la page Tarifs.');
    }
  }
  if (!plans.length) return null;
  return (
    <div className="mt-1">
      <ul className="grid gap-2 sm:grid-cols-2" aria-label="Offres disponibles">
        {plans.map((p) => {
          const current = planTier(p.id) === currentTier;
          const yearly = p.interval === 'year';
          return (
            <li key={p.id} className={`flex flex-col rounded-xl border p-3 ${current ? 'border-[var(--primary)] bg-[var(--primary-bg)]' : 'border-[var(--line)]'}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                <p className="font-semibold">{p.name}</p>
                <p className="rp-num text-[14px] font-semibold">{formatPlanPrice(p)}</p>
              </div>
              <p className="mt-0.5 text-[12px] text-[var(--muted)]">
                {yearly ? p.features[1] ?? 'Paiement annuel' : p.commitmentMonths ? `${p.commitmentMonths} mois minimum, puis sans engagement` : 'Sans engagement'}
              </p>
              <div className="mt-2">
                {current ? (
                  <span className="rp-chip rp-chip-primary">Votre offre actuelle</span>
                ) : demo || !canBuy ? (
                  <a href={`/tarifs?depuis=reglages&offre=${p.id}`} className="rp-link text-[13px]">
                    Voir le détail
                  </a>
                ) : (
                  <button type="button" disabled={busy !== null} onClick={() => checkout(p.id)} className={`rp-btn rp-btn-sm v4-press ${p.highlighted && !yearly ? 'rp-btn-primary' : ''}`}>
                    {busy === p.id ? 'Ouverture du paiement…' : `Choisir ${p.name}`}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {msg && (
        <p role="status" className="mt-2 text-[13px] text-[var(--danger-ink)]">
          {msg}
        </p>
      )}
      <p className="mt-2 text-[12px] text-[var(--muted)]">
        Tout le détail des offres sur la{' '}
        <a href="/tarifs?depuis=reglages" className="rp-link">
          page Tarifs
        </a>
        .
      </p>
    </div>
  );
}

export function SubscriptionActions({ businessId }: { subscribed?: boolean; businessId: string }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [portalMsg, setPortalMsg] = useState<string | null>(null);

  // Portail Stripe : URL créée côté serveur pour CE commerce (propriétaire seulement).
  async function openPortal() {
    setBusy(true);
    setPortalMsg(null);
    const r = await fetch('/api/account/portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ businessId }),
    }).catch(() => null);
    const j = r ? ((await r.json().catch(() => null)) as { url?: string | null; error?: string; message?: string } | null) : null;
    setBusy(false);
    if (j?.url) window.location.href = j.url;
    else setPortalMsg(j?.error ?? j?.message ?? 'Portail indisponible. Répondez à l’un de nos e-mails : nous arrêtons le suivi sans question.');
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      <button type="button" disabled={busy} onClick={openPortal} className="rp-tap flex items-center justify-center rounded-xl border border-[var(--line)] font-semibold disabled:opacity-60">
        Gérer mon abonnement
      </button>
      {portalMsg && <p role="status" className="text-xs text-[var(--muted)]">{portalMsg}</p>}
      {!confirm ? (
        <button type="button" onClick={() => setConfirm(true)} className="rp-tap rounded-xl text-sm font-medium text-[var(--danger)]">
          Arrêter le suivi
        </button>
      ) : (
        <div role="alertdialog" aria-labelledby="stop-h" className="rounded-xl bg-[var(--bg)] p-3 text-sm">
          <p id="stop-h">Vous êtes sûr ? Votre suivi s’arrêtera à la fin du mois en cours, et vos anciens rapports resteront consultables.</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setConfirm(false)} className="rp-tap rounded-xl bg-[var(--primary)] font-semibold text-[var(--on-primary)]">Garder mon suivi</button>
            <button type="button" disabled={busy} onClick={openPortal} className="rp-tap flex items-center justify-center rounded-xl border border-[var(--line)] font-medium disabled:opacity-60">Arrêter le suivi</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function SignOutButton() {
  return (
    <button
      type="button"
      className="rp-tap w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] font-medium"
      onClick={async () => {
        // Session httpOnly : seule la route serveur peut l'effacer.
        await fetch('/api/account/logout', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } }).catch(() => null);
        document.cookie = 'rp_business=; path=/; max-age=0; samesite=lax';
        try {
          // purge des pages privées mises en cache (appareil partagé)
          for (const k of await caches.keys()) if (k.startsWith('pages-') || k.startsWith('api-')) await caches.delete(k);
        } catch {
          /* ignore */
        }
        window.location.href = '/connexion?deconnecte=1';
      }}
    >
      Se déconnecter
    </button>
  );
}

/** « Transférer à (associé, agence) » : copie du résumé du lundi, enregistrée côté serveur (prefs.copyTo). */
export function DigestForward({ businessId, demo = false }: { businessId: string; demo?: boolean }) {
  const [value, setValue] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void fetchPrefs(businessId).then((p) => {
      if (alive && p) setValue(p.copyTo?.[0] ?? '');
    });
    return () => {
      alive = false;
    };
  }, [businessId]);
  return (
    <form
      className="mt-3 flex flex-col gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const v = value.trim();
        if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
          setMsg('Adresse e-mail invalide.');
          return;
        }
        if (demo) {
          setMsg('Compte de démonstration : réglage non enregistré.');
          return;
        }
        const err = await savePrefs(businessId, { copyTo: v ? [v] : [] });
        setMsg(err ?? (v ? `Copie prévue pour ${v}.` : 'Aucune copie.'));
      }}
    >      <label htmlFor="digest-forward" className="text-[13px] font-semibold">
        Transférer à (associé, agence)
      </label>
      <div className="flex gap-2">
        <input id="digest-forward" type="email" className="rp-input flex-1" placeholder="associe@exemple.fr" value={value} onChange={(e) => setValue(e.target.value)} />
        <button type="submit" className="rp-btn rp-btn-sm">
          Enregistrer
        </button>
      </div>
      <p role="status" className="min-h-[18px] text-[12px] text-[var(--muted)]">
        {msg}
      </p>
    </form>
  );
}

const TRADE_FIELD: Record<'local' | 'pme' | 'ecommerce', { label: string; placeholder: string }> = {
  local: { label: 'Métier', placeholder: 'plombier, pizzeria, coiffeur…' },
  pme: { label: 'Secteur', placeholder: 'logiciel de paie pour PME…' },
  ecommerce: { label: 'Catégorie de produits principale', placeholder: 'shampoing solide…' },
};

/**
 * Réglages › Compte : métier (secteur, catégorie) et ville modifiables. Après un changement, la régénération des
 * questions suivies est PROPOSÉE avec un aperçu ; rien ne change dans vos questions sans votre accord.
 */
export function ProfileForm({
  businessId,
  segment,
  trade: trade0,
  city: city0,
  district: district0,
  demo = false,
  canEdit = true,
}: {
  businessId: string;
  segment: 'local' | 'pme' | 'ecommerce';
  trade: string;
  city: string;
  district?: string;
  demo?: boolean;
  canEdit?: boolean;
}) {
  const [trade, setTrade] = useState(trade0);
  const [city, setCity] = useState(segment !== 'local' && city0 === 'France' ? '' : city0);
  const [district, setDistrict] = useState(district0 ?? '');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [proposal, setProposal] = useState<string[] | null>(null);
  const f = TRADE_FIELD[segment];
  const disabled = demo || !canEdit || busy;

  async function post(body: Record<string, unknown>) {
    const res = await fetch('/api/account/businesses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as { error?: string; profile?: { changed: boolean; proposal: string[] }; result?: { added: number; active: number; paused: number } };
    if (!res.ok) throw new Error(data.error ?? 'Le changement n’a pas été enregistré. Réessayez dans un instant.');
    return data;
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (demo) {
          setMsg('Compte de démonstration : réglage non enregistré.');
          return;
        }
        setBusy(true);
        setMsg(null);
        try {
          const d = await post({ profile: { businessId, trade, city, district } });
          if (!d.profile?.changed) setMsg('Rien n’a changé.');
          else {
            setMsg('Enregistré. La prochaine mesure utilisera ce profil.');
            setProposal(d.profile.proposal);
          }
        } catch (err) {
          setMsg((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-[13px] font-semibold sm:col-span-1">
          {f.label}
          <input className="rp-input font-normal" value={trade} onChange={(e) => setTrade(e.target.value)} placeholder={f.placeholder} maxLength={80} required disabled={disabled} />
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-semibold">
          Ville{segment !== 'local' && <span className="font-normal text-[var(--muted)]"> (facultatif)</span>}
          <input className="rp-input font-normal" value={city} onChange={(e) => setCity(e.target.value)} placeholder={segment === 'local' ? 'Paris' : 'France entière'} maxLength={80} required={segment === 'local'} disabled={disabled} />
        </label>
        {segment === 'local' && (
          <label className="flex flex-col gap-1 text-[13px] font-semibold">
            Quartier ou arrondissement <span className="font-normal text-[var(--muted)]">(facultatif)</span>
            <input className="rp-input font-normal" value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="11e" maxLength={60} disabled={disabled} />
          </label>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="rp-btn rp-btn-sm" disabled={!canEdit || busy}>
          Enregistrer le profil
        </button>
        {!canEdit && !demo && <span className="text-[12px] text-[var(--muted)]">Réservé aux propriétaires et administrateurs de l’espace.</span>}
        <span role="status" className="text-[12px] text-[var(--muted)]">
          {msg}
        </span>
      </div>
      {proposal && (
        <div className="rounded-xl border border-[var(--hair)] p-3">
          <p className="text-[14px] font-semibold">Régénérer vos questions suivies pour ce profil ?</p>
          <p className="mt-1 text-[13px] text-[var(--muted)]">
            Les questions créées automatiquement pour l’ancien profil seront mises en pause (leur historique est conservé). Les questions que vous avez écrites ou choisies restent suivies.
          </p>
          {proposal.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-[13px]">
              {proposal.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="rp-btn rp-btn-sm rp-btn-primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const d = await post({ regenerate: { businessId } });
                  const r = d.result ?? { added: 0, active: 0, paused: 0 };
                  setMsg(`${r.active} question${r.active > 1 ? 's' : ''} suivie${r.active > 1 ? 's' : ''} ajoutée${r.active > 1 ? 's' : ''}${r.paused ? `, ${r.paused} mise${r.paused > 1 ? 's' : ''} en pause` : ''}. Elles seront posées à la prochaine mesure.`);
                  setProposal(null);
                } catch (err) {
                  setMsg((err as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Régénérer mes questions
            </button>
            <button type="button" className="rp-btn rp-btn-sm" onClick={() => setProposal(null)}>
              Garder mes questions
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
