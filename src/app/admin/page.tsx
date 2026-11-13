import { cookies } from 'next/headers';
import { AuditButton } from './AuditButton';
import { funnel, isAdmin, loadLeads } from './data';
import { loadContactMessages, type ContactMessageRow } from './messages';

const frDateTime = (iso: string) => {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }) : '';
};

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin prospection', robots: { index: false, follow: false } };

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const { erreur } = await searchParams;
  // Jeton uniquement via le cookie HttpOnly posé par POST /admin/login (jamais ?token=, qa/securite.md M3).
  const authed = isAdmin((await cookies()).get('admin_token')?.value);
  if (!authed) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center p-6" style={{ color: 'var(--ink)' }}>
        <div className="ui-card p-6">
          <h1 className="ui-result" style={{ fontSize: 24 }}>Accès restreint</h1>
          <p className="ui-small mt-1" style={{ color: 'var(--muted)' }}>Entrez le jeton administrateur pour voir les leads et les messages.</p>
          {erreur && (
            <p className="ui-small mt-3 font-semibold" role="alert" style={{ color: 'var(--tone-down)' }}>
              Jeton incorrect. Vérifiez-le et réessayez.
            </p>
          )}
          <form method="post" action="/admin/login" className="mt-4 flex flex-col gap-2">
            <label htmlFor="admin-token" className="ui-small font-semibold">Jeton administrateur</label>
            <input id="admin-token" name="token" type="password" autoComplete="current-password" required style={{ minHeight: 44, padding: '0 12px', borderRadius: 'var(--r-md)', border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)' }} />
            <button className="ui-btn mt-2" data-variant="primary">Entrer</button>
          </form>
        </div>
      </main>
    );
  }
  const rows = loadLeads();
  let messages: ContactMessageRow[] = [];
  let messagesError = false;
  try {
    messages = await loadContactMessages();
  } catch {
    messagesError = true;
  }
  const open = messages.filter((m) => !m.answered).length;
  const f = funnel(rows);
  const exportHref = '/admin/export';
  const counters: [string, string | number][] = [
    ['Leads', f.leads], ['E-mail générique renseigné', f.withEmail], ['Audités', f.audited],
    ['E-mails préparés', f.emailsPrepared], ['Score moyen', f.avgScore ?? 'n/a'],
  ];
  const resultat = open > 0 ? `${open} message${open > 1 ? 's' : ''} à traiter` : rows.length ? `${f.audited} prospect${f.audited > 1 ? 's' : ''} audité${f.audited > 1 ? 's' : ''} sur ${f.leads}` : 'Aucun lead pour l’instant';
  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-6" style={{ color: 'var(--ink)' }}>
      <p className="ui-caption font-semibold" style={{ color: 'var(--muted)' }}>Admin</p>
      <h1 className="ui-h2 mt-1">Prospection : leads et audits</h1>
      <div className="ui-intro mt-3">
        <p className="ui-result" style={{ color: open > 0 ? 'var(--tone-warn)' : 'var(--ink)' }}>{resultat}</p>
        <p className="ui-body mt-2" style={{ color: 'var(--muted)' }}>Données lues dans .data/ (leads, audits, e-mails préparés). Aucun envoi depuis cette page.</p>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          {open > 0 ? <a href="#messages" className="ui-btn" data-variant="primary">Traiter les messages</a> : null}
          <a href={exportHref} className="ui-btn" data-variant={open > 0 ? 'ghost' : undefined}>Exporter en CSV</a>
        </div>
      </div>
      <dl className="ui-cascade mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {counters.map(([label, v]) => (
          <div key={label} className="ui-card p-4">
            <dd className="ui-figure-sm rp-num">{v}</dd>
            <dt className="ui-caption mt-1" style={{ color: 'var(--muted)' }}>{label}</dt>
          </div>
        ))}
      </dl>
      <section id="messages" className="mt-8 scroll-mt-4" aria-labelledby="messages-h">
        <h2 id="messages-h" className="ui-h2">
          Messages du formulaire de contact <span className="ui-small font-normal" style={{ color: 'var(--muted)' }}>({open} à traiter sur {messages.length})</span>
        </h2>
        {erreur === 'message' && <p className="ui-small mt-1" role="alert" style={{ color: 'var(--tone-down)' }}>Message introuvable : rien n’a été modifié.</p>}
        {messagesError ? (
          <p className="ui-small mt-2" role="alert" style={{ color: 'var(--tone-down)' }}>Les messages n’ont pas pu être chargés. Rechargez la page.</p>
        ) : messages.length === 0 ? (
          <div className="ui-empty mt-3"><p className="font-semibold">Aucun message</p><p className="ui-small" style={{ color: 'var(--muted)' }}>Les messages envoyés depuis /contact arriveront ici.</p></div>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {messages.map((m) => (
              <li key={m.id} className="ui-card p-4" data-tone={m.answered ? undefined : 'warn'} style={{ opacity: m.answered ? 0.75 : 1, borderLeft: m.answered ? undefined : '3px solid var(--tone-warn-solid)' }}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold">
                    {m.subject || 'Sans objet'}
                    {m.answered && <span className="ui-badge ml-2" data-tone="up" style={{ background: 'var(--tone-up-bg)', color: 'var(--tone-up)', padding: '1px 6px', borderRadius: 'var(--r-xs)', fontSize: 12 }}>✓ répondu{m.answeredAt ? ` le ${frDateTime(m.answeredAt)}` : ''}</span>}
                  </p>
                  <span className="ui-caption" style={{ color: 'var(--muted)' }}>Reçu le {frDateTime(m.receivedAt)}</span>
                </div>
                <p className="ui-small mt-1" style={{ color: 'var(--muted)' }}>
                  {[m.name, m.company].filter(Boolean).join(', ')}
                  {(m.name || m.company) && ', '}
                  <a className="rp-link underline" href={`mailto:${m.email.replace(/[?&#\s]/g, "")}?subject=${encodeURIComponent(`Re : ${m.subject || 'votre message à Repéré'}`)}`}>{m.email}</a>
                </p>
                <p className="ui-small mt-2 whitespace-pre-wrap" style={{ overflowWrap: 'anywhere' }}>{m.message}</p>
                <form method="post" action="/admin/messages" className="mt-3">
                  <input type="hidden" name="id" value={m.id} />
                  <input type="hidden" name="answered" value={m.answered ? '0' : '1'} />
                  <button className="ui-btn" data-size="sm" data-variant={m.answered ? 'ghost' : undefined}>
                    {m.answered ? 'Marquer comme non répondu' : 'Marquer comme répondu'}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
      <h2 className="ui-h2 mt-8">Leads</h2>
      <div className="ui-card mt-3 overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead style={{ background: 'var(--surface-2)' }}>
            <tr>{['Nom', 'Métier', 'CP', 'Site', 'Score', 'Concurrents cités', 'Rapport', 'Action'].map((h) => <th key={h} scope="col" className="ui-caption p-3 font-semibold" style={{ color: 'var(--muted)' }}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={8} className="p-4" style={{ color: 'var(--muted)' }}>Aucun lead. Lancez scripts/build-leads.ts.</td></tr>}
            {rows.map((r) => (
              <tr key={r.siret || r.nom} className="border-t" style={{ borderColor: 'var(--hair)' }}>
                <td className="p-3 font-medium">{r.nom}{r.ei === 'oui' && <span className="ml-1 text-xs" style={{ color: 'var(--tone-warn)' }}>EI</span>}</td>
                <td className="p-3">{r.metier}</td>
                <td className="p-3 rp-num">{r.code_postal}</td>
                <td className="p-3">{/^https?:\/\//i.test(r.site ?? '') ? <a className="underline" href={r.site} target="_blank" rel="noopener noreferrer">site</a> : ''}</td>
                <td className="p-3 rp-num">{r.score ? `${r.score}/100` : ''}</td>
                <td className="p-3">{r.concurrents}</td>
                <td className="p-3">{r.rapport_url ? <a className="underline" href={`/rapport/${r.audit_id}`}>Ouvrir</a> : ''}</td>
                <td className="p-3">{r.audit_id ? '' : <AuditButton nom={r.nom} metier={r.metier} codePostal={r.code_postal} site={r.site} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
