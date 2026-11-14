# ADR 0002: Google Cloud as the platform for the pilot

Status: accepted
Date: 2026-11-14
Risk tier: R3

## Context
Philia was designed on Azure. Solutionment chose Google Cloud for data, AI, runtime and UX. We have 300 USD of trial credit for 90 days and a self imposed cap of 100 USD per month. We want the same invariants (tenancy, data trust, AI rules, no cloud access for agents, human approved merges and promotions).

## Decision
| Azure design | Google Cloud pilot |
|---|---|
| Subscriptions dev, staging, production | Projects `platform`, `staging`, `production`. Dev runs locally and in CI with a throwaway Postgres |
| PostgreSQL Flexible Server | Cloud SQL for PostgreSQL 16, ENTERPRISE edition, `db-f1-micro`, public IP with no authorized networks, IAM database auth through the Cloud SQL connector |
| Container Apps | Cloud Run, scale to zero, max instances capped |
| Blob | Cloud Storage |
| Key Vault | Secret Manager |
| Foundry | Vertex AI with Claude (Model Garden), Gemini as fallback through the same gateway |
| Bicep | Terraform, state in Cloud Storage in the platform project |
| Entra OIDC federation | Workload Identity Federation, one deployer service account per environment, bound to the GitHub environment subject |
| Azure Boards and the bridge function | GitHub issues and labels (ADR 0003) |

Private networking (VPC, Serverless VPC Access, NAT) is not used in the pilot because it has an idle cost. The database is reachable only through the connector with IAM auth and TLS.

## Consequences
Philia moves to the same pattern after the pilot. Its `infra/bicep` and `services/bridge` are retired then. The pilot proves keyless CI, the gated promotion and the budget guard before real data exists.

## Rollback
Projects can be deleted from the platform project down. No production data exists during the pilot.
