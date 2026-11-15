import { cookies } from 'next/headers';
import { isAdmin } from '../data';
import { PILOT_SEGMENT_SHORT, PILOT_SLOTS } from '@/lib/pilots/validate';
import { PILOT_STATUSES, listPilots, seatsTaken, statusLabel, type PilotRow, type PilotStatus } from '@/lib/pilots/store';
import { trackingFor, type PilotTracking } from '@/lib/pilots/measures';

/**
 * Candidatures au programme pilote (réservé admin) : statut, notes internes, rattachement à l'espace Repéré et
 * suivi avant / après (J0, J30, J90) tiré des vraies mesures de l'espace (src/lib/pilots/measures.ts).
 */
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin : entreprises pilotes', robots: { index: false, follow: false } };

const muted = { color: 'var(--muted)' } as const;
const frDate = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' }) : '—';
};
const frDateTime = (iso: string) => {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }) : '';
};
const TONE: Record<PilotStatus, string> = { a_etudier: 'var(--tone-warn)', retenue: 'var(--primary)', refusee: 'var(--muted)', active: 'var(--tone-up)' };
const ERRORS: Record<string, string> = {
  status: 'Statut non modifié : candidature introuvable ou statut inconnu.',
  note: 'Note non ajoutée : texte vide ou candidature introuvable.',
  link: 'Rattachement refusé : identifiant d’espace (lettres, chiffres, - et _) ou date (AAAA-MM-JJ) invalide.',
};
const fieldStyle = { minHeight: 40, padding: '0 10px', borderRadius: 'var(--r-md)', border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)' } as const;

function signed(n: number | null) {
  if (n === null) return '—';
  return `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n)}`;
}

function Tracking({ t }: { t: PilotTracking }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="ui-caption mb-1 text-left" style={muted}>
          Mesures réelles de l’espace : {t.siteCount} analyse{t.siteCount > 1 ? 's' : ''} du site, {t.aiCount} audit{t.aiCount > 1 ? 's' : ''} IA
        </caption>
        <thead>
          <tr>{['Jalon', 'Date cible', 'Note globale', 'SEO', 'GEO', 'Score IA (fourchette)'].map((h) => <th key={h} scope="col" className="ui-caption p-2 font-semibold" style={muted}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {t.milestones.map((m) => (
            <tr key={m.id} className="border-t" style={{ borderColor: 'var(--hair)' }}>
              <th scope="row" className="p-2 font-semibold">{m.label}</th>
              <td className="p-2">{frDate(m.target)}</td>
              {m.state === 'mesure' ? (
                <>
                  <td className="p-2 rp-num">{m.site?.global ?? '—'}</td>
                  <td className="p-2 rp-num">{m.site?.seo ?? '—'}</td>
                  <td className="p-2 rp-num">{m.site?.geo ?? '—'}</td>
                  <td className="p-2 rp-num">
                    {m.ai ? `${m.ai.score}${m.ai.low !== null && m.ai.high !== null ? ` (${m.ai.low}–${m.ai.high})` : ''}${m.ai.demo ? ' démo' : ''}` : '—'}
                  </td>
                </>
              ) : (
                <td colSpan={4} className="p-2" style={{ color: m.state === 'manquante' ? 'var(--tone-down)' : 'var(--muted)' }}>
                  {m.state === 'manquante' ? 'Aucune mesure dans la fenêtre : jalon manquant (rien n’est estimé).' : 'À venir'}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {t.delta ? (
        <p className="ui-small mt-2">
          Écart {t.delta.from.toUpperCase()} → {t.delta.to.toUpperCase()} : note globale {signed(t.delta.global)}, score IA {signed(t.delta.ai)}
          {t.delta.aiBeyondMargin === true ? ' : au-delà des marges d’erreur (les fourchettes ne se recouvrent pas).' : t.delta.aiBeyondMargin === false ? ' : dans les marges d’erreur, ce n’est pas un progrès démontré.' : '.'}
        </p>
      ) : null}
    </div>
  );
}

function PilotCard({ p, t }: { p: PilotRow; t: PilotTracking | null }) {
  return (
    <li id={p.id} className="ui-card scroll-mt-4 p-4" style={{ borderLeft: `3px solid ${TONE[p.status]}` }}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold">
          {p.company} <span className="ui-small font-normal" style={muted}>({PILOT_SEGMENT_SHORT[p.segment]}{p.city ? `, ${p.city}` : ''})</span>
          <span className="ml-2 ui-caption font-semibold" style={{ color: TONE[p.status] }}>{statusLabel(p.status)}</span>
        </p>
        <span className="ui-caption" style={muted}>Reçue le {frDateTime(p.receivedAt)}{p.notified === 'error' ? ' · notification en échec' : ''}</span>
      </div>
      <p className="ui-small mt-1" style={muted}>
        {p.name}{p.role ? `, ${p.role}` : ''}, <a className="rp-link underline" href={`mailto:${p.email.replace(/[?&#\s]/g, '')}?subject=${encodeURIComponent('Votre candidature pilote Repéré')}`}>{p.email}</a>,{' '}
        <a className="rp-link underline" href={p.website} target="_blank" rel="noopener noreferrer nofollow">{p.domain}</a>
        {' · '}Avant/après publiable : <strong style={{ color: 'var(--ink)' }}>{p.publishOk ? 'oui' : 'non'}</strong>
      </p>
      <p className="ui-small mt-2 whitespace-pre-wrap" style={{ overflowWrap: 'anywhere' }}>{p.motivation}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        {PILOT_STATUSES.filter((s) => s.id !== p.status).map((s) => (
          <form key={s.id} method="post" action="/admin/pilotes/maj">
            <input type="hidden" name="id" value={p.id} />
            <input type="hidden" name="action" value="status" />
            <input type="hidden" name="status" value={s.id} />
            <button className="ui-btn" data-size="sm" data-variant="ghost">Passer en « {s.label} »</button>
          </form>
        ))}
      </div>

      {p.notes.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1">
          {p.notes.map((n) => (
            <li key={n.at} className="ui-small"><span style={muted}>{frDateTime(n.at)} : </span><span className="whitespace-pre-wrap">{n.text}</span></li>
          ))}
        </ul>
      )}
      <form method="post" action="/admin/pilotes/maj" className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input type="hidden" name="id" value={p.id} />
        <input type="hidden" name="action" value="note" />
        <label className="sr-only" htmlFor={`note-${p.id}`}>Note interne</label>
        <input id={`note-${p.id}`} name="text" maxLength={2000} placeholder="Note interne (appel, décision, retour…)" className="flex-1" style={fieldStyle} />
        <button className="ui-btn" data-size="sm">Ajouter la note</button>
      </form>

      {(p.status === 'retenue' || p.status === 'active') && (
        <div className="mt-4 border-t pt-3" style={{ borderColor: 'var(--hair)' }}>
          <p className="font-semibold">Suivi avant / après</p>
          <form method="post" action="/admin/pilotes/maj" className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
            <input type="hidden" name="id" value={p.id} />
            <input type="hidden" name="action" value="link" />
            <label className="ui-small flex flex-col gap-1">Identifiant de l’espace Repéré
              <input name="businessId" defaultValue={p.businessId ?? ''} placeholder="ex. 3f2c…" style={fieldStyle} />
            </label>
            <label className="ui-small flex flex-col gap-1">Date de J0
              <input name="startDate" type="date" defaultValue={p.startedAt ? p.startedAt.slice(0, 10) : ''} style={fieldStyle} />
            </label>
            <button className="ui-btn" data-size="sm">Enregistrer</button>
          </form>
          {t ? (
            <Tracking t={t} />
          ) : (
            <p className="ui-small mt-2" style={muted}>
              {!p.businessId ? 'Rattachez l’espace Repéré du pilote pour afficher ses mesures.' : 'Fixez la date de J0 (posée automatiquement au passage en « Active »).'}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

export default async function AdminPilotesPage({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const { erreur } = await searchParams;
  const authed = isAdmin((await cookies()).get('admin_token')?.value);
  if (!authed) {
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
  let rows: PilotRow[] = [];
  let loadError = false;
  try {
    rows = await listPilots();
  } catch {
    loadError = true;
  }
  const tracking = new Map<string, PilotTracking | null>();
  await Promise.all(
    rows
      .filter((p) => p.status === 'retenue' || p.status === 'active')
      .map(async (p) => tracking.set(p.id, await trackingFor(p.businessId, p.startedAt).catch(() => null))),
  );
  const count = (s: PilotStatus) => rows.filter((r) => r.status === s).length;
  const toReview = count('a_etudier');
  const taken = seatsTaken(rows);
  const resultat = toReview > 0 ? `${toReview} candidature${toReview > 1 ? 's' : ''} à étudier` : rows.length ? `${taken} place${taken > 1 ? 's' : ''} attribuée${taken > 1 ? 's' : ''} sur ${PILOT_SLOTS}` : 'Aucune candidature pour l’instant';

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6" style={{ color: 'var(--ink)' }}>
      <p className="ui-caption font-semibold" style={muted}><a href="/admin" className="underline">Admin</a></p>
      <h1 className="ui-h2 mt-1">Entreprises pilotes</h1>
      <div className="ui-intro mt-3">
        <p className="ui-result" style={{ color: toReview > 0 ? 'var(--tone-warn)' : 'var(--ink)' }}>{resultat}</p>
        <p className="ui-body mt-2" style={muted}>
          Candidatures reçues par /pilotes. Le compteur public affiche les places « Retenue » et « Active ». Les scores J0, J30, J90 viennent des mesures de l’espace rattaché.
        </p>
      </div>
      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {PILOT_STATUSES.map((s) => (
          <div key={s.id} className="ui-card p-4">
            <dd className="ui-figure-sm rp-num">{count(s.id)}</dd>
            <dt className="ui-caption mt-1" style={muted}>{s.label}</dt>
          </div>
        ))}
      </dl>
      {erreur && <p className="ui-small mt-4 font-semibold" role="alert" style={{ color: 'var(--tone-down)' }}>{ERRORS[erreur] ?? 'Action refusée : rien n’a été modifié.'}</p>}
      {loadError ? (
        <p className="ui-small mt-6" role="alert" style={{ color: 'var(--tone-down)' }}>Les candidatures n’ont pas pu être chargées. Rechargez la page.</p>
      ) : rows.length === 0 ? (
        <div className="ui-empty mt-6"><p className="font-semibold">Aucune candidature</p><p className="ui-small" style={muted}>Les candidatures envoyées depuis /pilotes arriveront ici, avec un e-mail de notification.</p></div>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {rows.map((p) => <PilotCard key={p.id} p={p} t={tracking.get(p.id) ?? null} />)}
        </ul>
      )}
    </main>
  );
}
