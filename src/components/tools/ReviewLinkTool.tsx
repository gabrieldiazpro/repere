'use client';
import { useId, useState, type FormEvent } from 'react';
import type { ReviewLinkResult } from '@/lib/siteaudit/reviewLink';
import { buttonClasses } from '@/components/ui/Button';
import { callTool, downloadText } from './api';
import { AuditBridge, CopyButton, EmailCapture, ErrorBox, ExampleNote, Loading, ResultHeader, Scope, ShareLink, useShareParams, useToolRun } from './ui';

const COLORS = [
  { v: '#1B1F2E', label: 'Noir encre' },
  { v: '#3730A3', label: 'Indigo' },
  { v: '#15803D', label: 'Vert' },
  { v: '#B91C1C', label: 'Rouge' },
];

interface Input {
  placeId: string;
  name: string;
  city: string;
  color: string;
}

function Poster({ r, name, headline }: { r: ReviewLinkResult; name: string; headline: string }) {
  if (!r.qrSvg) return null;
  return (
    <div className="rt-poster" data-print="true" aria-label="Aperçu de l’affichette A5">
      <div>
        <p className="rt-poster-title text-2xl font-bold leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
          {headline}
        </p>
        <p className="mt-1 text-sm text-muted">{name}</p>
      </div>
      {/* SVG produit par notre générateur de QR (src/lib/execution/qr.ts), sans contenu utilisateur. */}
      <div className="rt-poster-qr w-3/4" dangerouslySetInnerHTML={{ __html: r.qrSvg }} />
      <p className="text-sm leading-snug">Scannez ce code avec l’appareil photo de votre téléphone pour partager votre expérience sur Google, quelle qu’elle soit.</p>
    </div>
  );
}

function Result({ r, input, example }: { r: ReviewLinkResult; input: Input; example: boolean }) {
  const name = input.name.trim() || 'Votre établissement';
  const [headline, setHeadline] = useState('Votre avis compte');
  const id = useId();
  if (!r.reviewUrl) {
    return (
      <div className="mt-6 rt-fade space-y-4">
        <ResultHeader title="Il nous manque l’identifiant de votre fiche" />
        {r.limit && <p className="rounded-xl bg-warning-bg p-3 text-warning-ink">{r.limit}</p>}
        <ol className="list-decimal space-y-2 pl-5">
          {r.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-3">
          <a href={r.placeIdFinderUrl} target="_blank" rel="noopener" className={buttonClasses({ size: 'sm' })}>
            Ouvrir le Place ID Finder de Google
          </a>
          {r.mapsSearchUrl && (
            <a href={r.mapsSearchUrl} target="_blank" rel="noopener" className={buttonClasses({ variant: 'secondary', size: 'sm' })}>
              Retrouver ma fiche sur Google Maps
            </a>
          )}
        </div>
        <p className="text-sm text-muted">Autre voie : depuis votre fiche (business.google.com), le bouton « Demander des avis » donne directement un lien prêt à partager.</p>
      </div>
    );
  }
  return (
    <div className="mt-6 rt-fade">
      {example && <ExampleNote what="identifiant de lieu publié en exemple dans la documentation de Google ; le nom est imaginaire." />}
      <ResultHeader title="Votre lien d’avis est prêt" actions={!example ? <ShareLink params={{ placeid: r.placeId ?? undefined, nom: input.name || undefined }} /> : undefined} />
      <div className="flex flex-col gap-2 rounded-xl border border-line bg-white p-3 sm:flex-row sm:items-center">
        <code className="min-w-0 flex-1 break-all text-sm text-ink">{r.reviewUrl}</code>
        <div className="flex shrink-0 gap-2">
          <CopyButton text={r.reviewUrl} label="Copier le lien" />
          <a href={r.reviewUrl} target="_blank" rel="noopener" className={buttonClasses({ variant: 'secondary', size: 'sm' })}>
            Tester
          </a>
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_1.1fr]">
        <div className="space-y-4">
          <div>
            <label htmlFor={`${id}-head`} className="mb-1 block text-sm font-semibold text-ink">
              Titre de l’affichette
            </label>
            <input id={`${id}-head`} className="rt-field" maxLength={60} value={headline} onChange={(e) => setHeadline(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={buttonClasses({ size: 'sm' })} onClick={() => window.print()}>
              Imprimer l’affichette A5
            </button>
            {r.qrSvg && (
              <button type="button" className={buttonClasses({ variant: 'secondary', size: 'sm' })} onClick={() => downloadText('qr-avis-google.svg', r.qrSvg ?? '', 'image/svg+xml')}>
                Télécharger le QR code (SVG)
              </button>
            )}
            {!r.qrSvg && r.qrServiceUrl && (
              <a href={r.qrServiceUrl} target="_blank" rel="noopener" className={buttonClasses({ variant: 'secondary', size: 'sm' })}>
                Ouvrir le QR code
              </a>
            )}
          </div>
          <p className="text-sm text-muted">À l’impression, choisissez le format A5 (ou A4 en « ajuster à la page ») et une échelle de 100 %. Le QR code mesure alors environ 9 cm.</p>
          <details className="rt-details rounded-xl border border-line bg-white">
            <summary className="cursor-pointer px-4 py-3 font-semibold">Modèle de SMS</summary>
            <div className="rt-details-body space-y-2 px-4 pb-4">
              <p className="whitespace-pre-line text-[0.95rem]">{r.kit.sms}</p>
              <CopyButton text={r.kit.sms} label="Copier le SMS" />
            </div>
          </details>
          <details className="rt-details rounded-xl border border-line bg-white">
            <summary className="cursor-pointer px-4 py-3 font-semibold">Modèle d’e-mail</summary>
            <div className="rt-details-body space-y-2 px-4 pb-4">
              <p className="text-sm text-muted">Objet : {r.kit.email.subject}</p>
              <p className="whitespace-pre-line text-[0.95rem]">{r.kit.email.body}</p>
              <CopyButton text={`${r.kit.email.subject}\n\n${r.kit.email.body}`} label="Copier l’e-mail" />
            </div>
          </details>
        </div>
        <Poster r={r} name={name} headline={headline || 'Votre avis compte'} />
      </div>

      <section className="mt-6 rounded-xl bg-canvas p-4" aria-labelledby="rt-rules">
        <h3 id="rt-rules" className="font-semibold text-ink">
          Les règles à respecter
        </h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[0.95rem]">
          {r.kit.rules.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
        <p className="mt-2 text-sm text-muted">{r.note}</p>
      </section>
    </div>
  );
}

export function ReviewLinkTool({ example }: { example: ReviewLinkResult }) {
  const id = useId();
  const [input, setInput] = useState<Input>({ placeId: '', name: '', city: '', color: COLORS[0].v });
  const [used, setUsed] = useState<Input>(input);
  const [msg, setMsg] = useState('');
  const { state, run, showExample } = useToolRun<ReviewLinkResult>();
  const busy = state.phase === 'loading';
  const set = (k: keyof Input, v: string) => setInput((x) => ({ ...x, [k]: v }));

  const go = (i: Input) => {
    setUsed(i);
    run((signal) =>
      callTool(
        '/api/tools/review-link',
        { ...(i.placeId.trim() ? { placeId: i.placeId.trim() } : {}), ...(i.name.trim() ? { name: i.name.trim() } : {}), ...(i.city.trim() ? { city: i.city.trim() } : {}), color: i.color },
        { signal },
      ),
    );
  };
  useShareParams((p) => {
    const i = { placeId: p.placeid ?? '', name: p.nom ?? '', city: p.ville ?? '', color: COLORS[0].v };
    setInput(i);
    if (i.placeId || (i.name && i.city)) go(i);
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.placeId.trim() && !(input.name.trim() && input.city.trim())) {
      return setMsg('Collez le lien de votre fiche ou votre Place ID. À défaut, indiquez le nom et la ville : nous vous guiderons pour retrouver l’identifiant.');
    }
    if (input.placeId.includes('maps.app.goo.gl') || input.placeId.includes('goo.gl/maps')) {
      return setMsg('Ce lien raccourci ne contient pas l’identifiant de la fiche. Ouvrez-le dans votre navigateur, puis copiez l’adresse complète affichée.');
    }
    setMsg('');
    go(input);
  };

  return (
    <>
      <Scope busy={busy}>
        <form onSubmit={submit} noValidate aria-busy={busy}>
          <div>
            <label htmlFor={`${id}-pid`} className="mb-1.5 block text-[0.95rem] font-semibold text-ink">
              Lien Google Maps de votre fiche, ou Place ID
            </label>
            <input
              id={`${id}-pid`}
              className="rt-field"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="https://www.google.com/maps/place/… ou ChIJ…"
              value={input.placeId}
              onChange={(e) => set('placeId', e.target.value)}
              aria-invalid={msg ? 'true' : undefined}
            />
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1.3fr_1fr_auto]">
            <div>
              <label htmlFor={`${id}-name`} className="mb-1.5 block text-[0.95rem] font-semibold text-ink">
                Nom de l’établissement
              </label>
              <input id={`${id}-name`} className="rt-field" maxLength={120} autoComplete="organization" value={input.name} onChange={(e) => set('name', e.target.value)} />
            </div>
            <div>
              <label htmlFor={`${id}-city`} className="mb-1.5 block text-[0.95rem] font-semibold text-ink">
                Ville
              </label>
              <input id={`${id}-city`} className="rt-field" maxLength={100} autoComplete="address-level2" value={input.city} onChange={(e) => set('city', e.target.value)} />
            </div>
            <fieldset>
              <legend className="mb-1.5 block text-[0.95rem] font-semibold text-ink">Couleur du QR</legend>
              <div className="flex min-h-12 items-center gap-2">
                {COLORS.map((c) => (
                  <label key={c.v} className="relative cursor-pointer">
                    <input type="radio" name={`${id}-color`} value={c.v} checked={input.color === c.v} onChange={() => set('color', c.v)} className="peer sr-only" />
                    <span className="block size-8 rounded-full ring-2 ring-transparent ring-offset-2 peer-checked:ring-primary peer-focus-visible:outline-3 peer-focus-visible:outline-primary" style={{ background: c.v }} />
                    <span className="sr-only">{c.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
          {msg && (
            <p role="alert" className="mt-2 text-sm font-medium text-danger-ink">
              {msg}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="submit" className={buttonClasses()} disabled={busy}>
              {busy ? 'Création…' : 'Créer mon lien et mon QR code'}
            </button>
            <button
              type="button"
              onClick={() => {
                setUsed({ placeId: example.placeId ?? '', name: 'Plomberie Martin', city: '', color: COLORS[0].v });
                showExample(example);
              }}
              className="text-sm font-semibold text-primary underline underline-offset-2 hover:no-underline"
              disabled={busy}
            >
              Voir un exemple
            </button>
          </div>
        </form>
        {busy && <Loading steps={['Construction du lien et du QR code…']} />}
        {state.phase === 'error' && <ErrorBox error={state.error} />}
        {state.phase === 'done' && <Result r={state.data} input={used} example={state.example} />}
      </Scope>
      {state.phase === 'done' && !state.example && state.data.reviewUrl && <EmailCapture tool="Lien d’avis Google" />}
      <AuditBridge done={state.phase === 'done'} text="Vos avis pèsent dans ce que les IA disent de vous (corrélation observée, pas garantie). Voyez ce que ChatGPT répond quand on lui demande un commerce comme le vôtre." />
    </>
  );
}
