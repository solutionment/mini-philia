# Mini Philia

Pilot app for the Solutionment Studio Suite on Google Cloud. A small, multi-tenant version of Philia, built through the full agent process so the process itself gets tested.

```
apps/api/              API service (TypeScript, Cloud Run)
apps/web/              React front end (added by a work item)
services/worker/       ingestion and jobs (added by a work item)
db/migrations/         versioned SQL (expand and contract)
db/tests/              pgTAP: RLS, roles, lineage
ai/prompts/            versioned prompts and schemas
ai/evals/              golden sets and scorers
infra/bootstrap/       one time, human run setup of Google Cloud (projects, budget, keyless CI)
infra/budget-guard/    function that scales things down when the monthly budget is spent
infra/terraform/       app infrastructure per environment, applied only by the deploy workflow
synthetic/             generated test data
backlog/               the first work items, seeded into GitHub issues
docs/                  ADRs, process, cost guardrails, compliance, runbooks
.claude/               the agent team, skills, commands and guard hooks
.github/               CI, deploy, agent runs, issue form, PR template
```

Start with `docs/setup.md`. It lists the human steps in order.

## How work flows

1. A human writes an issue with the Work item form and labels it (`risk:*`, `data:*`, `agent-eligible`).
2. A human adds `ready-for-agents`. The agent-run workflow starts the Chief of Staff on it.
3. R0 and R1 items go straight to build. R2 and R3 stop at `plan-review` until a human adds `plan-approved`.
4. Specialists build, QA tests, the Challenger reviews, the Release manager opens a PR with evidence.
5. A human reviews and merges. The deploy workflow ships to staging automatically, then waits for a human approval before production.
