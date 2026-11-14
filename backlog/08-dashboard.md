title: Tenant dashboard for the latest gold release
labels: risk:R1,data:synthetic,agent-eligible
---
### Outcome
A signed in user sees their organisation's key fundraising numbers from the latest gold release, and where they came from.

### Acceptance criteria
- [ ] `apps/web` React app (Vite) served from Cloud Run, scale to zero, follows docs/design.
- [ ] Shows release version, gate status, KPI tiles and gifts by month chart, plus the source file names and hashes.
- [ ] Upload page that calls `POST /uploads` and shows processing status.
- [ ] Playwright test and axe accessibility check in CI. Screenshots in the PR.
