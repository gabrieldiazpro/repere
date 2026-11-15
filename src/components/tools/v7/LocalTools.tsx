'use client';
/** Outils V7 calculés dans le navigateur, sans envoi : cohérence NAP, générateur UTM (avec QR code), fiche « faits clés ». */
import { useId, useMemo, useState } from 'react';
import { buttonClasses } from '@/components/ui/Button';
import { qrSvg } from '@/lib/execution/qr';
import { downloadText } from '../api';
import { AuditBridge, CheckList, CodeBlock, CopyButton, ExampleNote, Scope, StatusPill } from '../ui';
import { VerdictBanner } from '../v6/ui';
import { MATCH_LABEL, UTM_PRESETS, buildFacts, buildUtm, napConsistency } from './pure';
import type { FactsInput, NapEntry, NapMatch, UtmInput } from './types';

const link = 'font-semibold text-primary underline underline-offset-2 hover:no-underline';

function Field({ id, label, value, onChange, placeholder, hint, area = false, type = 'text' }: { id: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string; area?: boolean; type?: string }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1 block text-sm font-semibold text-ink">
        {label}
      </label>
      {area ? (
        <textarea id={id} className="rt-field !min-h-24" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={4000} aria-describedby={hint ? `${id}-h` : undefined} />
      ) : (
        <input id={id} type={type} className="rt-field" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={500} aria-describedby={hint ? `${id}-h` : undefined} />
      )}
      {hint && (
        <p id={`${id}-h`} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Cohérence NAP                                                       */
/* ------------------------------------------------------------------ */

const EMPTY: NapEntry = { source: '', name: '', address: '', phone: '' };
const TONE: Record<NapMatch, 'ok' | 'warn' | 'fail'> = { same: 'ok', variant: 'warn', different: 'fail', empty: 'warn' };

function NapFields({ id, e, set, title }: { id: string; e: NapEntry; set: (e: NapEntry) => void; title: string }) {
  return (
    <fieldset className="min-w-0 rounded-xl border border-line bg-white p-3">
      <legend className="px-1 text-sm font-semibold text-ink">{title}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field id={`${id}-s`} label="Source" value={e.source} onChange={(v) => set({ ...e, source: v })} placeholder="Fiche Google, Pages Jaunes…" />
        <Field id={`${id}-n`} label="Nom" value={e.name} onChange={(v) => set({ ...e, name: v })} />
        <Field id={`${id}-a`} label="Adresse" value={e.address} onChange={(v) => set({ ...e, address: v })} placeholder="12 rue …, 69006 Lyon" />
        <Field id={`${id}-p`} label="Téléphone" value={e.phone} onChange={(v) => set({ ...e, phone: v })} type="tel" />
      </div>
    </fieldset>
  );
}

export function NapTool({ example }: { example: { reference: NapEntry; others: NapEntry[] } }) {
  const id = useId();
  const [ref, setRef] = useState<NapEntry>({ ...EMPTY, source: 'Votre site' });
  const [others, setOthers] = useState<NapEntry[]>([{ ...EMPTY, source: 'Fiche Google' }, { ...EMPTY }]);
  const [isExample, setIsExample] = useState(false);
  const r = useMemo(() => napConsistency(ref, others), [ref, others]);
  const filled = others.some((o) => o.name.trim() || o.address.trim() || o.phone.trim()) && (ref.name.trim() || ref.address.trim() || ref.phone.trim());
  const edit = (i: number, e: NapEntry) => (setOthers((o) => o.map((x, k) => (k === i ? e : x))), setIsExample(false));
  return (
    <>
      <Scope>
        <NapFields id={`${id}-ref`} e={ref} set={(e) => (setRef(e), setIsExample(false))} title="Référence : les coordonnées exactes" />
        <div className="mt-3 grid gap-3">
          {others.map((o, i) => (
            <NapFields key={i} id={`${id}-${i}`} e={o} set={(e) => edit(i, e)} title={`Fiche ${i + 1}`} />
          ))}
        </div>
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
          {others.length < 8 && (
            <button type="button" className={link} onClick={() => setOthers((o) => [...o, { ...EMPTY }])}>
              Ajouter une fiche
            </button>
          )}
          {others.length > 1 && (
            <button type="button" className={link} onClick={() => setOthers((o) => o.slice(0, -1))}>
              Retirer la dernière
            </button>
          )}
          <button type="button" className={link} onClick={() => (setRef(example.reference), setOthers(example.others), setIsExample(true))}>
            Essayer avec un exemple
          </button>
          <span>Calculé dans votre navigateur : rien n’est envoyé.</span>
        </p>
        {filled && (
          <div className="mt-6 rt-fade" aria-live="polite">
            {isExample && <ExampleNote what="fiches d’une plomberie imaginaire : un numéro de rue et un téléphone qui diffèrent." />}
            <VerdictBanner verdict={r.verdict} />
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white" aria-label="Comparaison fiche par fiche">
              {r.rows.map((row, i) => (
                <li key={i} className="grid gap-2 px-3 py-2.5 sm:grid-cols-[10rem_repeat(3,minmax(0,1fr))] sm:items-center">
                  <p className="break-words font-semibold text-ink">{row.source}</p>
                  {(['name', 'address', 'phone'] as const).map((k) => (
                    <p key={k} className="flex min-w-0 items-center gap-2 text-sm">
                      <span className="w-20 shrink-0 text-xs text-muted sm:w-auto">{{ name: 'Nom', address: 'Adresse', phone: 'Téléphone' }[k]}</span>
                      <StatusPill status={TONE[row[k]]} label={MATCH_LABEL[row[k]]} />
                    </p>
                  ))}
                </li>
              ))}
            </ul>
            <h2 className="mb-3 mt-6 text-base font-semibold text-ink">Le détail des contrôles</h2>
            <CheckList checks={r.checks} />
          </div>
        )}
      </Scope>
      <AuditBridge done={!!filled} url={null} text="Vos fiches concordent ? Voyez ce que ChatGPT, Perplexity et Gemini répondent quand on leur demande vos coordonnées." />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Générateur UTM                                                      */
/* ------------------------------------------------------------------ */

export function UtmTool({ example }: { example: UtmInput }) {
  const id = useId();
  const [v, setV] = useState<UtmInput>({ url: '', source: '', medium: '', campaign: '', term: '', content: '' });
  const [preset, setPreset] = useState('');
  const [isExample, setIsExample] = useState(false);
  const r = useMemo(() => buildUtm(v), [v]);
  const started = !!(v.url || v.source || v.medium);
  const qr = useMemo(() => {
    if (!r.link || r.link.length > 600) return null;
    try {
      return qrSvg(r.link, { px: 220 });
    } catch {
      return null;
    }
  }, [r.link]);
  const set = (k: keyof UtmInput) => (x: string) => (setV((o) => ({ ...o, [k]: x })), setIsExample(false));
  const choose = (pid: string) => {
    const p = UTM_PRESETS.find((x) => x.id === pid);
    setPreset(pid);
    if (p) setV((o) => ({ ...o, source: p.source, medium: p.medium, campaign: p.campaign }));
  };
  const hint = UTM_PRESETS.find((x) => x.id === preset)?.hint;
  return (
    <>
      <Scope>
        <Field id={`${id}-url`} label="Page de destination" value={v.url} onChange={set('url')} placeholder="https://votre-site.fr/contact" type="url" />
        <fieldset className="mt-4">
          <legend className="mb-2 text-sm font-semibold text-ink">Modèle (facultatif)</legend>
          <div className="flex flex-wrap gap-2">
            {UTM_PRESETS.map((p) => (
              <button key={p.id} type="button" aria-pressed={preset === p.id} onClick={() => choose(p.id)} className={`rounded-full px-3 py-1.5 text-sm font-semibold ring-1 transition-colors ${preset === p.id ? 'bg-primary text-white ring-primary' : 'bg-white text-ink ring-line hover:bg-canvas'}`}>
                {p.label}
              </button>
            ))}
          </div>
          {hint && <p className="mt-2 text-sm text-muted">{hint}</p>}
        </fieldset>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Field id={`${id}-s`} label="Source (utm_source)" value={v.source} onChange={set('source')} placeholder="google" />
          <Field id={`${id}-m`} label="Support (utm_medium)" value={v.medium} onChange={set('medium')} placeholder="organic" />
          <Field id={`${id}-c`} label="Campagne (utm_campaign)" value={v.campaign} onChange={set('campaign')} placeholder="fiche-google" />
          <Field id={`${id}-t`} label="Terme (facultatif)" value={v.term ?? ''} onChange={set('term')} />
          <Field id={`${id}-x`} label="Contenu (facultatif)" value={v.content ?? ''} onChange={set('content')} hint="Pour distinguer deux liens d’un même envoi." />
        </div>
        <p className="mt-3 text-sm text-muted">
          Calculé dans votre navigateur : rien n’est envoyé.{' '}
          <button type="button" className={link} onClick={() => (setV({ ...example, term: '', content: '' }), setPreset('gbp'), setIsExample(true))}>
            Essayer avec un exemple
          </button>
        </p>
        {started && (
          <div className="mt-6 rt-fade" aria-live="polite">
            {isExample && <ExampleNote what="lien du bouton « Site web » de la fiche Google d’une plomberie imaginaire." />}
            <VerdictBanner verdict={r.verdict} />
            {r.errors.length > 1 && (
              <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-danger-ink">
                {r.errors.slice(1).map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
            {r.link && (
              <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
                <div className="min-w-0">
                  <p className="mb-2 text-sm font-semibold text-ink">Votre lien de suivi</p>
                  <p className="break-all rounded-xl border border-line bg-white p-3 font-mono text-sm text-ink">{r.link}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <CopyButton text={r.link} label="Copier le lien" />
                  </div>
                  <p className="mt-3 text-sm text-muted">
                    Canal GA4 estimé : <strong className="text-ink">{r.channel}</strong>
                  </p>
                </div>
                {qr && (
                  <figure className="m-0 w-44 justify-self-start rounded-xl border border-line bg-white p-3">
                    {/* SVG produit par notre générateur de QR (src/lib/execution/qr.ts) à partir du lien ci-contre. */}
                    <div className="w-full" dangerouslySetInnerHTML={{ __html: qr }} />
                    <figcaption className="mt-2">
                      <button type="button" className={buttonClasses({ variant: 'secondary', size: 'sm', className: 'w-full' })} onClick={() => downloadText('qr-lien-utm.svg', qr, 'image/svg+xml')}>
                        Télécharger le QR
                      </button>
                    </figcaption>
                  </figure>
                )}
              </div>
            )}
            {r.warnings.length > 0 && (
              <ul className="mt-4 space-y-1.5 rounded-xl bg-warning-bg p-3 text-sm text-warning-ink">
                {r.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Scope>
      <AuditBridge to="analyse" done={!!r.link} url={null} text="Vos visites sont suivies. L’analyse complète vérifie que Google et les IA lisent bien la page vers laquelle elles mènent." />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Fiche « faits clés »                                                */
/* ------------------------------------------------------------------ */

const FACT_FIELDS: { k: keyof FactsInput; label: string; placeholder?: string; hint?: string; area?: boolean; type?: string }[] = [
  { k: 'name', label: 'Nom de l’entreprise', placeholder: 'Plomberie Martin' },
  { k: 'activity', label: 'Activité, en une phrase', placeholder: 'Plombier chauffagiste' },
  { k: 'area', label: 'Zone servie', placeholder: 'Lyon et Villeurbanne' },
  { k: 'address', label: 'Adresse' },
  { k: 'phone', label: 'Téléphone', type: 'tel' },
  { k: 'hours', label: 'Horaires', placeholder: 'Du lundi au samedi, 8 h – 19 h' },
  { k: 'since', label: 'En activité depuis', placeholder: '2011' },
  { k: 'prices', label: 'Prix indicatifs', placeholder: 'Déplacement 49 € à Lyon' },
  { k: 'site', label: 'Adresse du site', type: 'url' },
  { k: 'updated', label: 'Date de vérification', type: 'date', hint: 'Le jour où vous avez vérifié ces informations.' },
  { k: 'facts', label: 'Faits vérifiables (un par ligne)', area: true, placeholder: 'Intervention sous 2 heures à Lyon\nPièces garanties 2 ans', hint: 'Chiffres, dates, garanties, certifications : ce qui se vérifie.' },
];

export function FactsTool({ example }: { example: FactsInput }) {
  const id = useId();
  const empty: FactsInput = { name: '', activity: '', area: '', address: '', phone: '', hours: '', since: '', prices: '', facts: '', updated: '', site: '' };
  const [f, setF] = useState<FactsInput>(empty);
  const [isExample, setIsExample] = useState(false);
  const r = useMemo(() => buildFacts(f), [f]);
  const started = !!(f.name.trim() || f.activity.trim());
  return (
    <>
      <Scope>
        <div className="grid gap-3 sm:grid-cols-2">
          {FACT_FIELDS.map((x) => (
            <div key={x.k} className={x.area ? 'sm:col-span-2' : ''}>
              <Field id={`${id}-${x.k}`} label={x.label} value={f[x.k]} onChange={(v) => (setF((o) => ({ ...o, [x.k]: v })), setIsExample(false))} placeholder={x.placeholder} hint={x.hint} area={x.area} type={x.type} />
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted">
          Calculé dans votre navigateur : rien n’est envoyé.{' '}
          <button type="button" className={link} onClick={() => (setF(example), setIsExample(true))}>
            Essayer avec un exemple
          </button>
          {started && (
            <>
              {' · '}
              <button type="button" className={link} onClick={() => (setF(empty), setIsExample(false))}>
                Effacer
              </button>
            </>
          )}
        </p>
        {started && (
          <div className="mt-6 grid gap-5 rt-fade" aria-live="polite">
            {isExample && <ExampleNote what="faits clés d’une plomberie imaginaire, dont un superlatif à retirer." />}
            <VerdictBanner verdict={r.verdict} />
            <CodeBlock code={r.html} label="Bloc HTML à coller sur votre site" />
            <CodeBlock code={r.markdown} label="Version Markdown (llms.txt, page À propos)" actions={<button type="button" className={buttonClasses({ variant: 'secondary', size: 'sm' })} onClick={() => downloadText('faits-cles.md', r.markdown, 'text/markdown;charset=utf-8')}>Télécharger</button>} />
            <div>
              <h2 className="mb-3 text-base font-semibold text-ink">Le détail des contrôles</h2>
              <CheckList checks={r.checks} />
            </div>
          </div>
        )}
      </Scope>
      <AuditBridge done={started} url={null} text="Vos faits sont clairs sur votre site. L’audit montre si ChatGPT, Perplexity et Gemini les reprennent, ou disent autre chose." />
    </>
  );
}
