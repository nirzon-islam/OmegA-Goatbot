"use strict";

const API_METHODS = Object.freeze([
  "sendMessage", "getUserInfo", "getThreadInfo", "getThreadList", "markAsRead",
  "setMessageReaction", "sendTypingIndicator", "unsendMessage", "changeNickname",
  "addUserToGroup", "removeUserFromGroup", "createNewGroup", "getThreadHistory",
  "getMessage", "getFriendsList", "getUserID"
]);

function callbackLogin(login, input, options, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => finish(new Error("Legacy FCA login timed out")), timeoutMs);
    function finish(error, api) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error instanceof Error ? error : new Error(String(error)));
      else if (!api || typeof api.listenMqtt !== "function" ||
          typeof api.getCurrentUserID !== "function") {
        reject(new Error("Legacy FCA returned an incompatible personal-account API"));
      } else resolve(api);
    }
    try { login(input, options, finish); }
    catch (error) { finish(error); }
  });
}

/**
 * Adapts an existing personal-account FCA implementation to OmegA-FCA's
 * transport contract. The caller supplies the FCA login function explicitly;
 * this package does not claim to implement Facebook's private login/MQTT wire
 * protocol itself.
 */
function createLegacyFcaProvider({ login, options = {}, timeoutMs = 45_000 } = {}) {
  if (typeof login !== "function") throw new TypeError("A legacy personal-account FCA login function is required");
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 180_000) {
    throw new TypeError("timeoutMs must be an integer between 1000 and 180000");
  }

  return async function authenticate({ mode, credentials, options: clientOptions = {} } = {}) {
    let input;
    if (mode === "appstate") {
      input = { appState: credentials.map(cookie => ({ ...cookie })) };
    } else if (mode === "credentials") {
      input = {
        ...(credentials.username ? { username: credentials.username } : { email: credentials.email }),
        password: credentials.password,
        twoFactorSecret: credentials.twoFactorSecret || undefined,
        twoFactorCode: credentials.twoFactorCode || undefined,
        userAgent: credentials.userAgent || undefined,
        proxy: credentials.proxy || undefined
      };
    } else {
      throw new TypeError("Legacy FCA adapter supports appstate and credentials login");
    }

    const api = await callbackLogin(login, input, { ...options, ...clientOptions }, timeoutMs);
    let listenerStop = null;
    let disconnected = false;
    const driver = {
      getCurrentUserID: () => api.getCurrentUserID(),
      listen(callback) {
        if (disconnected) throw new Error("Legacy FCA session is disconnected");
        if (typeof callback !== "function") throw new TypeError("event callback is required");
        if (listenerStop) throw new Error("Legacy FCA listener is already active");
        const returned = api.listenMqtt((error, event) => callback(error || null, event));
        listenerStop = () => {
          const stop = listenerStop;
          listenerStop = null;
          if (typeof api.stopListening === "function") {
            try { api.stopListening(() => {}); } catch {}
          } else if (typeof returned === "function") {
            try { returned(); } catch {}
          } else if (returned && typeof returned.stop === "function") {
            try { returned.stop(); } catch {}
          }
          return Boolean(stop);
        };
        return listenerStop;
      },
      async disconnect() {
        if (disconnected) return;
        disconnected = true;
        if (listenerStop) listenerStop();
      }
    };

    for (const method of API_METHODS) {
      if (typeof api[method] === "function") driver[method] = api[method].bind(api);
    }
    // createClient's sendMessage facade uses the promise-based transport
    // contract. Bridge it to classic FCA's (message, threadID, callback)
    // signature while preserving direct legacy calls used by adapter tests.
    if (typeof api.sendMessage === "function") {
      driver.sendMessage = (input, requestOptions) => {
        if (!input || typeof input !== "object" || Array.isArray(input) ||
            input.threadID == null || !Object.prototype.hasOwnProperty.call(input, "message")) {
          return api.sendMessage(input, requestOptions);
        }
        return new Promise((resolve, reject) => {
          let settled = false;
          const finish = (error, result) => {
            if (settled) return;
            settled = true;
            if (error) reject(error);
            else resolve(result);
          };
          let returned;
          try {
            returned = api.sendMessage(
              input.message,
              input.threadID,
              (error, result) => finish(error, result),
              input.replyToMessageID
            );
          } catch (error) {
            finish(error);
            return;
          }
          if (returned && typeof returned.then === "function") {
            returned.then(value => finish(null, value), finish);
          } else if (returned !== undefined && api.sendMessage.length < 3) {
            finish(null, returned);
          }
        });
      };
    }
    if (typeof api.sessionGuard === "function") driver.sessionGuard = api.sessionGuard.bind(api);
    if (typeof api.stopSessionGuard === "function") driver.stopSessionGuard = api.stopSessionGuard.bind(api);
    if (typeof api.setOptions === "function") driver.setOptions = api.setOptions.bind(api);
    return driver;
  };
}

module.exports = { createLegacyFcaProvider };
