# GH-7 Structured request logging for the API

Risk tier: R1 (raised from R0, the change alters runtime behaviour of every response). Data: synthetic.

## Plan
- `apps/api/src/logging.ts` wraps the existing handler. One JSON line per request: `severity`, `httpRequest` (`requestMethod`, `requestUrl` path only, `status`, `latency` such as "0.012s"), `requestId`.
- `x-request-id` is accepted if it matches `[A-Za-z0-9._-]{1,128}`, otherwise generated with `randomUUID()`, and always echoed in the response.
- Query strings and bodies are never read or logged.
- Severity: 5xx ERROR, 4xx WARNING, otherwise INFO. Client aborts are logged once on close with status 499. A throwing handler gets a 500 and an ERROR line.
- Tests with an injected log sink cover shape, severity, path-only URL, and header accept, generate, replace, length limit and echo.
