'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'rp_install_dismissed_at';
const SNOOZE_MS = 14 * 24 * 3600 * 1000;
const VISITS_KEY = 'rp_install_visits';
/** Le bandeau d'installation n'apparaît qu'à partir de la 3e visite (pas à la découverte de l'app). */
const MIN_VISITS = 3;

function countVisit(): number {
  try {
    let n = Number(localStorage.getItem(VISITS_KEY) ?? 0) || 0;
    if (!sessionStorage.getItem(VISITS_KEY)) {
      sessionStorage.setItem(VISITS_KEY, '1');
      n += 1;
      localStorage.setItem(VISITS_KEY, String(n));
    }
    return n;
  } catch {
    return 0;
  }
}

// L'événement peut arriver avant le montage du composant : on le garde au niveau du module.
let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}

export function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIos() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

type Mode = 'hidden' | 'android' | 'ios';

function useInstallMode(respectSnooze: boolean): [Mode, () => void] {
  const [mode, setMode] = useState<Mode>('hidden');
  useEffect(() => {
    const compute = () => {
      if (isStandalone()) return setMode('hidden');
      if (respectSnooze) {
        // Pas pendant la visite guidée ni l'accueil, et pas avant la 3e visite.
        if (/\/app\/bienvenue/.test(location.pathname)) return setMode('hidden');
        try {
          const v = localStorage.getItem('rp_visite');
          if (v && !JSON.parse(v).done) return setMode('hidden');
        } catch {
          /* ignore */
        }
        if (countVisit() < MIN_VISITS) return setMode('hidden');
        try {
          const at = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
          if (at && Date.now() - at < SNOOZE_MS) return setMode('hidden');
        } catch {
          /* ignore */
        }
      }
      if (deferred) return setMode('android');
      if (isIos()) return setMode('ios');
      setMode('hidden');
    };
    compute();
    listeners.add(compute);
    return () => {
      listeners.delete(compute);
    };
  }, [respectSnooze]);
  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setMode('hidden');
  };
  return [mode, dismiss];
}

async function promptAndroid(onDone: () => void) {
  if (!deferred) return;
  const ev = deferred;
  await ev.prompt();
  const choice = await ev.userChoice.catch(() => null);
  deferred = null;
  listeners.forEach((l) => l());
  if (choice?.outcome !== 'accepted') onDone();
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12" /><path d="m8 7 4-4 4 4" /><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
    </svg>
  );
}

function PlusSquareIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="4" y="4" width="16" height="16" rx="3" /><path d="M12 8v8M8 12h8" />
    </svg>
  );
}

export function IosSteps() {
  const steps = [
    { icon: <ShareIcon />, text: <>Touchez <strong>Partager</strong> dans la barre de Safari.</> },
    { icon: <PlusSquareIcon />, text: <>Choisissez <strong>Sur l’écran d’accueil</strong>.</> },
    { icon: <span className="text-sm font-bold">OK</span>, text: <>Touchez <strong>Ajouter</strong> en haut à droite.</> },
  ];
  return (
    <ol className="mt-3 grid grid-cols-3 gap-2">
      {steps.map((s, i) => (
        <li key={i} className="flex flex-col items-center gap-2 rounded-xl bg-[var(--bg)] p-2 text-center text-xs leading-snug">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--primary)] shadow-sm">{s.icon}</span>
          <span>
            <span className="sr-only">Étape {i + 1} : </span>
            {s.text}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Bandeau flottant (au-dessus de la barre d'onglets), ou carte intégrée avec `inline`. */
export function InstallPrompt({ inline = false }: { inline?: boolean }) {
  const [mode, dismiss] = useInstallMode(!inline);
  const [showDelay, setShowDelay] = useState(inline);
  // Bandeau discret (B23) : une ligne ; les étapes iOS seulement si on les demande.
  const [steps, setSteps] = useState(inline);

  useEffect(() => {
    if (inline) return;
    const t = setTimeout(() => setShowDelay(true), 4000); // pas à la première seconde
    return () => clearTimeout(t);
  }, [inline]);

  if (mode === 'hidden' || !showDelay) {
    if (inline && mode === 'hidden') {
      return <p className="text-sm text-[var(--muted)]">L’app est déjà installée sur cet appareil, ou votre navigateur ne propose pas l’installation.</p>;
    }
    return null;
  }

  const body = (
    <>
      <div className="flex items-start gap-3">
        <img src="/icons/icon-192.png" alt="" width={44} height={44} className={inline ? "h-11 w-11 flex-none rounded-xl" : "h-8 w-8 flex-none rounded-lg"} />
        <p className="flex-1 text-sm leading-snug">
          Ajoutez Repéré à votre écran d’accueil pour suivre votre score en un geste.
        </p>
      </div>
      {mode === 'ios' && steps && <IosSteps />}
      <div className={`${inline ? "mt-3" : "mt-2"} flex justify-end gap-2`}>
        {!inline && (
          <button type="button" onClick={dismiss} className="rp-tap rounded-xl px-3 text-sm font-medium text-[var(--muted)]">
            Plus tard
          </button>
        )}
        {mode === 'android' && (
          <button
            type="button"
            onClick={() => promptAndroid(dismiss)}
            className="rp-tap rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--on-primary)]"
          >
            Installer
          </button>
        )}
        {mode === 'ios' && !inline && !steps && (
          <button type="button" onClick={() => setSteps(true)} className="rp-tap rounded-xl px-3 text-sm font-semibold text-[var(--primary)]">
            Comment faire ?
          </button>
        )}
        {mode === 'ios' && !inline && steps && (
          <button type="button" onClick={dismiss} className="rp-tap rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--on-primary)]">
            J’ai compris
          </button>
        )}
      </div>
    </>
  );

  if (inline) return <div>{body}</div>;

  return (
    <aside
      aria-label="Installer l’app"
      className="rp-card fixed inset-x-3 z-30 mx-auto max-w-md p-3 shadow-md"
      style={{ bottom: 'calc(var(--tabbar-h) + env(safe-area-inset-bottom, 0px) + 10px)' }}
    >
      {body}
    </aside>
  );
}
