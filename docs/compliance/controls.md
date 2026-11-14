# Control map (starter)

Maps SOC 2 areas to how Mini Philia and the Studio Suite meet them. Add evidence links as they appear.

| Area | Control | Evidence source |
|---|---|---|
| Change management | Branch protection, required checks, named human approval, work item to PR link | GitHub PR history, deployment records |
| Logical access | Google accounts with 2SV, GitHub org with 2FA required, CI on Workload Identity Federation (no keys) | Access reviews, audit logs |
| Encryption | TLS, Google managed encryption at rest, secrets in Secret Manager | Cloud Audit Logs |
| Network | Cloud Run is the only public surface, Cloud SQL has no authorized networks (connector plus IAM auth only) | Policy reports, topology as code |
| Monitoring | Alerts, canary tenant pair, runbooks | Alert history, incident records |
| Vulnerability mgmt | Code, dependency, secret and container scanning in CI | Scan results per PR |
| Availability | PITR tests, revision rollback, immutable bronze | Restore test reports |
| Vendor mgmt | Register of Google Cloud, GitHub, Anthropic, others with report dates | Vendor register |
| Processing integrity | Quality gates, reconciliation, lineage | Release records |
