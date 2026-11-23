import { cookies } from 'next/headers';
import { isAdmin } from '../../data';
import { bookingUrl } from '@/lib/meetings/booking';
import { SEGMENTS, offerLabel, sizeLabel, slotLabel } from '@/lib/meetings/validate';
import { MEETING_STATUSES, listMeetings, meetingStatusLabel, type MeetingRow, type MeetingStatus } from '@/lib/meetings/store';

/** Demandes de démo reçues par /rendez-vous (réservé admin) : statut, créneaux souhaités, notes. */
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin : demandes de démo', robots: { index: false, follow: false } };

const muted = { color: 'var(--muted)' } as const;
const frDateTime = (iso: string) => {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }) : '';
};
const TONE: Record<MeetingStatus, string> = { nouvelle: 'var(--tone-warn)', planifiee: 'var(--primary)', faite: 'var(--tone-up)', annulee: 'var(--muted)' };
const fieldStyle = { minHeight: 40, padding: '0 10px', borderRadius: 'var(--r-md)', border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)' } as const;
const mailState = (s: MeetingRow['notified']) => (s === 'sent' ? 'envoyé' : s === 'logged' ? 'journalisé (pas de clé Resend)' : s === 'error' ? 'en échec' : s === 'suppressed' ? 'bloqué (opposition)' : 'en attente');

function origin(m: MeetingRow): string {
  const a = m.attribution;
  if (!a) return 'inconnue';
  if (a.utmMedium === 'partenaire') return `lien partenaire « ${a.utmCampaign} »`;
  return [a.utmSource && `campagne ${a.utmSource}`, a.referrerHost, a.landing && `arrivée ${a.landing}`].filter(Boolean).join(', ') || 'inconnue';
}

function MeetingCard({ m }: { m: MeetingRow }) {
  const seg = m.segment ? SEGMENTS.find((s) => s.id === m.segment)?.label : null;
  return (
    <li id={m.id} className="ui-card scroll-mt-4 p-4" style={{ borderLeft: `3px solid ${TONE[m.status]}` }}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold">
          {m.company} <span className="ui-small font-normal" style={muted}>({offerLabel(m.offer)}{seg ? `, ${seg}` : ''}, {sizeLabel(m.offer, m.size)})</span>
          <span className="ml-2 ui-caption font-semibold" style={{ color: TONE[m.status] }}>{meetingStatusLabel(m.status)}</span>
        </p>
        <span className="ui-caption" style={muted}>Reçue le {frDateTime(m.receivedAt)}</span>
      </div>
      <p className="ui-small mt-1" style={muted}>
        {m.name}, <a className="rp-link underline" href={`mailto:${m.email.replace(/[?&#\s]/g, '')}?subject=${encodeURIComponent('Votre démo Repéré')}`}>{m.email}</a>
        {m.phone ? `, ${m.phone}` : ''}, <a className="rp-link underline" href={m.website} target="_blank" rel="noopener noreferrer nofollow">{m.domain}</a> · Origine : {origin(m)}
      </p>
      <p className="ui-small mt-2 whitespace-pre-wrap" style={{ overflowWrap: 'anywhere' }}>{m.need}</p>
      <p className="ui-small mt-2">
        <strong>Créneaux souhaités :</strong> {m.slots.length ? m.slots.map(slotLabel).join(' ; ') : '—'}
        {m.otherTimes ? <> · <strong>Disponibilités :</strong> {m.otherTimes}</> : null}
      </p>
      <p className="ui-caption mt-1" style={muted}>E-mail au fondateur : {mailState(m.notified)} · réponse automatique : {mailState(m.acknowledged)}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {MEETING_STATUSES.filter((s) => s.id !== m.status).map((s) => (
          <form key={s.id} method="post" action="/admin/partenaires/rendez-vous/maj">
            <input type="hidden" name="id" value={m.id} />
            <input type="hidden" name="action" value="status" />
            <input type="hidden" name="status" value={s.id} />
            <button className="ui-btn" data-size="sm" data-variant="ghost">Passer en « {s.label} »</button>
          </form>
        ))}
      </div>
      {m.notes.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1">
          {m.notes.map((n) => (
            <li key={n.at} className="ui-small"><span style={muted}>{frDateTime(n.at)} : </span><span className="whitespace-pre-wrap">{n.text}</span></li>
          ))}
        </ul>
      )}
      <form method="post" action="/admin/partenaires/rendez-vous/maj" className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input type="hidden" name="id" value={m.id} />
        <input type="hidden" name="action" value="note" />
        <label className="sr-only" htmlFor={`note-${m.id}`}>Note interne</label>
        <input id={`note-${m.id}`} name="text" maxLength={2000} placeholder="Note interne (créneau confirmé, suite…)" className="flex-1" style={fieldStyle} />
        <button className="ui-btn" data-size="sm">Ajouter la note</button>
      </form>
    </li>
  );
}

export default async function AdminRendezVousPage({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const { erreur } = await searchParams;
  if (!isAdmin((await cookies()).get('admin_token')?.value)) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center p-6" style={{ color: 'var(--ink)' }}>
        <div className="ui-card p-6">
          <h1 className="ui-result" style={{ fontSize: 24 }}>Accès restreint</h1>
          <p className="ui-small mt-1" style={muted}>Connectez-vous d’abord sur l’écran d’administration, puis revenez ici.</p>
          <a href="/admin" className="ui-btn mt-4" data-variant="primary">Aller à la connexion</a>
        </div>
      </main>
    );
  }
  let rows: MeetingRow[] = [];
  let loadError = false;
  try {
    rows = await listMeetings();
  } catch {
    loadError = true;
  }
  const fresh = rows.filter((r) => r.status === 'nouvelle').length;
  const booking = bookingUrl();
  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6" style={{ color: 'var(--ink)' }}>
      <p className="ui-caption font-semibold" style={muted}><a href="/admin" className="underline">Admin</a> · <a href="/admin/partenaires" className="underline">Partenaires</a></p>
      <h1 className="ui-h2 mt-1">Demandes de démo</h1>
      <div className="ui-intro mt-3">
        <p className="ui-result" style={{ color: fresh > 0 ? 'var(--tone-warn)' : 'var(--ink)' }}>
          {fresh > 0 ? `${fresh} demande${fresh > 1 ? 's' : ''} à traiter (réponse promise sous 1 jour ouvré)` : rows.length ? 'Toutes les demandes sont traitées' : 'Aucune demande pour l’instant'}
        </p>
        <p className="ui-body mt-2" style={muted}>
          Agenda en ligne : {booking ? <a className="rp-link underline" href={booking} target="_blank" rel="noopener noreferrer">{booking}</a> : 'non configuré (NEXT_PUBLIC_BOOKING_URL) : chaque demande passe par ce formulaire.'} Les rendez-vous pris directement dans l’agenda n’apparaissent pas ici.
        </p>
      </div>
      {erreur && <p className="ui-small mt-4 font-semibold" role="alert" style={{ color: 'var(--tone-down)' }}>Action refusée : rien n’a été modifié.</p>}
      {loadError ? (
        <p className="ui-small mt-6" role="alert" style={{ color: 'var(--tone-down)' }}>Les demandes n’ont pas pu être chargées. Rechargez la page.</p>
      ) : rows.length === 0 ? (
        <div className="ui-empty mt-6"><p className="font-semibold">Aucune demande</p><p className="ui-small" style={muted}>Les demandes envoyées depuis /rendez-vous arriveront ici, avec un e-mail de notification.</p></div>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">{rows.map((m) => <MeetingCard key={m.id} m={m} />)}</ul>
      )}
    </main>
  );
}
