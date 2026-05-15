/**
 * Thin proxy: forwards Kev-O chat requests to the canonical /api/kev-o
 * endpoint on the main site.
 *
 * The subdomain (kev-o.kevinmurphywebdev.com) is now a "full-page Kev-O
 * experience" — a standalone URL hiring managers can share. All retrieval,
 * voice, and rate-limit logic lives on the main site so there's one source
 * of truth. This subdomain just renders the chat surface and proxies the
 * stream.
 */

export const runtime = 'nodejs';
export const maxDuration = 60;

const UPSTREAM = process.env.KEV_O_UPSTREAM ?? 'https://kevinmurphywebdev.com/api/kev-o';

export async function POST(req: Request): Promise<Response> {
  const body = await req.text();
  // Forward the client IP so the upstream rate-limiter sees the real visitor,
  // not the Vercel-edge IP of the subdomain runtime.
  const forwardedFor =
    req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown';

  const upstream = await fetch(UPSTREAM, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-For': forwardedFor,
      // Forward owner-bypass cookie if present so testing works.
      ...(req.headers.get('cookie') ? { Cookie: req.headers.get('cookie')! } : {}),
    },
    body,
  });

  // Stream the upstream response straight back. AI SDK uses chunked text;
  // no transformation needed.
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') ?? 'text/plain; charset=utf-8',
    },
  });
}
