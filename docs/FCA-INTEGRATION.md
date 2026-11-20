# OmegA-FCA integration

The `fca-migration-cleanup` branch routes GoatBot's login entrypoint through
the vendored OmegA-FCA source at `vendor/omega-fca/`, loaded by
`bot/login/omegaFca.js`.

## Current mode: native AppState/MQTT integration (experimental)

This is an integration milestone, not a claim that the native Facebook
transport is production-ready:

- GoatBot calls OmegA-FCA's callback-compatible login adapter.
- OmegA-FCA validates and normalizes the supplied AppState and owns the
  connection/client lifecycle facade.
- The native Messenger MQTT transport is experimental and still requires
  owner-authorized live acceptance against Facebook.
- Email/password login remains deferred. This branch continues to use the
  existing AppState/account.txt path.

## Package installation

OmegA-FCA is vendored inside this GoatBot branch, so deployment does not
fetch the private FCA repository or require `NODE_AUTH_TOKEN` / GitHub Packages
authentication. The runtime dependency `ws` is installed from the public npm
registry. The vendored copy is independent of the FCA repository's visibility;
when the FCA source changes, sync the updated source into this branch before
deploying. Never commit Facebook session data.

## Deploy and verify

On the `fca-migration-cleanup` branch:

```sh
npm install
npm run test:secure-session
npm start
```

Verify with an owner-authorized AppState:

1. Login returns the expected account ID.
2. MQTT listener starts and receives a test message.
3. A reply can be sent to the test conversation.
4. Thread lookup and each advertised action are checked individually.
5. Session recovery and listener restart still work.

Do not share or commit AppState, cookies, passwords, 2FA seeds, or private
message contents. Do not treat the native transport as production-ready
until its authenticated live test succeeds.
