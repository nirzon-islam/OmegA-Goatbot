"use strict";

const { createBridgeClient } = require("./client");
const { createWorker } = require("./worker");

function startBridgeWorker({ log = console, intervalMs = 15000, getAccountStatus = () => ({ state: "unknown" }) } = {}) {
  if (process.env.AGENT_BRIDGE_ENABLED !== "true" ||
      process.env.AGENT_WORKER_ENABLED !== "true") {
    return null;
  }

  const client = createBridgeClient();
  const worker = createWorker({ client });
  let running = false;
  let reporting = false;

  const reportStatus = async () => {
    if (reporting) return;
    reporting = true;
    try {
      const status = getAccountStatus() || {};
      const allowed = new Set(["online", "logged_out", "checkpoint", "error"]);
      const state = allowed.has(status.state) ? status.state : "error";
      await client.reportAccountStatus({
        state,
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
    if (running) return;
    running = true;
    try {
      await worker.pollOnce(5);
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
  void poll();
  void reportStatus();

  return Object.freeze({
    stop() { clearInterval(timer); },
    pollOnce: poll,
    reportStatus
  });
}

module.exports = { startBridgeWorker };
