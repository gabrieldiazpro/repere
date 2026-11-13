/**
 * Rapport partagé par lien public (/r/[token]) : rendu serveur, non indexé, lecture seule.
 * Aucune donnée sensible : ni e-mail, ni tâche, ni fiche de vérité (voir buildPublicView dans src/lib/share).
 * Marque blanche : nom, logo, couleur et masquage de « Repéré » si le commerce a le droit `whiteLabel`.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { buildPublicView, recordShareView, resolveShareToken, unlockCookieName, type PublicShareView } from '@/lib/share';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Props = { params: Promise<{ token: string }>; searchParams: Promise<{ e?: string }> };

const ROBOTS = { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } };

export async function generateMetadata(): Promise<Metadata> {
  return { title: { absolute: 'Rapport de visibilité dans les IA' }, robots: ROBOTS, referrer: 'no-referrer' };
}

const pct = (x: number) => `${Math.round(x * 100)} %`;
const frDate = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' });

function Shell({ children, color = '#3730A3' }: { children: React.ReactNode; color?: string }) {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <div style={{ height: 6, background: color }} aria-hidden="true" />
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">{children}</main>
    </div>
  );
}

function Message({ title, text }: { title: string; text: string }) {
  return (
    <Shell>
      <div className="mx-auto max-w-md rounded-2xl border border-line bg-white p-6 sm:p-8">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="mt-3 leading-relaxed text-muted">{text}</p>
      </div>
    </Shell>
  );
}

function PasswordForm({ token, error }: { token: string; error?: string }) {
  return (
    <Shell>
      <div className="mx-auto max-w-md rounded-2xl border border-line bg-white p-6 sm:p-8">
        <h1 className="text-xl font-semibold">Rapport protégé</h1>
        <p className="mt-3 leading-relaxed text-muted">Saisissez le mot de passe communiqué par l’expéditeur du lien.</p>
        <form method="post" action="/api/share/unlock" className="mt-5 space-y-3">
          <input type="hidden" name="token" value={token} />
          <label htmlFor="pw" className="block text-sm font-medium">Mot de passe</label>
          <input id="pw" name="password" type="password" required minLength={6} maxLength={128} autoComplete="current-password"
            className="w-full rounded-lg border border-line px-3 py-2.5 text-base outline-none focus-visible:ring-2 focus-visible:ring-primary" />
          {error === 'mdp' && <p role="alert" className="text-sm text-danger">Mot de passe incorrect.</p>}
          {error === 'limite' && <p role="alert" className="text-sm text-danger">Trop de tentatives. Réessayez dans une heure.</p>}
          <button type="submit" className="w-full rounded-lg bg-primary px-4 py-2.5 font-semibold text-white hover:bg-primary-strong focus-visible:outline-2 focus-visible:outline-offset-2">
            Ouvrir le rapport
          </button>
        </form>
      </div>
    </Shell>
  );
}

function History({ points, color }: { points: PublicShareView['history']; color: string }) {
  if (points.length < 2) return null;
  const W = 600, H = 160, P = 24;
  const x = (i: number) => P + (i * (W - 2 * P)) / (points.length - 1);
  const y = (v: number) => H - P - (Math.max(0, Math.min(100, v)) * (H - 2 * P)) / 100;
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.score).toFixed(1)}`).join(' ');
  const band = [...points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.high).toFixed(1)}`), ...points.map((p, i) => `L${x(points.length - 1 - i).toFixed(1)},${y(points[points.length - 1 - i].low).toFixed(1)}`)].join(' ') + 'Z';
  return (
    <section className="mt-6 rounded-2xl border border-line bg-white p-5 sm:p-6">
      <h2 className="text-lg font-semibold">Évolution du score</h2>
      <p className="mt-1 text-sm text-muted">La zone claire représente la marge d’erreur de chaque mesure.</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 h-auto w-full" role="img" aria-label={`Score de ${points[0].score} à ${points[points.length - 1].score} sur ${points.length} mesures`}>
        <path d={band} fill={color} opacity={0.12} />
        <path d={line} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" />
        {points.map((p, i) => <circle key={p.date} cx={x(i)} cy={y(p.score)} r={3.5} fill={color} />)}
      </svg>
      <ol className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted sm:grid-cols-4">
        {points.map((p) => (
          <li key={p.date}>{frDate(p.date)} : <span className="font-medium text-ink">{p.score}</span></li>
        ))}
      </ol>
    </section>
  );
}

function Report({ v }: { v: PublicShareView }) {
  const c = v.brand.color;
  return (
    <Shell color={c}>
      <header className="flex flex-wrap items-center gap-3">
        {v.brand.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={v.brand.logoUrl} alt={v.brand.name} referrerPolicy="no-referrer" className="h-10 w-auto max-w-[180px] object-contain" />
        ) : (
          <span className="text-lg font-bold" style={{ color: c }}>{v.brand.name}</span>
        )}
        {v.demo && <span className="rounded-full bg-primary-bg px-2.5 py-0.5 text-xs font-semibold text-primary">Données de démonstration</span>}
      </header>

      <section className="mt-6">
        <p className="text-sm font-medium text-muted">Rapport de visibilité dans les IA · mesure du {frDate(v.measuredAt)}</p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{v.business.name}</h1>
        {v.business.context && <p className="mt-1 text-muted">{v.business.context}</p>}
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-white p-5 sm:col-span-1">
          <p className="text-sm text-muted">Score de visibilité</p>
          <p className="mt-1 text-4xl font-bold" style={{ color: c }}>{v.score}<span className="text-lg font-medium text-muted">/100</span></p>
          <p className="mt-1 text-sm text-muted">Marge d’erreur : {v.range.low} à {v.range.high}</p>
          <span className="mt-3 inline-block rounded-full px-2.5 py-0.5 text-sm font-semibold" style={{ background: v.band.bg, color: v.band.ink }}>{v.band.label}</span>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5">
          <p className="text-sm text-muted">Classement</p>
          <p className="mt-2 text-lg font-semibold leading-snug">{v.rankLabel}</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5">
          <p className="text-sm text-muted">Part de voix</p>
          <p className="mt-1 text-3xl font-bold">{pct(v.shareOfVoice)}</p>
          <p className="mt-1 text-sm text-muted">des citations parmi les acteurs classés</p>
        </div>
      </section>

      {v.providers.length > 0 && (
        <section className="mt-6 rounded-2xl border border-line bg-white p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Par IA</h2>
          <ul className="mt-4 space-y-3">
            {v.providers.map((p) => (
              <li key={p.name} className="grid grid-cols-[7.5rem_1fr_3rem] items-center gap-3 text-sm">
                <span className="font-medium">{p.name}</span>
                <span className="h-2.5 overflow-hidden rounded-full bg-canvas" aria-hidden="true">
                  <span className="block h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, p.score ?? 0))}%`, background: c }} />
                </span>
                <span className="text-right tabular-nums">{p.score === null ? 'n.d.' : Math.round(p.score)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {v.ranking.length > 0 && (
        <section className="mt-6 rounded-2xl border border-line bg-white p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Qui les IA recommandent</h2>
          <div className="mt-4 relative overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-muted"><th className="py-2 pr-3 font-medium">Rang</th><th className="py-2 pr-3 font-medium">Acteur</th><th className="py-2 text-right font-medium">Part de voix</th></tr></thead>
              <tbody>
                {v.ranking.map((r) => (
                  <tr key={`${r.pos}-${r.name}`} className="border-t border-line" style={r.isMe ? { background: `${c}14` } : undefined}>
                    <td className="py-2 pr-3 tabular-nums">{r.pos}</td>
                    <td className={`py-2 pr-3 ${r.isMe ? 'font-semibold' : ''}`}>{r.name}{r.isMe ? ' (vous)' : ''}</td>
                    <td className="py-2 text-right tabular-nums">{pct(r.share)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {v.sources.length > 0 && (
        <section className="mt-6 rounded-2xl border border-line bg-white p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Sources citées par les IA</h2>
          <ul className="mt-4 divide-y divide-line text-sm">
            {v.sources.map((s) => (
              <li key={s.domain} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span><span className="font-medium">{s.label || s.domain}</span> <span className="text-muted">· {s.domain}</span></span>
                <span className="flex items-center gap-3">
                  <span className="text-muted tabular-nums">{s.citations} citation{s.citations > 1 ? 's' : ''}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${s.you === 'present' ? 'bg-success-bg text-success-ink' : s.you === 'absent' ? 'bg-warning-bg text-warning-ink' : 'bg-canvas text-muted'}`}>
                    {s.you === 'present' ? 'présent' : s.you === 'absent' ? 'absent' : 'non vérifié'}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {v.excerpts.length > 0 && (
        <section className="mt-6 rounded-2xl border border-line bg-white p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Extraits de réponses</h2>
          <div className="mt-4 space-y-4">
            {v.excerpts.map((e, i) => (
              <figure key={i} className="rounded-xl bg-canvas p-4">
                <figcaption className="text-sm text-muted"><span className="font-semibold text-ink">{e.provider}</span> · « {e.query} » · {e.mentioned ? 'vous cite' : 'ne vous cite pas'}</figcaption>
                <blockquote className="mt-2 whitespace-pre-line text-sm leading-relaxed">{e.text}</blockquote>
              </figure>
            ))}
          </div>
        </section>
      )}

      {v.scope === 'dashboard' && <History points={v.history} color={c} />}

      <footer className="mt-8 border-t border-line pt-5 text-sm leading-relaxed text-muted">
        <p>Méthode : {v.methodLabel}. Les réponses des IA varient d’une fois à l’autre : le score est donné avec sa marge d’erreur.</p>
        <p className="mt-1">Lien valable jusqu’au {frDate(v.expiresAt)}.</p>
        {v.brand.showRepere && <p className="mt-1">Rapport produit avec <Link href="/" className="underline underline-offset-2">Repéré</Link>, le suivi de la visibilité dans les IA.</p>}
      </footer>
    </Shell>
  );
}

export default async function SharedReportPage({ params, searchParams }: Props) {
  const { token } = await params;
  const { e } = await searchParams;
  const jar = await cookies();
  let res: Awaited<ReturnType<typeof resolveShareToken>>;
  try {
    res = await resolveShareToken(token, { unlockProof: null });
    if (res.status === 'password_required' && res.link) {
      res = await resolveShareToken(token, { unlockProof: jar.get(unlockCookieName(res.link))?.value ?? null });
    }
  } catch {
    return <Message title="Rapport indisponible" text="Le rapport ne peut pas être affiché pour le moment. Réessayez dans quelques minutes." />;
  }
  if (res.status === 'not_found' || !res.link) return <Message title="Lien introuvable" text="Ce lien de partage n’existe pas. Vérifiez qu’il a été copié en entier." />;
  if (res.status === 'revoked') return <Message title="Lien désactivé" text="La personne qui a partagé ce rapport a désactivé ce lien. Demandez-lui un nouveau lien." />;
  if (res.status === 'expired') return <Message title="Lien expiré" text="Ce lien de partage a expiré. Demandez un nouveau lien à la personne qui vous l’a envoyé." />;
  if (res.status === 'password_required') return <PasswordForm token={token} error={e} />;
  const view = await buildPublicView(res.link).catch(() => null);
  if (!view) return <Message title="Rapport indisponible" text="Ce rapport ne contient pas encore de mesure." />;
  await recordShareView(res.link.id, res.link.businessId);
  return <Report v={view} />;
}
