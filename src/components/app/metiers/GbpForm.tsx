'use client';
// Saisie guidée de la fiche Google (et Place ID facultatif) → POST /api/local/gbp.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { GbpAudit, ManualGbpInput } from '@/lib/local/types';
import { api, DEMO_SAVED, Notice, useLocalState } from './client';
import { byStatus, STATUS_META, taskHref } from './logic';

type Never = 'never';
interface FormState {
  placeId: string;
  name: string;
  primaryCategory: string;
  secondaryCategories: string;
  description: string;
  descriptionLength: string;
  hasHours: boolean;
  hoursText: string;
  hasSpecialHours: boolean;
  services: string;
  attributesCount: string;
  photosCount: string;
  lastPhotoDaysAgo: string | Never;
  lastPostDaysAgo: string | Never;
  website: string;
  phone: string;
  address: string;
  reviewCount: string;
  rating: string;
  lastReviewDaysAgo: string | Never;
  replied: string;
  repliedTotal: string;
}

const days = (v: number | null | undefined): string => (v === null ? 'never' : v === undefined ? '' : String(v));

export function toForm(m: ManualGbpInput | null | undefined, placeId?: string | null): FormState {
  const x = m ?? {};
  return {
    placeId: placeId ?? '',
    name: x.name ?? '',
    primaryCategory: x.primaryCategory ?? '',
    secondaryCategories: (x.secondaryCategories ?? []).join(', '),
    description: x.description ?? '',
    descriptionLength: x.description ? '' : x.descriptionLength !== undefined ? String(x.descriptionLength) : '',
    hasHours: x.hasHours ?? false,
    hoursText: x.hoursText ?? '',
    hasSpecialHours: x.hasSpecialHours ?? false,
    services: (x.services ?? []).join(', '),
    attributesCount: x.attributesCount !== undefined ? String(x.attributesCount) : '',
    photosCount: x.photosCount !== undefined ? String(x.photosCount) : '',
    lastPhotoDaysAgo: days(x.lastPhotoDaysAgo),
    lastPostDaysAgo: days(x.lastPostDaysAgo),
    website: x.website ?? '',
    phone: x.phone ?? '',
    address: x.address ?? '',
    reviewCount: x.reviewCount !== undefined ? String(x.reviewCount) : '',
    rating: x.rating !== undefined ? String(x.rating).replace('.', ',') : '',
    lastReviewDaysAgo: days(x.lastReviewDaysAgo),
    replied: x.repliedOfLast ? String(x.repliedOfLast.replied) : '',
    repliedTotal: x.repliedOfLast ? String(x.repliedOfLast.total) : '',
  };
}

const num = (s: string): number | undefined => {
  const n = Number(s.replace(',', '.').trim());
  return s.trim() !== '' && Number.isFinite(n) && n >= 0 ? n : undefined;
};
const daysOf = (s: string): number | null | undefined => (s === 'never' ? null : num(s));
const list = (s: string) => s.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean).slice(0, 30);

/** Formulaire → saisie guidée attendue par l'API (champs vides = inconnus, donc non évalués). */
export function toManual(f: FormState): ManualGbpInput {
  const m: ManualGbpInput = {};
  if (f.name.trim()) m.name = f.name.trim();
  if (f.primaryCategory.trim()) m.primaryCategory = f.primaryCategory.trim();
  if (f.secondaryCategories.trim()) m.secondaryCategories = list(f.secondaryCategories);
  if (f.description.trim()) m.description = f.description.trim();
  else if (num(f.descriptionLength) !== undefined) m.descriptionLength = num(f.descriptionLength);
  m.hasHours = f.hasHours;
  if (f.hoursText.trim()) m.hoursText = f.hoursText.trim();
  m.hasSpecialHours = f.hasSpecialHours;
  if (f.services.trim()) m.services = list(f.services);
  for (const k of ['attributesCount', 'photosCount', 'reviewCount', 'rating'] as const) {
    const v = num(f[k]);
    if (v !== undefined) m[k] = k === 'rating' ? Math.min(5, v) : Math.round(v);
  }
  for (const k of ['lastPhotoDaysAgo', 'lastPostDaysAgo', 'lastReviewDaysAgo'] as const) {
    const v = daysOf(f[k]);
    if (v !== undefined) m[k] = v === null ? null : Math.round(v);
  }
  if (f.website.trim()) m.website = f.website.trim();
  if (f.phone.trim()) m.phone = f.phone.trim();
  if (f.address.trim()) m.address = f.address.trim();
  const r = num(f.replied);
  const t = num(f.repliedTotal);
  if (r !== undefined && t !== undefined && t > 0) m.repliedOfLast = { replied: Math.min(r, t), total: t };
  return m;
}

function Field({ label, hint, children, wide }: { label: string; hint?: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={`flex flex-col gap-1 ${wide ? 'sm:col-span-2' : ''}`}>
      <span className="text-[13px] font-semibold">{label}</span>
      {children}
      {hint && <span className="text-[12px] text-[var(--muted)]">{hint}</span>}
    </label>
  );
}

function DaysField({ label, value, onChange, neverLabel }: { label: string; value: string; onChange: (v: string) => void; neverLabel: string }) {
  const never = value === 'never';
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-[13px] font-semibold">{label}</legend>
      <div className="flex items-center gap-2">
        <input className="rp-input w-24" inputMode="numeric" aria-label={`${label}, en jours`} disabled={never} value={never ? '' : value} onChange={(e) => onChange(e.target.value)} />
        <span className="text-[13px] text-[var(--muted)]">jours</span>
      </div>
      <label className="flex items-center gap-2 text-[13px]">
        <input type="checkbox" checked={never} onChange={(e) => onChange(e.target.checked ? 'never' : '')} />
        {neverLabel}
      </label>
    </fieldset>
  );
}

export function GbpForm({ businessId, demo, initial, initialPlaceId, placesEnabled }: { businessId: string; demo: boolean; initial: ManualGbpInput | null; initialPlaceId?: string | null; placesEnabled: boolean }) {
  const router = useRouter();
  const [saved, setSaved] = useLocalState<FormState | null>(`gbp:${businessId}`, null);
  const [f, setF] = useState<FormState>(() => toForm(initial, initialPlaceId));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ audit: GbpAudit; warning?: string; saved: boolean } | null>(null);
  const form = demo && saved ? saved : f;
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    const next = { ...form, [k]: v };
    setF(next);
    if (demo) setSaved(next);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const r = await api<{ audit: GbpAudit; warning?: string; saved: boolean }>('/api/local/gbp', { body: { businessId, manual: toManual(form), ...(form.placeId.trim() ? { placeId: form.placeId.trim() } : {}) } });
    setBusy(false);
    if (!r.ok || !r.data) return setErr(r.error ?? 'Le calcul a échoué.');
    setResult(r.data);
    if (r.data.saved) router.refresh();
  }

  const top = result ? byStatus(result.audit.criteria).filter((c) => c.status === 'fail' || c.status === 'warn').slice(0, 3) : [];

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" aria-describedby="gbp-form-intro">
      <p id="gbp-form-intro" className="text-[14px] text-[var(--muted)]">
        Recopiez ce que montre votre fiche Google (ouvrez-la sur Google Maps à côté). Un champ laissé vide n’est pas évalué : il ne fait pas baisser le score, il réduit la part de la grille lue.
      </p>

      {placesEnabled ? (
        <Field label="Identifiant de fiche Google (Place ID)" hint="Facultatif. Avec lui, nous lisons la fiche directement par l’API officielle de Google ; votre saisie complète ce que l’API ne donne pas." wide>
          <input className="rp-input" value={form.placeId} onChange={(e) => set('placeId', e.target.value)} placeholder="ChIJ…" autoComplete="off" spellCheck={false} />
        </Field>
      ) : (
        <p className="rounded-lg bg-[var(--bg)] p-3 text-[13px] text-[var(--muted)]">
          La lecture automatique de la fiche par l’API Google n’est pas activée sur cet espace : l’audit se fait sur votre saisie.
        </p>
      )}

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="rp-h2 mb-3">Identité et catégories</legend>
        <Field label="Nom affiché sur la fiche">
          <input className="rp-input" value={form.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Catégorie principale" hint="Exemple : Plombier">
          <input className="rp-input" value={form.primaryCategory} onChange={(e) => set('primaryCategory', e.target.value)} />
        </Field>
        <Field label="Catégories secondaires" hint="Séparées par des virgules" wide>
          <input className="rp-input" value={form.secondaryCategories} onChange={(e) => set('secondaryCategories', e.target.value)} />
        </Field>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="rp-h2 mb-3">Contenu</legend>
        <Field label="Description de la fiche" hint={form.description ? `${form.description.length} caractères sur 750` : 'Collez-la, ou indiquez seulement sa longueur ci-dessous.'} wide>
          <textarea className="rp-input min-h-[96px]" maxLength={750} value={form.description} onChange={(e) => set('description', e.target.value)} />
        </Field>
        {!form.description && (
          <Field label="Longueur de la description (caractères)">
            <input className="rp-input" inputMode="numeric" value={form.descriptionLength} onChange={(e) => set('descriptionLength', e.target.value)} />
          </Field>
        )}
        <Field label="Services listés" hint="Séparés par des virgules" wide>
          <input className="rp-input" value={form.services} onChange={(e) => set('services', e.target.value)} />
        </Field>
        <Field label="Nombre d’attributs cochés" hint="Accessibilité, paiements, « devis gratuit »…">
          <input className="rp-input" inputMode="numeric" value={form.attributesCount} onChange={(e) => set('attributesCount', e.target.value)} />
        </Field>
        <div className="flex flex-col gap-2 pt-1">
          <label className="flex items-center gap-2 text-[14px]">
            <input type="checkbox" checked={form.hasHours} onChange={(e) => set('hasHours', e.target.checked)} /> Horaires renseignés
          </label>
          <label className="flex items-center gap-2 text-[14px]">
            <input type="checkbox" checked={form.hasSpecialHours} onChange={(e) => set('hasSpecialHours', e.target.checked)} /> Horaires exceptionnels (jours fériés)
          </label>
        </div>
        {form.hasHours && (
          <Field label="Horaires affichés" hint="Comparés à votre fiche de vérité" wide>
            <input className="rp-input" value={form.hoursText} onChange={(e) => set('hoursText', e.target.value)} />
          </Field>
        )}
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="rp-h2 mb-3">Coordonnées</legend>
        <Field label="Téléphone">
          <input className="rp-input" type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
        </Field>
        <Field label="Site web">
          <input className="rp-input" value={form.website} onChange={(e) => set('website', e.target.value)} />
        </Field>
        <Field label="Adresse" wide>
          <input className="rp-input" value={form.address} onChange={(e) => set('address', e.target.value)} />
        </Field>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="rp-h2 mb-3">Photos, posts et avis</legend>
        <Field label="Nombre de photos">
          <input className="rp-input" inputMode="numeric" value={form.photosCount} onChange={(e) => set('photosCount', e.target.value)} />
        </Field>
        <DaysField label="Dernière photo il y a" value={form.lastPhotoDaysAgo} onChange={(v) => set('lastPhotoDaysAgo', v)} neverLabel="Aucune photo" />
        <DaysField label="Dernier post il y a" value={form.lastPostDaysAgo} onChange={(v) => set('lastPostDaysAgo', v)} neverLabel="Jamais publié" />
        <Field label="Nombre d’avis">
          <input className="rp-input" inputMode="numeric" value={form.reviewCount} onChange={(e) => set('reviewCount', e.target.value)} />
        </Field>
        <Field label="Note moyenne" hint="Sur 5">
          <input className="rp-input" inputMode="decimal" value={form.rating} onChange={(e) => set('rating', e.target.value)} />
        </Field>
        <DaysField label="Dernier avis il y a" value={form.lastReviewDaysAgo} onChange={(v) => set('lastReviewDaysAgo', v)} neverLabel="Aucun avis" />
        <fieldset className="flex flex-col gap-1 sm:col-span-3">
          <legend className="mb-1 text-[13px] font-semibold">Avis avec une réponse de votre part</legend>
          <div className="flex flex-wrap items-center gap-2 text-[14px]">
            <input className="rp-input w-20" inputMode="numeric" aria-label="Avis avec réponse" value={form.replied} onChange={(e) => set('replied', e.target.value)} />
            <span>sur les</span>
            <input className="rp-input w-20" inputMode="numeric" aria-label="Nombre d’avis récents regardés" value={form.repliedTotal} onChange={(e) => set('repliedTotal', e.target.value)} />
            <span>derniers avis</span>
          </div>
        </fieldset>
      </fieldset>

      <div className="flex flex-col gap-3">
        <div>
          <button type="submit" className="rp-btn rp-btn-primary" disabled={busy} aria-busy={busy}>
            {busy ? 'Calcul en cours…' : demo ? 'Recalculer le score (démo)' : 'Calculer et enregistrer le score'}
          </button>
        </div>
        {err && <Notice tone="error">{err}</Notice>}
        {demo && saved && !result && <Notice tone="demo">{DEMO_SAVED}</Notice>}
        {result && (
          <div className="rounded-xl border border-[var(--line)] p-4" aria-live="polite">
            <p className="text-[15px]">
              Nouveau score : <strong className="rp-display rp-num text-[22px]">{result.audit.score}</strong>/100
              <span className="ml-2 text-[13px] text-[var(--muted)]">grille lue à {result.audit.coverage}&nbsp;%</span>
            </p>
            {result.warning && <p className="mt-1 text-[13px] text-[var(--warning-ink)]">{result.warning}</p>}
            {!result.saved && <p className="mt-1 text-[13px] text-[var(--muted)]">Démo : calcul réel sur votre saisie, rien n’est enregistré.</p>}
            {top.length > 0 && (
              <ul className="mt-3 flex flex-col gap-2">
                {top.map((c) => (
                  <li key={c.id} className="text-[14px]">
                    <span className="font-semibold">{c.label}</span> <span className="text-[var(--muted)]">({STATUS_META[c.status].label.toLowerCase()})</span> : {c.fix}{' '}
                    {c.task && (
                      <Link className="rp-link" href={taskHref(c.task)}>
                        Ouvrir la tâche
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </form>
  );
}
