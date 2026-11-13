/**
 * Ce qui part vers les IA, et ce qui ne part jamais (page Sécurité). Le trait « vous → IA » se trace, puis les deux
 * listes apparaissent. Contenu repris du texte de la page (section « Ce que nous envoyons aux IA »). Composant serveur.
 */
import type { CSSProperties } from "react";
import { Icon } from "@/components/app/icons";
import s from "./v4.module.css";

const d = (ms: number) => ({ ["--d" as string]: `${ms}ms` }) as CSSProperties;

export function DataFlow({ label, title, sent, never }: { label: string; title: string; sent: string[]; never: string[] }) {
  return (
    <figure data-reveal="" className={s.flow} aria-label={label}>
      <figcaption className={s.flowTitle}>{title}</figcaption>
      <div className={s.flowLane} aria-hidden="true">
        <span className={s.flowNode}>
          <Icon name="lock" size={18} />
          Votre espace
        </span>
        <svg className={s.flowLine} viewBox="0 0 100 12" preserveAspectRatio="none">
          <path d="M2 6 H94" pathLength={1} className={s.draw} style={d(150)} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          <path d="M89 2 L96 6 L89 10" pathLength={1} className={s.draw} style={d(900)} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
        <span className={s.flowNode}>
          <Icon name="spark" size={18} />
          Une IA
        </span>
      </div>
      <div className={s.flowCols}>
        <div>
          <p className={s.flowHead}>Ce qui part</p>
          <ul className={s.flowList}>
            {sent.map((t, i) => (
              <li key={t} className={s.pop} style={d(500 + i * 120)}>
                <span className={s.flowOk} aria-hidden="true">
                  <Icon name="check" size={14} />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className={s.flowHead}>Ne part jamais</p>
          <ul className={s.flowList}>
            {never.map((t, i) => (
              <li key={t} className={s.pop} style={d(500 + (sent.length + i) * 120)}>
                <span className={s.flowNo} aria-hidden="true">
                  <Icon name="close" size={14} />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </figure>
  );
}

export default DataFlow;
