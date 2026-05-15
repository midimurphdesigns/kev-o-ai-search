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

if [ ! -d "$BLOG_CHECKOUT_DIR" ]; then
  echo "[vercel-build] cloning ${BLOG_REPO_OWNER}/${BLOG_REPO_NAME} (${BLOG_REPO_BRANCH}) into ${BLOG_CHECKOUT_DIR}"
  git clone --depth 1 --branch "$BLOG_REPO_BRANCH" "$BLOG_REPO_URL" "$BLOG_CHECKOUT_DIR"
else
  echo "[vercel-build] ${BLOG_CHECKOUT_DIR} already exists, pulling latest"
  git -C "$BLOG_CHECKOUT_DIR" fetch --depth 1 origin "$BLOG_REPO_BRANCH"
  git -C "$BLOG_CHECKOUT_DIR" reset --hard "origin/$BLOG_REPO_BRANCH"
fi

# Force the corpus build to read from our checkout.
export BLOG_REPO_PATH="$BLOG_CHECKOUT_DIR"

echo "[vercel-build] building corpus from $BLOG_REPO_PATH"
pnpm tsx scripts/build-corpus.ts

echo "[vercel-build] running next build"
pnpm next build
