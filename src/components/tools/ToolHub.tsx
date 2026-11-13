'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Tabs } from '@/components/ui/Tabs';
import { Icon } from '@/components/app/icons';
import { HUB_GROUPS, TOOL_ICON } from './hub';
import { PARCOURS_LABEL, type Parcours } from './registry';
import s from '@/components/pages/v4/v4.module.css';

export interface HubItem {
  slug: string;
  href: string;
  name: string;
  h1: string;
  output: string;
  parcours: Parcours[];
}

const FILTERS: (Parcours | 'tous')[] = ['tous', 'local', 'pme', 'ecommerce'];

/** Outils rangés en 3 étapes, filtrables par activité (sans JavaScript, tout est visible). */
export function ToolHub({ items }: { items: HubItem[] }) {
  const [f, setF] = useState<Parcours | 'tous'>('tous');
  const keep = (i: HubItem) => f === 'tous' || i.parcours.includes(f);
  const bySlug = new Map(items.map((i) => [i.slug, i]));
  const grouped = new Set(HUB_GROUPS.flatMap((g) => g.slugs));
  const groups = HUB_GROUPS.map((g) => ({ ...g, list: g.slugs.map((x) => bySlug.get(x)).filter((x): x is HubItem => !!x) }));
  // Un outil ajouté au catalogue sans groupe reste affiché (dernier groupe).
  const orphans = items.filter((i) => !grouped.has(i.slug));
  if (orphans.length) groups[groups.length - 1].list.push(...orphans);
  const shownCount = items.filter(keep).length;

  return (
    <div>
      <Tabs
        label="Filtrer par activité"
        variant="pill"
        idBase="outils"
        value={f}
        onChange={(v) => setF(v as Parcours | 'tous')}
        items={FILTERS.map((k) => ({
          id: k,
          label: k === 'tous' ? 'Tous' : PARCOURS_LABEL[k],
          count: k === 'tous' ? items.length : items.filter((i) => i.parcours.includes(k)).length,
        }))}
      />
      <p className="sr-only" aria-live="polite">
        {shownCount} outils affichés.
      </p>
      <div role="tabpanel" id="outils-panel" aria-labelledby={`outils-${f}`} className="ui-tabpanel mt-10 grid gap-14" key={f}>
        {groups.map((g, gi) => {
          const list = g.list.filter(keep);
          if (!list.length) return null;
          return (
            <section key={g.id} id={g.id} aria-labelledby={`${g.id}-t`} className={s.group}>
              <div className={s.groupHead}>
                <span className={s.groupStep} aria-hidden="true">
                  {gi + 1}
                </span>
                <h2 id={`${g.id}-t`} className="font-display text-[1.5rem] font-bold leading-tight sm:text-[1.8rem]">
                  {g.title}
                </h2>
              </div>
              <p className="mt-2 text-muted sm:pl-[42px]">{g.text}</p>
              <div className="mt-6">
              <ul className={`${s.cardGrid} ui-cascade`} data-cols="3">
                {list.map((t) => (
                  <li key={t.slug}>
                    <article className={s.card}>
                      <div className="flex items-center justify-between gap-3">
                        <span className={s.cardIcon} aria-hidden="true">
                          <Icon name={TOOL_ICON[t.slug] ?? 'check'} size={22} />
                        </span>
                        {t.slug === 'pret-pour-les-ia' ? (
                          <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[0.8rem] font-semibold text-warning-ink">Commencez ici</span>
                        ) : null}
                      </div>
                      <h3 className={s.cardTitle}>
                        <Link href={t.href}>{t.name}</Link>
                      </h3>
                      <p className={s.cardText}>{t.h1}</p>
                      <p className={s.cardMeta}>Vous obtenez : {t.output}.</p>
                    </article>
                  </li>
                ))}
              </ul>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
