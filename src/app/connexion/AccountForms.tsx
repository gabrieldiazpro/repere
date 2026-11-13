'use client';

/**
 * Formulaires de compte (connexion par lien magique, inscription Découverte, création d'espace).
 * Aucune donnée de session n'est lue ni écrite par JavaScript : tout passe par les routes /api/account/* qui posent
 * des cookies httpOnly.
 */
import { useState } from 'react';
import { buttonClasses } from '@/components/ui/Button';

type Segment = 'local' | 'pme' | 'ecommerce';

const input =
  'min-h-12 w-full rounded-xl border border-line bg-white px-3 text-base text-ink placeholder:text-muted/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30';
const label = 'text-sm font-semibold text-ink';

const SEGMENTS: { id: Segment; title: string; hint: string }[] = [
  { id: 'local', title: 'Commerce ou artisan local', hint: 'Clients de votre ville ou quartier' },
  { id: 'pme', title: 'PME ou indépendant B2B', hint: 'Clients professionnels, toute la France' },
  { id: 'ecommerce', title: 'Boutique en ligne', hint: 'Vous vendez des produits sur Internet' },
];

async function post(url: string, body: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok, data };
  } catch {
    return {
      ok: false,
      data: { error: navigator.onLine ? 'L’envoi n’a pas fonctionné. Réessayez dans un instant.' : 'Votre connexion semble coupée. Vérifiez-la, puis réessayez.' },
    };
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function Sent({ email, devLink, onBack, signup }: { email: string; devLink?: string; onBack: () => void; signup?: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-6 text-center" role="status">
      <p className="text-lg font-semibold text-ink">Vérifiez votre boîte de réception</p>
      <p className="mt-2 text-muted">
        {signup
          ? <>Nous avons envoyé un lien à <strong className="text-ink">{email}</strong>. Cliquez dessus pour confirmer votre adresse et ouvrir votre espace.</>
          : <>Si un compte existe pour <strong className="text-ink">{email}</strong>, vous allez recevoir un lien de connexion. Il est valable une heure et ne sert qu’une fois.</>}
      </p>
      <p className="mt-3 text-sm text-muted">Rien reçu après quelques minutes ? Regardez dans les courriers indésirables, ou recommencez.</p>
      {devLink && (
        <p className="mt-4 rounded-xl bg-warning-bg p-3 text-left text-sm text-warning-ink">
          Compte local de développement (aucun e-mail n’est envoyé) :{' '}
          <a className="break-all font-semibold underline" href={devLink}>ouvrir le lien de connexion</a>
        </p>
      )}
      <button type="button" onClick={onBack} className={buttonClasses({ variant: 'ghost', className: 'mt-3' })}>
        Changer d’adresse
      </button>
    </div>
  );
}

export function LoginForm({ next, invitation, defaultEmail }: { next?: string; invitation?: string; defaultEmail?: string }) {
  const [email, setEmail] = useState(defaultEmail ?? '');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | undefined>();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!EMAIL_RE.test(email.trim())) {
      setError('Cette adresse e-mail semble incomplète. Vérifiez-la, par exemple vous@exemple.fr.');
      return;
    }
    setState('sending');
    const r = await post('/api/account/login', { email: email.trim(), next, invitation });
    if (!r.ok) {
      setState('idle');
      setError(String(r.data.error ?? 'L’envoi n’a pas fonctionné. Réessayez dans un instant.'));
      return;
    }
    setDevLink(typeof r.data.devLink === 'string' ? r.data.devLink : undefined);
    setState('sent');
  }

  if (state === 'sent') return <Sent email={email.trim()} devLink={devLink} onBack={() => setState('idle')} />;
  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-6" noValidate>
      <label htmlFor="login-email" className={label}>Votre adresse e-mail</label>
      <input
        id="login-email"
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        placeholder="vous@exemple.fr"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? 'login-err' : undefined}
        className={input}
      />
      {error && <p id="login-err" role="alert" className="text-sm text-danger-ink">{error}</p>}
      <button type="submit" disabled={state === 'sending'} className={buttonClasses({ className: 'w-full' })}>
        {state === 'sending' ? 'Envoi…' : 'Recevoir mon lien de connexion'}
      </button>
      <p className="text-sm text-muted">Pas de mot de passe : nous vous envoyons un lien sécurisé à usage unique.</p>
    </form>
  );
}

function SegmentPicker({ value, onChange, name }: { value: Segment | null; onChange: (s: Segment) => void; name: string }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className={`${label} mb-1`}>Votre activité</legend>
      {SEGMENTS.map((s) => (
        <label
          key={s.id}
          className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${value === s.id ? 'border-primary bg-primary-bg' : 'border-line bg-white'}`}
        >
          <input type="radio" name={name} value={s.id} checked={value === s.id} onChange={() => onChange(s.id)} className="mt-1" />
          <span>
            <span className="block font-semibold text-ink">{s.title}</span>
            <span className="block text-sm text-muted">{s.hint}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

/** Libellés du métier par parcours (inscription, /bienvenue). */
const TRADE_COPY: Record<Segment, { label: string; placeholder: string; error: string }> = {
  local: { label: 'Votre métier', placeholder: 'plombier, pizzeria, institut de beauté…', error: 'Indiquez votre métier, par exemple « plombier » ou « pizzeria ».' },
  pme: { label: 'Votre secteur ou catégorie d’offre', placeholder: 'logiciel de paie pour PME, cabinet de recrutement tech…', error: 'Indiquez votre secteur, par exemple « logiciel de paie pour PME ».' },
  ecommerce: { label: 'Votre catégorie de produits principale', placeholder: 'shampoing solide, crème solaire bio…', error: 'Indiquez votre catégorie de produits principale, par exemple « shampoing solide ».' },
};

const cap = (x: string) => (x ? x.charAt(0).toUpperCase() + x.slice(1) : x);

/** « Plombier · Paris 11e », « Logiciel de paie pour PME · France ». */
export function profileSummary(segment: Segment, trade: string, city: string, district?: string): string {
  const where = segment === 'local' ? [city.trim(), district?.trim()].filter(Boolean).join(' ') : city.trim() && city.trim() !== 'France' ? city.trim() : '';
  return [cap(trade.trim()), where].filter(Boolean).join(' · ');
}

export interface SignupPrefill {
  name?: string;
  website?: string;
  /** métier (local), secteur (PME) ou catégorie de produits (e-commerce) de l'audit d'origine */
  trade?: string;
  /** ville (local) ou marché (PME, e-commerce) de l'audit d'origine */
  city?: string;
  /** arrondissement ou quartier de l'audit d'origine (affiché, repris côté serveur depuis l'audit) */
  district?: string;
  /** audit gratuit d'origine, code de parrainage et suite (transmis tels quels au serveur, vérifiés là-bas) */
  audit?: string;
  /** analyse 60 s d'origine (V5) : rattachée côté serveur si elle a été demandée avec la même adresse */
  analysis?: string;
  ref?: string;
  suite?: 'carte';
}

export function SignupForm({ defaultSegment, prefill = {} }: { defaultSegment?: Segment; prefill?: SignupPrefill }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState(prefill.name ?? '');
  const [website, setWebsite] = useState(prefill.website ?? '');
  const [segment, setSegment] = useState<Segment | null>(defaultSegment ?? null);
  const [trade, setTrade] = useState(prefill.trade ?? '');
  const [city, setCity] = useState(prefill.city ?? '');
  // Audit d'origine connu : métier et ville affichés en lecture (« Plombier · Paris 11e — Modifier »).
  const fromAudit = Boolean(prefill.audit && prefill.trade && defaultSegment);
  const [editProfile, setEditProfile] = useState(!fromAudit);
  const [consent, setConsent] = useState(false);
  // Déclaration obligatoire : service réservé aux professionnels (CGV, article 4).
  const [pro, setPro] = useState(false);
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | undefined>();
  const seg = segment ?? defaultSegment ?? null;
  const tradeCopy = seg ? TRADE_COPY[seg] : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!EMAIL_RE.test(email.trim())) return setError('Cette adresse e-mail semble incomplète. Vérifiez-la, par exemple vous@exemple.fr.');
    if (name.trim().length < 2) return setError('Indiquez le nom de votre entreprise.');
    if (!segment) return setError('Choisissez votre activité.');
    if (trade.trim().length < 2) return setError(TRADE_COPY[segment].error);
    if (segment === 'local' && city.trim().length < 2) return setError('Indiquez la ville de votre commerce.');
    if (!pro) return setError('Repéré est réservé aux professionnels : cochez la case « J’agis pour les besoins de mon activité professionnelle ».');
    if (!consent) return setError('Acceptez les conditions générales pour créer votre compte.');
    setState('sending');
    // Parcours changé par rapport à l'audit : le métier saisi vaut pour le nouveau parcours, la ville seulement en local.
    const r = await post('/api/account/signup', {
      email: email.trim(),
      name: name.trim(),
      website: website.trim(),
      segment,
      trade: trade.trim(),
      ...(segment === 'local' ? { city: city.trim() } : {}),
      audit: prefill.audit,
      ...(prefill.analysis ? { analysis: prefill.analysis } : {}),
      ref: prefill.ref,
      suite: prefill.suite,
    });
    if (!r.ok) {
      setState('idle');
      setError(String(r.data.error ?? 'L’inscription n’a pas fonctionné. Réessayez dans un instant.'));
      return;
    }
    setDevLink(typeof r.data.devLink === 'string' ? r.data.devLink : undefined);
    setState('sent');
  }

  if (state === 'sent') return <Sent signup email={email.trim()} devLink={devLink} onBack={() => setState('idle')} />;
  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-6" noValidate>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="su-email" className={label}>Adresse e-mail professionnelle</label>
        <input id="su-email" type="email" inputMode="email" autoComplete="email" placeholder="vous@exemple.fr" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="su-name" className={label}>Nom de l’entreprise</label>
        <input id="su-name" autoComplete="organization" placeholder="Plomberie Dupont, Atelier Lune…" value={name} onChange={(e) => setName(e.target.value)} className={input} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="su-site" className={label}>Site Internet <span className="font-normal text-muted">(facultatif)</span></label>
        <input id="su-site" inputMode="url" autoComplete="url" placeholder="www.exemple.fr" value={website} onChange={(e) => setWebsite(e.target.value)} className={input} />
      </div>
      {fromAudit && !editProfile && segment === defaultSegment ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-primary-bg p-3 text-sm">
          <span>
            <span className="block font-semibold text-ink">Repris de votre audit</span>
            <span className="text-muted">{profileSummary(segment, trade, city, prefill.district)}</span>
          </span>
          <button type="button" onClick={() => setEditProfile(true)} className="font-semibold text-primary underline">
            Modifier
          </button>
        </div>
      ) : (
        <>
          <SegmentPicker value={segment} onChange={setSegment} name="su-segment" />
          {tradeCopy && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="su-trade" className={label}>{tradeCopy.label}</label>
              <input id="su-trade" autoComplete="off" placeholder={tradeCopy.placeholder} value={trade} onChange={(e) => setTrade(e.target.value)} maxLength={80} className={input} />
            </div>
          )}
          {seg === 'local' && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="su-city" className={label}>Ville</label>
              <input id="su-city" autoComplete="address-level2" placeholder="Paris, Lyon…" value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} className={input} />
            </div>
          )}
        </>
      )}
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-canvas p-3 text-sm text-ink has-[:checked]:border-primary/40">
        <input type="checkbox" required checked={pro} onChange={(e) => setPro(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--color-primary)]" />
        <span>J’agis pour les besoins de mon activité professionnelle (entreprise, commerce, artisan, profession libérale).</span>
      </label>
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-canvas p-3 text-sm text-ink has-[:checked]:border-primary/40">
        <input type="checkbox" required checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--color-primary)]" />
        <span>
          J’accepte les <a href="/cgv" className="font-semibold text-primary underline">conditions générales</a> et j’ai pris connaissance de la{' '}
          <a href="/confidentialite" className="font-semibold text-primary underline">politique de confidentialité</a>.
        </span>
      </label>
      {error && <p role="alert" className="text-sm text-danger-ink">{error}</p>}
      <button type="submit" disabled={state === 'sending'} className={buttonClasses({ className: 'w-full' })}>
        {state === 'sending' ? 'Création…' : 'Créer mon compte gratuit'}
      </button>
      <p className="text-sm text-muted">Sans carte bancaire. Vous recevez un lien pour confirmer votre adresse.</p>
    </form>
  );
}

export interface WelcomePrefill {
  name?: string;
  website?: string;
  trade?: string;
  city?: string;
}

export function WelcomeForm({ defaultSegment, setupBusinessId, prefill = {} }: { defaultSegment?: Segment; setupBusinessId?: string; prefill?: WelcomePrefill }) {
  const [name, setName] = useState(prefill.name ?? '');
  const [website, setWebsite] = useState(prefill.website ?? '');
  const [city, setCity] = useState(prefill.city ?? '');
  const [trade, setTrade] = useState(prefill.trade ?? '');
  const [segment, setSegment] = useState<Segment | null>(defaultSegment ?? null);
  // Espace à compléter : seuls les champs vides sont demandés ; les autres restent modifiables sur demande.
  const known = {
    name: !!setupBusinessId && (prefill.name ?? '').trim().length >= 2,
    trade: !!setupBusinessId && (prefill.trade ?? '').trim().length >= 2,
    city: !!setupBusinessId && (prefill.city ?? '').trim().length >= 2,
  };
  const [showAll, setShowAll] = useState(false);
  const [state, setState] = useState<'idle' | 'sending'>('idle');
  const [error, setError] = useState<string | null>(null);
  const tradeCopy = segment ? TRADE_COPY[segment] : null;
  const ask = (k: keyof typeof known) => showAll || !known[k];
  const hidden = (Object.keys(known) as (keyof typeof known)[]).filter((k) => !ask(k) && (k !== 'city' || segment === 'local'));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) return setError('Indiquez le nom de votre entreprise.');
    if (!segment) return setError('Choisissez votre activité.');
    if (trade.trim().length < 2) return setError(TRADE_COPY[segment].error);
    if (segment === 'local' && city.trim().length < 2) return setError('Indiquez la ville de votre commerce.');
    setState('sending');
    const fields = { name: name.trim(), website: website.trim(), city: segment === 'local' ? city.trim() : '', trade: trade.trim() };
    const r = await post('/api/account/businesses', setupBusinessId ? { setup: { businessId: setupBusinessId, ...fields } } : { create: { ...fields, segment } });
    if (!r.ok) {
      setState('idle');
      setError(String(r.data.error ?? 'La création n’a pas fonctionné. Réessayez dans un instant.'));
      return;
    }
    window.location.assign('/app');
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-6" noValidate>
      {hidden.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-primary-bg p-3 text-sm">
          <span>
            <span className="block font-semibold text-ink">{known.name ? name : 'Votre espace'}</span>
            <span className="text-muted">{segment && known.trade ? profileSummary(segment, trade, known.city ? city : '') : 'Informations déjà enregistrées'}</span>
          </span>
          <button type="button" onClick={() => setShowAll(true)} className="font-semibold text-primary underline">
            Modifier
          </button>
        </div>
      )}
      {ask('name') && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="wf-name" className={label}>Nom de l’entreprise</label>
          <input id="wf-name" autoComplete="organization" value={name} onChange={(e) => setName(e.target.value)} className={input} />
        </div>
      )}
      {!setupBusinessId && <SegmentPicker value={segment} onChange={setSegment} name="wf-segment" />}
      {tradeCopy && ask('trade') && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="wf-trade" className={label}>{tradeCopy.label}</label>
          <input id="wf-trade" autoComplete="off" placeholder={tradeCopy.placeholder} value={trade} onChange={(e) => setTrade(e.target.value)} maxLength={80} className={input} />
        </div>
      )}
      {segment === 'local' && ask('city') && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="wf-city" className={label}>Ville</label>
          <input id="wf-city" autoComplete="address-level2" value={city} onChange={(e) => setCity(e.target.value)} className={input} />
        </div>
      )}
      {(showAll || !setupBusinessId || !website) && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="wf-site" className={label}>Site Internet <span className="font-normal text-muted">(facultatif)</span></label>
          <input id="wf-site" inputMode="url" value={website} onChange={(e) => setWebsite(e.target.value)} className={input} />
        </div>
      )}
      {error && <p role="alert" className="text-sm text-danger-ink">{error}</p>}
      <button type="submit" disabled={state === 'sending'} className={buttonClasses({ className: 'w-full' })}>
        {state === 'sending' ? 'Enregistrement…' : setupBusinessId ? 'Enregistrer et lancer ma première mesure' : 'Créer mon espace'}
      </button>
    </form>
  );
}

export function AcceptInvitation({ token }: { token: string }) {
  const [state, setState] = useState<'idle' | 'sending'>('idle');
  const [error, setError] = useState<string | null>(null);
  async function accept() {
    setState('sending');
    const r = await post('/api/team/accept', { token });
    if (!r.ok) {
      setState('idle');
      setError(String(r.data.error ?? 'Cette invitation n’est plus valable.'));
      return;
    }
    window.location.assign('/app');
  }
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-6">
      <p className="text-ink">Vous êtes connecté. Acceptez l’invitation pour rejoindre l’espace.</p>
      {error && <p role="alert" className="text-sm text-danger-ink">{error}</p>}
      <button type="button" onClick={accept} disabled={state === 'sending'} className={buttonClasses({ className: 'w-full' })}>
        {state === 'sending' ? 'Un instant…' : 'Rejoindre l’espace'}
      </button>
    </div>
  );
}

export function LogoutButton({ label: text = 'Se déconnecter' }: { label?: string }) {
  return (
    <form method="post" action="/api/account/logout">
      <button type="submit" className={buttonClasses({ variant: 'ghost' })}>{text}</button>
    </form>
  );
}
