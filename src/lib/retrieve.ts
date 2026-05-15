/**
 * Hybrid retrieval pipeline for Kev-O.
 *
 *   query → BM25 top-20 candidates → Voyage rerank-2.5 → top-5
 *
 * BM25 gives us a cheap, lexically-anchored candidate pool over the whole
 * corpus. Voyage's cross-encoder rerank then re-orders those candidates
 * with semantic awareness (paraphrase, intent, recency cues). The reranker
 * is the model that actually decides what Claude sees — the BM25 stage is
 * just there to keep the rerank cost bounded.
 *
 * If VOYAGE_API_KEY is missing OR the rerank call fails, we fall back to
 * BM25 top-K. Kev-O still answers; he just answers with the lexical
 * baseline. Better to degrade than to fail.
 */

import { bm25Search, type RetrievalResult } from './bm25';
import { loadCorpus } from './corpus';

const RERANK_CANDIDATES = 20;
const FINAL_TOP_K = 6;

export type RetrievedPassage = {
  chunkId: string;
  content: string;
  url: string;
  heading?: string;
  kind?: string;
  title?: string;
  score: number;
};

export async function retrieve(query: string): Promise<RetrievedPassage[]> {
  const { bm25 } = await loadCorpus();
  const candidates = bm25Search(bm25, query, RERANK_CANDIDATES);
  if (candidates.length === 0) return [];

  const reranked = await voyageRerank(query, candidates);
  return reranked.slice(0, FINAL_TOP_K).map(toPassage);
}

function toPassage(r: RetrievalResult): RetrievedPassage {
  const fm = r.chunk.frontmatter as Record<string, unknown>;
  const title = typeof fm.title === 'string' ? fm.title : undefined;
  return {
    chunkId: r.chunk.id,
    content: r.chunk.content,
    url: r.chunk.source.url,
    heading: r.chunk.source.heading,
    kind: r.chunk.source.kind,
    title,
    score: r.score,
  };
}

async function voyageRerank(
  query: string,
  candidates: RetrievalResult[],
): Promise<RetrievalResult[]> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) return candidates;

  try {
    const res = await fetch('https://api.voyageai.com/v1/rerank', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        documents: candidates.map((c) => c.chunk.content),
        model: 'rerank-2.5',
        top_k: FINAL_TOP_K,
      }),
    });
    if (!res.ok) return candidates;
    const json = (await res.json()) as {
      data: Array<{ index: number; relevance_score: number }>;
    };
    return json.data.map((d) => ({
      chunk: candidates[d.index]!.chunk,
      score: d.relevance_score,
    }));
  } catch {
    return candidates;
  }
}
