# Work intake (GitHub issues)

See ADR 0003. Work items are issues created with the Work item form.

## Labels

| Label | Meaning | Who sets it |
|---|---|---|
| `risk:R0` to `risk:R3` | Risk tier, exactly one | Human, Chief of Staff may raise |
| `data:synthetic`, `data:masked`, `data:pii` | Data class, exactly one. Agents only take `synthetic` or `masked` | Human |
| `agent-eligible` | Agents may work on it | Human |
| `ready-for-agents` | Definition of Ready met, start now | Human (write access) |
| `needs-info` | Chief of Staff found gaps, see comment | Chief of Staff |
| `plan-review` | R2 or R3 plan posted, waiting on a human | Chief of Staff |
| `plan-approved` | Human approved the plan, build may start | Human (write access) |
| `in-progress`, `in-review` | Status for the board | Agents |

## Flow

```
Backlog -> (human labels) -> ready-for-agents -> Chief of Staff
   R0, R1: build -> PR (in-review) -> human merge -> deploy staging -> human approves production
   R2, R3: plan -> plan-review -> human adds plan-approved -> build -> PR -> ...
   gaps:   needs-info -> human fixes issue -> re-adds ready-for-agents
```

## Running agents
- **In GitHub Actions:** adding `ready-for-agents` or `plan-approved` runs `.github/workflows/agent-run.yml`.
- **Interactively:** in Claude Code, run `/take <issue number>`. This is the best way to learn the process: you watch every step.
