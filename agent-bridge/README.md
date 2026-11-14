# Railway Agent Bridge (scaffold)

This folder is an isolated integration scaffold. It is intentionally **not started**
by GoatBot and does not modify the Messenger login, event handlers, command loader,
database, or existing uptime server.

## Current compatibility finding

The current Agent Backend Bridge API uses signed requests with these headers:

- `X-Agent-Timestamp`
- `X-Agent-Nonce`
- `X-Agent-Signature`

The signature is HMAC-SHA256 over:

```text
timestamp + "\n" + nonce + "\n" + METHOD + "\n" + originalUrl + "\n" + sha256(rawBody)
```

Its current `POST /api/bridge/claim` endpoint requires a known `taskId`.
The current Railway copy has no approved-task queue consumer, and the backend
does not yet expose a task-discovery endpoint or push callback. Therefore the
worker cannot safely discover approved work yet.

## Environment (do not commit values)

- `AGENT_BACKEND_URL`: HTTPS URL of the Render Agent Backend
- `AGENT_BRIDGE_SECRET`: same high-entropy secret configured as `BRIDGE_SECRET`
- `AGENT_WORKSPACE_ROOT`: optional workspace root (defaults to repository root)

## Guardrails

- No shell execution, eval, dynamic code loading, or arbitrary package scripts.
- File access is limited to explicitly allowed project subdirectories.
- Bot session files, login code, Git internals, dependencies, and environment files
  are protected.
- A regular-file backup helper is provided for pre-change snapshots.
- This scaffold is not production-ready until the backend task discovery/callback
  contract, exact approved action schema, result reporting, and end-to-end tests
  are implemented and verified.

Do not enable or deploy this integration until those dependencies are complete.
