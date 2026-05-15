import { anthropic } from '@ai-sdk/anthropic';
import { streamText, convertToCoreMessages, type CoreMessage } from 'ai';
import { z } from 'zod';
import { retrieve } from '@/lib/retrieve';
import { buildSystemPrompt } from '@/lib/kev-o-prompt';
import { checkLimits, chargeUsd, getClientIp, isOwner } from '@/lib/rate-limit';
import { SONNET_PRICING } from '@/lib/brand';

export const runtime = 'nodejs';
export const maxDuration = 60;

const BodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string().max(8_000),
      }),
    )
    .min(1)
    .max(20),
});

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = BodySchema.parse(await req.json());
  } catch {
    return Response.json({ error: 'invalid body' }, { status: 400 });
  }

  // Rate limit / budget gate. Owner bypasses both.
  if (!isOwner(req)) {
    const limit = await checkLimits(getClientIp(req));
    if (!limit.ok) {
      return Response.json(
        { error: limit.message },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
      );
    }
  }

  // Retrieve over the latest user turn. Keeps retrieval simple and intent-aligned;
  // multi-turn rewriting is a v2 problem.
  const lastUser = [...parsed.messages].reverse().find((m) => m.role === 'user');
  const query = lastUser?.content ?? '';
  const passages = await retrieve(query);
  const system = buildSystemPrompt(passages);

  const messages: CoreMessage[] = convertToCoreMessages(
    parsed.messages.filter((m) => m.role !== 'system'),
  );

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system,
    messages,
    temperature: 0.4,
    maxTokens: 800,
    // Prompt-cache the system block — it changes only when retrieval results
    // differ, which still gives multi-turn conversations a cheap re-read.
    providerOptions: {
      anthropic: {
        cacheControl: { type: 'ephemeral' },
      },
    },
    onFinish: async ({ usage }) => {
      const inputUsd = (usage.promptTokens / 1_000_000) * SONNET_PRICING.inputPerMTok;
      const outputUsd = (usage.completionTokens / 1_000_000) * SONNET_PRICING.outputPerMTok;
      await chargeUsd(inputUsd + outputUsd);
    },
  });

  return result.toDataStreamResponse();
}
