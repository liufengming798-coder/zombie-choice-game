#!/usr/bin/env bash
set -euo pipefail

# One-click deploy for static sites to GitHub Pages.
# Safe for re-run.

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing command: $1"
    exit 1
  fi
}

require_cmd git
require_cmd gh

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Not a git repository. Run this script inside your project folder."
  exit 1
fi

if ! gh auth status -h github.com >/dev/null 2>&1; then
  echo "GitHub CLI not authenticated. Run: gh auth login"
  exit 1
fi

CURRENT_BRANCH="$(git symbolic-ref --short HEAD 2>/dev/null || true)"
if [ -z "${CURRENT_BRANCH}" ]; then
  CURRENT_BRANCH="main"
  git checkout -b "${CURRENT_BRANCH}"
fi

if [ "${CURRENT_BRANCH}" != "main" ]; then
  git branch -M main
fi

REPO_NAME_DEFAULT="$(basename "$(pwd)")"
REPO_NAME="${REPO_NAME:-$REPO_NAME_DEFAULT}"
GITHUB_USER="${GITHUB_USER:-$(gh api user --jq .login)}"
OWNER_REPO="${GITHUB_USER}/${REPO_NAME}"

if ! gh repo view "${OWNER_REPO}" >/dev/null 2>&1; then
  echo "Creating public repo: ${OWNER_REPO}"
  gh repo create "${OWNER_REPO}" --public --source=. --remote=origin --push
else
  if ! git remote get-url origin >/dev/null 2>&1; then
    git remote add origin "git@github.com:${OWNER_REPO}.git"
  fi
fi

if [ -n "$(git status --porcelain)" ]; then
  git add -A
  git commit -m "chore: update for GitHub Pages deploy"
fi

echo "Pushing code to main..."
git push -u origin main

echo "Enabling GitHub Pages (main branch / root)..."
if ! gh api -X POST "repos/${OWNER_REPO}/pages" -f 'source[branch]=main' -f 'source[path]=/' >/dev/null 2>&1; then
  gh api -X PUT "repos/${OWNER_REPO}/pages" -f 'source[branch]=main' -f 'source[path]=/' >/dev/null
fi

echo "Waiting for Pages build..."
for _ in $(seq 1 30); do
  STATUS="$(gh api "repos/${OWNER_REPO}/pages/builds" --jq '.[0].status' 2>/dev/null || true)"
  if [ "${STATUS}" = "built" ]; then
    break
  fi
  sleep 2
done

SITE_URL="$(gh api "repos/${OWNER_REPO}/pages" --jq .html_url)"
echo ""
echo "Deploy complete."
echo "Public URL: ${SITE_URL}"
