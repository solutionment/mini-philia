---
name: migration
description: Procedure for writing a safe database migration with RLS and tests. Use for any change under db/migrations.
---
1. State the change as expand, migrate, contract. Only one phase per release.
2. New tenant table checklist: tenant_id first in keys, ENABLE and FORCE RLS, policy using the visible tenants function, grants to named roles, security_invoker views.
3. Write the migration file with a timestamp prefix and a header comment (work item, risk tier, rollback).
4. Write pgTAP tests: each role sees only its tenants, cross tenant read and write fail, anonymous role sees nothing.
5. Run migrations on the local test database, then the db tests, then the catalog check that fails on tables without RLS.
6. Record any SECURITY DEFINER function in docs/compliance/definer-functions.md.
