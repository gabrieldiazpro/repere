/**
 * Schémas maison des pages publiques V4 (composants serveur). Animés à l'entrée à l'écran par <MotionRoot />
 * (data-reveal → data-in) : tracés et remplissages, puis fondus. Sans JavaScript : état final.
 * Aucune marque d'IA : les assistants sont représentés par des formes génériques.
 */
import type { CSSProperties, ReactNode } from "react";
import { Icon, type IconName } from "@/components/app/icons";
import { Counter } from "@/components/motion/Counter";
import s from "./v4.module.css";

const d = (ms: number) => ({ ["--d" as string]: `${ms}ms` }) as CSSProperties;

export type PathStep = { href?: string; icon: IconName; title: string; text: string };

/**
 * Parcours vertical « départ → étapes → arrivée » : un rail qui se trace, des étapes qui s'allument tour à tour.
 * Sert au hub des outils (robot d'IA), aux fonctionnalités (boucle) et au parrainage.
 */
export function StepPath({
  start,
  steps,
  end,
  label,
}: {
  start: { icon: IconName; text: string };
  steps: PathStep[];
  end?: ReactNode;
  label: string;
}) {
  return (
    <figure data-reveal="" className={s.path} aria-label={label}>
      <div className={s.pathStart}>
        <span className={s.pathStartIcon} aria-hidden="true">
          <Icon name={start.icon} size={18} />
        </span>
        {start.text}
      </div>
      <div className={s.pathBody}>
        <span aria-hidden="true" className={`${s.pathRail} ${s.growY}`} style={d(150)} />
        <ol className={s.pathList}>
        {steps.map((st, i) => {
          const inner = (
            <>
              <span className={`${s.pathDot} ${s.pop}`} style={d(300 + i * 260)} aria-hidden="true">
                {i + 1}
              </span>
              <span className={`${s.pathText} ${s.pop}`} style={d(380 + i * 260)}>
                <strong>{st.title}</strong>
                <span>{st.text}</span>
              </span>
              <span className={s.pathIcon} aria-hidden="true">
                <Icon name={st.icon} size={18} />
              </span>
            </>
          );
          return <li key={st.title}>{st.href ? <a href={st.href} className={s.pathItem}>{inner}</a> : <div className={s.pathItem}>{inner}</div>}</li>;
          })}
        </ol>
      </div>
      {end ? (
        <div className={`${s.pathEnd} ${s.pop}`} style={d(400 + steps.length * 260)}>
          {end}
        </div>
      ) : null}
    </figure>
  );
}

/** Bulle de réponse d'IA générique (aucun logo) : pastille ronde + texte. */
export function AiBubble({ children, who = "Réponse d’une IA" }: { children: ReactNode; who?: string }) {
  return (
    <div className={s.bubble}>
      <span className={s.bubbleAvatar} aria-hidden="true">
        <Icon name="spark" size={16} />
      </span>
      <span>
        <span className={s.bubbleWho}>{who}</span>
        <span className={s.bubbleText}>{children}</span>
      </span>
    </div>
  );
}

/** Barres verticales qui montent, avec compteur (ex. fonctions livrées par version). Données réelles uniquement. */
export function RisingBars({ items, label, unit }: { items: { label: string; value: number; note?: string }[]; label: string; unit: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <figure data-reveal="" className={s.bars}>
      <figcaption className={s.barsTitle}>{label}</figcaption>
      <ul className={s.barsList}>
        {items.map((it, i) => (
          <li key={it.label}>
            <span className={s.barsValue}>
              <Counter value={it.value} />
              <span className="sr-only"> {unit}</span>
            </span>
            <span className={s.barsTrack} aria-hidden="true">
              <span className={`${s.barsFill} ${s.growY}`} style={{ height: `${(it.value / max) * 100}%`, ...d(150 + i * 200) }} />
            </span>
            <span className={s.barsLabel}>{it.label}</span>
            {it.note ? <span className={s.barsNote}>{it.note}</span> : null}
          </li>
        ))}
      </ul>
    </figure>
  );
}
