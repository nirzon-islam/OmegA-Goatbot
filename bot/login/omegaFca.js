"use strict";

// Keep the GoatBot-specific legacy event aliases at this boundary. Older
// published FCA builds emit "read"; GoatBot's dispatcher consumes
// "read_receipt". The adapter keeps that compatibility local to this Bot.
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

const login = createGoatBotLogin(client);
const wrappedApis = new WeakMap();

function normalizeGoatBotEvent(event) {
  if (!event || typeof event !== "object") return event;
  if (event.type === "read") return { ...event, type: "read_receipt" };
  return event;
}

function wrapApi(api) {
  if (!api || typeof api !== "object" || typeof api.listenMqtt !== "function") return api;
  if (wrappedApis.has(api)) return wrappedApis.get(api);
  const wrapped = new Proxy(api, {
    get(target, property, receiver) {
      if (property === "listenMqtt") {
        return callback => {
          if (typeof callback !== "function") throw new TypeError("MQTT listener callback is required");
          return target.listenMqtt((error, event) => callback(error, normalizeGoatBotEvent(event)));
        };
      }
      return Reflect.get(target, property, receiver);
    }
  });
  wrappedApis.set(api, wrapped);
  return wrapped;
}

function goatBotLogin(credentials, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = {};
  }
  if (typeof callback !== "function") throw new TypeError("GoatBot login callback is required");
  return login(credentials, options || {}, (error, api) => {
    callback(error, error ? api : wrapApi(api));
  }).then(api => wrapApi(api));
}

goatBotLogin.normalizeGoatBotEvent = normalizeGoatBotEvent;
module.exports = goatBotLogin;
