'use client';

import { useState } from 'react';
import { Icon } from './icons';

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // repli : sélection + execCommand
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export function CopyButton({ text, label = 'Copier', className = '', small = true }: { text: string; label?: string; className?: string; small?: boolean }) {
  const [state, setState] = useState<'idle' | 'ok' | 'ko'>('idle');
  return (
    <button
      type="button"
      className={`rp-btn ${small ? 'rp-btn-sm' : ''} ${state === 'ok' ? 'rp-btn-done' : ''} ${className}`}
      onClick={async () => {
        const ok = await copyText(text);
        setState(ok ? 'ok' : 'ko');
        window.setTimeout(() => setState('idle'), 1800);
      }}
    >
      <Icon name={state === 'ok' ? 'check' : 'copy'} size={16} />
      {state === 'ok' ? 'Copié' : state === 'ko' ? 'Sélectionnez le texte' : label}
      <span className="sr-only" aria-live="polite">{state === 'ok' ? 'Copié dans le presse-papiers' : ''}</span>
    </button>
  );
}
