/**
 * BM25 retrieval over an in-memory chunk array.
 *
 * Ported from fedbench's BM25 implementation, decoupled from its corpus-path
 * machinery. BM25 is the industry-standard keyword-relevance ranking from
 * the mid-1990s; it still beats dense-vector retrievers on short, factual,
 * domain-specific queries because the dominant signal in those queries IS
 * the literal vocabulary. We use it as the first-stage candidate filter
 * before sending top-N to Voyage for a cross-encoder rerank.
 *
 * Tuning: k1=1.5, b=0.75 (Robertson standard).
 */

import type { Chunk } from 'mdx-corpus';

const K1 = 1.5;
const B = 0.75;

const STOPWORDS = new Set([
  'a', 'an', 'and', 'or', 'the', 'of', 'to', 'in', 'is', 'are', 'was',
  'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
  'for', 'on', 'at', 'by', 'with', 'from', 'as', 'this', 'that', 'these',
  'those', 'it', 'its', 'he', 'she', 'his', 'her', 'they', 'them', 'their',
  'you', 'your', 'i', 'my', 'me', 'we', 'us', 'our', 'but', 'if', 'then',
  'than', 'so', 'not', 'no', 'yes', 'can', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'shall',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[–—−]/g, '-')
    .replace(/[^a-z0-9\s$%.\-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

type IndexedChunk = {
  chunk: Chunk;
  termFreq: Map<string, number>;
  length: number;
};

export type RetrievalResult = {
  chunk: Chunk;
  score: number;
};

export type Bm25Index = {
  chunks: IndexedChunk[];
  docFreq: Map<string, number>;
  avgLength: number;
  totalDocs: number;
};

export function buildBm25Index(chunks: Chunk[]): Bm25Index {
  const indexed: IndexedChunk[] = [];
  const docFreq = new Map<string, number>();

  for (const chunk of chunks) {
    const tokens = tokenize(chunk.content);
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    indexed.push({ chunk, termFreq: tf, length: tokens.length });
    for (const term of tf.keys()) docFreq.set(term, (docFreq.get(term) ?? 0) + 1);
  }

  const totalLength = indexed.reduce((sum, ic) => sum + ic.length, 0);
  const avgLength = indexed.length > 0 ? totalLength / indexed.length : 0;

  return { chunks: indexed, docFreq, avgLength, totalDocs: indexed.length };
}

function idf(N: number, df: number): number {
  return Math.max(0, Math.log((N - df + 0.5) / (df + 0.5) + 1));
}

function bm25Score(queryTokens: string[], indexed: IndexedChunk, idx: Bm25Index): number {
  let score = 0;
  for (const term of queryTokens) {
    const tf = indexed.termFreq.get(term) ?? 0;
    if (tf === 0) continue;
    const df = idx.docFreq.get(term) ?? 0;
    const termIdf = idf(idx.totalDocs, df);
    const numerator = tf * (K1 + 1);
    const denominator = tf + K1 * (1 - B + B * (indexed.length / idx.avgLength));
    score += termIdf * (numerator / denominator);
  }
  return score;
}

export function bm25Search(index: Bm25Index, query: string, topK = 20): RetrievalResult[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];
  const scored: RetrievalResult[] = [];
  for (const indexed of index.chunks) {
    const score = bm25Score(tokens, indexed, index);
    if (score > 0) scored.push({ chunk: indexed.chunk, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}
