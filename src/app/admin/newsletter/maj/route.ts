import { NextResponse } from 'next/server';
import { createDraft, parseDraftForm, saveDraftForm } from '@/lib/newsletter/admin';
import { DEFAULT_BATCH, sendNextBatch } from '@/lib/newsletter/batch';
import { issueDeadlines, resolveEntries, todayParis } from '@/lib/newsletter/issue';
import { renderIssueEmail } from '@/lib/newsletter/emails';
import { getIssue } from '@/lib/newsletter/store';
import { isEmail } from '@/lib/newsletter/tokens';
import { sendEmail } from '@/lib/email';
import { adminFromRequest, sameOrigin } from '../_auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /admin/newsletter/maj — formulaires de /admin/newsletter : create | save | test | batch.
 * Aucun envoi sans clic de l'administrateur ; un clic = un lot, après confirmation explicite du nombre de destinataires.
 */
export async function POST(req: Request) {
  if (!adminFromRequest(req)) return new NextResponse('Accès restreint.', { status: 403 });
  if (!sameOrigin(req)) return new NextResponse('Origine refusée.', { status: 403 });
  const form = await req.formData().catch(() => null);
  const action = String(form?.get('action') ?? '');
  let id = String(form?.get('id') ?? '');
  const back = new URL('/admin/newsletter', req.url);
  try {
    if (action === 'create') {
      id = (await createDraft()).id;
      back.searchParams.set('ok', 'cree');
    } else if (action === 'save') {
      const parsed = parseDraftForm({
        subject: form?.get('subject'),
        preheader: form?.get('preheader'),
        intro: form?.get('intro'),
        outro: form?.get('outro'),
        entrySlugs: form?.getAll('entry'),
      });
      const saved = parsed ? await saveDraftForm(id, parsed) : null;
      back.searchParams.set(saved ? 'ok' : 'erreur', saved ? 'enregistre' : 'brouillon');
    } else if (action === 'test') {
      const to = String(form?.get('to') ?? '').trim();
      const issue = await getIssue(id);
      if (!issue || !isEmail(to)) back.searchParams.set('erreur', 'test');
      else {
        const m = renderIssueEmail({ issue, entries: resolveEntries(issue.entrySlugs), deadlines: issueDeadlines(todayParis()), to });
        const r = await sendEmail({ to, subject: `[TEST] ${m.subject}`, html: m.html, text: m.text, kind: 'transactional', tags: [{ name: 'type', value: 'newsletter-test' }] });
        back.searchParams.set(r.status === 'error' ? 'erreur' : 'ok', r.status === 'error' ? 'test' : r.status === 'logged' ? 'test-journal' : 'test');
      }
    } else if (action === 'batch') {
      if (form?.get('confirm') !== 'oui') back.searchParams.set('erreur', 'confirmation');
      else {
        const size = Number(form?.get('size') ?? DEFAULT_BATCH);
        const confirmCount = Number(form?.get('confirmCount') ?? -1);
        const r = await sendNextBatch(id, { size, confirmCount });
        if (!r.ok) back.searchParams.set('erreur', r.reason ?? 'lot');
        else {
          back.searchParams.set('ok', 'lot');
          back.searchParams.set('envoyes', String(r.sent));
          back.searchParams.set('echecs', String(r.failed));
          back.searchParams.set('reste', String(r.remaining));
        }
      }
    } else {
      back.searchParams.set('erreur', 'action');
    }
  } catch (e) {
    console.error('[admin/newsletter/maj]', e);
    back.searchParams.set('erreur', 'serveur');
  }
  if (id) back.searchParams.set('numero', id);
  return NextResponse.redirect(back, 303);
}
