import { describe, expect, it } from 'vitest';
import { newNonce, nonceCsp, wantsNonceCsp } from '@/lib/csp';

describe('CSP à nonce', () => {
  it('seulement sur les routes dynamiques', () => {
    for (const p of ['/app', '/app/ia', '/bienvenue', '/connexion', '/connexion/callback', '/inscription', '/r/abc']) expect(wantsNonceCsp(p, {})).toBe(true);
    for (const p of ['/', '/tarifs', '/application', '/app/hors-ligne', '/rapport/x', '/r']) expect(wantsNonceCsp(p, {})).toBe(false);
  });
  it('désactivable', () => {
    expect(wantsNonceCsp('/app', { CSP_NONCE: 'off' })).toBe(false);
    expect(wantsNonceCsp('/app', { CSP_DISABLE: '1' })).toBe(false);
  });
  it('politique : nonce, strict-dynamic, images https (marque blanche), pas de unsafe-inline pour les scripts', () => {
    const n = newNonce();
    const csp = nonceCsp(n, { dev: false, supabaseUrl: 'https://x.supabase.co/' });
    expect(csp).toContain(`'nonce-${n}'`);
    expect(csp).toContain("'strict-dynamic'");
    expect(csp).toContain('img-src \'self\' data: blob: https:');
    expect(csp).toContain('wss://x.supabase.co');
    expect(/script-src[^;]*unsafe-inline/.test(csp)).toBe(false);
    expect(csp).not.toContain('unsafe-eval');
  });
});
