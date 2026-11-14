# One time setup (human steps, in order)

Time: about an hour, mostly waiting. Nothing here gives an agent cloud credentials.

## 1. GitHub organization and repository
1. Use a GitHub **organization**, not a second personal account. From your usual GitHub account: profile menu, Your organizations, New organization, Free plan. Name it for Solutionment. If you already made a separate Solutionment user account, invite it to the organization as an owner, or turn it into an organization (Settings, Organizations, "Turn into an organization").
2. Organization settings: require two factor authentication. Under Member privileges, set base permissions to Read.
3. Create the repository `mini-philia` in the organization, empty, no README.
4. **Public or private?** On GitHub Free, a **private** repo has no rulesets or branch protection, no required reviewers on environments and no code scanning. Those are the human approval gates this pilot exists to test. Choose one:
   - Public repo. Free, and every gate works. Fine here because the pilot holds synthetic data only and no secrets live in the repo.
   - GitHub Team (4 USD per user per month), with a private repo and every gate.
5. Install the Claude GitHub App on the organization, for `mini-philia` only: https://github.com/apps/claude. Then in claude.ai, Settings, Connectors, make sure GitHub is connected with the account that belongs to the organization. Claude sessions can then attach the repo. No tokens go into chat.

## 2. Google Cloud bootstrap (Cloud Shell)
1. Open https://shell.cloud.google.com signed in as the billing account owner.
2. `git clone https://github.com/<org>/mini-philia && cd mini-philia/infra/bootstrap`
3. `cp config.example.env config.env` and fill in BILLING_ACCOUNT_ID, GITHUB_OWNER (and ORG_ID if you have a Google Cloud organization).
4. `bash bootstrap.sh`. Re-run it if any step fails. It skips what already exists.
5. Download `outputs.env` (Cloud Shell, More, Download), or keep it in Cloud Shell for step 3.
6. Check: Billing, Budgets and alerts shows `mini-philia-monthly` at 100 USD, and Cloud Run functions in the platform project shows `budget-guard`.

## 3. Claude on Vertex AI
1. In each of the staging and production projects: Vertex AI, Model Garden, search Claude, open the model you want, Enable, accept the terms.
2. If enabling is refused on the free trial, upgrade the billing account to paid (remaining credit is kept), or start with Gemini through the same gateway (work item 09 makes the model a setting).
3. Note the exact model ID and location shown on the model card. Work item 09 uses them.

## 4. GitHub configuration
From a machine with the GitHub CLI logged in as an org owner (Cloud Shell has `gh`, or install it locally):
```
gh auth login
scripts/github-setup.sh <org>/mini-philia infra/bootstrap/outputs.env
```
This creates labels, repo and environment variables, the `staging` and `production` environments (production needs your approval), the ruleset on main, and asks for the Claude token. Run `claude setup-token` in your terminal to get that token. It bills agent runs to your Claude subscription, not to Google Cloud.

## 5. Agent settings
Review `.claude/settings.proposed.json`, then replace `.claude/settings.json` with it in a PR you open yourself. The agents are blocked from editing their own controls, which is why this step is yours.

## 6. First run
1. In GitHub, Actions, deploy, Run workflow on main. The deploy workflow builds the image, creates Cloud SQL and Cloud Run in staging (about 10 minutes the first time), smoke checks `/healthz`, then waits for you to approve production.
2. `scripts/seed-backlog.sh <org>/mini-philia` to create the first nine work items.
3. Take item 01 interactively in Claude Code: `/take 1`. Watch each agent step. Then try item 02 through the label: add `ready-for-agents` and watch the agent-run workflow.

## Moving to Claude Teams later
Nothing in the repo is tied to a personal Claude account. When the Teams workspace exists: connect the same GitHub organization there, have the team install Claude Code, and replace the `CLAUDE_CODE_OAUTH_TOKEN` secret with a token from a Teams account (or an API key). Agents, skills, hooks and workflows carry over unchanged.
