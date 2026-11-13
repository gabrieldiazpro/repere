'use client';

import { useEffect, useState } from 'react';
import styles from './report.module.css';
import { EFFORT_LABEL, IMPACT_LABEL } from './derive';
import type { ActionItem } from '@/lib/engine/types';
import { fr } from '@/components/ui/typo';

const KEY = (auditId: string) => `repere:actions:${auditId}`;

export function FreeActions({ auditId, actions, reviewMessage }: { auditId: string; actions: ActionItem[]; reviewMessage: string }) {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY(auditId));
      if (raw) setDone(JSON.parse(raw));
    } catch {
      /* stockage indisponible : on reste sans mémoire */
    }
  }, [auditId]);

  const toggle = (id: string, v: boolean) => {
    const next = { ...done, [id]: v };
    setDone(next);
    try {
      localStorage.setItem(KEY(auditId), JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reviewMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  const doneCount = actions.filter((a) => done[a.id]).length;

  return (
    <div>
      <ol className={styles.actions} style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {actions.map((a, i) => {
          const isReview = /avis/i.test(a.title) || /review/i.test(a.id);
          return (
            <li key={a.id} className={`${styles.action} ${done[a.id] ? styles.actionDone : ''}`}>
              <div className={styles.actionHead}>
                <span className={styles.actionNum} aria-hidden="true">
                  {done[a.id] ? '✓' : i + 1}
                </span>
                <h3>{fr(a.title)}</h3>
              </div>
              <div className={styles.actionBadges}>
                <span className={`${styles.badge} ${styles.badgePrimary}`}>{EFFORT_LABEL[a.effort] ?? a.effort}</span>
                <span className={`${styles.badge} ${styles.badgeSuccess}`}>Gratuit</span>
                <span className={`${styles.badge} ${styles.badgeMuted}`}>{IMPACT_LABEL[a.impact] ?? ''}</span>
              </div>
              <p className={styles.actionWhy}>
                <strong>Pourquoi :</strong> {a.why}
              </p>
              <div>
                <strong style={{ fontSize: 15 }}>Comment faire :</strong>
                <ul className={styles.actionHow}>
                  {a.how.slice(0, 4).map((h, k) => (
                    <li key={k}>{h}</li>
                  ))}
                </ul>
              </div>
              {isReview && (
                <div style={{ display: 'grid', gap: 8 }}>
                  <p className={styles.msgBox}>{reviewMessage}</p>
                  <button type="button" className={`${styles.btn} ${styles.btnSecondary} ${styles.btnBlock}`} onClick={copy}>
                    {copied ? 'Message copié ✓' : 'Copier le message d’avis'}
                  </button>
                </div>
              )}
              <div className={styles.actionFoot}>
                <label className={styles.check}>
                  <input type="checkbox" checked={!!done[a.id]} onChange={(e) => toggle(a.id, e.target.checked)} />
                  Je l&apos;ai fait
                </label>
              </div>
            </li>
          );
        })}
      </ol>
      <p className={styles.caption} style={{ marginTop: 12 }} aria-live="polite">
        {doneCount === 0
          ? 'Cochez les actions au fur et à mesure : votre progression reste sur cet appareil.'
          : doneCount === actions.length
            ? 'Bravo, les 3 premières actions sont faites. Un nouvel audit dans 2 à 4 semaines montrera l’effet.'
            : `${doneCount} action${doneCount > 1 ? 's' : ''} sur ${actions.length} faite${doneCount > 1 ? 's' : ''}.`}
      </p>
    </div>
  );
}
