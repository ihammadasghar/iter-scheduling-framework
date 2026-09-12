#!/usr/bin/env bash
set -euo pipefail

# Flips backend/.env's active GITHUB_REPO between the two repos set up by
# setup-github-repo.sh (one per --source), without re-cloning/re-pushing
# anything. Both repos must already exist — run
# `./scripts/setup-github-repo.sh --source=<mock|iscte>` first for any
# source that hasn't been set up yet.

TARGET="${1:-}"
if [[ "$TARGET" != "mock" && "$TARGET" != "iscte" ]]; then
  echo "Usage: $0 <mock|iscte>" >&2
  echo "Switches backend/.env's GITHUB_REPO to the repo previously set up for that source." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$REPO_ROOT/backend/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: backend/.env not found. Run './scripts/setup-github-repo.sh --source=$TARGET' first." >&2
  exit 1
fi

TARGET_UPPER=$(echo "$TARGET" | tr '[:lower:]' '[:upper:]')
VAR_NAME="GITHUB_REPO_${TARGET_UPPER}"
REPO_VALUE=$(grep "^${VAR_NAME}=" "$ENV_FILE" | head -1 | cut -d= -f2-)

if [ -z "$REPO_VALUE" ]; then
  echo "Error: $VAR_NAME not set in backend/.env — the '$TARGET' repo hasn't been set up here yet." >&2
  echo "Run './scripts/setup-github-repo.sh --source=$TARGET' first." >&2
  exit 1
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
set_env_var "GITHUB_REPO" "$REPO_VALUE"

echo "Switched backend/.env: GITHUB_REPO=$REPO_VALUE ($TARGET)."
echo "Restart the backend (or run 'make dev') to pick up the change."
