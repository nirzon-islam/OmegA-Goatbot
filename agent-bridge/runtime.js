"use strict";

const { createBridgeClient } = require("./client");
const { createWorker } = require("./worker");

function startBridgeWorker({ log = console, intervalMs = 15000 } = {}) {
  if (process.env.AGENT_BRIDGE_ENABLED !== "true" ||
      process.env.AGENT_WORKER_ENABLED !== "true") {
    return null;
  }

  const worker = createWorker({ client: createBridgeClient() });
  let running = false;
  const poll = async () => {
    if (running) return;
    running = true;
    try {
      await worker.pollOnce(5);
    } catch (error) {
      log.warn("[Agent Bridge] Poll failed: " + String(error.message || "unknown error"));
    } finally {
      running = false;
    }
  };

  const timer = setInterval(poll, intervalMs);
  if (typeof timer.unref === "function") timer.unref();
  void poll();

  return Object.freeze({
    stop() { clearInterval(timer); },
    pollOnce: poll
  });
}

module.exports = { startBridgeWorker };
