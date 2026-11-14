title: Tenancy foundation with forced RLS and isolation tests
labels: risk:R3,data:synthetic,agent-eligible
---
### Outcome
The database enforces tenant isolation on its own, so no code bug can read or write another tenant's rows.

### Acceptance criteria
- [ ] Migration runner (plain SQL files in `db/migrations`, expand and contract, recorded in a migrations table) runnable locally and from the deploy workflow as a Cloud Run job.
- [ ] Schemas bronze, silver, gold, app, audit, ai. `app.tenant` table and a stable `app.visible_tenants()` function driven by a session setting set per request.
- [ ] Every tenant table: `tenant_id` leads the primary key, RLS enabled and forced, policy uses `app.visible_tenants()`.
- [ ] Separate roles: migration owner, app runtime (the IAM user, not owner, no BYPASSRLS).
- [ ] Catalog check test fails if any table in those schemas lacks forced RLS.
- [ ] pgTAP tests: tenant A cannot select, insert, update or delete tenant B rows. CI runs them against a Postgres 16 service container.
- [ ] ADR for the migration runner choice.

### Notes
R3: the human drives and approves every step. The plan stops at plan-review.
