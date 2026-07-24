#!/usr/bin/env bash
set -euo pipefail

REPO_NAME="iter-scheduling-data"
OWNER=""
VISIBILITY="--private"

for arg in "$@"; do
  case "$arg" in
    --owner=*) OWNER="${arg#*=}" ;;
    --public) VISIBILITY="--public" ;;
    --*) echo "Unknown flag: $arg" >&2; exit 1 ;;
    *) REPO_NAME="$arg" ;;
  esac
done

if ! command -v gh >/dev/null 2>&1; then
  echo "Error: the GitHub CLI ('gh') is required but not installed. See https://cli.github.com/" >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "Error: not logged in to GitHub CLI. Run 'gh auth login' first." >&2
  exit 1
fi

if [ -z "$OWNER" ]; then
  OWNER=$(gh api user --jq .login)
fi

REPO_SLUG="$OWNER/$REPO_NAME"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$REPO_ROOT/backend"

echo "Target repository: $REPO_SLUG"

if gh repo view "$REPO_SLUG" >/dev/null 2>&1; then
  echo "Repository already exists — reusing it."
else
  echo "Creating repository..."
  gh repo create "$REPO_SLUG" $VISIBILITY --description "Mock schedule data for iter-scheduling (generated)" >/dev/null
fi

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

echo "Cloning $REPO_SLUG..."
gh repo clone "$REPO_SLUG" "$TMPDIR/repo" -- -q

cd "$TMPDIR/repo"
git checkout -B main -q

echo "Generating mock schedule data..."
(cd "$BACKEND_DIR" && pnpm generate:mock-data -- "$TMPDIR/repo")

git add schedule.json rules.json
if git diff --cached --quiet; then
  echo "No changes to schedule.json/rules.json — nothing to push."
else
  git -c user.name="iter-scheduling-setup" -c user.email="setup@iter-scheduling.local" \
    commit -q -m "chore(data): regenerate mock schedule and rules data"
  git push -q -u origin main
  echo "Pushed updated data to $REPO_SLUG (main)."
fi

REPO_URL="https://github.com/$REPO_SLUG"

echo "Fetching GitHub token from gh CLI..."
TOKEN=$(gh auth token)

ENV_FILE="$BACKEND_DIR/.env"
ENV_EXAMPLE="$BACKEND_DIR/.env.example"

if [ ! -f "$ENV_FILE" ]; then
  echo "No backend/.env found — creating one from .env.example"
  cp "$ENV_EXAMPLE" "$ENV_FILE"
fi

if [ -f "$ENV_FILE.bak" ]; then
  echo "backend/.env.bak already exists — preserving original backup (not overwriting)."
else
  cp "$ENV_FILE" "$ENV_FILE.bak"
  echo "Backed up existing backend/.env to backend/.env.bak"
fi

set_env_var() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then
    sed -i.tmp "s|^${key}=.*|${key}=${value}|" "$ENV_FILE" && rm -f "$ENV_FILE.tmp"
  else
    echo "${key}=${value}" >> "$ENV_FILE"
  fi
}

set_env_var "GITHUB_PROVIDER" "github"
set_env_var "GITHUB_TOKEN" "$TOKEN"
set_env_var "GITHUB_OWNER" "$OWNER"
set_env_var "GITHUB_REPO" "$REPO_NAME"

echo ""
echo "Done! Repository: $REPO_URL"
echo "backend/.env updated (GITHUB_PROVIDER=github, GITHUB_OWNER=$OWNER, GITHUB_REPO=$REPO_NAME)."
echo "Restart the backend (or run 'make dev') to pick up the new settings."
