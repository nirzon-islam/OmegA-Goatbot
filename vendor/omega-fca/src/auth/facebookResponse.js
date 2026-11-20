"use strict";

const { classifySessionState } = require("../security/sessionState");

function createFacebookError(message, { code, status, sessionState = "error", retryable } = {}) {
  const error = new Error(message || "Facebook request failed");
  error.code = code || "FCA_FACEBOOK_REQUEST_FAILED";
  error.status = Number.isInteger(status) ? status : null;
  error.sessionState = sessionState;
  error.retryable = typeof retryable === "boolean" ? retryable : sessionState === "error";
  return error;
}

function stripFacebookJsonPrefix(body) {
  return body.replace(/^\uFEFF/, "").replace(/^\s*(?:for\s*\(;;\)\s*;|while\s*\(\s*1\s*\)\s*;|\)\]\}',?)/, "").trim();
}

function normalizeFacebookResponse(body, { status = 200, contentType = "application/json" } = {}) {
  if (typeof body !== "string" || body.length > 8 * 1024 * 1024) {
    throw createFacebookError("Facebook response body is missing or exceeds 8 MiB", {
      code: "FCA_RESPONSE_INVALID", status, retryable: false
    });
  }
  const text = stripFacebookJsonPrefix(body);
  if (/checkpoint|challenge_required|checkpoint_required/i.test(text)) {
    throw createFacebookError("Facebook requires the account owner to complete a checkpoint", {
      code: "FCA_CHECKPOINT_REQUIRED", status, sessionState: "checkpoint", retryable: false
    });
  }
  if (/login\.php|login_required|invalid session|not logged in/i.test(text)) {
    throw createFacebookError("Facebook session is no longer authenticated", {
      code: "FCA_SESSION_EXPIRED", status, sessionState: "logged_out", retryable: false
    });
  }
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    if (status === 429) {
      throw createFacebookError("Facebook rate-limited the request", {
        code: "FCA_RATE_LIMITED", status, retryable: true
      });
    }
    if (status >= 500) {
      throw createFacebookError("Facebook server request failed with HTTP " + status, {
        code: "FCA_UPSTREAM_UNAVAILABLE", status, retryable: true
      });
    }
    throw createFacebookError("Facebook returned a non-JSON response (" + String(contentType).slice(0, 100) + ")", {
      code: "FCA_RESPONSE_NOT_JSON", status, retryable: false
    });
  }

  const errorData = payload && typeof payload === "object"
    ? (payload.error || payload.errors?.[0] || null)
    : null;
  if (errorData) {
    const message = [
      errorData.message,
      errorData.error_user_msg,
      errorData.errorDescription,
      errorData.errorSummary
    ].filter(value => typeof value === "string" && value.trim()).join(": ") || "Facebook rejected the request";
    const state = classifySessionState({
      message,
      code: errorData.code || errorData.error_code
    });
    const code = state === "checkpoint" ? "FCA_CHECKPOINT_REQUIRED"
      : state === "logged_out" ? "FCA_SESSION_EXPIRED"
      : Number(errorData.code || errorData.error_code) === 429 ? "FCA_RATE_LIMITED"
      : "FCA_FACEBOOK_REQUEST_REJECTED";
    throw createFacebookError(message, {
      code,
      status,
      sessionState: state,
      retryable: state === "error" && (status === 429 || status >= 500)
    });
  }
  if (status === 429 || status >= 500) {
    throw createFacebookError("Facebook server request failed with HTTP " + status, {
      code: status === 429 ? "FCA_RATE_LIMITED" : "FCA_UPSTREAM_UNAVAILABLE",
      status, retryable: true
    });
  }
  if (status < 200 || status >= 300) {
    throw createFacebookError("Facebook request failed with HTTP " + status, {
      code: "FCA_HTTP_ERROR", status, retryable: false
    });
  }
  return payload;
}

module.exports = { normalizeFacebookResponse, stripFacebookJsonPrefix, createFacebookError };
