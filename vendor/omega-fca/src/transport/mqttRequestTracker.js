"use strict";

function createMqttRequestTracker(options = {}) {
  const timeoutMs = options.timeoutMs ?? 15000;
  const maxPending = options.maxPending ?? 256;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120000) throw new TypeError("timeoutMs must be between 1 and 120000");
  if (!Number.isInteger(maxPending) || maxPending < 1 || maxPending > 10000) throw new TypeError("maxPending must be between 1 and 10000");
  let nextId = Number.isSafeInteger(options.initialRequestId) && options.initialRequestId >= 0
    ? options.initialRequestId : 0;
  const pending = new Map();

  function allocateId() {
    nextId = nextId >= Number.MAX_SAFE_INTEGER ? 1 : nextId + 1;
    return nextId;
  }

  function track(requestId, customTimeoutMs = timeoutMs) {
    const id = String(requestId);
    if (!/^[0-9]{1,20}$/.test(id)) return Promise.reject(new TypeError("requestId must be numeric"));
    if (pending.has(id)) return Promise.reject(new Error("A request with this ID is already pending"));
    if (pending.size >= maxPending) return Promise.reject(Object.assign(new Error("MQTT pending request limit reached"), { code: "FCA_MQTT_PENDING_LIMIT" }));
    if (!Number.isInteger(customTimeoutMs) || customTimeoutMs < 1 || customTimeoutMs > 120000) {
      return Promise.reject(new TypeError("request timeout is invalid"));
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        const error = new Error("Messenger MQTT request timed out");
        error.code = "FCA_MQTT_REQUEST_TIMEOUT";
        error.requestId = id;
        reject(error);
      }, customTimeoutMs);
      pending.set(id, {
        resolve(value) { clearTimeout(timer); pending.delete(id); resolve(value); },
        reject(error) { clearTimeout(timer); pending.delete(id); reject(error); }
      });
    });
  }

  function resolve(response) {
    if (!response || typeof response !== "object" || response.request_id == null) return false;
    const id = String(response.request_id);
    const entry = pending.get(id);
    if (!entry) return false;
    entry.resolve(response);
    return true;
  }

  function rejectAll(reason) {
    const error = reason instanceof Error ? reason : new Error(String(reason || "MQTT connection closed"));
    for (const entry of [...pending.values()]) entry.reject(error);
  }

  return Object.freeze({
    allocateId, track, resolve, rejectAll,
    get pendingCount() { return pending.size; }
  });
}

module.exports = { createMqttRequestTracker };
