import { ImageResponse } from 'next/og';
import { getAudit } from '@/lib/db';

export const alt = 'Score de visibilité IA';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

function band(score: number) {
  if (score >= 70) return { label: 'Bien recommandé', color: '#15803D', bg: '#E7F5EC', ink: '#166534' };
  if (score >= 40) return { label: 'Peu visible', color: '#B45309', bg: '#FDF1E3', ink: '#92400E' };
  return { label: 'Invisible', color: '#B91C1C', bg: '#FCEAEA', ink: '#991B1B' };
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let r: Awaited<ReturnType<typeof getAudit>> = null;
  try {
    r = /^[A-Za-z0-9_-]{1,80}$/.test(id) ? await getAudit(id) : null;
  } catch {
    r = null;
  }
  const score = r ? Math.max(0, Math.min(100, Math.round(r.score))) : null;
  const b = band(score ?? 0);
  const name = r?.input.businessName ?? 'Rapport de visibilité IA';
  const sub = r ? [r.input.trade, r.input.district || r.input.city].filter(Boolean).join(' · ') : 'Soyez celui que l’IA recommande.';
  const C = 2 * Math.PI * 120;

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: '#F6F7FB', padding: 56, fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, background: '#fff', borderRadius: 36, padding: 56, border: '2px solid #D5D9E4' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <svg width="56" height="56" viewBox="0 0 64 64">
              <rect width="64" height="64" rx="14" fill="#3730A3" />
              <g fill="none" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 26V19a2 2 0 0 1 2-2h7" />
                <path d="M38 17h7a2 2 0 0 1 2 2v7" />
                <path d="M47 38v7a2 2 0 0 1-2 2h-7" />
                <path d="M26 47h-7a2 2 0 0 1-2-2v-7" />
              </g>
              <circle cx="32" cy="32" r="7" fill="#F5A524" />
            </svg>
            <span style={{ fontSize: 34, fontWeight: 700, color: '#1B1F2E' }}>Repéré</span>
            <span style={{ fontSize: 24, color: '#5A6275', marginLeft: 8 }}>visibilité IA des commerces locaux</span>
          </div>
          <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 48, marginTop: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 16 }}>
              <span style={{ fontSize: name.length > 28 ? 52 : 64, fontWeight: 700, color: '#1B1F2E', lineHeight: 1.1 }}>{name}</span>
              <span style={{ fontSize: 30, color: '#5A6275' }}>{sub}</span>
              {score !== null && (
                <span style={{ display: 'flex', alignSelf: 'flex-start', fontSize: 28, fontWeight: 700, color: b.ink, background: b.bg, padding: '8px 22px', borderRadius: 999 }}>
                  {b.label}
                </span>
              )}
              {r?.demo && <span style={{ display: 'flex', fontSize: 22, color: '#92400E' }}>Données de démonstration</span>}
            </div>
            {score !== null && (
              <div style={{ display: 'flex', position: 'relative', width: 300, height: 300, alignItems: 'center', justifyContent: 'center' }}>
                <svg width="300" height="300" viewBox="0 0 300 300" style={{ position: 'absolute', top: 0, left: 0 }}>
                  <circle cx="150" cy="150" r="120" fill="none" stroke="#D5D9E4" strokeWidth="28" />
                  <circle
                    cx="150"
                    cy="150"
                    r="120"
                    fill="none"
                    stroke={b.color}
                    strokeWidth="28"
                    strokeLinecap="round"
                    strokeDasharray={`${(C * score) / 100} ${C}`}
                    transform="rotate(-90 150 150)"
                  />
                </svg>
                <div style={{ display: 'flex', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 110, fontWeight: 800, color: '#1B1F2E' }}>{score}</span>
                  <span style={{ fontSize: 34, color: '#5A6275' }}>/100</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
