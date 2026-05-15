import type { Chunk, Corpus } from 'mdx-corpus';
import { buildBm25Index, type Bm25Index } from './bm25';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export type EmbeddedChunk = Chunk & { embedding?: number[] };
export type EmbeddedCorpus = Omit<Corpus, 'chunks'> & { chunks: EmbeddedChunk[] };

type LoadedCorpus = {
  corpus: EmbeddedCorpus;
  bm25: Bm25Index;
  hasEmbeddings: boolean;
};

let cached: LoadedCorpus | null = null;

/**
 * Load the corpus once per process. Server-side only. The corpus.json is
 * generated at build time by scripts/build-corpus.ts.
 */
export async function loadCorpus(): Promise<LoadedCorpus> {
  if (cached) return cached;
  const path = resolve(process.cwd(), 'public/corpus.json');
  const raw = await readFile(path, 'utf8');
  const corpus = JSON.parse(raw) as EmbeddedCorpus;
  const bm25 = buildBm25Index(corpus.chunks);
  const hasEmbeddings = corpus.chunks.some((c) => Array.isArray(c.embedding));
  cached = { corpus, bm25, hasEmbeddings };
  return cached;
}
