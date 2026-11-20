# OmegA-FCA integration

The `fca-migration-cleanup` branch routes GoatBot's login entrypoint through
`@nirzon-islam/omega-fca` using `bot/login/omegaFca.js`.

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

The dependency is `@nirzon-islam/omega-fca` from GitHub Packages. The
repository `.npmrc` maps `@nirzon-islam` to `https://npm.pkg.github.com`.
Set `NODE_AUTH_TOKEN` in Railway/Render to a GitHub token with
`read:packages` access. Never commit the token or any Facebook session data.

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
