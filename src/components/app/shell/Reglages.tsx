'use client';
// Réglages V3 (panneaux clients) : équipe, intégrations Slack / webhook, rapports planifiés, partage et marque blanche,
// badge / carte / classement / parrainage, données (export et suppression RGPD). Toutes les écritures passent par les
// routes API ; les comptes démo sont en lecture seule côté serveur (l'écran le dit).
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Icon } from '../icons';
import { toast } from './client';

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------
type Json = Record<string, unknown>;

async function api<T = Json>(url: string, init?: RequestInit & { json?: unknown }): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> {
  try {
    const r = await fetch(url, {
      ...init,
      credentials: 'same-origin',
      headers: init?.json !== undefined ? { 'Content-Type': 'application/json' } : init?.headers,
      body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
      cache: 'no-store',
    });
    const data = (await r.json().catch(() => ({}))) as T & { error?: string };
    return { ok: r.ok, status: r.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: 'Pas de réseau. Réessayez.' } as T & { error?: string } };
  }
}

function errText(status: number, error?: string, demo?: boolean): string {
  if (demo || status === 403) return error && status !== 403 ? error : 'Compte démo ou rôle insuffisant : rien n’a été enregistré.';
  if (status === 402) return error ?? 'Cette fonction n’est pas incluse dans votre offre.';
  return error ?? 'L’action a échoué. Réessayez dans un instant.';
}

function useLoad<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!url) return;
    setError(null);
    const r = await api<T>(url);
    if (r.ok) setData(r.data);
    else setError(errText(r.status, r.data.error));
  }, [url]);
  useEffect(() => {
    void load();
  }, [load]);
  return { data, error, load, setData };
}

function Loading({ rows = 2 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-busy="true" aria-label="Chargement">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="rp-skel h-10" />
      ))}
    </div>
  );
}

function LoadError({ msg, retry }: { msg: string; retry: () => void }) {
  return (
    <p className="text-[14px]">
      {msg}{' '}
      <button type="button" className="rp-link" onClick={retry}>
        Réessayer
      </button>
    </p>
  );
}

function CopyField({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <input readOnly value={value} aria-label={label} className="rp-input min-w-0 flex-1 font-mono text-[13px]" onFocus={(e) => e.currentTarget.select()} />
      <button
        type="button"
        className="rp-btn rp-btn-sm"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            toast({ text: 'Copié.', tone: 'success' });
          } catch {
            toast({ text: 'Copie impossible : sélectionnez le texte et copiez-le.', tone: 'error' });
          }
        }}
      >
        <Icon name="copy" size={15} /> Copier
      </button>
    </div>
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------------------------------------------------------------------------
// Équipe
// ---------------------------------------------------------------------------
type Role = 'owner' | 'admin' | 'member' | 'viewer';
const ROLE_LABEL: Record<Role, string> = { owner: 'Propriétaire', admin: 'Administrateur', member: 'Contributeur', viewer: 'Lecteur' };
const ROLE_HELP: Record<Role, string> = {
  owner: 'tout, dont la facturation et la suppression',
  admin: 'tout sauf la facturation',
  member: 'coche les actions, modifie les questions',
  viewer: 'consulte seulement',
};
interface TeamView {
  members: { userId: string; email: string; role: Role; you: boolean }[];
  invitations: { id: string; email: string; role: Role; expiresAt: string }[];
  seats: { used: number; max: number };
  canManage: boolean;
  assignable: Role[];
  demo?: boolean;
}

export function TeamPanel({ businessId, demo }: { businessId: string; demo: boolean }) {
  const { data, error, load } = useLoad<TeamView>(`/api/team?businessId=${encodeURIComponent(businessId)}`);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('member');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (error) return <LoadError msg={error} retry={() => void load()} />;
  if (!data) return <Loading />;
  const full = data.seats.used >= data.seats.max;

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {
      setMsg('Adresse e-mail invalide.');
      return;
    }
    setBusy(true);
    const r = await api<{ devLink?: string }>('/api/team', { method: 'POST', json: { businessId, email: email.trim(), role } });
    setBusy(false);
    if (!r.ok) {
      setMsg(errText(r.status, r.data.error, demo));
      return;
    }
    setMsg(`Invitation envoyée à ${email.trim()}.${r.data.devLink ? ' (Lien de test affiché hors production.)' : ''}`);
    setEmail('');
    void load();
  };
  const remove = async (q: string, what: string) => {
    if (!window.confirm(`Retirer ${what} ?`)) return;
    const r = await api(`/api/team?businessId=${encodeURIComponent(businessId)}&${q}`, { method: 'DELETE' });
    if (!r.ok) toast({ text: errText(r.status, r.data.error, demo), tone: 'error' });
    else void load();
  };
  const changeRole = async (userId: string, next: Role) => {
    const r = await api('/api/team', { method: 'PATCH', json: { businessId, userId, role: next } });
    if (!r.ok) toast({ text: errText(r.status, r.data.error, demo), tone: 'error' });
    void load();
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[14px]">
        <span className="rp-num font-semibold">
          {data.seats.used} accès sur {data.seats.max}
        </span>{' '}
        <span className="text-[var(--muted)]">utilisés (membres et invitations en attente).</span>
      </p>
      {data.demo ? (
        <p className="rounded-lg bg-[var(--surface-2)] p-3 text-[13px] text-[var(--muted)]">Compte démo : l’équipe n’est pas modifiable. Dans votre espace, invitez un associé ou votre agence en lecture seule.</p>
      ) : (
        <ul className="divide-y divide-[var(--hair)] rounded-xl border border-[var(--hair)]">
          {data.members.map((m) => (
            <li key={m.userId} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
              <span className="min-w-0 flex-1 truncate text-[14px]">
                {m.email}
                {m.you && <span className="text-[var(--muted)]"> · vous</span>}
              </span>
              {data.canManage && !m.you && m.role !== 'owner' ? (
                <label className="text-[13px]">
                  <span className="sr-only">Rôle de {m.email}</span>
                  <select className="rp-input !min-h-[32px] !w-auto !py-0 text-[13px]" value={m.role} onChange={(e) => void changeRole(m.userId, e.target.value as Role)}>
                    {data.assignable.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <span className="rp-chip">{ROLE_LABEL[m.role]}</span>
              )}
              {(m.you ? m.role !== 'owner' : data.canManage && m.role !== 'owner') && (
                <button type="button" className="rp-btn rp-btn-ghost rp-btn-sm" onClick={() => void remove(`userId=${encodeURIComponent(m.userId)}`, m.you ? 'votre accès' : m.email)}>
                  {m.you ? 'Quitter' : 'Retirer'}
                </button>
              )}
            </li>
          ))}
          {data.invitations.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
              <span className="min-w-0 flex-1 truncate text-[14px]">
                {i.email} <span className="text-[var(--muted)]">· invitation en attente</span>
              </span>
              <span className="rp-chip">{ROLE_LABEL[i.role]}</span>
              {data.canManage && (
                <button type="button" className="rp-btn rp-btn-ghost rp-btn-sm" onClick={() => void remove(`invitationId=${encodeURIComponent(i.id)}`, `l’invitation de ${i.email}`)}>
                  Annuler
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {(data.canManage || data.demo) && (
        <form onSubmit={invite} className="flex flex-col gap-2" noValidate>
          <p className="text-[14px] font-semibold">Inviter quelqu’un</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Adresse e-mail</span>
              <input className="rp-input" type="email" autoComplete="email" placeholder="associe@exemple.fr" value={email} onChange={(e) => setEmail(e.target.value)} disabled={full || data.demo} />
            </label>
            <label>
              <span className="sr-only">Rôle</span>
              <select className="rp-input sm:!w-auto" value={role} onChange={(e) => setRole(e.target.value as Role)} disabled={full || data.demo}>
                {(data.assignable.length ? data.assignable : (['admin', 'member', 'viewer'] as Role[])).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="rp-btn rp-btn-primary" disabled={busy || full || data.demo}>
              {busy ? 'Envoi…' : 'Inviter'}
            </button>
          </div>
          <p className="text-[12px] text-[var(--muted)]">
            {ROLE_LABEL[role]} : {ROLE_HELP[role]}.
          </p>
          {full && !data.demo && (
            <p className="text-[13px]">
              Tous vos accès sont utilisés.{' '}
              <Link href="/tarifs?depuis=app&fonction=team" className="rp-link">
                Voir les offres
              </Link>
            </p>
          )}
          <p role="status" className="min-h-[18px] text-[13px] text-[var(--muted)]">
            {msg}
          </p>
        </form>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Intégrations Slack et webhook
// ---------------------------------------------------------------------------
interface TargetView {
  id: string;
  kind: 'slack' | 'webhook';
  label: string;
  hint: string;
  events: string[];
  active: boolean;
  lastStatus: { ok: boolean; at: string; code?: number; error?: string } | null;
}
interface IntegrationsView {
  targets: TargetView[];
  events: { id: string; label: string }[];
  allowed: boolean;
}

export function HooksPanel({ businessId, demo }: { businessId: string; demo: boolean }) {
  const { data, error, load } = useLoad<IntegrationsView>(`/api/integrations?businessId=${encodeURIComponent(businessId)}`);
  const [kind, setKind] = useState<'slack' | 'webhook'>('slack');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  if (error && demo)
    return (
      <p className="text-[14px] text-[var(--muted)]">
        En démo, Slack et le webhook ne sont pas branchés. Dans votre espace, collez l’adresse d’un webhook entrant Slack ou d’un service à vous : chaque alerte y est envoyée, signée.
      </p>
    );
  if (error) return <LoadError msg={error} retry={() => void load()} />;
  if (!data) return <Loading />;

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^https:\/\//.test(url.trim())) {
      setMsg(kind === 'slack' ? 'Collez l’adresse du webhook entrant Slack (https://hooks.slack.com/…).' : 'L’adresse doit commencer par https://.');
      return;
    }
    setBusy(true);
    const r = await api<{ secret?: string }>('/api/integrations', { method: 'POST', json: { businessId, kind, url: url.trim(), label: kind === 'slack' ? 'Slack' : 'Webhook' } });
    setBusy(false);
    if (!r.ok) {
      setMsg(errText(r.status, r.data.error, demo));
      return;
    }
    setUrl('');
    setMsg(kind === 'slack' ? 'Slack connecté. Envoyez un message de test pour vérifier.' : 'Webhook ajouté.');
    if (r.data.secret) setSecret(r.data.secret);
    void load();
  };
  const test = async (id: string) => {
    const r = await api<{ ok?: boolean; status?: { ok: boolean; error?: string } }>('/api/integrations/test', { method: 'POST', json: { businessId, id } });
    if (r.ok) toast({ text: 'Message de test envoyé.', tone: 'success' });
    else toast({ text: errText(r.status, r.data.error, demo), tone: 'error' });
    void load();
  };
  const toggle = async (t: TargetView) => {
    const r = await api('/api/integrations', { method: 'PATCH', json: { businessId, id: t.id, active: !t.active } });
    if (!r.ok) toast({ text: errText(r.status, r.data.error, demo), tone: 'error' });
    void load();
  };
  const del = async (t: TargetView) => {
    if (!window.confirm(`Supprimer ${t.label} (${t.hint}) ?`)) return;
    const r = await api(`/api/integrations?businessId=${encodeURIComponent(businessId)}&id=${encodeURIComponent(t.id)}`, { method: 'DELETE' });
    if (!r.ok) toast({ text: errText(r.status, r.data.error, demo), tone: 'error' });
    void load();
  };

  return (
    <div className="flex flex-col gap-3">
      {data.targets.length > 0 && (
        <ul className="divide-y divide-[var(--hair)] rounded-xl border border-[var(--hair)]">
          {data.targets.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold">
                  {t.label} <span className="font-normal text-[var(--muted)]">· {t.hint}</span>
                </span>
                <span className="block text-[12px] text-[var(--muted)]">
                  {!t.active ? 'En pause' : t.lastStatus ? (t.lastStatus.ok ? 'Dernier envoi réussi' : `Dernier envoi en échec${t.lastStatus.error ? ` : ${t.lastStatus.error}` : ''}`) : 'Aucun envoi pour le moment'}
                </span>
              </span>
              <button type="button" className="rp-btn rp-btn-sm" onClick={() => void test(t.id)}>
                Tester
              </button>
              <button type="button" className="rp-btn rp-btn-ghost rp-btn-sm" onClick={() => void toggle(t)}>
                {t.active ? 'Mettre en pause' : 'Réactiver'}
              </button>
              <button type="button" className="rp-btn rp-btn-ghost rp-btn-sm" onClick={() => void del(t)}>
                Supprimer
              </button>
            </li>
          ))}
        </ul>
      )}
      {secret && (
        <div className="rounded-xl bg-[var(--warning-bg)] p-3 text-[13px] text-[var(--warning-ink)]">
          <p className="mb-2 font-semibold">Secret de signature (affiché une seule fois) : vérifiez l’en-tête de signature de chaque envoi avec lui.</p>
          <CopyField value={secret} label="Secret de signature du webhook" />
        </div>
      )}
      <form onSubmit={add} className="flex flex-col gap-2" noValidate>
        <div role="radiogroup" aria-label="Type d’intégration" className="rp-theme self-start">
          {(['slack', 'webhook'] as const).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={kind === k} className="rp-theme-btn" onClick={() => setKind(k)}>
              {k === 'slack' ? 'Slack' : 'Webhook signé'}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="min-w-0 flex-1">
            <span className="sr-only">{kind === 'slack' ? 'Adresse du webhook entrant Slack' : 'Adresse du webhook'}</span>
            <input className="rp-input" inputMode="url" placeholder={kind === 'slack' ? 'https://hooks.slack.com/services/…' : 'https://votre-outil.fr/webhooks/repere'} value={url} onChange={(e) => setUrl(e.target.value)} />
          </label>
          <button type="submit" className="rp-btn rp-btn-primary" disabled={busy}>
            {busy ? 'Ajout…' : 'Ajouter'}
          </button>
        </div>
        <p className="text-[12px] text-[var(--muted)]">
          {kind === 'slack'
            ? 'Dans Slack : Applications › Webhooks entrants › Ajouter à un canal, puis collez l’adresse ici. Vous recevrez la phrase de la semaine et les alertes importantes.'
            : 'Chaque événement (mesure terminée, alerte, action faite) est envoyé en JSON, signé avec un secret propre à cette adresse.'}
        </p>
        <p role="status" className="min-h-[18px] text-[13px] text-[var(--muted)]">
          {msg}
        </p>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rapports planifiés
// ---------------------------------------------------------------------------
interface Schedule {
  active: boolean;
  frequency: 'weekly' | 'monthly';
  day: number;
  hour: number;
  recipients: { email: string; status?: 'pending' | 'confirmed' }[];
  includeShareLink?: boolean;
}

/** Hebdomadaire : 1 = lundi … 7 = dimanche (contrat de /api/alerts/reports). */
const DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

export function ReportsPanel({ businessId, demo }: { businessId: string; demo: boolean }) {
  const { data, error, load } = useLoad<{ schedule: Schedule | null; maxRecipients: number }>(`/api/alerts/reports?businessId=${encodeURIComponent(businessId)}`);
  const [form, setForm] = useState<{ active: boolean; frequency: 'weekly' | 'monthly'; day: number; hour: number; recipients: string; includeShareLink: boolean } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!data || form) return;
    const s = data.schedule;
    const rec = (s?.recipients ?? []).map((r) => r.email);
    setForm({ active: s?.active ?? false, frequency: s?.frequency ?? 'monthly', day: s?.day ?? 1, hour: s?.hour ?? 8, recipients: rec.join(', '), includeShareLink: s?.includeShareLink ?? true });
  }, [data, form]);

  if (error) return <LoadError msg={error} retry={() => void load()} />;
  if (!data || !form) return <Loading />;
  const pending = (data.schedule?.recipients ?? []).filter((r) => r.status === 'pending').map((r) => r.email);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const recipients = form.recipients
      .split(/[,;\s]+/)
      .map((x) => x.trim())
      .filter(Boolean);
    const bad = recipients.find((x) => !EMAIL_RE.test(x));
    if (bad) {
      setMsg(`Adresse invalide : ${bad}`);
      return;
    }
    if (recipients.length > data.maxRecipients) {
      setMsg(`${data.maxRecipients} destinataires au plus.`);
      return;
    }
    setBusy(true);
    const r = await api('/api/alerts/reports', { method: 'POST', json: { businessId, active: form.active, frequency: form.frequency, day: form.day, hour: form.hour, recipients, includeShareLink: form.includeShareLink } });
    setBusy(false);
    setMsg(r.ok ? 'Enregistré. Les nouveaux destinataires reçoivent un e-mail pour confirmer leur inscription.' : errText(r.status, r.data.error, demo));
    if (r.ok) void load();
  };

  return (
    <form onSubmit={save} className="flex flex-col gap-3" noValidate>
      <label className="flex items-center justify-between gap-3">
        <span className="text-[14px] font-semibold">Envoyer un rapport automatiquement</span>
        <input type="checkbox" className="rp-switch" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
      </label>
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-[13px]">
          Rythme
          <select className="rp-input mt-1" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value as 'weekly' | 'monthly' })}>
            <option value="weekly">Chaque semaine</option>
            <option value="monthly">Chaque mois</option>
          </select>
        </label>
        <label className="text-[13px]">
          {form.frequency === 'weekly' ? 'Jour' : 'Jour du mois'}
          {form.frequency === 'weekly' ? (
            <select className="rp-input mt-1" value={form.day} onChange={(e) => setForm({ ...form, day: Number(e.target.value) })}>
              {DAYS.map((d, i) => (
                <option key={d} value={i + 1}>
                  {d}
                </option>
              ))}
            </select>
          ) : (
            <input className="rp-input mt-1" type="number" min={1} max={28} value={form.day} onChange={(e) => setForm({ ...form, day: Math.min(28, Math.max(1, Number(e.target.value) || 1)) })} />
          )}
        </label>
        <label className="text-[13px]">
          Heure
          <select className="rp-input mt-1" value={form.hour} onChange={(e) => setForm({ ...form, hour: Number(e.target.value) })}>
            {Array.from({ length: 15 }, (_, i) => i + 6).map((h) => (
              <option key={h} value={h}>
                {h} h
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="text-[13px]">
        Destinataires ({data.maxRecipients} au plus, séparés par des virgules)
        <input className="rp-input mt-1" value={form.recipients} onChange={(e) => setForm({ ...form, recipients: e.target.value })} placeholder="associe@exemple.fr, agence@exemple.fr" />
      </label>
      {pending.length > 0 && <p className="text-[12px] text-[var(--muted)]">En attente de confirmation : {pending.join(', ')}.</p>}
      <label className="flex items-center gap-2 text-[14px]">
        <input type="checkbox" className="rp-check" checked={form.includeShareLink} onChange={(e) => setForm({ ...form, includeShareLink: e.target.checked })} />
        Joindre un lien vers le rapport en ligne
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" className="rp-btn rp-btn-primary" disabled={busy}>
          {busy ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <p role="status" className="text-[13px] text-[var(--muted)]">
          {msg}
        </p>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Partage et marque blanche
// ---------------------------------------------------------------------------
interface ShareLink {
  id: string;
  label?: string;
  hint: string;
  createdAt: string;
  expiresAt: string;
  revoked: boolean;
  expired: boolean;
  views: number;
}

export function SharePanel({ businessId, demo, whiteLabel }: { businessId: string; demo: boolean; whiteLabel: boolean }) {
  const { data, error, load } = useLoad<{ links: ShareLink[] }>(`/api/share?businessId=${encodeURIComponent(businessId)}`);
  const [created, setCreated] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [brand, setBrand] = useState({ name: '', color: '#3730A3', logoUrl: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (error) return <LoadError msg={error} retry={() => void load()} />;
  if (!data) return <Loading />;
  const live = (data.links ?? []).filter((l) => !l.revoked && !l.expired);

  const create = async () => {
    setBusy(true);
    const branding = whiteLabel && brand.name.trim() ? { name: brand.name.trim(), color: brand.color, logoUrl: brand.logoUrl.trim() || undefined } : undefined;
    const r = await api<{ url?: string }>('/api/share', { method: 'POST', json: { businessId, scope: 'report', label: 'Rapport partagé', expiresInDays: days, branding } });
    setBusy(false);
    if (!r.ok || !r.data.url) {
      setMsg(errText(r.status, r.data.error, demo));
      return;
    }
    setCreated(r.data.url);
    setMsg(null);
    void load();
  };
  const revoke = async (id: string) => {
    if (!window.confirm('Révoquer ce lien ? Les personnes qui l’ont reçu ne pourront plus l’ouvrir.')) return;
    const r = await api(`/api/share?businessId=${encodeURIComponent(businessId)}&id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!r.ok) toast({ text: errText(r.status, r.data.error, demo), tone: 'error' });
    void load();
  };

  return (
    <div className="flex flex-col gap-3">
      {live.length > 0 ? (
        <ul className="divide-y divide-[var(--hair)] rounded-xl border border-[var(--hair)]">
          {live.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-[14px]">
              <span className="min-w-0 flex-1">
                {l.label ?? 'Lien de partage'} <span className="text-[var(--muted)]">· …{l.hint}</span>
                <span className="block text-[12px] text-[var(--muted)]">
                  Créé le {new Date(l.createdAt).toLocaleDateString('fr-FR')}
                  {` · expire le ${new Date(l.expiresAt).toLocaleDateString('fr-FR')}`}
                  {` · ${l.views} ouverture${l.views > 1 ? 's' : ''}`}
                </span>
              </span>
              <button type="button" className="rp-btn rp-btn-ghost rp-btn-sm" onClick={() => void revoke(l.id)}>
                Révoquer
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[14px] text-[var(--muted)]">Aucun lien actif. Créez un lien pour envoyer votre rapport à un associé, un client ou votre agence, sans compte.</p>
      )}
      {created && (
        <div className="rounded-xl bg-[var(--success-bg)] p-3">
          <p className="mb-2 text-[13px] font-semibold text-[var(--success-ink)]">Lien créé (affiché une seule fois) :</p>
          <CopyField value={created} label="Lien du rapport partagé" />
        </div>
      )}
      {whiteLabel && (
        <fieldset className="grid gap-2 rounded-xl border border-[var(--hair)] p-3 sm:grid-cols-3">
          <legend className="px-1 text-[13px] font-semibold">Marque blanche</legend>
          <label className="text-[13px]">
            Nom affiché
            <input className="rp-input mt-1" value={brand.name} onChange={(e) => setBrand({ ...brand, name: e.target.value })} placeholder="Votre agence" maxLength={60} />
          </label>
          <label className="text-[13px]">
            Couleur
            <input className="rp-input mt-1 !p-1" type="color" value={brand.color} onChange={(e) => setBrand({ ...brand, color: e.target.value })} />
          </label>
          <label className="text-[13px]">
            Logo (adresse https)
            <input className="rp-input mt-1" inputMode="url" value={brand.logoUrl} onChange={(e) => setBrand({ ...brand, logoUrl: e.target.value })} placeholder="https://…/logo.png" />
          </label>
        </fieldset>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-[13px]">
          <span className="sr-only">Durée de validité</span>
          <select className="rp-input !w-auto" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={7}>Valable 7 jours</option>
            <option value={30}>Valable 30 jours</option>
            <option value={90}>Valable 90 jours</option>
          </select>
        </label>
        <button type="button" className="rp-btn rp-btn-primary" onClick={() => void create()} disabled={busy}>
          <Icon name="share" size={16} /> {busy ? 'Création…' : 'Créer un lien de partage'}
        </button>
      </div>
      <p role="status" className="min-h-[18px] text-[13px] text-[var(--muted)]">
        {msg}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Badge, carte, classement, parrainage
// ---------------------------------------------------------------------------
interface BadgeView {
  enabled: boolean;
  showScore: boolean;
  state: string;
  measuredAt: string | null;
  maxAgeDays: number;
  imageUrl: string;
  embedHtml: string | null;
}

export function GrowthPanel({ businessId, demo, auditId }: { businessId: string; demo: boolean; auditId: string | null }) {
  const badge = useLoad<{ badge: BadgeView }>(`/api/growth/badge?businessId=${encodeURIComponent(businessId)}`);
  const card = useLoad<{ card: { url: string; imageUrl: string } | null }>(`/api/growth/card?businessId=${encodeURIComponent(businessId)}`);
  const ranking = useLoad<{ optIn: boolean; preview: { name: string; trade?: string; city?: string; hasRealMeasure: boolean } }>(`/api/growth/ranking?businessId=${encodeURIComponent(businessId)}`);
  const referral = useLoad<{ referral: { code: string; link: string; invited: number; rewarded: number; monthsGranted: number } }>(demo ? null : `/api/growth/referral?businessId=${encodeURIComponent(businessId)}`);

  const post = async (url: string, json: Json, after: () => void) => {
    const r = await api(url, { method: 'POST', json: { businessId, ...json } });
    if (!r.ok) toast({ text: errText(r.status, r.data.error, demo), tone: 'error' });
    after();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section aria-labelledby="g-badge" className="flex flex-col gap-2">
        <h3 id="g-badge" className="text-[14px] font-semibold">
          Badge pour votre site
        </h3>
        {badge.error ? (
          <LoadError msg={badge.error} retry={() => void badge.load()} />
        ) : !badge.data ? (
          <Loading rows={1} />
        ) : (
          <>
            <label className="flex items-center justify-between gap-3 text-[14px]">
              Afficher le badge « Suivi par Repéré »
              <input type="checkbox" className="rp-switch" checked={badge.data.badge.enabled} onChange={(e) => void post('/api/growth/badge', { enabled: e.target.checked, showScore: badge.data!.badge.showScore }, () => void badge.load())} />
            </label>
            {badge.data.badge.enabled && (
              <label className="flex items-center gap-2 text-[13px]">
                <input type="checkbox" className="rp-check" checked={badge.data.badge.showScore} onChange={(e) => void post('/api/growth/badge', { enabled: true, showScore: e.target.checked }, () => void badge.load())} />
                Montrer le score (masqué si la mesure a plus de {badge.data.badge.maxAgeDays} jours)
              </label>
            )}
            {badge.data.badge.enabled && badge.data.badge.embedHtml ? (
              <CopyField value={badge.data.badge.embedHtml} label="Code du badge à coller" />
            ) : badge.data.badge.enabled ? (
              <p className="text-[12px] text-[var(--muted)]">Le code à coller apparaîtra une fois votre page publique publiée.</p>
            ) : null}
          </>
        )}
      </section>
      <section aria-labelledby="g-card" className="flex flex-col gap-2">
        <h3 id="g-card" className="text-[14px] font-semibold">
          Carte de score partageable
        </h3>
        {card.error ? (
          <LoadError msg={card.error} retry={() => void card.load()} />
        ) : !card.data ? (
          <Loading rows={1} />
        ) : card.data.card ? (
          <>
            <CopyField value={card.data.card.url} label="Lien de la carte de score" />
            <button type="button" className="rp-btn rp-btn-ghost rp-btn-sm self-start" onClick={() => auditId && void post('/api/growth/card', { auditId, enabled: false }, () => void card.load())}>
              Retirer la carte
            </button>
          </>
        ) : (
          <>
            <p className="text-[13px] text-[var(--muted)]">Une image de votre score avec sa marge d’erreur, à publier sur LinkedIn ou à envoyer. Rien n’est public tant que vous ne créez pas le lien.</p>
            <button type="button" className="rp-btn rp-btn-sm self-start" disabled={!auditId} onClick={() => auditId && void post('/api/growth/card', { auditId, enabled: true }, () => void card.load())}>
              Créer ma carte
            </button>
          </>
        )}
      </section>
      <section aria-labelledby="g-rank" className="flex flex-col gap-2">
        <h3 id="g-rank" className="text-[14px] font-semibold">
          Classement public
        </h3>
        {ranking.error ? (
          <LoadError msg={ranking.error} retry={() => void ranking.load()} />
        ) : !ranking.data ? (
          <Loading rows={1} />
        ) : (
          <>
            <label className="flex items-center justify-between gap-3 text-[14px]">
              Apparaître dans le classement de ma ville et de mon métier
              <input type="checkbox" className="rp-switch" checked={ranking.data.optIn} onChange={(e) => void post('/api/growth/ranking', { optIn: e.target.checked }, () => void ranking.load())} />
            </label>
            <p className="text-[12px] text-[var(--muted)]">
              Publié : {[ranking.data.preview.name, ranking.data.preview.trade, ranking.data.preview.city].filter(Boolean).join(' · ')} et votre score. Le classement ouvre à partir de 10 inscrits ; retrait immédiat à tout moment.
            </p>
          </>
        )}
      </section>
      <section aria-labelledby="g-ref" className="flex flex-col gap-2">
        <h3 id="g-ref" className="text-[14px] font-semibold">
          Parrainage
        </h3>
        {demo ? (
          <p className="text-[13px] text-[var(--muted)]">Compte démo : pas de lien de parrainage. Dans votre espace, un lien de parrainage vous est proposé ; les conditions sont sur la page Parrainage.</p>
        ) : referral.error ? (
          <LoadError msg={referral.error} retry={() => void referral.load()} />
        ) : !referral.data ? (
          <Loading rows={1} />
        ) : (
          <>
            <CopyField value={referral.data.referral.link} label="Votre lien de parrainage" />
            <p className="text-[12px] text-[var(--muted)]">
              {referral.data.referral.invited} inscription{referral.data.referral.invited > 1 ? 's' : ''} par votre lien, {referral.data.referral.monthsGranted} mois offert{referral.data.referral.monthsGranted > 1 ? 's' : ''} cette année.{' '}
              <Link href="/parrainage" className="rp-link">
                Conditions
              </Link>
            </p>
          </>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Données (RGPD)
// ---------------------------------------------------------------------------
export function DataPanel({ businessId, businessName, demo, isOwner }: { businessId: string; businessName: string; demo: boolean; isOwner: boolean }) {
  const [confirm, setConfirm] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const del = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirm !== businessName) {
      setMsg('Recopiez exactement le nom du commerce pour confirmer.');
      return;
    }
    setBusy(true);
    const r = await api(`/api/account/data?businessId=${encodeURIComponent(businessId)}`, { method: 'DELETE', json: { confirm } });
    setBusy(false);
    if (!r.ok) {
      setMsg(errText(r.status, r.data.error, demo));
      return;
    }
    window.location.href = '/bienvenue';
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <a href={`/api/account/data?businessId=${encodeURIComponent(businessId)}`} className="rp-btn" download>
          <Icon name="download" size={16} /> Exporter toutes mes données (JSON)
        </a>
        <Link href="/app/rapports" className="rp-link text-[14px]">
          Exports CSV par vue
        </Link>
      </div>
      <p className="text-[13px] text-[var(--muted)]">Mesures, réponses des IA, questions, actions, fiche de vérité, réglages : tout ce que Repéré garde sur ce commerce.</p>
      {demo ? null : !isOwner ? (
        <p className="text-[13px] text-[var(--muted)]">Seul le propriétaire de l’espace peut le supprimer.</p>
      ) : !open ? (
        <button type="button" className="rp-btn rp-btn-ghost self-start !text-[var(--danger)]" onClick={() => setOpen(true)}>
          Supprimer ce commerce et ses données
        </button>
      ) : (
        <form onSubmit={del} role="alertdialog" aria-labelledby="del-h" className="rounded-xl border border-[var(--danger-line)] bg-[var(--danger-bg)] p-3">
          <p id="del-h" className="text-[14px] font-semibold text-[var(--danger-ink)]">
            Suppression définitive
          </p>
          <p className="mt-1 text-[13px] text-[var(--danger-ink)]">
            Toutes les données de « {businessName} » seront effacées. Pensez à résilier votre abonnement dans le portail de facturation. Pour confirmer, recopiez le nom du commerce.
          </p>
          <label className="mt-2 block">
            <span className="sr-only">Nom du commerce</span>
            <input className="rp-input" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={businessName} autoComplete="off" />
          </label>
          <div className="mt-2 flex gap-2">
            <button type="button" className="rp-btn" onClick={() => setOpen(false)}>
              Annuler
            </button>
            <button type="submit" className="rp-btn !border-[var(--danger)] !bg-[var(--danger)] !text-[var(--surface)]" disabled={busy || confirm !== businessName}>
              {busy ? 'Suppression…' : 'Supprimer définitivement'}
            </button>
          </div>
        </form>
      )}
      <p role="status" className="min-h-[18px] text-[13px] text-[var(--danger-ink)]">
        {msg}
      </p>
    </div>
  );
}
