'use client';

/**
 * KevOMessageBody — renders a streaming Kev-O response with smooth
 * character-by-character reveal.
 *
 * Powered by streamfield's `useTextReveal` hook. The hook is
 * append-aware: when the AI SDK appends a new chunk to the streamed
 * string, the typewriter continues from its current position rather
 * than restarting from char 0 (which would make the message
 * "flutter" — chars jumping back as each token arrives).
 *
 * Strategy:
 *   - When isStreaming = true, run the raw markdown through
 *     useTextReveal so the user sees chars arrive smoothly. Render
 *     the revealed prefix via the existing markdown renderer.
 *   - When isStreaming = false (terminal message), render the full
 *     content directly. No revel needed; the content is already
 *     complete from a stored conversation.
 *
 * The brief moment of seeing partial markdown syntax during typing
 * (e.g. `[link text](url` before the closing `)` lands) is the same
 * trade-off ChatGPT and Claude.ai make. Reads as "AI is writing live."
 */

import { useTextReveal } from 'streamfield';
import { renderMessageHtml } from './kev-o-render-markdown';

type Props = {
  /** Full message content as raw markdown. Grows during streaming. */
  content: string;
  /** True while the response is being streamed; false when complete. */
  isStreaming: boolean;
};

export function KevOMessageBody({ content, isStreaming }: Props) {
  // 18ms per char ≈ 55 chars/sec. Slightly faster than streamfield's
  // 22ms default — Kev-O is a conversational AI, not a thoughtful poet,
  // and faster reveal feels more responsive.
  const revealed = useTextReveal(isStreaming ? content : '', 18);
  const displayed = isStreaming ? revealed : content;

  return (
    <div className="kevo-prose-stream">
      <div
        className="kevo-prose"
        dangerouslySetInnerHTML={{ __html: renderMessageHtml(displayed) }}
      />
      {isStreaming && revealed.length < content.length ? (
        <span
          aria-hidden
          className="kevo-cursor inline-block h-[1em] w-[2px] translate-y-[0.15em] bg-[color:var(--color-accent)]"
        />
      ) : null}
    </div>
  );
}
