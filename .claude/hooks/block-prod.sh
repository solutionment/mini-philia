#!/usr/bin/env bash
# Blocks shell commands that reference production. Exit code 2 returns the message to the agent.
input=$(cat)
cmd=$(printf '%s' "$input" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("tool_input",{}).get("command",""))' 2>/dev/null)
if printf '%s' "$cmd" | grep -Eqi '(^|[^a-z])(prod|production)([^a-z]|$)|philia-prod'; then
  echo "Blocked: commands that reference production are not allowed for agents. Use the deployment pipeline." >&2
  exit 2
fi
exit 0
