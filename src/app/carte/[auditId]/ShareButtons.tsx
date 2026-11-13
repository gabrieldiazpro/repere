'use client';

import { useState } from 'react';

/** Partage de la carte : LinkedIn, X, copie du lien. Aucun suivi, aucun cookie. */
export function ShareButtons({ url, linkedin, x }: { url: string; linkedin: string; x: string }) {
  const [copied, setCopied] = useState<'idle' | 'ok' | 'error'>('idle');
  const btn = 'inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-semibold';
  const style = { borderColor: 'var(--line)', background: '#fff', color: 'var(--ink)' } as const;
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied('ok');
    } catch {
      setCopied('error');
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <a className={btn} style={style} href={linkedin} target="_blank" rel="noopener noreferrer">
        Partager sur LinkedIn
      </a>
      <a className={btn} style={style} href={x} target="_blank" rel="noopener noreferrer">
        Partager sur X
      </a>
      <button type="button" className={btn} style={style} onClick={copy}>
        Copier le lien
      </button>
      <span role="status" className="text-sm" style={{ color: 'var(--muted)' }}>
        {copied === 'ok' ? 'Lien copié.' : copied === 'error' ? 'Copie impossible : sélectionnez le lien ci-dessous.' : ''}
      </span>
    </div>
  );
}
