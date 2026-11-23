# Step 10 — GoatBot / OmegA-FCA Integration

## Integrated provider

- GoatBot loads only `@nirzon-islam/omega-fca` through `bot/login/fcaProvider.js`.
- There is no EryXenX/legacy provider fallback.
- Startup AppState is parsed and validated before login: bounded cookie count/size, Facebook cookie domains, `c_user` and `xs`.
- Session recovery uses an isolated OmegA login, verifies the returned account ID, waits for MQTT readiness, then atomically swaps `account.txt`; rollback restores the previous state if activation fails.
- Humanizer options are mapped from GoatBot config and re-applied after listener starts/restarts and account recovery.
- OmegA's optional Signal runtime is wired through the FCA login options and is disabled by default.

## Optional local Signal runtime

Set `config.json` `e2ee.enable` to `true` only when the deployment has a compatible libsignal module. Supply these environment variables through the deployment secret manager:

- `OMEGA_E2EE_ENCRYPTION_KEY`: base64 encoding of exactly 32 random bytes. Keep it private and stable for the account's encrypted key store.
- `OMEGA_E2EE_DEVICE_ID`: positive integer local device ID.
- `OMEGA_E2EE_SIGNAL_MODULE`: installed Node module name exporting a compatible `PrivateKey.generate()`.
- `OMEGA_E2EE_STORAGE_PATH`: optional private persistent directory; defaults to `data/e2ee`. A separate account-ID subdirectory is created by the integration.

If any required setting is absent or invalid, startup/recovery fails closed with a configuration error; it does not silently downgrade an enabled E2EE request.

**Protocol boundary:** OmegA-FCA currently initializes local Signal identity, key store, direct-message/group/action helpers. This is not Facebook device registration, peer bundle exchange, Messenger MQTT E2EE envelope handling, or proof of native Messenger DM/group/media interoperability. Do not mark Messenger-native E2EE as live/verified based on this local runtime.

## Verification

The `Runtime recovery tests` workflow runs provider/session tests and syntax checks on `fca-migration-cleanup`. Live Facebook login, account swap, and native E2EE interoperability still require an authorized live test account and are not simulated by CI.
