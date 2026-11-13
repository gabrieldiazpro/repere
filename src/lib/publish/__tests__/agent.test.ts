/**
 * Agent automatique (RACCORDS-FINAUX) : brouillons créés après une exploration selon `publish.agent_settings`,
 * jamais appliqués, rythme respecté, notification selon le réglage, désactivable, rien en démo.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { putDoc } from '@/lib/store';
import { AGENT_SETTINGS_COLLECTION, agentRunDue, eligibleFindings, runPublishAgent, type AgentDeps } from '../agent';
import { listChangeSets } from '../service';
import type { PlanSite } from '../planner';
import type { Finding } from '../types';
import { isolateStore } from './helpers';

isolateStore('agent');

const f = (id: string, kind: string, payload: unknown, extra: Partial<Finding> = {}): Finding => ({
  id, category: 'balisage', severity: 'medium', title: `Constat ${id}`, why: '', fix: 'Corriger.', affected: [], affectedCount: 1, impact: 2, effort: 1, autoFix: { kind, payload }, ...extra,
});

const SITE = (businessId: string): PlanSite => ({
  businessId,
  origin: 'https://site.test',
  name: 'Atelier Fictif',
  pages: [{ url: 'https://site.test/', title: 'Accueil', h1: ['Atelier Fictif'], text: 'Atelier Fictif répare les vélos à Lyon.' }],
});

const FINDINGS = [
  f('seo.meta.description.missing', 'meta.description', { url: 'https://site.test/', value: 'Atelier Fictif répare les vélos à Lyon.' }, { impact: 3 }),
  f('seo.robots.block', 'robots.txt', { url: 'https://site.test/robots.txt', value: 'User-agent: *\nAllow: /\n' }),
  { ...f('seo.h1.missing', 'x', null), autoFix: undefined },
];

let sent: { businessId: string; channel: string; title: string }[] = [];
const deps: Partial<AgentDeps> = {
  async notify(businessId, n, channel) {
    sent.push({ businessId, channel, title: n.title });
  },
};

beforeEach(() => {
  sent = [];
  delete process.env.PUBLISH_AGENT_AUTO;
});
afterEach(() => {
  delete process.env.PUBLISH_AGENT_AUTO;
});

describe('agent de publication automatique', () => {
  it('filtre les constats par types autorisés et trie par impact', () => {
    const out = eligibleFindings(FINDINGS, { kinds: ['meta.description'] });
    expect(out.map((x) => x.id)).toEqual(['seo.meta.description.missing']);
    expect(eligibleFindings(FINDINGS, { kinds: ['meta.description', 'robots.txt'] }).map((x) => x.id)).toEqual(['seo.meta.description.missing', 'seo.robots.block']);
  });

  it('rythme : manuel jamais, hebdomadaire au plus une fois par semaine', () => {
    const now = new Date('2026-11-13T10:00:00Z');
    expect(agentRunDue('manual', null, now)).toBe(false);
    expect(agentRunDue('weekly', null, now)).toBe(true);
    expect(agentRunDue('weekly', '2026-11-10T10:00:00Z', now)).toBe(false);
    expect(agentRunDue('weekly', '2026-11-05T10:00:00Z', now)).toBe(true);
    expect(agentRunDue('monthly', '2026-11-01T10:00:00Z', now)).toBe(false);
  });

  it('crée des brouillons (jamais appliqués), notifie, puis respecte le rythme', async () => {
    const b = 'b-agent-1';
    await putDoc(AGENT_SETTINGS_COLLECTION, b, { kinds: ['meta.description'], frequency: 'weekly', notify: 'app' }, b);
    const now = new Date('2026-11-13T10:00:00Z');
    const r = await runPublishAgent(b, { findings: FINDINGS, site: SITE(b), trigger: 'crawl', now, deps });
    expect(r.status).toBe('created');
    const list = await listChangeSets(b);
    expect(list.length).toBe(1);
    expect(list[0].origin.findingId).toBe('seo.meta.description.missing');
    expect(['draft', 'proposed']).toContain(list[0].status);
    expect(list.every((c) => !c.appliedAt && !c.validation)).toBe(true);
    expect(sent).toEqual([{ businessId: b, channel: 'app', title: '1 correction proposée par l’agent, à valider' }]);

    const again = await runPublishAgent(b, { findings: FINDINGS, site: SITE(b), trigger: 'crawl', now: new Date('2026-11-14T10:00:00Z'), deps });
    expect(again).toEqual({ status: 'skipped', reason: 'not_due' });
  });

  it('notification coupée, rythme manuel, désactivation, démo', async () => {
    const b = 'b-agent-2';
    await putDoc(AGENT_SETTINGS_COLLECTION, b, { kinds: ['meta.description'], frequency: 'weekly', notify: 'off' }, b);
    const r = await runPublishAgent(b, { findings: FINDINGS, site: SITE(b), trigger: 'analysis', deps });
    expect(r.status === 'created' && r.notified).toBe('off');
    expect(sent).toEqual([]);

    const m = 'b-agent-3';
    await putDoc(AGENT_SETTINGS_COLLECTION, m, { kinds: ['meta.description'], frequency: 'manual', notify: 'email' }, m);
    expect(await runPublishAgent(m, { findings: FINDINGS, site: SITE(m), trigger: 'crawl', deps })).toEqual({ status: 'skipped', reason: 'manual' });

    process.env.PUBLISH_AGENT_AUTO = '0';
    expect(await runPublishAgent('b-agent-4', { findings: FINDINGS, site: SITE('b-agent-4'), trigger: 'crawl', deps })).toEqual({ status: 'skipped', reason: 'disabled' });
    delete process.env.PUBLISH_AGENT_AUTO;
    expect(await runPublishAgent('demo', { findings: FINDINGS, site: SITE('demo'), trigger: 'crawl', deps })).toEqual({ status: 'skipped', reason: 'demo' });
  });
});
