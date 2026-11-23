/** Frise chronologique des échéances (serveur). Le repère « point au … » (date de mise à jour) sépare le passé de ce qui arrive. */
import Link from 'next/link';
import { frDate, timelineByYear, type TimelineItem } from '@/lib/veille';

export function Frise({ items, today, compact = false }: { items: TimelineItem[]; today: string; compact?: boolean }) {
  const years = timelineByYear(items);
  let markerPlaced = false;
  return (
    <ol className="relative" aria-label="Frise chronologique des échéances">
      {years.map(({ year, items: its }) => (
        <li key={year} className="mb-2">
          <p className="mb-2 text-2xl font-semibold tabular-nums" style={{ fontFamily: 'var(--font-display, "Bricolage Grotesque", sans-serif)' }} aria-hidden>
            {year}
          </p>
          <ol className="border-l-2 pl-5" style={{ borderColor: 'var(--line)' }} aria-label={`Année ${year}`}>
            {its.map((it) => {
              const showMarker = !markerPlaced && it.future;
              if (showMarker) markerPlaced = true;
              return (
                <li key={`${it.date}-${it.slug}-${it.label}`} className="relative">
                  {showMarker ? (
                    <p className="relative -ml-5 mb-3 mt-1 flex items-center gap-2 pl-5 text-sm font-semibold" style={{ color: 'var(--primary)' }}>
                      <span aria-hidden className="absolute -left-[7px] size-3 rounded-full" style={{ background: 'var(--primary)' }} />
                      Point au {frDate(today)}
                    </p>
                  ) : null}
                  <div className={compact ? 'pb-3' : 'pb-4'}>
                    <span
                      aria-hidden
                      className="absolute -left-[27px] top-1.5 size-2.5 rounded-full border-2"
                      style={it.future ? { borderColor: 'var(--warning)', background: '#fff' } : { borderColor: 'var(--muted)', background: 'var(--muted)' }}
                    />
                    <p className="text-sm tabular-nums" style={{ color: it.future ? 'var(--warning-ink)' : 'var(--muted)' }}>
                      <time dateTime={it.date}>{frDate(it.date)}</time>
                      {it.future ? ' · à venir' : ''}
                    </p>
                    <p className={compact ? 'text-[0.95rem]' : ''}>
                      <Link href={`/veille/${it.slug}`} className="underline-offset-2 hover:underline">{it.label}</Link>
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </li>
      ))}
      {!markerPlaced ? (
        <li className="text-sm font-semibold" style={{ color: 'var(--primary)' }}>Point au {frDate(today)} : aucune échéance à venir recensée.</li>
      ) : null}
    </ol>
  );
}
