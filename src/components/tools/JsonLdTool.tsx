'use client';
import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';
import type { JsonLdValidation } from '@/lib/siteaudit/types';
import type { GenerateResult, GenerateType } from '@/lib/siteaudit/jsonld';
import { buttonClasses } from '@/components/ui/Button';
import { callTool, hostOf, normalizeUrl } from './api';
import { AuditBridge, CodeBlock, EmailCapture, ErrorBox, ExampleNote, Loading, ResultHeader, Scope, ShareLink, StatusPill, UrlField, useShareParams, useToolRun } from './ui';

type Field = { key: string; label: string; hint?: string; long?: boolean; required?: boolean; type?: 'text' | 'url' | 'tel' };

const FIELDS: Record<Exclude<GenerateType, 'FAQPage'>, Field[]> = {
  LocalBusiness: [
    { key: 'name', label: 'Nom de l’établissement', required: true },
    { key: 'trade', label: 'Métier', hint: 'ex. plombier, restaurant : choisit le type précis (Plumber, Restaurant…)' },
    { key: 'url', label: 'Site web', type: 'url' },
    { key: 'telephone', label: 'Téléphone', type: 'tel' },
    { key: 'address', label: 'Adresse', hint: 'Numéro, rue, code postal, ville' },
    { key: 'city', label: 'Ville' },
    { key: 'openingHours', label: 'Horaires', hint: 'ex. Lun-ven 8h-19h, sam 9h-13h' },
    { key: 'priceRange', label: 'Gamme de prix', hint: 'ex. €€ ou « Devis gratuit, déplacement 49 € »' },
    { key: 'areaServed', label: 'Zone d’intervention', hint: 'Villes séparées par des virgules' },
    { key: 'services', label: 'Services', hint: 'Séparés par des virgules', long: true },
    { key: 'description', label: 'Description courte', long: true },
    { key: 'logo', label: 'Adresse du logo', type: 'url' },
    { key: 'sameAs', label: 'Profils officiels', hint: 'Une adresse par ligne (fiche Google, Facebook, LinkedIn…)', long: true },
  ],
  Organization: [
    { key: 'name', label: 'Nom de l’entreprise', required: true },
    { key: 'url', label: 'Site web', type: 'url' },
    { key: 'description', label: 'Description courte', long: true },
    { key: 'logo', label: 'Adresse du logo', type: 'url' },
    { key: 'telephone', label: 'Téléphone', type: 'tel' },
    { key: 'address', label: 'Adresse du siège' },
    { key: 'foundingYear', label: 'Année de création' },
    { key: 'founder', label: 'Fondateur ou fondatrice' },
    { key: 'sameAs', label: 'Profils officiels', hint: 'Une adresse par ligne', long: true },
  ],
  Product: [
    { key: 'name', label: 'Nom du produit', required: true },
    { key: 'brand', label: 'Marque' },
    { key: 'description', label: 'Description', long: true },
    { key: 'url', label: 'Adresse de la fiche', type: 'url' },
    { key: 'image', label: 'Adresse de l’image', type: 'url' },
    { key: 'sku', label: 'Référence (SKU)' },
    { key: 'gtin', label: 'GTIN / EAN', hint: '8, 12, 13 ou 14 chiffres' },
    { key: 'category', label: 'Catégorie' },
    { key: 'price', label: 'Prix', hint: 'ex. 14.90' },
    { key: 'currency', label: 'Devise', hint: 'Code à 3 lettres, ex. EUR' },
  ],
};

const TYPES: { id: GenerateType; label: string; hint: string }[] = [
  { id: 'LocalBusiness', label: 'Commerce local', hint: 'Adresse, horaires, zone' },
  { id: 'Organization', label: 'Organisation', hint: 'Entreprise sans accueil' },
  { id: 'Product', label: 'Produit', hint: 'Fiche produit' },
  { id: 'FAQPage', label: 'FAQ', hint: 'Questions-réponses' },
];

function ValidationView({ v }: { v: JsonLdValidation }) {
  const total = v.errors.length + v.blocks.reduce((n, b) => n + b.errors.length, 0);
  return (
    <div className="space-y-4">
      <div className={`rounded-xl p-4 ${v.blocks.length === 0 ? 'bg-warning-bg text-warning-ink' : total ? 'bg-danger-bg text-danger-ink' : 'bg-success-bg text-success-ink'}`}>
        <p className="font-semibold">
          {v.blocks.length === 0
            ? 'Aucun bloc JSON-LD trouvé.'
            : `${v.blocks.length} bloc${v.blocks.length > 1 ? 's' : ''} trouvé${v.blocks.length > 1 ? 's' : ''}, ${total ? `${total} erreur${total > 1 ? 's' : ''}` : 'aucune erreur bloquante'}.`}
        </p>
        {v.microdataTypes.length > 0 && <p className="mt-1 text-sm">Microdonnées repérées : {v.microdataTypes.join(', ')}.</p>}
      </div>
      {[...v.errors.map((e) => ['fail', e] as const), ...v.warnings.map((e) => ['warn', e] as const)].length > 0 && (
        <ul className="space-y-2">
          {v.errors.map((e) => (
            <li key={e} className="flex gap-2">
              <StatusPill status="fail" label="Erreur" />
              <span>{e}</span>
            </li>
          ))}
          {v.warnings.map((e) => (
            <li key={e} className="flex gap-2">
              <StatusPill status="warn" label="Attention" />
              <span>{e}</span>
            </li>
          ))}
        </ul>
      )}
      {v.blocks.map((b) => (
        <details key={b.index} className="rt-details rounded-xl border border-line bg-white" open={b.index === 0 || !b.valid}>
          <summary className="flex cursor-pointer items-center gap-3 px-4 py-3">
            <StatusPill status={!b.valid || b.errors.length ? 'fail' : b.missing.length || b.warnings.length ? 'warn' : 'ok'} label={!b.valid || b.errors.length ? 'Erreur' : b.missing.length ? 'Incomplet' : 'Valide'} />
            <span className="min-w-0 flex-1 font-medium">
              Bloc {b.index + 1} : {b.types.join(', ') || 'type inconnu'}
            </span>
          </summary>
          <div className="rt-details-body space-y-2 px-4 pb-4 text-[0.95rem]">
            {b.errors.map((e) => (
              <p key={e} className="text-danger-ink">
                Erreur : {e}
              </p>
            ))}
            {b.warnings.map((e) => (
              <p key={e} className="text-warning-ink">
                Attention : {e}
              </p>
            ))}
            {b.missing.length > 0 && (
              <p>
                Champs recommandés absents : <strong>{b.missing.join(', ')}</strong>.
              </p>
            )}
            {b.valid && !b.errors.length && !b.warnings.length && !b.missing.length && <p className="text-success-ink">Rien à signaler sur ce bloc.</p>}
          </div>
        </details>
      ))}
      {v.missing.length > 0 && (
        <p>
          Champs recommandés absents : <strong>{v.missing.join(', ')}</strong>.
        </p>
      )}
      <p className="text-sm text-muted">
        {v.note} Pour recouper :{' '}
        <a href="https://validator.schema.org/" rel="noopener" className="underline underline-offset-2">
          validateur officiel schema.org
        </a>
        .
      </p>
    </div>
  );
}

function Generator({ example, onResult }: { example: Record<string, string>; onResult?: (url: string | null) => void }) {
  const id = useId();
  const [type, setType] = useState<GenerateType>('LocalBusiness');
  const [values, setValues] = useState<Record<string, string>>({});
  const [faq, setFaq] = useState<{ q: string; a: string }[]>([{ q: '', a: '' }]);
  const [msg, setMsg] = useState('');
  const [isExample, setIsExample] = useState(false);
  const { state, run } = useToolRun<GenerateResult>();
  const busy = state.phase === 'loading';
  // Pont vers l'audit : signale le résultat (adresse du site saisie, pour pré-remplir l'audit).
  useEffect(() => {
    if (state.phase === 'done') onResult?.(isExample ? null : values.url?.trim() || null);
  }, [state.phase, isExample, values.url, onResult]);
  const set = (k: string, v: string) => setValues((x) => ({ ...x, [k]: v }));

  const build = (t: GenerateType, vals: Record<string, string>, rows: { q: string; a: string }[]) => {
    const fields: Record<string, unknown> = {};
    if (t === 'FAQPage') {
      const list = rows.map((r) => ({ q: r.q.trim(), a: r.a.trim() })).filter((r) => r.q && r.a);
      if (!list.length) return 'Ajoutez au moins une question et sa réponse.';
      fields.faq = list;
      if (vals.name?.trim()) fields.name = vals.name.trim();
      if (vals.url?.trim()) fields.url = vals.url.trim();
    } else {
      for (const f of FIELDS[t]) {
        const v = (vals[f.key] ?? '').trim();
        if (!v) continue;
        if (f.key === 'sameAs') fields.sameAs = v.split(/\s*\n\s*|\s*,\s*(?=https?:)/).filter(Boolean).slice(0, 20);
        else if (f.key === 'currency') fields.currency = v.toUpperCase();
        else fields[f.key] = v;
      }
      if (!fields.name) return 'Le nom est obligatoire.';
      if (t === 'Product' && fields.currency && !/^[A-Z]{3}$/.test(String(fields.currency))) return 'La devise s’écrit en 3 lettres, par exemple EUR.';
      if (t === 'Product' && vals.availability) fields.availability = vals.availability;
    }
    return fields;
  };

  const submit = (e?: FormEvent, t = type, vals = values, rows = faq, ex = false) => {
    e?.preventDefault();
    const fields = build(t, vals, rows);
    if (typeof fields === 'string') return setMsg(fields);
    setMsg('');
    setIsExample(ex);
    run((signal) => callTool('/api/tools/jsonld/generate', { type: t, fields }, { signal }));
  };

  const loadExample = () => {
    setType('LocalBusiness');
    setValues(example);
    submit(undefined, 'LocalBusiness', example, faq, true);
  };

  const list = type === 'FAQPage' ? [] : FIELDS[type];
  return (
    <div>
      <form onSubmit={submit} noValidate aria-busy={busy}>
        <fieldset>
          <legend className="mb-2 text-[0.95rem] font-semibold text-ink">Type de page</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TYPES.map((t) => (
              <label
                key={t.id}
                className={`cursor-pointer rounded-xl px-3 py-2 ring-1 ring-inset transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-primary ${type === t.id ? 'bg-primary-bg ring-primary' : 'bg-white ring-line hover:ring-primary'}`}
              >
                <input type="radio" name={`${id}-type`} value={t.id} checked={type === t.id} onChange={() => setType(t.id)} className="sr-only" />
                <span className="block font-semibold text-ink">{t.label}</span>
                <span className="block text-xs text-muted">{t.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {type === 'FAQPage' ? (
          <div className="mt-5 space-y-4">
            {faq.map((row, i) => (
              <div key={i} className="rounded-xl border border-line bg-canvas p-3">
                <label htmlFor={`${id}-q${i}`} className="text-sm font-semibold text-ink">
                  Question {i + 1}
                </label>
                <input id={`${id}-q${i}`} className="rt-field mt-1" maxLength={300} value={row.q} onChange={(e) => setFaq((f) => f.map((r, j) => (j === i ? { ...r, q: e.target.value } : r)))} />
                <label htmlFor={`${id}-a${i}`} className="mt-2 block text-sm font-semibold text-ink">
                  Réponse
                </label>
                <textarea id={`${id}-a${i}`} className="rt-field mt-1" rows={3} maxLength={2000} value={row.a} onChange={(e) => setFaq((f) => f.map((r, j) => (j === i ? { ...r, a: e.target.value } : r)))} />
                {faq.length > 1 && (
                  <button type="button" className="mt-2 text-sm font-semibold text-danger-ink underline underline-offset-2" onClick={() => setFaq((f) => f.filter((_, j) => j !== i))}>
                    Retirer cette question
                  </button>
                )}
              </div>
            ))}
            {faq.length < 30 && (
              <button type="button" className={buttonClasses({ variant: 'secondary', size: 'sm' })} onClick={() => setFaq((f) => [...f, { q: '', a: '' }])}>
                Ajouter une question
              </button>
            )}
            <p className="text-sm text-muted">Les questions balisées doivent aussi être visibles sur la page.</p>
          </div>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {list.map((f) => (
              <div key={f.key} className={f.long ? 'sm:col-span-2' : ''}>
                <label htmlFor={`${id}-${f.key}`} className="mb-1 block text-sm font-semibold text-ink">
                  {f.label}
                  {f.required && <span className="text-danger-ink"> *</span>}
                </label>
                {f.long ? (
                  <textarea id={`${id}-${f.key}`} className="rt-field" rows={3} value={values[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)} aria-describedby={f.hint ? `${id}-${f.key}-h` : undefined} />
                ) : (
                  <input
                    id={`${id}-${f.key}`}
                    className="rt-field"
                    type={f.type === 'tel' ? 'tel' : 'text'}
                    inputMode={f.type === 'url' ? 'url' : undefined}
                    required={f.required}
                    value={values[f.key] ?? ''}
                    onChange={(e) => set(f.key, e.target.value)}
                    aria-describedby={f.hint ? `${id}-${f.key}-h` : undefined}
                  />
                )}
                {f.hint && (
                  <p id={`${id}-${f.key}-h`} className="mt-1 text-xs text-muted">
                    {f.hint}
                  </p>
                )}
              </div>
            ))}
            {type === 'Product' && (
              <div>
                <label htmlFor={`${id}-avail`} className="mb-1 block text-sm font-semibold text-ink">
                  Disponibilité
                </label>
                <select id={`${id}-avail`} className="rt-field" value={values.availability ?? ''} onChange={(e) => set('availability', e.target.value)}>
                  <option value="">Non précisée</option>
                  <option value="InStock">En stock</option>
                  <option value="OutOfStock">Épuisé</option>
                  <option value="PreOrder">Précommande</option>
                </select>
              </div>
            )}
          </div>
        )}

        {msg && (
          <p role="alert" className="mt-3 text-sm font-medium text-danger-ink">
            {msg}
          </p>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="submit" className={buttonClasses()} disabled={busy}>
            {busy ? 'Génération…' : 'Générer le bloc JSON-LD'}
          </button>
          {type !== 'FAQPage' && (
            <button type="button" onClick={loadExample} className="text-sm font-semibold text-primary underline underline-offset-2 hover:no-underline" disabled={busy}>
              Remplir avec un exemple fictif
            </button>
          )}
        </div>
        <p className="mt-2 text-xs text-muted">Aucune valeur n’est inventée : seuls les champs remplis apparaissent. Ne balisez jamais d’avis que vous ne pouvez pas prouver.</p>
      </form>

      {busy && <Loading steps={['Construction du bloc…']} />}
      {state.phase === 'error' && <ErrorBox error={state.error} />}
      {state.phase === 'done' && (
        <div className="mt-6 rt-fade space-y-4">
          {isExample && <ExampleNote what="données d’une plomberie imaginaire." />}
          <CodeBlock code={state.data.script} label="Bloc à coller dans le <head> de la page" />
          {state.data.notes.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
              {state.data.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
          <details className="rt-details rounded-xl border border-line bg-white">
            <summary className="cursor-pointer px-4 py-3 font-semibold">Contrôle du bloc généré</summary>
            <div className="rt-details-body px-4 pb-4">
              <ValidationView v={state.data.validation} />
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

function Validator({ onResult }: { onResult?: (url: string | null) => void }) {
  const id = useId();
  const [src, setSrc] = useState<'url' | 'code'>('url');
  const [url, setUrl] = useState('');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [analyzed, setAnalyzed] = useState<string | null>(null);
  const { state, run } = useToolRun<JsonLdValidation>();
  const busy = state.phase === 'loading';
  useEffect(() => {
    if (state.phase === 'done') onResult?.(analyzed);
  }, [state.phase, analyzed, onResult]);

  const go = (u: string) => {
    setUrl(u);
    setAnalyzed(u);
    run((signal) => callTool('/api/tools/jsonld/validate', { url: u }, { signal }));
  };
  useShareParams((p) => p.mode === 'valider' && p.url && go(p.url));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (src === 'url') {
      const n = normalizeUrl(url);
      if (!n.ok) return setMsg(n.message);
      setMsg('');
      go(n.url);
    } else {
      if (!code.trim()) return setMsg('Collez un bloc JSON-LD ou le HTML qui le contient.');
      setMsg('');
      setAnalyzed(null);
      run((signal) => callTool('/api/tools/jsonld/validate', { jsonld: code }, { signal }));
    }
  };

  return (
    <div>
      <form onSubmit={submit} noValidate aria-busy={busy}>
        <div role="group" aria-label="Source" className="mb-4 inline-flex rounded-xl bg-canvas p-1 ring-1 ring-line">
          {(
            [
              ['url', 'Une adresse'],
              ['code', 'Coller un bloc'],
            ] as const
          ).map(([k, label]) => (
            <button key={k} type="button" aria-pressed={src === k} onClick={() => setSrc(k)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${src === k ? 'bg-white text-primary shadow-sm' : 'text-muted hover:text-ink'}`}>
              {label}
            </button>
          ))}
        </div>
        {src === 'url' ? (
          <UrlField id={`${id}-url`} label="Adresse de la page" value={url} onChange={setUrl} invalid={!!msg} />
        ) : (
          <div>
            <label htmlFor={`${id}-code`} className="mb-1.5 block text-[0.95rem] font-semibold text-ink">
              Bloc JSON-LD ou HTML
            </label>
            <textarea id={`${id}-code`} className="rt-field rt-mono" rows={10} value={code} onChange={(e) => setCode(e.target.value)} spellCheck={false} placeholder={'<script type="application/ld+json">{ … }</script>'} />
          </div>
        )}
        {msg && (
          <p role="alert" className="mt-2 text-sm font-medium text-danger-ink">
            {msg}
          </p>
        )}
        <button type="submit" className={buttonClasses({ className: 'mt-4' })} disabled={busy}>
          {busy ? 'Validation…' : 'Valider'}
        </button>
      </form>
      {busy && <Loading steps={['Lecture de la page…', 'Extraction des blocs JSON-LD…', 'Vérification des champs…']} />}
      {state.phase === 'error' && <ErrorBox error={state.error} onRetry={() => analyzed && go(analyzed)} />}
      {state.phase === 'done' && (
        <div className="mt-6 rt-fade">
          <ResultHeader title={analyzed ? `Données structurées de ${hostOf(analyzed)}` : 'Bloc collé'} actions={analyzed ? <ShareLink params={{ url: analyzed, mode: 'valider' }} /> : undefined} />
          <ValidationView v={state.data} />
        </div>
      )}
      {state.phase === 'done' && analyzed && <EmailCapture tool="Validateur JSON-LD" url={analyzed} />}
    </div>
  );
}

export function JsonLdTool({ exampleFields }: { exampleFields: Record<string, string> }) {
  const [tab, setTab] = useState<'generer' | 'valider'>('generer');
  // Résultat obtenu (dans l'un ou l'autre onglet) : le pont vers l'audit passe en « Étape suivante », site pré-rempli.
  const [result, setResult] = useState<{ url: string | null } | null>(null);
  const onResult = useCallback((url: string | null) => setResult({ url }), []);
  useShareParams((p) => p.mode === 'valider' && setTab('valider'));
  return (
    <>
      <Scope>
        <div
          role="tablist"
          aria-label="Mode"
          className="-mx-1 mb-6 flex gap-1 border-b border-line"
          onKeyDown={(e) => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
            const next = tab === 'generer' ? 'valider' : 'generer';
            setTab(next);
            document.getElementById(`rt-tab-${next}`)?.focus();
          }}
        >
          {(
            [
              ['generer', 'Générer'],
              ['valider', 'Valider'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              id={`rt-tab-${k}`}
              aria-selected={tab === k}
              tabIndex={tab === k ? 0 : -1}
              aria-controls={`rt-panel-${k}`}
              onClick={() => setTab(k)}
              className={`-mb-px border-b-2 px-4 py-2 font-semibold ${tab === k ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-ink'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div role="tabpanel" id="rt-panel-generer" aria-labelledby="rt-tab-generer" hidden={tab !== 'generer'}>
          <Generator example={exampleFields} onResult={onResult} />
        </div>
        <div role="tabpanel" id="rt-panel-valider" aria-labelledby="rt-tab-valider" hidden={tab !== 'valider'}>
          <Validator onResult={onResult} />
        </div>
      </Scope>
      <AuditBridge done={!!result} url={result?.url ?? null} text="Le balisage aide les IA à vous identifier. L’audit montre si elles le font, et ce qu’elles disent de vous. Repéré peut aussi servir ce bloc pour vous, sans toucher au code." />
    </>
  );
}
