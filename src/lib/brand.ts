/**
 * Brand-level constants for Kev-O. Single source of truth for any string
 * or URL that crosses into UI. Mirror updates from main site here.
 */
export const SITE = {
  name: 'Kev-O',
  tagline: 'Ask me anything about Kevin Murphy.',
  mainSite: 'https://kevinmurphywebdev.com',
  url: 'https://kev-o.kevinmurphywebdev.com',
} as const;

/** Daily USD cap for total LLM spend. Override via env. */
export const DAILY_USD_CAP = Number(process.env.KEV_O_DAILY_USD_CAP ?? '5');

/** Pricing for claude-sonnet-4-6 (per 1M tokens). Used for live spend tracking.
 * Keep in sync with https://docs.anthropic.com/en/docs/about-claude/models. */
export const SONNET_PRICING = {
  inputPerMTok: 3.0,
  outputPerMTok: 15.0,
  /** Reads against the prompt cache. */
  cacheReadPerMTok: 0.3,
  cacheWritePerMTok: 3.75,
} as const;
