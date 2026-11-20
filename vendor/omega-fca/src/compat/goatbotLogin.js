"use strict";

const { loadAccountConfig } = require("../auth/accountConfig");
const { generateTotp } = require("../auth/totp");

function fromAccountConfig(config) {
  if (config.mode === "appstate") return { mode: "appstate", appState: config.appState };
  return {
    mode: "credentials",
    ...(config.username ? { username: config.username } : { email: config.email }),
    password: config.password,
    twoFactorSecret: config.twoFactorSecret || null,
    twoFactorCode: config.twoFactorSecret ? generateTotp(config.twoFactorSecret) : null,
    userAgent: config.userAgent || null,
    proxy: config.proxy || null
  };
}

function createGoatBotLogin(client, accountConfigOptions = {}) {
  if (!client || typeof client.login !== "function") throw new TypeError("OmegA-FCA client is required");

  return function goatBotLogin(credentials, options, callback) {
    if (typeof options === "function") {
      callback = options;
      options = {};
    }
    if (typeof callback !== "function") throw new TypeError("GoatBot login callback is required");
    const input = credentials && typeof credentials === "object" ? credentials : {};
    let loginInput;
    if (Array.isArray(input.appState)) {
      loginInput = { mode: "appstate", appState: input.appState };
    } else if ((typeof input.username === "string" || typeof input.email === "string") &&
        typeof (input.password || input.pass) === "string") {
      loginInput = {
        mode: "credentials",
        ...(typeof input.username === "string" && input.username.trim()
          ? { username: input.username.trim() }
          : { email: input.email }),
        password: input.password || input.pass,
        twoFactorSecret: input.twoFactorSecret || input["2FASecret"] || null,
        twoFactorCode: input.twoFactorCode || input.twoFactorCodeOrCode || input.twoFactorSecretOrCode || input["2FACode"] || ((input.twoFactorSecret || input["2FASecret"]) ? generateTotp(input.twoFactorSecret || input["2FASecret"]) : null),
        userAgent: input.userAgent || null,
        proxy: input.proxy || null
      };
    } else if (Object.keys(input).length === 0) {
      try {
        // account.txt is cookie-only; credentials and TOTP configuration live in config.json.
        loginInput = fromAccountConfig(loadAccountConfig(accountConfigOptions));
      } catch (error) {
        callback(error);
        return Promise.resolve(null);
      }
    } else {
      const error = new TypeError("GoatBot login requires AppState, credentials, or an empty input to load account.txt/config.json");
      error.retryable = false;
      callback(error);
      return Promise.resolve(null);
    }

    return client.login(loginInput, options || {}).then(
      api => { callback(null, api); return api; },
      error => { callback(error); return null; }
    );
  };
}

module.exports = { createGoatBotLogin };
