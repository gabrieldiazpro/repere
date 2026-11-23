import { cookies } from 'next/headers';
import { isAdmin } from '../data';
import { SITE_URL } from '@/lib/seo/site';
import { FAMILIES, COMMISSION_BASIS, commissionLabel } from '@/lib/partners/program';
import { audienceLabel } from '@/lib/partners/validate';
import { referralLink } from '@/lib/partners/codes';
import { eur } from '@/lib/partners/commission';
import { PARTNER_STATUSES, listPartners, partnerStatusLabel, type PartnerRow, type PartnerStatus } from '@/lib/partners/store';
import { loadTrackingInputs, orphanCodes, trackPartner, type PartnerTracking } from '@/lib/partners/tracking';

/**
 * Programme partenaires (réservé admin) : candidatures, statut, code de parrainage, conditions, annuaire, et suivi :
 * inscriptions attribuées (origine `?ref=` enregistrée), offre actuelle des espaces, paiements Stripe enregistrés et
 * commission due. Aucun paiement automatique : les versements sont saisis à la main après virement.
 */
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin : partenaires', robots: { index: false, follow: false } };

const muted = { color: 'var(--muted)' } as const;
const frDate = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Paris' }) : '—';
};
const TONE: Record<PartnerStatus, string> = { a_etudier: 'var(--tone-warn)', accepte: 'var(--tone-up)', refuse: 'var(--muted)', suspendu: 'var(--tone-down)' };
const ERRORS: Record<string, string> = {
  status: 'Statut non modifié : candidature introuvable ou statut inconnu.',
  note: 'Note non ajoutée : texte vide ou candidature introuvable.',
  code: 'Code refusé : 3 à 30 caractères (minuscules, chiffres, tirets), pas « rep-… », non déjà pris, partenaire accepté ou suspendu.',
  terms: 'Conditions refusées : taux de 0 à 50 %, durée de 1 à 36 mois (entier).',
  listed: 'Publication refusée : le partenaire doit être accepté ET avoir donné son accord pour l’annuaire.',
  payout: 'Versement refusé : montant en euros, supérieur à 0.',
  withdraw: 'Retrait impossible : partenaire introuvable.',
};
const fieldStyle = { minHeight: 40, padding: '0 10px', borderRadius: 'var(--r-md)', border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)' } as const;

function Hidden({ id, action }: { id: string; action: string }) {
  return (
    <>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="action" value={action} />
    </>
  );
}

function TrackingBlock({ p, t }: { p: PartnerRow; t: PartnerTracking }) {
  const c = t.commission;
  return (
    <div className="mt-4 border-t pt-3" style={{ borderColor: 'var(--hair)' }}>
      <p className="font-semibold">Suivi du lien</p>
      <dl className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          ['Analyses', String(t.analyses)],
          ['Audits', String(t.audits)],
          ['Inscriptions', String(t.signups.length)],
          ['Offre payante en cours', String(t.subscribed)],
          ['Clients ayant payé', String(c.payingClients)],
        ].map(([k, v]) => (
          <div key={k}>
            <dd className="ui-figure-sm rp-num">{v}</dd>
            <dt className="ui-caption" style={muted}>{k}</dt>
          </div>
        ))}
      </dl>
      {t.signups.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="ui-caption mb-1 text-left" style={muted}>Espaces créés depuis le lien</caption>
            <thead>
              <tr>{['Inscription', 'Espace', 'Offre actuelle', 'Contact'].map((h) => <th key={h} scope="col" className="ui-caption p-2 font-semibold" style={muted}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {t.signups.map((s) => (
                <tr key={s.businessId} className="border-t" style={{ borderColor: 'var(--hair)' }}>
                  <td className="p-2">{frDate(s.signedUpAt)}</td>
                  <td className="p-2">{s.name ?? <span style={muted}>{s.businessId}</span>}</td>
                  <td className="p-2">{s.planId ?? s.plan ?? '—'}</td>
                  <td className="p-2" style={{ overflowWrap: 'anywhere' }}>{s.contactEmail ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        {[
          ['Base retenue (HT)', eur(c.baseCents)],
          ['Commission acquise', eur(c.earnedCents)],
          ['Déjà versée', eur(c.paidOutCents)],
          ['Due', eur(c.dueCents)],
        ].map(([k, v], i) => (
          <div key={k} className="ui-card p-3" style={i === 3 && c.dueCents > 0 ? { borderLeft: '3px solid var(--tone-warn)' } : undefined}>
            <p className="ui-figure-sm rp-num">{v}</p>
            <p className="ui-caption" style={muted}>{k}</p>
          </div>
        ))}
      </div>
      <p className="ui-caption mt-2" style={muted}>
        Conditions : {commissionLabel(p.commission)}. {COMMISSION_BASIS} Remboursements non déduits automatiquement : vérifiez dans Stripe avant de verser.
      </p>
      {c.lines.length > 0 ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="ui-caption mb-1 text-left" style={muted}>Factures Stripe payées enregistrées</caption>
            <thead>
              <tr>{['Payée le', 'Facture', 'Payé TTC', 'HT', 'Commission', 'Remarque'].map((h) => <th key={h} scope="col" className="ui-caption p-2 font-semibold" style={muted}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {c.lines.map((l) => (
                <tr key={l.invoiceId} className="border-t" style={{ borderColor: 'var(--hair)' }}>
                  <td className="p-2">{frDate(l.paidAt)}</td>
                  <td className="p-2" style={{ overflowWrap: 'anywhere' }}>{l.invoiceId}</td>
                  <td className="p-2 rp-num">{eur(l.amountPaidCents)}</td>
                  <td className="p-2 rp-num">{eur(l.amountExclTaxCents)}</td>
                  <td className="p-2 rp-num">{l.eligible ? eur(l.commissionCents) : '—'}</td>
                  <td className="p-2" style={{ color: l.eligible ? 'var(--muted)' : 'var(--tone-warn)' }}>{l.reason ?? 'Retenue'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="ui-small mt-2" style={muted}>Aucun paiement enregistré pour ce lien : aucune commission.</p>
      )}
      {(p.payouts ?? []).length > 0 && (
        <ul className="mt-3 flex flex-col gap-1">
          {p.payouts.map((x) => (
            <li key={x.at} className="ui-small"><span style={muted}>Versé le {frDate(x.at)} : </span><strong className="rp-num">{eur(x.cents)}</strong>{x.note ? ` (${x.note})` : ''}</li>
          ))}
        </ul>
      )}
      <form method="post" action="/admin/partenaires/maj" className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
        <Hidden id={p.id} action="payout" />
        <label className="ui-small flex flex-col gap-1">Versement fait (€)
          <input name="euros" inputMode="decimal" required placeholder="ex. 120,50" style={{ ...fieldStyle, width: 140 }} />
        </label>
        <label className="ui-small flex flex-1 flex-col gap-1">Référence (facture du partenaire, virement)
          <input name="note" maxLength={300} style={fieldStyle} />
        </label>
        <button className="ui-btn" data-size="sm">Enregistrer le versement</button>
      </form>
    </div>
  );
}

function PartnerCard({ p, t }: { p: PartnerRow; t: PartnerTracking | null }) {
  const fam = FAMILIES[p.family];
  return (
    <li id={p.id} className="ui-card scroll-mt-4 p-4" style={{ borderLeft: `3px solid ${TONE[p.status]}` }}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold">
          {p.company} <span className="ui-small font-normal" style={muted}>({fam.short}{p.city ? `, ${p.city}` : ''})</span>
          <span className="ml-2 ui-caption font-semibold" style={{ color: TONE[p.status] }}>{partnerStatusLabel(p.status)}</span>
        </p>
        <span className="ui-caption" style={muted}>Reçue le {frDate(p.receivedAt)}{p.notified === 'error' ? ' · notification en échec' : ''}</span>
      </div>
      <p className="ui-small mt-1" style={muted}>
        {p.name}{p.role ? `, ${p.role}` : ''}, <a className="rp-link underline" href={`mailto:${p.email.replace(/[?&#\s]/g, '')}?subject=${encodeURIComponent('Votre candidature partenaire Repéré')}`}>{p.email}</a>,{' '}
        <a className="rp-link underline" href={p.website} target="_blank" rel="noopener noreferrer nofollow">{p.domain}</a>
        {' · '}Public : {audienceLabel(p.audience)} · Annuaire : <strong style={{ color: 'var(--ink)' }}>{p.listOk ? (p.listed ? 'publié' : 'accord donné, non publié') : 'pas d’accord'}</strong>
      </p>
      <p className="ui-small mt-2 whitespace-pre-wrap" style={{ overflowWrap: 'anywhere' }}>{p.message}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        {PARTNER_STATUSES.filter((s) => s.id !== p.status).map((s) => (
          <form key={s.id} method="post" action="/admin/partenaires/maj">
            <Hidden id={p.id} action="status" />
            <input type="hidden" name="status" value={s.id} />
            <button className="ui-btn" data-size="sm" data-variant="ghost">Passer en « {s.label} »</button>
          </form>
        ))}
        {p.status === 'accepte' && p.listOk && (
          <form method="post" action="/admin/partenaires/maj">
            <Hidden id={p.id} action="listed" />
            <input type="hidden" name="listed" value={p.listed ? '0' : '1'} />
            <button className="ui-btn" data-size="sm" data-variant="ghost">{p.listed ? 'Retirer de l’annuaire' : 'Publier dans l’annuaire'}</button>
          </form>
        )}
        {p.listOk && (
          <form method="post" action="/admin/partenaires/maj">
            <Hidden id={p.id} action="withdraw" />
            <button className="ui-btn" data-size="sm" data-variant="ghost" title="À la demande du partenaire">Retirer l’accord annuaire</button>
          </form>
        )}
      </div>

      {p.code && (
        <div className="mt-4 border-t pt-3" style={{ borderColor: 'var(--hair)' }}>
          <p className="font-semibold">Lien de parrainage</p>
          <p className="ui-small mt-1" style={{ overflowWrap: 'anywhere' }}><code>{referralLink(SITE_URL, p.code)}</code></p>
          <p className="ui-caption mt-1" style={muted}>Le code s’ajoute à n’importe quelle page : {referralLink(SITE_URL, p.code, '/analyse')}</p>
          <div className="mt-2 flex flex-col gap-3 lg:flex-row">
            <form method="post" action="/admin/partenaires/maj" className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <Hidden id={p.id} action="code" />
              <label className="ui-small flex flex-col gap-1">Code
                <input name="code" defaultValue={p.code} pattern="[a-z0-9]+(-[a-z0-9]+)*" minLength={3} maxLength={30} style={fieldStyle} />
              </label>
              <button className="ui-btn" data-size="sm">Changer le code</button>
            </form>
            <form method="post" action="/admin/partenaires/maj" className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <Hidden id={p.id} action="terms" />
              <label className="ui-small flex flex-col gap-1">Taux (%)
                <input name="rate" inputMode="decimal" defaultValue={p.commission ? String(Math.round(p.commission.rate * 1000) / 10) : '0'} style={{ ...fieldStyle, width: 90 }} />
              </label>
              <label className="ui-small flex flex-col gap-1">Durée (mois)
                <input name="months" inputMode="numeric" defaultValue={String(p.commission?.months ?? fam.commission?.months ?? 12)} style={{ ...fieldStyle, width: 90 }} />
              </label>
              <button className="ui-btn" data-size="sm">Enregistrer les conditions</button>
            </form>
          </div>
          <p className="ui-caption mt-1" style={muted}>Changer un code déjà diffusé coupe l’attribution des liens existants. Proposition de la famille : {commissionLabel(fam.commission)}.</p>
        </div>
      )}

      {t && <TrackingBlock p={p} t={t} />}

      {p.notes.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1">
          {p.notes.map((n) => (
            <li key={n.at} className="ui-small"><span style={muted}>{frDate(n.at)} : </span><span className="whitespace-pre-wrap">{n.text}</span></li>
          ))}
        </ul>
      )}
      <form method="post" action="/admin/partenaires/maj" className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Hidden id={p.id} action="note" />
        <label className="sr-only" htmlFor={`note-${p.id}`}>Note interne</label>
        <input id={`note-${p.id}`} name="text" maxLength={2000} placeholder="Note interne (appel, accord signé, conditions…)" className="flex-1" style={fieldStyle} />
        <button className="ui-btn" data-size="sm">Ajouter la note</button>
      </form>
    </li>
  );
}

export default async function AdminPartenairesPage({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
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
  let rows: PartnerRow[] = [];
  let loadError = false;
  try {
    rows = await listPartners();
  } catch {
    loadError = true;
  }
  const inputs = await loadTrackingInputs();
  const tracking = new Map<string, PartnerTracking | null>();
  await Promise.all(rows.filter((p) => p.code).map(async (p) => tracking.set(p.id, await trackPartner(p, inputs).catch(() => null))));
  const orphans = orphanCodes(inputs.byCode, rows);
  const count = (s: PartnerStatus) => rows.filter((r) => r.status === s).length;
  const toReview = count('a_etudier');
  const all = [...tracking.values()].filter((t): t is PartnerTracking => !!t);
  const signups = all.reduce((s, t) => s + t.signups.length, 0);
  const due = all.reduce((s, t) => s + t.commission.dueCents, 0);
  const resultat = toReview > 0 ? `${toReview} candidature${toReview > 1 ? 's' : ''} à étudier` : rows.length ? `${count('accepte')} partenaire${count('accepte') > 1 ? 's' : ''} accepté${count('accepte') > 1 ? 's' : ''}` : 'Aucune candidature pour l’instant';

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6" style={{ color: 'var(--ink)' }}>
      <p className="ui-caption font-semibold" style={muted}><a href="/admin" className="underline">Admin</a> · <a href="/admin/partenaires/rendez-vous" className="underline">Demandes de démo</a></p>
      <h1 className="ui-h2 mt-1">Partenaires</h1>
      <div className="ui-intro mt-3">
        <p className="ui-result" style={{ color: toReview > 0 ? 'var(--tone-warn)' : 'var(--ink)' }}>{resultat}</p>
        <p className="ui-body mt-2" style={muted}>
          Candidatures reçues par /partenaires. L’acceptation attribue un code (lien <code>?ref=</code>) et les conditions proposées pour la famille. Inscriptions et paiements viennent des origines et des factures Stripe réellement enregistrées. Aucun versement automatique.
        </p>
      </div>
      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['À étudier', String(toReview)],
          ['Acceptés', String(count('accepte'))],
          ['Inscriptions attribuées', String(signups)],
          ['Commission due', eur(due)],
        ].map(([k, v]) => (
          <div key={k} className="ui-card p-4">
            <dd className="ui-figure-sm rp-num">{v}</dd>
            <dt className="ui-caption mt-1" style={muted}>{k}</dt>
          </div>
        ))}
      </dl>
      {erreur && <p className="ui-small mt-4 font-semibold" role="alert" style={{ color: 'var(--tone-down)' }}>{ERRORS[erreur] ?? 'Action refusée : rien n’a été modifié.'}</p>}
      {orphans.length > 0 && (
        <p className="ui-small mt-4" style={muted}>
          Codes vus sans partenaire : {orphans.map((o) => `${o.code} (${o.count})`).join(', ')}. Lien mal recopié, ou code changé après diffusion.
        </p>
      )}
      {loadError ? (
        <p className="ui-small mt-6" role="alert" style={{ color: 'var(--tone-down)' }}>Les candidatures n’ont pas pu être chargées. Rechargez la page.</p>
      ) : rows.length === 0 ? (
        <div className="ui-empty mt-6"><p className="font-semibold">Aucune candidature</p><p className="ui-small" style={muted}>Les candidatures envoyées depuis /partenaires arriveront ici, avec un e-mail de notification.</p></div>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {rows.map((p) => <PartnerCard key={p.id} p={p} t={tracking.get(p.id) ?? null} />)}
        </ul>
      )}
    </main>
  );
}
