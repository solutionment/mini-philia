# ADR 0004: SolutionIQ Studio as the live control room

Status: accepted
Date: 2026-11-14
Risk tier: R2

## Context
People want to see agents working (code, UX, data) as it happens and drive the flow from one place. SolutionIQ Studio (Lovable, Lovable Cloud on Supabase) already holds the product definition. GitHub runs the agents and holds the gates.

## Decision
Studio's Build section mirrors GitHub and sends a small set of requests back. GitHub stays the system of record and the enforcer.

Inputs to Studio:
1. GitHub App webhooks (signed): issues, pull requests, reviews, checks, workflow runs and jobs, deployment status.
2. Agent activity from `.claude/hooks/emit-event.mjs`, sent with a write only bearer token (`STUDIO_INGEST_TOKEN`). The hook sends kind, agent, tool, repo relative path, a command category, issue number and run id. It never sends file contents, command text, tool output or prompts, and it never blocks the agent.
3. Google Cloud budget messages: Pub/Sub push subscription signed with a Google OIDC token from the `budget-push` service account.

Outputs from Studio, through a GitHub App with Issues write, Actions write (cancel runs), Variables write (pause) and read elsewhere, and no Contents or Administration rights:
- add `ready-for-agents` or `plan-approved`, create issues, cancel an agent run, set `AGENTS_PAUSED`.

Merging and production approval are never done from Studio. Studio links to GitHub, where rulesets and the environment reviewer check the human.

## Consequences
- The agent-run workflow refuses to start when `AGENTS_PAUSED` is `true`.
- Studio data is engineering activity only, stored in Lovable Cloud (Supabase), outside Google Cloud. No donor data or secrets flow to it.
- A Studio compromise exposes activity and could add labels or cancel runs. It cannot merge, deploy or read code.
- Cloud sessions that run agents need the Studio host on their network allowlist to send events. Without it, events are silently skipped.

## Rollback
Remove the hook entries from `.claude/settings.json`, uninstall the Studio GitHub App, delete the `studio-budget-push` subscription. Agents and pipelines keep working unchanged.
