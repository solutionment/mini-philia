title: Gold releases behind a quality gate
labels: risk:R2,data:synthetic,agent-eligible
---
### Outcome
Fundraising numbers are published as versioned releases that only exist if they pass the quality gate.

### Acceptance criteria
- [ ] `gold.release` (tenant_id, version, created_at, source file hashes, gate result) and release scoped metric tables: donors, total given, gifts by month, retention year over year.
- [ ] Gate checks: reconciliation with silver totals, reject rate under a threshold, no future dates. A failing gate stores the result and publishes nothing.
- [ ] Every metric row traces to the file hashes of its release.
- [ ] Tests for pass and fail cases using the synthetic fixtures.
