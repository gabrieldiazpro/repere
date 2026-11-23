'use client';
// Pilote automatique (V10, PILOTE-AUTO) : mise en route, état (pause d'un clic), ce que le pilote a fait cette semaine
// (annuler), contenus en relecture (bloquer), mandat (catégories, signature, preuve), journal.
// Compte démo : tout est simulé dans le navigateur, rien n'est envoyé.
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { toast } from '@/components/ui/toast';
import { CATEGORY_DEFS, CONTENT_REVIEW_HOURS, NEVER_DONE, SCORE_DROP_MARGIN, allowedCategories, type Mandate, type MandateCategory } from '@/lib/autopilot/mandate';
import type { AutopilotJournalEntry, AutopilotState, ContentSchedule, SeriesRecord } from '@/lib/autopilot/store';
import { fmtDate } from '../tokens';
import { canPublish, KIND_NAME, ROLE_NAME, type ChangeKind } from './model';
import type { PiloteData } from './pilote-server';

const DAY = 86_400_000;
/** « 23 nov. à 07 h 00 », heure de Paris ; heure assemblée à la main (même rendu serveur et navigateur, sans hydratation divergente). */
function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Paris' }).formatToParts(d);
  const hh = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const mm = parts.find((p) => p.type === 'minute')?.value ?? '00';
  return `${fmtDate(iso, { day: 'numeric', month: 'long' })} à ${hh} h ${mm}`;
}

const ACTION_LABEL: Record<AutopilotJournalEntry['action'], string> = {
  'mandate.signed': 'Mandat signé',
  'mandate.paused': 'Pilote mis en pause',
  'mandate.resumed': 'Pilote relancé',
  'mandate.revoked': 'Mandat révoqué',
  'mandate.guard_stop': 'Arrêt automatique (score en baisse)',
  'series.applied': 'Série appliquée',
  'series.skipped': 'Série laissée à votre validation',
  'series.failed': 'Série en échec',
  'series.undone': 'Série annulée',
  'content.scheduled': 'Contenu en relecture',
  'content.blocked': 'Contenu bloqué',
  'content.published': 'Contenu mis en ligne',
  'content.failed': 'Contenu non publié',
  'recap.sent': 'Récapitulatif envoyé',
};

async function post(businessId: string, body: Record<string, unknown>): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string }> {
  try {
    const r = await fetch('/api/v5/autopilot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ businessId, ...body }) });
    const data = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    if (!r.ok) return { ok: false, error: typeof data.error === 'string' ? data.error : 'L’action n’a pas abouti. Réessayez.' };
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'Connexion impossible. Réessayez.' };
  }
}

function SetupStep({ n, done, title, text, href, cta }: { n: number; done: boolean; title: string; text: string; href: string; cta: string }) {
  return (
    <li className="flex gap-3 border-t border-[var(--hair)] py-3 first:border-t-0">
      <span aria-hidden="true" className={`flex h-7 w-7 flex-none items-center justify-center rounded-full text-[13px] font-semibold ${done ? 'bg-[var(--success-bg)] text-[var(--success-ink)]' : 'bg-[var(--primary-bg)] text-[var(--primary)]'}`}>
        {done ? '✓' : n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="m-0 font-semibold">
          {title} <span className="sr-only">{done ? '(fait)' : '(à faire)'}</span>
        </p>
        <p className="ui-small m-0 text-[var(--muted)]">{text}</p>
      </div>
      {!done && (
        <Link className="ui-btn self-center" href={href}>
          {cta}
        </Link>
      )}
    </li>
  );
}

export function Pilote({ data, now }: { data: PiloteData; now: number }) {
  const admin = canPublish(data.role);
  const [mandate, setMandate] = useState<Mandate | null>(data.mandate);
  const [state, setState] = useState<AutopilotState>(data.state);
  const [journal, setJournal] = useState<AutopilotJournalEntry[]>(data.journal);
  const allowed = useMemo(() => new Set(allowedCategories(data.regulated)), [data.regulated]);
  const [cats, setCats] = useState<MandateCategory[]>(mandate?.status !== 'revoked' && mandate ? mandate.categories : CATEGORY_DEFS.filter((c) => c.byDefault && allowed.has(c.id)).map((c) => c.id));
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const live = mandate && mandate.status !== 'revoked' ? mandate : null;
  const week = state.series.filter((s) => now - Date.parse(s.appliedAt) <= 7 * DAY).sort((a, b) => b.appliedAt.localeCompare(a.appliedAt));
  const older = state.series.filter((s) => now - Date.parse(s.appliedAt) > 7 * DAY).sort((a, b) => b.appliedAt.localeCompare(a.appliedAt)).slice(0, 10);
  const review = state.contents.filter((c) => c.status === 'scheduled');
  const published = state.contents.filter((c) => c.status === 'published').slice(-5).reverse();

  const log = (action: AutopilotJournalEntry['action'], detail: string, ref?: string) =>
    setJournal((j) => [{ id: `apj_local_${j.length}`, businessId: data.businessId, seq: j.length + 1, at: new Date().toISOString(), actor: { id: 'vous' }, action, ref, detail, prevHash: '', hash: '' }, ...j]);

  async function act(key: string, body: Record<string, unknown>, simulate: () => void, ok: string) {
    setBusy(key);
    if (data.demo) {
      simulate();
      toast({ text: `${ok} (démo : rien n’est envoyé, entreprise fictive).`, tone: 'success' });
    } else {
      const r = await post(data.businessId, body);
      if (r.ok) {
        simulate();
        if (r.data.mandate) setMandate(r.data.mandate as Mandate);
        toast({ text: ok, tone: 'success' });
      } else toast({ text: r.error, tone: 'error' });
    }
    setBusy(null);
  }

  const undo = (s: SeriesRecord) =>
    act(`undo:${s.csId}`, { action: 'undo', csId: s.csId }, () => {
      setState((st) => ({ ...st, series: st.series.map((x) => (x.csId === s.csId ? { ...x, status: 'undone', undoneAt: new Date().toISOString() } : x)) }));
      log('series.undone', `${s.title} : valeurs d’avant remises`, s.csId);
    }, 'Série annulée : les valeurs d’avant sont remises sur votre site.');

  const block = (c: ContentSchedule) =>
    act(`block:${c.draftId}`, { action: 'block', draftId: c.draftId }, () => {
      setState((st) => ({ ...st, contents: st.contents.map((x) => (x.draftId === c.draftId ? { ...x, status: 'blocked', blockedAt: new Date().toISOString() } : x)) }));
      log('content.blocked', `${c.title} : mise en ligne annulée`, c.draftId);
    }, 'Mise en ligne bloquée : le brouillon reste chez vous, non visible du public.');

  const setStatus = (action: 'pause' | 'resume' | 'revoke') =>
    act(action, { action }, () => {
      const t = new Date().toISOString();
      setMandate((m) => (m ? { ...m, status: action === 'pause' ? 'paused' : action === 'resume' ? 'active' : 'revoked', ...(action === 'pause' ? { pausedAt: t, pauseReason: 'client' as const } : {}), ...(action === 'revoke' ? { revokedAt: t } : {}) } : m));
      if (action === 'resume') setState((st) => ({ ...st, guard: null }));
      log(action === 'pause' ? 'mandate.paused' : action === 'resume' ? 'mandate.resumed' : 'mandate.revoked', action === 'revoke' ? 'Révocation immédiate' : '');
    }, action === 'pause' ? 'Pilote en pause : plus rien n’est fait sur votre site.' : action === 'resume' ? 'Pilote relancé.' : 'Mandat révoqué : plus rien n’est fait sur votre site.');

  const sign = () =>
    act('sign', { action: 'sign', categories: cats, accepted }, () => {
      const t = new Date().toISOString();
      if (data.demo) setMandate((m) => ({ ...(m as Mandate), categories: cats, status: 'active', signedAt: t, updatedAt: t }));
      log('mandate.signed', `Catégories : ${cats.join(', ')}`);
      setAccepted(false);
    }, live ? 'Nouveau mandat signé : les catégories sont à jour.' : 'Mandat signé : le pilote démarre à la prochaine analyse de votre site (lancée maintenant).');

  if (!data.offer) {
    return (
      <div className="ui-card" data-tone="brand">
        <div className="ui-card-body flex flex-col gap-3">
          <h2 className="ui-h2 m-0">Le pilote automatique n’est pas compris dans votre offre</h2>
          <p className="m-0 text-[14.5px]">
            Avec l’offre Pilote automatique, Repéré applique lui-même, sans rendez-vous, les corrections que vous autorisez une fois par écrit, et
            vous prévient après coup avec une annulation en un clic. Aujourd’hui, l’agent vous propose les corrections et vous les validez une par une.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link className="ui-btn" data-variant="primary" href={`/tout-fait-pour-vous?segment=${data.segment}`}>
              Comment ça marche
            </Link>
            <Link className="ui-btn" href={`/tarifs?segment=${data.segment}#pilote-automatique`}>
              Voir le prix
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const statusView = !live
    ? { tone: 'neutral' as const, label: 'Pas encore démarré' }
    : live.status === 'paused'
      ? { tone: 'warn' as const, label: live.pauseReason === 'guard' ? 'Arrêté automatiquement' : 'En pause' }
      : { tone: 'up' as const, label: 'Actif' };

  return (
    <div className="flex flex-col gap-5">
      {!admin && (
        <p role="note" className="m-0 rounded-lg bg-[var(--surface-2)] px-3 py-2 text-[13.5px] text-[var(--muted)]">
          Vous êtes {ROLE_NAME[data.role].toLowerCase()} : le mandat se signe, se met en pause ou s’annule par un administrateur ou le propriétaire.
          Vous pouvez bloquer un contenu en relecture.
        </p>
      )}

      {/* État + pause d'un clic */}
      <section className="ui-card" aria-labelledby="pl-etat">
        <div className="ui-card-body flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <h2 id="pl-etat" className="ui-h2 m-0 flex flex-wrap items-center gap-2">
              Pilote automatique <StatusBadge tone={statusView.tone}>{statusView.label}</StatusBadge>
            </h2>
            <p className="ui-small m-0 mt-1 text-[var(--muted)]">
              {live
                ? `Ce mois-ci : ${data.used} série${data.used > 1 ? 's' : ''} sur ${data.limits.series}, ${data.limits.contents} contenus au plus. Récapitulatif chaque lundi par e-mail.`
                : 'Trois étapes, sans rendez-vous : connecter votre site, confirmer votre fiche officielle, signer le mandat.'}
            </p>
          </div>
          {live && admin && live.status === 'active' && (
            <button type="button" className="ui-btn" onClick={() => setStatus('pause')} disabled={busy === 'pause'}>
              Mettre en pause
            </button>
          )}
          {live && admin && live.status === 'paused' && (
            <button type="button" className="ui-btn" data-variant="primary" onClick={() => setStatus('resume')} disabled={busy === 'resume'}>
              Relancer le pilote
            </button>
          )}
        </div>
      </section>

      {state.guard && live?.status === 'paused' && (
        <section role="alert" className="ui-card" data-tone="down">
          <div className="ui-card-body flex flex-col gap-2">
            <h2 className="ui-h2 m-0">Arrêt automatique le {fmtDate(state.guard.trippedAt)}</h2>
            <p className="m-0 text-[14.5px]">
              {state.guard.detail}. Le pilote s’arrête dès qu’un score baisse de plus de {SCORE_DROP_MARGIN} points après une série. La cause peut être
              ailleurs (changement sur le site, panne passagère) : annulez les séries concernées, ou relancez le pilote si tout vous semble normal.
            </p>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {state.series
                .filter((s) => state.guard!.seriesIds.includes(s.csId))
                .map((s) => (
                  <li key={s.csId} className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 flex-1">{s.title}</span>
                    {s.status === 'undone' ? (
                      <StatusBadge tone="neutral">Annulée</StatusBadge>
                    ) : (
                      admin && (
                        <button type="button" className="ui-btn" onClick={() => undo(s)} disabled={busy === `undo:${s.csId}`}>
                          Annuler cette série
                        </button>
                      )
                    )}
                  </li>
                ))}
            </ul>
          </div>
        </section>
      )}

      {/* Mise en route */}
      {(!data.setup.connected.length || !data.setup.fiche || !live) && (
        <section className="ui-card" aria-labelledby="pl-depart">
          <div className="ui-card-head">
            <h2 id="pl-depart" className="ui-h2 m-0">
              Mise en route, sans rendez-vous
            </h2>
          </div>
          <ol className="ui-card-body m-0 list-none p-0 px-[var(--card-pad,16px)]">
            <SetupStep
              n={1}
              done={data.setup.connected.length > 0}
              title={data.setup.connected.length ? `Site connecté : ${data.setup.connected.join(', ')}` : 'Connecter votre site'}
              text="WordPress, Shopify, Wix, Webflow, PrestaShop ou Magento : l’assistant vous guide pas à pas. Sinon, Repéré prépare les fichiers et vous les envoie par e-mail."
              href="/app/agent/connexions"
              cta="Connecter"
            />
            <SetupStep
              n={2}
              done={data.setup.fiche}
              title={data.setup.fiche ? `Fiche officielle confirmée${data.setup.ficheAt ? ` le ${fmtDate(data.setup.ficheAt)}` : ''}` : 'Confirmer votre fiche officielle'}
              text="Pré-remplie depuis votre site : vérifiez-la en un écran. Le pilote n’écrit qu’avec ces faits-là."
              href="/app/fiche"
              cta="Vérifier"
            />
            <SetupStep n={3} done={!!live} title="Signer le mandat" text="Une fois, par écrit, catégorie par catégorie. Révocable à tout moment." href="#mandat" cta="Signer" />
          </ol>
        </section>
      )}

      {/* Cette semaine */}
      <section className="ui-card" aria-labelledby="pl-semaine">
        <div className="ui-card-head">
          <h2 id="pl-semaine" className="ui-h2 m-0">
            Ce que le pilote a fait cette semaine
          </h2>
        </div>
        <div className="ui-card-body">
          {week.length ? (
            <ul className="m-0 flex list-none flex-col p-0">
              {week.map((s) => (
                <SeriesRow key={s.csId} s={s} admin={admin} busy={busy === `undo:${s.csId}`} onUndo={() => undo(s)} />
              ))}
            </ul>
          ) : (
            <p className="m-0 text-[14.5px] text-[var(--muted)]">Rien cette semaine. Le pilote passe après chaque analyse de votre site.</p>
          )}
          {data.waiting > 0 && (
            <p className="ui-small m-0 mt-3">
              {data.waiting} proposition{data.waiting > 1 ? 's sortent' : ' sort'} du cadre de votre mandat (page juridique, prix, catégorie non cochée…) :{' '}
              <Link className="rp-link" href="/app/agent">
                à valider une par une
              </Link>
              .
            </p>
          )}
          {older.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-[14px] font-semibold text-[var(--primary)]">Séries précédentes ({older.length})</summary>
              <ul className="m-0 mt-2 flex list-none flex-col p-0">
                {older.map((s) => (
                  <SeriesRow key={s.csId} s={s} admin={admin} busy={busy === `undo:${s.csId}`} onUndo={() => undo(s)} />
                ))}
              </ul>
            </details>
          )}
        </div>
      </section>

      {/* Contenus */}
      <section className="ui-card" aria-labelledby="pl-contenus">
        <div className="ui-card-head">
          <h2 id="pl-contenus" className="ui-h2 m-0">
            Contenus en relecture ({CONTENT_REVIEW_HOURS} h)
          </h2>
        </div>
        <div className="ui-card-body flex flex-col gap-2">
          {review.length ? (
            review.map((c) => (
              <div key={c.draftId} className="flex flex-wrap items-center gap-2 border-t border-[var(--hair)] pt-2 first:border-t-0 first:pt-0">
                <div className="min-w-0 flex-1">
                  <p className="m-0 font-semibold">{c.title}</p>
                  <p className="ui-small m-0 text-[var(--muted)]">En brouillon chez vous, non visible. Mise en ligne le {when(c.publishAt)}, sauf blocage.</p>
                </div>
                <button type="button" className="ui-btn" onClick={() => block(c)} disabled={busy === `block:${c.draftId}` || data.role === 'viewer'}>
                  Bloquer
                </button>
              </div>
            ))
          ) : (
            <p className="m-0 text-[14.5px] text-[var(--muted)]">Aucun contenu en relecture.</p>
          )}
          {state.contents
            .filter((c) => c.status === 'blocked')
            .slice(-3)
            .map((c) => (
              <p key={c.draftId} className="ui-small m-0">
                <StatusBadge tone="neutral">Bloqué</StatusBadge> {c.title}
              </p>
            ))}
          {published.length > 0 && (
            <div className="mt-2">
              <p className="ui-small m-0 font-semibold">Mis en ligne récemment</p>
              <ul className="m-0 mt-1 list-none p-0">
                {published.map((c) => (
                  <li key={c.draftId} className="ui-small">
                    {c.title}
                    {c.publishedAt ? ` · ${fmtDate(c.publishedAt)}` : ''} ·{' '}
                    <Link className="rp-link" href={`/app/contenu/${c.draftId}`}>
                      retirer ou modifier
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      {/* Mandat */}
      <section id="mandat" className="ui-card scroll-mt-24" aria-labelledby="pl-mandat">
        <div className="ui-card-head">
          <h2 id="pl-mandat" className="ui-h2 m-0">
            Votre mandat
          </h2>
        </div>
        <div className="ui-card-body flex flex-col gap-4">
          {live ? (
            <div className="m-0 text-[14.5px]">
              Signé le {when(live.signedAt)} par {live.signedBy.email}. Preuve : version {live.proof.version}, empreinte{' '}
              <code className="break-all text-[12.5px]">{live.proof.textHash.slice(0, 16)}…</code>, horodatage serveur.
              {live.text ? (
                <details className="mt-2">
                  <summary className="cursor-pointer font-semibold text-[var(--primary)]">Lire le texte signé</summary>
                  <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-[var(--surface-2)] p-3 text-[12.5px]">{live.text}</pre>
                </details>
              ) : null}
            </div>
          ) : (
            <p className="m-0 text-[14.5px]">
              Cochez ce que Repéré peut faire seul. Tout le reste reste une proposition que vous validez. Vous pourrez changer d’avis à tout moment.
            </p>
          )}
          <fieldset className="m-0 min-w-0 border-0 p-0" disabled={!admin}>
            <legend className="mb-1 font-semibold">Ce que Repéré peut faire seul</legend>
            {CATEGORY_DEFS.map((c) => {
              const off = !allowed.has(c.id);
              return (
                <label key={c.id} className="ag-opt">
                  <input type="checkbox" checked={cats.includes(c.id)} disabled={off} onChange={(e) => setCats((p) => (e.target.checked ? [...new Set([...p, c.id])] : p.filter((x) => x !== c.id)))} />
                  <span>
                    {c.label}
                    {c.byDefault ? '' : ' (non coché par défaut)'}
                    <small>{off ? 'Métier réglementé : jamais de texte rédigé seul.' : c.help}</small>
                    {c.kinds.length > 0 && <small>Types : {c.kinds.map((k) => KIND_NAME[k as ChangeKind]).join(', ')}</small>}
                  </span>
                </label>
              );
            })}
          </fieldset>
          <div>
            <p className="m-0 font-semibold">Ce que Repéré ne fait jamais, même avec ce mandat</p>
            <ul className="ui-small m-0 mt-1 pl-5">
              {NEVER_DONE.map((n) => (
                <li key={n}>{n.charAt(0).toUpperCase() + n.slice(1)}.</li>
              ))}
            </ul>
          </div>
          {admin && (
            <div className="flex flex-col gap-3">
              <label className="ag-opt">
                <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
                <span>
                  J’ai lu et j’accepte ce mandat pour {data.name}, et je suis habilité à engager l’entreprise pour ce site.
                  <small>
                    Texte complet affiché avant signature et dans les <Link className="rp-link" href="/cgv#pilote-automatique">CGV</Link>. Modèle à relire par un avocat avant la mise en vente.
                  </small>
                </span>
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="ui-btn" data-variant="primary" onClick={sign} disabled={!accepted || !cats.length || busy === 'sign'}>
                  {live ? 'Signer le mandat mis à jour' : 'Signer le mandat et démarrer'}
                </button>
                {live && (
                  <button type="button" className="ui-btn" onClick={() => setStatus('revoke')} disabled={busy === 'revoke'}>
                    Révoquer le mandat
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Journal */}
      <section className="ui-card" aria-labelledby="pl-journal">
        <div className="ui-card-head">
          <h2 id="pl-journal" className="ui-h2 m-0">
            Journal du pilote
          </h2>
        </div>
        <div className="ui-card-body">
          {journal.length ? (
            <ol className="m-0 flex list-none flex-col gap-2 p-0">
              {journal.slice(0, 20).map((e) => (
                <li key={e.id} className="text-[14px]">
                  <span className="text-[var(--muted)]">{when(e.at)}</span> · <b>{ACTION_LABEL[e.action]}</b>
                  {e.detail ? ` · ${e.detail}` : ''}
                </li>
              ))}
            </ol>
          ) : (
            <p className="m-0 text-[14.5px] text-[var(--muted)]">Le journal commence à la signature du mandat.</p>
          )}
          <p className="ui-small m-0 mt-3 text-[var(--muted)]">
            Journal infalsifiable (chaque entrée porte l’empreinte de la précédente). Le détail avant / après de chaque modification est dans le{' '}
            <Link className="rp-link" href="/app/agent/journal">
              journal de l’agent
            </Link>
            . Une question ? <Link className="rp-link" href="/contact?sujet=pilote">Écrivez-nous</Link> : réponse par écrit, aucun appel nécessaire.
          </p>
        </div>
      </section>
    </div>
  );
}

function SeriesRow({ s, admin, busy, onUndo }: { s: SeriesRecord; admin: boolean; busy: boolean; onUndo: () => void }) {
  const effect =
    s.baseline && s.after && typeof s.baseline.seo === 'number' && typeof s.after.seo === 'number'
      ? `SEO ${s.baseline.seo} → ${s.after.seo}${Math.abs(s.after.seo - s.baseline.seo) <= SCORE_DROP_MARGIN ? ' (dans la marge)' : ''}`
      : 'effet mesuré à la prochaine analyse';
  return (
    <li className="flex flex-wrap items-center gap-2 border-t border-[var(--hair)] py-2.5 first:border-t-0">
      <div className="min-w-0 flex-1">
        <p className="m-0 font-semibold">{s.title}</p>
        <p className="ui-small m-0 text-[var(--muted)]">
          {when(s.appliedAt)} · {s.pages} page{s.pages > 1 ? 's' : ''} · {effect}
        </p>
      </div>
      {s.status === 'undone' ? (
        <StatusBadge tone="neutral">Annulée</StatusBadge>
      ) : s.status === 'failed' ? (
        <StatusBadge tone="down">Échec</StatusBadge>
      ) : (
        <>
          <StatusBadge tone={s.status === 'verified' ? 'up' : 'warn'}>{s.status === 'verified' ? 'En ligne, vérifiée' : 'Appliquée'}</StatusBadge>
          {admin && (
            <button type="button" className="ui-btn" onClick={onUndo} disabled={busy}>
              Annuler
            </button>
          )}
        </>
      )}
    </li>
  );
}
