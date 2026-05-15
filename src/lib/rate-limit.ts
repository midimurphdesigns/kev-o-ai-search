/**
 * Rate limiting + USD spend cap for Kev-O.
 *
 * Ported from tablesalt's three-layer model and extended with a daily
 * USD cap (instead of just request count) because Anthropic + Voyage
 * costs vary per request — a single long-conversation turn can cost more
 * than ten short ones. Budget cap is the real safeguard.
 *
 *   1. Per-IP sliding window — 15 req/hour
 *   2. Daily global USD cap — KEV_O_DAILY_USD_CAP (default $5/day UTC)
 *   3. Owner bypass — ?admin=$KEV_O_ADMIN_KEY drops a 30-day cookie
 *
 * Fails open if Upstash env vars are absent (local dev).
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { DAILY_USD_CAP } from './brand';

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

const perIpLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(15, '1 h'),
      analytics: true,
      prefix: 'kevo:ip',
    })
  : null;

export type LimitResult =
  | { ok: true }
  | {
      ok: false;
      reason: 'per-ip' | 'daily-usd-cap';
      retryAfterSeconds: number;
      message: string;
    };

function utcDayKey(now: Date = new Date()): string {
  return `kevo:usd:${now.toISOString().slice(0, 10)}`;
}

function secondsUntilUtcMidnight(now: Date = new Date()): number {
  const next = new Date(now);
  next.setUTCHours(24, 0, 0, 0);
  return Math.max(1, Math.ceil((next.getTime() - now.getTime()) / 1000));
}

/**
 * Pre-flight check before serving a request. Counts the request against
 * the per-IP window but does NOT yet bill the USD cap — that happens after
 * the response is streamed (see chargeUsd).
 */
export async function checkLimits(ip: string): Promise<LimitResult> {
  if (!redis || !perIpLimiter) return { ok: true };

  const ipResult = await perIpLimiter.limit(ip);
  if (!ipResult.success) {
    const retry = Math.max(1, Math.ceil((ipResult.reset - Date.now()) / 1000));
    return {
      ok: false,
      reason: 'per-ip',
      retryAfterSeconds: retry,
      message: 'Slow down, mate. Try again in a few minutes.',
    };
  }

  const dayKey = utcDayKey();
  const spent = Number((await redis.get(dayKey)) ?? 0);
  if (spent >= DAILY_USD_CAP) {
    return {
      ok: false,
      reason: 'daily-usd-cap',
      retryAfterSeconds: secondsUntilUtcMidnight(),
      message: `Kev-O is napping until tomorrow — daily budget hit. Try again in ${formatRetry(secondsUntilUtcMidnight())}.`,
    };
  }
  return { ok: true };
}

/**
 * Charge usage against the daily USD cap. Call AFTER the response stream
 * closes, with the actual token counts reported by the model.
 */
export async function chargeUsd(usd: number): Promise<void> {
  if (!redis || usd <= 0) return;
  const key = utcDayKey();
  const cents = Math.ceil(usd * 100); // store as integer cents
  const after = await redis.incrby(key, cents);
  if (after === cents) {
    await redis.expire(key, secondsUntilUtcMidnight() + 60);
  }
}

export function getClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.headers.get('x-real-ip') ?? 'unknown';
}

export function isOwner(req: Request): boolean {
  const adminKey = process.env.KEV_O_ADMIN_KEY;
  if (!adminKey) return false;
  const url = new URL(req.url);
  const queryKey = url.searchParams.get('admin');
  if (queryKey && queryKey === adminKey) return true;
  const cookie = req.headers.get('cookie') ?? '';
  const match = cookie.match(/(?:^|;\s*)kevo_admin=([^;]+)/);
  if (match && match[1] && decodeURIComponent(match[1]) === adminKey) return true;
  return false;
}

function formatRetry(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86_400)}d`;
}
