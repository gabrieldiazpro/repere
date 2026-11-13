import { ImageResponse } from 'next/og';
import { cardView } from '@/lib/growth/cards';
import { bandFor } from '@/lib/growth/score';
import { dateFr } from '@/lib/growth/measure';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /carte/<auditId>/og?t=<jeton> — image Open Graph 1200 × 630 de la carte (404 sans jeton valide). */
export async function GET(req: Request, { params }: { params: Promise<{ auditId: string }> }) {
  const { auditId } = await params;
  const v = await cardView(auditId, new URL(req.url).searchParams.get('t')).catch(() => null);
  if (!v) return new Response('Not found', { status: 404 });
  const b = bandFor(v.score);
  const C = 2 * Math.PI * 120;
  const sub = [v.trade, v.place].filter(Boolean).join(' · ');
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: '#1E1A5C', backgroundImage: 'radial-gradient(circle at 85% 15%, #3730A3 0%, #1E1A5C 60%)', padding: 48, fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, background: '#fff', borderRadius: 32, padding: 52 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <svg width="52" height="52" viewBox="0 0 64 64">
              <rect width="64" height="64" rx="14" fill="#3730A3" />
              <g fill="none" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 26V19a2 2 0 0 1 2-2h7" />
                <path d="M38 17h7a2 2 0 0 1 2 2v7" />
                <path d="M47 38v7a2 2 0 0 1-2 2h-7" />
                <path d="M26 47h-7a2 2 0 0 1-2-2v-7" />
              </g>
              <circle cx="32" cy="32" r="7" fill="#F5A524" />
            </svg>
            <span style={{ fontSize: 32, fontWeight: 700, color: '#1B1F2E' }}>Repéré</span>
            <span style={{ fontSize: 22, color: '#5A6275', marginLeft: 6 }}>Visibilité IA mesurée</span>
          </div>
          <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 44, marginTop: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 14 }}>
              <span style={{ fontSize: v.name.length > 28 ? 48 : 60, fontWeight: 700, color: '#1B1F2E', lineHeight: 1.1 }}>{v.name}</span>
              {sub ? <span style={{ fontSize: 28, color: '#5A6275' }}>{sub}</span> : null}
              <span style={{ display: 'flex', alignSelf: 'flex-start', fontSize: 26, fontWeight: 700, color: b.ink, background: b.bg, padding: '8px 20px', borderRadius: 999 }}>{b.label}</span>
              <span style={{ fontSize: 24, color: '#5A6275' }}>
                {`Cité dans ${v.cited} réponse${v.cited > 1 ? 's' : ''} sur ${v.total} · marge d’erreur ${v.rangeLow}–${v.rangeHigh}`}
              </span>
              <span style={{ fontSize: 22, color: '#5A6275' }}>{`Mesuré le ${dateFr(v.measuredAt)}${v.demo ? ' · données de démonstration' : ''}`}</span>
            </div>
            <div style={{ display: 'flex', position: 'relative', width: 290, height: 290, alignItems: 'center', justifyContent: 'center' }}>
              <svg width="290" height="290" viewBox="0 0 300 300" style={{ position: 'absolute', top: 0, left: 0 }}>
                <circle cx="150" cy="150" r="120" fill="none" stroke="#D5D9E4" strokeWidth="28" />
                <circle cx="150" cy="150" r="120" fill="none" stroke={b.color} strokeWidth="28" strokeLinecap="round" strokeDasharray={`${(C * v.score) / 100} ${C}`} transform="rotate(-90 150 150)" />
              </svg>
              <div style={{ display: 'flex', alignItems: 'baseline' }}>
                <span style={{ fontSize: 108, fontWeight: 800, color: '#1B1F2E' }}>{v.score}</span>
                <span style={{ fontSize: 32, color: '#5A6275' }}>/100</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=3600' } },
  );
}
