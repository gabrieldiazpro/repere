import Link from "next/link";
import type { Metadata } from "next";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Container } from "@/components/ui/Container";
import { buttonClasses } from "@/components/ui/Button";
import { verifyActionToken } from "@/lib/autopilot/tokens";

export const metadata: Metadata = {
  title: "Pilote automatique : confirmer",
  description: "Annuler une série de corrections, bloquer un contenu ou mettre le pilote en pause, depuis un e-mail.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/pilote/action" },
};

type SP = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const WHAT = {
  undo: { title: "Annuler cette série de corrections ?", text: "Repéré remet sur votre site les valeurs d’avant, à l’identique, puis relit la page pour le vérifier.", button: "Oui, annuler la série", done: "C’est annulé : les valeurs d’avant sont de retour sur votre site." },
  block: { title: "Bloquer la mise en ligne de ce contenu ?", text: "Il ne sera pas publié. Le brouillon reste chez vous, non visible du public : vous pourrez le supprimer ou le modifier.", button: "Oui, bloquer la mise en ligne", done: "C’est bloqué : ce contenu ne sera pas mis en ligne." },
  pause: { title: "Mettre le pilote automatique en pause ?", text: "Plus rien ne sera fait sur votre site jusqu’à ce que vous le relanciez depuis votre espace. Ce qui est déjà fait reste annulable.", button: "Oui, mettre en pause", done: "Le pilote est en pause. Relancez-le quand vous voulez depuis votre espace." },
} as const;

export default async function PiloteActionPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const t = first(sp.t);
  const r = first(sp.r);
  const k = first(sp.k) as keyof typeof WHAT | undefined;
  const tok = t ? verifyActionToken(t) : null;
  const what = tok ? WHAT[tok.kind] : k && WHAT[k] ? WHAT[k] : null;

  let body: React.ReactNode;
  if (r === "ok" && what) {
    body = (
      <>
        <h1 className="text-3xl font-bold sm:text-4xl">C&apos;est fait.</h1>
        <p className="mt-4 text-lg text-ink/80">{what.done} L&apos;action est inscrite dans votre journal.</p>
      </>
    );
  } else if (r === "echec") {
    body = (
      <>
        <h1 className="text-3xl font-bold sm:text-4xl">Cette action n&apos;a pas pu aboutir.</h1>
        <p className="mt-4 text-lg text-ink/80">
          {first(sp.c) === "partial" || first(sp.c) === "conflict"
            ? "La page a été modifiée depuis sur votre site : pour ne rien écraser, l'annulation est à faire depuis votre espace, où le détail est affiché."
            : first(sp.c) === "bad_state"
              ? "Ce contenu n'est plus en relecture (déjà en ligne ou déjà bloqué). Vous pouvez le retirer depuis votre espace, en un clic."
              : "Réessayez depuis votre espace, ou répondez à l'e-mail : nous vous répondons par écrit."}
        </p>
      </>
    );
  } else if (r === "demo") {
    body = (
      <>
        <h1 className="text-3xl font-bold sm:text-4xl">Compte de démonstration</h1>
        <p className="mt-4 text-lg text-ink/80">Entreprise fictive : aucune action réelle n&apos;est possible.</p>
      </>
    );
  } else if (tok && what) {
    body = (
      <>
        <h1 className="text-3xl font-bold sm:text-4xl">{what.title}</h1>
        <p className="mt-4 text-lg text-ink/80">{what.text}</p>
        <form method="post" action="/api/pilote/action" className="mt-8">
          <input type="hidden" name="t" value={t} />
          <button type="submit" className={buttonClasses({ size: "lg" })}>
            {what.button}
          </button>
        </form>
      </>
    );
  } else {
    body = (
      <>
        <h1 className="text-3xl font-bold sm:text-4xl">Ce lien n&apos;est plus valable.</h1>
        <p className="mt-4 text-lg text-ink/80">Il a expiré (30 jours) ou a été modifié. Tout reste possible depuis votre espace, en un clic.</p>
      </>
    );
  }

  return (
    <>
      <Header />
      <main id="contenu" className="bg-canvas">
        <Container size="narrow" className="py-16 sm:py-24">
          <div className="rounded-[1.25rem] bg-white p-6 ring-1 ring-line sm:p-10">
            <p className="text-[0.82rem] font-semibold uppercase tracking-[0.06em] text-muted">Pilote automatique</p>
            <div className="mt-2">{body}</div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/connexion?next=%2Fapp%2Fagent%2Fpilote" className={buttonClasses({ variant: "secondary" })}>
                Ouvrir mon espace
              </Link>
              <Link href="/tout-fait-pour-vous" className="inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-4">
                Comment fonctionne le pilote
              </Link>
            </div>
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}
