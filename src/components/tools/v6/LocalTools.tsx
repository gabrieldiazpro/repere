'use client';
/** Outils calculés dans le navigateur, sans envoi : lisibilité en français et générateur de robots.txt. */
import { useEffect, useId, useMemo, useState } from 'react';
import { buttonClasses } from '@/components/ui/Button';
import { downloadText } from '../api';
import { AuditBridge, CheckList, CodeBlock, ExampleNote, Gauge, Scope } from '../ui';
import { ALL_GEN_BOTS, SEARCH_ENGINES, detectProfile, generateRobots, profileBots, readability, splitList } from './pure';
import type { BotPolicy, RobotsProfile } from './types';
import { Stat, ToneIcon, VerdictBanner } from './ui';

/* ------------------------------------------------------------------ */
/* Lisibilité                                                          */
/* ------------------------------------------------------------------ */

export function ReadabilityTool({ exampleText }: { exampleText: string }) {
  const id = useId();
  const [text, setText] = useState('');
  const [isExample, setIsExample] = useState(false);
  const r = useMemo(() => readability(text), [text]);
  const has = r.words > 0;
  return (
    <>
      <Scope>
        <label htmlFor={`${id}-txt`} className="mb-1.5 flex justify-between gap-2 text-[0.95rem] font-semibold text-ink">
          Votre texte <span className="font-normal tabular-nums text-muted">{r.words} mots</span>
        </label>
        <textarea
          id={`${id}-txt`}
          className="rt-field !min-h-48"
          value={text}
          onChange={(e) => (setText(e.target.value), setIsExample(false))}
          placeholder="Collez ici le texte d’une page, d’un article ou d’une fiche produit…"
          maxLength={60_000}
        />
        <p className="mt-2 text-sm text-muted">
          Calculé dans votre navigateur : rien n’est envoyé.{' '}
          <button type="button" className="font-semibold text-primary underline underline-offset-2 hover:no-underline" onClick={() => (setText(exampleText), setIsExample(true))}>
            Essayer avec un exemple
          </button>
          {text && (
            <>
              {' · '}
              <button type="button" className="font-semibold text-primary underline underline-offset-2 hover:no-underline" onClick={() => (setText(''), setIsExample(false))}>
                Effacer
              </button>
            </>
          )}
        </p>
        {has && (
          <div className="mt-6 rt-fade" aria-live="polite">
            {isExample && <ExampleNote what="texte de présentation d’une plomberie imaginaire, volontairement trop dense." />}
            <VerdictBanner verdict={r.verdict} />
            <div className="grid gap-5 md:grid-cols-[auto_minmax(0,1fr)] md:items-center">
              <Gauge score={r.score} caption={`Indice de Kandel et Moles : ${r.band.label.toLowerCase()}`} size={190} />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Stat value={r.words.toLocaleString('fr-FR')} label="Mots" />
                <Stat value={r.sentences} label="Phrases" />
                <Stat value={`${r.readingMinutes} min`} label="Lecture (230 mots/min)" />
                <Stat value={r.wordsPerSentence.toString().replace('.', ',')} tone={r.wordsPerSentence > 20 ? 'warn' : undefined} label="Mots par phrase" />
                <Stat value={r.characters.toLocaleString('fr-FR')} label="Caractères" />
                <Stat value={r.paragraphs} label="Paragraphes" />
              </div>
            </div>
            {r.longSentences.length > 0 && (
              <section className="mt-6" aria-labelledby={`${id}-long`}>
                <h2 id={`${id}-long`} className="mb-2 text-base font-semibold text-ink">
                  Les phrases à couper en premier
                </h2>
                <ol className="grid gap-2">
                  {r.longSentences.map((s, i) => (
                    <li key={i} className="rounded-xl border border-line bg-white px-3 py-2 text-[0.95rem] leading-relaxed">
                      <span className="mr-2 rounded-full bg-warning-bg px-2 py-0.5 text-xs font-semibold text-warning-ink">{(s.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length} mots</span>
                      {s}
                    </li>
                  ))}
                </ol>
              </section>
            )}
            {r.topWords.length > 0 && (
              <section className="mt-6" aria-labelledby={`${id}-top`}>
                <h2 id={`${id}-top`} className="mb-2 text-base font-semibold text-ink">
                  Les mots les plus fréquents
                </h2>
                <ul className="flex flex-wrap gap-2">
                  {r.topWords.map((w) => (
                    <li key={w.word} className="rounded-full bg-white px-3 py-1 text-sm ring-1 ring-line">
                      {w.word} <span className="tabular-nums text-muted">× {w.count} ({w.share.toString().replace('.', ',')} %)</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <h2 className="mb-3 mt-6 text-base font-semibold text-ink">Le détail des contrôles</h2>
            <CheckList checks={r.checks} />
          </div>
        )}
      </Scope>
      <AuditBridge to="analyse" done={has} url={null} text="L’analyse repère sur tout votre site les pages trop courtes, trop denses ou peu citables par les IA." />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Générateur de robots.txt                                            */
/* ------------------------------------------------------------------ */

const PROFILES: [Exclude<RobotsProfile, 'perso'>, string, string][] = [
  ['cite', 'Cité, sans entraînement', 'Moteurs et IA de recherche autorisés ; entraînement refusé.'],
  ['ouvert', 'Ouvert à tous', 'Tous les robots peuvent lire le site.'],
  ['ferme', 'Fermé aux IA', 'Seuls les moteurs classiques lisent le site.'],
];

export function RobotsGenTool({ today: initialDay }: { today: string }) {
  const id = useId();
  // Date du jour du visiteur (la date de génération statique sert seulement au premier rendu).
  const [today, setToday] = useState(initialDay);
  useEffect(() => setToday(new Date().toISOString().slice(0, 10)), []);
  const [bots, setBots] = useState<Record<string, BotPolicy>>(() => profileBots('cite'));
  const [paths, setPaths] = useState('/admin/\n/panier/\n/mon-compte/');
  const [sitemap, setSitemap] = useState('');
  const profile = detectProfile(bots);
  const res = useMemo(() => generateRobots({ bots, disallow: splitList(paths), sitemaps: splitList(sitemap) }, today), [bots, paths, sitemap, today]);
  const toggle = (t: string) => setBots((b) => ({ ...b, [t]: b[t] === 'block' ? 'allow' : 'block' }));
  return (
    <>
      <Scope>
        <fieldset>
          <legend className="mb-2 text-[0.95rem] font-semibold text-ink">1. Votre choix pour les IA</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {PROFILES.map(([k, label, text]) => (
              <button
                key={k}
                type="button"
                aria-pressed={profile === k}
                onClick={() => setBots(profileBots(k))}
                className={`rounded-xl px-3 py-2.5 text-left ring-1 ring-inset transition-colors ${profile === k ? 'bg-primary text-white ring-primary' : 'bg-white text-ink ring-line hover:ring-primary'}`}
              >
                <span className="block font-semibold">{label}</span>
                <span className={`block text-sm ${profile === k ? 'text-white/85' : 'text-muted'}`}>{text}</span>
              </button>
            ))}
          </div>
          {profile === 'perso' && <p className="mt-2 text-sm text-muted">Réglage personnalisé.</p>}
        </fieldset>

        <details className="rt-details mt-4 overflow-hidden rounded-xl border border-line bg-white">
          <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-4 py-2.5 font-semibold text-ink hover:bg-canvas focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-primary">
            Ajuster robot par robot ({ALL_GEN_BOTS.length})
            <svg className="rt-chevron shrink-0 text-muted" viewBox="0 0 16 16" width="16" height="16" aria-hidden>
              <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </summary>
          <ul className="rt-details-body divide-y divide-line border-t border-line">
            {ALL_GEN_BOTS.map((b) => {
              const blocked = bots[b.token] === 'block';
              const engine = SEARCH_ENGINES.includes(b.token);
              return (
                <li key={b.token} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">
                      {b.token} <span className="font-normal text-muted">· {b.operator}</span>
                    </p>
                    <p className="text-sm text-muted">{engine ? 'Moteur de recherche' : b.meaning}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={!blocked}
                    aria-label={`${b.token} : ${blocked ? 'bloqué' : 'autorisé'}`}
                    onClick={() => toggle(b.token)}
                    className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold ${blocked ? 'bg-danger-bg text-danger-ink' : 'bg-success-bg text-success-ink'}`}
                  >
                    <ToneIcon tone={blocked ? 'fail' : 'ok'} size={14} />
                    {blocked ? 'Bloqué' : 'Autorisé'}
                  </button>
                </li>
              );
            })}
          </ul>
        </details>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-p`} className="mb-1.5 block text-[0.95rem] font-semibold text-ink">
              2. Dossiers à ne pas explorer <span className="font-normal text-muted">(un par ligne)</span>
            </label>
            <textarea id={`${id}-p`} className="rt-field rt-mono !min-h-28" value={paths} onChange={(e) => setPaths(e.target.value)} spellCheck={false} />
          </div>
          <div>
            <label htmlFor={`${id}-s`} className="mb-1.5 block text-[0.95rem] font-semibold text-ink">
              3. Adresse de votre sitemap
            </label>
            <input id={`${id}-s`} className="rt-field rt-mono" value={sitemap} onChange={(e) => setSitemap(e.target.value)} placeholder="https://votre-site.fr/sitemap.xml" spellCheck={false} inputMode="url" />
            <p className="mt-1.5 text-sm text-muted">Pas sûr ? Notre validateur de sitemap le trouve pour vous.</p>
          </div>
        </div>

        <div className="mt-6" aria-live="polite">
          <VerdictBanner verdict={res.verdict} />
          {res.errors.length > 0 && (
            <ul role="alert" className="mb-4 list-disc space-y-1 rounded-xl bg-danger-bg p-4 pl-8 text-sm text-danger-ink">
              {res.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          {res.warnings.length > 0 && (
            <ul className="mb-4 list-disc space-y-1 rounded-xl bg-warning-bg p-4 pl-8 text-sm text-warning-ink">
              {res.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
          <CodeBlock
            code={res.text}
            label="Votre robots.txt"
            actions={
              <button type="button" className={buttonClasses({ variant: 'secondary', size: 'sm' })} onClick={() => downloadText('robots.txt', res.text)}>
                Télécharger
              </button>
            }
          />
          <details className="rt-details mt-4 overflow-hidden rounded-xl border border-line bg-white">
            <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-4 py-2.5 font-semibold text-ink hover:bg-canvas focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-primary">
              Vérification : ce que chaque robot pourra lire
              <svg className="rt-chevron shrink-0 text-muted" viewBox="0 0 16 16" width="16" height="16" aria-hidden>
                <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </summary>
            <ul className="rt-details-body grid gap-x-6 border-t border-line px-4 py-2 sm:grid-cols-2">
              {res.rows.map((r) => (
                <li key={r.token} className="flex items-center justify-between gap-3 border-b border-line py-2 text-sm last:border-0">
                  <span className="min-w-0">
                    <span className="font-semibold text-ink">{r.token}</span> <span className="text-muted">· {r.roleLabel}</span>
                  </span>
                  <span className={`inline-flex shrink-0 items-center gap-1 font-semibold ${r.allowedHome ? 'text-success-ink' : 'text-danger-ink'}`}>
                    <ToneIcon tone={r.allowedHome ? 'ok' : 'fail'} size={14} />
                    {r.allowedHome ? (r.blockedSample ? 'Site lu, dossiers privés exclus' : 'Lit le site') : 'Bloqué'}
                  </span>
                </li>
              ))}
            </ul>
          </details>
          <p className="mt-3 text-sm text-muted">Déposez le fichier à la racine (https://votre-site.fr/robots.txt), puis contrôlez-le avec notre vérificateur robots.txt des IA.</p>
        </div>
      </Scope>
      <AuditBridge to="analyse" done url={null} text="Votre fichier est prêt. L’analyse vérifie ce que Google et les IA lisent réellement de votre site." />
    </>
  );
}
