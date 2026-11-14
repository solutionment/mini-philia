#!/usr/bin/env bash
# One time GitHub setup for Mini Philia. Human run only, with the GitHub CLI logged in as a repo admin.
# Usage: scripts/github-setup.sh OWNER/REPO path/to/outputs.env
# Safe to re-run.
set -euo pipefail
REPO="${1:?usage: github-setup.sh OWNER/REPO outputs.env}"
OUTPUTS="${2:?path to infra/bootstrap/outputs.env}"
ME="$(gh api user --jq .login)"
ME_ID="$(gh api user --jq .id)"

echo "== Labels"
label() { gh label create "$1" -R "$REPO" --color "$2" --description "$3" --force >/dev/null; echo "  $1"; }
label "risk:R0" "c2e0c6" "Copy, styling, docs, tests only"
label "risk:R1" "bfd4f2" "New screen, endpoint or report in existing patterns"
label "risk:R2" "fbca04" "Schema, pipeline stage, prompt or model, connector"
label "risk:R3" "d93f0b" "Tenancy, RLS, auth, encryption, audit, production access"
label "data:synthetic" "ededed" "Synthetic data only"
label "data:masked" "d4c5f9" "Masked data"
label "data:pii" "b60205" "Real PII. Never taken by agents"
label "agent-eligible" "0e8a16" "Agents may work on this"
label "ready-for-agents" "1d76db" "Definition of Ready met. Adding this starts the team"
label "needs-info" "e99695" "Chief of Staff found gaps"
label "plan-review" "f9d0c4" "R2 or R3 plan waiting on a human"
label "plan-approved" "5319e7" "Human approved the plan. Adding this starts the build"
label "in-progress" "fef2c0" "Agents working"
label "in-review" "c5def5" "PR open"
label "maintenance" "ededed" "Scheduled maintenance output"

echo "== Repository variables"
while IFS='=' read -r k v; do
  [[ -z "$k" || "$k" == \#* || "$k" == *.* ]] && continue
  gh variable set "$k" -R "$REPO" --body "$v"; echo "  $k"
done <"$OUTPUTS"

echo "== Environments"
gh api -X PUT "repos/$REPO/environments/staging" >/dev/null
# Production: a required reviewer (you) and main only. Required reviewers need a public repo or a paid plan.
if ! gh api -X PUT "repos/$REPO/environments/production" --input - >/dev/null <<EOF
{ "reviewers": [ { "type": "User", "id": $ME_ID } ],
  "deployment_branch_policy": { "protected_branches": false, "custom_branch_policies": true } }
EOF
then
  echo "  WARNING: could not add a required reviewer to production. On GitHub Free this needs a public repo." >&2
  gh api -X PUT "repos/$REPO/environments/production" >/dev/null
fi
gh api -X POST "repos/$REPO/environments/production/deployment-branch-policies" -f name=main -f type=branch >/dev/null 2>&1 || true
for e in staging production; do
  while IFS='=' read -r k v; do
    [[ "$k" == "$e".* ]] || continue
    gh variable set "${k#"$e".}" -R "$REPO" --env "$e" --body "$v"; echo "  $e: ${k#"$e".}"
  done <"$OUTPUTS"
done

echo "== Ruleset on main"
if ! gh api -X POST "repos/$REPO/rulesets" --input - >/dev/null <<'EOF'
{
  "name": "main",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "bypass_actors": [ { "actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "pull_request" } ],
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "required_linear_history" },
    { "type": "pull_request", "parameters": {
        "required_approving_review_count": 1, "require_code_owner_review": true,
        "dismiss_stale_reviews_on_push": true, "require_last_push_approval": false,
        "required_review_thread_resolution": true } },
    { "type": "required_status_checks", "parameters": {
        "strict_required_status_checks_policy": false,
        "required_status_checks": [ { "context": "ci" } ] } }
  ]
}
EOF
then
  echo "  WARNING: ruleset not created (it may already exist, or a private repo on GitHub Free cannot use rulesets)." >&2
fi

echo "== Security features"
gh api -X PATCH "repos/$REPO" --input - >/dev/null <<'EOF' || echo "  WARNING: some security settings need a public repo or a paid plan" >&2
{ "security_and_analysis": {
    "secret_scanning": { "status": "enabled" },
    "secret_scanning_push_protection": { "status": "enabled" } },
  "delete_branch_on_merge": true, "allow_squash_merge": true, "allow_merge_commit": false, "allow_rebase_merge": false }
EOF
gh api -X PUT "repos/$REPO/vulnerability-alerts" >/dev/null 2>&1 || true

echo "== Claude token for agent runs"
echo "Run 'claude setup-token' in a terminal, then paste the token when gh asks (it is not echoed)."
gh secret set CLAUDE_CODE_OAUTH_TOKEN -R "$REPO"

echo
echo "Done for $REPO (admin: $ME)."
echo "Optional: create a Project board for the flow: gh project create --owner ${REPO%%/*} --title 'Mini Philia'"
