"use strict";

const SECRET_KEY = /(?:pass(?:word)?|cookie|token|secret|authorization|appstate|session|credential|fb_dtsg|lsd|jazoest|xs|c_user|access.?key|api.?key|2fa|otp|verification.?code|challenge.?answer|auth.?code)/i;
const SAFE_HEADER_NAMES = new Set(["accept", "content-type", "accept-language", "x-requested-with", "origin", "referer"]);

function byteLength(value) {
  if (value == null) return 0;
  if (typeof value === "string") return Buffer.byteLength(value, "utf8");
  if (value instanceof URLSearchParams) return Buffer.byteLength(value.toString(), "utf8");
  if (value instanceof Uint8Array) return value.byteLength;
  return 0;
}

function safeUrl(input) {
  try {
    const url = input instanceof URL ? input : new URL(String(input));
    const path = url.pathname.split("/").map(part => part.length > 64 ? "[redacted]" : part).join("/");
    return Object.freeze({ origin: url.origin, path, queryParameterNames: [...new Set([...url.searchParams.keys()].filter(key => !SECRET_KEY.test(key)))].slice(0, 40) });
  } catch {
    return Object.freeze({ origin: null, path: null, queryParameterNames: [] });
  }
}

function safeFieldNames(body) {
  let entries = [];
  if (body instanceof URLSearchParams) entries = [...new Set([...body.keys()])];
  else if (body && typeof body === "object" && !ArrayBuffer.isView(body) && !(body instanceof ArrayBuffer)) entries = Object.keys(body);
  const safe = [];
  let sensitiveCount = 0;
  for (const key of entries.slice(0, 100)) {
    if (SECRET_KEY.test(key)) sensitiveCount++;
    else if (/^[A-Za-z0-9_.:[\]-]{1,128}$/.test(key)) safe.push(key);
  }
  return { fieldNames: safe, sensitiveFieldCount: sensitiveCount, truncated: entries.length > 100 };
}

function safeHeaderNames(headers) {
  const names = [];
  try {
    for (const [name] of new Headers(headers || {})) {
      const lower = name.toLowerCase();
      if (SAFE_HEADER_NAMES.has(lower)) names.push(lower);
    }
  } catch {}
  return [...new Set(names)].sort();
}

/**
 * Collects request metadata only. Header values, query values, body values,
 * response bodies, cookies and credentials are never stored.
 */
function createDiagnosticRecorder({ maxEvents = 100, clock = Date.now } = {}) {
  if (!Number.isInteger(maxEvents) || maxEvents < 1 || maxEvents > 1000) {
    throw new TypeError("maxEvents must be an integer between 1 and 1000");
  }
  if (typeof clock !== "function") throw new TypeError("clock must be a function");
  const events = [];

  function record(input = {}) {
    const request = input.request || {};
    const response = input.response || {};
    const fields = safeFieldNames(request.body);
    const event = Object.freeze({
      at: new Date(clock()).toISOString(),
      phase: input.phase === "response" ? "response" : input.phase === "error" ? "error" : "request",
      method: /^(GET|HEAD|POST|PUT|PATCH|DELETE)$/i.test(String(request.method || "")) ? String(request.method).toUpperCase() : "OTHER",
      url: safeUrl(request.url),
      requestHeaders: safeHeaderNames(request.headers),
      requestBodyBytes: byteLength(request.body),
      requestFieldNames: fields.fieldNames,
      sensitiveFieldCount: fields.sensitiveFieldCount,
      fieldsTruncated: fields.truncated,
      ...(Number.isInteger(response.status) ? { status: response.status } : {}),
      ...(typeof response.contentType === "string" ? { contentType: response.contentType.split(";")[0].slice(0, 100) } : {}),
      ...(Number.isFinite(response.bodyBytes) ? { responseBodyBytes: Math.max(0, response.bodyBytes) } : {}),
      ...(Number.isFinite(input.durationMs) ? { durationMs: Math.max(0, input.durationMs) } : {}),
      ...(typeof input.errorCode === "string" && /^[A-Z0-9_-]{1,64}$/.test(input.errorCode) ? { errorCode: input.errorCode } : {})
    });
    events.push(event);
    if (events.length > maxEvents) events.shift();
    return event;
  }

  function snapshot() {
    return Object.freeze({ version: 1, generatedAt: new Date(clock()).toISOString(), events: events.slice() });
  }

  return Object.freeze({
    record,
    snapshot,
    toJSON() {
      return JSON.stringify(snapshot(), null, 2);
    },
    clear() { events.length = 0; }
  });
}

module.exports = { createDiagnosticRecorder, safeUrl, safeFieldNames, safeHeaderNames };
