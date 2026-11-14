# ADR 0003: GitHub issues and labels as the work intake

Status: accepted
Date: 2026-11-14
Risk tier: R2

## Context
The Philia design used Azure Boards with a custom bridge function to start agents. On Google Cloud there is no reason to keep Azure DevOps, and a bridge is one more thing to secure.

## Decision
Work items are GitHub issues created with the Work item form. Fields that Azure Boards held are labels: `risk:R0` to `risk:R3`, `data:synthetic` / `data:masked` / `data:pii`, `agent-eligible`. States are labels too: `ready-for-agents`, `plan-review`, `plan-approved`, `needs-info`. A GitHub Project board shows the flow for humans.

Only people with triage access or higher can add labels, and the agent-run workflow also checks that the person who added the label has write access. That replaces the bridge's shared secret.

Project board item events cannot trigger GitHub Actions, which is why labels, not board columns, start the agents.

## Consequences
No bridge to run. Issue numbers replace AB numbers in branches and commits. Moving to Claude Teams later changes nothing here.

## Rollback
Re-introduce a tracker by ADR. Labels stay as history.
