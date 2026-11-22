'use client';
// Mentions à obtenir : sites cités par les IA sur vos questions, message rédigé, suivi « demandé / obtenu ».
// Rien n'est envoyé par Repéré : copier le message ou l'ouvrir dans votre messagerie.
import { useState } from 'react';
import { toast } from '@/components/ui/toast';
import type { MentionStatus, MentionTarget, MentionTracking } from '@/lib/content/types';
import { mentionStatusAction } from '@/app/app/contenu/actions';
import { canEdit, fmtDate, MENTION_STATUS, plural, TODO_SPLIT, TODO_TEST } from './model';
import { useContent } from './state';

export function MentionsResult() {
  const c = useContent();
  const got = c.tracking.filter((t) => t.status === 'obtenu').length;
  if (!c.mentions.length) return <>Aucun site à viser pour l’instant</>;
  return (
    <>
      {plural(c.mentions.length, 'site cité par les IA', 'sites cités par les IA')} où vous manquez{got ? ` · ${plural(got, 'mention obtenue', 'mentions obtenues')}` : ''}
    </>
  );
}

export function MentionsList() {
  const c = useContent();
  if (!c.mentions.length) {
    return (
      <div className="ui-card">
        <div className="ui-card-body">
          <p className="m-0 font-semibold">Pas encore de site à viser.</p>
          <p className="mt-1 mb-0 text-[14px] text-[var(--muted)]">
            {c.sources.audit ? 'Les IA ne citent pas de source où vous manquez sur vos questions suivies.' : 'Cette liste se remplit après une mesure IA : elle part des sources que les IA citent vraiment.'}
          </p>
        </div>
      </div>
    );
  }
  return (
    <div>
      {c.mentions.map((m) => (
        <Mention key={m.id} m={m} t={c.tracking.find((x) => x.id === m.id)} />
      ))}
    </div>
  );
}

function Mention({ m, t }: { m: MentionTarget; t?: MentionTracking }) {
  const c = useContent();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(t?.url ?? '');
  const status: MentionStatus = t?.status ?? 'a_faire';
  const st = MENTION_STATUS[status];
  const incomplete = TODO_TEST.test(`${m.message.subject}\n${m.message.body}`);
  const set = async (s: MentionStatus) => {
    const extra = s === 'obtenu' && url ? { url } : {};
    if (c.demo) {
      c.putTracking({ id: m.id, businessId: c.businessId, status: s, ...(s === 'demande' ? { requestedAt: new Date().toISOString() } : {}), ...(s === 'obtenu' ? { obtainedAt: new Date().toISOString(), ...extra } : {}), updatedAt: new Date().toISOString() });
      return toast({ text: `Suivi mis à jour : ${MENTION_STATUS[s].label.toLowerCase()} (simulation).`, tone: 'success' });
    }
    const r = await mentionStatusAction(c.businessId, m.id, s, extra);
    if (!r.ok) return toast({ text: r.error, tone: 'error' });
    c.putTracking(r.tracking);
    toast({ text: `Suivi mis à jour : ${MENTION_STATUS[s].label.toLowerCase()}.`, tone: 'success' });
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${m.message.subject}\n\n${m.message.body}`);
      toast({ text: incomplete ? 'Message copié : complétez les « [à compléter] » avant de l’envoyer.' : 'Message copié.', tone: 'success' });
    } catch {
      toast({ text: 'Copie impossible : sélectionnez le texte à la main.', tone: 'error' });
    }
  };
  return (
    <article className="ct-op">
      <div className="ct-op-head">
        <div className="min-w-0">
          <h3 className="ct-op-t">{m.label}</h3>
          <p className="ct-op-why">{m.why}</p>
          <div className="ct-meta">
            <span>{m.categoryLabel}</span>
            <span>{m.domain}</span>
            {t?.requestedAt && <span>Demandé le {fmtDate(t.requestedAt)}</span>}
            {t?.obtainedAt && <span>Obtenu le {fmtDate(t.obtainedAt)}</span>}
            {(m.demo || t?.note === 'Exemple fictif') && <span className="ct-fic">Démo</span>}
          </div>
        </div>
        <span className="ct-chip" data-tone={st.tone}>
          {st.label}
        </span>
      </div>
      <p className="mt-2 mb-0 text-[13.5px] text-[var(--ink)]">
        <b>Comment : </b>
        {m.contact ?? m.steps[0]}
      </p>
      {m.caution && <p className="ct-caution">{m.caution}</p>}
      <button type="button" className="mt-2 text-[13.5px] text-[var(--primary)] underline underline-offset-2" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? 'Masquer le message' : 'Voir le message rédigé'}
      </button>
      {open && (
        <>
          <div className="ct-mn-msg">
            <b>Objet : </b>
            {m.message.subject.split(TODO_SPLIT).map((p, i) => (i % 2 ? <mark key={i} className="ag-todo">{p}</mark> : <span key={i}>{p}</span>))}
            {'\n\n'}
            {m.message.body.split(TODO_SPLIT).map((p, i) => (i % 2 ? <mark key={i} className="ag-todo">{p}</mark> : <span key={i}>{p}</span>))}
          </div>
          <ol className="mt-2 mb-0 pl-5 text-[13px] text-[var(--muted)]">
            {m.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </>
      )}
      {canEdit(c.role) && (
        <div className="ct-op-actions items-center">
          <button type="button" className="ui-btn" onClick={copy}>
            Copier le message
          </button>
          {status === 'a_faire' && (
            <button type="button" className="ui-btn" data-variant="primary" onClick={() => set('demande')}>
              Je l’ai envoyé
            </button>
          )}
          {status === 'demande' && (
            <>
              <input className="ct-select min-w-0 flex-1" style={{ maxWidth: 320 }} type="url" placeholder="Adresse de la mention (facultatif)" aria-label="Adresse de la mention" value={url} onChange={(e) => setUrl(e.target.value)} />
              <button type="button" className="ui-btn" data-variant="primary" onClick={() => set('obtenu')}>
                Obtenu
              </button>
              <button type="button" className="ui-btn" data-variant="ghost" onClick={() => set('refuse')}>
                Refusé
              </button>
            </>
          )}
          {(status === 'obtenu' || status === 'refuse') && (
            <button type="button" className="ui-btn" data-variant="ghost" onClick={() => set('a_faire')}>
              Remettre à faire
            </button>
          )}
          {t?.url && (
            <a className="text-[13.5px] underline underline-offset-2" href={t.url} target="_blank" rel="noreferrer">
              Voir la mention
            </a>
          )}
        </div>
      )}
    </article>
  );
}
