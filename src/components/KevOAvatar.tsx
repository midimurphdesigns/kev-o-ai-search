'use client';

/**
 * Kev-O avatar — animated cyan rhombus.
 *
 * Riffs off the existing cursor primitive (the playhead-tick) and the
 * rhombus that already appears on magnetic hover. Two nested rhombi
 * (outer outline + inner filled diamond) at the same 45deg tilt,
 * counter-rotating slightly so the silhouette reads as alive.
 *
 * Why this shape works:
 *   - Already a brand object — the rhombus + playhead-tick are the
 *     cursor's signature. Kev-O carrying the same geometry reads as
 *     "this entity is part of the cursor's family."
 *   - Sharp angles + cyan = computational, restrained, distinctive.
 *     No anthropomorphism, no skeuomorphism.
 *   - Five states map cleanly to: rotation speed, stroke weight,
 *     opacity, scale.
 *   - Pure CSS animation. GPU-accelerated. Scales 24px → 120px
 *     without any per-size logic.
 *
 * States:
 *   idle       — outer slowly rotates; inner pulses gently. Wink
 *                every ~14s (jittered).
 *   focus      — both layers brighten + scale up 8%
 *   thinking   — outer spins 4x faster, inner pulses at 600ms
 *   streaming  — outer flattens (scaleY shrink), inner becomes a
 *                cyan sweep that scrolls L→R
 *   error      — rotation stops, color drops to ink-faint
 *
 * Per ADR-027 no prefers-reduced-motion gate.
 */

import { useEffect, useRef, useState } from 'react';

export type KevOState = 'idle' | 'focus' | 'thinking' | 'streaming' | 'error';

type Props = {
  state?: KevOState;
  size?: number;
  /** Disable the idle pulse (e.g. when decorative). */
  noFlicker?: boolean;
};

export function KevOAvatar({ state = 'idle', size = 96, noFlicker = false }: Props) {
  const [pulse, setPulse] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Idle wink — schedule a brightness pulse every ~14s (jittered).
  useEffect(() => {
    if (noFlicker || state !== 'idle') return;
    let stopped = false;
    const schedule = (): void => {
      const ms = 11_000 + Math.random() * 6_000;
      window.setTimeout(() => {
        if (stopped) return;
        setPulse(true);
        window.setTimeout(() => setPulse(false), 240);
        schedule();
      }, ms);
    };
    schedule();
    return () => {
      stopped = true;
    };
  }, [noFlicker, state]);

  // Cursor-reactivity — when the mouse moves inside a reasonable
  // radius around the avatar, tilt the outer rhombus toward the
  // cursor. Reads as "this thing notices you." rAF-throttled so we
  // never queue more than one frame's worth of work per tick.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let raf = 0;
    let nextX = 0;
    let nextY = 0;
    const REACH = 240; // px radius of influence
    const MAX_TILT = 12; // degrees

    const onMove = (e: MouseEvent): void => {
      const rect = root.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > REACH) {
        nextX = 0;
        nextY = 0;
      } else {
        const falloff = 1 - dist / REACH;
        // Pitch tilt around X-axis (visual: leaning toward/away
        // vertically); roll tilt around Y-axis (leaning L/R).
        nextX = (dy / REACH) * MAX_TILT * falloff;
        nextY = (-dx / REACH) * MAX_TILT * falloff;
      }
      if (!raf) {
        raf = requestAnimationFrame(() => {
          raf = 0;
          root.style.setProperty('--kevo-tilt-x', `${nextX.toFixed(2)}deg`);
          root.style.setProperty('--kevo-tilt-y', `${nextY.toFixed(2)}deg`);
        });
      }
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      if (raf) cancelAnimationFrame(raf);
      root.style.setProperty('--kevo-tilt-x', '0deg');
      root.style.setProperty('--kevo-tilt-y', '0deg');
    };
  }, []);

  // Stroke thickness scales with avatar size. 56px → ~1.5px; 120px → ~3px.
  const stroke = Math.max(1, Math.round(size * 0.025));
  // The rhombus is a rotated square. Inscribed in our container at
  // 70.7% (= 1/√2) it fits perfectly when rotated 45deg.
  const rhombusSize = Math.round(size * 0.707);
  const innerSize = Math.round(size * 0.32);

  return (
    <div
      ref={rootRef}
      className="kevo-avatar relative inline-flex items-center justify-center"
      style={
        {
          width: size,
          height: size,
          ['--kevo-pulse' as string]: pulse ? '1' : '0',
        } as React.CSSProperties
      }
      data-state={state}
      aria-hidden
    >
      {/* Outer rotation wrapper — owns the continuous rotation +
        * beat animations. The rhombus itself inside is plain; scale
        * is applied to its inline-style, so rotation (on wrapper) and
        * scale (on inner) never interfere. */}
      <span
        className="kevo-spin kevo-spin--outer absolute"
        style={{ width: rhombusSize, height: rhombusSize }}
        aria-hidden
      >
        <span
          className="kevo-rhombus kevo-rhombus--outer block"
          style={{ width: '100%', height: '100%', borderWidth: stroke }}
        />
        {/* Trail ripple — emanates outward on each beat, sits inside
          * the rotation wrapper so it spins with the outer rhombus. */}
        <span
          className="kevo-trail block absolute inset-0"
          style={{ borderWidth: 1 }}
          aria-hidden
        />
        {/* Scanning sweep — a thin gradient stripe that crosses the
          * outer stroke at a rare interval. Inside the wrapper so it
          * shares the rotation. */}
        <span className="kevo-scan block absolute inset-0" aria-hidden />
      </span>

      {/* Inner rotation wrapper — counter-rotates independently */}
      <span
        className="kevo-spin kevo-spin--inner absolute"
        style={{ width: innerSize, height: innerSize }}
        aria-hidden
      >
        <span
          className="kevo-rhombus kevo-rhombus--inner block"
          style={{ width: '100%', height: '100%' }}
        />
      </span>
    </div>
  );
}
