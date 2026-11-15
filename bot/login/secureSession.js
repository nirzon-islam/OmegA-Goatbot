"use strict";

const fs = require("fs");
const path = require("path");

const MAX_APPSTATE_BYTES = 64 * 1024;
const READY_TIMEOUT_MS = 45_000;

function validateAppState(raw, expectedBotId) {
  if (typeof raw !== "string" || Buffer.byteLength(raw, "utf8") > MAX_APPSTATE_BYTES) {
    throw new Error("Appstate is missing or exceeds the 64 KiB limit");
  }
  if (typeof expectedBotId !== "string" || !/^\d{5,30}$/.test(expectedBotId)) {
    throw new Error("Invalid target account ID");
  }

  let state;
  try { state = JSON.parse(raw); }
  catch { throw new Error("Appstate must be valid JSON"); }
  if (!Array.isArray(state) || state.length < 2 || state.length > 500) {
    throw new Error("Appstate must be a non-empty cookie array");
  }

  const cookies = new Map();
  for (const item of state) {
    if (!item || typeof item !== "object" || Array.isArray(item) ||
        typeof (item.key || item.name) !== "string" || typeof item.value !== "string" ||
        typeof item.domain !== "string" || !/(^|\.)facebook\.com$/i.test(item.domain.replace(/^\./, ""))) {
      throw new Error("Appstate contains an invalid Facebook cookie");
    }
    if (item.value.length > 16_384) throw new Error("Appstate cookie value is too large");
    cookies.set(item.key || item.name, item.value);
  }
  if (cookies.get("c_user") !== expectedBotId || !cookies.get("xs")) {
    throw new Error("Appstate account does not match the requested Bot ID");
  }
  return state.map(item => { const { name, ...rest } = item; return { ...rest, key: item.key || name }; });
}

function writeAppStateAtomic(filePath, state) {
  const target = path.resolve(filePath);
  const directory = path.dirname(target);
  const temp = path.join(directory, ".account-recovery-" + process.pid + "-" + Date.now() + ".tmp");
  const data = JSON.stringify(state);
  let fd;
  try {
    fd = fs.openSync(temp, "wx", 0o600);
    fs.writeFileSync(fd, data, "utf8");
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    fs.renameSync(temp, target);
    try { fs.chmodSync(target, 0o600); } catch {}
  } catch (error) {
    if (fd !== undefined) try { fs.closeSync(fd); } catch {}
    try { fs.unlinkSync(temp); } catch {}
    throw error;
  }
}

function loginCandidate(login, appState, options = {}, timeoutMs = READY_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => finish(new Error("Facebook login timed out")), timeoutMs);
    function finish(error, api) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else if (!api || typeof api.listenMqtt !== "function" ||
          typeof api.getCurrentUserID !== "function") reject(new Error("FCA returned an invalid API"));
      else resolve(api);
    }
    try {
      login({ appState }, { ...options, emitReady: true }, finish);
    } catch (error) { finish(error); }
  });
}

function listenUntilReady(api, callback, timeoutMs = READY_TIMEOUT_MS, stableMs = 10_000) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let readyEvent = null;
    let stableTimer = null;
    const timer = setTimeout(() => finish(new Error("Facebook MQTT readiness timed out")), timeoutMs);
    function finish(error, value) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (stableTimer) clearTimeout(stableTimer);
      if (error) reject(error); else resolve(value);
    }
    function connectionError(first, second) {
      for (const value of [first, second]) {
        if (value instanceof Error) return value;
        if (value && typeof value === "object" &&
            (value.type === "stop_listen" || value.type === "account_inactive" ||
             value.type === "login_blocked" || value.error)) {
          return new Error("Facebook MQTT connection rejected the candidate session");
        }
      }
      return null;
    }
    try {
      // A single ready callback is provisional. Keep the candidate isolated
      // until it survives a short stability window without auth/transport errors.
      api.listenMqtt((first, second) => {
        const event = second || first;
        const error = connectionError(first, second);
        if (error) {
          if (!readyEvent || !settled) return finish(error);
          callback(first, second);
          return;
        }
        if (event && event.type === "ready" && !readyEvent) {
          readyEvent = event;
          stableTimer = setTimeout(() => finish(null, readyEvent), stableMs);
          return;
        }
        callback(first, second);
      });
    } catch (error) { finish(error); }
  });
}
module.exports = {
  MAX_APPSTATE_BYTES,
  READY_TIMEOUT_MS,
  validateAppState,
  writeAppStateAtomic,
  loginCandidate,
  listenUntilReady
};
