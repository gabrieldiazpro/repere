/** Briques d'affichage de la veille (serveur). */
import Link from 'next/link';
import { AUDIENCE_LABEL, STATUS_LABEL, THEME_LABEL, frDate, type VeilleEntry, type VeilleStatus } from '@/lib/veille';

const STATUS_STYLE: Record<VeilleStatus, { bg: string; ink: string; dot: string; shape: string }> = {
  'en-vigueur': { bg: 'var(--success-bg)', ink: 'var(--success-ink)', dot: 'var(--success)', shape: '●' },
  annonce: { bg: '#EEF0F5', ink: 'var(--ink)', dot: 'var(--muted)', shape: '○' },
  'a-venir': { bg: 'var(--warning-bg)', ink: 'var(--warning-ink)', dot: 'var(--warning)', shape: '◆' },
};

/** Statut : couleur + forme + texte (jamais la couleur seule). */
export function StatusBadge({ status }: { status: VeilleStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.8rem] font-semibold" style={{ background: s.bg, color: s.ink }}>
      <span aria-hidden style={{ color: s.dot }}>{s.shape}</span>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function DateBlock({ iso }: { iso: string }) {
  const [y, m, d] = iso.split('-');
  const month = frDate(`${y}-${m}`).split(' ')[0];
  return (
    <time dateTime={iso} className="flex flex-col leading-none" aria-label={frDate(iso)}>
      <span className="text-3xl font-semibold tabular-nums" style={{ fontFamily: 'var(--font-display, "Bricolage Grotesque", sans-serif)' }}>{Number(d)}</span>
      <span className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>{month}</span>
      <span className="text-sm tabular-nums" style={{ color: 'var(--muted)' }}>{y}</span>
    </time>
  );
}

export function Tags({ e }: { e: VeilleEntry }) {
  return (
    <p className="text-sm" style={{ color: 'var(--muted)' }}>
      {e.themes.map((t) => THEME_LABEL[t]).join(', ')}
      <span aria-hidden> — </span>
      <span className="sr-only">Pour : </span>
      {e.audiences.map((a) => AUDIENCE_LABEL[a]).join(', ')}
    </p>
  );
}

export function EntryRow({ e }: { e: VeilleEntry }) {
  return (
    <article className="grid grid-cols-[4.5rem_1fr] gap-4 border-t py-6 sm:grid-cols-[6rem_1fr] sm:gap-6" style={{ borderColor: 'var(--line)' }}>
      <DateBlock iso={e.eventDate} />
      <div className="min-w-0">
        <StatusBadge status={e.status} />
        <h3 className="mt-2 text-xl font-semibold leading-snug">
          <Link href={`/veille/${e.slug}`} className="hover:underline underline-offset-4">{e.title}</Link>
        </h3>
        <p className="mt-2 leading-relaxed">{e.summary}</p>
        <div className="mt-2"><Tags e={e} /></div>
      </div>
    </article>
  );
}
