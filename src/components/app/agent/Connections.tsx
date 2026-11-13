'use client';
// Connexions de plateformes : état, assistant pas à pas (où trouver l'accès → saisie → test), nouveau test, déconnexion.
import { useRef, useState } from 'react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { toast } from '@/components/ui/toast';
import type { PublishConnectionView } from '@/lib/publish/connections';
import { fmtDate } from '../tokens';
import { canPublish, KIND_NAME, PLATFORM_NAME, ROLE_NAME, simEntry, type ChangeKind, type Platform } from './model';
import { connectBody, fieldErrors, GUIDES, type PlatformGuide } from './platforms';
import { useAgent, useWait } from './state';

type TestView = { ok: boolean; detail: string; capabilities: ChangeKind[] };

function Caps({ kinds }: { kinds: ChangeKind[] }) {
  if (!kinds.length) return null;
  return (
    <ul className="ag-caps m-0 list-none p-0" aria-label="Ce que l’agent peut modifier">
      {kinds.map((k) => (
        <li key={k}>
          <StatusBadge tone="neutral" icon={false}>
            {KIND_NAME[k]}
          </StatusBadge>
        </li>
      ))}
    </ul>
  );
}

function Wizard({ guide, onClose }: { guide: PlatformGuide; onClose: () => void }) {
  const a = useAgent();
  const wait = useWait();
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [values, setValues] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestView | null>(null);
  const errs = fieldErrors(guide, values);
  const invalid = Object.keys(errs).length > 0;

  async function connect() {
    setTouched(true);
    if (invalid) return;
    setStep(2);
    setTesting(true);
    setResult(null);
    if (a.demo) {
      await wait(1200);
      const r: TestView = { ok: true, detail: 'Simulation : connexion réussie. Sur un vrai compte, l’agent vérifie ici vos droits réels.', capabilities: guide.can };
      const view: PublishConnectionView = { platform: guide.id, config: connectBody(guide, values).config, hint: '…démo', createdAt: new Date().toISOString(), lastTest: { ...r, at: new Date().toISOString() } };
      a.putConnections([...a.connections.filter((c) => c.platform !== guide.id), view], [simEntry({ id: `conn:${guide.id}`, businessId: a.businessId }, 'connection.added', new Date())]);
      setResult(r);
    } else {
      const res = await a.post<{ connection: PublishConnectionView; test: TestView }>('/api/v5/publish/connections', connectBody(guide, values));
      if (!res.ok || !res.data) setResult({ ok: false, detail: res.error ?? 'Connexion impossible.', capabilities: [] });
      else {
        setResult(res.data.test);
        a.putConnections([...a.connections.filter((c) => c.platform !== guide.id), res.data.connection]);
        a.refresh();
      }
    }
    // les secrets saisis ne restent pas dans l'interface
    setValues((v) => Object.fromEntries(Object.entries(v).filter(([k]) => guide.fields.find((f) => f.name === k)?.group === 'config')));
    setTesting(false);
  }

  return (
    <>
      <div className="ag-dlg-h">
        <span className="ag-mono" aria-hidden="true">
          {guide.monogram}
        </span>
        <div className="min-w-0 flex-1">
          <p id="ag-wz-t" className="m-0 text-[17px] font-semibold">
            Connecter {PLATFORM_NAME[guide.id]}
          </p>
          <p className="ui-caption m-0 text-[var(--muted)]">Étape {step + 1} sur 3 : {['où trouver l’accès', 'saisie', 'test de connexion'][step]}</p>
        </div>
        <button type="button" className="ui-btn" data-variant="ghost" data-size="sm" onClick={onClose} aria-label="Fermer">
          Fermer
        </button>
      </div>
      <div className="ag-dlg-b">
        <ol className="ag-steps" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <li key={i} data-on={i <= step ? '' : undefined} />
          ))}
        </ol>
        {step === 0 && (
          <div className="flex flex-col gap-4">
            <ol className="ag-how">
              {guide.steps.map((s, i) => (
                <li key={i}>
                  <span>
                    {s.text}
                    {s.path && (
                      <>
                        {' '}
                        <span className="ag-path">{s.path}</span>
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ol>
            {guide.tip && <p className="m-0 rounded-[10px] bg-[var(--surface-2)] px-3 py-2 text-[13.5px] text-[var(--muted)]">{guide.tip}</p>}
            <p className="m-0 text-[13px] text-[var(--muted)]">Vos accès sont chiffrés et ne sont jamais réaffichés. Vous pouvez les retirer à tout moment, ici ou dans {PLATFORM_NAME[guide.id]}.</p>
          </div>
        )}
        {step === 1 && (
          <form
            id="ag-wz-form"
            noValidate
            autoComplete="off"
            onSubmit={(e) => {
              e.preventDefault();
              void connect();
            }}
          >
            {guide.fields.map((f) => {
              const err = touched ? errs[f.name] : undefined;
              return (
                <div key={f.name} className="ag-field">
                  <label htmlFor={`wz-${f.name}`}>
                    {f.label}
                    {f.optional ? ' (facultatif)' : ''}
                  </label>
                  <input
                    id={`wz-${f.name}`}
                    className="rp-input"
                    type={f.type === 'password' ? 'password' : f.type === 'url' ? 'url' : 'text'}
                    placeholder={f.placeholder}
                    value={values[f.name] ?? ''}
                    onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                    aria-invalid={err ? true : undefined}
                    aria-describedby={`wz-${f.name}-h`}
                    autoComplete={f.type === 'password' ? 'new-password' : 'off'}
                    spellCheck={false}
                  />
                  <small id={`wz-${f.name}-h`} className={err ? '!text-[var(--tone-down)]' : undefined}>
                    {err ?? f.help ?? ''}
                  </small>
                </div>
              );
            })}
          </form>
        )}
        {step === 2 && (
          <div className="flex flex-col gap-3" aria-live="polite">
            {testing ? (
              <p className="m-0 flex items-center gap-2 text-[14.5px]">
                <StatusBadge tone="brand" live>
                  Test en cours
                </StatusBadge>
                L’agent se connecte et vérifie ce qu’il a le droit de modifier…
              </p>
            ) : result ? (
              <>
                <p className="m-0 flex flex-wrap items-center gap-2">
                  <StatusBadge tone={result.ok ? 'up' : 'down'} size="lg">
                    {result.ok ? 'Connexion réussie' : 'Connexion refusée'}
                  </StatusBadge>
                  {a.demo && <span className="ag-simtag">Simulé</span>}
                </p>
                <p className="m-0 text-[14.5px]">{result.detail}</p>
                {result.ok && result.capabilities.length > 0 && (
                  <>
                    <p className="m-0 text-[13.5px] font-semibold">L’agent pourra proposer :</p>
                    <Caps kinds={result.capabilities} />
                  </>
                )}
                {!result.ok && <p className="m-0 text-[13.5px] text-[var(--muted)]">Vérifiez l’accès à l’étape précédente, puis réessayez. Rien n’a été modifié sur votre site.</p>}
              </>
            ) : null}
          </div>
        )}
      </div>
      <div className="ag-dlg-f">
        {step === 0 && (
          <button type="button" className="ui-btn" data-variant="primary" onClick={() => setStep(1)}>
            J’ai mon accès
          </button>
        )}
        {step === 1 && (
          <>
            <button type="button" className="ui-btn" data-variant="ghost" onClick={() => setStep(0)}>
              Revoir où le trouver
            </button>
            <button type="submit" form="ag-wz-form" className="ui-btn" data-variant="primary">
              Tester la connexion
            </button>
          </>
        )}
        {step === 2 && !testing && (
          <>
            {result && !result.ok && (
              <button type="button" className="ui-btn" onClick={() => setStep(1)}>
                Corriger la saisie
              </button>
            )}
            <button type="button" className="ui-btn" data-variant="primary" onClick={onClose}>
              {result?.ok ? 'Terminer' : 'Fermer'}
            </button>
          </>
        )}
      </div>
    </>
  );
}

function ConnectedCard({ c, admin }: { c: PublishConnectionView; admin: boolean }) {
  const a = useAgent();
  const wait = useWait();
  const [busy, setBusy] = useState<null | 'test' | 'remove'>(null);
  const [confirm, setConfirm] = useState(false);
  const t = c.lastTest;
  const label = c.config.siteUrl ?? c.config.shop ?? c.config.siteId ?? '';

  async function retest() {
    setBusy('test');
    if (a.demo) {
      await wait(900);
      a.putConnections(a.connections.map((x) => (x.platform === c.platform ? { ...x, lastTest: x.lastTest ? { ...x.lastTest, at: new Date().toISOString() } : x.lastTest } : x)), [simEntry({ id: `conn:${c.platform}`, businessId: a.businessId }, 'connection.tested', new Date())]);
      toast({ text: 'Connexion testée : tout fonctionne (simulation).', tone: 'success' });
    } else {
      const r = await a.post<{ test: TestView }>('/api/v5/publish/connections/test', { platform: c.platform });
      if (r.ok && r.data) {
        toast({ text: r.data.test.ok ? 'Connexion testée : tout fonctionne.' : r.data.test.detail, tone: r.data.test.ok ? 'success' : 'error' });
        a.refresh();
      } else toast({ text: r.error ?? 'Test impossible.', tone: 'error' });
    }
    setBusy(null);
  }

  async function remove() {
    setBusy('remove');
    if (a.demo) {
      a.putConnections(a.connections.filter((x) => x.platform !== c.platform), [simEntry({ id: `conn:${c.platform}`, businessId: a.businessId }, 'connection.removed', new Date())]);
      toast({ text: `${PLATFORM_NAME[c.platform]} déconnecté (simulation).`, tone: 'info' });
    } else {
      const r = await a.post(`/api/v5/publish/connections?businessId=${encodeURIComponent(a.businessId)}&platform=${c.platform}`, {}, 'DELETE');
      if (r.ok) {
        a.putConnections(a.connections.filter((x) => x.platform !== c.platform));
        toast({ text: `${PLATFORM_NAME[c.platform]} déconnecté. Vos accès sont effacés.`, tone: 'info' });
        a.refresh();
      } else toast({ text: r.error ?? 'Déconnexion impossible.', tone: 'error' });
    }
    setBusy(null);
    setConfirm(false);
  }

  return (
    <article className="ag-plat" data-state={t?.ok ? 'ok' : 'ko'} aria-labelledby={`pl-${c.platform}`}>
      <div className="ag-plat-h">
        <span className="ag-mono" aria-hidden="true">
          {GUIDES.find((g) => g.id === c.platform)?.monogram ?? '·'}
        </span>
        <div className="min-w-0 flex-1">
          <h3 id={`pl-${c.platform}`} className="ag-plat-n m-0">
            {PLATFORM_NAME[c.platform]}
          </h3>
          <p className="ui-caption m-0 truncate text-[var(--muted)]">{label}</p>
        </div>
        <StatusBadge tone={t ? (t.ok ? 'up' : 'down') : 'warn'}>{t ? (t.ok ? 'Connecté' : 'Erreur') : 'Non testé'}</StatusBadge>
      </div>
      {t && (
        <p className="ag-plat-d m-0">
          {t.detail} <span className="block">Dernier test le {fmtDate(t.at, { day: 'numeric', month: 'long' })}.</span>
        </p>
      )}
      {t?.ok && <Caps kinds={t.capabilities} />}
      {c.hint && <p className="ui-caption m-0 text-[var(--muted)]">Accès enregistré : {c.hint}</p>}
      {admin &&
        (confirm ? (
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Confirmer la déconnexion">
            <span className="text-[13.5px]">Effacer ces accès ?</span>
            <button type="button" className="ui-btn" data-size="sm" onClick={() => setConfirm(false)}>
              Non
            </button>
            <button type="button" className="ui-btn" data-size="sm" data-variant="primary" disabled={busy !== null} onClick={remove}>
              Oui, déconnecter
            </button>
          </div>
        ) : (
          <div className="mt-auto flex flex-wrap gap-2">
            <button type="button" className="ui-btn" data-size="sm" disabled={busy !== null} onClick={retest}>
              {busy === 'test' ? 'Test…' : 'Tester à nouveau'}
            </button>
            <button type="button" className="ui-btn" data-size="sm" data-variant="ghost" disabled={busy !== null} onClick={() => setConfirm(true)}>
              Déconnecter
            </button>
          </div>
        ))}
    </article>
  );
}

export function Connections({ gbpAvailable }: { gbpAvailable: boolean }) {
  const a = useAgent();
  const admin = canPublish(a.role);
  const dlg = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState<PlatformGuide | null>(null);
  const connected = new Set<Platform>(a.connections.map((c) => c.platform));
  const others = GUIDES.filter((g) => !connected.has(g.id));

  function start(g: PlatformGuide) {
    setOpen(g);
    dlg.current?.showModal();
  }
  function close() {
    dlg.current?.close();
    setOpen(null);
  }

  return (
    <div className="flex flex-col gap-6">
      {!admin && (
        <p role="note" className="m-0 rounded-lg bg-[var(--surface-2)] px-3 py-2 text-[13.5px] text-[var(--muted)]">
          Vous êtes {ROLE_NAME[a.role].toLowerCase()} : seul un administrateur ou le propriétaire peut connecter une plateforme.
        </p>
      )}
      {a.connections.length > 0 && (
        <section aria-labelledby="ag-c-on">
          <h2 id="ag-c-on" className="ui-h2 mb-3">
            Connecté
          </h2>
          <div className="ag-plats" data-wide="">
            {a.connections.map((c) => (
              <ConnectedCard key={c.platform} c={c} admin={admin} />
            ))}
          </div>
        </section>
      )}
      <section aria-labelledby="ag-c-add">
        <h2 id="ag-c-add" className="ui-h2 mb-3">
          {a.connections.length ? 'Ajouter une plateforme' : 'Connecter votre site'}
        </h2>
        <div className="ag-plats">
          {others.map((g) => {
            const soon = g.id === 'gbp' && !gbpAvailable;
            return (
              <article key={g.id} className="ag-plat" data-state={soon ? 'soon' : undefined} aria-labelledby={`pl-${g.id}`}>
                <div className="ag-plat-h">
                  <span className="ag-mono" aria-hidden="true">
                    {g.monogram}
                  </span>
                  <h3 id={`pl-${g.id}`} className="ag-plat-n m-0 flex-1">
                    {PLATFORM_NAME[g.id]}
                  </h3>
                  {soon && <StatusBadge tone="neutral">Bientôt</StatusBadge>}
                </div>
                <p className="ag-plat-d m-0">{soon ? g.steps[0].text : g.pitch}</p>
                {!soon && (
                  <button type="button" className="ui-btn mt-auto self-start" data-size="sm" disabled={!admin} onClick={() => start(g)}>
                    Connecter {PLATFORM_NAME[g.id]}
                  </button>
                )}
              </article>
            );
          })}
          <article className="ag-plat" data-state="ok" aria-labelledby="pl-export">
            <div className="ag-plat-h">
              <span className="ag-mono" aria-hidden="true">
                ↓
              </span>
              <h3 id="pl-export" className="ag-plat-n m-0 flex-1">
                Export de fichiers
              </h3>
              <StatusBadge tone="up">Toujours disponible</StatusBadge>
            </div>
            <p className="ag-plat-d m-0">Pour tout site, et pour ce qu’une plateforme ne permet pas (robots.txt, llms.txt, redirections) : fichiers prêts à déposer, avec les instructions et l’état « avant ».</p>
          </article>
        </div>
      </section>
      <dialog ref={dlg} className="ag-dialog" aria-labelledby="ag-wz-t" onClose={() => setOpen(null)}>
        {open && <Wizard key={open.id} guide={open} onClose={close} />}
      </dialog>
    </div>
  );
}
