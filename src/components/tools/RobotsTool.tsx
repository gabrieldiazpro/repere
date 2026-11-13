'use client';
import { useState } from 'react';
import type { BotVerdict, RobotsReport } from '@/lib/siteaudit/types';
import { callTool, downloadText, hostOf } from './api';
import { AuditBridge, CodeBlock, EmailCapture, ErrorBox, ExampleNote, Loading, ResultHeader, Scope, ShareLink, StatusPill, UrlForm, useShareParams, useToolRun } from './ui';
import { buttonClasses } from '@/components/ui/Button';

const STATUS: Record<BotVerdict['status'], { label: string; tone: 'ok' | 'warn' | 'fail' }> = {
  allowed: { label: 'Autorisé', tone: 'ok' },
  blocked: { label: 'Bloqué', tone: 'fail' },
  not_mentioned: { label: 'Non précisé', tone: 'ok' },
};

/** Un blocage d'entraînement est un choix légitime : affiché en neutre, pas en erreur. */
function toneOf(b: BotVerdict): 'ok' | 'warn' | 'fail' {
  if (b.status !== 'blocked') return b.severity === 'warn' ? 'warn' : 'ok';
  return b.severity === 'critical' ? 'fail' : 'warn';
}

const GROUP_LABEL: Record<BotVerdict['group'], string> = { specific: 'groupe propre', wildcard: 'groupe « * »', none: 'aucun groupe' };

function BotRow({ b }: { b: BotVerdict }) {
  return (
    <li className="grid gap-x-4 gap-y-1 px-4 py-3 md:grid-cols-[minmax(10rem,1.1fr)_minmax(8rem,0.8fr)_auto_minmax(12rem,1.6fr)] md:items-start">
      <div className="min-w-0">
        <p className="font-semibold text-ink">{b.token}</p>
        <p className="text-sm text-muted">
          {b.operator}, {b.product}
        </p>
      </div>
      <p className="text-sm text-ink md:pt-0.5">{b.roleLabel}</p>
      <div className="md:pt-0.5">
        <StatusPill status={toneOf(b)} label={STATUS[b.status].label} />
      </div>
      <div className="min-w-0 text-sm">
        <p className="text-ink">{b.recommendation}</p>
        <p className="mt-0.5 text-muted">
          {b.line !== null && b.rule ? (
            <>
              Ligne {b.line} : <code className="rounded bg-canvas px-1 text-[0.85em]">{b.rule}</code> ({GROUP_LABEL[b.group]})
            </>
          ) : (
            <>Aucune règle ne le vise ({GROUP_LABEL[b.group]}).</>
          )}
          {b.blockedPaths.length > 0 && <> Chemins interdits : {b.blockedPaths.slice(0, 4).join(', ')}.</>}
        </p>
      </div>
    </li>
  );
}

function RobotsResult({ r, example }: { r: RobotsReport; example: boolean }) {
  const [profile, setProfile] = useState<'cite' | 'citeNoTraining'>('citeNoTraining');
  const blockedSearch = r.summary.searchBlocked;
  const code = r.recommended[profile];
  return (
    <div className="mt-6 rt-fade">
      {example && <ExampleNote what="robots.txt d’une plomberie imaginaire qui bloque GPTBot et CCBot." />}
      <ResultHeader
        title={`Robots d’IA sur ${hostOf(r.url)}`}
        sub={
          r.found ? (
            <>
              Fichier lu :{' '}
              <a href={r.robotsUrl} className="underline underline-offset-2" rel="noopener nofollow">
                {r.robotsUrl}
              </a>{' '}
              (chemins testés : {r.paths.join(', ')})
            </>
          ) : r.unreachable ? (
            `robots.txt injoignable (${r.httpStatus ?? 'pas de réponse'}) : les robots respectueux considèrent alors tout le site comme interdit.`
          ) : (
            `Pas de robots.txt (HTTP ${r.httpStatus}) : tous les robots sont autorisés par défaut.`
          )
        }
        actions={!example ? <ShareLink params={{ url: r.url }} /> : undefined}
      />

      <div className={`mb-4 rounded-xl p-4 ${blockedSearch.length ? 'bg-danger-bg text-danger-ink' : 'bg-success-bg text-success-ink'}`} role="note">
        {blockedSearch.length ? (
          <p>
            <strong>Robots de recherche bloqués : {blockedSearch.join(', ')}.</strong> Ces IA ne peuvent pas citer vos pages dans leurs réponses avec sources.
          </p>
        ) : (
          <p>
            <strong>Les robots de recherche des IA peuvent lire votre site.</strong>
            {r.summary.trainingBlocked.length > 0 && <> Entraînement refusé pour {r.summary.trainingBlocked.join(', ')} : c’est un choix légitime, sans effet sur les citations.</>}
          </p>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-white">
        <div className="hidden gap-x-4 border-b border-line bg-canvas px-4 py-2 text-xs font-semibold text-muted md:grid md:grid-cols-[minmax(10rem,1.1fr)_minmax(8rem,0.8fr)_auto_minmax(12rem,1.6fr)]" aria-hidden>
          <span>Robot</span>
          <span>Rôle</span>
          <span>Statut</span>
          <span>Ce que ça veut dire</span>
        </div>
        <ul className="divide-y divide-line">
          {r.bots.map((b) => (
            <BotRow key={b.token} b={b} />
          ))}
        </ul>
      </div>
      <p className="mt-2 text-xs text-muted">Liste des robots datée du {r.botsListVersion}, revue chaque trimestre.</p>

      <section className="mt-6" aria-labelledby="rt-reco">
        <h3 id="rt-reco" className="font-semibold text-ink">
          Les lignes à mettre dans votre robots.txt
        </h3>
        <div role="group" aria-label="Profil du robots.txt" className="mt-3 flex flex-wrap gap-2">
          {(
            [
              ['citeNoTraining', 'Être cité, sans servir à l’entraînement'],
              ['cite', 'Être cité, entraînement autorisé'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              aria-pressed={profile === k}
              onClick={() => setProfile(k)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ring-inset transition-colors ${profile === k ? 'bg-primary text-white ring-primary' : 'bg-white text-ink ring-line hover:ring-primary'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-3">
          <CodeBlock
            code={code}
            label="robots.txt proposé"
            actions={
              <button type="button" className={buttonClasses({ variant: 'secondary', size: 'sm' })} onClick={() => downloadText('robots.txt', code)}>
                Télécharger
              </button>
            }
          />
        </div>
        <p className="mt-2 text-sm text-muted">Remplacez votre fichier en conservant vos propres règles (pages d’administration, panier). Le fichier se dépose à la racine : https://votre-site.fr/robots.txt.</p>
      </section>

      {r.limits.length > 0 && (
        <ul className="mt-5 list-disc space-y-1 pl-5 text-sm text-muted">
          {r.limits.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function RobotsTool({ example }: { example: RobotsReport }) {
  const [url, setUrl] = useState('');
  const { state, run, showExample } = useToolRun<RobotsReport>();
  const go = (u: string) => {
    setUrl(u);
    run((signal) => callTool('/api/tools/robots', { url: u }, { signal }));
  };
  useShareParams((p) => p.url && go(p.url));
  const busy = state.phase === 'loading';
  return (
    <>
      <Scope busy={busy}>
        <UrlForm label="Adresse ou domaine de votre site" submitLabel="Vérifier" busy={busy} value={url} onChange={setUrl} onUrl={go} onExample={() => showExample(example)} />
        {busy && <Loading steps={['Lecture de /robots.txt…', 'Application des règles robot par robot…']} />}
        {state.phase === 'error' && <ErrorBox error={state.error} onRetry={() => url && go(url)} />}
        {state.phase === 'done' && <RobotsResult r={state.data} example={state.example} />}
      </Scope>
      {state.phase === 'done' && !state.example && <EmailCapture tool="Robots.txt et robots d’IA" url={state.data.url} />}
      <AuditBridge done={state.phase === 'done'} url={state.phase === 'done' && !state.example ? state.data.url : null} text="Vous êtes ouvert aux IA ? Reste à savoir ce qu’elles disent de vous quand un client leur pose la question. L’audit vous le montre." />
    </>
  );
}
