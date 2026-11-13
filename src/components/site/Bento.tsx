/**
 * Grille bento des fonctionnalités (docs/v3/07 §5.6.2). Composant serveur, animations 100 % CSS :
 * chaque visuel se joue une fois à l'entrée (data-in posé par <MotionRoot />) et se rejoue au survol ; jamais en boucle.
 * Données d'exemple, étiquetées.
 */
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { Reveal } from "@/components/motion/Reveal";
import { demoDigest, demoMeasure, demoSources, measureSceneData, orNull, proveSceneData } from "./demo-figures";

const d = (ms: number) => ({ ["--d" as string]: `${ms}ms` }) as CSSProperties;

function Cell({
  href,
  title,
  text,
  visual,
  className = "",
  i,
}: {
  href: string;
  title: string;
  text: string;
  visual: ReactNode;
  className?: string;
  i: number;
}) {
  return (
    <Reveal
      as="li"
      i={i}
      className={`bento-cell group relative flex flex-col overflow-hidden rounded-[1.25rem] bg-white shadow-[0_0_0_1px_rgba(27,31,46,.08),0_2px_4px_rgba(27,31,46,.03),0_18px_36px_-24px_rgba(30,26,92,.25)] ${className}`}
    >
      <div aria-hidden="true" className="relative flex min-h-36 flex-1 items-center overflow-hidden bg-canvas/70 px-5 py-5">
        {visual}
      </div>
      <div className="px-5 pb-5 pt-4">
        <h3 className="text-[1.15rem] font-bold">
          <Link href={href} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
            {title}
          </Link>
        </h3>
        <p className="mt-1 text-[0.95rem] text-ink/75">{text}</p>
      </div>
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[1.25rem] ring-primary group-has-[:focus-visible]:ring-[3px]" />
    </Reveal>
  );
}

type MeasureData = ReturnType<typeof measureSceneData>;
type ProveData = Awaited<ReturnType<typeof proveSceneData>>;
type DigestData = Awaited<ReturnType<typeof demoDigest>>;

function MeasureViz({ m }: { m: MeasureData }) {
  const sov = m.sov.slice(0, 4);
  if (!sov.some((x) => x.you)) {
    const me = m.sov.find((x) => x.you);
    if (me) sov[3] = me;
  }
  const max = Math.max(1, ...sov.map((x) => x.v));
  return (
    <div className="w-full">
      <p className="mb-4 text-[0.78rem] font-semibold text-muted">Compte démo {m.account} : une question suivie</p>
      <p className="mb-5 w-fit max-w-full rounded-2xl rounded-br-md bg-primary-bg px-3.5 py-2 text-[0.95rem] font-semibold text-primary-deep">
        {`«\u00a0${m.question.replace(/\s*\?$/, "\u00a0?")}\u00a0»`}
      </p>
      <ul className={`grid grid-cols-2 gap-2 ${m.answers.length >= 4 ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
        {m.answers.map((x) => ({ ia: x.ia, ok: x.you > 0 })).map((p, k) => (
          <li key={p.ia} className="flex items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-2 text-[0.85rem] font-semibold shadow-[0_0_0_1px_rgba(27,31,46,.07)]">
            {p.ia}
            <span
              className={`bx bx-pop flex h-5 w-5 items-center justify-center rounded-full ${p.ok ? "bg-success-bg text-success-ink" : "bg-danger-bg text-danger-ink"}`}
              style={d(250 + k * 120)}
            >
              <svg viewBox="0 0 12 12" width="10" height="10">
                {p.ok ? (
                  <path d="M2.5 6.3l2.2 2.2L9.5 3.7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                ) : (
                  <path d="M3 3l6 6M9 3l-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                )}
              </svg>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-5 text-[0.78rem] font-semibold text-muted">Part de voix, {m.questions} questions</p>
      <ul className="mt-2 space-y-2">
        {sov.map((x, k) => (
          <li key={x.name} className="flex items-center gap-2">
            <span className={`w-20 shrink-0 truncate text-[0.78rem] ${x.you ? "font-semibold text-ink" : "text-muted"}`}>{x.you ? "Vous" : x.name}</span>
            <span className="h-2.5 flex-1 rounded-full bg-white">
              <span className={`bx bx-grow block h-2.5 rounded-full ${x.you ? "bg-primary" : "bg-line"}`} style={{ ...d(700 + k * 90), width: `${(x.v / max) * 100}%` }} />
            </span>
            <span className="tabular w-9 text-right text-[0.78rem] text-muted">{x.v} %</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SourcesViz({ rows }: { rows: { d: string; here: boolean }[] }) {
  return (
    <div className="h-32 w-full overflow-hidden [mask-image:linear-gradient(#000_70%,transparent)]">
      <ul className="bx bx-scroll space-y-1.5 text-[0.8rem]" style={{ ...d(200), translate: "0 -38%" }}>
        {[...rows, ...rows.slice(0, 3)].map(({ d: n, here }, k) => (
          <li key={k} className="flex items-center justify-between gap-2 rounded-md bg-white px-2 py-1">
            <span className="truncate">{n}</span>
            <span className={`h-2 w-2 shrink-0 rounded-full ${here ? "bg-success" : "bg-danger"}`} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function TruthViz({ g }: { g: DigestData }) {
  const e = g.factError;
  if (!e) return null;
  return (
    <div className="w-full space-y-2 text-[0.85rem]">
      <p className="rounded-lg bg-danger-bg px-2.5 py-1.5 text-danger-ink">
        <span className="block text-[0.7rem] font-semibold">Ce que dit {e.ia} ({e.label.toLowerCase()})</span>
        <span className="bx-strike font-semibold" style={d(500)}>
          {e.stated}
        </span>
      </p>
      <p className="bx bx-fade rounded-lg bg-success-bg px-2.5 py-1.5 text-success-ink" style={d(950)}>
        <span className="block text-[0.7rem] font-semibold">Votre fiche de vérité</span>
        <span className="font-semibold">{e.expected}</span>
      </p>
    </div>
  );
}

function TrafficViz({ t }: { t: ProveData }) {
  const v = t.weekly;
  const top = Math.max(10, Math.ceil((Math.max(...v) * 1.1) / 10) * 10);
  const w = 200;
  const h = 70;
  const line = v.map((x, k) => `${k ? "L" : "M"}${((k * w) / (v.length - 1)).toFixed(1)} ${(h - (x / top) * h).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 -4 ${w} ${h + 8}`} className="h-auto w-full" role="img" aria-label={`Compte démo ${t.account} : visites venues des IA par semaine, de ${v[0]} à ${v[v.length - 1]} en 12 semaines`}>
      <path d={`${line} L${w} ${h} L0 ${h} Z`} fill="#3730A3" opacity=".08" className="bx bx-fade" style={d(600)} />
      <path d={line} pathLength={1} strokeDasharray="1" fill="none" stroke="#3730A3" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="bx bx-draw" style={d(150)} />
      <circle cx={w} cy={h - (v[v.length - 1] / top) * h} r="4" fill="#3730A3" stroke="#fff" strokeWidth="2" className="bx bx-pop" style={{ ...d(1000), transformBox: "fill-box", transformOrigin: "center" }} />
    </svg>
  );
}

function CopilotViz({ local }: { local: ReturnType<typeof demoMeasure> }) {
  const me = local.rows.find((r) => r.you);
  const ahead = local.rows[Math.max(0, local.rows.findIndex((r) => r.you) - 1)];
  return (
    <div className="w-full space-y-2 text-[0.82rem]">
      <p className="ml-auto w-fit max-w-[92%] rounded-2xl rounded-br-md bg-primary-bg px-3 py-1.5 text-primary-deep">Qui passe juste devant moi ?</p>
      <p className="bx bx-type w-fit max-w-[96%] rounded-2xl rounded-bl-md bg-white px-3 py-1.5 shadow-[0_0_0_1px_rgba(27,31,46,.07)]" style={d(500)}>
        {ahead && me && !ahead.you
          ? `${ahead.name} : cité dans ${ahead.mentions} réponses, vous dans ${me.mentions}. Vous êtes ${local.rank}ᵉ sur ${local.of}.`
          : `Personne : vous êtes 1ᵉʳ sur ${local.of}.`}
      </p>
    </div>
  );
}

function TaskViz() {
  return (
    <div className="flex w-full flex-wrap items-center gap-3">
      <div className="min-w-0 flex-1 rounded-xl bg-white p-3 text-[0.85rem] shadow-[0_0_0_1px_rgba(27,31,46,.07)]">
        <p className="font-semibold">Répondre à l&apos;avis de Julie R.</p>
        <p className="mt-0.5 truncate text-muted">« Merci Julie pour votre retour, ravis que l&apos;intervention… »</p>
      </div>
      <span className="relative inline-grid min-h-10 min-w-28 items-center rounded-lg bg-white px-3 text-[0.85rem] font-semibold ring-1 ring-inset ring-line">
        <span className="bx bx-out col-start-1 row-start-1 text-center text-primary" style={{ ...d(900), ["--bx-dur" as string]: "150ms" }}>
          Copier
        </span>
        <span className="bx bx-fade col-start-1 row-start-1 inline-flex items-center justify-center gap-1 text-success-ink" style={d(1000)}>
          <svg viewBox="0 0 12 12" width="11" height="11">
            <path d="M2.5 6.3l2.2 2.2L9.5 3.7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Copié
        </span>
      </span>
    </div>
  );
}

const TOOLS = ["Robots des IA autorisés ?", "Site prêt pour les IA", "Page citable ?", "Générateur JSON-LD", "Fichier llms.txt", "Lien d'avis Google"];

function ToolsViz() {
  return (
    <ul className="flex flex-wrap gap-2">
      {TOOLS.map((t, k) => (
        <li key={t} className="bx bx-pop rounded-full bg-white px-3 py-1.5 text-[0.85rem] font-semibold shadow-[0_0_0_1px_rgba(27,31,46,.08)]" style={d(150 + k * 90)}>
          {t}
        </li>
      ))}
    </ul>
  );
}

/** Grille des fonctions ; les visuels lisent les comptes démo (src/components/site/demo-figures.ts). */
export async function Bento() {
  const m = measureSceneData();
  const src = demoSources("pme", 8).rows;
  const [t, g] = await Promise.all([orNull(proveSceneData()), orNull(demoDigest("local"))]);
  const local = demoMeasure("local");
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
      <Cell i={0} className="sm:col-span-2 lg:row-span-2" href="/fonctionnalites/mesurer" title="Ce que disent les IA" text="Vos vraies questions clients, posées plusieurs fois à 3 à 5 IA selon l'offre, chaque semaine ou chaque mois. Qui est cité, à quel rang." visual={<MeasureViz m={m} />} />
      <Cell i={1} href="/fonctionnalites/comprendre" title="Les sources des IA" text="Les sites qu'elles lisent pour répondre, et ceux où il vous manque." visual={<SourcesViz rows={src} />} />
      <Cell i={2} href="/fonctionnalites/comprendre" title="Fiche de vérité" text="Alerte quand une IA se trompe sur vos coordonnées ou vos prix." visual={g ? <TruthViz g={g} /> : null} />
      <Cell i={3} href="/fonctionnalites/prouver" title="Trafic IA, sans cookie" text="Les visites venues de chatgpt.com ou perplexity.ai, sur votre site." visual={t ? <TrafficViz t={t} /> : null} />
      <Cell i={4} href="/fonctionnalites/copilote" title="Copilote" text="Posez une question sur vos chiffres, il répond avec vos données." visual={<CopilotViz local={local} />} />
      <Cell i={5} className="sm:col-span-2" href="/fonctionnalites/agir" title="Tâches prêtes" text="Chaque action arrive avec son texte à copier. Ou nous la faisons pour vous." visual={<TaskViz />} />
      <Cell i={6} className="sm:col-span-2" href="/outils" title="Outils gratuits" text="Vérifiez votre site en une minute, sans inscription." visual={<ToolsViz />} />
    </ul>
  );
}

export default Bento;
