'use client';
// Thèmes des avis (positifs / négatifs) et brouillons de réponse selon la tonalité : POST /api/local/reviews.
import { useState } from 'react';
import { CopyButton } from '@/components/app/CopyButton';
import type { ReviewThemesReport } from '@/lib/local/types';
import { api, Notice } from './client';

const TONE_LABEL: Record<string, { label: string; chip: string }> = {
  positif: { label: 'Avis positif', chip: 'rp-chip-success' },
  mitige: { label: 'Avis mitigé', chip: 'rp-chip-warning' },
  negatif: { label: 'Avis négatif', chip: 'rp-chip-danger' },
};

export function ReviewsClient({ businessId, demo, initial, llmAllowed, llmLock }: { businessId: string; demo: boolean; initial: ReviewThemesReport | null; llmAllowed: boolean; llmLock?: React.ReactNode }) {
  const [report, setReport] = useState<ReviewThemesReport | null>(initial);
  const [text, setText] = useState('');
  const [llm, setLlm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pasted, setPasted] = useState<string[]>([]);

  async function analyze(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return setErr('Collez au moins un avis (un par paragraphe).');
    setBusy(true);
    setErr(null);
    const r = await api<{ report: ReviewThemesReport; saved: boolean }>('/api/local/reviews', { body: { businessId, reviews: text, replies: 5, llm: llm && llmAllowed } });
    setBusy(false);
    if (!r.ok || !r.data) return setErr(r.error ?? 'L’analyse a échoué.');
    setReport(r.data.report);
    setPasted(text.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean));
  }

  const maxCount = Math.max(1, ...(report?.themes ?? []).map((t) => t.positive + t.negative));

  return (
    <div className="flex flex-col gap-5">
      {report ? (
        <>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[14px]">
            <span>
              <strong className="rp-num">{report.analyzed}</strong> avis analysés
            </span>
            {report.averageRating !== null && (
              <span>
                note moyenne <strong className="rp-num">{report.averageRating.toLocaleString('fr-FR')}</strong>/5
              </span>
            )}
            <span className="text-[var(--muted)]">
              {report.tones.positif} positifs · {report.tones.mitige} mitigés · {report.tones.negatif} négatifs
            </span>
            {(report.source === 'demo' || demo) && <span className="rp-chip rp-chip-warning">avis fictifs (démo)</span>}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl bg-[var(--success-bg)] p-4 text-[var(--success-ink)]">
              <p className="font-semibold">Ce que vos clients apprécient</p>
              <ul className="mt-1 list-disc pl-5 text-[14px]">{report.strengths.length ? report.strengths.map((s) => <li key={s}>{s}</li>) : <li>Pas encore de point fort net.</li>}</ul>
            </div>
            <div className="rounded-xl bg-[var(--danger-bg)] p-4 text-[var(--danger-ink)]">
              <p className="font-semibold">Ce qui revient en négatif</p>
              <ul className="mt-1 list-disc pl-5 text-[14px]">{report.weaknesses.length ? report.weaknesses.map((s) => <li key={s}>{s}</li>) : <li>Aucun reproche récurrent.</li>}</ul>
            </div>
          </div>

          <ul className="flex flex-col gap-3" aria-label="Thèmes des avis">
            {report.themes.map((t) => (
              <li key={t.id} className="grid gap-2 sm:grid-cols-[minmax(120px,26%)_1fr]">
                <div>
                  <p className="font-medium">{t.label}</p>
                  <p className="rp-num text-[12px] text-[var(--muted)]">
                    {t.positive} positif{t.positive > 1 ? 's' : ''}, {t.negative} négatif{t.negative > 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex h-2 overflow-hidden rounded-full bg-[var(--hair)]" aria-hidden="true">
                    <span style={{ width: `${((t.positive / maxCount) * 100).toFixed(1)}%`, background: 'var(--success)' }} />
                    <span style={{ width: `${((t.negative / maxCount) * 100).toFixed(1)}%`, background: 'var(--danger)' }} />
                  </div>
                  {t.examples.slice(0, 2).map((x, i) => (
                    <p key={i} className={`text-[13px] ${x.polarity === 'negative' ? 'text-[var(--danger-ink)]' : 'text-[var(--muted)]'}`}>
                      « {x.quote} »
                    </p>
                  ))}
                </div>
              </li>
            ))}
          </ul>

          {report.replies && report.replies.length > 0 && (
            <section aria-labelledby="replies-h">
              <h3 id="replies-h" className="rp-h2 mb-1">
                Brouillons de réponse
              </h3>
              <p className="mb-3 text-[13px] text-[var(--muted)]">Ton adapté à chaque avis, sans donnée personnelle ni promesse. Relisez et personnalisez avant de publier sur Google.</p>
              <ul className="flex flex-col gap-3">
                {report.replies.map((r) => {
                  const t = TONE_LABEL[r.tone] ?? { label: r.tone, chip: '' };
                  const source = pasted[r.index];
                  return (
                    <li key={r.index} className="rounded-xl border border-[var(--line)] p-3">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <span className={`rp-chip ${t.chip}`}>{t.label}</span>
                        <CopyButton text={r.draft} label="Copier la réponse" />
                      </div>
                      {source && <p className="mb-2 border-l-2 border-[var(--line)] pl-3 text-[13px] text-[var(--muted)]">{source.slice(0, 240)}</p>}
                      <p className="whitespace-pre-line text-[14px]">{r.draft}</p>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          {report.notes.map((n) => (
            <p key={n} className="text-[12px] text-[var(--muted)]">
              {n}
            </p>
          ))}
        </>
      ) : (
        <p className="text-[14px] text-[var(--muted)]">Collez vos derniers avis Google ci-dessous : nous en tirons les thèmes qui reviennent et un brouillon de réponse pour chacun.</p>
      )}

      <form onSubmit={analyze} className="flex flex-col gap-3 border-t border-[var(--hair)] pt-4">
        <label className="flex flex-col gap-1">
          <span className="text-[13px] font-semibold">{report ? 'Analyser d’autres avis' : 'Vos avis'}</span>
          <textarea className="rp-input min-h-[120px]" value={text} onChange={(e) => setText(e.target.value)} placeholder={'Un avis par paragraphe. Ajoutez « 4/5 » ou « ★★★★ » pour la note si vous l’avez.'} />
          <span className="text-[12px] text-[var(--muted)]">N’incluez pas le nom des clients : il n’est pas nécessaire et n’est jamais repris dans les réponses.</span>
        </label>
        {llmAllowed ? (
          <label className="flex items-center gap-2 text-[14px]">
            <input type="checkbox" checked={llm} onChange={(e) => setLlm(e.target.checked)} /> Synthèse rédigée par IA (en plus des règles)
          </label>
        ) : (
          llmLock
        )}
        <div>
          <button type="submit" className="rp-btn rp-btn-primary" disabled={busy} aria-busy={busy}>
            {busy ? 'Analyse en cours…' : 'Analyser les avis'}
          </button>
        </div>
        {demo && <Notice tone="demo">Démo : l’analyse est réelle mais rien n’est enregistré.</Notice>}
        {err && <Notice tone="error">{err}</Notice>}
      </form>
    </div>
  );
}
