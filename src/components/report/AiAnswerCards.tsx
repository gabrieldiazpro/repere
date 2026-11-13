'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './report.module.css';
import { Highlighted } from './Highlighted';
import { PROVIDER_META, segmentText, type Showcase } from './derive';

type Phase = 'idle' | 'thinking' | 'typing' | 'done';

function AnswerCard({ s, businessName, date }: { s: Showcase; businessName: string; date: string }) {
  const meta = PROVIDER_META[s.provider];
  const segments = useMemo(() => segmentText(s.excerpt, s.competitors, businessName), [s.excerpt, s.competitors, businessName]);
  const fullSegments = useMemo(() => segmentText(s.full, s.competitors, businessName), [s.full, s.competitors, businessName]);
  const total = s.excerpt.length;
  const ref = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>('done');
  const [shown, setShown] = useState(total);
  const [verdictVisible, setVerdictVisible] = useState(true);

  useEffect(() => {
    const el = ref.current;
    // Mouvement réduit : le texte qui s'écrit reste (pas de déplacement), règle V4.
    if (!el || typeof IntersectionObserver === 'undefined') return;
    setPhase('idle');
    setShown(0);
    setVerdictVisible(false);
    const timers: number[] = [];
    let raf = 0;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        setPhase('thinking');
        timers.push(
          window.setTimeout(() => {
            setPhase('typing');
            const perChar = Math.min(30, 1500 / Math.max(1, total));
            const t0 = performance.now();
            const tick = (t: number) => {
              const n = Math.min(total, Math.floor((t - t0) / perChar));
              setShown(n);
              if (n < total) raf = requestAnimationFrame(tick);
              else {
                setPhase('done');
                timers.push(window.setTimeout(() => setVerdictVisible(true), 1000));
              }
            };
            raf = requestAnimationFrame(tick);
          }, 800),
        );
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      timers.forEach((t) => clearTimeout(t));
      cancelAnimationFrame(raf);
    };
  }, [total]);

  const skip = () => {
    setPhase('done');
    setShown(total);
    setVerdictVisible(true);
  };

  return (
    <article className={styles.chat} ref={ref} aria-label={`Réponse de ${meta.label}`}>
      <div className={styles.chatTop}>
        <span className={styles.caption}>Question d&apos;un client</span>
        {s.demo && <span className={`${styles.badge} ${styles.badgeDemo}`}>Exemple simulé</span>}
      </div>
      <p className={styles.q}>{s.query}</p>
      <div className={styles.a}>
        <div className={styles.aHead}>
          <span className={styles.pDot} style={{ background: meta.color }} aria-hidden="true">
            {meta.short}
          </span>
          {meta.label}
          {(phase === 'thinking' || phase === 'typing') && (
            <button type="button" className={styles.skip} onClick={skip} style={{ marginLeft: 'auto' }}>
              Passer
            </button>
          )}
        </div>
        {phase === 'idle' && <span className={styles.thinking}>&nbsp;</span>}
        {phase === 'thinking' && <span className={styles.thinking}>{meta.label} réfléchit…</span>}
        {(phase === 'typing' || phase === 'done') && (
          <p>
            <Highlighted segments={segments} limit={phase === 'typing' ? shown : undefined} />
            {phase === 'typing' && <span className={styles.caret} aria-hidden="true" />}
          </p>
        )}
        {/* Texte complet toujours disponible pour les lecteurs d'écran */}
        {phase !== 'done' && <span className={styles.srOnly}>{s.excerpt}</span>}
      </div>
      <div style={{ minHeight: 24, opacity: verdictVisible ? 1 : 0, transition: 'opacity .4s' }} aria-live="polite">
        {verdictVisible &&
          (s.mentioned ? (
            <p className={styles.present}>
              <span aria-hidden="true">✓</span> {businessName} est cité dans cette réponse.
            </p>
          ) : (
            <p className={styles.missing}>
              <span aria-hidden="true">✗</span> {businessName} n&apos;apparaît nulle part dans cette réponse.
            </p>
          ))}
      </div>
      <p className={styles.caption}>
        {s.demo ? `Exemple simulé de ${meta.label}` : `Réponse réelle de ${meta.label}`}, obtenue le {date} à la question : « {s.query} »
      </p>
      {s.full && s.full.replace(/\s+/g, ' ').trim().length > s.excerpt.replace(/…/g, '').trim().length + 5 && (
        <details className={styles.details}>
          <summary>Voir la réponse complète</summary>
          <div className={styles.fullAnswer}>
            <Highlighted segments={fullSegments} />
          </div>
        </details>
      )}
    </article>
  );
}

export function AiAnswerCards({ items, businessName, date }: { items: Showcase[]; businessName: string; date: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const onScroll = () => {
      const w = el.clientWidth || 1;
      setActive(Math.round(el.scrollLeft / w));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const go = (i: number) => {
    const el = track.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  };

  return (
    <div>
      <div className={styles.carousel} ref={track} role="region" aria-roledescription="carrousel" aria-label="Exemples de réponses des IA">
        {items.map((s, i) => (
          <div className={styles.slide} key={`${s.provider}-${i}`} aria-label={`Exemple ${i + 1} sur ${items.length}`}>
            <AnswerCard s={s} businessName={businessName} date={date} />
          </div>
        ))}
      </div>
      {items.length > 1 && (
        <div className={styles.dots}>
          {items.map((_, i) => (
            <button
              key={i}
              type="button"
              className={`${styles.dot} ${i === active ? styles.dotActive : ''}`}
              aria-label={`Voir l'exemple ${i + 1}`}
              aria-current={i === active}
              onClick={() => go(i)}
            />
          ))}
          <button type="button" className={styles.nextBtn} onClick={() => go((active + 1) % items.length)}>
            {active + 1 < items.length ? "Voir l'exemple suivant →" : '← Revenir au premier'}
          </button>
        </div>
      )}
    </div>
  );
}
