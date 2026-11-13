import { describe, expect, it, vi } from 'vitest';

const complete = vi.hoisted(() => vi.fn(async () => ({ session: null, cookies: [], error: 'expired' as const })));
vi.mock('@/lib/auth/magic', async (orig) => ({ ...(await orig<typeof import('@/lib/auth/magic')>()), completeMagicLink: complete }));

import { signValue } from '@/lib/auth/cookies';
import { GET, POST } from '../route';

const hash = 'abcdef0123456789abcdef';
const as = signValue({ k: 'as', email: 'alice@exemple.fr', h: hash.slice(0, 16) });
const link = `http://localhost:3000/connexion/callback?token_hash=${hash}&type=magiclink&as=${encodeURIComponent(as)}&next=%2Fapp%2Fia`;

describe('retour de lien magique token_hash : confirmation avant les cookies', () => {
  it('GET : écran « Continuer en tant que … ? », aucun cookie, jeton non consommé', async () => {
    complete.mockClear();
    const res = await GET(new Request(link));
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Continuer en tant que alice@exemple.fr ?');
    expect(html).toContain('method="post"');
    expect(res.headers.get('set-cookie')).toBeNull();
    expect(complete).not.toHaveBeenCalled();
  });

  it('adresse non signée ou d’un autre jeton : pas affichée', async () => {
    const forged = link.replace(encodeURIComponent(as), encodeURIComponent(signValue({ k: 'as', email: 'eve@x.fr', h: 'autre' })));
    const html = await (await GET(new Request(forged))).text();
    expect(html).toContain('Continuer la connexion ?');
    expect(html).not.toContain('eve@x.fr');
  });

  it('POST même origine : vérifie le lien ; POST d’un site tiers : refusé', async () => {
    complete.mockClear();
    const ok = await POST(new Request(link, { method: 'POST', headers: { origin: 'http://localhost:3000', 'sec-fetch-site': 'same-origin' } }));
    expect(ok.status).toBe(303);
    expect(complete).toHaveBeenCalledTimes(1);
    const bad = await POST(new Request(link, { method: 'POST', headers: { origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' } }));
    expect(bad.status).toBe(403);
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('?code= (PKCE) et ?local= restent traités en GET', async () => {
    complete.mockClear();
    await GET(new Request('http://localhost:3000/connexion/callback?code=xyz'));
    await GET(new Request('http://localhost:3000/connexion/callback?local=abc'));
    expect(complete).toHaveBeenCalledTimes(2);
  });
});
