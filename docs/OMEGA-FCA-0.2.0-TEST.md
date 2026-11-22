# OmegA-FCA 0.2.0 — isolated GoatBot test

This is an opt-in test path. It does not change the default FCA provider.

## Fixed package version

`package.json` pins the optional dependency to exactly:

```text
@nirzon-islam/omega-fca@0.2.0
```

Install dependencies with Node.js 20:

```bash
npm install
npm ls @nirzon-islam/omega-fca
```

If npm reports that version 0.2.0 cannot be found, stop: the package is not available from the configured registry yet. Do not substitute a GitHub branch or a different version for this test.

## Enable only for the isolated test

1. Use a dedicated test Facebook account/session that you control. Keep its `account.txt` private and out of Git.
2. In the runtime `config.json`, set both flags to false for this test:
   - `e2ee.enable: false` — encrypted-thread integration is not part of this test.
   - `humanizer.enable: false` — the existing GoatBot humanizer integration is not yet verified against OmegA-FCA.
3. Set the environment variable:

   ```env
   OMEGA_FCA_PROVIDER=omega
   ```

4. Run the existing provider/session unit tests:

   ```bash
   npm run test:fca-provider
   npm run test:secure-session
   ```

5. Start the bot only after the package install and unit tests pass:

   ```bash
   npm start
   ```

Check logs for `@nirzon-islam/omega-fca v0.2.0 (omega)`, successful authenticated login, and an active MQTT listener. A successful process start alone is not a passing live test.

## Restore the default

Remove `OMEGA_FCA_PROVIDER` (or set it to `eryxenx`) and restart. The default `@eryxenx/fca` provider remains unchanged.

## Not covered

This test path intentionally does not claim E2EE, Signal/SKDM, encrypted group messaging/media, or GoatBot humanizer compatibility. Keep those disabled until separately implemented and verified. Do not use a production Facebook account for first live validation.
