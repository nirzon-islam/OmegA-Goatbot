"use strict";

// GoatBot now uses OmegA-FCA's first-party AppState + Messenger MQTT client.
// No legacy FCA provider is loaded here.
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
