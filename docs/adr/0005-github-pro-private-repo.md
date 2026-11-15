# ADR 0005: Private repository on GitHub Pro, production released by promote

Status: accepted
Date: 2026-11-15
Risk tier: R2

## Context
The repository lives under the `solutionment` GitHub account, which is a personal account, now on GitHub Pro. A public repository exposed design material we want to keep private. On a private repository, GitHub Pro supports rulesets, protected branches, code owner reviews and environments with branch policies, but not environment required reviewers (those stay public repository only on Free, Pro and Team). Code scanning and secret scanning push protection on private repositories need GitHub Advanced Security, which Pro does not include.

## Decision
- Make the repository private. The `main` ruleset (pull request, code owner review, `ci` check, linear history, no force push) keeps working.
- Production approval becomes the promote workflow (`.github/workflows/promote.yml`). Staging still deploys on every merge. A person releases to production by running promote, which only accepts a commit on `main` that staging deployed successfully, and reuses the exact image staging tested. Only people with write access can run workflows, and only Solutionment staff have write access. The repository variable `PRODUCTION_APPROVAL=promote` stops `deploy.yml` after staging. `scripts/github-setup.sh` sets this automatically for a private repository.
- Replace GitHub's code and secret scanning with free CI checks: gitleaks on every push and pull request, and `npm audit` (critical findings block). CodeQL keeps running automatically if the repository is ever public again.
- Release reports take the previous version from the running Cloud Run service, because GitHub deployment records on promote runs carry the workflow's commit rather than the released one.

## Consequences
- The production gate is "who may run promote" rather than a named reviewer. With one owner today this is the same person; when more staff join, give only release managers write access or move to an organization on GitHub Team plus Enterprise features if a named reviewer is required.
- Studio's "Approve in GitHub" link points to the promote workflow when the repository is private.
- Private repository Actions minutes count against the Pro allowance (3,000 minutes per month at the time of writing). Agent runs are the largest consumer; their timeout stays at 90 minutes.
- The closed handbook pull request and its commit are no longer publicly visible.

## Rollback
Make the repository public again, delete `PRODUCTION_APPROVAL`, and re-run `scripts/github-setup.sh` to add the production required reviewer. Production then waits inside the deploy run as before.
