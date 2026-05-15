/**
 * Build-time corpus pipeline for Kev-O.
 *
 *   pnpm build:corpus
 *
 * Pulls four knowledge sources into one retrieval-ready JSON index:
 *
 *   1. Blog posts (MDX)      — from BLOG_REPO_PATH/src/content/blog
 *   2. Project case studies  — from BLOG_REPO_PATH/src/content/projects
 *   3. Resume + about page   — flattened from resume.json + about/page.tsx prose
 *   4. OSS repo READMEs      — fetched from GitHub for tablesalt, streamfield,
 *                              fedbench, fieldops-mcp, grant-pilot
 *
 * Then calls Voyage `voyage-3-large` to attach a vector to each chunk and
 * writes the whole thing to public/corpus.json. The chat API loads this
 * once at cold-start and serves it from memory.
 *
 * Two failure modes worth noting:
 *
 *   - If VOYAGE_API_KEY is missing, we still write the corpus WITHOUT
 *     embeddings (BM25-only fallback). Better to ship a degraded Kev-O
 *     than to fail the deploy.
 *   - If a GitHub README fetch 404s or rate-limits, we log + skip that
 *     source. The blog corpus alone is enough to answer most questions.
 */

import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { buildCorpus, type Corpus, type Chunk } from 'mdx-corpus';

const BLOG_REPO = process.env.BLOG_REPO_PATH ?? '../blog-portfolio-v3';
const OUTPUT = resolve('public/corpus.json');
const CACHE_DIR = resolve('.corpus-cache');

const REPOS = [
  { owner: 'midimurphdesigns', repo: 'tablesalt' },
  { owner: 'midimurphdesigns', repo: 'streamfield' },
  { owner: 'midimurphdesigns', repo: 'fedbench' },
  { owner: 'midimurphdesigns', repo: 'fieldops-mcp' },
  { owner: 'midimurphdesigns', repo: 'grant-pilot' },
] as const;

async function main() {
  const blogPath = resolve(BLOG_REPO);
  if (!existsSync(blogPath)) {
    throw new Error(
      `BLOG_REPO_PATH does not exist: ${blogPath}\n` +
        `Set BLOG_REPO_PATH to the kevinmurphywebdev.com repo checkout.`,
    );
  }

  await mkdir(CACHE_DIR, { recursive: true });
  await mkdir(dirname(OUTPUT), { recursive: true });

  // 1. Fetch READMEs and stage them as a synthetic mdx source dir.
  const readmeDir = join(CACHE_DIR, 'readmes');
  await mkdir(readmeDir, { recursive: true });
  await stageReadmes(readmeDir);

  // 2. Flatten resume.json into a synthetic markdown doc.
  const resumeDir = join(CACHE_DIR, 'resume');
  await mkdir(resumeDir, { recursive: true });
  await stageResume(blogPath, resumeDir);

  // 3. Run mdx-corpus over all four sources.
  const corpus = await buildCorpus({
    sources: [
      { dir: join(blogPath, 'src/content/blog'), baseUrl: '/blog', kind: 'blog' },
      { dir: join(blogPath, 'src/content/projects'), baseUrl: '/portfolio', kind: 'project' },
      { dir: resumeDir, baseUrl: '/about', kind: 'resume' },
      { dir: readmeDir, baseUrl: 'https://github.com/midimurphdesigns', kind: 'readme' },
    ],
    chunkBy: 'heading',
    maxChunkTokens: 500,
    includeFrontmatter: ['title', 'date', 'tags', 'role', 'employer'],
  });

  console.log(`[corpus] ${corpus.chunks.length} chunks parsed.`);

  // 4. Attach Voyage embeddings (best-effort).
  const withEmbeddings = await attachEmbeddings(corpus);

  await writeFile(OUTPUT, JSON.stringify(withEmbeddings));
  console.log(`[corpus] wrote ${OUTPUT}`);
}

async function stageReadmes(dir: string): Promise<void> {
  // README fetches are anonymous on purpose. All five repos in REPOS are
  // public OSS — the unauthenticated 60 req/hr cap is plenty for 5 calls
  // per build. Keeping this path token-free means adding a new public OSS
  // repo to the corpus only requires editing the REPOS array above; no
  // token allowlist update needed. The PAT in GITHUB_TOKEN is reserved
  // for the one place it's actually needed: cloning the private blog
  // content repo in scripts/vercel-build.sh.
  for (const { owner, repo } of REPOS) {
    const url = `https://api.github.com/repos/${owner}/${repo}/readme`;
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/vnd.github.raw' },
      });
      if (!res.ok) {
        console.warn(`[corpus] skip ${repo}: ${res.status} ${res.statusText}`);
        continue;
      }
      const body = await res.text();
      // Wrap as MDX with a synthetic title frontmatter so chunks have context.
      const wrapped = `---\ntitle: ${repo} README\nrepo: ${repo}\n---\n\n${body}`;
      await writeFile(join(dir, `${repo}.mdx`), wrapped);
      console.log(`[corpus] staged readme: ${repo}`);
    } catch (err) {
      console.warn(`[corpus] skip ${repo}: ${(err as Error).message}`);
    }
  }
}

async function stageResume(blogPath: string, dir: string): Promise<void> {
  const resumePath = join(blogPath, 'src/data/resume.json');
  if (!existsSync(resumePath)) {
    console.warn(`[corpus] resume.json not found at ${resumePath}`);
    return;
  }
  const resume = JSON.parse(await readFile(resumePath, 'utf8')) as ResumeShape;

  const lines: string[] = [];
  lines.push('---', 'title: Kevin Murphy resume', '---', '');

  if (resume.personal?.summary) {
    lines.push('## Summary', '', resume.personal.summary, '');
  }

  if (Array.isArray(resume.employers)) {
    for (const emp of resume.employers) {
      const header = `${emp.role ?? ''} at ${emp.name ?? emp.slug} (${emp.dates ?? ''})`.trim();
      lines.push(`## ${header}`, '');
      if (emp.location) lines.push(`Based: ${emp.location}.`, '');
      const empProjects = (resume.projects ?? []).filter((p) => p.employer === emp.slug);
      for (const proj of empProjects) {
        lines.push(`### ${proj.title} (${proj.year ?? ''})`, '');
        if (proj.role) lines.push(`Role: ${proj.role}.`);
        if (Array.isArray(proj.stack) && proj.stack.length > 0) {
          lines.push(`Stack: ${proj.stack.join(', ')}.`);
        }
        if (proj.summary) lines.push('', proj.summary);
        lines.push('');
      }
    }
  }

  if (Array.isArray(resume.skills) && resume.skills.length > 0) {
    lines.push('## Skills', '');
    for (const group of resume.skills) {
      const items = Array.isArray(group.items) ? group.items.join(', ') : (group.items ?? '');
      lines.push(`### ${group.label ?? 'Skills'}`, '', items, '');
    }
  }

  if (Array.isArray(resume.certifications) && resume.certifications.length > 0) {
    lines.push('## Certifications', '');
    for (const cert of resume.certifications) {
      const label =
        typeof cert === 'string' ? cert : [cert.name, cert.issuer, cert.year].filter(Boolean).join(', ');
      lines.push(`- ${label}`);
    }
    lines.push('');
  }

  if (Array.isArray(resume.education) && resume.education.length > 0) {
    lines.push('## Education', '');
    for (const ed of resume.education) {
      lines.push(`- ${[ed.degree, ed.school, ed.dates].filter(Boolean).join(', ')}`);
    }
    lines.push('');
  }

  await writeFile(join(dir, 'resume.mdx'), lines.join('\n'));
  console.log('[corpus] staged resume.json');
}

type ResumeShape = {
  personal?: { name?: string; title?: string; summary?: string };
  employers?: Array<{
    slug: string;
    name?: string;
    role?: string;
    dates?: string;
    location?: string;
  }>;
  projects?: Array<{
    slug: string;
    employer: string;
    title: string;
    year?: string;
    role?: string;
    stack?: string[];
    summary?: string;
  }>;
  skills?: Array<{ label?: string; items?: string | string[] }>;
  certifications?: Array<string | { name?: string; issuer?: string; year?: string | number }>;
  education?: Array<{ degree?: string; school?: string; dates?: string }>;
};

type ChunkWithEmbedding = Chunk & { embedding?: number[] };
type EmbeddedCorpus = Omit<Corpus, 'chunks'> & { chunks: ChunkWithEmbedding[] };

async function attachEmbeddings(corpus: Corpus): Promise<EmbeddedCorpus> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    console.warn('[corpus] VOYAGE_API_KEY not set — shipping BM25-only corpus');
    return corpus;
  }

  const out: ChunkWithEmbedding[] = [];
  const batchSize = 64;
  for (let i = 0; i < corpus.chunks.length; i += batchSize) {
    const batch = corpus.chunks.slice(i, i + batchSize);
    const res = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: batch.map((c) => c.content),
        model: 'voyage-3-large',
        input_type: 'document',
      }),
    });
    if (!res.ok) {
      console.warn(`[corpus] Voyage batch failed: ${res.status} — falling back to BM25 only`);
      return corpus;
    }
    const json = (await res.json()) as { data: Array<{ embedding: number[] }> };
    for (let j = 0; j < batch.length; j++) {
      out.push({ ...batch[j]!, embedding: json.data[j]?.embedding });
    }
    console.log(`[corpus] embedded ${out.length}/${corpus.chunks.length}`);
  }

  return { ...corpus, chunks: out };
}

main().catch((err) => {
  console.error('[corpus] FATAL:', err);
  process.exit(1);
});
