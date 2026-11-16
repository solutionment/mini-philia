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

## Evidence log

Pull requests merged to main, with the control area each one gives evidence for. Review history on each PR shows the named human approval and the required checks.

### Week of 2026-11-09 to 2026-11-15

| PR | Title | Area | Evidence |
|---|---|---|---|
| [#1](https://github.com/solutionment/mini-philia/pull/1) | Bootstrap Mini Philia | Change management, Network, Encryption | PR review and checks, Terraform in `infra/terraform` |
| [#3](https://github.com/solutionment/mini-philia/pull/3) | Studio reporting: deploys, environment stats, delivery and release reports | Monitoring, Processing integrity | PR review and checks |
| [#4](https://github.com/solutionment/mini-philia/pull/4) | Promote workflow | Change management | PR review, approval gate in `promote.yml` |
| [#5](https://github.com/solutionment/mini-philia/pull/5) | Gemini first for in product AI | Vendor management | PR review, ADR 0006 |
| [#6](https://github.com/solutionment/mini-philia/pull/6) | Carry #5 to main | Vendor management | PR review |
| [#16](https://github.com/solutionment/mini-philia/pull/16) | Bind deployers to the environment claim | Logical access | PR review, Workload Identity Federation binding |
| [#17](https://github.com/solutionment/mini-philia/pull/17) | Show Claude Code output in agent runs | Change management | PR review and checks |
| [#18](https://github.com/solutionment/mini-philia/pull/18) | Keep agent run helpers in the foreground | Change management | PR review and checks |
| [#19](https://github.com/solutionment/mini-philia/pull/19) | Serve the health check at /health | Availability | PR review and checks |
