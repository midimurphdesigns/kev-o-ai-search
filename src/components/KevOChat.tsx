'use client';

/**
 * Subdomain Kev-O chat surface.
 *
 * The brain lives at kevinmurphywebdev.com/api/kev-o; this app proxies via
 * /api/chat so we don't pay the cross-origin cost from the browser. UI
 * components are copied from the main site (rhombus avatar, streamfield
 * reveal, brand-safe error parser) so the two surfaces stay visually
 * identical. See ../../blog-portfolio-v3/src/components/KevOChat.tsx for
 * the richer variant; this one is intentionally trimmed (no pageContext,
 * no compact mode, no auto-submit) because the subdomain is a single
 * full-page conversation.
 */

import { useChat } from 'ai/react';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { KevOPortrait } from './KevOPortrait';
import { KevOMessageBody } from './KevOMessageBody';
import type { KevOState } from './KevOAvatar';
import { parseKevOError } from '@/lib/kev-o-error';

const KEVO_GREETING =
  "Alright, I'm Kev-O. I know everything Kevin has put on the public record. Ask me anything.";

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
    onError: (err) => setError(parseKevOError(err)),
    onResponse: () => setError(null),
  });

  const state: KevOState = error
    ? 'error'
    : isLoading
      ? messages.at(-1)?.role === 'user'
        ? 'thinking'
        : 'streaming'
      : 'idle';

  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isLoading]);

  const submitStarter = (text: string): void => {
    setInput(text);
    setTimeout(() => {
      const form = document.getElementById('kevo-form') as HTMLFormElement | null;
      form?.requestSubmit();
    }, 0);
  };

  return (
    <div className="flex flex-col gap-10">
      {/* Avatar + greeting row. gap-9 (md:gap-12) gives the rhombus
        * enough breathing room from the italic display text — the
        * rhombus extends past its container visually and a tighter
        * gap was making them feel collided. Flex-col on the avatar
        * stack so an "offline" caption can sit beneath when state=error
        * without disrupting the row baseline. */}
      <div className="flex items-end gap-9 md:gap-12">
        <div className="flex flex-col items-center gap-2 shrink-0">
          <KevOPortrait state={state} size={84} />
          {state === 'error' ? (
            <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-[color:var(--color-ink-faint)]">
              offline
            </span>
          ) : null}
        </div>
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
            {messages.map((m, i) => {
              const isLastAssistant =
                i === messages.length - 1 && m.role === 'assistant';
              const isStreamingNow = isLastAssistant && isLoading;
              return (
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
                      <div className="mt-2 text-[17px] leading-relaxed text-[color:var(--color-ink)]">
                        <KevOMessageBody content={m.content} isStreaming={isStreamingNow} />
                      </div>
                    </div>
                  )}
                </motion.li>
              );
            })}
          </AnimatePresence>
          <div ref={endRef} />
        </ol>
      )}

      {error ? (
        <div
          role="status"
          aria-live="polite"
          className="border-l-2 border-[color:var(--color-accent)] pl-5"
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-accent)]">
            kev-o
          </p>
          <p className="mt-2 text-[16px] leading-relaxed text-[color:var(--color-ink)]">
            {error}
          </p>
          <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-ink-faint)]">
            <a
              href="https://kevinmurphywebdev.com/contact"
              className="border-b border-[color:var(--color-divider)] transition-colors duration-[var(--duration-base)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)]"
            >
              email Kevin directly →
            </a>
          </p>
        </div>
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
