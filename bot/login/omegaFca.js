"use strict";

// OmegA-FCA is the public API boundary used by GoatBot. Until its native
// personal-account transport passes live acceptance, this branch deliberately
// injects the existing FCA implementation as a compatibility transport.
// This keeps the migration explicit and reversible without claiming that the
// native Facebook protocol is already production-ready.
const legacyLogin = require("@eryxenx/fca");
const {
  createClient,
  createLegacyFcaProvider,
  createGoatBotLogin
} = require("@omega/fca");

const client = createClient({
  authenticate: createLegacyFcaProvider({
    login: legacyLogin,
    options: { forceLogin: false },
    timeoutMs: 45_000
  }),
  reconnect: {
    maxAttempts: 3,
    initialDelayMs: 1_000,
    maxDelayMs: 15_000
  }
});

module.exports = createGoatBotLogin(client);
