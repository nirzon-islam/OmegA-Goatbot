"use strict";

const { normalizeFacebookResponse, createFacebookError } = require("./facebookResponse");

const ALLOWED_HOST = /(^|\.)facebook\.com$|(^|\.)messenger\.com$/;
const MAX_BODY_BYTES = 2 * 1024 * 1024;

function assertFacebookUrl(input) {
  const url = input instanceof URL ? new URL(input.href) : new URL(input);
  if (url.protocol !== "https:" || !ALLOWED_HOST.test(url.hostname)) {
    throw new TypeError("Facebook web actions require an HTTPS Facebook/Messenger URL");
  }
  if (url.username || url.password) throw new TypeError("Facebook action URL must not contain credentials");
  return url;
}

function toFormBody(data, tokens, userId) {
  const form = new URLSearchParams();
  for (const [key, value] of Object.entries(data || {})) {
    if (!/^[A-Za-z0-9_.:[\]-]{1,128}$/.test(key)) {
      throw new TypeError("Facebook form field name is invalid");
    }
    if (value === undefined || value === null) continue;
    if (typeof value === "object") form.set(key, JSON.stringify(value));
    else form.set(key, String(value));
  }
  if (userId) form.set("av", String(userId));
  if (tokens.fbDtsg) form.set("fb_dtsg", tokens.fbDtsg);
  if (tokens.lsd) form.set("lsd", tokens.lsd);
  if (tokens.jazoest) form.set("jazoest", tokens.jazoest);
  if (tokens.hsi) form.set("hsi", tokens.hsi);
  if (tokens.spinR) form.set("__spin_r", tokens.spinR);
  if (tokens.spinB) form.set("__spin_b", tokens.spinB);
  if (tokens.spinT) form.set("__spin_t", tokens.spinT);
  return form;
}

/**
 * Low-level authenticated web request layer. It intentionally does not guess
 * private action endpoints or payload schemas; callers must supply a known,
 * owner-authorized Facebook web path and its documented/current form fields.
 */
function createFacebookWebClient({ session, fetchImpl, normalizeResponse = normalizeFacebookResponse } = {}) {
  if (!session || typeof session.request !== "function" ||
      typeof session.getTokens !== "function" || typeof session.getCookieHeader !== "function") {
    throw new TypeError("An active OmegA personal session is required");
  }
  if (typeof normalizeResponse !== "function") throw new TypeError("normalizeResponse must be a function");

  async function request(input, { method = "GET", query, body, headers, signal } = {}) {
    const url = assertFacebookUrl(input);
    const verb = String(method).toUpperCase();
    if (!["GET", "HEAD", "POST"].includes(verb)) {
      throw new TypeError("Facebook web client supports GET, HEAD, and POST only");
    }
    if (query && typeof query === "object") {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
      }
    }
    const requestHeaders = new Headers(headers || {});
    requestHeaders.set("accept", "application/json, text/javascript, */*; q=0.01");
    let requestBody;
    if (verb === "POST") {
      if (body instanceof URLSearchParams || typeof body === "string" || body instanceof Uint8Array) {
        requestBody = body;
      } else {
        requestBody = toFormBody(body, session.getTokens(), session.userId);
        if (!requestHeaders.has("content-type")) {
          requestHeaders.set("content-type", "application/x-www-form-urlencoded; charset=UTF-8");
        }
      }
    } else if (body !== undefined) {
      throw new TypeError("GET and HEAD requests cannot include a body");
    }
    if (requestBody !== undefined) {
      const size = typeof requestBody === "string" ? Buffer.byteLength(requestBody, "utf8")
        : requestBody instanceof URLSearchParams ? Buffer.byteLength(requestBody.toString(), "utf8")
        : requestBody instanceof Uint8Array ? requestBody.byteLength : 0;
      if (size > MAX_BODY_BYTES) {
        throw createFacebookError("Facebook request body exceeded the 2 MiB safety limit", {
          code: "FCA_REQUEST_TOO_LARGE", retryable: false
        });
      }
    }
    const response = await session.request(url, {
      method: verb, headers: requestHeaders, body: requestBody, signal, redirect: "manual"
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers?.get?.("location") || "";
      if (/checkpoint|challenge/i.test(location)) {
        throw createFacebookError("Facebook requires the account owner to complete a checkpoint", {
          code: "FCA_CHECKPOINT_REQUIRED", status: response.status, sessionState: "checkpoint", retryable: false
        });
      }
      if (/login\.php|\/login(?:[/?]|$)/i.test(location)) {
        throw createFacebookError("Facebook session is no longer authenticated", {
          code: "FCA_SESSION_EXPIRED", status: response.status, sessionState: "logged_out", retryable: false
        });
      }
      throw createFacebookError("Facebook returned an unexpected redirect; it was not followed", {
        code: "FCA_UNEXPECTED_REDIRECT", status: response.status, retryable: false
      });
    }
    const declared = Number(response.headers?.get?.("content-length") || 0);
    if (declared > MAX_BODY_BYTES) {
      throw createFacebookError("Facebook response exceeded the 2 MiB safety limit", {
        code: "FCA_RESPONSE_TOO_LARGE", status: response.status, retryable: false
      });
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
      throw createFacebookError("Facebook response exceeded the 2 MiB safety limit", {
        code: "FCA_RESPONSE_TOO_LARGE", status: response.status, retryable: false
      });
    }
    const contentType = response.headers?.get?.("content-type") || "";
    const payload = normalizeResponse(raw, { status: response.status, contentType });
    return Object.freeze({ status: response.status, headers: response.headers, payload, raw });
  }

  return Object.freeze({
    request,
    get(path, options = {}) {
      return request(path, { ...options, method: "GET" });
    },
    post(path, body, options = {}) {
      return request(path, { ...options, method: "POST", body });
    }
  });
}

module.exports = { createFacebookWebClient, assertFacebookUrl, toFormBody };
