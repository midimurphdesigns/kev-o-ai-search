'use client';

/**
 * KevOPortrait — Kev-O's visual identity, current state: italic K +
 * cyan rail fallback.
 *
 * History:
 *   v1: italic K + cyan rail (delegated to KevOAvatar) — this version
 *   v2: image-asset with K-avatar fallback (parked, not shipped)
 *   v3: code-driven SVG data-trace (reverted — landed as a squiggle)
 *
 * Plan: replace this fallback with a Rive state-machine animation
 * once the .riv asset is designed. See docs/KEV_O_RIVE_BRIEF.md for
 * the full design contract — five states (idle / focus / thinking /
 * streaming / error), brand palette only, integration shape preserved.
 *
 * For now: just forward to KevOAvatar so every consumer keeps working
 * with the italic-K-plus-rail brand primitive. Same {state, size,
 * noFlicker} prop contract preserved, so the Rive integration will
 * be a one-line replacement of this delegate.
 */

import { KevOAvatar, type KevOState } from './KevOAvatar';

type Props = {
  state?: KevOState;
  size?: number;
  /** Disable the idle-flicker wink (e.g. when decorative). */
  noFlicker?: boolean;
};

export function KevOPortrait({ state = 'idle', size = 96, noFlicker = false }: Props) {
  return <KevOAvatar state={state} size={size} noFlicker={noFlicker} />;
}
