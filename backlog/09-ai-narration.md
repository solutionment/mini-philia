title: AI narration of a gold release over masked data
labels: risk:R2,data:synthetic,agent-eligible
---
### Outcome
The dashboard shows a short plain language summary of the release, written by Claude on Vertex AI, from aggregates only, never from personal data.

### Acceptance criteria
- [ ] AI gateway module: masks PII, sends only release aggregates, logs prompt version and token counts to `ai.call_log`, enforces a per tenant daily token cap.
- [ ] Prompt in `ai/prompts/release-summary/v1` with a JSON output schema. Numbers in the text must match the input numbers, checked by code.
- [ ] Eval set in `ai/evals/release-summary` (at least 10 cases) with a scorer, run in CI only when `ai/` changes.
- [ ] Model and location are configuration (Claude via Vertex AI, Gemini as fallback through the same gateway).
- [ ] Cost estimate per summary in the PR.
