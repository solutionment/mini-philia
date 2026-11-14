# ADR 0001: One PostgreSQL database with forced row level security

Status: accepted
Date: 2026-11-07
Risk tier: R3

## Context
Philia serves a three tier tenancy: platform operator, agency partner, nonprofit client. SOC 2 and PII are required and trust in the data is the product.

## Decision
One Cloud SQL for PostgreSQL 16 database per environment (see ADR 0002). Schemas bronze, silver, gold, app, audit, ai. Every tenant table leads its keys with tenant_id, enables and forces RLS, and uses a policy built on a stable visible tenants function. Views are security_invoker. SECURITY DEFINER functions are on a reviewed list.

## Consequences
Continuous proof through a catalog check, pgTAP role tests, cross tenant fuzzing and a production canary tenant pair. Because keys lead with tenant_id, a tenant can later move to a schema or its own database without a redesign.

## Rollback
Not applicable at project start. Revisit through a new ADR.
