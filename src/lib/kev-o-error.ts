/**
 * Parse what `useChat`'s onError hands us into a clean Kev-O-voice string.
 *
 * The AI SDK serializes non-2xx responses by stuffing the response body into
 * `err.message`. Our API returns `{ "error": "..." }` envelopes, so the raw
 * message reads like `'{"error":"Kev-O is napping..."}'` which is what the
 * user saw in the screenshot. We unwrap it before display.
 *
 * Fallback is a Kev-O-voice generic, not a stack trace.
 */

const FALLBACK = "Kev-O hit a snag. Give it another go in a moment.";

export function parseKevOError(err: unknown): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : '';
  if (!raw) return FALLBACK;
  // Envelope shape `{ "error": "..." }` from our API.
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      'error' in parsed &&
      typeof (parsed as { error: unknown }).error === 'string'
    ) {
      return (parsed as { error: string }).error;
    }
  } catch {
    // not JSON — fall through
  }
  // If the message is already a plain sentence, use it; if it looks like
  // a stack trace or huge blob, swap for the fallback.
  if (raw.length < 240 && !raw.includes('\n')) return raw;
  return FALLBACK;
}
