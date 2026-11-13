"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Token = { kind: "text"; v: string } | { kind: "name"; v: string; rank: number } | { kind: "br" };

/** Réponse affichée : une vraie réponse du compte démo où l'entreprise n'est pas citée (demo-figures.ts, côté serveur). */
export type ChatAnswer = {
  business: string;
  ia: string;
  question: string;
  intro: string;
  items: { name: string; note: string }[];
  outro: string;
};

function tokensOf(c: ChatAnswer): Token[] {
  const out: Token[] = [{ kind: "text", v: c.intro }];
  c.items.forEach((it, i) => {
    out.push({ kind: "br" }, { kind: "name", v: it.name, rank: i + 1 }, { kind: "text", v: ` : ${it.note}` });
  });
  if (c.outro) out.push({ kind: "br" }, { kind: "text", v: c.outro });
  return out;
}

const len = (t: Token) => (t.kind === "br" ? 1 : t.v.length);

type Phase = "idle" | "question" | "thinking" | "answer" | "pause" | "done";

/** Conversation du compte démo (entreprise fictive) : l'entreprise absente de la réponse. `dark` : boutons pour fond sombre. */
export function ChatScene({ chat, dark = false }: { chat: ChatAnswer; dark?: boolean }) {
  const QUESTION = chat.question;
  const BUSINESS = chat.business;
  const ANSWER = tokensOf(chat);
  const ANSWER_LEN = ANSWER.reduce((n, t) => n + len(t), 0);
  const [phase, setPhase] = useState<Phase>("done");
  const [q, setQ] = useState(QUESTION.length);
  const [a, setA] = useState(ANSWER_LEN);
  const root = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);

  const clear = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };

  const play = useCallback(() => {
    clear();
    setQ(0);
    setA(0);
    setPhase("question");
  }, [QUESTION.length, ANSWER_LEN]);

  // Prépare l'état initial (masqué) puis lance la scène quand elle entre à l'écran.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined" || !root.current) return;
    setQ(0);
    setA(0);
    setPhase("idle");
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          play();
        }
      },
      { threshold: 0.45 },
    );
    io.observe(root.current);
    return () => {
      io.disconnect();
      clear();
    };
  }, [play]);

  // Machine à écrire.
  useEffect(() => {
    clear();
    if (phase === "question") {
      if (q < QUESTION.length) timer.current = window.setTimeout(() => setQ(q + 1), 38);
      else timer.current = window.setTimeout(() => setPhase("thinking"), 350);
    } else if (phase === "thinking") {
      timer.current = window.setTimeout(() => setPhase("answer"), 1100);
    } else if (phase === "answer") {
      if (a < ANSWER_LEN) timer.current = window.setTimeout(() => setA(Math.min(ANSWER_LEN, a + 2)), 22);
      else timer.current = window.setTimeout(() => setPhase("pause"), 50);
    } else if (phase === "pause") {
      timer.current = window.setTimeout(() => setPhase("done"), 1000);
    }
    return clear;
  }, [phase, q, a, QUESTION.length, ANSWER_LEN]);

  const skip = () => {
    clear();
    setQ(QUESTION.length);
    setA(ANSWER_LEN);
    setPhase("done");
  };

  const showAnswer = phase === "answer" || phase === "pause" || phase === "done";
  const busy = phase === "question" || phase === "thinking" || phase === "answer" || phase === "pause";

  // Rendu progressif de la réponse.
  let budget = a;
  const rendered = ANSWER.map((t, i) => {
    if (budget <= 0) return null;
    const n = Math.min(budget, len(t));
    budget -= n;
    if (t.kind === "br") return <br key={i} />;
    if (t.kind === "text") return <span key={i}>{t.v.slice(0, n)}</span>;
    const complete = n === t.v.length;
    return (
      <span key={i} className="whitespace-normal">
        <mark
          className="rounded-md px-1 py-0.5 font-semibold text-ink transition-colors duration-500"
          style={{ background: complete ? "#F5A524" : "#FDE7BE", boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }}
        >
          {t.v.slice(0, n)}
        </mark>
        {complete ? (
          <span className="ml-1 inline-flex h-5 min-w-5 -translate-y-px items-center justify-center rounded-full bg-ink px-1 align-middle text-[0.7rem] font-bold text-white tabular">
            n°{t.rank}
          </span>
        ) : null}
      </span>
    );
  });

  return (
    <div ref={root} className="relative">
      {/* Transcription accessible, toujours complète */}
      <div className="sr-only">
        <p>Compte démo {BUSINESS} (entreprise fictive) : une réponse de {chat.ia} à une question suivie.</p>
        <p>Question du client : {QUESTION}</p>
        <p>
          Réponse de {chat.ia} : {chat.intro} {chat.items.map((it, i) => `${i + 1}, ${it.name}, ${it.note}`).join(" ")} {chat.outro}
        </p>
        <p>{BUSINESS} n&apos;apparaît pas dans la réponse.</p>
      </div>

      <div aria-hidden="true" className="overflow-hidden rounded-[1.5rem] bg-white text-ink shadow-[0_0_0_1px_rgba(27,31,46,.08),0_24px_48px_-24px_rgba(30,26,92,.28)]">
        {/* Barre de fenêtre */}
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-white">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
              </svg>
            </span>
            <span className="text-[0.95rem] font-semibold">{chat.ia}</span>
          </div>
          <span className="rounded-full bg-canvas px-2.5 py-0.5 text-xs font-semibold text-muted ring-1 ring-inset ring-line">
            Compte démo
          </span>
        </div>

        <div className="space-y-4 px-4 py-5 sm:px-6 sm:py-6 min-h-[25rem] sm:min-h-[23rem]">
          {/* Question du client */}
          <div className="flex justify-end">
            <p className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-[0.98rem] font-medium text-white">
              {QUESTION.slice(0, q)}
              {phase === "question" ? <span className="ml-0.5 inline-block h-[1.1em] w-[2px] translate-y-[3px] bg-white animate-blink" /> : null}
              {phase === "idle" ? <span className="opacity-0">.</span> : null}
            </p>
          </div>

          {/* Réflexion */}
          {phase === "thinking" ? (
            <div className="flex items-center gap-2 text-sm text-muted">
              <span className="flex gap-1">
                <span className="h-2 w-2 rounded-full bg-muted animate-dot" />
                <span className="h-2 w-2 rounded-full bg-muted animate-dot [animation-delay:.15s]" />
                <span className="h-2 w-2 rounded-full bg-muted animate-dot [animation-delay:.3s]" />
              </span>
              L&apos;assistant réfléchit…
            </div>
          ) : null}

          {/* Réponse */}
          {showAnswer ? (
            <div className="max-w-[95%] rounded-2xl rounded-bl-md bg-canvas px-4 py-3 text-[0.98rem] leading-[1.85]">{rendered}</div>
          ) : null}

          {/* Verdict */}
          <div
            className={`flex items-start gap-2.5 rounded-xl border border-danger/25 bg-danger-bg px-4 py-3 text-[0.95rem] font-semibold text-danger-ink transition-all duration-500 ${
              phase === "done" ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-1 opacity-0"
            }`}
          >
            <svg viewBox="0 0 20 20" width="20" height="20" className="mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="10" cy="10" r="8" />
              <path d="M7 7l6 6M13 7l-6 6" />
            </svg>
            <span>{BUSINESS} n&apos;apparaît nulle part dans cette réponse.</span>
          </div>
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        {busy ? (
          <button type="button" onClick={skip} className={`min-h-11 rounded-lg px-3 text-sm font-semibold underline underline-offset-4 ${dark ? "text-on-deep hover:text-white" : "text-muted hover:text-ink"}`}>
            Passer l&apos;animation
          </button>
        ) : (
          <button type="button" onClick={play} className={`min-h-11 rounded-lg px-3 text-sm font-semibold underline underline-offset-4 ${dark ? "text-on-deep hover:text-white" : "text-muted hover:text-ink"}`}>
            Rejouer la conversation
          </button>
        )}
      </div>
    </div>
  );
}

export default ChatScene;
