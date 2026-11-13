'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { BrandFactField, ExecTask, FactCheckItem, Segment } from '@/lib/engine/types-v2';
import { Icon } from './icons';
import { localDemo, sessionHeaders } from './localDemo';
import { FACT_HINT, FACT_LABEL, PROVIDER_LABEL } from './tokens';

const FIELDS: Record<Segment, BrandFactField[]> = {
  local: ['adresse', 'telephone', 'horaires', 'prix', 'zone', 'services', 'dirigeant', 'creation', 'site', 'statut'],
  pme: ['site', 'services', 'prix', 'clients', 'adresse', 'telephone', 'zone', 'dirigeant', 'creation', 'statut'],
  ecommerce: ['site', 'produits', 'prix', 'livraison', 'retours', 'ingredients', 'certifications', 'adresse', 'dirigeant', 'creation'],
};

/** Champs longs : zone de texte sur plusieurs lignes. */
const LONG: BrandFactField[] = ['horaires', 'services', 'prix', 'produits', 'livraison', 'retours', 'ingredients', 'certifications', 'clients'];

/** Validation par champ (même règles que le serveur, message immédiat). */
export function validateFact(field: BrandFactField, value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (field === 'telephone' && !/^(\+33\s?|0)[1-9](?:[\s.-]?\d{2}){4}$/.test(v)) return 'Numéro attendu au format 01 23 45 67 89 ou +33 1 23 45 67 89.';
  if (field === 'adresse' && !(/\b\d{5}\b/.test(v) && /[a-zà-ÿ]{3,}/i.test(v))) return 'Adresse attendue avec un code postal à 5 chiffres (ex. 12 rue Oberkampf, 75011 Paris).';
  if (field === 'site' && !/^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/\S*)?$/i.test(v)) return 'Adresse de site attendue (ex. mon-site.fr).';
  if (field === 'creation' && !/^(1[89]\d\d|20\d\d)$/.test(v)) return 'Année attendue (ex. 2009).';
  return null;
}

type CheckItem = Pick<FactCheckItem, 'field' | 'verdict' | 'stated' | 'provider'>;

type Facts = Partial<Record<BrandFactField, string>>;

export function TruthEditor({ businessId, segment, initial, updatedAt, demo, wrong }: { businessId: string; segment: Segment; initial: Facts; updatedAt: string; demo: boolean; wrong: BrandFactField[] }) {
  const [facts, setFacts] = useState<Facts>(initial);
  const [editing, setEditing] = useState<BrandFactField | null>(null);
  const [draft, setDraft] = useState('');
  const [msg, setMsg] = useState<{ tone: 'ok' | 'info' | 'err'; text: string } | null>(null);
  const [savedAt, setSavedAt] = useState(updatedAt);
  const [fieldErr, setFieldErr] = useState<string | null>(null);
  const [wrongNow, setWrongNow] = useState<BrandFactField[]>(wrong);

  /** Revérification immédiate contre les réponses du dernier audit (sans attendre lundi). */
  function recheckMessage(field: BrandFactField, items: CheckItem[] | null | undefined): string {
    const mine = (items ?? []).filter((i) => i.field === field);
    const bad = mine.find((i) => i.verdict === 'faux');
    setWrongNow((w) => (bad ? [...new Set([...w, field])] : w.filter((x) => x !== field)));
    if (bad) return `${PROVIDER_LABEL[bad.provider] ?? bad.provider} dit toujours « ${bad.stated} » : l’erreur reste ouverte. Corrigez vos sources (tâche de correction).`;
    if (mine.length) return 'Cette valeur correspond désormais aux réponses des IA du dernier audit.';
    return 'Aucune IA n’en parle dans le dernier audit : nous la vérifierons au prochain.';
  }

  useEffect(() => {
    if (!demo) return;
    const local = localDemo.facts(businessId);
    if (local) setFacts((f) => ({ ...f, ...local }));
  }, [businessId, demo]);

  const fields = FIELDS[segment];
  const filled = fields.filter((f) => facts[f]?.trim()).length;

  async function save(field: BrandFactField) {
    const invalid = validateFact(field, draft);
    if (invalid) {
      setFieldErr(invalid);
      return;
    }
    setFieldErr(null);
    const before = facts;
    const next = { ...facts, [field]: draft.trim() };
    if (!draft.trim()) delete next[field];
    setFacts(next);
    setEditing(null);
    try {
      const res = await fetch(`/api/facts?businessId=${encodeURIComponent(businessId)}`, {
        method: 'POST',
        headers: sessionHeaders(),
        credentials: 'same-origin',
        body: JSON.stringify({ facts: { [field]: draft.trim() } }),
      });
      const j = (await res.json().catch(() => null)) as { check?: { report?: { items: CheckItem[] } } | null; preview?: { items: CheckItem[] } | null; errors?: Record<string, string>; demo?: boolean } | null;
      if (res.status === 400 && j?.errors) {
        setFacts(before);
        setEditing(field);
        setFieldErr(j.errors[field] ?? Object.values(j.errors)[0] ?? 'Valeur invalide.');
        return;
      }
      if (j?.demo && demo) {
        localDemo.setFacts(businessId, next);
        setSavedAt(new Date().toISOString());
        setMsg({ tone: 'info', text: `${FACT_LABEL[field]} enregistré sur cet appareil (mode démo). ${recheckMessage(field, j.preview?.items)}` });
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      setSavedAt(new Date().toISOString());
      setMsg({ tone: 'ok', text: `${FACT_LABEL[field]} enregistré. ${recheckMessage(field, j?.check?.report?.items)}` });
      if (demo) localDemo.setFacts(businessId, next);
    } catch {
      if (demo) {
        localDemo.setFacts(businessId, next);
        setSavedAt(new Date().toISOString());
        setMsg({ tone: 'info', text: `${FACT_LABEL[field]} enregistré sur cet appareil (mode démo). Revérification au prochain chargement.` });
      } else {
        setFacts(before);
        setMsg({ tone: 'err', text: `${FACT_LABEL[field]} n’a pas été enregistré. Vérifiez votre connexion puis réessayez.` });
      }
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--hair)]" role="progressbar" aria-valuemin={0} aria-valuemax={fields.length} aria-valuenow={filled} aria-label="Champs remplis">
          <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${(filled / fields.length) * 100}%` }} />
        </div>
        <span className="rp-num text-[12px] text-[var(--muted)]">
          {filled}/{fields.length} remplis
        </span>
      </div>
      <dl className="border-t border-[var(--hair)]">
        {fields.map((f) => {
          const isWrong = wrongNow.includes(f);
          const on = editing === f;
          return (
            <div key={f} className="grid gap-1 border-b border-[var(--hair)] py-2.5 sm:grid-cols-[150px_1fr_auto] sm:items-start sm:gap-3">
              <dt className="flex flex-col items-start gap-1 pt-0.5 text-[13px] font-medium text-[var(--muted)]">
                {FACT_LABEL[f]}
                {isWrong && (
                  <span className="rp-chip rp-chip-danger" title="Une IA donne une autre valeur">
                    <Icon name="alert" size={12} /> contredit
                  </span>
                )}
              </dt>
              <dd className="min-w-0">
                {on ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void save(f);
                    }}
                    className="flex flex-col gap-2 sm:flex-row"
                  >
                    <label className="sr-only" htmlFor={`fact-${f}`}>
                      {FACT_LABEL[f]}
                    </label>
                    <div className="min-w-0 flex-1">
                      {LONG.includes(f) ? (
                        <textarea
                          id={`fact-${f}`}
                          className="rp-input min-h-[88px] w-full py-2"
                          rows={3}
                          value={draft}
                          autoFocus
                          aria-invalid={fieldErr ? true : undefined}
                          aria-describedby={fieldErr ? `fact-${f}-err` : undefined}
                          placeholder={FACT_HINT[f] ?? ''}
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => e.key === 'Escape' && setEditing(null)}
                        />
                      ) : (
                        <input
                          id={`fact-${f}`}
                          className="rp-input w-full"
                          value={draft}
                          autoFocus
                          inputMode={f === 'telephone' ? 'tel' : f === 'creation' ? 'numeric' : undefined}
                          aria-invalid={fieldErr ? true : undefined}
                          aria-describedby={fieldErr ? `fact-${f}-err` : undefined}
                          placeholder={FACT_HINT[f] ?? ''}
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => e.key === 'Escape' && setEditing(null)}
                        />
                      )}
                      {fieldErr && (
                        <p id={`fact-${f}-err`} className="mt-1 text-[12px] text-[var(--danger-ink)]">
                          {fieldErr}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button type="submit" className="rp-btn rp-btn-primary rp-btn-sm">
                        Enregistrer
                      </button>
                      <button type="button" className="rp-btn rp-btn-sm" onClick={() => setEditing(null)}>
                        Annuler
                      </button>
                    </div>
                  </form>
                ) : facts[f] ? (
                  <span className="whitespace-pre-line text-[14px]">{facts[f]}</span>
                ) : (
                  <span className="text-[14px] text-[var(--muted)]">Non renseigné</span>
                )}
              </dd>
              {!on && (
                <div className="sm:text-right">
                  <button
                    type="button"
                    className="rp-btn rp-btn-ghost rp-btn-sm -ml-2 sm:ml-0"
                    onClick={() => {
                      setEditing(f);
                      setFieldErr(null);
                      setDraft(facts[f] ?? '');
                    }}
                  >
                    {facts[f] ? 'Modifier' : 'Ajouter'}
                    <span className="sr-only"> : {FACT_LABEL[f]}</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </dl>
      <p className="mt-2 text-[12px] text-[var(--muted)]">
        Dernière mise à jour le {new Date(savedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}. Ces informations servent de référence pour vérifier les IA, rédiger vos livrables et répondre dans le copilote.
      </p>
      <p role="status" aria-live="polite" className="min-h-[20px] text-[13px]">
        {msg && <span className={msg.tone === 'err' ? 'text-[var(--danger-ink)]' : msg.tone === 'ok' ? 'text-[var(--success-ink)]' : 'text-[var(--primary)]'}>{msg.text}</span>}
      </p>
    </div>
  );
}

/** Bouton générique de création de tâche (POST /api/exec/tasks) ; repli local en démo. */
export function CreateTaskButton({ businessId, task, demo, label, factFix }: { businessId: string; task: ExecTask; demo: boolean; label: string; factFix?: Pick<FactCheckItem, 'field' | 'expected' | 'stated' | 'provider' | 'quote' | 'severity'> }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'local' | 'err'>('idle');
  const [createdId, setCreatedId] = useState(task.id);
  async function create() {
    setState('busy');
    const t: ExecTask = { ...task, createdAt: new Date().toISOString() };
    try {
      const res = await fetch('/api/exec/tasks', {
        method: 'POST',
        headers: sessionHeaders(),
        credentials: 'same-origin',
        body: JSON.stringify(
          factFix
            ? { businessId, factFix: { ...factFix, quote: factFix.quote?.slice(0, 1000) } }
            : { businessId, task: { title: t.title.slice(0, 160), why: t.why.slice(0, 600), minutes: Math.min(600, t.minutes), impact: t.impact, steps: t.steps?.slice(0, 12).map((x) => x.slice(0, 300)) } },
        ),
      });
      if (!res.ok) throw new Error(String(res.status));
      const j = (await res.json().catch(() => null)) as { task?: { id?: string } } | null;
      if (j?.task?.id) setCreatedId(j.task.id);
      setState('done');
    } catch {
      if (demo) {
        localDemo.addTask(t);
        setCreatedId(t.id);
        setState('local');
      } else setState('err');
    }
  }
  if (state === 'done' || state === 'local')
    return (
      <p className="flex flex-wrap items-center gap-2 text-[13px] text-[var(--success-ink)]" role="status">
        <Icon name="check" size={16} /> Tâche créée{state === 'local' ? ' sur cet appareil (démo)' : ''}.
        <Link href={`/app/actions?t=${encodeURIComponent(createdId)}`} className="rp-link">
          Voir la tâche
        </Link>
      </p>
    );
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className="rp-btn rp-btn-primary rp-btn-sm" onClick={create} disabled={state === 'busy'}>
        <Icon name="plus" size={16} /> {label}
      </button>
      {state === 'err' && <span className="text-[13px] text-[var(--danger-ink)]">La tâche n’a pas été créée. Réessayez.</span>}
    </div>
  );
}

/** Bouton « Créer la tâche de correction » (tâche fact_fix). */
export function FixTaskButton({ businessId, item, demo }: { businessId: string; item: FactCheckItem; demo: boolean }) {
  const provider = PROVIDER_LABEL[item.provider] ?? item.provider;
  const task: ExecTask = {
    id: `fix-${item.field}-${item.provider}`,
    businessId,
    kind: 'fact_fix',
    title: `Corriger : ${provider} se trompe sur ${FACT_LABEL[item.field].toLowerCase()}`,
    why: `${provider} affirme « ${item.stated} » alors que votre fiche de vérité indique « ${item.expected} ».`,
    automation: 'semi',
    minutes: 15,
    impact: item.severity === 'haute' ? 3 : item.severity === 'moyenne' ? 2 : 1,
    status: 'todo',
    steps: [
      'Mettez à jour la même information sur vos sources : votre site d’abord, puis les plateformes où vous êtes présent (fiche Google pour un commerce local).',
      'Ajoutez-la au balisage schema.org de votre site.',
      'Repéré vérifiera de nouveau lundi prochain. La correction par l’IA n’est pas garantie et peut prendre plusieurs semaines.',
    ],
    deliverable: [{ type: 'text', label: 'Information exacte à publier', content: item.expected }],
    createdAt: new Date(0).toISOString(),
  };
  return <CreateTaskButton businessId={businessId} task={task} demo={demo} label="Créer la tâche de correction" factFix={{ field: item.field, expected: item.expected || '—', stated: item.stated, provider: item.provider, quote: item.quote, severity: item.severity }} />;
}
