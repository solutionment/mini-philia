# Connecting Mini Philia to SolutionIQ Studio

See ADR 0004. Do these after docs/setup.md.

## Where everything runs

| What | Where it runs | What starts it |
|---|---|---|
| Agent team on a work item | GitHub Actions runner (a fresh GitHub hosted VM per run) running Claude Code through `anthropics/claude-code-action`, billed to the Claude subscription via `CLAUDE_CODE_OAUTH_TOKEN` | GitHub fires `agent-run.yml` when `ready-for-agents` or `plan-approved` is added, by a person in GitHub or by Studio |
| Interactive work (`/take 3`, reviews, learning) | Claude Code wherever you open it: your laptop, the desktop app, or a claude.ai/code cloud session | You |
| CI, deploy | GitHub Actions runners | Pull requests and merges to main |
| The app | Google Cloud (Cloud Run, Cloud SQL) | The deploy workflow only |
| Studio | Lovable Cloud | Webhooks and hook events arriving; people clicking |

Nothing polls. GitHub pushes events to Actions (which start agents) and to Studio (which shows them). Agents never run on Google Cloud and never hold cloud credentials.

## 1. Studio GitHub App
1. In the GitHub organization: Settings, Developer settings, GitHub Apps, New GitHub App. Name it "SolutionIQ Studio".
2. Webhook URL and secret: copy from Studio, Build, Settings, Setup checklist. Store the secret in Studio as `GITHUB_WEBHOOK_SECRET`.
3. Repository permissions: Issues read and write, Pull requests read, Checks read, Actions read and write, Variables read and write, Deployments read, Metadata read. Nothing else.
4. Subscribe to events: issues, pull_request, pull_request_review, check_suite, check_run, workflow_run, workflow_job, deployment_status (installation events are sent automatically).
5. Generate a private key. Add `GITHUB_APP_ID` and `GITHUB_APP_PRIVATE_KEY` as Studio secrets in the Lovable editor (never in chat).
6. Install the App on the organization, for `mini-philia` only. Then in Studio, connect the product to the repo.
7. Tell the agent-run workflow to trust labels added by the App: `gh variable set STUDIO_APP_BOT_LOGIN -R <org>/mini-philia --body "<app-slug>[bot]"` (the slug is in the App's URL). Labels from any other bot are refused.

## 2. Agent activity
1. In Studio, Build, Settings, generate the agent token (shown once).
2. In GitHub: `gh secret set STUDIO_INGEST_TOKEN -R <org>/mini-philia` (paste when asked), and `gh variable set STUDIO_INGEST_URL -R <org>/mini-philia --body <agent events URL from Studio>`.
3. Move `.claude/proposed/hooks/emit-event.mjs` to `.claude/hooks/` and apply `.claude/settings.proposed.json` as `.claude/settings.json`, in a PR you open yourself.
4. For interactive sessions on your laptop, export the same two variables in your shell to see your own sessions in Studio too. For claude.ai/code cloud sessions, add the Studio host to the environment's allowed hosts.

## 3. Budget feed
1. Copy the budget push URL from Studio, Build, Settings into `STUDIO_BUDGET_PUSH_URL` in `infra/bootstrap/config.env`.
2. Re-run `bash infra/bootstrap/bootstrap.sh`. It creates the `studio-budget-push` subscription and prints the service account email.
3. Paste that email into Studio, Build, Settings.

## 4. Deploy reports
1. Copy the deploy report URL from Studio, Build, Settings.
2. `gh variable set STUDIO_DEPLOY_REPORT_URL -R solutionment/mini-philia --body <url>`
3. The next deploy reports each environment to Studio when it finishes. It signs the report with the job's GitHub OIDC token, so there is no secret to manage. A Studio outage never fails a deploy.
4. Each report carries the release report: what changed since the last deploy of that environment (with each pull request's delivery report), the app address, the health check and the user guide. It also appears in the run summary in GitHub. Studio shows it under Build, Releases.

### Private repository
With the repository private on GitHub Pro, production is released by Actions > promote > Run workflow (ADR 0005). Studio's production link should point there.

## 5. Environment stats
1. Copy the cloud stats URL from Studio, Build, Settings into `STUDIO_STATS_PUSH_URL` in `infra/bootstrap/config.env`.
2. Re-run `bash infra/bootstrap/bootstrap.sh`. It deploys the `env-reporter` function (read only access to staging and production) and a Cloud Scheduler job that runs it every 15 minutes, then prints the reporter's email.
3. Paste that email into Studio, Build, Settings. The Environments tab fills in within 15 minutes.

What it reports per environment: the deployed revision, image and URL; requests, 5xx errors, p95 latency and instances for the API; database state, tier, disk used and CPU; file store size and object count; AI model tokens used. It never reads table contents or files.

## 6. Check it
- Studio Settings shows a recent webhook, agent event, budget event, deploy report and stats push.
- Add `ready-for-agents` to the R0 item from the Studio board. The Live view should show the Chief of Staff start within a minute.
- Flip Pause all agents, add a label again, and confirm the workflow comments that agents are paused.
