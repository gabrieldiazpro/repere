'use client';

import { useMemo, useState } from 'react';
import type { AiEngine, AiTrafficSummary } from '@/lib/engine/types-v2';
import { LineChart } from './ChartsClient';
import { Icon } from './icons';
import { sessionHeaders } from './localDemo';
import { ENGINE_COLOR, ENGINE_LABEL, ENGINE_ORDER } from './tokens';

function rolling(values: number[], k = 7) {
  return values.map((_, i) => {
    const from = Math.max(0, i - k + 1);
    const win = values.slice(from, i + 1);
    return Math.round((win.reduce((s, v) => s + v, 0) / win.length) * 10) / 10;
  });
}

const BUG = { from: '2026-10-13', label: 'Bug ChatGPT : UTM et referrer absents ~1 semaine (mi-oct. 2026)' };

export function TrafficChart({ initial, businessId, actions }: { initial: AiTrafficSummary; businessId: string; actions: { date: string; label: string }[] }) {
  const [data, setData] = useState(initial);
  const [days, setDays] = useState(initial.days.length >= 80 ? 90 : 30);
  const [state, setState] = useState<'idle' | 'busy' | 'err'>('idle');

  async function load(n: number) {
    setDays(n);
    if (n === 90 && initial.days.length >= 90) {
      setData(initial);
      return;
    }
    setState('busy');
    try {
      const res = await fetch(`/api/t/summary?businessId=${encodeURIComponent(businessId)}&days=${n}`, { headers: sessionHeaders(), credentials: 'same-origin' });
      if (!res.ok) throw new Error(String(res.status));
      const j = (await res.json()) as AiTrafficSummary;
      if (!Array.isArray(j.days)) throw new Error('forme');
      setData(j);
      setState('idle');
    } catch {
      // repli : on découpe la série déjà chargée
      setData({ ...initial, days: initial.days.slice(-n) });
      setState('err');
    }
  }

  const { series, labels, markers } = useMemo(() => {
    const ds = data.days;
    const engines = ENGINE_ORDER.filter((e) => ds.some((d) => (d.visits[e] ?? 0) > 0));
    const labels = ds.map((d) => new Date(`${d.date}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }));
    const series = engines.map((e: AiEngine) => ({
      name: ENGINE_LABEL[e],
      color: ENGINE_COLOR[e],
      emphasis: e === 'chatgpt',
      values: rolling(ds.map((d) => d.visits[e] ?? 0)),
    }));
    const markers: { index: number; label: string }[] = [];
    const bugIdx = ds.findIndex((d) => d.date >= BUG.from);
    if (bugIdx > 0 && ds[bugIdx].date <= '2026-10-20') markers.push({ index: bugIdx, label: BUG.label });
    for (const a of actions) {
      const i = ds.findIndex((d) => d.date >= a.date.slice(0, 10));
      if (i >= 0) markers.push({ index: i, label: a.label });
    }
    return { series, labels, markers };
  }, [data, actions]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-[var(--muted)]">Visites par jour, moyenne glissante sur 7 jours</p>
        <div role="radiogroup" aria-label="Période" className="inline-flex rounded-lg bg-[var(--bg)] p-0.5" aria-busy={state === 'busy'}>
          {[30, 90].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={days === n}
              onClick={() => load(n)}
              className={`min-h-[30px] rounded-md px-3 text-[13px] font-medium ${days === n ? 'bg-[var(--surface)] text-[var(--ink)] shadow-[0_1px_2px_rgba(27,31,46,0.12)]' : 'text-[var(--muted)]'}`}
            >
              {n} jours
            </button>
          ))}
        </div>
      </div>
      {series.length ? (
        <LineChart title={`Visites venues des IA par moteur sur ${days} jours`} series={series} labels={labels} mode="dec" height={250} markers={markers} />
      ) : (
        <p className="py-10 text-center text-[14px] text-[var(--muted)]">Aucune visite venue d’une IA sur la période.</p>
      )}
      {series.length > 0 && markers.length > 0 && (
        <div className="mt-2 text-[12px] text-[var(--muted)]">
          <p className="font-semibold text-[var(--ink)]">Repères (traits pointillés) : ce que vous avez fait, pour relier action et effet</p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {markers.map((m, i) => (
              <li key={i}>
                <span className="rp-num">{labels[m.index]}</span> — {m.label}
              </li>
            ))}
          </ul>
        </div>
      )}
      {state === 'err' && <p className="mt-1 text-[12px] text-[var(--muted)]">Données de la période extraites du dernier chargement.</p>}
    </div>
  );
}

export function Ga4Button({ businessId, enabled, demo }: { businessId: string; enabled: boolean; demo: boolean }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!enabled)
    return (
      <p className="text-[13px] text-[var(--muted)]">
        Le connecteur GA4 n’est pas encore activé sur cet environnement. Le snippet suffit pour commencer la mesure.
      </p>
    );
  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        className="rp-btn self-start"
        disabled={busy || demo}
        onClick={async () => {
          setBusy(true);
          setMsg(null);
          try {
            const res = await fetch(`/api/connect/ga4/start?businessId=${encodeURIComponent(businessId)}`, { headers: sessionHeaders(), credentials: 'same-origin' });
            const j = (await res.json()) as { url?: string; error?: string };
            if (!res.ok || !j.url) throw new Error(j.error ?? 'Connexion impossible.');
            window.location.assign(j.url);
          } catch (e) {
            setMsg(e instanceof Error ? e.message : 'Connexion impossible.');
            setBusy(false);
          }
        }}
      >
        <Icon name="link" size={16} /> Connecter Google Analytics 4
      </button>
      {demo && <p className="text-[12px] text-[var(--muted)]">Indisponible sur un compte démo.</p>}
      {msg && (
        <p role="alert" className="text-[12px] text-[var(--danger-ink)]">
          {msg}
        </p>
      )}
    </div>
  );
}
