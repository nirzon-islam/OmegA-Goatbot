"use strict";

const CHECKPOINT = /checkpoint|two[\s-]?factor|approvals_code|security code|confirm your identity|login approval/i;
const LOGGED_OUT = /not logged in|account_inactive|login_blocked|invalid session|session expired|logged out|login required|1357001/i;
const TRANSIENT = /timeout|timed out|connection reset|connection refused|server unavailable|temporarily unavailable|econnreset|enotfound|429|rate limit/i;

function describeError(error) {
  if (typeof error === "string") return error;
  if (!error || typeof error !== "object") return "";
  return [error.type, error.error, error.message, error.code].filter(Boolean).map(String).join(" ");
}

function classifySessionState(input) {
  if (input === null || input === undefined || input === "") return "unknown";
  if (typeof input === "string" && ["online", "logged_out", "checkpoint", "error", "unknown"].includes(input)) return input;
  const message = describeError(input);
  if (CHECKPOINT.test(message)) return "checkpoint";
  if (LOGGED_OUT.test(message)) return "logged_out";
  if (TRANSIENT.test(message)) return "error";
  return message ? "error" : "unknown";
}

module.exports = { classifySessionState, describeError };
