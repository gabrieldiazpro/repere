'use client';
// Contrôles client de la partie SEO (APP-SEO) : connexion Search Console, relance d'exploration, retour OAuth.
import { useEffect, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from '@/components/ui/toast';
import { Icon } from '@/components/app/icons';
import { relancerExploration } from '@/app/app/seo/actions';

/** Bouton « Connecter Search Console » : récupère l'URL de consentement Google puis y redirige. */
export function ConnectGscButton({ businessId, demo, primary = false, label = 'Connecter Search Console' }: { businessId: string; demo: boolean; primary?: boolean; label?: string }) {
  const [busy, setBusy] = useState(false);
  const go = async () => {
    if (demo) {
      toast({ text: 'Compte de démonstration : les données Search Console affichées sont fictives. Créez votre espace pour connecter la vôtre.', tone: 'info' });
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`/api/v5/connect/google/start?businessId=${encodeURIComponent(businessId)}`, { credentials: 'same-origin' });
      const j = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
      if (r.ok && j.url) {
        window.location.assign(j.url);
        return;
      }
      toast({ text: j.error ?? 'La connexion Google n’a pas pu démarrer.', tone: 'error' });
    } catch {
      toast({ text: 'La connexion Google n’a pas pu démarrer. Vérifiez votre connexion.', tone: 'error' });
    }
    setBusy(false);
  };
  return (
    <button type="button" className="ui-btn" data-variant={primary ? 'primary' : undefined} data-size={primary ? undefined : 'sm'} onClick={go} disabled={busy} aria-busy={busy}>
      <Icon name="plug" size={15} />
      {busy ? 'Ouverture de Google…' : label}
    </button>
  );
}

/** Choix de la propriété Search Console après le retour OAuth (plusieurs propriétés accordées). */
export function ChooseProperty({ businessId, sites }: { businessId: string; sites: { siteUrl: string }[] }) {
  const [v, setV] = useState(sites[0]?.siteUrl ?? '');
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const save = async () => {
    setBusy(true);
    const r = await fetch('/api/v5/connect/google/properties', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ businessId, siteUrl: v }) }).catch(() => null);
    setBusy(false);
    if (r?.ok) {
      toast({ text: 'Propriété choisie : import des 16 derniers mois en cours.', tone: 'success' });
      router.refresh();
    } else toast({ text: 'Le choix de la propriété n’a pas été enregistré.', tone: 'error' });
  };
  return (
    <div className="seo-kw-add">
      <label className="sr-only" htmlFor="gsc-prop">
        Propriété Search Console
      </label>
      <select id="gsc-prop" className="seo-select" value={v} onChange={(e) => setV(e.target.value)}>
        {sites.map((s) => (
          <option key={s.siteUrl} value={s.siteUrl}>
            {s.siteUrl.replace(/^sc-domain:/, 'Domaine : ')}
          </option>
        ))}
      </select>
      <button type="button" className="ui-btn" data-variant="primary" onClick={save} disabled={busy || !v}>
        Utiliser cette propriété
      </button>
    </div>
  );
}

const OAUTH_MSG: Record<string, { text: string; tone: 'success' | 'error' | 'info' }> = {
  connected: { text: 'Search Console est connecté : import des 16 derniers mois en cours (quelques minutes).', tone: 'success' },
  choose_property: { text: 'Google a accordé plusieurs propriétés : choisissez celle de votre site.', tone: 'success' },
  no_property: { text: 'Ce compte Google n’a accès à aucune propriété Search Console. Connectez le compte qui gère votre site.', tone: 'error' },
  denied: { text: 'Connexion annulée : Repéré n’a reçu aucun accès.', tone: 'error' },
  invalid_state: { text: 'La connexion a expiré ou a été ouverte dans un autre navigateur. Recommencez depuis ce navigateur.', tone: 'error' },
  error: { text: 'Google n’a pas pu finaliser la connexion. Réessayez.', tone: 'error' },
  not_configured: { text: 'La connexion Google n’est pas encore activée sur Repéré.', tone: 'error' },
};

/** Annonce le résultat du retour OAuth (?gsc=…) puis nettoie l'URL. */
export function OAuthNotice() {
  const q = useSearchParams();
  const router = useRouter();
  const s = q.get('gsc');
  useEffect(() => {
    if (!s || !OAUTH_MSG[s]) return;
    toast(OAUTH_MSG[s]);
    const u = new URL(window.location.href);
    u.searchParams.delete('gsc');
    router.replace(`${u.pathname}${u.search}`, { scroll: false });
  }, [s, router]);
  return null;
}

/** Relance de l'exploration (droits par offre). Démo : explication, rien n'est lancé. */
export function CrawlButton({ demo, allowed, rightsLabel, primary = false, nextAt }: { demo: boolean; allowed: boolean; rightsLabel: string; primary?: boolean; nextAt?: string | null }) {
  const [pending, start] = useTransition();
  const [elapsed, setElapsed] = useState(0);
  const router = useRouter();
  useEffect(() => {
    if (!pending) return setElapsed(0);
    const t = setInterval(() => setElapsed((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [pending]);
  const run = () => {
    if (demo) {
      toast({ text: 'Compte de démonstration : l’exploration affichée est simulée sur un site fictif.', tone: 'info' });
      return;
    }
    start(async () => {
      const r = await relancerExploration();
      if (r.ok) {
        toast({ text: `Exploration terminée : ${r.pages} pages lues${r.truncated ? ' (plafond de votre offre atteint)' : ''}. Score Google ${r.seo}/100, IA ${r.geo}/100.`, tone: 'success' });
        router.refresh();
      } else toast({ text: r.error, tone: 'error' });
    });
  };
  const blocked = !demo && !allowed;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button type="button" className="ui-btn" data-variant={primary ? 'primary' : undefined} onClick={run} disabled={pending || blocked} aria-busy={pending} title={rightsLabel}>
        <Icon name="search" size={15} />
        {pending ? `Exploration en cours… ${elapsed} s` : 'Relancer l’exploration'}
      </button>
      {pending && (
        <span className="ui-live" role="status">
          <span className="ui-live-bar" />
          RepereBot lit vos pages (1 minute au plus)
        </span>
      )}
      {blocked && nextAt && <span className="ui-caption">Prochaine exploration possible le {new Date(nextAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Europe/Paris' })} ({rightsLabel.toLowerCase()}).</span>}
    </span>
  );
}
