#!/usr/bin/env bash
set -euo pipefail

SOURCE="mock"
REPO_NAME=""
OWNER=""
VISIBILITY="--private"

for arg in "$@"; do
  case "$arg" in
    --source=*) SOURCE="${arg#*=}" ;;
    --owner=*) OWNER="${arg#*=}" ;;
    --public) VISIBILITY="--public" ;;
    --*) echo "Unknown flag: $arg" >&2; exit 1 ;;
    *) REPO_NAME="$arg" ;;
  esac
done

if [[ "$SOURCE" != "mock" && "$SOURCE" != "iscte" ]]; then
  echo "Error: --source must be 'mock' or 'iscte' (got '$SOURCE')." >&2
  exit 1
fi

if [ -z "$REPO_NAME" ]; then
  if [ "$SOURCE" = "iscte" ]; then
    REPO_NAME="iter-scheduling-iscte-data"
  else
    REPO_NAME="iter-scheduling-data"
  fi
fi

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

echo "Target repository: $REPO_SLUG (source: $SOURCE)"

if gh repo view "$REPO_SLUG" >/dev/null 2>&1; then
  echo "Repository already exists — reusing it."
else
  echo "Creating repository..."
  if [ "$SOURCE" = "iscte" ]; then
    DESCRIPTION="Real ISCTE-IUL 2022/23 schedule data, converted for iter-scheduling"
  else
    DESCRIPTION="Mock schedule data for iter-scheduling (generated)"
  fi
  gh repo create "$REPO_SLUG" $VISIBILITY --description "$DESCRIPTION" >/dev/null
fi

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

echo "Cloning $REPO_SLUG..."
gh repo clone "$REPO_SLUG" "$TMPDIR/repo" -- -q

cd "$TMPDIR/repo"
git checkout -B main -q

if [ "$SOURCE" = "iscte" ]; then
  echo "Importing ISCTE schedule data..."
  # Invoke tsx directly, not via `pnpm import:iscte -- <dir>` — pnpm forwards
  # the literal `--` token through to the script's argv here, which the
  # importer then treats as outDir instead of skipping it.
  (cd "$BACKEND_DIR" && npx tsx src/scripts/importIsteDataset.ts "$TMPDIR/repo")
  COMMIT_MSG="chore(data): regenerate ISCTE-derived schedule and rules data"
else
  echo "Generating mock schedule data..."
  (cd "$BACKEND_DIR" && npx tsx src/scripts/generate-large-schedule.ts "$TMPDIR/repo")
  COMMIT_MSG="chore(data): regenerate mock schedule and rules data"
fi

git add schedule.json rules.json
if git diff --cached --quiet; then
  echo "No changes to schedule.json/rules.json — nothing to push."
else
  git -c user.name="iter-scheduling-setup" -c user.email="setup@iter-scheduling.local" \
    commit -q -m "$COMMIT_MSG"
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

SOURCE_UPPER=$(echo "$SOURCE" | tr '[:lower:]' '[:upper:]')

set_env_var "GITHUB_PROVIDER" "github"
set_env_var "GITHUB_TOKEN" "$TOKEN"
set_env_var "GITHUB_OWNER" "$OWNER"
set_env_var "GITHUB_REPO" "$REPO_NAME"
# Remembered separately per source so scripts/switch-github-repo.sh can flip
# GITHUB_REPO back and forth without re-running this whole setup.
set_env_var "GITHUB_REPO_${SOURCE_UPPER}" "$REPO_NAME"

echo ""
echo "Done! Repository: $REPO_URL"
echo "backend/.env updated (GITHUB_PROVIDER=github, GITHUB_OWNER=$OWNER, GITHUB_REPO=$REPO_NAME)."
echo "Restart the backend (or run 'make dev') to pick up the new settings."
echo ""
echo "Set up the other dataset too, then use ./scripts/switch-github-repo.sh {mock|iscte} to flip between them."
