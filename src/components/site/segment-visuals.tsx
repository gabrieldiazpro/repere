/**
 * Visuels propres à chaque parcours (V4), calculés côté serveur depuis les comptes démo (entreprises fictives) :
 * carte de quartier (local), matrice concurrents × IA (PME), produits cités (e-commerce). Animation à l'entrée
 * (pastilles et barres), une seule fois ; tout le texte et tous les chiffres sont dans le HTML.
 */
import { Reveal } from "@/components/motion/Reveal";
import type { DemoLocalMap, DemoMatrix } from "./demo-figures";

const BAND: Record<string, { fill: string; ink: string; label: string }> = {
  fort: { fill: "var(--color-success)", ink: "#fff", label: "Souvent cité" },
  moyen: { fill: "var(--color-accent)", ink: "var(--color-ink)", label: "Parfois cité" },
  faible: { fill: "var(--color-danger)", ink: "#fff", label: "Rarement cité" },
  absent: { fill: "var(--color-danger)", ink: "#fff", label: "Absent" },
  na: { fill: "var(--color-line)", ink: "var(--color-ink)", label: "Pas de réponse" },
};

function DemoTag({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-warning-bg px-2 py-0.5 text-[0.72rem] font-semibold text-warning-ink">{children}</span>;
}

/* ---------- Commerce local : carte de quartier ---------- */

export function NeighborhoodMap({ map }: { map: DemoLocalMap }) {
  const zs = map.zones;
  const xs = zs.map((z) => z.x);
  const ys = zs.map((z) => z.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const W = 100;
  const H = 70;
  const px = (x: number) => 10 + ((x - x0) / Math.max(1, x1 - x0)) * (W - 20);
  const py = (y: number) => 9 + ((y - y0) / Math.max(1, y1 - y0)) * (H - 18);
  const home = zs.find((z) => z.home) ?? zs[0];
  const dist = (z: (typeof zs)[number]) => Math.hypot(z.x - home.x, z.y - home.y);
  const order = [...zs].sort((a, b) => dist(a) - dist(b));
  const short = (n: string) => n.replace(/^.*?\s(\d+(?:e|er))$/, "$1");
  const bands = [...new Set(zs.map((z) => z.band))];
  return (
    <figure className="app-frame overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-line/80 px-4 py-2.5 text-[0.8rem]">
        <span className="font-semibold">Les IA vous citent-elles, quartier par quartier ?</span>
        <DemoTag>Compte démo, {map.account}</DemoTag>
      </div>
      <Reveal className="bx-scope relative bg-canvas/60 p-3 sm:p-5">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-labelledby="nm-title">
          <title id="nm-title">
            {`Taux de citation de ${map.account} par zone : ${zs.map((z) => `${z.n} ${z.rate === null ? "pas de réponse" : `${z.rate} %`}`).join(", ")}.`}
          </title>
          {/* Fond : rues schématiques (pas de fond de carte réel) */}
          <g stroke="var(--color-line)" strokeWidth=".35" fill="none" opacity=".9">
            <path d="M0 18 C 25 22, 60 12, 100 20" />
            <path d="M0 44 C 30 40, 70 50, 100 42" />
            <path d="M22 0 C 26 25, 18 45, 26 70" />
            <path d="M62 0 C 58 30, 70 50, 64 70" />
            <path d="M0 62 C 40 58, 60 66, 100 60" />
          </g>
          {order.map((z, i) => {
            const b = BAND[z.band] ?? BAND.na;
            const r = z.home ? 6.4 : 5.2;
            return (
              <g key={z.n} className="bx bx-pop" style={{ ["--d" as string]: `${i * 90}ms`, transformBox: "fill-box", transformOrigin: "center" }}>
                {z.home ? <circle cx={px(z.x)} cy={py(z.y)} r={r + 2.2} fill="none" stroke="var(--color-primary)" strokeWidth=".9" /> : null}
                <circle cx={px(z.x)} cy={py(z.y)} r={r} fill={b.fill} fillOpacity={z.home ? 1 : 0.88} />
                <text x={px(z.x)} y={py(z.y) - 0.6} textAnchor="middle" fontSize="2.6" fontWeight="700" fill={b.ink} style={{ fontFamily: "var(--font-display)" }}>
                  {short(z.n)}
                </text>
                <text x={px(z.x)} y={py(z.y) + 2.6} textAnchor="middle" fontSize="2.3" fill={b.ink}>
                  {z.rate === null ? "–" : `${z.rate} %`}
                </text>
              </g>
            );
          })}
          <text x={px(home.x)} y={py(home.y) - 9.5} textAnchor="middle" fontSize="2.6" fontWeight="700" fill="var(--color-primary)">
            Votre commerce
          </text>
        </svg>
      </Reveal>
      <figcaption className="space-y-2 border-t border-line/80 px-4 py-3 text-[0.8rem] text-muted">
        <span className="flex flex-wrap gap-x-4 gap-y-1">
          {bands.map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: (BAND[k] ?? BAND.na).fill }} />
              {(BAND[k] ?? BAND.na).label}
            </span>
          ))}
        </span>
        <span className="block">
          Part des réponses qui citent {map.account}, {zs[0]?.answers ?? 0} réponses par zone. Simulation par zone : les IA ne connaissent pas votre position.
        </span>
      </figcaption>
    </figure>
  );
}

/* ---------- PME : matrice concurrents × IA ---------- */

export function CompetitorMatrix({ m }: { m: DemoMatrix }) {
  return (
    <figure className="app-frame overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-line/80 px-4 py-2.5 text-[0.8rem]">
        <span className="font-semibold">Qui chaque IA recommande, sur vos questions</span>
        <DemoTag>Compte démo, {m.account}</DemoTag>
      </div>
      <Reveal className="bx-scope overflow-x-auto p-3 sm:p-5">
        <table className="w-full border-separate border-spacing-y-1.5 text-[0.88rem]">
          <caption className="sr-only">Part des réponses de chaque IA qui citent chaque acteur, compte démo {m.account}</caption>
          <thead>
            <tr className="text-left text-[0.78rem] text-muted">
              <th scope="col" className="pb-1 font-semibold">Acteur</th>
              {m.engines.map((e) => (
                <th key={e} scope="col" className="pb-1 pl-3 font-semibold">
                  {e}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {m.rows.map((r, ri) => (
              <tr key={r.name} className={r.you ? "bg-primary-bg" : ""}>
                <th scope="row" className={`rounded-l-lg py-1.5 pl-2 pr-2 text-left font-semibold ${r.you ? "text-primary-deep" : ""}`}>
                  {r.name}
                  {r.you ? <span className="ml-1.5 text-[0.72rem] font-semibold text-primary">vous</span> : null}
                </th>
                {r.rates.map((v, i) => (
                  <td key={i} className={`py-1.5 pl-3 pr-2 last:rounded-r-lg`}>
                    <span className="flex items-center gap-2">
                      <span className="relative hidden h-2 w-full min-w-10 overflow-hidden rounded-full bg-line/60 sm:block">
                        <span
                          className={`site-bar absolute inset-y-0 left-0 w-full rounded-full ${r.you ? "bg-primary" : "bg-ink/35"}`}
                          style={{ transform: `scaleX(${v / 100})`, ["--d" as string]: `${ri * 90 + i * 40}ms` }}
                        />
                      </span>
                      <span className="tabular shrink-0 text-right text-[0.8rem] sm:w-9">{v}&nbsp;%</span>
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Reveal>
      <figcaption className="border-t border-line/80 px-4 py-3 text-[0.8rem] text-muted">
        Part des réponses de chaque IA qui citent l&apos;acteur ({m.answersPerEngine[0] ?? 0} réponses par IA, dernière mesure). Vous voyez d&apos;un coup
        d&apos;œil où un concurrent passe devant.
      </figcaption>
    </figure>
  );
}

/* ---------- E-commerce : produits cités ---------- */

export type DemoProductsData = {
  account: string;
  products: { name: string; appearances: number; answers: number }[];
};

export function ProductsCited({ d }: { d: DemoProductsData }) {
  const items = [...d.products].sort((a, b) => b.appearances / Math.max(1, b.answers) - a.appearances / Math.max(1, a.answers));
  return (
    <figure className="app-frame overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-line/80 px-4 py-2.5 text-[0.8rem]">
        <span className="font-semibold">Vos produits dans les réponses des IA</span>
        <DemoTag>Compte démo, {d.account}</DemoTag>
      </div>
      <Reveal as="ul" className="bx-scope space-y-3 p-4 sm:p-5">
        {items.map((p, i) => {
          const rate = p.answers ? Math.round((p.appearances / p.answers) * 100) : 0;
          return (
            <li key={p.name} className="flex items-center gap-3 rounded-xl bg-canvas p-3">
              <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white shadow-[0_0_0_1px_rgba(27,31,46,.08)]">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="var(--color-primary)" strokeWidth="1.6" strokeLinejoin="round">
                  <path d="M5 8h14l-1.2 11.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8L5 8Z" />
                  <path d="M9 8V6.5a3 3 0 0 1 6 0V8" strokeLinecap="round" />
                </svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{p.name}</span>
                <span className="mt-1.5 flex items-center gap-2">
                  <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-line/60">
                    <span
                      className="site-bar absolute inset-y-0 left-0 w-full rounded-full bg-primary"
                      style={{ transform: `scaleX(${rate / 100})`, ["--d" as string]: `${i * 140}ms` }}
                    />
                  </span>
                  <span className="tabular shrink-0 text-[0.8rem] text-muted">
                    cité dans {p.appearances} réponses sur {p.answers}
                  </span>
                </span>
              </span>
            </li>
          );
        })}
      </Reveal>
      <figcaption className="border-t border-line/80 px-4 py-3 text-[0.8rem] text-muted">
        Réponses des IA aux requêtes produit suivies, dernière mesure. Vous savez quel produit pousser, et lequel les IA ignorent.
      </figcaption>
    </figure>
  );
}
