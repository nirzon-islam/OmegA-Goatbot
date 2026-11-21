# OmegA-FCA integration status

Reviewed branch: `fca-migration-cleanup`  
Reviewed repository: `nirzon-islam/OmegA-Goatbot`  
Current package pin: `@nirzon-islam/omega-fca@0.1.6-rc.2`

## Implemented in this branch

- Added a GoatBot-side FCA adapter boundary in `bot/login/omegaFca.js`.
- Normalizes the legacy FCA `read` event name to the GoatBot dispatcher's `read_receipt`.
- Adapts legacy `sendMessage(message, threadID, replyID)` calls to FCA's callback/reply-argument signature.
- Added synthetic integration tests for package exports, event-name normalization, listener adaptation, and the positional reply-ID adapter.
- Added the integration test to the runtime recovery GitHub Actions workflow.
- Preserved the package lock at the latest package version available from the configured npm registry. The attempted `0.1.6-rc.3` install returned npm `ETARGET` (no matching version), so this branch remains pinned to `rc.2`.

## Verified CI

Runtime recovery workflow passed on Node 20, including:

- `npm install`
- `npm run test:secure-session`
- `npm run test:fca-integration`
- syntax checks for login, FCA adapter, and agent worker
- package adapter require smoke test

The integration test suite intentionally records two TODO gaps that the published `rc.2` package cannot satisfy:

1. Read-receipt actor/user ID aliases are not exposed in the normalized event in a form GoatBot can reliably consume.
2. Quoted reply content is not exposed as the nested legacy `event.messageReply` object.

These cannot be safely fabricated in the Bot adapter after the package has discarded the source fields. They require a corrected FCA package release and a dependency/lockfile update.

## Remaining Step 10 acceptance blockers

- Publish the corrected FCA package version, then update this branch's package and lockfile to that exact published version.
- Verify read-receipt actor aliases and nested quoted reply payloads against the published package.
- Complete bounded pagination parity for the existing `getThreadList(9999999, ...)` and `getThreadHistory(..., 1000)` call sites.
- Verify generic attachment-stream sends used by commands such as `leaderboard.js`.
- Run the authorized Facebook/AppState acceptance flow for login, MQTT listener stability, inbound events, text/reply sends, attachment sends, and group actions.

A green synthetic CI run is not a live Facebook acceptance result. No account credentials or AppState were used in these tests.
