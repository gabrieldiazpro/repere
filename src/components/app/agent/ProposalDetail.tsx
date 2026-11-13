'use client';
// Une proposition de l'agent : AVANT / APRÈS, modification manuelle, validation explicite (qui valide),
// application avec progression, vérification en direct, effet mesuré, annulation avec confirmation.
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Surface } from '@/components/ui/Surface';
import { toast } from '@/components/ui/toast';
import { fmtDate } from '../tokens';
import { DiffColumns, DiffLegend } from './DiffView';
import { EffectView } from './EffectView';
import { JournalList } from './JournalList';
import {
  actorName,
  applySteps,
  blockers,
  canEdit,
  canPublish,
  CODE_KINDS,
  impactOf,
  KIND_GAIN,
  KIND_NAME,
  needsCompletion,
  originOf,
  PLATFORM_NAME,
  RISK_VIEW,
  ROLE_NAME,
  simApply,
  simEdit,
  simEntry,
  simReject,
  simRevert,
  simValidate,
  STATUS_VIEW,
  type Change,
  type ChangeSet,
  type JournalEntry,
} from './model';
import { useAgent, useWait } from './state';

type StepState = 'wait' | 'run' | 'ok' | 'ko';

const when = (iso: string) => `${fmtDate(iso, { day: 'numeric', month: 'long' })} à ${new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })}`;

function pathOf(url?: string): string {
  if (!url) return '';
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname === '/' ? '' : u.pathname}`;
  } catch {
    return url;
  }
}

const LIMITS: Partial<Record<Change['kind'], number>> = { 'meta.title': 60, 'meta.description': 160, 'image.alt': 125 };

function ChangeBlock({
  cs,
  ch,
  excluded,
  onExclude,
  editable,
  multiple,
  onSave,
}: {
  cs: ChangeSet;
  ch: Change;
  excluded: boolean;
  onExclude: (v: boolean) => void;
  editable: boolean;
  multiple: boolean;
  onSave: (value: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(ch.after ?? '');
  const [saving, setSaving] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const code = CODE_KINDS.has(ch.kind);
  const limit = LIMITS[ch.kind];
  const todo = needsCompletion(ch);
  const proposed = cs.status === 'proposed' || cs.status === 'draft' || cs.status === 'validated';

  useEffect(() => {
    if (editing) {
      area.current?.focus();
      // place le curseur sur le premier « [à compléter] »
      const i = draft.search(/\[\s*à compléter\s*\]/i);
      if (i >= 0) area.current?.setSelectionRange(i, i + draft.match(/\[\s*à compléter\s*\]/i)![0].length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const editor = editing ? (
    <div>
      <label className="sr-only" htmlFor={`ed-${ch.id}`}>
        Texte proposé ({KIND_NAME[ch.kind]})
      </label>
      <textarea id={`ed-${ch.id}`} ref={area} className="ag-edit" data-code={code ? '' : undefined} value={draft} onChange={(e) => setDraft(e.target.value)} spellCheck={!code} />
      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--hair)] px-3 py-2">
        {limit && (
          <span className="ag-count ui-caption" data-over={draft.length > limit ? '' : undefined}>
            {draft.length} / {limit} caractères{draft.length > limit ? ' : Google coupera la fin' : ''}
          </span>
        )}
        <span className="ml-auto flex gap-2">
          <button
            type="button"
            className="ui-btn"
            data-size="sm"
            onClick={() => {
              setDraft(ch.after ?? '');
              setEditing(false);
            }}
          >
            Annuler
          </button>
          <button
            type="button"
            className="ui-btn"
            data-variant="primary"
            data-size="sm"
            disabled={saving || draft === (ch.after ?? '') || !draft.trim()}
            onClick={async () => {
              setSaving(true);
              const ok = await onSave(draft);
              setSaving(false);
              if (ok) setEditing(false);
            }}
          >
            {saving ? 'Enregistrement…' : 'Enregistrer le texte'}
          </button>
        </span>
      </div>
    </div>
  ) : undefined;

  const ver = ch.verification?.slice(-2) ?? [];
  return (
    <article className="ag-change" data-excluded={excluded ? '' : undefined} aria-labelledby={`ch-${ch.id}`}>
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
        <div className="min-w-0 flex-1">
          <h3 id={`ch-${ch.id}`} className="m-0 text-[15.5px] font-semibold">
            {KIND_NAME[ch.kind]}
          </h3>
          <p className="ui-caption m-0 text-[var(--muted)]">
            {pathOf(ch.target.url)}
            {ch.target.imageSrc ? `, image ${pathOf(ch.target.imageSrc)}` : ''}
          </p>
        </div>
        {todo && proposed && <StatusBadge tone="warn">À compléter</StatusBadge>}
        {ch.status === 'verified' && <StatusBadge tone="up">Vérifié en ligne</StatusBadge>}
        {ch.status === 'applied' && <StatusBadge tone="warn">Écrit, pas encore visible</StatusBadge>}
        {ch.status === 'failed' && <StatusBadge tone="down">Échec</StatusBadge>}
        {ch.status === 'reverted' && <StatusBadge tone="neutral">Annulé</StatusBadge>}
        {ch.status === 'skipped' && <StatusBadge tone="neutral">Écarté</StatusBadge>}
      </div>
      <p className="m-0 mt-2 text-[14px] leading-relaxed">{ch.rationale}</p>
      <DiffColumns change={ch} editor={editor} />
      {ch.error && <p className="m-0 mt-2 text-[13.5px] text-[var(--tone-down)]">{ch.error}</p>}
      {ver.length > 0 && (
        <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0">
          {ver.map((v, i) => (
            <li key={i} className="flex items-start gap-2 text-[13px]">
              <StatusBadge tone={v.ok ? 'up' : 'warn'} icon>
                {v.method === 'api' ? `Relu chez ${PLATFORM_NAME[cs.platform]}` : v.method === 'page' ? 'Page publique' : 'À déposer'}
              </StatusBadge>
              <span className="min-w-0 pt-0.5 text-[var(--muted)]">{v.detail}</span>
            </li>
          ))}
        </ul>
      )}
      {proposed && (editable || multiple) && !editing && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {editable && (
            <button type="button" className="ui-btn" data-size="sm" data-variant={todo ? 'primary' : undefined} onClick={() => setEditing(true)} disabled={excluded}>
              {todo ? 'Compléter le texte' : 'Modifier le texte proposé'}
            </button>
          )}
          {multiple && cs.status !== 'validated' && (
            <label className="inline-flex items-center gap-2 text-[14px]">
              <input type="checkbox" checked={!excluded} onChange={(e) => onExclude(!e.target.checked)} className="h-[18px] w-[18px] accent-[var(--primary)]" />
              Inclure dans la validation
            </label>
          )}
        </div>
      )}
    </article>
  );
}

function Relay({ cs, states, details }: { cs: ChangeSet; states: StepState[]; details: string[] }) {
  const steps = applySteps(cs.platform);
  return (
    <ol className="ag-relay" aria-live="polite">
      {steps.map((s, i) => (
        <li key={s.id} className="ag-step" data-state={states[i] ?? 'wait'}>
          <span className="ag-step-dot" aria-hidden="true">
            {states[i] === 'ok' ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="m5 12.5 4.5 4.5L19 7.5" />
              </svg>
            ) : states[i] === 'ko' ? (
              '!'
            ) : (
              <span className="text-[12px] font-semibold">{i + 1}</span>
            )}
          </span>
          <span className="ag-step-line" aria-hidden="true" />
          <div className="min-w-0">
            <p className="ag-step-t m-0">
              {states[i] === 'ok' ? s.done : s.label}
              <span className="sr-only">{states[i] === 'run' ? ' : en cours' : states[i] === 'ok' ? ' : fait' : states[i] === 'ko' ? ' : échec' : ' : à venir'}</span>
            </p>
            {details[i] && <p className="ag-step-d m-0">{details[i]}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function ProposalDetail({ id }: { id: string }) {
  const a = useAgent();
  const wait = useWait();
  const cs = a.changeSets.find((c) => c.id === id);
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState<null | 'validate' | 'apply' | 'verify' | 'revert' | 'reject'>(null);
  const [steps, setSteps] = useState<StepState[] | null>(null);
  const [stepDetails, setStepDetails] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const confirmRef = useRef<HTMLDialogElement>(null);
  const relayRef = useRef<HTMLDivElement>(null);

  if (!cs) {
    return (
      <p className="ui-body">
        Cette proposition n’existe plus. <Link href="/app/agent">Revenir aux propositions</Link>
      </p>
    );
  }

  const journal = a.journal.filter((j) => j.subject === cs.id);
  const effect = a.effects[cs.id];
  const publish = canPublish(a.role);
  const edit = canEdit(a.role);
  const block = blockers(cs, excluded);
  const included = cs.changes.filter((c) => !excluded.has(c.id) && c.status !== 'skipped');
  const o = originOf(cs);
  const risk = RISK_VIEW[cs.risk];
  const st = STATUS_VIEW[cs.status];
  const now = () => new Date();
  const total = applySteps(cs.platform).length;
  const showRelay = steps || ['verified', 'applied', 'partially_applied', 'failed'].includes(cs.status);
  const relayStates: StepState[] =
    steps ??
    (cs.status === 'verified'
      ? Array(total).fill('ok')
      : cs.status === 'failed'
        ? ['ok', 'ko', ...Array(total - 2).fill('wait')]
        : [...Array(total - 1).fill('ok'), 'ko']);

  async function real<T extends { changeSet: ChangeSet }>(body: Record<string, unknown>): Promise<ChangeSet | null> {
    const r = await a.post<T>(`/api/v5/publish/changesets/${cs!.id}`, body);
    if (!r.ok || !r.data?.changeSet) {
      setError(r.error ?? 'Action impossible.');
      toast({ text: r.error ?? 'Action impossible.', tone: 'error' });
      return null;
    }
    setError(null);
    a.putChangeSet(r.data.changeSet);
    return r.data.changeSet;
  }

  async function saveEdit(changeId: string, value: string): Promise<boolean> {
    if (a.demo) {
      a.putChangeSet(simEdit(cs!, changeId, value, now()), [simEntry(cs!, 'edited', now(), { changeId, after: value })]);
      toast({ text: 'Texte enregistré (simulation).', tone: 'success' });
      return true;
    }
    const n = await real({ action: 'edit', changeId, value });
    if (n) {
      toast({ text: 'Texte enregistré.', tone: 'success' });
      a.refresh();
    }
    return Boolean(n);
  }

  async function validate() {
    setBusy('validate');
    if (a.demo) {
      await wait(300);
      const n = simValidate(cs!, excluded, now());
      a.putChangeSet(n, [simEntry(cs!, 'validated', now())]);
      toast({ text: 'Validé (simulation). Rien n’est encore écrit : appliquez quand vous voulez.', tone: 'success' });
    } else {
      const n = await real({ action: 'validate', exclude: [...excluded] });
      if (n) {
        toast({ text: 'Validé. Rien n’est encore écrit : appliquez quand vous voulez.', tone: 'success' });
        a.refresh();
      }
    }
    setBusy(null);
  }

  async function apply() {
    setBusy('apply');
    setError(null);
    const n = total;
    const s: StepState[] = Array(n).fill('wait');
    const det: string[] = Array(n).fill('');
    setSteps([...s]);
    setStepDetails([...det]);
    relayRef.current?.scrollIntoView({ block: 'nearest' });
    const run = async (i: number, ms: number) => {
      s[i] = 'run';
      setSteps([...s]);
      await wait(ms);
    };
    if (a.demo) {
      for (let i = 0; i < n; i++) {
        await run(i, 700);
        s[i] = 'ok';
        det[i] = i === n - 1 ? 'Simulation : modification visible sur la page.' : '';
        setSteps([...s]);
        setStepDetails([...det]);
      }
      const t = now();
      const done = simApply(cs!, t);
      const entries: JournalEntry[] = [
        simEntry(cs!, 'apply.started', t),
        ...done.changes.filter((c) => c.status === 'verified').map((c) => simEntry(cs!, 'change.applied', t, { changeId: c.id, before: c.before, after: c.after })),
        simEntry(cs!, 'verified', t, { detail: 'Simulation : relu en ligne, conforme.' }),
        simEntry(cs!, 'remeasure.scheduled', t, { detail: 'Remesure de la page à J+7 (simulation)' }),
      ];
      a.putChangeSet(done, entries);
      toast({ text: 'Appliqué et vérifié (simulation).', tone: 'success' });
      setBusy(null);
      return;
    }
    // Compte réel : un seul appel ; la progression avance pendant l'attente, puis se cale sur le résultat réel.
    const req = a.post<{ changeSet: ChangeSet }>(`/api/v5/publish/changesets/${cs!.id}`, { action: 'apply' });
    let settled = false;
    void req.finally(() => (settled = true));
    for (let i = 0; i < n - 1 && !settled; i++) {
      await run(i, 900);
      if (!settled) {
        s[i] = 'ok';
        setSteps([...s]);
      }
    }
    const r = await req;
    if (!r.ok || !r.data?.changeSet) {
      const i = Math.max(0, s.findIndex((x) => x === 'run' || x === 'wait'));
      s.fill('wait', i);
      s[i] = 'ko';
      for (let k = 0; k < i; k++) s[k] = 'ok';
      det[i] = r.error ?? 'Action impossible.';
      setSteps([...s]);
      setStepDetails([...det]);
      setError(r.error ?? 'Action impossible.');
      setBusy(null);
      return;
    }
    const res = r.data.changeSet;
    const failed = res.changes.filter((c) => c.status === 'failed');
    const unverified = res.changes.filter((c) => c.status === 'applied');
    const order = applySteps(res.platform).map((x) => x.id);
    for (let i = 0; i < n; i++) s[i] = 'ok';
    if (res.status === 'failed') {
      const w = order.indexOf('write');
      s.fill('wait', w);
      s[w] = 'ko';
      det[w] = failed[0]?.error ?? 'Écriture refusée.';
    } else if (unverified.length) {
      const last = n - 1;
      s[last] = res.platform === 'export' ? 'wait' : 'ko';
      det[last] = res.platform === 'export' ? 'Déposez les fichiers sur votre site, puis cliquez sur « Vérifier ».' : 'Pas encore visible : un cache peut retarder l’affichage. Revérifiez dans quelques minutes.';
    }
    if (failed.length && res.status !== 'failed') det[order.indexOf('write')] = `${failed.length} modification${failed.length > 1 ? 's' : ''} non écrite${failed.length > 1 ? 's' : ''} : voir le détail ci-dessous.`;
    setSteps([...s]);
    setStepDetails([...det]);
    a.putChangeSet(res);
    toast({ text: res.status === 'verified' ? 'Appliqué et vérifié.' : res.status === 'failed' ? 'L’application a échoué : rien n’a changé sur votre site.' : 'Appliqué, vérification à refaire.', tone: res.status === 'failed' ? 'error' : 'success' });
    a.refresh();
    setBusy(null);
  }

  async function verify() {
    setBusy('verify');
    const n = await real({ action: 'verify' });
    if (n) {
      setSteps(null);
      toast({ text: n.status === 'verified' ? 'Vérifié en ligne.' : 'Toujours pas visible en ligne.', tone: n.status === 'verified' ? 'success' : 'info' });
      a.refresh();
    }
    setBusy(null);
  }

  async function revert() {
    confirmRef.current?.close();
    setBusy('revert');
    if (a.demo) {
      await wait(500);
      const t = now();
      const n = simRevert(cs!, t);
      a.putChangeSet(n, [
        ...cs!.changes.filter((c) => c.status === 'verified' || c.status === 'applied').map((c) => simEntry(cs!, 'change.reverted', t, { changeId: c.id, before: c.after, after: c.before })),
        simEntry(cs!, 'reverted', t),
      ]);
      toast({ text: 'Annulé : l’ancienne valeur est rétablie (simulation).', tone: 'success' });
    } else {
      const n = await real({ action: 'revert' });
      if (n) {
        toast({ text: 'Annulé : l’ancienne valeur est rétablie.', tone: 'success' });
        a.refresh();
      }
    }
    setSteps(null);
    setBusy(null);
  }

  async function reject() {
    setBusy('reject');
    if (a.demo) {
      a.putChangeSet(simReject(cs!, now()), [simEntry(cs!, 'rejected', now())]);
      toast({ text: 'Proposition refusée (simulation).', tone: 'info' });
    } else if (await real({ action: 'reject' })) {
      toast({ text: 'Proposition refusée.', tone: 'info' });
      a.refresh();
    }
    setBusy(null);
  }

  const v = cs.validation;
  const validator = v ? `${actorName(v.by, a.meId)}${v.by.role && v.by.id !== 'demo' ? ` (${ROLE_NAME[v.by.role as keyof typeof ROLE_NAME] ?? v.by.role})` : ''}` : '';
  const live = cs.changes.some((c) => c.status === 'verified' || c.status === 'applied');

  // Barre d'action : UN bouton principal selon l'état.
  let msg: React.ReactNode = null;
  let primary: React.ReactNode = null;
  let secondary: React.ReactNode = null;
  if (cs.status === 'proposed' || cs.status === 'draft') {
    if (!publish) {
      msg = (
        <>
          <b>Validation réservée aux administrateurs.</b> Vous êtes {ROLE_NAME[a.role].toLowerCase()} : vous pouvez modifier le texte, un administrateur ou le propriétaire valide.
        </>
      );
    } else if (block.length) {
      msg = (
        <>
          <b>
            {block.length} texte{block.length > 1 ? 's contiennent' : ' contient'} « [à compléter] ».
          </b>{' '}
          Complétez-{block.length > 1 ? 'les' : 'le'}, ou écartez la modification, pour pouvoir valider.
        </>
      );
    } else {
      msg = (
        <>
          <b>Vous validez en tant que {ROLE_NAME[a.role === 'demo' ? 'owner' : a.role].toLowerCase()}.</b> Rien n’est écrit sur votre site avant l’étape suivante, « Appliquer ».
        </>
      );
    }
    primary = (
      <button type="button" className="ui-btn" data-variant="primary" disabled={!publish || block.length > 0 || !included.length || busy !== null} onClick={validate}>
        {busy === 'validate' ? 'Validation…' : `Valider ${included.length > 1 ? `les ${included.length} modifications` : 'la modification'}`}
      </button>
    );
    secondary = publish ? (
      <button type="button" className="ui-btn" data-variant="ghost" disabled={busy !== null} onClick={reject}>
        Refuser
      </button>
    ) : null;
  } else if (cs.status === 'validated') {
    msg = (
      <>
        <b>Validé par {validator}</b> le {when(v!.at)}. {cs.platform === 'export' ? 'L’agent prépare les fichiers à déposer.' : `L’agent écrit chez ${PLATFORM_NAME[cs.platform]}, puis relit.`}
      </>
    );
    primary = (
      <button type="button" className="ui-btn" data-variant="primary" disabled={!publish || busy !== null} onClick={apply}>
        {busy === 'apply' ? 'Application…' : cs.platform === 'export' ? 'Préparer les fichiers' : 'Appliquer maintenant'}
      </button>
    );
  } else if (cs.status === 'applied' || cs.status === 'partially_applied') {
    msg = <b>{cs.platform === 'export' ? 'Fichiers prêts : déposez-les sur votre site, puis vérifiez.' : 'Écrit, mais pas encore visible partout : revérifiez dans quelques minutes.'}</b>;
    primary = a.demo ? null : (
      <button type="button" className="ui-btn" data-variant="primary" disabled={!publish || busy !== null} onClick={verify}>
        {busy === 'verify' ? 'Vérification…' : 'Vérifier à nouveau'}
      </button>
    );
  } else if (cs.status === 'failed') {
    msg = <b>L’application a échoué. Votre site n’a pas changé pour les modifications en échec.</b>;
    primary = (
      <button type="button" className="ui-btn" data-variant="primary" disabled={!publish || busy !== null || a.demo} onClick={apply}>
        Relancer l’application
      </button>
    );
  } else if (cs.status === 'verified') {
    msg = (
      <>
        <b>En ligne depuis le {when(cs.verifiedAt ?? cs.appliedAt!)}.</b> Validé par {validator}.
      </>
    );
  } else if (cs.status === 'reverted') {
    msg = <b>Annulé le {when(cs.revertedAt!)} : les anciennes valeurs sont rétablies.</b>;
  } else if (cs.status === 'rejected') {
    msg = <b>Refusé{cs.rejection ? ` par ${actorName(cs.rejection.by, a.meId)} le ${when(cs.rejection.at)}` : ''}.</b>;
  }
  if (live && publish && cs.status !== 'applying') {
    secondary = (
      <button type="button" className="ui-btn" data-variant={primary ? 'ghost' : undefined} disabled={busy !== null} onClick={() => confirmRef.current?.showModal()}>
        {busy === 'revert' ? 'Annulation…' : 'Annuler ce changement'}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={st.tone} size="lg">
          {st.label}
        </StatusBadge>
        {cs.demo && <span className="ag-simtag">Exemple simulé</span>}
      </div>

      <dl className="m-0 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="ui-card" data-elevation="flat">
          <div className="ui-card-body">
            <dt className="ui-caption text-[var(--muted)]">Origine</dt>
            <dd className="m-0 mt-1 text-[14.5px] font-semibold">{o.label}</dd>
            <dd className="m-0 hidden text-[13px] text-[var(--muted)] sm:block">{cs.origin.findingTitle ?? cs.origin.findingId}</dd>
          </div>
        </div>
        <div className="ui-card" data-elevation="flat">
          <div className="ui-card-body">
            <dt className="ui-caption text-[var(--muted)]">Gain attendu</dt>
            <dd className="m-0 mt-1 text-[14.5px] font-semibold">{impactOf(cs).label.replace('Effet attendu : ', '')}</dd>
            <dd className="m-0 hidden text-[13px] text-[var(--muted)] sm:block">{KIND_GAIN[cs.changes[0]?.kind ?? 'meta.title']} Sans garantie de résultat.</dd>
          </div>
        </div>
        <div className="ui-card" data-elevation="flat" data-tone={risk.tone === 'up' ? undefined : risk.tone === 'down' ? 'down' : 'warn'}>
          <div className="ui-card-body">
            <dt className="ui-caption text-[var(--muted)]">Risque</dt>
            <dd className="m-0 mt-1 text-[14.5px] font-semibold">{risk.label}</dd>
            <dd className="m-0 text-[13px] text-[var(--muted)]">{risk.help}</dd>
          </div>
        </div>
        <div className="ui-card" data-elevation="flat">
          <div className="ui-card-body">
            <dt className="ui-caption text-[var(--muted)]">Où</dt>
            <dd className="m-0 mt-1 text-[14.5px] font-semibold">{PLATFORM_NAME[cs.platform]}</dd>
            <dd className="m-0 hidden text-[13px] text-[var(--muted)] sm:block">{cs.platform === 'export' ? 'Fichiers prêts à déposer, avec les instructions.' : 'Écrit par l’agent, puis relu.'} Réversible.</dd>
          </div>
        </div>
      </dl>

      <Surface title={`Ce qui change (${cs.changes.length})`} id="ag-changes" elevation="raised">
        <div className="mb-4">
          <DiffLegend todo={cs.changes.some(needsCompletion)} />
        </div>
        {cs.changes.map((ch) => (
          <ChangeBlock
            key={ch.id}
            cs={cs}
            ch={ch}
            excluded={excluded.has(ch.id)}
            multiple={cs.changes.length > 1 && publish}
            editable={edit && busy === null && (cs.status === 'proposed' || cs.status === 'draft' || cs.status === 'validated')}
            onExclude={(x) =>
              setExcluded((prev) => {
                const n = new Set(prev);
                if (x) n.add(ch.id);
                else n.delete(ch.id);
                return n;
              })
            }
            onSave={(value) => saveEdit(ch.id, value)}
          />
        ))}
      </Surface>

      {showRelay && (
        <div ref={relayRef}>
          <Surface title={cs.platform === 'export' ? 'Préparation et vérification' : 'Application et vérification en direct'} id="ag-relay">
            {cs.status === 'verified' && !busy ? (
              <div className="ag-done" role="status">
                <span className="ag-done-mark" aria-hidden="true">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m5 12.5 4.5 4.5L19 7.5" />
                  </svg>
                </span>
                <div>
                  <p className="ag-done-t m-0">Appliqué et vérifié</p>
                  <p className="m-0 text-[13.5px]">
                    {cs.platform === 'export' ? 'Fichiers relus en ligne' : `Relu chez ${PLATFORM_NAME[cs.platform]} et sur la page publique`} le {when(cs.verifiedAt ?? cs.appliedAt!)}.
                  </p>
                </div>
              </div>
            ) : (
              <Relay cs={cs} states={relayStates} details={stepDetails} />
            )}
            {cs.platform === 'export' && live && (
              <p className="m-0 mt-3 text-[14px]">
                {a.demo ? (
                  <span className="text-[var(--muted)]">Démo : le téléchargement des fichiers est désactivé.</span>
                ) : (
                  <a className="ui-btn" data-size="sm" href={`/api/v5/publish/changesets/${cs.id}/export?businessId=${encodeURIComponent(a.businessId)}`}>
                    Télécharger les fichiers et les instructions
                  </a>
                )}
              </p>
            )}
          </Surface>
        </div>
      )}

      {effect && (
        <Surface title="Effet mesuré" id="ag-effect">
          <EffectView effect={effect} />
        </Surface>
      )}
      {!effect && cs.status === 'verified' && (
        <Surface title="Effet mesuré" id="ag-effect">
          <EffectView effect={{ csId: cs.id, appliedAt: cs.appliedAt ?? cs.updatedAt, dueAt: new Date(new Date(cs.appliedAt ?? cs.updatedAt).getTime() + 7 * 86_400_000).toISOString(), status: 'scheduled', demo: cs.demo }} />
        </Surface>
      )}

      {journal.length > 0 && (
        <Surface title="Historique de cette proposition" id="ag-hist" elevation="flat" aside={<span>Journal immuable</span>}>
          <JournalList entries={journal} changeSets={a.changeSets} meId={a.meId} withTitles={false} />
        </Surface>
      )}

      {error && (
        <p role="alert" className="m-0 rounded-lg bg-[var(--danger-bg)] px-3 py-2 text-[13.5px] text-[var(--danger-ink)]">
          {error}
        </p>
      )}

      {(msg || primary || secondary) && (
        <div className="ag-bar" role="region" aria-label="Décision">
          <p className="ag-bar-msg m-0">{msg}</p>
          <div className="ag-bar-acts">
            {secondary}
            {primary}
          </div>
        </div>
      )}

      <dialog ref={confirmRef} className="ag-dialog" aria-labelledby="ag-rv-t">
        <div className="ag-dlg-h">
          <p id="ag-rv-t" className="m-0 text-[17px] font-semibold">
            Annuler ce changement ?
          </p>
        </div>
        <div className="ag-dlg-b flex flex-col gap-3 text-[14.5px]">
          <p className="m-0">L’agent remet exactement la valeur d’avant, relue au moment de la proposition :</p>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {cs.changes
              .filter((c) => c.status === 'verified' || c.status === 'applied')
              .map((c) => (
                <li key={c.id} className="rounded-[10px] border border-[var(--hair)] bg-[var(--surface-2)] px-3 py-2">
                  <span className="ui-caption text-[var(--muted)]">{KIND_NAME[c.kind]}</span>
                  <span className="block text-[14px]">{c.before ? `« ${c.before.length > 160 ? `${c.before.slice(0, 160)}…` : c.before} »` : 'Rien (la modification est retirée)'}</span>
                </li>
              ))}
          </ul>
          <p className="m-0 text-[13.5px] text-[var(--muted)]">L’annulation est inscrite au journal. {cs.platform === 'export' ? 'Pour un export, remettez vous-même les fichiers « avant » de l’archive.' : ''}</p>
        </div>
        <div className="ag-dlg-f">
          <button type="button" className="ui-btn" onClick={() => confirmRef.current?.close()}>
            Garder le changement
          </button>
          <button type="button" className="ui-btn" data-variant="primary" onClick={revert}>
            Oui, revenir à l’avant
          </button>
        </div>
      </dialog>
    </div>
  );
}
