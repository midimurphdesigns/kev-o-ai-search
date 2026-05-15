'use client';

import { useChat } from 'ai/react';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { KevOAvatar, type KevOState } from './KevOAvatar';
import { KEVO_GREETING } from '@/lib/kev-o-prompt';
import { renderMessageHtml } from './render-markdown';

type Props = {
  starters: string[];
};

export function KevOChat({ starters }: Props) {
  const [error, setError] = useState<string | null>(null);
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    setInput,
  } = useChat({
    api: '/api/chat',
    onError: (err) => {
      setError(err.message || 'Kev-O hit a snag. Try again in a moment.');
    },
    onResponse: () => setError(null),
  });

  const state: KevOState = error ? 'error' : isLoading ? (messages.at(-1)?.role === 'user' ? 'thinking' : 'streaming') : 'idle';

  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isLoading]);

  const submitStarter = (text: string) => {
    setInput(text);
    setTimeout(() => {
      const form = document.getElementById('kevo-form') as HTMLFormElement | null;
      form?.requestSubmit();
    }, 0);
  };

  return (
    <div className="flex flex-col gap-10">
      <div className="flex items-end gap-6">
        <KevOAvatar state={state} size={84} />
        <p className="font-display italic text-[clamp(22px,2.6vw,28px)] leading-[1.2] text-[color:var(--color-ink-muted)]">
          {KEVO_GREETING}
        </p>
      </div>

      {messages.length === 0 ? (
        <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {starters.map((s) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => submitStarter(s)}
                className="group w-full rounded-none border border-[color:var(--color-divider)] bg-transparent px-5 py-4 text-left transition-colors duration-[var(--duration-base)] hover:border-[color:var(--color-accent)]"
              >
                <span className="block text-[15px] leading-snug text-[color:var(--color-ink-muted)] group-hover:text-[color:var(--color-ink)]">
                  {s}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <ol className="flex flex-col gap-10">
          <AnimatePresence initial={false}>
            {messages.map((m) => (
              <motion.li
                key={m.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              >
                {m.role === 'user' ? (
                  <div className="border-l-2 border-[color:var(--color-divider)] pl-5">
                    <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-ink-faint)]">
                      you
                    </p>
                    <p className="mt-2 text-[17px] leading-relaxed text-[color:var(--color-ink)]">
                      {m.content}
                    </p>
                  </div>
                ) : (
                  <div className="border-l-2 border-[color:var(--color-accent)] pl-5">
                    <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-accent)]">
                      kev-o
                    </p>
                    <div
                      className="kevo-prose mt-2 text-[17px] leading-relaxed text-[color:var(--color-ink)]"
                      dangerouslySetInnerHTML={{ __html: renderMessageHtml(m.content) }}
                    />
                  </div>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
          <div ref={endRef} />
        </ol>
      )}

      {error ? (
        <p className="font-mono text-[12px] text-[color:var(--color-ink-faint)]">{error}</p>
      ) : null}

      <form id="kevo-form" onSubmit={handleSubmit} className="sticky bottom-6">
        <div className="flex items-stretch gap-3 border-t border-[color:var(--color-divider)] bg-[color:var(--color-canvas)] pt-4">
          <input
            type="text"
            value={input}
            onChange={handleInputChange}
            placeholder="Ask Kev-O anything about Kevin's work…"
            className="flex-1 bg-transparent py-3 text-[16px] text-[color:var(--color-ink)] placeholder:text-[color:var(--color-ink-faint)] focus:outline-none"
            autoComplete="off"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-5 py-3 font-mono text-[12px] uppercase tracking-[0.18em] text-[color:var(--color-ink)] transition-colors duration-[var(--duration-base)] hover:text-[color:var(--color-accent)] disabled:text-[color:var(--color-ink-faint)] disabled:hover:text-[color:var(--color-ink-faint)]"
          >
            {isLoading ? 'thinking…' : 'send →'}
          </button>
        </div>
      </form>
    </div>
  );
}
