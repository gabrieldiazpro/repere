import type { BrandQuote } from '@/lib/engine/types-v2';
import { fmtDate, PROVIDER_LABEL } from './tokens';

const TONE = {
  positif: { label: 'Positif', cls: 'rp-chip-success', bar: 'var(--success)' },
  neutre: { label: 'Neutre', cls: '', bar: 'var(--line-strong)' },
  negatif: { label: 'Négatif', cls: 'rp-chip-danger', bar: 'var(--danger)' },
} as const;

export function QuoteCard({ q, emphasis, compact }: { q: BrandQuote; emphasis?: 'best' | 'fix'; compact?: boolean }) {
  const t = TONE[q.sentiment];
  return (
    <figure className="m-0 flex gap-3">
      <span className="w-[3px] flex-none rounded-full" style={{ background: t.bar }} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          <span className="text-[13px] font-semibold">{PROVIDER_LABEL[q.provider] ?? q.provider}</span>
          <span className={`rp-chip ${t.cls}`}>{t.label}</span>
          {emphasis === 'best' && <span className="rp-chip rp-chip-primary">La meilleure</span>}
          {emphasis === 'fix' && <span className="rp-chip rp-chip-warning">À corriger</span>}
        </div>
        <blockquote className={`m-0 ${compact ? 'text-[14px]' : 'text-[15px]'} leading-relaxed text-[var(--ink)]`}>« {q.text} »</blockquote>
        <figcaption className="mt-1 text-[12px] text-[var(--muted)]">
          Question : {q.query}
          {q.at ? ` · ${fmtDate(q.at, { day: 'numeric', month: 'short' })}` : ''}
        </figcaption>
      </div>
    </figure>
  );
}
