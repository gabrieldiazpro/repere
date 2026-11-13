'use client';
// Visite guidée maison (aucune dépendance) : /app?visite=1[&segment=local|pme|ecommerce].
// 8 étapes d'une page à l'autre ; chaque étape cible [data-visite="…"] ; cible absente → infobulle centrée.
// Accessible : boîte de dialogue non modale étiquetée, focus déplacé sur le titre, Échap pour quitter, flèches.
// Mémorisée (localStorage) : la visite reprend après navigation et ne se relance pas une fois terminée.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { Segment } from '@/lib/engine/types-v2';
import { Icon } from '../icons';
import { DEMO_ACCOUNT, etapesVisite, parseVisite, VISITE_STORAGE, type VisiteState } from './visite';

const SEGMENTS: Segment[] = ['local', 'pme', 'ecommerce'];

function save(s: VisiteState | null) {
  try {
    if (s) localStorage.setItem(VISITE_STORAGE, JSON.stringify(s));
    else localStorage.removeItem(VISITE_STORAGE);
  } catch {
    /* stockage indisponible : visite non mémorisée */
  }
}

type Box = { top: number; left: number; width: number; height: number };

export function Visite({ segment, demo }: { segment: Segment; demo: boolean }) {
  const router = useRouter();
  const pathname = usePathname() ?? '/app';
  const [state, setState] = useState<VisiteState | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [tipPos, setTipPos] = useState<{ top: number; left: number } | null>(null);
  // Attente : navigation vers la page de l'étape en cours, ou cible pas encore rendue. La bulle ne s'affiche
  // qu'une fois la cible trouvée (ou après 10 s sans cible : bulle centrée), jamais sur la page précédente.
  const [enRoute, setEnRoute] = useState(false);
  const [cherche, setCherche] = useState(false);

  // Démarrage : ?visite=1 relance la visite ; sinon reprise d'une visite en cours.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('visite') === '1') {
      const wanted = sp.get('segment') as Segment | null;
      const seg = wanted && SEGMENTS.includes(wanted) ? wanted : segment;
      const s: VisiteState = { segment: seg, step: 0 };
      save(s);
      sp.delete('visite');
      sp.delete('segment');
      const q = sp.toString();
      if (!demo && wanted) {
        // Compte réel : la visite se fait sur le compte démo du parcours demandé (?compte= lu par le middleware).
        window.location.href = `/app?compte=${DEMO_ACCOUNT[seg]}`;
        return;
      }
      if (demo && seg !== segment) {
        document.cookie = `rp_demo_segment=${seg}; path=/; max-age=2592000; samesite=lax`;
        router.replace(`${pathname}${q ? `?${q}` : ''}`);
        router.refresh();
      } else {
        window.history.replaceState(null, '', `${pathname}${q ? `?${q}` : ''}`);
      }
      setState(s);
      return;
    }
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(VISITE_STORAGE);
    } catch {
      /* rien */
    }
    const s = parseVisite(raw);
    if (s && !s.done) setState(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const steps = etapesVisite(state?.segment ?? segment);
  const step = state && !state.done ? steps[Math.min(state.step, steps.length - 1)] : null;
  const onPage = step ? step.page === pathname : false;

  // Arrivée sur la page de l'étape : fin de la navigation. Garde-fou : 35 s sans arrivée → « Reprendre la visite ».
  useEffect(() => {
    if (onPage) setEnRoute(false);
  }, [onPage, step]);
  // Navigation qui n'aboutit pas (requête perdue, serveur lent) : nouvelles tentatives à 10 et 22 s.
  useEffect(() => {
    if (!enRoute || !step) return;
    const retries = [10000, 22000].map((ms) => setTimeout(() => router.push(step.page), ms));
    const t = setTimeout(() => setEnRoute(false), 35000);
    return () => {
      retries.forEach(clearTimeout);
      clearTimeout(t);
    };
  }, [enRoute, step, router]);

  // Cible : recherche répétée pendant 2,5 s (pages qui se chargent), suivi du défilement et du redimensionnement.
  useEffect(() => {
    setBox(null);
    if (!step || !onPage) {
      setCherche(false);
      return;
    }
    setCherche(true);
    let el: HTMLElement | null = null;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const measure = () => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      setBox({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    const find = () => {
      el = document.querySelector<HTMLElement>(`[data-visite="${step.cible}"]`);
      if (el) {
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
        timer = setTimeout(() => {
          measure();
          setCherche(false);
        }, reduce ? 0 : 350);
      } else if (tries++ < 40) timer = setTimeout(find, 250);
      else setCherche(false);
    };
    find();
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [step, onPage]);

  // Position de l'infobulle : sous la cible si possible, sinon au-dessus ; centrée si pas de cible.
  useLayoutEffect(() => {
    const tip = tipRef.current;
    if (!tip) return;
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (!box) {
      setTipPos(null);
      return;
    }
    const gap = 12;
    let top = box.top + box.height + gap;
    if (top + h > vh - 8) top = box.top - h - gap;
    if (top < 8) top = Math.min(vh - h - 8, Math.max(8, box.top + 8));
    const left = Math.min(vw - w - 8, Math.max(8, box.left + box.width / 2 - w / 2));
    setTipPos({ top, left });
  }, [box, step]);

  const attente = Boolean(step) && ((enRoute && !onPage) || (onPage && cherche));
  useEffect(() => {
    if (step && !attente) titleRef.current?.focus();
  }, [step, onPage, attente]);

  const go = useCallback(
    (n: number) => {
      if (!state) return;
      if (n >= steps.length) {
        const s = { ...state, step: steps.length - 1, done: true };
        save(s);
        setState(null);
        return;
      }
      const s = { ...state, step: Math.max(0, n) };
      save(s);
      setState(s);
      const target = steps[s.step].page;
      if (target !== pathname) {
        setEnRoute(true);
        router.push(target);
      }
    },
    [state, steps, pathname, router],
  );
  const quit = useCallback(() => {
    if (state) save({ ...state, done: true });
    setState(null);
  }, [state]);

  useEffect(() => {
    if (!step) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') quit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, quit]);

  if (!state || !step) return null;
  const i = Math.min(state.step, steps.length - 1);
  const last = i === steps.length - 1;
  const pad = 6;

  if (attente) {
    return (
      <div className="rp-visite rp-visite-center rp-visite-attente">
        <span className="rp-visite-spin" aria-hidden="true" />
        <span role="status" aria-live="polite">
          Étape {i + 1} sur {steps.length} · chargement de la page…
        </span>
        <button type="button" className="rp-toast-x" aria-label="Quitter la visite" onClick={quit}>
          <Icon name="close" size={16} />
        </button>
      </div>
    );
  }

  return (
    <>
      {box && (
        <div
          className="rp-visite-ring"
          aria-hidden="true"
          style={{ top: box.top - pad, left: box.left - pad, width: box.width + pad * 2, height: box.height + pad * 2 }}
        />
      )}
      <div
        ref={tipRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby="rp-visite-t"
        aria-describedby="rp-visite-d"
        className={`rp-visite ${tipPos ? '' : 'rp-visite-center'}`}
        style={tipPos ? { top: tipPos.top, left: tipPos.left } : undefined}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' && onPage) go(i + 1);
          if (e.key === 'ArrowLeft' && i > 0) go(i - 1);
        }}
      >
        <div className="flex items-start gap-3">
          <p className="rp-num text-[12px] font-semibold text-[var(--primary)]">
            Étape {i + 1} sur {steps.length}
          </p>
          <button type="button" className="rp-toast-x ml-auto" aria-label="Quitter la visite" onClick={quit}>
            <Icon name="close" size={16} />
          </button>
        </div>
        <h2 id="rp-visite-t" ref={titleRef} tabIndex={-1} className="rp-display mt-1 text-[18px] outline-none">
          {step.titre}
        </h2>
        <p id="rp-visite-d" className="mt-1 text-[14px] text-[var(--muted)]">
          {onPage ? step.texte : 'La visite continue sur une autre page.'}
        </p>
        <div className="rp-visite-dots" aria-hidden="true">
          {steps.map((s, k) => (
            <span key={s.cible} className={k === i ? 'is-on' : k < i ? 'is-past' : ''} />
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          {i > 0 && (
            <button type="button" className="rp-btn rp-btn-sm" onClick={() => go(i - 1)}>
              Précédent
            </button>
          )}
          <button type="button" className="rp-btn rp-btn-ghost rp-btn-sm" onClick={quit}>
            Quitter
          </button>
          <button
            type="button"
            className="rp-btn rp-btn-primary rp-btn-sm ml-auto"
            onClick={() => {
              if (onPage) go(i + 1);
              else {
                setEnRoute(true);
                router.push(step.page);
              }
            }}
          >
            {!onPage ? 'Reprendre la visite' : last ? 'Terminer' : 'Suivant'}
          </button>
        </div>
      </div>
    </>
  );
}
