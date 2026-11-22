'use client';
// Éditeur d'un brouillon : texte (Markdown simple), aperçu (page + résultat Google), différences entre versions ou
// avec la page actuelle, contrôles (faits manquants, citabilité, structure, doublons), puis UNE action principale
// selon l'étape : compléter → valider → créer en brouillon sur le site (ou exporter) → mettre en ligne → mesurer.
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Disclosure } from '@/components/ui/Disclosure';
import { Tabs } from '@/components/ui/Tabs';
import { toast } from '@/components/ui/toast';
import { bodyToHtml, bodyToText } from '@/lib/content/markdown';
import { compareEffect } from '@/lib/content/effect';
import type { ContentDraft } from '@/lib/content/types';
import { diffWords } from '../agent/model';
import {
  declareLiveAction,
  editDraftAction,
  exportDraftAction,
  previewDraftAction,
  publishDraftAction,
  pushDraftAction,
  rejectDraftAction,
  removeDraftAction,
  unpublishDraftAction,
  validateDraftAction,
} from '@/app/app/contenu/actions';
import { canEdit, canValidate, fmtDate, nextStep, PAGE_TYPE_NAME, PLATFORM_NAME, plural, simPublish, simPush, simReject, simRemove, simUnpublish, simValidate, SOURCE_NAME, STATUS_VIEW, TODO_SPLIT } from './model';
import { useContent } from './state';

type View = 'texte' | 'apercu' | 'diff';

function markTodos(html: string): string {
  return html.replace(/\[\s*à compléter(?:\s*:[^\]]*)?\]/gi, (m) => `<mark class="ag-todo">${m}</mark>`);
}

function Marked({ text }: { text: string }) {
  return (
    <>
      {text.split(TODO_SPLIT).map((p, i) =>
        i % 2 ? (
          <mark key={i} className="ag-todo">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

function Check({ ok, block }: { ok: boolean; block?: boolean }) {
  return ok ? (
    <svg className="ct-ok" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-label="Conforme">
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  ) : (
    <svg className="ct-ko" data-block={block ? '' : undefined} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-label={block ? 'Bloquant' : 'À améliorer'}>
      <path d="M12 6v7M12 17.5v.5" />
    </svg>
  );
}

export function DraftEditor({ id }: { id: string }) {
  const c = useContent();
  const d = c.drafts.find((x) => x.id === id);
  if (!d) {
    return (
      <div className="ui-card">
        <div className="ui-card-body">
          <p className="m-0 font-semibold">Ce brouillon est introuvable.</p>
          <p className="mt-1 mb-3 text-[14px] text-[var(--muted)]">Il a peut-être été écarté{c.demo ? ', ou la démo a été remise à zéro' : ''}.</p>
          <Link className="ui-btn" href="/app/contenu">
            Retour aux contenus
          </Link>
        </div>
      </div>
    );
  }
  return <Editor key={`${d.id}:${d.version}`} d={d} />;
}

function Editor({ d }: { d: ContentDraft }) {
  const c = useContent();
  const editable = (d.status === 'draft' || d.status === 'validated') && canEdit(c.role);
  const [view, setView] = useState<View>('texte');
  const [f, setF] = useState({ title: d.title, slug: d.slug, metaTitle: d.metaTitle, metaDescription: d.metaDescription, body: d.body });
  const [busy, setBusy] = useState<string | null>(null);
  const [liveUrl, setLiveUrl] = useState('');
  const dirty = f.title !== d.title || f.slug !== d.slug || f.metaTitle !== d.metaTitle || f.metaDescription !== d.metaDescription || f.body !== d.body;
  const st = STATUS_VIEW[d.status];
  const step = nextStep(d, c.platforms);
  const now = () => new Date();

  const run = async (label: string, fn: () => Promise<{ ok: true; draft: ContentDraft } | { ok: false; error: string }>, done: string) => {
    setBusy(label);
    try {
      const r = await fn();
      if (!r.ok) return toast({ text: r.error, tone: 'error' });
      c.putDraft(r.draft);
      toast({ text: done, tone: 'success' });
      if (!c.demo) c.refresh();
    } finally {
      setBusy(null);
    }
  };
  const sim = (label: string, fn: () => ContentDraft, done: string) => {
    try {
      c.putDraft(fn());
      toast({ text: done, tone: 'success' });
    } catch (e) {
      toast({ text: e instanceof Error ? e.message : 'Action impossible.', tone: 'error' });
    }
    void label;
  };

  const save = () => run('save', () => (c.demo ? previewDraftAction(d, f) : editDraftAction(c.businessId, d.id, f)), 'Modifications enregistrées. Les contrôles sont à jour.');

  const primary = async () => {
    if (dirty) return save();
    switch (step.id) {
      case 'complete':
        setView('texte');
        document.getElementById('ct-body')?.focus();
        return;
      case 'validate':
        return c.demo ? sim('validate', () => simValidate(d, now()), 'Contenu validé.') : run('validate', () => validateDraftAction(c.businessId, d.id), 'Contenu validé.');
      case 'push': {
        const p = c.platforms.find((x) => (d.format === 'page' || d.action === 'rewrite' ? x.page : x.article))?.platform ?? c.platforms[0]?.platform;
        if (c.quota.left <= 0) return toast({ text: c.quota.limit ? 'Plafond du mois atteint : ce contenu attendra le mois prochain.' : 'La publication est incluse à partir de l’offre Essentiel.', tone: 'error' });
        if (c.demo) return sim('push', () => simPush(d, p ?? 'wordpress', now(), c.site), `Créé en brouillon sur ${PLATFORM_NAME[p ?? 'wordpress']} (simulation) : invisible du public.`);
        setBusy('push');
        try {
          const r = await pushDraftAction(c.businessId, d.id);
          if (!r.ok) return toast({ text: r.error, tone: 'error' });
          c.putDraft(r.draft);
          toast(r.changeSetId ? { text: 'Mise à jour préparée dans l’agent : relisez l’avant / après exact puis appliquez.', tone: 'success', href: `/app/agent/${r.changeSetId}`, linkLabel: 'Ouvrir' } : { text: 'Créé en brouillon sur votre site : invisible du public tant que vous ne le mettez pas en ligne.', tone: 'success' });
          c.refresh();
        } finally {
          setBusy(null);
        }
        return;
      }
      case 'export':
        return doExport();
      case 'publish':
        if (!window.confirm('Mettre ce contenu en ligne sur votre site ? Vous pourrez le retirer à tout moment.')) return;
        return c.demo ? sim('publish', () => simPublish(d, now()), 'En ligne (simulation). La mesure J+30 démarre.') : run('publish', () => publishDraftAction(c.businessId, d.id), 'En ligne. La mesure J+30 démarre.');
      case 'agent':
        window.location.href = `/app/agent/${d.remote?.extra?.changeSetId}`;
        return;
      case 'declare':
        document.getElementById('ct-live')?.focus();
        return;
    }
  };

  const doExport = async () => {
    if (c.demo) return sim('export', () => ({ ...d, status: 'exported', consumedAt: d.consumedAt ?? new Date().toISOString(), version: d.version + 1, updatedAt: new Date().toISOString() }), 'Export simulé : en compte réel, vous téléchargez page.html, page.md et jsonld.json.');
    setBusy('export');
    try {
      const r = await exportDraftAction(c.businessId, d.id);
      if (!r.ok) return toast({ text: r.error, tone: 'error' });
      const bin = Uint8Array.from(atob(r.base64), (ch) => ch.charCodeAt(0));
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([bin], { type: 'application/zip' }));
      a.download = r.filename;
      a.click();
      URL.revokeObjectURL(a.href);
      c.putDraft(r.draft);
      toast({ text: 'Fichiers téléchargés. Revenez indiquer l’adresse une fois la page publiée.', tone: 'success' });
    } finally {
      setBusy(null);
    }
  };

  const declare = () => {
    if (!/^https?:\/\/\S+\.\S+/.test(liveUrl)) return toast({ text: 'Indiquez l’adresse complète de la page (https://…).', tone: 'error' });
    if (c.demo) return sim('declare', () => ({ ...d, status: 'published', liveUrl, publishedAt: new Date().toISOString(), version: d.version + 1, updatedAt: new Date().toISOString() }), 'Adresse enregistrée (simulation). La mesure J+30 démarre.');
    return run('declare', () => declareLiveAction(c.businessId, d.id, liveUrl), 'Adresse enregistrée. La mesure J+30 démarre.');
  };

  const unpublish = () => {
    if (!window.confirm('Retirer ce contenu de la ligne ? Il reste en brouillon sur votre site.')) return;
    return c.demo ? sim('unpublish', () => simUnpublish(d, now()), 'Retiré de la ligne (simulation).') : run('unpublish', () => unpublishDraftAction(c.businessId, d.id), 'Retiré de la ligne.');
  };
  const remove = () => {
    if (!window.confirm(d.platform === 'wordpress' || d.platform === 'wix' ? 'Mettre ce contenu à la corbeille de votre site ?' : 'Supprimer définitivement ce contenu de votre site ? Cette plateforme n’a pas de corbeille.')) return;
    return c.demo ? sim('remove', () => simRemove(d, now()), 'Mis à la corbeille (simulation).') : run('remove', () => removeDraftAction(c.businessId, d.id), 'Contenu retiré de votre site.');
  };
  const reject = () => {
    if (!window.confirm('Écarter ce brouillon ?')) return;
    return c.demo ? sim('reject', () => simReject(d, now()), 'Brouillon écarté (simulation).') : run('reject', () => rejectDraftAction(c.businessId, d.id), 'Brouillon écarté.');
  };

  const shown = dirty ? { ...d, ...f } : d;
  const todoCount = (shown.body.match(/\[\s*à compléter[^\]]*\]/gi) ?? []).length + (`${shown.title}${shown.metaTitle}${shown.metaDescription}`.match(/\[\s*à compléter[^\]]*\]/gi) ?? []).length;
  const canAct = step.id === 'complete' || step.id === 'declare' || (canValidate(c.role) && step.id !== 'none');
  const barMsg = dirty
    ? { tone: 'warn', text: 'Modifications non enregistrées : les contrôles seront recalculés.' }
    : step.id === 'complete'
      ? { tone: 'warn', text: `${plural(todoCount, 'information manque', 'informations manquent')} : complétez le texte ou vos faits clés. La validation est bloquée.` }
      : step.id === 'validate'
        ? { tone: '', text: 'Relisez l’aperçu. Valider ne publie rien : la page sera d’abord créée en brouillon.' }
        : step.id === 'push'
          ? { tone: '', text: `${c.quota.left} contenu${c.quota.left > 1 ? 's' : ''} possible${c.quota.left > 1 ? 's' : ''} ce mois-ci. Le contenu sera invisible du public jusqu’à sa mise en ligne.` }
          : step.id === 'export'
            ? { tone: '', text: 'Aucune connexion ne sait créer ce contenu : export en HTML et Markdown, à coller dans votre outil.' }
            : step.id === 'publish'
              ? { tone: '', text: `Relisez le brouillon dans ${d.platform ? PLATFORM_NAME[d.platform] : 'votre outil'}${d.remote?.editUrl ? '' : ''}, puis mettez-le en ligne.` }
              : d.status === 'published'
                ? { tone: '', text: `En ligne depuis le ${fmtDate(d.publishedAt)}. Mesure de l’effet à J+30 et J+90.` }
                : { tone: '', text: STATUS_VIEW[d.status].label };

  return (
    <>
      <nav className="mb-3 text-[13.5px]">
        <Link href="/app/contenu" className="text-[var(--muted)] underline-offset-2 hover:underline">
          ← Contenus
        </Link>
      </nav>
      <header className="mb-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="ct-chip" data-tone={st.tone}>
            {st.label}
          </span>
          <span className="ct-chip">{d.action === 'rewrite' ? 'Réécriture' : PAGE_TYPE_NAME[d.pageType]}</span>
          <span className="ct-chip">{d.writer === 'ia' ? 'Rédigé par l’IA à partir de vos faits' : 'Modèle structuré, vos faits uniquement'}</span>
          {d.demo && <span className="ct-fic">Exemple fictif</span>}
        </div>
        <h1 className="m-0 text-[24px] font-bold leading-tight text-[var(--ink)]">{shown.title}</h1>
        <p className="mt-1 mb-0 text-[14px] text-[var(--muted)]">
          Vise : « {d.target} »{d.existing ? ` · page actuelle ${d.existing.url.replace(/^https?:\/\/[^/]+/, '')}` : ''}
          {d.remote?.editUrl && (
            <>
              {' · '}
              <a className="underline underline-offset-2" href={d.remote.editUrl} target="_blank" rel="noreferrer">
                Ouvrir dans {PLATFORM_NAME[d.remote.platform]}
              </a>
            </>
          )}
          {d.liveUrl && d.status === 'published' && (
            <>
              {' · '}
              <a className="underline underline-offset-2" href={d.liveUrl} target="_blank" rel="noreferrer">
                Voir la page
              </a>
            </>
          )}
        </p>
        {d.writerNote && <p className="mt-2 mb-0 text-[13px] text-[var(--muted)]">{d.writerNote}</p>}
      </header>

      <div className="ct-ed">
        <div className="min-w-0">
          <Tabs
            label="Vue du brouillon"
            variant="pill"
            idBase="ct-view"
            className="mb-3"
            value={view}
            onChange={(v) => setView(v as View)}
            items={[
              { id: 'texte', label: 'Texte' },
              { id: 'apercu', label: 'Aperçu' },
              { id: 'diff', label: d.existing ? 'Avant / après' : 'Différences', count: d.history.length > 1 ? d.history.length : undefined },
            ]}
          />
          <div role="tabpanel" id="ct-view-panel" className="ct-pane" key={view}>
            {view === 'texte' && <TextView f={f} setF={setF} d={d} editable={editable} />}
            {view === 'apercu' && <Preview d={shown} site={c.site} />}
            {view === 'diff' && <DiffPane d={d} current={f.body} />}
          </div>
          {d.status === 'exported' && (
            <div className="ct-pane mt-4">
              <div className="ct-pane-b">
                <label className="ct-field" htmlFor="ct-live">
                  <span>Adresse de la page une fois publiée par vous</span>
                  <input id="ct-live" type="url" inputMode="url" placeholder="https://" value={liveUrl} onChange={(e) => setLiveUrl(e.target.value)} />
                </label>
                <button type="button" className="ui-btn" onClick={declare} disabled={!!busy}>
                  Enregistrer l’adresse et démarrer la mesure
                </button>
              </div>
            </div>
          )}
        </div>
        <Side d={shown} checks={d} />
      </div>

      <div className="ct-bar" role="region" aria-label="Actions">
        <p className="ct-bar-msg m-0" data-tone={barMsg.tone || undefined}>
          {barMsg.text}
        </p>
        {d.status === 'published' && canValidate(c.role) && (
          <button type="button" className="ui-btn" data-variant="ghost" onClick={unpublish} disabled={!!busy}>
            Retirer de la ligne
          </button>
        )}
        {(d.status === 'remote_draft' || d.status === 'unpublished') && !d.remote?.extra?.changeSetId && canValidate(c.role) && (
          <button type="button" className="ui-btn" data-variant="ghost" onClick={remove} disabled={!!busy}>
            {d.platform === 'wordpress' || d.platform === 'wix' ? 'Mettre à la corbeille' : 'Supprimer du site'}
          </button>
        )}
        {d.status === 'validated' && step.id === 'push' && canValidate(c.role) && (
          <button type="button" className="ui-btn" data-variant="ghost" onClick={doExport} disabled={!!busy}>
            Exporter plutôt
          </button>
        )}
        {(d.status === 'draft' || d.status === 'validated') && canValidate(c.role) && (
          <button type="button" className="ui-btn" data-variant="ghost" onClick={reject} disabled={!!busy}>
            Écarter
          </button>
        )}
        {(dirty ? editable : canAct && step.id !== 'none') && (
          <button type="button" className="ui-btn" data-variant="primary" onClick={primary} disabled={!!busy} aria-busy={!!busy}>
            {busy ? 'En cours…' : dirty ? 'Enregistrer les modifications' : step.label}
          </button>
        )}
      </div>
    </>
  );
}

function Counter({ n, min, max }: { n: number; min: number; max: number }) {
  return (
    <span className="ct-count" data-bad={n < min || n > max ? '' : undefined}>
      {n} / {max}
    </span>
  );
}

function TextView({ f, setF, d, editable }: { f: { title: string; slug: string; metaTitle: string; metaDescription: string; body: string }; setF: (v: typeof f) => void; d: ContentDraft; editable: boolean }) {
  return (
    <div className="ct-pane-b">
      {!editable && <p className="mt-0 mb-3 text-[13px] text-[var(--muted)]">{d.status === 'draft' || d.status === 'validated' ? 'Lecture seule : votre rôle ne permet pas de modifier.' : 'Ce contenu est sur votre site : modifiez-le là-bas, ou retirez-le puis recréez-le.'}</p>}
      <label className="ct-field">
        <span>Titre de la page (H1)</span>
        <input value={f.title} readOnly={!editable} onChange={(e) => setF({ ...f, title: e.target.value })} />
      </label>
      {d.action === 'create' && (
        <label className="ct-field">
          <span>Adresse</span>
          <input value={f.slug} readOnly={!editable} onChange={(e) => setF({ ...f, slug: e.target.value })} />
        </label>
      )}
      <label className="ct-field">
        <span>
          Titre dans Google <Counter n={f.metaTitle.length} min={20} max={60} />
        </span>
        <input value={f.metaTitle} readOnly={!editable} onChange={(e) => setF({ ...f, metaTitle: e.target.value })} />
      </label>
      <label className="ct-field">
        <span>
          Description dans Google <Counter n={f.metaDescription.length} min={70} max={160} />
        </span>
        <textarea style={{ minHeight: 70, font: 'inherit', fontSize: 15 }} value={f.metaDescription} readOnly={!editable} onChange={(e) => setF({ ...f, metaDescription: e.target.value })} />
      </label>
      <label className="ct-field" htmlFor="ct-body">
        <span>
          Texte — « ## » pour un intertitre, « - » pour une liste, [texte](/adresse) pour un lien
          <span>{bodyToText(f.body).split(/\s+/).filter(Boolean).length} mots</span>
        </span>
        <textarea id="ct-body" value={f.body} readOnly={!editable} onChange={(e) => setF({ ...f, body: e.target.value })} spellCheck lang="fr" />
      </label>
    </div>
  );
}

function Preview({ d, site }: { d: Pick<ContentDraft, 'title' | 'metaTitle' | 'metaDescription' | 'body' | 'slug' | 'format' | 'existing'>; site: string }) {
  const html = useMemo(() => markTodos(bodyToHtml(d.body)), [d.body]);
  const url = d.existing?.url ?? `${site.replace(/\/$/, '')}/${d.format === 'article' ? 'blog/' : ''}${d.slug}`;
  return (
    <div>
      <div className="ct-pane-b pb-0">
        <div className="ct-serp" aria-label="Aperçu dans les résultats Google">
          <div className="ct-serp-u">{url.replace(/^https?:\/\//, '')}</div>
          <div className="ct-serp-t">
            <Marked text={d.metaTitle || d.title} />
          </div>
          <div className="ct-serp-d">
            <Marked text={d.metaDescription || '(description générée à partir du texte)'} />
          </div>
        </div>
      </div>
      <article className="ct-prev">
        <h1>
          <Marked text={d.title} />
        </h1>
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </article>
    </div>
  );
}

function DiffPane({ d, current }: { d: ContentDraft; current: string }) {
  const bases = [
    ...(d.existing?.text ? [{ id: 'page', label: 'Page actuelle', text: d.existing.text }] : []),
    ...d.history.slice(0, -1).map((h, i) => ({ id: `v${i}`, label: `Version du ${fmtDate(h.at)} (${h.by})`, text: h.body })),
  ].reverse();
  const [base, setBase] = useState(bases[0]?.id ?? '');
  const b = bases.find((x) => x.id === base);
  const segs = useMemo(() => (b ? diffWords(bodyToText(b.text), bodyToText(current)) : []), [b, current]);
  if (!bases.length) return <p className="ct-pane-b m-0 text-[14px] text-[var(--muted)]">Première version : les différences apparaîtront après vos modifications.</p>;
  return (
    <div className="ct-pane-b">
      <label className="mb-3 flex flex-wrap items-center gap-2 text-[13.5px] text-[var(--muted)]">
        Comparer avec
        <select className="ct-select" value={base} onChange={(e) => setBase(e.target.value)}>
          {bases.map((x) => (
            <option key={x.id} value={x.id}>
              {x.label}
            </option>
          ))}
        </select>
      </label>
      <div className="ag-legend mb-2">
        <span>
          <span className="ag-del px-1">retiré</span>
        </span>
        <span>
          <span className="ag-add px-1">ajouté</span>
        </span>
        <span>
          <mark className="ag-todo px-1">à compléter</mark>
        </span>
      </div>
      <p className="ag-txt" style={{ padding: 0 }}>
        {segs.map((s, i) =>
          s.t === 'del' ? (
            <span key={i} className="ag-del">
              {s.s}
            </span>
          ) : s.t === 'add' ? (
            <span key={i} className="ag-add">
              <Marked text={s.s} />
            </span>
          ) : (
            <Marked key={i} text={s.s} />
          ),
        )}
      </p>
    </div>
  );
}

function Side({ d, checks }: { d: ContentDraft; checks: ContentDraft }) {
  const effect = d.effect;
  const lastSnap = effect?.d90 ?? effect?.d30;
  const deltas = effect && lastSnap ? compareEffect(effect.baseline, lastSnap) : [];
  const weakest = [...checks.citability.passages].sort((a, b) => a.score - b.score).slice(0, 3);
  return (
    <aside className="ct-side" aria-label="Contrôles du brouillon">
      {checks.missing.length > 0 && (
        <div className="ct-pane ct-pane-b">
          <h3>Ce que vous seul savez</h3>
          <ul className="ct-missing">
            {checks.missing.map((m) => (
              <li key={m}>
                <mark className="ag-todo px-1.5 py-0.5 text-[13px]">{m}</mark>
              </li>
            ))}
          </ul>
          <p className="mt-2 mb-0 text-[13px] text-[var(--muted)]">
            Complétez le texte, ou vos <Link className="underline underline-offset-2" href="/app/contenu/faits">faits clés</Link> : ils resserviront à chaque page.
          </p>
        </div>
      )}
      <div className="ct-pane ct-pane-b">
        <h3>Contrôles</h3>
        <ul className="ct-checks">
          {checks.checks.map((k) => (
            <li key={k.id}>
              <Check ok={k.ok} block={k.blocking} />
              <span>
                {k.label}
                <small>{k.detail}</small>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="ct-pane ct-pane-b">
        <h3>Citabilité par les IA</h3>
        <div className="ct-gauge" role="img" aria-label={`${checks.citability.score} sur 100`}>
          <i style={{ width: `${checks.citability.score}%` }} />
        </div>
        <p className="m-0 text-[13px] text-[var(--muted)]">{checks.citability.score}/100 — heuristique de rédaction (réponse directe, chiffres, date, source, noms propres), pas une garantie de citation.</p>
        {weakest.length > 0 && weakest[0].score < 70 && (
          <ul className="mt-2 mb-0 pl-4 text-[13px] text-[var(--muted)]">
            {weakest
              .filter((p) => p.score < 70)
              .map((p, i) => (
                <li key={i}>
                  <b className="text-[var(--ink)]">{p.heading ?? 'Introduction'}</b> ({p.score}) : {p.missing.slice(0, 2).join(' ; ')}
                </li>
              ))}
          </ul>
        )}
      </div>
      {effect && (
        <div className="ct-pane ct-pane-b">
          <h3>Effet mesuré</h3>
          {deltas.length ? (
            <ul className="ct-checks">
              {deltas.map((x) => (
                <li key={x.label} style={{ gridTemplateColumns: '1fr' }}>
                  <span>
                    {x.label} : {x.before} → <b>{x.after}</b>
                    <small>{x.note ?? (x.tone === 'up' ? 'en hausse' : x.tone === 'down' ? 'en baisse' : x.tone === 'flat' ? 'stable' : 'pas de comparaison possible')}</small>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 text-[13px] text-[var(--muted)]">Référence prise le {fmtDate(effect.publishedAt)}. Première mesure à J+30, puis J+90.</p>
          )}
          <p className="mt-2 mb-0 text-[12px] text-[var(--muted)]">D’autres facteurs jouent : l’écart n’est pas attribué à la seule page.</p>
        </div>
      )}
      <div className="ct-pane ct-pane-b">
        <h3>Pourquoi cette page</h3>
        <ul className="ct-ev" style={{ marginTop: 0 }}>
          {d.evidence.slice(0, 4).map((e, i) => (
            <li key={i}>
              <span className="ct-ev-src">{SOURCE_NAME[e.source]}</span>
              {e.text}
            </li>
          ))}
        </ul>
      </div>
      {checks.cannibal.length > 0 && (
        <div className="ct-pane ct-pane-b">
          <h3>Pages proches sur votre site</h3>
          <ul className="m-0 flex flex-col gap-2 pl-0 text-[13px]" style={{ listStyle: 'none' }}>
            {checks.cannibal.map((x) => (
              <li key={x.url}>
                <span className="ct-chip" data-tone={x.level === 'fort' ? 'warn' : undefined}>
                  {x.level === 'fort' ? 'Même sujet' : 'Sujet voisin'}
                </span>{' '}
                {x.title}
                <small className="block text-[var(--muted)]">{x.advice}</small>
              </li>
            ))}
          </ul>
        </div>
      )}
      {d.links.length > 0 && (
        <div className="ct-pane ct-pane-b">
          <h3>Maillage interne proposé</h3>
          <ul className="m-0 flex flex-col gap-1.5 pl-4 text-[13px]">
            {d.links.map((l, i) => (
              <li key={i}>
                {l.direction === 'depuis_brouillon' ? `Lien vers ${l.url}` : `Ajouter un lien depuis ${l.url}`}
                <small className="block text-[var(--muted)]">{l.reason}</small>
              </li>
            ))}
          </ul>
        </div>
      )}
      {d.sources.length > 0 && (
        <div className="ct-pane ct-pane-b">
          <h3>Sources publiques citées</h3>
          <ol className="m-0 flex flex-col gap-1 pl-5 text-[13px]">
            {d.sources.map((s) => (
              <li key={s.n}>
                <a className="underline underline-offset-2" href={s.url} target="_blank" rel="noreferrer">
                  {s.title}
                </a>
                <small className="block text-[var(--muted)]">{s.note}</small>
              </li>
            ))}
          </ol>
        </div>
      )}
      {d.jsonLd.length > 0 && (
        <Disclosure title="Données structurées (JSON-LD)" summary={`${d.jsonLd.length} bloc${d.jsonLd.length > 1 ? 's' : ''}, construits depuis vos faits`}>
          <pre className="ag-txt m-0 max-h-72 overflow-auto" data-code="">
            {d.jsonLd.map((j) => JSON.stringify(JSON.parse(j), null, 2)).join('\n\n')}
          </pre>
        </Disclosure>
      )}
    </aside>
  );
}
