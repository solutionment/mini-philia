# Risk tiers

| Tier | Typical change | Extra gates | Who decides |
|---|---|---|---|
| R0 | Copy, styling, docs, test only | Standard checks, short challenger pass | Human approves PR |
| R1 | New screen, endpoint or report within existing patterns | Full tests, accessibility, visual regression, full challenger review | Human approves PR |
| R2 | Schema change, new pipeline stage, prompt or model change, new connector | Design note and ADR, pgTAP isolation tests, migration rehearsal on staging, AI evals, security review | Human approves plan, then PR |
| R3 | Tenancy, RLS, authentication, encryption, audit, production access | All of R2, second reviewer model, cross tenant fuzz run, canary check, written rollback | Human drives and approves every step |

If unsure, choose the higher tier. The Chief of Staff may raise a tier, never lower one.
