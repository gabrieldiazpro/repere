'use client';
// Réglages de l'agent : ce qu'il a le droit de proposer, fréquence, notification des nouvelles propositions.
import { useState } from 'react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { toast } from '@/components/ui/toast';
import { saveAgentSettings } from '@/app/app/agent/actions';
import { fmtDate } from '../tokens';
import { canPublish, KIND_GAIN, KIND_NAME, RISK_VIEW, ROLE_NAME, SETTINGS_KINDS, type AgentSettings, type ChangeKind, type Frequency, type NotifyChannel } from './model';
import { useAgent } from './state';

const FREQ: { id: Frequency; label: string; help: string }[] = [
  { id: 'weekly', label: 'Chaque semaine', help: 'Après la mesure du lundi.' },
  { id: 'monthly', label: 'Chaque mois', help: 'Le premier lundi du mois.' },
  { id: 'manual', label: 'Seulement à ma demande', help: 'Quand vous relancez une analyse.' },
];

const NOTIFY: { id: NotifyChannel; label: string }[] = [
  { id: 'email', label: 'Par e-mail et dans l’app' },
  { id: 'app', label: 'Dans l’app seulement' },
  { id: 'off', label: 'Ne pas me prévenir' },
];

export function SettingsForm() {
  const a = useAgent();
  const admin = canPublish(a.role);
  const [s, setS] = useState<AgentSettings>(a.settings);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify({ ...s, updatedAt: undefined, updatedBy: undefined }) !== JSON.stringify({ ...a.settings, updatedAt: undefined, updatedBy: undefined });

  const toggle = (k: ChangeKind, on: boolean) => setS((p) => ({ ...p, kinds: on ? [...new Set([...p.kinds, k])] : p.kinds.filter((x) => x !== k) }));

  async function save() {
    setSaving(true);
    if (a.demo) {
      a.putSettings({ ...s, updatedAt: new Date().toISOString(), updatedBy: 'vous (démo)' });
      toast({ text: 'Réglages enregistrés dans ce navigateur (simulation).', tone: 'success' });
    } else {
      const r = await saveAgentSettings(a.businessId, s);
      if (r.ok) {
        a.putSettings(r.settings);
        toast({ text: 'Réglages enregistrés.', tone: 'success' });
        a.refresh();
      } else toast({ text: r.error, tone: 'error' });
    }
    setSaving(false);
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      {!admin && (
        <p role="note" className="m-0 rounded-lg bg-[var(--surface-2)] px-3 py-2 text-[13.5px] text-[var(--muted)]">
          Vous êtes {ROLE_NAME[a.role].toLowerCase()} : ces réglages sont modifiables par un administrateur ou le propriétaire.
        </p>
      )}
      <fieldset className="ui-card m-0 min-w-0 p-0" disabled={!admin}>
        <div className="ui-card-head">
          <legend className="ui-h2 float-left m-0 p-0">Ce que l’agent a le droit de proposer</legend>
        </div>
        <div className="ui-card-body flex flex-col gap-5">
          <p className="ui-small m-0 text-[var(--muted)]">Proposer n’est pas appliquer : chaque modification attend toujours votre validation.</p>
          {SETTINGS_KINDS.map((g) => (
            <div key={g.risk}>
              <p className="m-0 mb-1 flex items-center gap-2">
                <StatusBadge tone={RISK_VIEW[g.risk].tone}>{RISK_VIEW[g.risk].label}</StatusBadge>
                <span className="ui-caption text-[var(--muted)]">{RISK_VIEW[g.risk].help}</span>
              </p>
              {g.kinds.map((k) => (
                <label key={k} className="ag-opt">
                  <input type="checkbox" checked={s.kinds.includes(k)} onChange={(e) => toggle(k, e.target.checked)} />
                  <span>
                    {KIND_NAME[k]}
                    <small>{KIND_GAIN[k]}</small>
                  </span>
                </label>
              ))}
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset className="ui-card m-0 min-w-0 p-0" disabled={!admin}>
        <div className="ui-card-head">
          <legend className="ui-h2 float-left m-0 p-0">Fréquence des propositions</legend>
        </div>
        <div className="ui-card-body flex flex-col gap-2">
          <div className="ag-seg" role="radiogroup" aria-label="Fréquence">
            {FREQ.map((f) => (
              <label key={f.id}>
                <input type="radio" name="freq" value={f.id} checked={s.frequency === f.id} onChange={() => setS({ ...s, frequency: f.id })} />
                {f.label}
              </label>
            ))}
          </div>
          <p className="ui-caption m-0 text-[var(--muted)]">{FREQ.find((f) => f.id === s.frequency)?.help}</p>
        </div>
      </fieldset>

      <fieldset className="ui-card m-0 min-w-0 p-0" disabled={!admin}>
        <div className="ui-card-head">
          <legend className="ui-h2 float-left m-0 p-0">Me prévenir des nouvelles propositions</legend>
        </div>
        <div className="ui-card-body">
          <div className="ag-seg" role="radiogroup" aria-label="Notification">
            {NOTIFY.map((n) => (
              <label key={n.id}>
                <input type="radio" name="notify" value={n.id} checked={s.notify === n.id} onChange={() => setS({ ...s, notify: n.id })} />
                {n.label}
              </label>
            ))}
          </div>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="ui-btn" data-variant="primary" disabled={!admin || !dirty || saving}>
          {saving ? 'Enregistrement…' : 'Enregistrer les réglages'}
        </button>
        {a.settings.updatedAt && (
          <span className="ui-caption text-[var(--muted)]">
            Modifiés le {fmtDate(a.settings.updatedAt, { day: 'numeric', month: 'long' })}
            {a.settings.updatedBy ? ` par ${a.settings.updatedBy}` : ''}
          </span>
        )}
      </div>
    </form>
  );
}
