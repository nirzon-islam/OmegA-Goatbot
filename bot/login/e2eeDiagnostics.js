"use strict";

const SAFE_EVENTS = new Set([
  "identity.ready",
  "identity.created",
  "identity.unavailable",
  "runtime.initializing",
  "runtime.ready",
  "runtime.unavailable",
  "device.registration.started",
  "device.registration.ready",
  "device.registration.failed",
  "transport.ready",
  "transport.unavailable",
  "message.encrypt.failed",
  "message.decrypt.failed"
]);

function accountTag(accountId) {
  const value = String(accountId || "");
  return /^\d{5,30}$/.test(value) ? "…"+value.slice(-4) : "unknown";
}

/**
 * Emit structured E2EE diagnostics. Never pass secrets, cookies, payloads,
 * private/public key material, or arbitrary exception objects to this logger.
 */
function logE2EE(event, fields = {}, logger = console) {
  if (!SAFE_EVENTS.has(event)) return false;
  const record = {
    component: "omega-e2ee",
    event,
    status: typeof fields.status === "string" ? fields.status : "info",
    account: accountTag(fields.accountId),
    durationMs: Number.isFinite(fields.durationMs) ? Math.max(0, Math.round(fields.durationMs)) : undefined,
    reason: typeof fields.reason === "string" ? fields.reason.slice(0, 100) : undefined,
    stage: typeof fields.stage === "string" ? fields.stage.slice(0, 40) : undefined,
    timestamp: new Date().toISOString()
  };
  for (const key of Object.keys(record)) if (record[key] === undefined) delete record[key];
  const method = record.status === "failed" || record.status === "unavailable" ? "warn" : "info";
  try { (logger[method] || logger.log).call(logger, "[E2EE] " + JSON.stringify(record)); } catch {}
  return true;
}

module.exports = { logE2EE };
