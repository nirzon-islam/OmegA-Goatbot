# Railway Agent Bridge

This bridge is intentionally isolated from GoatBot startup. It is not imported by
index.js, EryXenX.js, the login process, event handlers, or command loaders.

## Current executor contract

The executor accepts only an already-claimed, already-approved structured action:

- `read`: read a regular file under `languages/`.
- `create`: create a new `.lang` or `.js` file under `languages/`; never overwrites.
- `edit`: update an existing supported file under `languages/`; makes a content-addressed backup first.
- `test`: compile-check a JavaScript file with `vm.Script`; it does not execute it.

No shell, eval, package scripts, arbitrary test runners, delete, install, or runtime
code paths are supported. File size is limited to 64 KiB. Symlinks and hidden paths
are rejected. The allowlist is deliberately limited to `languages/` because the
copy repository contains sensitive bot login/session code, dashboard authentication,
and high-impact commands under other directories.

## Backend action payload examples

```json
{ "type": "read", "path": "languages/bn.lang" }
{ "type": "create", "path": "languages/new.lang", "content": "..." }
{ "type": "edit", "path": "languages/bn.lang", "content": "..." }
{ "type": "test", "path": "languages/cmds/en.js" }
```

Only the exact action stored in the backend approval record and returned by the
single-use claim endpoint may be passed to this executor. Never derive action data
from the free-text task description.

## Still not production-enabled

The executor is not wired into the bot process or an automatic polling loop. Before
enabling it, add backend action-schema validation at approval creation, bind task
type to action type, add integration tests against MongoDB replica-set transactions,
and verify deployment environment variables. No Railway service is started by this
code.


## Deployment preparation and credential hygiene

### Important: rotate exposed credentials before any deployment

The current tracked `config.json` contains credential material in fields for MongoDB, Pastebin, Google OAuth, and reCAPTCHA. Treat every value previously committed there as compromised, even if it is later blanked or removed. Revoke/rotate those credentials at their respective providers, review Git history, and do not reuse the old values. Also review Facebook account credentials and session files before sharing or deploying the repository. Never paste secrets into GitHub issues, PRs, or chat.

The bot's existing `config.json` currently stores several integrations directly in JSON. The `.env.example` in this directory documents the *new bridge variables only*; it does not magically move existing config values to environment variables. Do not delete or replace existing config fields until the bot's config loader has been deliberately migrated and tested.

### Bridge status

The bridge is a scaffold only. It is not wired into the Messenger command loader or bot startup, and backend request intake/planning is not complete. Keep `AGENT_BRIDGE_ENABLED=false`. Do not set a live bridge secret or run a worker until the backend integration and sender authorization are implemented and tested.

### Railway manual setup (when integration is complete)

- Runtime: Node.js 20.x.
- Start command: `npm start`.
- Add bridge variables from `.env.example` in Railway Variables.
- `AGENT_BACKEND_URL` must be the deployed backend base URL (no trailing slash).
- Use the exact same randomly generated `AGENT_BRIDGE_SECRET` / backend `BRIDGE_SECRET`, 32+ characters.
- Set `AGENT_WORKSPACE_ROOT` only to the intended bot workspace; verify it resolves to the deployed checkout.
- Do not enable the worker until the owner/sender allowlist and approval path are verified.

This project has not been deployed or runtime-integrated by this preparation.
