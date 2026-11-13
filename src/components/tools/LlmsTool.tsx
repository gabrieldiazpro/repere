'use client';
import { useEffect, useId, useState } from 'react';
import type { LlmsResult } from '@/lib/siteaudit/llms';
import { buttonClasses } from '@/components/ui/Button';
import { callTool, downloadText, hostOf } from './api';
import { AuditBridge, CopyButton, EmailCapture, ErrorBox, ExampleNote, Loading, ResultHeader, Scope, ShareLink, UrlForm, useShareParams, useToolRun } from './ui';

export function HonestBox({ honest }: { honest: LlmsResult['honest'] }) {
  return (
    <aside className="rounded-xl border-2 border-warning/40 bg-warning-bg p-4 text-warning-ink" aria-labelledby="rt-honest">
      <h3 id="rt-honest" className="font-semibold">
        {honest.title}
      </h3>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {honest.points.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      <p className="mt-2 font-medium">{honest.verdict}</p>
    </aside>
  );
}

function LlmsResultView({ r, example }: { r: LlmsResult; example: boolean }) {
  const id = useId();
  const [text, setText] = useState(r.llmsTxt);
  useEffect(() => setText(r.llmsTxt), [r.llmsTxt]);
  return (
    <div className="mt-6 rt-fade space-y-5">
      {example && <ExampleNote what="site d’une plomberie imaginaire." />}
      <ResultHeader
        title={`llms.txt proposé pour ${hostOf(r.url)}`}
        sub={`${r.pages.length} pages retenues ${r.sitemapUrl ? 'depuis le sitemap' : 'depuis les liens de la page d’accueil (sitemap introuvable)'}.`}
        actions={!example ? <ShareLink params={{ url: r.url }} /> : undefined}
      />
      <HonestBox honest={r.honest} />
      <div className={`rounded-xl p-3 text-sm ${r.existing.found ? 'bg-primary-bg text-primary-deep' : 'bg-canvas text-ink'}`}>
        {r.existing.found ? (
          <>
            <p>
              <strong>Un llms.txt existe déjà</strong> à{' '}
              <a href={r.existing.url} className="underline underline-offset-2" rel="noopener nofollow">
                {r.existing.url}
              </a>
              .
            </p>
            {r.existing.issues.length > 0 ? (
              <ul className="mt-1 list-disc pl-5">
                {r.existing.issues.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-1">Son format est correct.</p>
            )}
          </>
        ) : (
          <p>Aucun llms.txt n’est publié sur ce site pour l’instant.</p>
        )}
      </div>
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <label htmlFor={`${id}-txt`} className="text-sm font-semibold text-ink">
            Fichier proposé (modifiable)
          </label>
          <div className="flex flex-wrap gap-2">
            <CopyButton text={text} label="Copier le fichier" />
            <button type="button" className={buttonClasses({ variant: 'secondary', size: 'sm' })} onClick={() => downloadText('llms.txt', text, 'text/markdown;charset=utf-8')}>
              Télécharger llms.txt
            </button>
          </div>
        </div>
        <textarea id={`${id}-txt`} className="rt-field rt-mono" rows={16} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
        <p className="mt-1 text-sm text-muted">Relisez les descriptions et retirez les pages sans intérêt avant de publier.</p>
      </div>
      <section aria-labelledby="rt-install">
        <h3 id="rt-install" className="font-semibold text-ink">
          Où le déposer
        </h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[0.95rem]">
          {r.instructions.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function LlmsTool({ example }: { example: LlmsResult }) {
  const [url, setUrl] = useState('');
  const { state, run, showExample } = useToolRun<LlmsResult>();
  const go = (u: string) => {
    setUrl(u);
    run((signal) => callTool('/api/tools/llms', { url: u }, { signal }));
  };
  useShareParams((p) => p.url && go(p.url));
  const busy = state.phase === 'loading';
  return (
    <>
      <Scope busy={busy}>
        <UrlForm label="Adresse de votre site" submitLabel="Générer le fichier" busy={busy} value={url} onChange={setUrl} onUrl={go} onExample={() => showExample(example)} />
        {busy && <Loading steps={['Lecture de la page d’accueil…', 'Lecture du sitemap…', 'Lecture des titres des pages principales…', 'Rédaction du fichier…']} />}
        {state.phase === 'error' && <ErrorBox error={state.error} onRetry={() => url && go(url)} />}
        {state.phase === 'done' && <LlmsResultView r={state.data} example={state.example} />}
        {state.phase === 'idle' && (
          <div className="mt-6">
            <HonestBox honest={example.honest} />
          </div>
        )}
      </Scope>
      {state.phase === 'done' && !state.example && <EmailCapture tool="Générateur de llms.txt" url={state.data.url} />}
      <AuditBridge done={state.phase === 'done'} url={state.phase === 'done' && !state.example ? state.data.url : null} text="Mieux qu’un fichier : mesurer si les IA vous citent, et sur quelles questions. C’est ce que fait l’audit." />
    </>
  );
}
