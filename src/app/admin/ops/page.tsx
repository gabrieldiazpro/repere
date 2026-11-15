import { cookies } from 'next/headers';
import { isAdminToken } from '@/lib/adminAuth';
import { jobStats } from '@/lib/jobs';
import {
  ALERT_LABEL,
  COST_LABEL,
  IMPACT_LABEL,
  SERVICES,
  dailyCosts,
  droppedErrors,
  errorsLast24h,
  gatherHealth,
  guardState,
  isPausedState,
  listErrorGroups,
  listHeartbeats,
  listIncidents,
  listOpsAlerts,
  opsConfig,
  type CostSource,
  type Level,
} from '@/lib/ops';

/**
 * Tableau de bord des opérations (réservé admin, cookie admin_token posé par /admin/login) : santé, coûts du jour
 * et garde-fou, erreurs regroupées, file de tâches, alertes envoyées, incidents publics (/statut).
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
export const metadata = { title: 'Admin : opérations', robots: { index: false, follow: false } };

const muted = { color: 'var(--muted)' } as const;
const eur = (n: number) => `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const frDateTime = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }) : '—';
};
const LEVEL: Record<Level, { label: string; tone: string }> = {
  ok: { label: 'OK', tone: 'var(--tone-up)' },
  warn: { label: 'À surveiller', tone: 'var(--tone-warn)' },
  fail: { label: 'En échec', tone: 'var(--tone-down)' },
};
const CHECK_LABEL: Record<string, string> = { db: 'Base de données', env: 'Configuration', jobs: 'File de tâches', cron: 'Worker (cron)' };
const SOURCE_LABEL: Record<string, string> = { server: 'Serveur', client: 'Navigateur', job: 'Tâche', webhook: 'Webhook', cron: 'Cron' };

async function safe<T>(fn: () => Promise<T>, def: T): Promise<{ v: T; failed: boolean }> {
  try {
    return { v: await fn(), failed: false };
  } catch {
    return { v: def, failed: true };
  }
}

function Badge({ level }: { level: Level }) {
  return (
    <span className="ui-caption font-semibold" style={{ color: LEVEL[level].tone }}>
      ● {LEVEL[level].label}
    </span>
  );
}

const field = { minHeight: 44, padding: '0 12px', borderRadius: 'var(--r-md)', border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', width: '100%' } as const;

export default async function OpsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  if (!isAdminToken((await cookies()).get('admin_token')?.value)) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center p-6" style={{ color: 'var(--ink)' }}>
        <div className="ui-card p-6">
          <h1 className="ui-result" style={{ fontSize: 24 }}>Accès restreint</h1>
          <p className="ui-small mt-1" style={muted}>Connectez-vous d’abord sur la page d’administration, puis revenez ici.</p>
          <a href="/admin" className="ui-btn mt-4" data-variant="primary">Se connecter</a>
        </div>
      </main>
    );
  }

  const now = new Date();
  const cfg = opsConfig();
  const [health, costs, guard, errors, err24, alerts, incidents, beats, stats] = await Promise.all([
    safe(() => gatherHealth(now), null),
    safe(() => dailyCosts({ now }), null),
    safe(() => guardState(), null),
    safe(() => listErrorGroups(40), []),
    safe(() => errorsLast24h(now), 0),
    safe(() => listOpsAlerts(20), []),
    safe(() => listIncidents(90, now), []),
    safe(() => listHeartbeats(), []),
    safe(() => jobStats(), null),
  ]);
  const h = health.v;
  const c = costs.v;
  const paused = guard.v ? isPausedState(guard.v, now) : false;
  const overridden = guard.v?.pausedDay && guard.v.overrideDay === guard.v.pausedDay;
  const open = incidents.v.filter((i) => i.status === 'en_cours');
  const status: Level = h?.status ?? 'fail';
  const headline =
    status === 'fail' ? 'Au moins une vérification est en échec' : paused ? 'Plafond de coût atteint : tâches non urgentes en pause' : status === 'warn' ? 'Tout fonctionne, avec des points à surveiller' : 'Tout fonctionne';

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-6" style={{ color: 'var(--ink)' }}>
      <p className="ui-caption font-semibold" style={muted}>
        <a href="/admin" className="underline">Admin</a> › Opérations
      </p>
      <h1 className="ui-h2 mt-1">Opérations</h1>
      <div className="ui-intro mt-3">
        <p className="ui-result" style={{ color: LEVEL[paused && status === 'ok' ? 'warn' : status].tone }}>{headline}</p>
        <p className="ui-body mt-2" style={muted}>
          Mesuré le {frDateTime(now.toISOString())}. Alertes e-mail : {cfg.alertEmail ? `activées (${cfg.alertEmail.replace(/^(.).*(@.*)$/, '$1***$2')})` : 'ALERT_EMAIL non renseignée, alertes seulement listées ici'}.
          {open.length ? ` ${open.length} incident${open.length > 1 ? 's' : ''} affiché${open.length > 1 ? 's' : ''} sur /statut.` : ''}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a href="#incidents" className="ui-btn" data-variant="primary">Déclarer un incident</a>
          <a href="/statut" className="ui-btn" data-variant="ghost">Voir la page /statut</a>
          <a href="/api/health/deep" className="ui-btn" data-variant="ghost">Contrôle approfondi (JSON)</a>
        </div>
      </div>

      {/* Santé */}
      <section className="mt-8" aria-labelledby="sante-h">
        <h2 id="sante-h" className="ui-h2">Santé</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {h ? (
            (Object.entries(h.checks) as [string, Level][]).map(([k, l]) => (
              <div key={k} className="ui-card p-4">
                <dt className="ui-caption" style={muted}>{CHECK_LABEL[k] ?? k}</dt>
                <dd className="mt-1"><Badge level={l} /></dd>
              </div>
            ))
          ) : (
            <p className="ui-small" role="alert" style={{ color: 'var(--tone-down)' }}>Santé illisible.</p>
          )}
        </dl>
        {h ? (
          <ul className="ui-small mt-3 space-y-1" style={muted}>
            <li>Base : {h.detail.db.backend === 'supabase' ? `Supabase${h.detail.db.ms !== undefined ? `, ${h.detail.db.ms} ms` : ''}` : 'mémoire (démo)'}{h.detail.db.error ? ` — ${h.detail.db.error}` : ''}</li>
            <li>IA configurées : {h.configured.aiCount ? Object.entries(h.configured.ai).filter(([, v]) => v).map(([k]) => k).join(', ') : 'aucune (audits simulés)'} · Stripe {h.configured.stripe ? 'oui' : 'non'} · Resend {h.configured.resend ? 'oui' : 'non'} · Sentry {h.configured.sentry ? 'oui' : 'non'}</li>
            {h.detail.env.errors.map((e) => <li key={e} style={{ color: 'var(--tone-down)' }}>{e}</li>)}
            {h.detail.env.warnings.slice(0, 6).map((w) => <li key={w}>{w}</li>)}
          </ul>
        ) : null}
      </section>

      {/* Coûts */}
      <section id="couts" className="mt-8 scroll-mt-4" aria-labelledby="couts-h">
        <h2 id="couts-h" className="ui-h2">Coûts estimés du jour</h2>
        {sp.garde ? <p className="ui-small mt-1" role="status">{sp.garde === 'override' ? 'Pause levée pour aujourd’hui.' : 'Garde-fou rétabli.'}</p> : null}
        {c ? (
          <div className="ui-card mt-3 p-4">
            <p className="ui-result rp-num" style={{ color: c.over ? 'var(--tone-down)' : 'var(--ink)' }}>
              {eur(c.totalEur)} <span className="ui-small font-normal" style={muted}>{c.capEur > 0 ? `sur un plafond de ${eur(c.capEur)} (${Math.round((c.ratio ?? 0) * 100)} %)` : 'aucun plafond (OPS_DAILY_COST_CAP_EUR=0)'}</span>
            </p>
            <ul className="ui-small mt-2 grid gap-1 sm:grid-cols-5">
              {(Object.keys(c.bySource) as CostSource[]).map((k) => (
                <li key={k}>
                  <span style={muted}>{COST_LABEL[k]}</span> <span className="rp-num font-semibold">{eur(c.bySource[k])}</span>
                  {c.unreadable.includes(k) ? <span style={{ color: 'var(--tone-warn)' }}> (illisible)</span> : null}
                </li>
              ))}
            </ul>
            <p className="ui-caption mt-2" style={muted}>Estimations à partir des compteurs internes (pas des factures des fournisseurs). Jour de Paris.</p>
            <div className="mt-3 border-t pt-3" style={{ borderColor: 'var(--hair)' }}>
              {paused ? (
                <>
                  <p className="ui-small font-semibold" style={{ color: 'var(--tone-warn)' }}>
                    Tâches non urgentes en pause depuis {frDateTime(guard.v?.since)} ({guard.v?.deferred ?? 0} reportée{(guard.v?.deferred ?? 0) > 1 ? 's' : ''} à demain). Les audits payés, webhooks et tâches prioritaires continuent.
                  </p>
                  <form method="post" action="/api/ops/guard" className="mt-2">
                    <input type="hidden" name="action" value="override" />
                    <button className="ui-btn" data-size="sm">Lever la pause pour aujourd’hui</button>
                  </form>
                </>
              ) : overridden ? (
                <form method="post" action="/api/ops/guard" className="flex flex-wrap items-center gap-3">
                  <p className="ui-small">Pause levée par l’admin pour aujourd’hui.</p>
                  <input type="hidden" name="action" value="restore" />
                  <button className="ui-btn" data-size="sm" data-variant="ghost">Rétablir le garde-fou</button>
                </form>
              ) : (
                <p className="ui-small" style={muted}>
                  Garde-fou {cfg.pauseOnCap ? 'actif' : 'désactivé (OPS_PAUSE_ON_CAP=off)'} : au-delà du plafond, les tâches non urgentes attendent le lendemain.
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="ui-small mt-2" role="alert" style={{ color: 'var(--tone-down)' }}>Coûts illisibles.</p>
        )}
      </section>

      {/* Tâches */}
      <section className="mt-8" aria-labelledby="taches-h">
        <h2 id="taches-h" className="ui-h2">Tâches de fond</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {([
            ['En attente', stats.v?.queued],
            ['En cours', stats.v?.running],
            ['Abandonnées', stats.v?.dead],
            ['Plus ancienne en attente', stats.v?.oldestQueuedMin === null || stats.v?.oldestQueuedMin === undefined ? '—' : `${stats.v.oldestQueuedMin} min`],
            ['Dernier worker', h?.cron.lastWorkerAt ? frDateTime(h.cron.lastWorkerAt) : 'jamais'],
          ] as [string, string | number | undefined][]).map(([label, v]) => (
            <div key={label} className="ui-card p-4">
              <dd className="ui-figure-sm rp-num">{v ?? '—'}</dd>
              <dt className="ui-caption mt-1" style={muted}>{label}</dt>
            </div>
          ))}
        </dl>
        {beats.v.length ? (
          <p className="ui-small mt-2" style={muted}>
            Derniers passages : {beats.v.map((b) => `${b.name} ${frDateTime(b.at)}${b.ok ? '' : ' (échec)'}`).join(' · ')}
          </p>
        ) : null}
      </section>

      {/* Erreurs */}
      <section className="mt-8" aria-labelledby="erreurs-h">
        <h2 id="erreurs-h" className="ui-h2">
          Erreurs <span className="ui-small font-normal" style={muted}>({err24.v} sur 24 h{droppedErrors() ? `, ${droppedErrors()} ignorées par cette instance pendant une rafale` : ''})</span>
        </h2>
        <div className="ui-card mt-3 overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead style={{ background: 'var(--surface-2)' }}>
              <tr>{['Erreur', 'Origine', 'Route', 'Nombre', 'Première', 'Dernière'].map((t) => <th key={t} scope="col" className="ui-caption p-3 font-semibold" style={muted}>{t}</th>)}</tr>
            </thead>
            <tbody>
              {errors.v.length === 0 && <tr><td colSpan={6} className="p-4" style={muted}>{errors.failed ? 'Erreurs illisibles.' : 'Aucune erreur enregistrée.'}</td></tr>}
              {errors.v.map((e) => (
                <tr key={e.signature} className="border-t align-top" style={{ borderColor: 'var(--hair)' }}>
                  <td className="p-3" style={{ maxWidth: 420 }}>
                    <details>
                      <summary className="cursor-pointer font-medium" style={{ overflowWrap: 'anywhere' }}>{e.name} : {e.message}</summary>
                      <pre className="ui-caption mt-2 whitespace-pre-wrap" style={{ ...muted, overflowWrap: 'anywhere' }}>{[e.event && `événement ${e.event}`, e.release && `version ${e.release}`, e.lastDigest && `digest ${e.lastDigest}`, e.lastStack].filter(Boolean).join('\n')}</pre>
                    </details>
                  </td>
                  <td className="p-3">{SOURCE_LABEL[e.source] ?? e.source}</td>
                  <td className="p-3" style={{ overflowWrap: 'anywhere' }}>{e.route ?? '—'}</td>
                  <td className="p-3 rp-num font-semibold">{e.count}</td>
                  <td className="p-3">{frDateTime(e.firstAt)}</td>
                  <td className="p-3">{frDateTime(e.lastAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Alertes */}
      <section className="mt-8" aria-labelledby="alertes-h">
        <h2 id="alertes-h" className="ui-h2">Alertes</h2>
        <p className="ui-small mt-1" style={muted}>Au plus une alerte par type et par heure. Seuils : {cfg.errorSpikePerHour} erreurs/heure, {cfg.deadJobsAlert} tâche(s) abandonnée(s), worker silencieux plus de {cfg.cronMaxAgeMin} min.</p>
        {alerts.v.length === 0 ? (
          <div className="ui-empty mt-3"><p className="font-semibold">Aucune alerte</p></div>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {alerts.v.map((a) => (
              <li key={`${a.at}-${a.kind}`} className="ui-card p-3">
                <p className="ui-small"><span className="font-semibold">{ALERT_LABEL[a.kind]}</span> · {frDateTime(a.at)} · {a.status === 'sent' ? 'e-mail envoyé' : a.status === 'logged' ? 'journalisée (Resend absent)' : a.status === 'no_recipient' ? 'sans destinataire' : `échec d’envoi${a.error ? ` : ${a.error}` : ''}`}</p>
                <p className="ui-caption mt-1" style={muted}>{a.lines.join(' ')}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Incidents */}
      <section id="incidents" className="mt-8 scroll-mt-4" aria-labelledby="incidents-h">
        <h2 id="incidents-h" className="ui-h2">Incidents publics</h2>
        {sp.incident ? (
          <p className="ui-small mt-1" role="status" style={{ color: sp.incident === 'erreur' || sp.incident === 'introuvable' ? 'var(--tone-down)' : 'var(--tone-up)' }}>
            {{ cree: 'Incident déclaré, visible sur /statut.', resolu: 'Incident résolu.', 'mis-a-jour': 'Mise à jour publiée.', introuvable: 'Incident introuvable.', erreur: sp.message ?? 'Erreur.' }[sp.incident] ?? ''}
          </p>
        ) : null}
        <form method="post" action="/api/ops/incidents" className="ui-card mt-3 grid gap-3 p-4">
          <input type="hidden" name="action" value="create" />
          <p className="font-semibold">Déclarer un incident</p>
          <label className="ui-small font-semibold" htmlFor="inc-title">Titre public</label>
          <input id="inc-title" name="title" required minLength={4} maxLength={140} placeholder="Ex. : analyses ralenties" style={field} />
          <label className="ui-small font-semibold" htmlFor="inc-impact">Impact</label>
          <select id="inc-impact" name="impact" defaultValue="mineur" style={field}>
            {(Object.keys(IMPACT_LABEL) as (keyof typeof IMPACT_LABEL)[]).map((k) => <option key={k} value={k}>{IMPACT_LABEL[k]}</option>)}
          </select>
          <fieldset>
            <legend className="ui-small font-semibold">Services touchés</legend>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-2">
              {(Object.keys(SERVICES) as (keyof typeof SERVICES)[]).map((k) => (
                <label key={k} className="ui-small flex items-center gap-2" style={{ minHeight: 44 }}>
                  <input type="checkbox" name="services" value={k} /> {SERVICES[k]}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="ui-small font-semibold" htmlFor="inc-text">Message public (facultatif)</label>
          <textarea id="inc-text" name="text" maxLength={1000} rows={3} placeholder="Ce que vous constatez et ce qui est fait. Sans promesse de délai que vous ne tiendrez pas." style={{ ...field, padding: 12 }} />
          <button className="ui-btn" data-variant="primary">Publier sur /statut</button>
        </form>
        <ul className="mt-3 flex flex-col gap-3">
          {incidents.v.map((i) => (
            <li key={i.id} className="ui-card p-4" style={{ borderLeft: i.status === 'en_cours' ? '3px solid var(--tone-warn-solid)' : undefined }}>
              <p className="font-semibold">{i.title} <span className="ui-caption font-normal" style={muted}>· {IMPACT_LABEL[i.impact]} · {i.services.map((s) => SERVICES[s]).join(', ')} · {i.status === 'en_cours' ? 'en cours' : `résolu ${frDateTime(i.resolvedAt)}`}</span></p>
              <ul className="ui-small mt-1" style={muted}>{i.updates.map((u) => <li key={u.at}>{frDateTime(u.at)} : {u.text}</li>)}</ul>
              {i.status === 'en_cours' ? (
                <form method="post" action="/api/ops/incidents" className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input type="hidden" name="id" value={i.id} />
                  <input name="text" aria-label="Mise à jour publique" placeholder="Mise à jour publique" maxLength={1000} style={field} />
                  <button className="ui-btn" data-size="sm" name="action" value="update">Publier</button>
                  <button className="ui-btn" data-size="sm" data-variant="ghost" name="action" value="resolve">Marquer résolu</button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
