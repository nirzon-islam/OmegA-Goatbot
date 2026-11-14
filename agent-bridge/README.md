# Railway Agent Bridge

The `!agent` command is loaded through the existing command loader. It submits a plain-language request to Agent Backend. The backend AI planner converts the request into a restricted action or a bounded multi-step plan; the Owner must approve the exact plan before the worker can claim it.

The background worker is started from `EryXenX.js` only when both `AGENT_BRIDGE_ENABLED=true` and `AGENT_WORKER_ENABLED=true`. The command itself requires `AGENT_BRIDGE_ENABLED=true` and the sender ID to be present in `AGENT_ALLOWED_SENDER_IDS`.

## Supported actions

- `read`: read one regular file under `languages/`.
- `list`: list supported `.lang` and `.js` files under a language directory.
- `readMany`: read bounded supported files under a language directory.
- `create`: create a new `.lang` or `.js` file under `languages/`; never overwrites.
- `edit`: update an existing supported file under `languages/`; creates a content-addressed backup first.
- `test`: compile-check a JavaScript file with `vm.Script`; it does not execute it.
- `plan`: sequentially execute 1-12 validated steps after the Owner approves the complete plan.

No shell, eval, package scripts, arbitrary test runners, delete, install, or runtime code paths are supported. Individual file reads and writes are limited to 64 KiB. Directory reads are bounded to 30 files and 30 KiB combined content. Symlinks and hidden paths are skipped/rejected. The workspace allowlist is deliberately limited to `languages/`.

## Approval and execution flow

1. `!agent <request>` submits the sender-scoped request to the signed backend API.
2. The backend planner validates the structured action/plan and creates one Owner approval record.
3. The Owner approves or rejects the exact plan in the backend dashboard.
4. The Railway worker polls the approved-task queue, claims the task once, and executes the approved payload.
5. The worker reports the bounded result; the Owner dashboard and `!agent status <taskId>` can show task status.

The executor never derives commands or file paths from the original free-text request. Only the exact action stored in the backend approval record and returned by the single-use claim endpoint is passed to the executor.

## Required runtime settings

Set these in Railway Variables only after the backend integration tests and database transaction checks pass:

- `AGENT_BRIDGE_ENABLED=false` initially; set true only after backend is verified.
- `AGENT_WORKER_ENABLED=false` initially; set true only when approved execution is intentionally enabled.
- `AGENT_BACKEND_URL`: deployed backend base URL, without a trailing slash.
- `AGENT_BRIDGE_SECRET`: same randomly generated 32+ character secret as backend `BRIDGE_SECRET`.
- `AGENT_ALLOWED_SENDER_IDS`: comma-separated Facebook sender IDs allowed to submit requests.
- `AGENT_WORKSPACE_ROOT`: intended deployed bot workspace; verify it resolves to the checked-out repository.

Backend must also have matching `BRIDGE_SECRET`, the same sender allowlist, `BRIDGE_ENABLED=true`, and a configured AI provider. MongoDB must support replica-set transactions.

## Verification status

Unit tests and syntax checks run in GitHub Actions. They do not replace a live MongoDB replica-set integration test or an end-to-end test across backend, dashboard approval, Railway worker, and task result reporting. Keep both worker flags false until those runtime checks pass.

Do not replace or edit the bot's existing `config.json` as part of bridge setup. The bridge uses the environment variables above and remains isolated from existing login/session and command configuration.
