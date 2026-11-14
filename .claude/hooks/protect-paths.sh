#!/usr/bin/env bash
# Prevents agents from editing the files that define their own controls.
# The human owner edits these directly or approves the PR.
input=$(cat)
f=$(printf '%s' "$input" | python3 -c 'import sys,json;d=json.load(sys.stdin).get("tool_input",{});print(d.get("file_path",""))' 2>/dev/null)
case "$f" in
  *"/.claude/settings.json"|*"/.claude/hooks/"*|*"/CODEOWNERS")
    echo "Blocked: $f defines agent controls. Propose the change in the PR description for the human owner." >&2
    exit 2;;
esac
exit 0
