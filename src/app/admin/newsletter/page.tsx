import Link from 'next/link';
import { cookies } from 'next/headers';
import { isAdmin } from '../data';
import { ensureFirstDraft } from '@/lib/newsletter/admin';
import { DEFAULT_BATCH, MAX_BATCH, pendingRecipients } from '@/lib/newsletter/batch';
import { getIssue, listDownloads, listIssues, listSubscribers, subscriberCounts, type NewsletterIssue } from '@/lib/newsletter/store';
import { isEmailEnabled } from '@/lib/email';
import { renderIssueEmail } from '@/lib/newsletter/emails';
import { issueDeadlines, resolveEntries, todayParis } from '@/lib/newsletter/issue';
import { STATUS_LABEL, frDate, sortedEntries } from '@/lib/veille';

/**
 * Lettre mensuelle (réservé admin) : abonnés, export, rédaction d'un numéro à partir des fiches de veille, aperçu,
 * envoi de test, envoi par lots. Aucun envoi automatique : chaque lot part sur un clic confirmé.
 */
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin : lettre mensuelle', robots: { index: false, follow: false } };

const muted = { color: 'var(--muted)' } as const;
const field = { minHeight: 40, padding: '8px 10px', borderRadius: 'var(--r-md)', border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', width: '100%' } as const;
const dt = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }) : '—';
};

const OK: Record<string, string> = {
  cree: 'Brouillon créé à partir des dernières fiches de veille. Relisez-le avant tout envoi.',
  enregistre: 'Brouillon enregistré.',
  test: 'E-mail de test envoyé.',
  'test-journal': 'E-mail de test journalisé dans la console du serveur (pas de clé d’envoi configurée).',
  lot: 'Lot envoyé.',
};
const ERR: Record<string, string> = {
  brouillon: 'Brouillon non enregistré : objet, introduction et au moins une fiche sont obligatoires, et un numéro déjà en cours d’envoi n’est plus modifiable.',
  test: 'Test non envoyé : adresse invalide, numéro introuvable ou erreur d’envoi.',
  confirmation: 'Rien n’est parti : cochez la case de confirmation, et vérifiez que le nombre de destinataires n’a pas changé.',
  'aucun-destinataire': 'Rien n’est parti : aucun abonné confirmé n’attend ce numéro.',
  'deja-envoye': 'Ce numéro a déjà été envoyé à tous les abonnés.',
  vide: 'Ce numéro ne contient aucune fiche.',
  introuvable: 'Numéro introuvable.',
  serveur: 'Erreur serveur : rien n’a été modifié. Consultez les journaux.',
  action: 'Action inconnue.',
};
const ISSUE_STATUS: Record<NewsletterIssue['status'], string> = { draft: 'Brouillon', sending: 'Envoi en cours', sent: 'Envoyé' };

export default async function AdminNewsletter({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const authed = isAdmin((await cookies()).get('admin_token')?.value);
  if (!authed) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center p-6" style={{ color: 'var(--ink)' }}>
        <div className="ui-card p-6">
          <h1 className="ui-result" style={{ fontSize: 24 }}>Accès restreint</h1>
          <p className="ui-small mt-1" style={muted}>Connectez-vous depuis <a href="/admin" className="underline">l’administration</a>.</p>
        </div>
      </main>
    );
  }

  await ensureFirstDraft();
  const [subs, issues, downloads] = await Promise.all([listSubscribers(), listIssues(), listDownloads()]);
  const counts = subscriberCounts(subs);
  const current = (sp.numero ? await getIssue(sp.numero) : null) ?? issues[0] ?? null;
  const pending = current ? (await pendingRecipients(current.id)).length : 0;
  const entries = sortedEntries();
  const selected = new Set(current?.entrySlugs ?? []);
  const recent = [...subs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 50);
  const editable = current?.status === 'draft';
  const previewHtml = current
    ? renderIssueEmail({ issue: current, entries: resolveEntries(current.entrySlugs), deadlines: issueDeadlines(todayParis()), to: 'apercu@exemple.fr' }).html
    : '';

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-6" style={{ color: 'var(--ink)' }}>
      <p className="ui-caption font-semibold" style={muted}><a href="/admin" className="underline">Admin</a></p>
      <h1 className="ui-h2 mt-1">Lettre mensuelle</h1>
      <div className="ui-intro mt-3">
        <p className="ui-result">{counts.active} abonné{counts.active > 1 ? 's' : ''} confirmé{counts.active > 1 ? 's' : ''}</p>
        <p className="ui-body mt-2" style={muted}>
          Double opt-in : seules les adresses confirmées reçoivent la lettre. Aucun envoi automatique.
          {isEmailEnabled() ? '' : ' Pas de clé Resend : les envois sont journalisés dans la console, pas envoyés.'}
        </p>
      </div>

      {sp.ok && OK[sp.ok] ? (
        <p role="status" className="mt-4 rounded-lg p-3 font-semibold" style={{ background: 'var(--success-bg)', color: 'var(--success-ink)' }}>
          ✓ {OK[sp.ok]}
          {sp.ok === 'lot' ? ` ${sp.envoyes ?? 0} envoyé(s), ${sp.echecs ?? 0} échec(s), ${sp.reste ?? 0} restant(s).` : ''}
        </p>
      ) : null}
      {sp.erreur ? (
        <p role="alert" className="mt-4 rounded-lg p-3 font-semibold" style={{ background: 'var(--danger-bg)', color: 'var(--danger-ink)' }}>
          ! {ERR[sp.erreur] ?? 'Action refusée.'}
        </p>
      ) : null}

      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([['Confirmés', counts.active], ['En attente de confirmation', counts.pending], ['Désinscrits', counts.unsubscribed], ['Guides 2027 demandés', downloads.length]] as const).map(([l, v]) => (
          <div key={l} className="ui-card p-4">
            <dd className="ui-figure-sm rp-num">{v}</dd>
            <dt className="ui-caption mt-1" style={muted}>{l}</dt>
          </div>
        ))}
      </dl>

      {/* ------------------------------ numéros ------------------------------ */}
      <section className="mt-10" aria-labelledby="numeros-h">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="numeros-h" className="ui-h2">Numéros</h2>
          <form method="post" action="/admin/newsletter/maj">
            <input type="hidden" name="action" value="create" />
            <button className="ui-btn" data-variant="ghost">Nouveau brouillon à partir des dernières fiches</button>
          </form>
        </div>
        <ul className="mt-3 flex flex-wrap gap-2">
          {issues.map((i) => (
            <li key={i.id}>
              <a href={`/admin/newsletter?numero=${encodeURIComponent(i.id)}`} className="ui-card inline-block px-3 py-2 text-sm" style={i.id === current?.id ? { outline: '2px solid var(--primary)' } : undefined}>
                N° {i.number} · {ISSUE_STATUS[i.status]} · {i.sentCount} envoyé(s)
              </a>
            </li>
          ))}
        </ul>
      </section>

      {current ? (
        <section className="mt-6 grid gap-6 lg:grid-cols-2" aria-label={`Numéro ${current.number}`}>
          <div className="ui-card p-4 sm:p-5">
            <h3 className="text-lg font-semibold">N° {current.number} : {ISSUE_STATUS[current.status]}</h3>
            <p className="ui-small mt-1" style={muted}>Modifié le {dt(current.updatedAt)}{current.lastBatchAt ? ` · dernier lot le ${dt(current.lastBatchAt)}` : ''}</p>
            <form method="post" action="/admin/newsletter/maj" className="mt-4 space-y-3">
              <input type="hidden" name="action" value="save" />
              <input type="hidden" name="id" value={current.id} />
              <fieldset disabled={!editable} className="space-y-3">
                <label className="block"><span className="ui-small font-semibold">Objet</span>
                  <input name="subject" defaultValue={current.subject} maxLength={160} required style={field} /></label>
                <label className="block"><span className="ui-small font-semibold">Texte d’aperçu (préheader)</span>
                  <input name="preheader" defaultValue={current.preheader} maxLength={200} style={field} /></label>
                <label className="block"><span className="ui-small font-semibold">Introduction (paragraphes séparés par une ligne vide)</span>
                  <textarea name="intro" defaultValue={current.intro} rows={10} required style={field} /></label>
                <fieldset>
                  <legend className="ui-small font-semibold">Fiches de veille reprises (10 au plus)</legend>
                  <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto rounded-md border p-2" style={{ borderColor: 'var(--line)' }}>
                    {entries.map((e) => (
                      <li key={e.slug}>
                        <label className="flex items-start gap-2 text-sm">
                          <input type="checkbox" name="entry" value={e.slug} defaultChecked={selected.has(e.slug)} className="mt-1" />
                          <span>{frDate(e.eventDate)} · {STATUS_LABEL[e.status]} · {e.title}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </fieldset>
                <label className="block"><span className="ui-small font-semibold">Conclusion</span>
                  <textarea name="outro" defaultValue={current.outro} rows={5} style={field} /></label>
                {editable ? <button className="ui-btn" data-variant="primary">Enregistrer le brouillon</button> : <p className="ui-small" style={muted}>Ce numéro n’est plus modifiable (envoi commencé).</p>}
              </fieldset>
            </form>
          </div>

          <div className="space-y-6">
            <div className="ui-card p-4 sm:p-5">
              <h3 className="text-lg font-semibold">Aperçu</h3>
              <p className="ui-small mt-1" style={muted}>Rendu exact de l’e-mail (destinataire fictif). <a className="underline" href={`/admin/newsletter/apercu?id=${encodeURIComponent(current.id)}`} target="_blank" rel="noopener">Ouvrir en plein écran</a></p>
              <iframe title={`Aperçu du numéro ${current.number}`} srcDoc={previewHtml} className="mt-3 h-[28rem] w-full rounded-md border bg-white" style={{ borderColor: 'var(--line)' }} sandbox="" />
            </div>

            <div className="ui-card p-4 sm:p-5">
              <h3 className="text-lg font-semibold">Envoyer un test</h3>
              <form method="post" action="/admin/newsletter/maj" className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input type="hidden" name="action" value="test" />
                <input type="hidden" name="id" value={current.id} />
                <label className="sr-only" htmlFor="nl-test">Adresse de test</label>
                <input id="nl-test" name="to" type="email" placeholder="vous@exemple.fr" required style={field} />
                <button className="ui-btn shrink-0">Envoyer le test</button>
              </form>
            </div>

            <div className="ui-card p-4 sm:p-5">
              <h3 className="text-lg font-semibold">Envoi par lots</h3>
              {current.status === 'sent' ? (
                <p className="mt-2">Envoyé à tous les abonnés confirmés le {dt(current.sentAt)} ({current.sentCount} envoi(s), {current.failedCount} échec(s)).</p>
              ) : pending === 0 ? (
                <p className="mt-2">Aucun abonné confirmé n’attend ce numéro.</p>
              ) : (
                <form method="post" action="/admin/newsletter/maj" className="mt-3 space-y-3">
                  <input type="hidden" name="action" value="batch" />
                  <input type="hidden" name="id" value={current.id} />
                  <input type="hidden" name="confirmCount" value={pending} />
                  <p><strong className="rp-num">{pending}</strong> abonné{pending > 1 ? 's' : ''} confirmé{pending > 1 ? 's' : ''} n’{pending > 1 ? 'ont' : 'a'} pas encore reçu ce numéro.</p>
                  <label className="block"><span className="ui-small font-semibold">Taille du lot</span>
                    <select name="size" defaultValue={String(DEFAULT_BATCH)} style={field}>
                      {[10, 25, 50, 100, MAX_BATCH].map((n) => <option key={n} value={n}>{n} destinataires</option>)}
                    </select>
                  </label>
                  <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" name="confirm" value="oui" required className="mt-1" />
                    <span>J’ai relu l’aperçu et je confirme l’envoi du lot suivant de ce numéro aux abonnés confirmés.</span>
                  </label>
                  <button className="ui-btn" data-variant="primary">Envoyer le lot suivant</button>
                </form>
              )}
            </div>
          </div>
        </section>
      ) : null}

      {/* ------------------------------ abonnés ------------------------------ */}
      <section className="mt-10" aria-labelledby="abonnes-h">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="abonnes-h" className="ui-h2">Abonnés <span className="ui-small font-normal" style={muted}>({subs.length} adresse{subs.length > 1 ? 's' : ''}, 50 plus récentes affichées)</span></h2>
          <a href="/admin/newsletter/export" className="ui-btn">Exporter en CSV</a>
        </div>
        {recent.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr style={muted}><th className="p-2">Adresse</th><th className="p-2">Statut</th><th className="p-2">Source</th><th className="p-2">Inscription</th><th className="p-2">Confirmation</th></tr></thead>
              <tbody>
                {recent.map((s) => (
                  <tr key={s.id} className="border-t" style={{ borderColor: 'var(--line)' }}>
                    <td className="p-2">{s.email}</td>
                    <td className="p-2">{s.status === 'active' ? 'Confirmé' : s.status === 'pending' ? 'En attente' : 'Désinscrit'}</td>
                    <td className="p-2">{s.source}{s.page ? ` (${s.page})` : ''}</td>
                    <td className="p-2">{dt(s.createdAt)}</td>
                    <td className="p-2">{dt(s.confirmedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3">Aucun abonné pour l’instant. Le formulaire est sur <Link href="/veille" className="underline">/veille</Link> et <Link href="/veille/lettre" className="underline">/veille/lettre</Link>.</p>
        )}
      </section>
    </main>
  );
}
