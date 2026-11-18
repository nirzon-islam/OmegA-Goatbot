"use strict";

const { createBridgeClient } = require("./client");
const { createWorker } = require("./worker");

function getDefaultAccountStatus() {
  const raw = global.statusAccountBot;
  const detail = global.facebookSessionStatus && typeof global.facebookSessionStatus === "object"
    ? global.facebookSessionStatus : {};
  const allowed = new Set(["online", "logged_out", "checkpoint", "error", "unknown"]);
  const rawState = raw === "good" ? "online" : raw === "checkpoint" ? "checkpoint" :
    raw === "can't login" || raw === "logged_out" ? "logged_out" :
    raw === "error" ? "error" : "unknown";
  // "online" is trusted only from the live GoatBot login state, never from cached recovery detail.
  const state = rawState === "unknown" && ["logged_out", "checkpoint", "error"].includes(detail.state)
    ? detail.state : rawState;
  const defaultMessages = {
    online: "Facebook session active",
    logged_out: "Facebook session is logged out or disconnected",
    checkpoint: "Facebook checkpoint requires manual completion",
    error: "Facebook session encountered an error",
    unknown: "Bot status is not yet verified"
  };
  return {
    state,
    accountId: (() => {
      const activeId = String(global.GoatBot?.botID || global.botID || "");
      if (/^\\d{5,30}$/.test(activeId)) return activeId;
      const recoveryId = String(detail.accountId || "");
      return state === "checkpoint" && /^\\d{5,30}$/.test(recoveryId) ? recoveryId : "";
    })(),
    message: detail.state === state && typeof detail.message === "string" && detail.message.trim()
      ? detail.message.slice(0, 500) : defaultMessages[state]
  };
}

function startBridgeWorker({ log = console, intervalMs = 3000, getAccountStatus = getDefaultAccountStatus } = {}) {
  if (process.env.AGENT_BRIDGE_ENABLED !== "true") return null;

  const client = createBridgeClient();
  const workerEnabled = process.env.AGENT_WORKER_ENABLED === "true";
  const worker = workerEnabled ? createWorker({ client }) : null;
  let running = false;
  let reporting = false;

  const reportStatus = async () => {
    if (reporting) return;
    reporting = true;
    try {
      const status = getAccountStatus() || {};
      const allowed = new Set(["online", "logged_out", "checkpoint", "error", "unknown"]);
      const sessionState = allowed.has(status.sessionState) ? status.sessionState :
        (allowed.has(status.state) ? status.state : "unknown");
      await client.reportAccountStatus({
        workerState: "online",
        sessionState,
        state: sessionState,
        accountId: typeof status.accountId === "string" ? status.accountId.slice(0, 128) : "",
        message: typeof status.message === "string" ? status.message.slice(0, 500) : ""
      });
    } catch (error) {
      log.warn("AGENT BRIDGE", "Account status report failed: " + String(error.message || "unknown error"));
    } finally {
      reporting = false;
    }
  };

  const poll = async () => {
    if (!worker || running) return;
    running = true;
    try {
      if (worker) {
        await worker.pollOnce(5);
        await worker.pollRecovery();
      }
    } catch (error) {
      log.warn("AGENT BRIDGE", "Poll failed: " + String(error.message || "unknown error"));
    } finally {
      running = false;
    }
  };

  const timer = setInterval(() => {
    void poll();
    void reportStatus();
  }, intervalMs);
  if (typeof timer.unref === "function") timer.unref();
  if (worker) void poll();
  void reportStatus();

  return Object.freeze({
    stop() { clearInterval(timer); },
    pollOnce: poll,
    reportStatus
  });
}

module.exports = { startBridgeWorker, getDefaultAccountStatus };
