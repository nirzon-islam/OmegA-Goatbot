# OmegA-FCA integration

GoatBot loads OmegA-FCA as a normal npm dependency, through the small
compatibility adapter at `bot/login/omegaFca.js`.

## Runtime mode: native AppState/MQTT (experimental)

- GoatBot calls OmegA-FCA's callback-compatible login adapter.
- The library accepts the owner's AppState from `account.txt`.
- OmegA-FCA owns the native Messenger MQTT connection/client lifecycle.
- Email/password login remains deferred.
- The native Facebook transport is experimental and is not production-ready
  until an owner-authorized live login, receive, send, reconnect and recovery
  test succeeds.

## Package dependency

`package.json` pins the compatible version range:

```json
"@nirzon-islam/omega-fca": "^0.1.3"
```

The package is installed from GitHub Packages using the scope mapping in
`.npmrc`. GitHub Actions authenticates with its short-lived
`GITHUB_TOKEN` and requires the package to grant this repository Actions
read access. A private package also requires the deployment builder to have
read-package credentials; a private package cannot be downloaded anonymously.
Never put a personal token in source code or commit it to the repository.

## Deploy and verify

```sh
npm install
npm run test:secure-session
npm start
```

Use an owner-authorized AppState only. Never commit or share AppState, cookies,
passwords, 2FA seeds, or private message contents.
