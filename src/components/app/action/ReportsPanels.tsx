'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Entitlements } from '@/lib/entitlements';
import type { ReportSchedule } from '@/lib/notify/reports';
import type { ShareLinkView } from '@/lib/share';
import { CopyButton } from '../CopyButton';
import { Icon } from '../icons';
import { Verrou } from '../shell/Verrou';
import { fmtDate } from '../tokens';

type Load<T> = { state: 'loading' } | { state: 'error'; error: string } | { state: 'ok'; data: T };

const DEMO_NOTE = 'Démo : rien n’est enregistré sur le serveur. Sur votre compte, cette action fonctionne telle quelle.';

async function api<T>(url: string, init?: RequestInit): Promise<{ ok: true; data: T } | { ok: false; error: string; demo?: boolean }> {
  try {
    const res = await fetch(url, { credentials: 'same-origin', ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
    const j = (await res.json().catch(() => null)) as (T & { ok?: boolean; error?: string; demo?: boolean }) | null;
    if (!res.ok || !j || j.ok === false) return { ok: false, error: j?.error ?? 'La demande a échoué. Réessayez.', demo: j?.demo ?? res.status === 403 };
    return { ok: true, data: j };
  } catch {
    return { ok: false, error: 'Connexion impossible. Vérifiez votre réseau puis réessayez.' };
  }
}

function Skeleton() {
  return <div className="h-20 animate-pulse rounded-lg bg-[var(--bg)]" aria-label="Chargement" />;
}

function Failed({ error, retry }: { error: string; retry: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[13px] text-[var(--danger-ink)]" role="alert">
      {error}
      <button type="button" className="rp-btn rp-btn-sm" onClick={retry}>
        Réessayer
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Liens de partage
// ---------------------------------------------------------------------------
export function ShareLinks({ businessId, demo, ent, auditId }: { businessId: string; demo: boolean; ent: Entitlements; auditId: string | null }) {
  const [load, setLoad] = useState<Load<{ links: ShareLinkView[]; whiteLabel: boolean }>>({ state: 'loading' });
  const [form, setForm] = useState({ label: '', scope: 'report' as 'report' | 'dashboard', days: 90, password: '', brandName: '', brandColor: '', logoUrl: '', hideRepere: false });
  const [created, setCreated] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoad({ state: 'loading' });
    const r = await api<{ links: ShareLinkView[]; whiteLabel: boolean }>(`/api/share?businessId=${encodeURIComponent(businessId)}`);
    setLoad(r.ok ? { state: 'ok', data: r.data } : { state: 'error', error: r.error });
  }, [businessId]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const branding = ent.whiteLabel && (form.brandName || form.brandColor || form.logoUrl) ? { name: form.brandName || undefined, color: form.brandColor || undefined, logoUrl: form.logoUrl || undefined, hideRepere: form.hideRepere } : null;
    const r = await api<{ url: string }>('/api/share', {
      method: 'POST',
      body: JSON.stringify({ businessId, scope: form.scope, auditId: form.scope === 'report' ? auditId ?? undefined : undefined, label: form.label || undefined, expiresInDays: form.days, password: form.password || null, branding }),
    });
    setBusy(false);
    if (r.ok) {
      setCreated(r.data.url);
      setForm((f) => ({ ...f, label: '', password: '' }));
      void refresh();
    } else setMsg(demo || r.demo ? DEMO_NOTE : r.error);
  }

  async function revoke(id: string) {
    const r = await api(`/api/share?businessId=${encodeURIComponent(businessId)}&id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (r.ok) void refresh();
    else setMsg(demo || r.demo ? DEMO_NOTE : r.error);
  }

  return (
    <Verrou ent={ent} feature="shareLinks" titre="Liens de partage">
      <div className="flex flex-col gap-4">
        <form onSubmit={create} className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-[13px] font-medium">
              Nom du lien (pour vous)
              <input className="rp-input" maxLength={80} placeholder="Ex. Pour l’associé" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-[13px] font-medium">
              Contenu partagé
              <select className="rp-input" value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value as 'report' | 'dashboard' })}>
                <option value="report">Dernier rapport</option>
                <option value="dashboard">Tableau de bord (toujours à jour)</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[13px] font-medium">
              Expire après
              <select className="rp-input" value={form.days} onChange={(e) => setForm({ ...form, days: Number(e.target.value) })}>
                <option value={7}>7 jours</option>
                <option value={30}>30 jours</option>
                <option value={90}>90 jours</option>
                <option value={365}>1 an</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[13px] font-medium">
              Mot de passe (facultatif)
              <input className="rp-input" type="password" autoComplete="new-password" maxLength={100} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </label>
          </div>
          <Verrou ent={ent} feature="whiteLabel" titre="Marque blanche" compact>
            <fieldset className="grid gap-3 rounded-lg border border-[var(--hair)] p-3 sm:grid-cols-3">
              <legend className="px-1 text-[13px] font-semibold">Marque blanche</legend>
              <label className="flex flex-col gap-1 text-[13px]">
                Nom affiché
                <input className="rp-input" maxLength={80} value={form.brandName} onChange={(e) => setForm({ ...form, brandName: e.target.value })} />
              </label>
              <label className="flex flex-col gap-1 text-[13px]">
                Couleur (#RRGGBB)
                <input className="rp-input" pattern="#[0-9A-Fa-f]{6}" maxLength={7} value={form.brandColor} onChange={(e) => setForm({ ...form, brandColor: e.target.value })} />
              </label>
              <label className="flex flex-col gap-1 text-[13px]">
                Logo (adresse https)
                <input className="rp-input" type="url" value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} />
              </label>
              <label className="flex items-center gap-2 text-[13px] sm:col-span-3">
                <input type="checkbox" className="rp-check" checked={form.hideRepere} onChange={(e) => setForm({ ...form, hideRepere: e.target.checked })} />
                Masquer la mention Repéré
              </label>
            </fieldset>
          </Verrou>
          <div>
            <button type="submit" className="rp-btn rp-btn-primary" disabled={busy}>
              <Icon name="link" size={16} /> {busy ? 'Création…' : 'Créer le lien'}
            </button>
          </div>
        </form>
        {created && (
          <div className="rounded-lg bg-[var(--success-bg)] p-3 text-[13px] text-[var(--success-ink)]" role="status">
            <p className="font-semibold">Lien créé. Copiez-le maintenant : il ne sera plus affiché.</p>
            <p className="mt-1 break-all">{created}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <CopyButton text={created} label="Copier le lien" />
              <a href={created} target="_blank" rel="noopener noreferrer" className="rp-btn rp-btn-sm">
                <Icon name="eye" size={14} /> Aperçu
              </a>
            </div>
          </div>
        )}
        {msg && (
          <p className="text-[13px] text-[var(--muted)]" role="status">
            {msg}
          </p>
        )}
        {load.state === 'loading' ? (
          <Skeleton />
        ) : load.state === 'error' ? (
          <Failed error={load.error} retry={refresh} />
        ) : load.data.links.length === 0 ? (
          <p className="text-[13px] text-[var(--muted)]">Aucun lien actif. Un lien donne accès en lecture seule au rapport, sans tâches ni fiche de vérité.</p>
        ) : (
          <ul className="flex flex-col border-t border-[var(--hair)]">
            {load.data.links.map((l) => {
              const live = !l.revoked && !l.expired;
              return (
                <li key={l.id} className="flex flex-wrap items-center gap-2 border-b border-[var(--hair)] py-2.5 text-[13px] last:border-b-0">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {l.label || (l.scope === 'report' ? 'Rapport' : 'Tableau de bord')} <span className="font-normal text-[var(--muted)]">…{l.hint}</span>
                    </p>
                    <p className="text-[12px] text-[var(--muted)]">
                      {l.revoked ? 'Révoqué' : l.expired ? 'Expiré' : `Expire le ${fmtDate(l.expiresAt, { day: 'numeric', month: 'short', year: 'numeric' })}`}
                      {l.passwordProtected ? ' · mot de passe' : ''}
                      {l.branding ? ' · marque blanche' : ''} · {l.views} vue{l.views > 1 ? 's' : ''}
                      {l.lastViewedAt ? `, dernière le ${fmtDate(l.lastViewedAt, { day: 'numeric', month: 'short' })}` : ''}
                    </p>
                  </div>
                  {live && (
                    <button type="button" className="rp-btn rp-btn-sm rp-btn-ghost" onClick={() => void revoke(l.id)}>
                      Révoquer<span className="sr-only"> le lien {l.label}</span>
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Verrou>
  );
}

// ---------------------------------------------------------------------------
// Rapports planifiés
// ---------------------------------------------------------------------------
const WEEKDAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

export function ScheduledReports({ businessId, demo, ent }: { businessId: string; demo: boolean; ent: Entitlements }) {
  const [load, setLoad] = useState<Load<{ schedule: ReportSchedule | null; maxRecipients: number }>>({ state: 'loading' });
  const [f, setF] = useState({ active: false, frequency: 'monthly' as 'weekly' | 'monthly', day: 1, hour: 8, recipients: '', includeShareLink: false });
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoad({ state: 'loading' });
    const r = await api<{ schedule: ReportSchedule | null; maxRecipients: number }>(`/api/alerts/reports?businessId=${encodeURIComponent(businessId)}`);
    if (!r.ok) return setLoad({ state: 'error', error: r.error });
    setLoad({ state: 'ok', data: r.data });
    const s = r.data.schedule;
    if (s) setF({ active: s.active, frequency: s.frequency, day: s.day, hour: s.hour, recipients: s.recipients.map((x) => x.email).join('\n'), includeShareLink: s.includeShareLink });
  }, [businessId]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const recipients = f.recipients
      .split(/[\s,;]+/)
      .map((x) => x.trim())
      .filter(Boolean);
    const r = await api<{ schedule: ReportSchedule }>('/api/alerts/reports', { method: 'POST', body: JSON.stringify({ businessId, ...f, recipients }) });
    setBusy(false);
    if (r.ok) {
      setMsg('Enregistré. Chaque nouvelle adresse reçoit un e-mail de confirmation avant tout envoi.');
      setLoad((l) => (l.state === 'ok' ? { state: 'ok', data: { ...l.data, schedule: r.data.schedule } } : l));
    } else setMsg(demo || r.demo ? DEMO_NOTE : r.error);
  }

  if (load.state === 'loading') return <Skeleton />;
  if (load.state === 'error') return <Failed error={load.error} retry={refresh} />;
  const s = load.data.schedule;
  return (
    <form onSubmit={save} className="flex flex-col gap-3 text-[13px]">
      <label className="flex items-center gap-2 font-medium">
        <input type="checkbox" className="rp-check" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
        Envoyer le rapport automatiquement par e-mail
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 font-medium">
          Fréquence
          <select className="rp-input" value={f.frequency} onChange={(e) => setF({ ...f, frequency: e.target.value as 'weekly' | 'monthly', day: 1 })}>
            <option value="weekly">Chaque semaine</option>
            <option value="monthly">Chaque mois</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 font-medium">
          Jour
          <select className="rp-input" value={f.day} onChange={(e) => setF({ ...f, day: Number(e.target.value) })}>
            {f.frequency === 'weekly'
              ? WEEKDAYS.map((d, i) => (
                  <option key={d} value={i + 1}>
                    {d}
                  </option>
                ))
              : Array.from({ length: 28 }, (_, i) => (
                  <option key={i} value={i + 1}>
                    le {i + 1}
                  </option>
                ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 font-medium">
          Heure (Paris)
          <select className="rp-input" value={f.hour} onChange={(e) => setF({ ...f, hour: Number(e.target.value) })}>
            {Array.from({ length: 15 }, (_, i) => i + 6).map((h) => (
              <option key={h} value={h}>
                {h} h
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1 font-medium">
        Destinataires ({load.data.maxRecipients} au maximum, une adresse par ligne)
        <textarea className="rp-input min-h-[84px]" value={f.recipients} onChange={(e) => setF({ ...f, recipients: e.target.value })} placeholder="associe@exemple.fr" />
      </label>
      {s && s.recipients.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {s.recipients.map((r) => (
            <li key={r.email} className={`rp-chip ${r.status === 'confirmed' ? 'rp-chip-success' : 'rp-chip-warning'}`}>
              {r.email} · {r.status === 'confirmed' ? 'confirmé' : 'en attente de confirmation'}
            </li>
          ))}
        </ul>
      )}
      {ent.shareLinks && (
        <label className="flex items-center gap-2">
          <input type="checkbox" className="rp-check" checked={f.includeShareLink} onChange={(e) => setF({ ...f, includeShareLink: e.target.checked })} />
          Joindre un lien de partage au rapport
        </label>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="rp-btn rp-btn-primary" disabled={busy}>
          {busy ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        {s?.nextRunAt && f.active && <span className="text-[var(--muted)]">Prochain envoi : {fmtDate(s.nextRunAt, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</span>}
        {s?.lastSentAt && <span className="text-[var(--muted)]">Dernier : {fmtDate(s.lastSentAt, { day: 'numeric', month: 'short' })}</span>}
      </div>
      {msg && (
        <p role="status" className="text-[var(--muted)]">
          {msg}
        </p>
      )}
    </form>
  );
}

// ---------------------------------------------------------------------------
// Carte de score partageable
// ---------------------------------------------------------------------------
interface Card {
  auditId: string;
  url: string;
  imageUrl: string;
  createdAt: string;
}

export function ScoreCard({ businessId, demo, auditId }: { businessId: string; demo: boolean; auditId: string }) {
  const [load, setLoad] = useState<Load<{ card: Card | null }>>({ state: 'loading' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    setLoad({ state: 'loading' });
    const r = await api<{ card: Card | null }>(`/api/growth/card?businessId=${encodeURIComponent(businessId)}`);
    setLoad(r.ok ? { state: 'ok', data: r.data } : { state: 'error', error: r.error });
  }, [businessId]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function toggle(enabled: boolean) {
    setBusy(true);
    setMsg(null);
    const r = await api<{ card: Card | null }>('/api/growth/card', { method: 'POST', body: JSON.stringify({ businessId, auditId, enabled }) });
    setBusy(false);
    if (r.ok) setLoad({ state: 'ok', data: r.data });
    else setMsg(demo || r.demo ? DEMO_NOTE : r.error);
  }

  if (load.state === 'loading') return <Skeleton />;
  if (load.state === 'error') return <Failed error={load.error} retry={refresh} />;
  const c = load.data.card;
  return (
    <div className="flex flex-col gap-3 text-[13px]">
      {c ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={c.imageUrl} alt="Aperçu de votre carte de score" className="w-full max-w-md rounded-lg border border-[var(--hair)]" loading="lazy" />
          <div className="flex flex-wrap gap-2">
            <CopyButton text={c.url} label="Copier le lien" />
            <a href={c.url} target="_blank" rel="noopener noreferrer" className="rp-btn rp-btn-sm">
              <Icon name="external" size={14} /> Ouvrir
            </a>
            <button type="button" className="rp-btn rp-btn-sm rp-btn-ghost" disabled={busy} onClick={() => void toggle(false)}>
              Désactiver le partage
            </button>
          </div>
          <p className="text-[var(--muted)]">Active depuis le {fmtDate(c.createdAt, { day: 'numeric', month: 'long' })}. Elle montre le score, le rang et la marge d’erreur, rien d’autre.</p>
        </>
      ) : (
        <>
          <p className="text-[var(--muted)]">Une image et un lien public avec votre score, votre rang et la marge d’erreur de la dernière mesure. Rien n’est public tant que vous ne l’activez pas.</p>
          <div>
            <button type="button" className="rp-btn" disabled={busy} onClick={() => void toggle(true)}>
              <Icon name="share" size={16} /> Activer la carte
            </button>
          </div>
        </>
      )}
      {msg && (
        <p role="status" className="text-[var(--muted)]">
          {msg}
        </p>
      )}
    </div>
  );
}
