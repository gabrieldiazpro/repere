'use client';
import { useState } from 'react';

export function AuditButton(props: { nom: string; metier: string; codePostal: string; site: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'ok' | 'err'>('idle');
  const [info, setInfo] = useState('');
  async function run() {
    setState('busy');
    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        // Le cookie HttpOnly admin_token (même origine) exempte de la limite par IP ; les plafonds globaux s'appliquent.
        headers: { 'Content-Type': 'application/json' },
        // pas d'e-mail : aucun envoi automatique ; consent=false (audit interne de prospection)
        body: JSON.stringify({ businessName: props.nom, trade: props.metier, city: 'Paris', district: props.codePostal, website: props.site || undefined, consent: false }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`); // 503 = plafond global atteint
      const { id } = (await res.json()) as { id: string };
      setInfo(id);
      setState('ok');
    } catch (e) {
      setInfo(e instanceof Error ? e.message : 'erreur');
      setState('err');
    }
  }
  if (state === 'ok') return <a className="underline font-semibold" style={{ color: 'var(--tone-up)' }} href={`/rapport/${info}`} target="_blank" rel="noreferrer">Voir le rapport</a>;
  return (
    <button onClick={run} disabled={state === 'busy'} className="ui-btn whitespace-nowrap" data-size="sm" data-variant={state === 'err' ? undefined : 'primary'} data-state={state === 'busy' ? 'busy' : undefined} aria-live="polite">
      {state === 'busy' ? 'Audit en cours…' : state === 'err' ? `Échec (${info}), réessayer` : 'Lancer un audit'}
    </button>
  );
}
