title: Sign in with Identity Platform and a tenant claim
labels: risk:R3,data:synthetic,agent-eligible
---
### Outcome
Users sign in, and every API request runs as exactly the tenants that user may see.

### Acceptance criteria
- [ ] Identity Platform (email link or Google sign in) in staging and production, configured in Terraform.
- [ ] API verifies the ID token on every route except `/healthz`, maps the user to tenants through `app.membership`, and sets the session setting used by `app.visible_tenants()` inside a transaction.
- [ ] Requests without a valid token get 401. A user with no membership gets 403.
- [ ] Tests with locally signed test tokens. No real accounts in tests.
- [ ] Cost line in the PR (Identity Platform free tier limits).
