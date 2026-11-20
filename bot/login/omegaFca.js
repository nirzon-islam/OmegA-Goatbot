"use strict";

// Load the published OmegA-FCA package, just as GoatBot previously loaded
// its FCA provider package. Keep this adapter as the compatibility boundary.
const {
  createFacebookMqttClient,
  createGoatBotLogin
} = require("@nirzon-islam/omega-fca");

const client = createFacebookMqttClient({
  reconnect: {
    maxAttempts: 3,
    minDelayMs: 1_000,
    maxDelayMs: 15_000,
    factor: 2,
    jitter: 0.2
  },
  mqtt: {
    keepAlive: 60
  }
});

module.exports = createGoatBotLogin(client);
