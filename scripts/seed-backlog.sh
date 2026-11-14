#!/usr/bin/env bash
# Creates GitHub issues from backlog/*.md. Human run only. Each file starts with:
#   title: <title>
#   labels: risk:R1,data:synthetic,agent-eligible
#   ---
# and the rest is the issue body. Files are created in name order. ready-for-agents is never added here:
# you add it when you want the team to start.
set -euo pipefail
REPO="${1:?usage: seed-backlog.sh OWNER/REPO}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../backlog" && pwd)"
for f in "$DIR"/[0-9]*.md; do
  title="$(sed -n 's/^title: //p' "$f" | head -1)"
  labels="$(sed -n 's/^labels: //p' "$f" | head -1)"
  body="$(awk 'found{print} /^---$/{found=1}' "$f")"
  if gh issue list -R "$REPO" --state all --search "in:title \"$title\"" --json title --jq '.[].title' | grep -qxF "$title"; then
    echo "exists: $title"; continue
  fi
  gh issue create -R "$REPO" --title "$title" --label "$labels" --body "$body"
done
