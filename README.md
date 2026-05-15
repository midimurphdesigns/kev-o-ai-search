# kev-o-ai-search

Live at **https://kev-o.kevinmurphywebdev.com**, embedded across **https://kevinmurphywebdev.com**.

Kev-O is a grounded RAG chatbot trained exclusively on the public writing of [Kevin Murphy](https://kevinmurphywebdev.com): blog posts, project case studies, resume, About page, and the READMEs of his open-source repos (`tablesalt`, `streamfield`, `fedbench`, `grant-pilot`, `fieldops-mcp`). It cites its receipts. It refuses to make things up.

This repo is the **subdomain surface** — a standalone full-page chat experience hiring managers can share. The brain (retrieval + prompt construction + streaming) lives on the main site and is reused across three surfaces.

---

## Architecture

```
                     ┌─────────────────────────────────────────────┐
                     │  kevinmurphywebdev.com  (main site)         │
                     │                                             │
                     │  /api/kev-o   ←─── canonical brain          │
                     │     │                                       │
                     │     ├── corpus    (public/kev-o-corpus.json)│
                     │     ├── retrieve  (BM25 → Voyage rerank)    │
                     │     ├── prompt    (system + passages)       │
                     │     ├── stream    (Anthropic Claude)        │
                     │     └── limits    (Upstash, USD cap)        │
                     └────────────┬────────────────────────────────┘
                                  │
              ┌───────────────────┼───────────────────────────┐
              │                   │                           │
              ▼                   ▼                           ▼
       ⌘K palette         inline punch-ins         kev-o.kevinmurphywebdev.com
       (every page)       (foot of blog +          (this repo — full page)
                           portfolio entries)
```

The subdomain proxies its `/api/chat` straight to the main site's `/api/kev-o`. Three surfaces, one brain. UI components (animated rhombus avatar, character-by-character streaming reveal, brand-safe error parser) are mirrored between this repo and the main site.

---

## Retrieval pipeline

```
query
  │
  ▼
┌─────────────────────────────┐
│ BM25 over the full corpus   │   k1=1.5, b=0.75 (Robertson standard)
│ top-20 candidates           │   In-memory, zero-cost, ~3ms
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ Voyage rerank-2.5           │   Cross-encoder, semantic awareness
│ top-6 winners               │   ~120ms upstream call
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ Optional page-context       │   Forged as synthetic passage at
│ passage (inline punch-ins)  │   position 0 — ground truth for the
└──────────┬──────────────────┘   page the visitor is reading
           │
           ▼
┌─────────────────────────────┐
│ Claude Sonnet 4.6           │   Streaming via Vercel AI SDK
│ system + passages + chat    │   temp 0.4, max 800 tokens
└──────────┬──────────────────┘
           │
           ▼
       streaming text response
```

### Why hybrid BM25 + rerank instead of dense embeddings

The dominant signal in the queries Kev-O sees is **the literal vocabulary**. People ask "what did Kevin do on FedNow" or "is grant-pilot federal" — short, factual, domain-specific. BM25 from 1995 still beats dense-vector retrievers on this query shape because the words ARE the signal.

But BM25 is brittle on paraphrase ("the federal payments rail" should match "FedNow"). So the second stage is a cross-encoder rerank from Voyage's `voyage-rerank-2.5`, which re-orders the top-20 lexical candidates with full semantic awareness.

**Cost shape:** ~$0.0001 per query for BM25 (free, runs locally) + ~$0.0002 for the rerank call. Anthropic generation dwarfs both at ~$0.005 for a typical 600-token completion with cached system prompt.

**Failure mode:** if `VOYAGE_API_KEY` is missing or the rerank call fails, the system degrades to BM25-only top-K. Kev-O still answers — he just answers with the lexical baseline. Degrading beats failing.

---

## Voice + guardrails

Kev-O has a deliberate voice: warm, lightly personable, witty in a competent-engineer-who's-fun-to-talk-to way. The system prompt constrains him to:

1. **Cite sources.** Every assistant turn references the passages by `[1]`, `[2]`, etc., backed by real URLs into the writing.
2. **Refuse to invent.** If the corpus doesn't cover the question, Kev-O says so. He doesn't bridge gaps with plausible-sounding fiction.
3. **Stay short.** Default to two short paragraphs. The visitor came to evaluate, not to read an essay.
4. **Stay in character.** No "as a language model" hedging. He's Kev-O.

---

## Rate limiting + cost cap

Three layers, all on the main-site `/api/kev-o`:

1. **Per-IP sliding window** — 15 requests / hour via Upstash Redis. Returns 429 with retry-after.
2. **Daily global USD cap** — Defaults to $5/day UTC. Counts actual Anthropic + Voyage spend post-stream via the AI SDK's `onFinish` callback. When hit, every request gets a friendly "napping until tomorrow" response.
3. **Owner bypass** — A separate `/api/kev-o-admin` route accepts `?key=<KEV_O_ADMIN_KEY>` and drops an `HttpOnly` + `SameSite=Strict` cookie. The route fails closed (404) if the env var is unset or under 24 chars, uses timing-safe key comparison, and is per-IP rate-limited at 5/hour BEFORE the key check — so an attacker exhausts their budget regardless of guess outcome.

---

## Tech stack

- **Framework:** Next.js 16 (App Router, React 19, Turbopack)
- **AI:** Vercel AI SDK 4.x + `@ai-sdk/anthropic` (`streamText`, `useChat`)
- **Retrieval:** Custom BM25 (ported from [`fedbench`](https://github.com/midimurphdesigns/fedbench)) + Voyage `voyage-rerank-2.5`
- **Corpus:** [`mdx-corpus`](https://github.com/midimurphdesigns/mdx-corpus) — extracted utility for chunking MDX directories into retrieval-ready JSON
- **Rate-limit + spend cap:** Upstash Redis + `@upstash/ratelimit`
- **UI:** Tailwind CSS v4, Framer Motion, [`streamfield`](https://github.com/midimurphdesigns/streamfield) for character-by-character text reveal
- **Type checking:** TypeScript strict, zero `any`
- **Hosting:** Vercel (subdomain + main site as separate projects)

---

## Why three surfaces, not one

The chat lives in three places because the visitor's intent is different in each:

| Surface | Intent | Page-context grounding |
|---|---|---|
| `kev-o.kevinmurphywebdev.com` (this repo) | "I want to evaluate Kevin." | None — full freedom |
| ⌘K palette (every main-site page) | "Quick question while I browse." | None |
| Inline punch-ins (foot of curated entries) | "I just read this case study, tell me more." | The page itself, forced as the highest-priority passage |

The inline punch-ins are the interesting one: the page content gets forged into the retrieval result as a synthetic passage at position 0, so Kev-O is most likely to cite the article the visitor is actually reading.

---

## Local development

```sh
git clone https://github.com/midimurphdesigns/kev-o-ai-search
cd kev-o-ai-search
pnpm install
cp .env.example .env.local   # KEV_O_ADMIN_KEY is the only required var for the proxy
pnpm dev                     # http://localhost:3004
```

In dev, requests proxy to `https://kevinmurphywebdev.com/api/kev-o` by default. To point at a local main-site instance instead, set `KEV_O_UPSTREAM=http://localhost:3003/api/kev-o`.

---

## Repo relationships

- **[`mdx-corpus`](https://github.com/midimurphdesigns/mdx-corpus)** — the corpus-building primitive. Takes a directory of MDX files, emits retrieval-ready JSON chunks. Used by the corpus build step on the main site.
- **[`fedbench`](https://github.com/midimurphdesigns/fedbench)** — RAG evaluation harness. The BM25 implementation here was ported from there.
- **[`streamfield`](https://github.com/midimurphdesigns/streamfield)** — the character-by-character text reveal hook used in Kev-O's message bubbles.
- **[`grant-pilot`](https://github.com/midimurphdesigns/grant-pilot)** — federal grant-discovery agent. Different problem, same family of techniques (retrieval + tool use + Anthropic streaming).

Together those four repos compose the Applied AI side of [kevinmurphywebdev.com](https://kevinmurphywebdev.com): evaluate (`fedbench`) → compose (`grant-pilot`) → ship to users (`kev-o-ai-search`).

---

## License

MIT. See [LICENSE](./LICENSE) if present, otherwise the code is provided as-is for inspection and reference.

The corpus content (Kevin's writing) is © Kevin Murphy and is not redistributable.

---

Built by [Kevin Murphy](https://kevinmurphywebdev.com). Reach out at [kmurphywebdev@gmail.com](mailto:kmurphywebdev@gmail.com).
