import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const env = process.env as Record<string, string | undefined>;
const DIR = mkdtempSync(path.join(os.tmpdir(), 'repere-newsletter-'));
env.DATA_DIR = DIR;
(globalThis as { __repereDocsDir?: string }).__repereDocsDir = DIR;
delete env.SUPABASE_URL;
delete env.NEXT_PUBLIC_SUPABASE_URL;
delete env.SUPABASE_SERVICE_ROLE_KEY;
delete env.RESEND_API_KEY;
env.NEWSLETTER_SECRET = 'secret-de-test-newsletter';
env.NEXT_PUBLIC_APP_URL = 'https://repere.test';

import { emailId, isEmail, signToken, verifyToken } from '../tokens';
import {
  CONSENT_TEXT,
  confirmSubscription,
  getSubscriber,
  listSubscribers,
  requestSubscription,
  saveIssue,
  subscriberCounts,
  subscribersCsv,
  unsubscribe,
  getIssue,
} from '../store';
import { renderConfirmEmail, renderGuideEmail, renderIssueEmail } from '../emails';
import { draftFromVeille, firstIssueDraft, issueDeadlines, latestEntries, resolveEntries, todayParis } from '../issue';
import { sendNextBatch } from '../batch';
import { createDraft, ensureFirstDraft, parseDraftForm } from '../admin';
import { NEWSLETTER_CONSENT_TEXT } from '../ui/NewsletterForm';

beforeAll(() => {
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
});

describe('jetons', () => {
  it('signent un but précis et une adresse normalisée', () => {
    const t = signToken('nl-confirm', ' Marie@Exemple.FR ');
    expect(verifyToken('nl-confirm', 'marie@exemple.fr', t)).toBe(true);
    expect(verifyToken('nl-unsub', 'marie@exemple.fr', t)).toBe(false);
    expect(verifyToken('nl-confirm', 'autre@exemple.fr', t)).toBe(false);
    expect(verifyToken('nl-confirm', 'marie@exemple.fr', '')).toBe(false);
    expect(verifyToken('nl-confirm', 'marie@exemple.fr', `${t}x`)).toBe(false);
    expect(emailId('A@b.fr')).toBe(emailId(' a@B.FR'));
    expect(isEmail('a@b.fr')).toBe(true);
    expect(isEmail('pas-une-adresse')).toBe(false);
  });
  it('le texte de consentement du formulaire est celui qui est conservé', () => {
    expect(NEWSLETTER_CONSENT_TEXT).toBe(CONSENT_TEXT);
  });
});

describe('double opt-in et désinscription', () => {
  it('inscrit en attente, confirme, ne renvoie pas de confirmation à un abonné actif', async () => {
    const r1 = await requestSubscription('Jean@Exemple.fr', 'veille', '/veille');
    expect(r1.sendConfirmation).toBe(true);
    expect(r1.subscriber.status).toBe('pending');
    expect(r1.subscriber.consentText).toBe(CONSENT_TEXT);
    expect(await confirmSubscription('jean@exemple.fr')).toBe('confirmed');
    expect(await confirmSubscription('jean@exemple.fr')).toBe('already');
    const r2 = await requestSubscription('jean@exemple.fr', 'site');
    expect(r2.sendConfirmation).toBe(false);
    expect((await getSubscriber('jean@exemple.fr'))?.status).toBe('active');
  });
  it('désinscrit, et un vieux lien de confirmation ne réactive pas', async () => {
    await unsubscribe('jean@exemple.fr');
    expect((await getSubscriber('jean@exemple.fr'))?.status).toBe('unsubscribed');
    expect(await confirmSubscription('jean@exemple.fr')).toBe('unknown');
    const r = await requestSubscription('jean@exemple.fr', 'site');
    expect(r.sendConfirmation).toBe(true);
    expect(r.subscriber.status).toBe('pending');
    expect(await confirmSubscription('inconnu@exemple.fr')).toBe('unknown');
  });
  it('exporte un CSV protégé contre les formules', () => {
    const csv = subscribersCsv([
      { email: '=cmd@x.fr', status: 'active', source: 'site', consentText: '', consentAt: '2026-11-23', createdAt: '2026-11-23' },
    ]);
    expect(csv).toContain("'=cmd@x.fr");
    expect(csv.split('\n')[0]).toContain('email,statut,source');
  });
});

describe('e-mails', () => {
  it('confirmation : lien signé, aucune image de suivi', () => {
    const m = renderConfirmEmail('lea@exemple.fr');
    expect(m.html).toContain('/api/newsletter/confirm?e=lea%40exemple.fr&amp;t=');
    expect(m.text).toContain(signToken('nl-confirm', 'lea@exemple.fr'));
    expect(m.html).not.toMatch(/<img/i);
  });
  it('numéro : fiches, échéances, désinscription en un clic, texte échappé', () => {
    const issue = { ...firstIssueDraft(), intro: 'Intro <b>gras</b>\n\nSecond paragraphe' };
    const m = renderIssueEmail({ issue, entries: resolveEntries(issue.entrySlugs), deadlines: issueDeadlines('2026-11-23'), to: 'lea@exemple.fr', base: 'https://repere.test' });
    expect(m.html).toContain('https://repere.test/veille/apercus-ia-mode-ia-france?utm_source=lettre');
    expect(m.html).toContain(`/api/newsletter/unsubscribe?e=lea%40exemple.fr&amp;t=${signToken('nl-unsub', 'lea@exemple.fr')}`);
    expect(m.html).toContain('Intro &lt;b&gt;gras&lt;/b&gt;');
    expect(m.html).toContain('2 décembre 2026');
    expect(m.html).not.toMatch(/<img/i);
    expect(m.text).toContain('Se désinscrire en un clic');
  });
  it('guide : lien de lecture et PDF signés, confirmation de lettre seulement si demandée', () => {
    const a = renderGuideEmail('lea@exemple.fr', { newsletter: false });
    expect(a.html).toContain('/ressources/guide-2027/lire?e=lea%40exemple.fr');
    expect(a.html).toContain('/ressources/guide-2027/pdf?e=');
    expect(a.html).not.toContain('/api/newsletter/confirm');
    const b = renderGuideEmail('lea@exemple.fr', { newsletter: true });
    expect(b.html).toContain('/api/newsletter/confirm');
  });
});

describe('rédaction des numéros', () => {
  it('propose les dernières fiches passées', () => {
    const l = latestEntries('2026-11-23', 5);
    expect(l).toHaveLength(5);
    expect(l.every((e) => e.eventDate <= '2026-11-23')).toBe(true);
    const d = draftFromVeille(2, '2026-11-23');
    expect(d.entrySlugs).toEqual(l.map((e) => e.slug));
    expect(d.status).toBe('draft');
    expect(todayParis(new Date('2026-11-23T23:30:00Z'))).toBe('2026-11-24');
  });
  it('le premier numéro est un brouillon complet, créé une seule fois', async () => {
    const f = firstIssueDraft();
    expect(resolveEntries(f.entrySlugs)).toHaveLength(f.entrySlugs.length);
    await ensureFirstDraft();
    await ensureFirstDraft();
    const one = await getIssue('numero-1');
    expect(one?.status).toBe('draft');
    expect(one?.subject).toBe(f.subject);
  });
  it('valide le formulaire de brouillon', () => {
    expect(parseDraftForm({ subject: '', intro: 'x', entrySlugs: ['ai-act-article-50-transparence'] })).toBeNull();
    expect(parseDraftForm({ subject: 'Objet', intro: 'x', entrySlugs: ['inexistante'] })).toBeNull();
    const ok = parseDraftForm({ subject: ' Objet ', intro: 'a\r\nb', outro: '', entrySlugs: ['ai-act-article-50-transparence', 'ai-act-article-50-transparence'] });
    expect(ok).toEqual({ subject: 'Objet', preheader: '', intro: 'a\nb', outro: '', entrySlugs: ['ai-act-article-50-transparence'] });
  });
});

describe('envoi par lots', () => {
  it('exige la confirmation du nombre, envoie par lots, sans doublon, retente les échecs', async () => {
    for (const e of ['a1@exemple.fr', 'a2@exemple.fr', 'a3@exemple.fr']) {
      await requestSubscription(e, 'site');
      await confirmSubscription(e);
    }
    await requestSubscription('attente@exemple.fr', 'site'); // jamais confirmée : ne reçoit rien
    const issue = await createDraft('2026-11-23');
    const active = subscriberCounts(await listSubscribers()).active;
    expect(active).toBe(3);

    const sent: string[] = [];
    let failOnce = true;
    const send = vi.fn(async ({ to }: { to: string }) => {
      if (to === 'a2@exemple.fr' && failOnce) {
        failOnce = false;
        return { id: null, status: 'error' as const, error: 'boom' };
      }
      sent.push(to);
      return { id: null, status: 'logged' as const };
    });
    const deps = { send, pauseMs: 0, today: () => '2026-11-23' };

    const refused = await sendNextBatch(issue.id, { size: 2, confirmCount: 99 }, deps);
    expect(refused).toMatchObject({ ok: false, reason: 'confirmation', remaining: 3 });
    expect(send).not.toHaveBeenCalled();

    const b1 = await sendNextBatch(issue.id, { size: 2, confirmCount: 3 }, deps);
    expect(b1).toMatchObject({ ok: true, attempted: 2, sent: 1, failed: 1, remaining: 2 });
    expect(b1.issue?.status).toBe('sending');

    const b2 = await sendNextBatch(issue.id, { size: 10, confirmCount: 2 }, deps);
    expect(b2).toMatchObject({ ok: true, sent: 2, failed: 0, remaining: 0 });
    expect(b2.issue?.status).toBe('sent');
    expect([...sent].sort()).toEqual(['a1@exemple.fr', 'a2@exemple.fr', 'a3@exemple.fr']);
    expect(sent).not.toContain('attente@exemple.fr');

    const again = await sendNextBatch(issue.id, { size: 10, confirmCount: 0 }, deps);
    expect(again).toMatchObject({ ok: false, reason: 'deja-envoye' });
  });
  it('refuse un numéro sans destinataire ou introuvable', async () => {
    const t = new Date().toISOString();
    await saveIssue({ ...draftFromVeille(50, '2026-11-23'), id: 'vide', entrySlugs: [], createdAt: t, updatedAt: t });
    expect((await sendNextBatch('vide', { confirmCount: 0 }, { pauseMs: 0 })).reason).toBe('vide');
    expect((await sendNextBatch('absent', { confirmCount: 0 }, { pauseMs: 0 })).reason).toBe('introuvable');
  });
});
