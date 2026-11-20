# OmegA-FCA integration

The `fca-migration-cleanup` branch routes GoatBot's login entrypoint through
`@omega/fca` using `bot/login/omegaFca.js`.

## Current mode: native AppState/MQTT integration (experimental)

This is an integration milestone, not a claim that the native Facebook
transport is production-ready:

- GoatBot calls the OmegA-FCA callback-compatible login adapter.
- OmegA-FCA validates and normalizes the supplied AppState and owns the
  connection/client lifecycle facade.
- The actual Facebook login and Messenger listener are temporarily supplied
  by the existing `@eryxenx/fca` package through
  `createLegacyFcaProvider`.
- The existing `@eryxenx/fca` dependency is intentionally retained until the
  native OmegA-FCA transport passes live account acceptance.
- Email/password login remains deferred. This branch continues to use the
  existing AppState/account.txt path.

This arrangement allows GoatBot's public API boundary to migrate first while
keeping the current Messenger transport in place. It must not be described as
a fully native OmegA-FCA Facebook connection.

## Deploy and verify

On the `fca-migration-cleanup` branch:

```sh
npm install
npm run test:secure-session
npm start
```

Check that startup logs report the installed `@omega/fca` version and the
native AppState/MQTT transport (experimental). Then verify with an owner-authorized AppState:

1. Login returns the expected account ID.
2. MQTT listener starts and receives a test message.
3. A reply can be sent to the test conversation.
4. Thread lookup, group actions, reactions and read receipts are checked
   individually where supported by the legacy transport.
5. Session recovery and listener restart still work.

Do not share or commit AppState, cookies, passwords, 2FA seeds, or private
message contents. Do not switch to a native transport until its own
authenticated live test succeeds.
