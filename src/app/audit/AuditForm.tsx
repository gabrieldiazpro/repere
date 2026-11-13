'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import r from '@/components/report/report.module.css';
import s from './audit.module.css';
import { ARRONDISSEMENTS, CITIES, TRADES } from './options';
import { REGULATED_TRADE_MESSAGE, isRegulatedTrade } from '@/lib/regulated';
import { buildAuditQueries } from '@/lib/engine/queries-v2';
import type { AuditInput } from '@/lib/engine/types';
import type { AuditInputV2 } from '@/lib/engine/types-v2';
import { prefillFromSite } from './actions';
import { nameFromDomain, shouldProposeName, stripPrivateParams, type SitePrefill } from './prefill';

export type Segment = 'local' | 'pme' | 'ecommerce';

export interface AuditPrefill {
  segment?: Segment;
  category?: string;
  offering?: string;
  market?: string;
  productCategories?: string[];
  knownCompetitors?: string;
  businessName?: string;
  trade?: string;
  city?: string;
  district?: string;
  website?: string;
  email?: string;
}

type Values = Required<Omit<AuditPrefill, 'segment' | 'productCategories'>> & {
  segment: Segment;
  cat1: string;
  cat2: string;
  cat3: string;
  consent: boolean;
  /** Déclaration obligatoire : service réservé aux professionnels (CGV, article 4). */
  pro: boolean;
  marketingConsent: boolean;
};
type Errors = Partial<Record<keyof Values | 'form', string>>;
type FormError = { kind: 'rate' | 'offline' | 'fail' | 'invalid'; text: string };

const MIN_WAIT_MS = 20_000;
const SLOW_MS = 120_000;
const POLL_MAX_MS = 5 * 60_000;

const fold = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
export const isParis = (city: string) => /^paris(\s|$)/.test(fold(city));

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const SITE_RE = /^(https?:\/\/)?([a-z0-9¡-￿](-*[a-z0-9¡-￿])*\.)+[a-z¡-￿]{2,}(:\d+)?(\/\S*)?$/i;

const NO_LINK = /(https?:\/\/|www\.|@)/i;

function validate(v: Values): Errors {
  const e: Errors = {};
  if (v.segment === 'local') {
    if (!v.businessName.trim()) e.businessName = 'Indiquez le nom de votre commerce pour que nous puissions le chercher.';
    if (!v.trade.trim()) e.trade = 'Indiquez votre métier, par exemple « plombier » ou « pizzeria ».';
    else if (isRegulatedTrade(v.trade)) e.trade = REGULATED_TRADE_MESSAGE;
    if (!v.city.trim()) e.city = 'Indiquez la ville où se trouve votre commerce.';
  } else if (v.segment === 'pme') {
    if (!v.businessName.trim()) e.businessName = 'Indiquez le nom de votre entreprise.';
    if (v.category.trim().length < 2) e.category = 'Indiquez votre secteur, par exemple « logiciel de paie pour PME ».';
    else if (isRegulatedTrade(v.category)) e.category = REGULATED_TRADE_MESSAGE;
    if (NO_LINK.test(v.offering)) e.offering = 'Décrivez votre offre sans adresse web ni e-mail.';
  } else {
    if (!v.businessName.trim()) e.businessName = 'Indiquez le nom de votre marque.';
    if (v.cat1.trim().length < 2) e.cat1 = 'Indiquez au moins une catégorie de produits, par exemple « crème solaire bio ».';
  }
  if (NO_LINK.test(v.knownCompetitors)) e.knownCompetitors = 'Indiquez seulement les noms, séparés par des virgules.';
  if (v.email.trim() && !EMAIL_RE.test(v.email.trim())) e.email = 'Cette adresse e-mail semble incomplète. Vérifiez-la, par exemple vous@exemple.fr.';
  if (v.website.trim() && !SITE_RE.test(v.website.trim())) e.website = 'Cette adresse de site ne semble pas valide. Vous pouvez aussi laisser le champ vide.';
  if (!v.consent) e.consent = 'Cochez cette case pour que nous puissions réaliser votre audit.';
  if (!v.pro) e.pro = 'Repéré est réservé aux professionnels : cochez cette case si vous agissez pour votre activité.';
  return e;
}

/** Champs obligatoires du parcours et nombre déjà remplis (indicateur de progression). */
export function requiredProgress(v: Pick<Values, 'segment' | 'businessName' | 'trade' | 'city' | 'category' | 'cat1' | 'consent'> & { pro?: boolean }): { done: number; total: number } {
  const req =
    v.segment === 'local'
      ? [v.businessName, v.trade, v.city]
      : v.segment === 'pme'
        ? [v.businessName, v.category]
        : [v.businessName, v.cat1];
  // Case « usage professionnel » comptée quand elle est fournie (formulaire), ignorée par les anciens appelants.
  const withPro = v.pro !== undefined;
  const filled = req.filter((x) => x.trim().length >= 2).length + (v.consent ? 1 : 0) + (withPro && v.pro ? 1 : 0);
  return { done: filled, total: req.length + 1 + (withPro ? 1 : 0) };
}

const FIELD_LABELS: Partial<Record<keyof Values, string>> = {
  businessName: 'Nom',
  trade: 'Métier',
  city: 'Ville',
  category: 'Secteur',
  offering: 'Offre',
  cat1: 'Catégorie de produits',
  knownCompetitors: 'Concurrents',
  website: 'Site internet',
  email: 'E-mail',
  consent: 'Accord pour réaliser l’audit',
  pro: 'Usage professionnel',
};

/** Questions réellement posées aux IA (mêmes gabarits que le moteur), pour l'écran d'attente. */
function plannedQuestions(v: Values): string[] {
  try {
    const cats = [v.cat1, v.cat2, v.cat3].map((x) => x.trim()).filter(Boolean);
    const input = {
      businessName: v.businessName.trim(),
      trade: v.segment === 'local' ? v.trade.trim() : v.segment === 'pme' ? v.category.trim() : cats[0] ?? '',
      city: v.segment === 'local' ? v.city.trim() : v.market.trim() || 'France',
      district: v.segment === 'local' && v.district.trim() ? v.district.trim() : undefined,
      segment: v.segment,
      category: v.segment === 'pme' ? v.category.trim() : undefined,
      productCategories: v.segment === 'ecommerce' ? cats : undefined,
      market: v.segment === 'local' ? undefined : v.market.trim() || 'France',
    } as AuditInput & AuditInputV2;
    return buildAuditQueries(input, 'free')
      .filter((q) => q.kind !== 'brand')
      .map((q) => q.text)
      .slice(0, 8);
  } catch {
    return [];
  }
}

/* ---------- Écran d'attente ---------- */

const PROVIDERS = [
  { id: 'chatgpt', label: 'ChatGPT', short: 'C', color: '#10A37F' },
  { id: 'gemini', label: 'Gemini', short: 'G', color: '#4C6EF5' },
  { id: 'perplexity', label: 'Perplexity', short: 'P', color: '#1F7A8C' },
] as const;

function messages(trade: string, where: string, segment: Segment) {
  if (segment === 'pme') {
    return [
      'Nous préparons les questions que posent vos acheteurs…',
      `Nous demandons à ChatGPT quel ${trade.toLowerCase() || 'prestataire'} choisir…`,
      'Gemini compare les solutions. Il prend parfois son temps…',
      'Perplexity cherche ses sources : comparatifs, avis, articles…',
      'Nous reposons la question pour être sûrs de la réponse…',
      'Nous relevons les sites que les IA citent…',
      'Nous repérons les concurrents cités à votre place…',
      'Nous extrayons ce que les IA affirment sur vous…',
      'Nous calculons votre score et votre rang…',
    ];
  }
  if (segment === 'ecommerce') {
    return [
      'Nous préparons les requêtes produit de vos acheteurs…',
      `Nous demandons à ChatGPT le meilleur choix en ${trade.toLowerCase() || 'produits'}…`,
      'Gemini compare les marques. Il prend parfois son temps…',
      'Perplexity cherche ses sources : comparatifs, Reddit, marketplaces…',
      'Nous reposons la question pour être sûrs de la réponse…',
      'Nous relevons les sites que les IA citent…',
      'Nous repérons les marques citées à la place de la vôtre…',
      'Nous extrayons ce que les IA disent de votre marque…',
      'Nous calculons votre score et votre rang…',
    ];
  }
  return [
    'Nous préparons les questions que se posent vos clients…',
    `Nous demandons à ChatGPT où trouver un bon ${trade.toLowerCase() || 'commerce'} à ${where}…`,
    'Gemini réfléchit. Il prend parfois son temps…',
    'Nous interrogeons Perplexity, qui vérifie ses sources…',
    'Nous reposons la question pour être sûrs de la réponse…',
    'Nous repérons qui est cité, et à quelle place…',
    'Nous relevons les sites que les IA citent…',
    'Nous calculons votre score et votre rang…',
    'Dernière vérification avant de vous montrer le résultat…',
  ];
}

/** Les 3 étapes de l'audit, allumées selon l'avancement (bornes en fraction de 0 à 1). */
const STAGES = [
  { id: 'questions', label: 'Questions préparées', active: 'Préparation des questions', from: 0, to: 0.1 },
  { id: 'ia', label: 'IA interrogées', active: 'Interrogation des IA', from: 0.1, to: 0.78 },
  { id: 'analyse', label: 'Réponses analysées', active: 'Analyse des réponses', from: 0.78, to: 1 },
] as const;

// Chaque IA est interrogée sur une fenêtre de l'étape « IA » (décalées : elles ne répondent pas au même rythme).
const PROVIDER_WINDOWS: Record<string, [number, number]> = { chatgpt: [0.1, 0.6], gemini: [0.14, 0.72], perplexity: [0.18, 0.76] };

function useElapsed() {
  const [sec, setSec] = useState(0);
  useEffect(() => {
    const t0 = Date.now();
    const id = window.setInterval(() => setSec(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, []);
  return sec;
}

const mmss = (n: number) => `${Math.floor(n / 60)} min ${String(n % 60).padStart(2, '0')} s`;

function Waiting({ trade, where, progress, slow, segment, questions, jobLabel }: { trade: string; where: string; progress: number; slow: boolean; segment: Segment; questions: string[]; jobLabel: string | null }) {
  const list = useMemo(() => messages(trade, where, segment), [trade, where, segment]);
  const idx = Math.min(list.length - 1, Math.floor(progress * list.length));
  const pct = Math.round(progress * 100);
  const elapsed = useElapsed();
  const nQ = Math.max(1, questions.length);
  const stageOf = (st: (typeof STAGES)[number]) => (progress >= 1 || progress >= st.to ? 'done' : progress >= st.from ? 'active' : 'pending');
  const current = STAGES.find((st) => stageOf(st) === 'active') ?? STAGES[STAGES.length - 1];
  // Questions « posées » : celles déjà atteintes par la fenêtre de la première IA.
  const asked = progress >= 1 ? nQ : Math.max(0, Math.min(nQ, Math.floor(((progress - 0.1) / 0.5) * nQ) + (progress > 0.1 ? 1 : 0)));
  return (
    <div className={s.wait}>
      <div className={s.waitTop}>
        <div className={s.radar} aria-hidden="true">
          <div className={s.radarCore}>
            <svg width="34" height="34" viewBox="0 0 64 64">
              <g fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 26V19a2 2 0 0 1 2-2h7" />
                <path d="M38 17h7a2 2 0 0 1 2 2v7" />
                <path d="M47 38v7a2 2 0 0 1-2 2h-7" />
                <path d="M26 47h-7a2 2 0 0 1-2-2v-7" />
              </g>
              <circle cx="32" cy="32" r="7" fill="#F5A524" />
            </svg>
          </div>
        </div>
        <div className={s.waitHead}>
          <h1>{segment === 'local' ? 'Votre audit est en cours' : segment === 'pme' ? 'Nous interrogeons les IA comme vos acheteurs' : 'Nous interrogeons les IA comme vos clients'}</h1>
          <p className={s.duration}>
            Comptez quelques minutes. <span className={s.elapsed}>Écoulé : {mmss(elapsed)}</span>
          </p>
        </div>
      </div>

      <ol className={s.stages} aria-label="Étapes de l'audit">
        {STAGES.map((st, i) => {
          const state = stageOf(st);
          const fill = state === 'done' ? 1 : state === 'active' ? (progress - st.from) / (st.to - st.from) : 0;
          return (
            <li key={st.id} className={s.stage} data-state={state}>
              <span className={s.stageDot} aria-hidden="true">
                {state === 'done' ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path className={s.tick} d="m6 12.5 4 4 8-9" /></svg>
                ) : (
                  i + 1
                )}
              </span>
              <span className={s.stageLabel}>{state === 'active' ? st.active : st.label}</span>
              <span className={s.srOnly}>{state === 'done' ? ' : terminé' : state === 'active' ? ' : en cours' : ' : à venir'}</span>
              <span className={s.stageTrack} aria-hidden="true"><span style={{ transform: `scaleX(${Math.max(0, Math.min(1, fill))})` }} /></span>
            </li>
          );
        })}
      </ol>

      <p key={idx} className={s.message} aria-live="polite">
        {list[idx]}
      </p>

      <div className={s.barRow}>
        <div className={s.bar} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`Avancement de l'audit : ${current.active}`}>
          <div className={s.barFill} style={{ width: `${Math.max(4, pct)}%` }} />
        </div>
        <span className={s.pct}>{pct} %</span>
      </div>

      <ul className={s.providers} aria-label="Assistants IA interrogés">
        {PROVIDERS.map((p) => {
          const [start, end] = PROVIDER_WINDOWS[p.id];
          const state = progress >= 1 || progress >= end ? 'done' : progress >= start ? 'active' : 'pending';
          const n = state === 'done' ? nQ : state === 'active' ? Math.min(nQ, Math.floor(((progress - start) / (end - start)) * nQ) + 1) : 0;
          return (
            <li key={p.id} className={`${s.provider} ${state === 'pending' ? s.provPending : ''} ${state === 'active' ? s.provActive : ''}`}>
              <span className={s.provLogo} aria-hidden="true">{p.short}</span>
              <span className={s.provName}>
                {p.label}
                <span className={s.provState}>
                  {state === 'done' ? 'Réponses reçues' : state === 'active' ? `Question ${n} sur ${nQ}` : 'En attente'}
                </span>
              </span>
              {state === 'done' ? (
                <span className={s.ok} aria-label="terminé">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path className={s.tick} d="m6 12.5 4 4 8-9" /></svg>
                </span>
              ) : state === 'active' ? (
                <span className={s.dots} aria-hidden="true"><span /><span /><span /></span>
              ) : (
                <span />
              )}
              <span className={s.provTrack} aria-hidden="true"><span style={{ transform: `scaleX(${n / nQ})` }} /></span>
            </li>
          );
        })}
      </ul>

      {questions.length > 0 && (
        <div className={s.qWrap}>
          <h2 className={s.qTitle}>
            Questions posées : <span className={s.qCount}>{Math.min(asked, nQ)}</span> sur {questions.length}
          </h2>
          <ol className={s.qList}>
            {questions.map((q, i) => {
              const state = progress >= 1 || i < asked - 1 ? 'done' : i === asked - 1 ? 'active' : 'pending';
              return (
                <li key={q} className={state === 'done' ? s.qDone : state === 'active' ? s.qActive : s.qPending}>
                  <span aria-hidden="true">{state === 'done' ? '✓' : state === 'active' ? '•' : ''}</span>
                  <span>« {q} »</span>
                  <span className={s.srOnly}>{state === 'done' ? 'posée' : state === 'active' ? 'en cours' : 'à venir'}</span>
                </li>
              );
            })}
          </ol>
          <p className={s.qNote}>{jobLabel ? `État de la tâche : ${jobLabel}. ` : ''}Chaque question est posée à chaque IA, deux fois, pour fiabiliser le résultat.</p>
        </div>
      )}
      <p className={s.waitNote}>
        {slow
          ? 'Les IA sont un peu lentes aujourd’hui. Votre audit continue, il sera aussi dans votre boîte mail dès qu’il sera prêt.'
          : 'Vous pouvez garder cette page ouverte : le rapport s’affiche tout seul. Si vous avez laissé votre e-mail, nous vous l’envoyons aussi.'}
      </p>
    </div>
  );
}

/* ---------- Formulaire ---------- */

const SEGMENTS: { id: Segment; title: string; sub: string }[] = [
  { id: 'local', title: 'Commerce local', sub: 'Artisan, restaurant, boutique' },
  { id: 'pme', title: 'PME / B2B', sub: 'SaaS, cabinet, services' },
  { id: 'ecommerce', title: 'E-commerce', sub: 'Marque, boutique en ligne' },
];

export function AuditForm({ prefill }: { prefill: AuditPrefill }) {
  const router = useRouter();
  const [v, setV] = useState<Values>({
    segment: prefill.segment ?? 'local',
    category: prefill.category ?? '',
    offering: prefill.offering ?? '',
    market: prefill.market ?? 'France',
    knownCompetitors: prefill.knownCompetitors ?? '',
    cat1: prefill.productCategories?.[0] ?? '',
    cat2: prefill.productCategories?.[1] ?? '',
    cat3: prefill.productCategories?.[2] ?? '',
    businessName: prefill.businessName ?? '',
    trade: prefill.trade ?? '',
    city: prefill.city ?? 'Paris',
    district: prefill.district ?? '',
    website: prefill.website ?? '',
    email: prefill.email ?? '',
    consent: false,
    pro: false,
    marketingConsent: false,
  });
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<FormError | null>(null);
  const [phase, setPhase] = useState<'form' | 'waiting'>('form');
  const [progress, setProgress] = useState(0);
  const [slow, setSlow] = useState(false);
  const [questions, setQuestions] = useState<string[]>([]);
  const [jobLabel, setJobLabel] = useState<string | null>(null);
  const [siteHint, setSiteHint] = useState<{ state: 'idle' | 'loading' | 'done'; text: string }>({ state: 'idle', text: '' });
  const lastPrefilled = useRef('');
  // B4 : tant que le JavaScript n'a pas pris la main, le bouton reste désactivé (jamais d'envoi natif en GET avec
  // l'e-mail dans l'adresse). B22 : la personne a tapé dans « Nom » → plus aucune proposition n'y est écrite.
  const [hydrated, setHydrated] = useState(false);
  const nameTyped = useRef(false);
  const vRef = useRef(v);
  vRef.current = v;
  const summaryRef = useRef<HTMLDivElement>(null);
  const raf = useRef(0);
  const alive = useRef(true);
  const refs = {
    businessName: useRef<HTMLInputElement>(null),
    trade: useRef<HTMLInputElement>(null),
    city: useRef<HTMLInputElement>(null),
    email: useRef<HTMLInputElement>(null),
    website: useRef<HTMLInputElement>(null),
    category: useRef<HTMLInputElement>(null),
    offering: useRef<HTMLInputElement>(null),
    cat1: useRef<HTMLInputElement>(null),
    knownCompetitors: useRef<HTMLInputElement>(null),
    consent: useRef<HTMLInputElement>(null),
    pro: useRef<HTMLInputElement>(null),
  };

  useEffect(() => {
    setHydrated(true);
    alive.current = true;
    // Ancien envoi natif (avant correctif) ou lien partagé : on retire de l'adresse l'e-mail et les cases cochées.
    try {
      const u = new URL(window.location.href);
      const clean = stripPrivateParams(u.searchParams);
      if (clean !== u.searchParams.toString()) window.history.replaceState(null, '', `${u.pathname}${clean ? `?${clean}` : ''}${u.hash}`);
    } catch {
      /* sans effet */
    }
    return () => {
      alive.current = false;
      cancelAnimationFrame(raf.current);
    };
  }, []);

  // Site transmis dans l'URL (?site=) : même pré-remplissage qu'à la saisie.
  useEffect(() => {
    if (prefill.website && !prefill.businessName) void prefillFromWebsite();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const paris = isParis(v.city);

  const switchSegment = (next: Segment) => {
    setV((old) => ({ ...old, segment: next }));
    setErrors({});
    setFormError(null);
    try {
      const u = new URL(window.location.href);
      u.searchParams.set('segment', next);
      window.history.replaceState(null, '', u.toString());
    } catch {
      /* sans effet */
    }
  };

  /** Site saisi : on propose le nom (et le métier ou le secteur) sans jamais écraser une saisie. */
  const prefillFromWebsite = async (ev?: React.FocusEvent<HTMLInputElement>) => {
    const url = v.website.trim();
    if (!url || url === lastPrefilled.current || !SITE_RE.test(url)) return;
    lastPrefilled.current = url;
    // Au blur du site, la personne part peut-être vers « Nom » : on ne l'écrit pas sous ses doigts.
    const goingToName = ev?.relatedTarget != null && ev.relatedTarget === refs.businessName.current;
    const apply = (p: SitePrefill | null, replaceGuess = false, blurToName = false) => {
      if (!p) return;
      const old = vRef.current;
      const next = { ...old };
      const filled: string[] = [];
      const guess = nameFromDomain(url);
      const userEditing =
        blurToName || nameTyped.current || (typeof document !== 'undefined' && document.activeElement === refs.businessName.current);
      if (shouldProposeName({ current: old.businessName, proposed: p.businessName, guess, replaceGuess, userEditing })) {
        next.businessName = p.businessName!;
        filled.push('le nom');
      }
      if (p.category && old.segment === 'local' && !old.trade.trim() && p.segment === 'local') {
        next.trade = p.category;
        filled.push('le métier');
      } else if (p.category && old.segment === 'pme' && !old.category.trim() && p.segment !== 'local') {
        next.category = p.category;
        filled.push('le secteur');
      }
      if (!filled.length) return;
      vRef.current = next;
      setV(next);
      setSiteHint({ state: 'done', text: `Nous avons repris ${filled.join(' et ')} depuis ${p.from === 'site' ? 'votre site' : 'l’adresse du site'}. Vérifiez et corrigez si besoin.` });
    };
    // Proposition immédiate depuis l'adresse, puis affinée par la lecture de la page.
    const n = nameFromDomain(url);
    if (n) apply({ businessName: n, from: 'adresse' }, false, goingToName);
    setSiteHint((h) => (h.state === 'done' ? h : { state: 'loading', text: 'Lecture de votre site…' }));
    try {
      const p = await prefillFromSite(url);
      if (!alive.current) return;
      // Le nom lu sur la page remplace la proposition faite depuis l'adresse, jamais une saisie.
      apply(p, true);
      setSiteHint((h) => (h.state === 'loading' ? { state: 'idle', text: '' } : h));
    } catch {
      if (alive.current) setSiteHint((h) => (h.state === 'loading' ? { state: 'idle', text: '' } : h));
    }
  };

  const set = <K extends keyof Values>(k: K, val: Values[K]) => {
    setV((old) => {
      const next = { ...old, [k]: val };
      // « Paris 11e » saisi dans la ville : on sépare ville et arrondissement.
      if (k === 'city' && typeof val === 'string') {
        const m = fold(val).match(/^paris\s*(\d{1,2})\s*(e|er|eme)?$/);
        if (m) {
          const a = ARRONDISSEMENTS[Number(m[1]) - 1];
          if (a) {
            next.city = 'Paris';
            next.district = a.short;
          }
        } else if (isParis(old.city) && !isParis(val)) {
          next.district = '';
        }
      }
      return next;
    });
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const seg = v.segment;
  const where = seg !== 'local' ? v.market || 'France' : v.district ? (paris ? `Paris ${v.district}` : v.district) : v.city || 'côté de chez vous';
  const waitTopic = seg === 'pme' ? v.category : seg === 'ecommerce' ? v.cat1 : v.trade;

  const runAnimation = useCallback((isReady: () => number | null | 'fail') => {
    const t0 = performance.now();
    let readyFrom: number | null = null;
    let fromProgress = 0;
    return new Promise<void>((resolve) => {
      const tick = (t: number) => {
        if (!alive.current) return resolve();
        const elapsed = t - t0;
        const ready = isReady();
        if (ready === 'fail') return resolve();
        let p: number;
        if (ready === null) {
          p = Math.min(0.95, 1 - Math.exp(-elapsed / 26_000));
          fromProgress = p;
        } else {
          if (readyFrom === null) readyFrom = t;
          const dur = Math.max(1500, MIN_WAIT_MS - (readyFrom - t0));
          const k = Math.min(1, (t - readyFrom) / dur);
          p = fromProgress + (1 - fromProgress) * (1 - Math.pow(1 - k, 2));
          if (k >= 1) {
            setProgress(1);
            return resolve();
          }
        }
        setProgress(p);
        if (elapsed > SLOW_MS) setSlow(true);
        raf.current = requestAnimationFrame(tick);
      };
      raf.current = requestAnimationFrame(tick);
    });
  }, []);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setFormError(null);
    const e = validate(v);
    setErrors(e);
    const first = (Object.keys(e) as (keyof typeof refs)[]).find((k) => k in refs);
    if (first) {
      // Résumé des erreurs annoncé, puis focus sur le premier champ à corriger.
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setFormError({ kind: 'offline', text: 'Votre connexion semble coupée. Vérifiez-la, puis cliquez sur « Réessayer ».' });
      return;
    }

    setQuestions(plannedQuestions(v));
    setJobLabel(null);
    setPhase('waiting');
    setProgress(0);
    setSlow(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const st: { readyAt: number | null; failure: FormError | null; id: string | null; fieldErrors?: Errors } = { readyAt: null, failure: null, id: null };

    const work = (async () => {
      const competitors = v.knownCompetitors.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean).slice(0, 5);
      const cats = [v.cat1, v.cat2, v.cat3].map((x) => x.trim()).filter(Boolean);
      const segFields =
        seg === 'local'
          ? { trade: v.trade.trim(), city: v.city.trim(), ...(v.district.trim() ? { district: v.district.trim() } : {}) }
          : seg === 'pme'
            ? { category: v.category.trim(), ...(v.offering.trim() ? { offering: v.offering.trim() } : {}), market: v.market.trim() || 'France' }
            : { productCategories: cats, ...(v.offering.trim() ? { offering: v.offering.trim() } : {}), market: 'France' };
      const body = {
        segment: seg,
        businessName: v.businessName.trim(),
        ...segFields,
        ...(competitors.length ? { knownCompetitors: competitors } : {}),
        ...(v.website.trim() ? { website: v.website.trim() } : {}),
        ...(v.email.trim() ? { email: v.email.trim() } : {}),
        // consent = case obligatoire (traitement de l'audit) ; marketingConsent = case facultative (conseils par e-mail).
        consent: v.consent,
        marketingConsent: v.email.trim() ? v.marketingConsent : false,
      };
      let res: Response;
      try {
        res = await fetch('/api/audit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      } catch {
        st.failure = { kind: 'offline', text: 'Votre connexion semble coupée. Vérifiez-la, puis cliquez sur « Réessayer ».' };
        return;
      }
      if (res.status === 429) {
        st.failure = { kind: 'rate', text: 'Vous avez déjà lancé plusieurs audits aujourd’hui. Réessayez demain, ou retrouvez vos rapports dans votre boîte mail.' };
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { id?: string; jobId?: string; error?: string; fields?: Record<string, string> };
      if (res.status === 400 || res.status === 422) {
        // Erreurs par champ renvoyées par le serveur : affichées sous chaque champ.
        const fieldErrors: Errors = {};
        for (const [k, msg] of Object.entries(data.fields ?? {})) {
          const key = (k === 'productCategories' ? 'cat1' : k) as keyof Values;
          if (typeof msg === 'string' && key in FIELD_LABELS) fieldErrors[key] = msg;
        }
        st.fieldErrors = fieldErrors;
        st.failure = { kind: 'invalid', text: typeof data.error === 'string' && data.error.length < 160 ? `Certaines informations semblent invalides : ${data.error}` : 'Certaines informations semblent invalides. Vérifiez le formulaire puis réessayez.' };
        return;
      }
      // File de tâches (si l'API la renvoie) : on suit l'état réel jusqu'à l'audit terminé.
      if (res.ok && data.jobId) {
        const t0 = Date.now();
        while (alive.current && Date.now() - t0 < POLL_MAX_MS) {
          try {
            const j = await fetch(`/api/jobs/${encodeURIComponent(data.jobId)}`, { cache: 'no-store' });
            const job = (await j.json().catch(() => ({}))) as { status?: string; label?: string; result?: { auditId?: string } };
            if (job.label) setJobLabel(job.label);
            if (job.status === 'done') {
              data.id = job.result?.auditId ?? data.id;
              break;
            }
            if (job.status === 'dead' || (!j.ok && j.status !== 404)) break;
          } catch {
            /* réseau instable : on réessaie */
          }
          await new Promise((ok) => setTimeout(ok, 2500));
        }
      }
      if (!res.ok || !data.id) {
        st.failure = { kind: 'fail', text: 'Nous n’avons pas pu terminer votre audit. Ce n’est pas de votre faute. Réessayez dans quelques minutes : vos informations sont conservées.' };
        return;
      }
      const id = data.id;
      st.id = id;
      // Si l'audit tourne encore côté serveur, on attend qu'il soit enregistré.
      const t0 = Date.now();
      while (alive.current && Date.now() - t0 < POLL_MAX_MS) {
        try {
          const g = await fetch(`/api/audit/${encodeURIComponent(id)}`, { cache: 'no-store' });
          if (g.ok) return;
          if (g.status !== 404 && g.status !== 202 && g.status !== 425) return; // on laisse la page rapport gérer
        } catch {
          /* réseau instable : on réessaie */
        }
        await new Promise((ok) => setTimeout(ok, 2500));
      }
    })().finally(() => {
      st.readyAt = performance.now();
    });

    await Promise.all([work, runAnimation(() => (st.failure ? 'fail' : st.readyAt))]);
    if (!alive.current) return;

    const { failure, id } = st;
    if (failure || !id) {
      cancelAnimationFrame(raf.current);
      setPhase('form');
      if (st.fieldErrors && Object.keys(st.fieldErrors).length) setErrors(st.fieldErrors);
      setFormError(failure ?? { kind: 'fail', text: 'Nous n’avons pas pu terminer votre audit. Ce n’est pas de votre faute. Réessayez dans quelques minutes : vos informations sont conservées.' });
      return;
    }
    router.push(`/rapport/${encodeURIComponent(id)}`);
  };

  if (phase === 'waiting') {
    return (
      <div className={`${r.card}`}>
        <Waiting trade={waitTopic} where={where} progress={progress} slow={slow} segment={seg} questions={questions} jobLabel={jobLabel} />
      </div>
    );
  }

  const errorList = (Object.entries(errors) as [keyof Values, string | undefined][]).filter((e): e is [keyof Values, string] => !!e[1]);
  const prog = requiredProgress(v);

  const err = (k: keyof Values) =>
    errors[k] ? (
      <span id={`${k}-err`} className={s.fieldError} role="alert">
        {errors[k]}
      </span>
    ) : null;
  const aria = (k: keyof Values, help?: boolean) => ({
    'aria-invalid': errors[k] ? true : undefined,
    'aria-describedby': [errors[k] ? `${k}-err` : '', help ? `${k}-help` : ''].filter(Boolean).join(' ') || undefined,
  });

  return (
    <form method="post" className={`${r.card} ${s.form}`} onSubmit={submit} noValidate aria-describedby="form-progress">
      {errorList.length > 0 && (
        <div ref={summaryRef} className={`${s.alert} ${s.alertDanger}`} role="alert" tabIndex={-1} aria-labelledby="err-sum-t">
          <strong id="err-sum-t">
            {errorList.length === 1 ? 'Une information est à corriger' : `${errorList.length} informations sont à corriger`}
          </strong>
          <ul className={s.errList}>
            {errorList.map(([k, msg]) => (
              <li key={k}>
                <a
                  href={`#${k}`}
                  onClick={(ev) => {
                    ev.preventDefault();
                    const target = refs[k as keyof typeof refs]?.current ?? document.getElementById(k);
                    target?.focus();
                  }}
                >
                  {FIELD_LABELS[k] ?? k} : {msg}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      {formError && (
        <div className={`${s.alert} ${formError.kind === 'rate' ? s.alertWarning : s.alertDanger}`} role="alert">
          <span>{formError.text}</span>
          {formError.kind !== 'rate' && (
            <button type="submit" className={`${r.btn} ${r.btnSecondary} ${r.btnSmall}`} style={{ justifySelf: 'start' }}>
              Réessayer
            </button>
          )}
        </div>
      )}

      <fieldset className={s.segments}>
        <legend className={s.label}>Votre activité</legend>
        <div className={s.segGrid} role="radiogroup" aria-label="Votre activité">
          {SEGMENTS.map((x) => (
            <label key={x.id} className={`${s.seg} ${seg === x.id ? s.segOn : ''}`}>
              <input type="radio" name="segment" value={x.id} checked={seg === x.id} onChange={() => switchSegment(x.id)} />
              <span className={s.segTitle}>{x.title}</span>
              <span className={s.segSub}>{x.sub}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className={s.field}>
        <label className={s.label} htmlFor="website">
          Site internet <span className={s.optional}>(facultatif)</span>
        </label>
        <input
          ref={refs.website}
          id="website"
          name="website"
          className={`${s.input} ${errors.website ? s.inputError : ''}`}
          placeholder={seg === 'local' ? 'ex. plomberie-martin.fr' : seg === 'pme' ? 'ex. paysia.fr' : 'ex. maison-sora.fr'}
          inputMode="url"
          autoComplete="url"
          autoCapitalize="off"
          value={v.website}
          onChange={(e) => set('website', e.target.value)}
          onBlur={prefillFromWebsite}
          maxLength={200}
          {...aria('website', true)}
        />
        <span id="website-help" className={s.help}>
          {seg === 'local'
            ? 'Facultatif. Avec votre site, nous remplissons le nom pour vous. Pas de site ? Laissez vide.'
            : 'Commencez par là : nous lisons votre site pour remplir le nom et, si possible, le secteur.'}
        </span>
        <span className={s.siteHint} role="status" aria-live="polite">
          {siteHint.text}
        </span>
        {err('website')}
      </div>

      <div className={s.field}>
        <label className={s.label} htmlFor="businessName">
          {seg === 'local' ? 'Nom de votre commerce' : seg === 'pme' ? "Nom de l'entreprise" : 'Nom de la marque'}
        </label>
        <input
          ref={refs.businessName}
          id="businessName"
          name="businessName"
          className={`${s.input} ${errors.businessName ? s.inputError : ''}`}
          placeholder={seg === 'local' ? 'ex. Plomberie Martin' : seg === 'pme' ? 'ex. Paysia' : 'ex. Maison Sora'}
          autoComplete="organization"
          value={v.businessName}
          onChange={(e) => {
            nameTyped.current = true;
            set('businessName', e.target.value);
          }}
          maxLength={120}
          required
          {...aria('businessName', true)}
        />
        <span id="businessName-help" className={s.help}>
          {seg === 'local'
            ? 'Le nom tel que vos clients le connaissent, celui de votre enseigne ou de votre fiche Google.'
            : 'Le nom tel que vos clients le cherchent, sans « SAS » ni « SARL ».'}
        </span>
        {err('businessName')}
      </div>

      {seg === 'local' && (
        <>
      <div className={s.field}>
        <label className={s.label} htmlFor="trade">
          Votre métier
        </label>
        <input
          ref={refs.trade}
          id="trade"
          name="trade"
          list="trades-list"
          className={`${s.input} ${errors.trade ? s.inputError : ''}`}
          placeholder="ex. plombier, restaurant italien, institut de beauté"
          autoComplete="off"
          value={v.trade}
          onChange={(e) => set('trade', e.target.value)}
          maxLength={80}
          required
          {...aria('trade', true)}
        />
        <datalist id="trades-list">
          {TRADES.map((t) => (
            <option key={t.slug} value={t.nom.toLowerCase()} />
          ))}
        </datalist>
        <span id="trade-help" className={s.help}>
          Soyez précis : « restaurant japonais » donnera de meilleurs résultats que « restaurant ».
        </span>
        {err('trade')}
      </div>

      <div className={s.row}>
        <div className={s.field}>
          <label className={s.label} htmlFor="city">
            Ville
          </label>
          <input
            ref={refs.city}
            id="city"
            name="city"
            list="cities-list"
            className={`${s.input} ${errors.city ? s.inputError : ''}`}
            placeholder="Paris"
            autoComplete="address-level2"
            value={v.city}
            onChange={(e) => set('city', e.target.value)}
            maxLength={80}
            required
            {...aria('city')}
          />
          <datalist id="cities-list">
            {CITIES.map((c) => (
              <option key={c.slug} value={c.nom} />
            ))}
          </datalist>
          {err('city')}
        </div>

        <div className={s.field}>
          <label className={s.label} htmlFor="district">
            {paris ? 'Arrondissement' : 'Quartier'} <span className={s.optional}>(facultatif)</span>
          </label>
          {paris ? (
            <select
              id="district"
              name="district"
              className={`${s.input} ${s.select}`}
              value={v.district}
              onChange={(e) => set('district', e.target.value)}
              {...aria('district', true)}
            >
              <option value="">Tout Paris</option>
              {ARRONDISSEMENTS.map((a) => (
                <option key={a.slug} value={a.short}>
                  {a.nom} ({a.quartiers.slice(0, 2).join(', ')})
                </option>
              ))}
            </select>
          ) : (
            <input
              id="district"
              name="district"
              className={s.input}
              placeholder="ex. Vieux-Lyon, Chartrons"
              value={v.district}
              onChange={(e) => set('district', e.target.value)}
              maxLength={80}
              {...aria('district', true)}
            />
          )}
        </div>
      </div>
      <span id="district-help" className={s.help} style={{ marginTop: -10 }}>
        C&apos;est souvent ce que vos clients tapent. Cela rend l&apos;audit beaucoup plus juste.
      </span>
        </>
      )}

      {seg === 'pme' && (
        <>
          <div className={s.field}>
            <label className={s.label} htmlFor="category">
              Votre secteur ou catégorie d&apos;offre
            </label>
            <input
              ref={refs.category}
              id="category"
              name="category"
              className={`${s.input} ${errors.category ? s.inputError : ''}`}
              placeholder="ex. logiciel de paie pour PME"
              autoComplete="off"
              value={v.category}
              onChange={(e) => set('category', e.target.value)}
              maxLength={80}
              required
              {...aria('category', true)}
            />
            <span id="category-help" className={s.help}>
              Les mots qu&apos;un acheteur taperait : « cabinet de recrutement tech » plutôt que « RH ».
            </span>
            {err('category')}
          </div>
          <div className={s.field}>
            <label className={s.label} htmlFor="offering">
              Votre offre en une phrase <span className={s.optional}>(facultatif)</span>
            </label>
            <input
              ref={refs.offering}
              id="offering"
              name="offering"
              className={`${s.input} ${errors.offering ? s.inputError : ''}`}
              placeholder="ex. La paie en ligne pour les PME de 10 à 250 salariés"
              autoComplete="off"
              value={v.offering}
              onChange={(e) => set('offering', e.target.value)}
              maxLength={200}
              {...aria('offering')}
            />
            {err('offering')}
          </div>
          <div className={s.field}>
            <label className={s.label} htmlFor="market">
              Votre marché
            </label>
            <input
              id="market"
              name="market"
              list="markets-list"
              className={s.input}
              placeholder="France"
              value={v.market}
              onChange={(e) => set('market', e.target.value)}
              maxLength={60}
              {...aria('market', true)}
            />
            <datalist id="markets-list">
              <option value="France" />
              {CITIES.slice(0, 20).map((c) => (
                <option key={c.slug} value={c.nom} />
              ))}
            </datalist>
            <span id="market-help" className={s.help}>
              « France » si vous vendez partout, sinon la ville où sont vos clients.
            </span>
          </div>
        </>
      )}

      {seg === 'ecommerce' && (
        <div className={s.field}>
          <span className={s.label} id="cats-label">
            Vos catégories de produits phares <span className={s.optional}>(1 à 3)</span>
          </span>
          <div className={s.cats} role="group" aria-labelledby="cats-label">
            {(['cat1', 'cat2', 'cat3'] as const).map((k, i) => (
              <input
                key={k}
                ref={k === 'cat1' ? refs.cat1 : undefined}
                id={k}
                name={k}
                aria-label={`Catégorie ${i + 1}${i ? ' (facultatif)' : ''}`}
                className={`${s.input} ${errors[k] ? s.inputError : ''}`}
                placeholder={['ex. crème solaire bio', 'ex. shampoing solide', 'ex. coffret cadeau'][i]}
                autoComplete="off"
                value={v[k]}
                onChange={(e) => set(k, e.target.value)}
                maxLength={60}
                {...(k === 'cat1' ? aria('cat1', true) : {})}
              />
            ))}
          </div>
          <span id="cat1-help" className={s.help}>
            Ce que vos acheteurs demandent aux IA : « meilleure crème solaire bio », « alternative à… ».
          </span>
          {err('cat1')}
        </div>
      )}

      {seg !== 'local' && (
        <div className={s.field}>
          <label className={s.label} htmlFor="knownCompetitors">
            Concurrents que vous connaissez <span className={s.optional}>(facultatif)</span>
          </label>
          <input
            ref={refs.knownCompetitors}
            id="knownCompetitors"
            name="knownCompetitors"
            className={`${s.input} ${errors.knownCompetitors ? s.inputError : ''}`}
            placeholder={seg === 'pme' ? 'ex. PayFit, Silae' : 'ex. Lamazuna, Respire'}
            autoComplete="off"
            value={v.knownCompetitors}
            onChange={(e) => set('knownCompetitors', e.target.value)}
            maxLength={300}
            {...aria('knownCompetitors', true)}
          />
          <span id="knownCompetitors-help" className={s.help}>
            Séparés par des virgules, 5 au plus. Nous vérifions aussi ceux que les IA citent d&apos;elles-mêmes.
          </span>
          {err('knownCompetitors')}
        </div>
      )}

      <div className={s.field}>
        <label className={s.label} htmlFor="email">
          Votre e-mail <span className={s.optional}>(facultatif)</span>
        </label>
        <input
          ref={refs.email}
          id="email"
          name="email"
          type="email"
          className={`${s.input} ${errors.email ? s.inputError : ''}`}
          placeholder="vous@exemple.fr"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="off"
          value={v.email}
          onChange={(e) => set('email', e.target.value)}
          maxLength={200}
          {...aria('email', true)}
        />
        <span id="email-help" className={s.help}>
          Pour recevoir votre rapport PDF. Aucun autre e-mail sans votre accord (case ci-dessous).
        </span>
        {err('email')}
      </div>

      <div className={s.field}>
        <label className={s.consent} htmlFor="consent">
          <input
            ref={refs.consent}
            id="consent"
            name="consent"
            type="checkbox"
            checked={v.consent}
            onChange={(e) => set('consent', e.target.checked)}
            {...aria('consent')}
          />
          <span>
            J&apos;ai compris que ces informations servent à réaliser mon audit et, si j&apos;ai indiqué mon e-mail, à m&apos;envoyer le rapport. {seg === 'local' ? 'Le nom, le métier et la ville de mon commerce sont transmis' : 'Le nom, le secteur et les concurrents indiqués sont transmis'} aux assistants IA interrogés. Conservation 12 mois.{' '}
            <a href="/confidentialite" target="_blank" rel="noopener">
              Politique de confidentialité
            </a>
          </span>
        </label>
        {err('consent')}
      </div>

      <div className={s.field}>
        <label className={s.consent} htmlFor="pro">
          <input
            ref={refs.pro}
            id="pro"
            name="pro"
            type="checkbox"
            checked={v.pro}
            onChange={(e) => set('pro', e.target.checked)}
            {...aria('pro')}
          />
          <span>
            J&apos;agis pour les besoins de mon activité professionnelle (entreprise, commerce, artisan, profession libérale). Repéré est réservé aux professionnels.
          </span>
        </label>
        {err('pro')}
      </div>

      <div className={s.field}>
        <label className={s.consent} htmlFor="marketingConsent">
          <input
            id="marketingConsent"
            name="marketingConsent"
            type="checkbox"
            checked={v.marketingConsent}
            onChange={(e) => set('marketingConsent', e.target.checked)}
          />
          <span>
            Facultatif : j&apos;accepte de recevoir des conseils de visibilité par e-mail (environ un par mois, désinscription en un clic).
          </span>
        </label>
      </div>

      <div className={s.progress} id="form-progress">
        <div className={s.progressTrack} aria-hidden="true">
          <span style={{ width: `${Math.round((prog.done / prog.total) * 100)}%` }} />
        </div>
        <span>
          {prog.done === prog.total
            ? 'Tout est prêt : lancez votre audit.'
            : `${prog.done} sur ${prog.total} informations obligatoires renseignées.`}
        </span>
      </div>

      <button
        type="submit"
        disabled={!hydrated}
        aria-disabled={!hydrated}
        className={`${r.btn} ${r.btnPrimary} ${r.btnBlock}`}
        style={{ minHeight: 56, fontSize: 17, ...(hydrated ? {} : { opacity: 0.6, cursor: 'wait' }) }}
      >
        {hydrated ? 'Lancer mon audit' : 'Chargement…'}
      </button>
      <p className={s.rgpd}>
        Vos informations servent à réaliser l&apos;audit, à vous envoyer le rapport et, seulement si vous avez coché la case facultative, nos conseils. <a href="/confidentialite">En savoir plus</a>
      </p>
    </form>
  );
}
