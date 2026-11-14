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
