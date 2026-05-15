#!/usr/bin/env bash
# Vercel build entrypoint for kev-o-ai-search.
#
# Kev-O's corpus is built from Kevin's blog-portfolio-v3 repo (blog MDX,
# project MDX, resume.json) plus READMEs fetched from 5 OSS repos.
# Locally this works because blog-portfolio-v3 is a sibling directory on
# Desktop. On Vercel there is no sibling — so we clone the blog repo
# fresh on every build and point BLOG_REPO_PATH at the local checkout.
#
# This keeps Kev-O's corpus deterministically tied to the latest public
# commit of the main site. No submodule, no manual sync.

set -euo pipefail

BLOG_REPO_OWNER="${BLOG_REPO_OWNER:-midimurphdesigns}"
BLOG_REPO_NAME="${BLOG_REPO_NAME:-blog-portfolio-v3}"
BLOG_REPO_BRANCH="${BLOG_REPO_BRANCH:-main}"
BLOG_CHECKOUT_DIR="./blog-portfolio-v3"

# Authenticate with GITHUB_TOKEN so we can clone private/restricted repos.
# Token must have at minimum: Contents: Read on the blog-portfolio-v3 repo.
# The token is masked in build logs by Vercel automatically.
if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "[vercel-build] FATAL: GITHUB_TOKEN is required to clone the blog content repo." >&2
  echo "[vercel-build] Set it in Vercel Settings → Environment Variables." >&2
  exit 1
fi

BLOG_REPO_URL="https://x-access-token:${GITHUB_TOKEN}@github.com/${BLOG_REPO_OWNER}/${BLOG_REPO_NAME}.git"

# Use glob-style patterns (non-cone sparse-checkout) so root-level files
# like mdx-components.tsx and next.config.ts are NEVER materialized.
# Cone mode would auto-include root files alongside the selected dirs,
# which puts .tsx files at ./blog-portfolio-v3/*.tsx and triggers Next's
# TypeScript checker to compile them as part of kev-o-ai-search.
SPARSE_PATTERNS=("/src/content/" "/src/data/")

# Sparse clone so we only pull the three directories the corpus actually
# reads (blog MDX, project MDX, resume.json). Critically this leaves NO
# .ts/.tsx files inside ${BLOG_CHECKOUT_DIR}, which keeps Next's TypeScript
# checker from trying to compile blog-repo source files as if they were
# part of kev-o-ai-search. Earlier full-clone attempts hit
# "Cannot find module 'mdx/types'" because Next walked the cloned
# mdx-components.tsx looking for a devDep that doesn't exist here.
if [ ! -d "$BLOG_CHECKOUT_DIR" ]; then
  echo "[vercel-build] sparse-cloning ${BLOG_REPO_OWNER}/${BLOG_REPO_NAME} (${BLOG_REPO_BRANCH}) into ${BLOG_CHECKOUT_DIR}"
  echo "[vercel-build]   patterns: ${SPARSE_PATTERNS[*]}"
  git clone \
    --depth 1 \
    --branch "$BLOG_REPO_BRANCH" \
    --filter=blob:none \
    --sparse \
    --no-checkout \
    "$BLOG_REPO_URL" "$BLOG_CHECKOUT_DIR"
  git -C "$BLOG_CHECKOUT_DIR" sparse-checkout init --no-cone
  git -C "$BLOG_CHECKOUT_DIR" sparse-checkout set "${SPARSE_PATTERNS[@]}"
  git -C "$BLOG_CHECKOUT_DIR" checkout "$BLOG_REPO_BRANCH"
else
  echo "[vercel-build] ${BLOG_CHECKOUT_DIR} already exists, pulling latest"
  git -C "$BLOG_CHECKOUT_DIR" sparse-checkout set "${SPARSE_PATTERNS[@]}"
  git -C "$BLOG_CHECKOUT_DIR" fetch --depth 1 origin "$BLOG_REPO_BRANCH"
  git -C "$BLOG_CHECKOUT_DIR" reset --hard "origin/$BLOG_REPO_BRANCH"
fi

# Force the corpus build to read from our checkout.
export BLOG_REPO_PATH="$BLOG_CHECKOUT_DIR"

echo "[vercel-build] building corpus from $BLOG_REPO_PATH"
pnpm tsx scripts/build-corpus.ts

echo "[vercel-build] running next build"
pnpm next build
