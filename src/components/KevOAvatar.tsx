'use client';

/**
 * Kev-O avatar. Minimal italic K + cyan playhead-tick rail beneath it.
 * The rail is the same 14×2px primitive as the main-site cursor — Kev-O
 * is literally the cursor given a personality.
 *
 * States:
 *   idle      — gentle 4s breathing on the rail
 *   thinking  — rail pulses cyan at 600ms intervals
 *   streaming — rail sweeps left-to-right continuously
 *   error     — rail goes dim, ink-faint
 *
 * Per ADR-027: no prefers-reduced-motion handling anywhere. Motion is
 * the proof artifact.
 */

import { motion, type Variants } from 'framer-motion';

export type KevOState = 'idle' | 'thinking' | 'streaming' | 'error';

const railVariants: Variants = {
  idle: {
    opacity: [0.6, 1, 0.6],
    transition: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
  },
  thinking: {
    opacity: [0.3, 1, 0.3],
    transition: { duration: 0.6, repeat: Infinity, ease: 'easeInOut' },
  },
  streaming: {
    x: ['-50%', '50%', '-50%'],
    opacity: 1,
    transition: { duration: 1.2, repeat: Infinity, ease: 'easeInOut' },
  },
  error: {
    opacity: 0.25,
    transition: { duration: 0.3 },
  },
};

const kVariants: Variants = {
  idle: { letterSpacing: '-0.04em' },
  thinking: {
    letterSpacing: ['-0.04em', '-0.02em', '-0.04em'],
    transition: { duration: 1.2, repeat: Infinity, ease: 'easeInOut' },
  },
  streaming: { letterSpacing: '-0.02em' },
  error: { letterSpacing: '-0.04em' },
};

export function KevOAvatar({ state = 'idle', size = 96 }: { state?: KevOState; size?: number }) {
  return (
    <div
      className="relative inline-flex items-end justify-center"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <motion.span
        className="block font-display italic leading-none"
        style={{
          fontSize: size * 0.95,
          color: state === 'error' ? 'var(--color-ink-faint)' : 'var(--color-ink)',
          fontWeight: 400,
        }}
        variants={kVariants}
        animate={state}
      >
        K
      </motion.span>
      <motion.span
        className="absolute"
        style={{
          left: '50%',
          bottom: -6,
          width: 14,
          height: 2,
          background: 'var(--color-accent)',
          translateX: '-50%',
        }}
        variants={railVariants}
        animate={state}
      />
    </div>
  );
}
