# ADR 0006: Gemini first for in product AI, Claude once billing is upgraded

Status: accepted
Date: 2026-11-15
Risk tier: R2

## Context
ADR 0002 planned Claude on Vertex AI for the product's AI features. Claude on Vertex AI is sold through the Google Cloud Marketplace. A billing account on the free trial cannot buy Marketplace products ("Choose Different Billing Account"), and trial credit does not cover Marketplace usage. We want to stay on the trial for now.

## Decision
- The AI gateway calls Gemini on Vertex AI to start. Gemini needs no Marketplace agreement, the trial credit covers it, and the `api-runtime` account already has `roles/aiplatform.user`.
- Provider, model and location are configuration, set by Terraform: `AI_PROVIDER` (`gemini` or `claude`, default `gemini`), `AI_MODEL` (Model Garden ID, empty for the gateway default) and `VERTEX_LOCATION` (`global`).
- The gateway rules do not change with the provider: PII masked before any call, aggregates only, every call logged with prompt version and token counts, a per tenant daily token cap, and code checks every number in the output against the input.
- Prompts and the eval set must pass on both providers before anyone switches, so the switch is a configuration change plus an eval run, not a rewrite.

## Consequences
- Work item 09 builds the gateway against Gemini first, behind a provider interface with a Claude implementation ready to enable.
- To move to Claude: upgrade billing to paid, accept the Claude terms in Model Garden in both environment projects, run the eval on Claude, then set `ai_provider = "claude"` in the environment's tfvars in a pull request.
- The environment stats reporter's token metric covers both providers.

## Rollback
Set `ai_provider` back to the previous value in tfvars and deploy.
