"use strict";

const { validateSessionCookies, parseCookieHeader } = require("../security/cookies");
const { ConnectionSupervisor } = require("../runtime/connection");
const { verifyLicenseToken } = require("../license/verify");
const { validateTransportDriver } = require("../transport/contract");
const { classifySessionState } = require("../security/sessionState");

const METHOD_FEATURES = Object.freeze({
  sendMessage: "messaging", sendRequest: "messaging", unsendMessage: "messaging", markAsRead: "messaging", sendTypingIndicator: "messaging",
  getUserInfo: "threads", getThreadInfo: "threads", getThreadList: "threads", getThreadHistory: "threads", getMessage: "threads", getFriendsList: "threads", getUserID: "threads",
  addUserToGroup: "groups", removeUserFromGroup: "groups", createNewGroup: "groups", changeNickname: "groups",
  setMessageReaction: "reactions"
});

const DRIVER_METHODS = [
  "sendRequest", "sendMessage", "getUserInfo", "getThreadInfo", "getThreadList", "getCurrentUserID",
  "markAsRead", "setMessageReaction", "sendTypingIndicator", "unsendMessage",
  "changeNickname", "addUserToGroup", "removeUserFromGroup", "createNewGroup",
  "getThreadHistory", "getMessage", "getFriendsList", "getUserID"
];

function createClient({ authenticate, options = {}, reconnect = {}, license = {}, requireLicense = false, onLicenseError = () => {} } = {}) {
  if (typeof authenticate !== "function") throw new TypeError("authenticate transport factory is required");
  let supervisor = null;
  let api = null;
  let userId = null;
  let verifiedLicense = null;
  let detachMqtt = null;
  let mqttErrorHandler = null;
  let licenseTimer = null;
  let licenseCheckPromise = null;
  let loginPromise = null;
  let logoutPromise = null;

  async function checkLicense() {
    if (!requireLicense) return null;
    if (licenseCheckPromise) return licenseCheckPromise;
    licenseCheckPromise = (async () => {
      const token = typeof license.refresh === "function" ? await license.refresh() : license.token;
      verifiedLicense = verifyLicenseToken(token, license.publicKey, {
        installationId: license.installationId,
        ownerId: license.ownerId
      });
      return verifiedLicense;
    })().finally(() => { licenseCheckPromise = null; });
    return licenseCheckPromise;
  }

  function startLicenseMonitor() {
    if (!requireLicense || licenseTimer) return;
    const interval = Number.isInteger(license.checkIntervalMs) && license.checkIntervalMs >= 30_000
      ? license.checkIntervalMs : 5 * 60 * 1000;
    licenseTimer = setInterval(async () => {
      try {
        await checkLicense();
      } catch (error) {
        clearInterval(licenseTimer);
        licenseTimer = null;
        try { if (supervisor) await supervisor.stop(); } catch {}
        supervisor = null;
        api = null;
        userId = null;
        try { onLicenseError(error); } catch {}
      }
    }, interval);
    if (typeof licenseTimer.unref === "function") licenseTimer.unref();
  }

  function stopLicenseMonitor() {
    if (licenseTimer) clearInterval(licenseTimer);
    licenseTimer = null;
  }

  async function performLogin(credentials = {}, loginOptions = options) {
    if (supervisor && supervisor.snapshot().connected) return api;
    if (supervisor && ["connecting", "reconnecting"].includes(supervisor.snapshot().state)) {
      throw new Error("A login attempt is already in progress");
    }
    if (supervisor && ["failed", "stopped"].includes(supervisor.snapshot().state)) {
      await supervisor.stop();
      supervisor = null;
    }
    await checkLicense();
    const mode = credentials.mode;
    let normalized;
    if (mode === "appstate") {
      normalized = validateSessionCookies(credentials.appState);
    } else if (mode === "cookie") {
      normalized = validateSessionCookies(parseCookieHeader(credentials.cookie));
    } else if (mode === "credentials") {
      throw new TypeError("Facebook email/username and password login is deferred; use an authorized AppState or cookie");
    } else {
      throw new TypeError("Login mode must be appstate or cookie");
    }

    let lastConnectError = null;
    supervisor = new ConnectionSupervisor({
      connect: async context => {
        let result;
        try {
          result = await authenticate({ mode, credentials: normalized, options: loginOptions || {}, context, license: verifiedLicense });
        } catch (caught) {
          // Provider-controlled messages and causes may echo credentials,
          // cookies, challenge answers, or tokens. Classify privately, then
          // expose only a fixed safe error to the application.
          const sessionState = classifySessionState(caught);
          const error = new Error(sessionState === "checkpoint"
            ? "Facebook requires the account owner to complete a checkpoint"
            : sessionState === "logged_out"
              ? "The Facebook session has expired; supply a fresh authorized AppState"
              : "Authentication failed; inspect provider diagnostics securely");
          if (sessionState === "checkpoint") {
            error.code = "FCA_CHECKPOINT_REQUIRED";
            error.sessionState = sessionState;
            error.retryable = false;
          } else if (sessionState === "logged_out") {
            error.code = "FCA_SESSION_EXPIRED";
            error.sessionState = sessionState;
            error.retryable = false;
          } else {
            error.code = caught?.code === "FCA_CHALLENGE_LIMIT"
              ? "FCA_CHALLENGE_LIMIT" : "FCA_AUTHENTICATION_FAILED";
            error.retryable = typeof caught?.retryable === "boolean" ? caught.retryable : true;
          }
          lastConnectError = error;
          throw error;
        }
        try {
          return validateTransportDriver(result);
        } catch (error) {
          // Preserve the local contract error for the caller, while disposing
          // any provider resource allocated before the invalid result.
          lastConnectError = error;
          if (result && typeof result.disconnect === "function") {
            try { await result.disconnect(); }
            catch (cleanupError) { error.cleanupError = cleanupError; }
          }
          throw error;
        }
      },
      disconnect: async driver => {
        if (typeof driver.disconnect === "function") await driver.disconnect();
      },
      options: reconnect
    });
    const driver = await supervisor.start();
    if (!driver) throw lastConnectError || new Error("Connection stopped before authentication completed");
    let currentUserId;
    try {
      currentUserId = typeof driver.getCurrentUserID === "function" ? await driver.getCurrentUserID() : null;
    } catch (error) {
      // A driver that connects but cannot complete identity initialization must
      // not leave an unreachable live session behind.
      try { await supervisor.stop(); }
      catch (cleanupError) { error.cleanupError = cleanupError; }
      finally { supervisor = null; }
      throw error;
    }
    userId = currentUserId == null ? null : String(currentUserId);
    const facade = {};
    for (const method of DRIVER_METHODS) {
      if (typeof driver[method] === "function") {
        facade[method] = (...args) => {
          const feature = METHOD_FEATURES[method];
          if (requireLicense && feature && !verifiedLicense.features.includes(feature)) {
            const error = new Error("License does not include the " + feature + " feature");
            error.code = "FCA_LICENSE_FEATURE_DENIED";
            return Promise.reject(error);
          }
          return driver[method](...args);
        };
      }
    }
    if (typeof driver.sendMessage === "function") {
      facade.sendMessage = (message, threadID, callback, replyToMessageID) => {
        let input;
        let done;
        let requestOptions;
        if (typeof threadID === "string" || typeof threadID === "number") {
          input = { threadID, message };
          done = typeof callback === "function" ? callback : null;
          if (replyToMessageID != null) input.replyToMessageID = replyToMessageID;
        } else {
          input = message;
          done = typeof threadID === "function" ? threadID : null;
          requestOptions = threadID && typeof threadID === "object" ? threadID : undefined;
        }
        const operation = Promise.resolve().then(() => driver.sendMessage(input, requestOptions));
        if (done) {
          operation.then(value => done(null, value), error => done(error));
          return undefined;
        }
        return operation;
      };
    }
    if (typeof driver.getUserID !== "function") {
      facade.getUserID = () => userId;
    }
    facade.getCurrentUserID = () => userId;
    facade.listen = callback => {
      if (requireLicense && !verifiedLicense.features.includes("events")) throw new Error("License does not include the events feature");
      return supervisor.listen(callback);
    };
    facade.listenMqtt = callback => {
      if (requireLicense && !verifiedLicense.features.includes("events")) throw new Error("License does not include the events feature");
      if (typeof callback !== "function") throw new TypeError("MQTT callback is required");
      if (detachMqtt) throw new Error("MQTT listener is already active");
      mqttErrorHandler = error => callback(error, null);
      supervisor.on("listenerError", mqttErrorHandler);
      try {
        const detach = supervisor.listen(event => callback(null, event));
        detachMqtt = () => {
          supervisor.off("listenerError", mqttErrorHandler);
          mqttErrorHandler = null;
          detach();
          detachMqtt = null;
        };
        // FCA-compatible readiness signal: the native driver has already
        // completed AppState validation, MQTT CONNACK and topic subscription
        // before the client is exposed. This lets GoatBot gate startup/recovery
        // on an explicit ready event instead of guessing from socket creation.
        queueMicrotask(() => {
          if (detachMqtt) {
            try {
              callback(null, Object.freeze({
                type: "ready",
                source: "omega-fca",
                connectionState: supervisor.snapshot()
              }));
            } catch (error) {
              try { supervisor.emit("listenerCallbackError", error); } catch {}
            }
          }
        });
        return detachMqtt;
      } catch (error) {
        // Roll back the error subscription if listener attachment fails.
        supervisor.off("listenerError", mqttErrorHandler);
        mqttErrorHandler = null;
        throw error;
      }
    };
    facade.stopListening = callback => {
      if (detachMqtt) detachMqtt();
      if (typeof callback === "function") callback();
      return true;
    };
    facade.stopSessionGuard = typeof driver.stopSessionGuard === "function" ? driver.stopSessionGuard.bind(driver) : undefined;
    facade.sessionGuard = typeof driver.sessionGuard === "function" ? driver.sessionGuard.bind(driver) : undefined;
    facade.setOptions = typeof driver.setOptions === "function" ? driver.setOptions.bind(driver) : undefined;
    facade.getCapabilities = () => Object.freeze({
      methods: Object.freeze(DRIVER_METHODS.filter(method => typeof driver[method] === "function")),
      events: typeof driver.listen === "function",
      sessionGuard: typeof driver.sessionGuard === "function",
      e2ee: false
    });
    facade.getConnectionState = () => supervisor.snapshot();
    facade.getLicense = () => verifiedLicense;
    api = Object.freeze(facade);
    startLicenseMonitor();
    return api;
  }

  function login(credentials = {}, loginOptions = options) {
    if (logoutPromise) {
      return Promise.reject(new Error("Logout is already in progress"));
    }
    if (loginPromise) {
      return Promise.reject(new Error("A login attempt is already in progress"));
    }
    // Reserve the login slot synchronously, before performLogin reaches its
    // first await, so concurrent callers cannot create two live supervisors.
    loginPromise = performLogin(credentials, loginOptions).finally(() => {
      loginPromise = null;
    });
    return loginPromise;
  }

  return Object.freeze({
    login,
    logout() {
      if (logoutPromise) return logoutPromise;
      stopLicenseMonitor();
      const pendingLogin = loginPromise;
      logoutPromise = (async () => {
        // If logout races authentication, wait for that attempt to settle and
        // then dispose any session it managed to establish.
        if (pendingLogin) {
          try { await pendingLogin; } catch {}
        }
        if (detachMqtt) detachMqtt();
        if (supervisor) await supervisor.stop();
        supervisor = null;
        api = null;
        userId = null;
        verifiedLicense = null;
      })().finally(() => {
        logoutPromise = null;
      });
      return logoutPromise;
    },
    getConnectionState: () => supervisor ? supervisor.snapshot() : Object.freeze({ state: "idle", connected: false, generation: 0 }),
    getLicense: () => verifiedLicense
  });
}

module.exports = { createClient };
