---
name: release
description: Procedure to prepare a release candidate and rollback plan. Use when promoting a build to staging or production.
---
1. Confirm all required checks are green on the PR and the human approval exists.
2. Update CHANGELOG.md and tag the release candidate.
3. Deploy to staging through the pipeline, run smoke and isolation canary checks.
4. Write the rollback plan (previous revision, migration reversibility) into the PR.
5. Production promotion is a human approved environment gate. Do not run it.
