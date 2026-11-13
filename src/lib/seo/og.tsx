import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { BRAND, SITE_URL } from './site';

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = 'image/png';

type OgFont = { name: string; data: ArrayBuffer; weight: 600 | 700; style: 'normal' };

let fontsPromise: Promise<OgFont[]> | null = null;

/** Polices de marque auto-hébergées (woff, lu par satori). En cas d'échec : police par défaut, l'image reste générée. */
function loadFonts(): Promise<OgFont[]> {
  if (!fontsPromise) {
    const dir = join(process.cwd(), 'node_modules', '@fontsource', 'bricolage-grotesque', 'files');
    const read = async (file: string, weight: 600 | 700): Promise<OgFont | null> => {
      try {
        const b = await readFile(join(dir, file));
        return { name: 'Bricolage Grotesque', data: b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer, weight, style: 'normal' };
      } catch {
        return null;
      }
    };
    fontsPromise = Promise.all([
      read('bricolage-grotesque-latin-700-normal.woff', 700),
      read('bricolage-grotesque-latin-600-normal.woff', 600),
    ]).then((l) => l.filter((f): f is OgFont => !!f));
  }
  return fontsPromise;
}

const host = SITE_URL.replace(/^https?:\/\//, '');

/** Carte Open Graph 1200 × 630 aux couleurs de Repéré. */
export async function ogCard(title: string, kicker = 'Référencement IA (GEO)', footer?: string) {
  const fonts = await loadFonts();
  const family = fonts.length ? 'Bricolage Grotesque' : 'sans-serif';
  const size = title.length > 70 ? 56 : title.length > 45 ? 66 : 76;
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          background: '#1E1A5C',
          backgroundImage: 'radial-gradient(circle at 85% 15%, #3730A3 0%, #1E1A5C 55%)',
          color: '#fff',
          fontFamily: family,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: '#F5A524', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 20, height: 20, borderRadius: 10, background: '#1E1A5C' }} />
          </div>
          <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>{BRAND}</div>
          <div style={{ marginLeft: 18, fontSize: 26, color: '#C9C6F2', fontWeight: 600 }}>{kicker}</div>
        </div>
        <div style={{ display: 'flex', fontSize: size, fontWeight: 700, lineHeight: 1.06, letterSpacing: -2, maxWidth: 1040 }}>{title}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 26, color: '#C9C6F2', fontWeight: 600 }}>
          <div style={{ display: 'flex' }}>{footer ?? 'ChatGPT · Gemini · Perplexity'}</div>
          <div style={{ display: 'flex', color: '#fff' }}>{host}</div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: fonts.length ? fonts : undefined },
  );
}
