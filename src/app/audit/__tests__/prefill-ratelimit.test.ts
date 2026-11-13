import { beforeEach, describe, expect, it, vi } from 'vitest';

const hdrs = vi.hoisted(() => ({ current: new Headers() }));
const calls = vi.hoisted(() => [] as { bucket: string; id: string }[]);

vi.mock('next/headers', () => ({ headers: async () => hdrs.current }));
vi.mock('@/lib/ratelimit', async (orig) => {
  const real = await orig<typeof import('@/lib/ratelimit')>();
  return {
    ...real,
    rateLimit: vi.fn(async (bucket: string, id: string) => {
      calls.push({ bucket, id });
      return { ok: false, remaining: 0, retryAfter: 60 };
    }),
  };
});

import { prefillFromSite } from '../actions';

describe('prefillFromSite : limite de débit par getClientIp', () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it('deux adresses IPv6 du même /64 partagent le même compteur', async () => {
    hdrs.current = new Headers({ 'x-forwarded-for': '2001:db8:abcd:12:1::1, 10.0.0.1' });
    await prefillFromSite('paysia.fr');
    hdrs.current = new Headers({ 'x-forwarded-for': '2001:db8:abcd:12:ffff::42' });
    await prefillFromSite('paysia.fr');
    expect(calls).toHaveLength(2);
    expect(calls[0].bucket).toBe('audit-prefill');
    expect(calls[0].id).toBe('2001:db8:abcd:12::/64');
    expect(calls[1].id).toBe(calls[0].id);
  });

  it('limite atteinte : repli sur le nom déduit de l’adresse, sans récupération du site', async () => {
    hdrs.current = new Headers({ 'x-forwarded-for': '203.0.113.7' });
    expect(await prefillFromSite('https://www.plomberie-martin.fr')).toEqual({ businessName: 'Plomberie Martin', from: 'adresse' });
    expect(calls[0].id).toBe('203.0.113.7');
  });
});
