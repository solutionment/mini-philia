# Cost guardrails

Cap: 100 USD per month across the billing account. Trial credit: 300 USD for 90 days, starting 2026-11-14.

## What runs and what it costs (estimate, us-central1)

| Resource | Setting | Idle monthly cost |
|---|---|---|
| Cloud SQL staging | ENTERPRISE, db-f1-micro, 10 GB SSD, zonal, 7 backups | about 9 to 11 USD |
| Cloud SQL production | same | about 9 to 11 USD |
| Cloud Run (api, later web) | min 0, max 2 instances, CPU only during requests | 0 within the free tier |
| Artifact Registry | one repo, keep last 10 images | under 1 USD |
| Cloud Storage | tfstate and app buckets, standard, a few GB | under 1 USD |
| Secret Manager | a handful of secrets | under 1 USD |
| Budget guard function and Pub/Sub | event driven | 0 within the free tier |
| Env reporter function and Cloud Scheduler job | every 15 minutes, read only | 0 (3 free Scheduler jobs per billing account, invocations within the free tier) |
| Vertex AI (Claude) | pay per token, staging and production only | depends on use, keep evals small |
| Logging | default retention, under 50 GiB | 0 |

Expected baseline: 20 to 30 USD per month before AI tokens.

## Budget and alerts
- One budget on the billing account: 100 USD per month, measured **excluding credits**, so the alerts reflect real usage even while the trial credit pays the bill.
- Email alerts at 25, 50, 90 and 100 percent of actual spend, and at 100 percent of forecasted spend.
- At 100 percent of actual spend the budget guard function:
  - stops every Cloud SQL instance in staging and production (activation policy NEVER, data kept), and
  - sets every Cloud Run service in those projects to internal ingress only, which stops public traffic.
- To recover: raise the budget or wait for the new month, then run `infra/bootstrap/resume.sh`.

Budget alerts can lag spend by several hours. The guard is a safety net, not a meter.

## Rules for every change
1. No resource with an idle cost without an ADR: GKE, AlloyDB, Memorystore, Cloud NAT, load balancers, Serverless VPC Access connectors, Cloud Run min instances above zero, Cloud SQL Enterprise Plus or HA.
2. Cloud SQL must set `edition = "ENTERPRISE"` and an explicit tier. The default edition for new PostgreSQL 16 instances can be Enterprise Plus, which costs many times more.
3. Every Cloud Run service sets `max_instance_count`.
4. Every bucket and registry has a lifecycle or cleanup policy.
5. AI evals run on small golden sets and only on PRs that touch `ai/`.
6. A PR that adds a resource states its monthly cost in the PR body.

## When the trial ends
Trial credit expires after 90 days or when used up. To keep running you upgrade the billing account to paid. Remaining credit carries over. Some partner models in Model Garden (Claude included) may need a paid account before they can be enabled; setup.md covers the check.
