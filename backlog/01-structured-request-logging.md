title: Structured request logging for the API
labels: risk:R0,data:synthetic,agent-eligible
---
### Outcome
Operators can see every API request in Cloud Logging with method, path, status, latency and a request id, so we can debug staging.

### Acceptance criteria
- [ ] Each request logs one JSON line with `severity`, `httpRequest` (method, url path, status, latency) and `requestId`, in the shape Cloud Logging understands.
- [ ] Query strings and bodies are never logged.
- [ ] A `x-request-id` header is accepted if present, generated if not, and echoed in the response.
- [ ] Unit tests cover the log shape and the header behaviour.

### Notes
First item. It exists to learn the loop end to end: take, build, challenge, PR, merge, staging, production approval. Keep it small.
