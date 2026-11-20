"use strict";

const { CookieJar } = require("../network/cookieJar");
const { validateSessionCookies } = require("../security/cookies");
const { classifySessionState } = require("../security/sessionState");

const FACEBOOK_ORIGIN = "https://www.facebook.com";
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

function sessionError(message, code, state) {
  const error = new Error(message);
  error.code = code;
  error.sessionState = state;
  error.retryable = false;
  return error;
}

function detectSessionChallenge(response, html) {
  const location = response.headers?.get?.("location") || "";
  const target = location.toLowerCase();
  if (/checkpoint|challenge/.test(target) || /checkpoint|checkpoint_required|challenge_required/i.test(html)) {
    return "checkpoint";
  }
  if (/login\.php|\/login(?:[/?]|$)/.test(target) ||
      /name=["'](?:email|pass)["']|id=["']login_form["']/i.test(html)) {
    return "logged_out";
  }
  return "active";
}

function extractFacebookTokens(html) {
  if (typeof html !== "string" || html.length > MAX_RESPONSE_BYTES) {
    throw new TypeError("Facebook HTML must be text within the response size limit");
  }
  const read = patterns => {
    for (const pattern of patterns) {
      const match = pattern.exec(html);
      if (match && typeof match[1] === "string" && match[1].length <= 4096) return match[1];
    }
    return null;
  };
  return Object.freeze({
    fbDtsg: read([
      /<input[^>]+name=["']fb_dtsg["'][^>]+value=["']([^"']+)["']/i,
      /"DTSGInitialData"[^]*?"token"\s*:\s*"([^"]+)"/,
      /"fb_dtsg"\s*:\s*"([^"]+)"/
    ]),
    lsd: read([
      /<input[^>]+name=["']lsd["'][^>]+value=["']([^"']+)["']/i,
      /"LSD"\s*,\s*\[\s*\]\s*,\s*\{\s*"token"\s*:\s*"([^"]+)"/
    ]),
    jazoest: read([
      /<input[^>]+name=["']jazoest["'][^>]+value=["']([^"']+)["']/i,
      /"jazoest"\s*:\s*"([^"]+)"/
    ]),
    hsi: read([/"hsi"\s*:\s*"([0-9]+)"/]),
    spinR: read([/"__spin_r"\s*:\s*"?([0-9]+)"?/]),
    spinB: read([/"__spin_b"\s*:\s*"([^"]+)"/]),
    spinT: read([/"__spin_t"\s*:\s*"?([0-9]+)"?/])
  });
}

function collectResponseCookies(response, requestUrl) {
  const raw = typeof response.headers?.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : (response.headers?.get?.("set-cookie") ? [response.headers.get("set-cookie")] : []);
  const host = requestUrl.hostname.toLowerCase();
  const accepted = [];
  const deletions = [];
  for (const line of raw) {
    if (typeof line !== "string" || line.length > 16_384) continue;
    const parts = line.split(";");
    const first = parts.shift();
    const equals = first.indexOf("=");
    if (equals <= 0) continue;
    const key = first.slice(0, equals).trim();
    const value = first.slice(equals + 1).trim();
    const cookie = { key, value: value || "deleted", domain: host, path: "/", hostOnly: true, secure: false, httpOnly: false };
    let maxAge = null;
    for (const rawAttribute of parts) {
      const index = rawAttribute.indexOf("=");
      const name = (index < 0 ? rawAttribute : rawAttribute.slice(0, index)).trim().toLowerCase();
      const attributeValue = index < 0 ? "" : rawAttribute.slice(index + 1).trim();
      if (name === "domain") {
        const domain = attributeValue.replace(/^\./, "").toLowerCase();
        if (!domain || !(host === domain || host.endsWith("." + domain))) {
          cookie.invalidDomain = true;
          break;
        }
        cookie.domain = domain;
        cookie.hostOnly = false;
      } else if (name === "path" && attributeValue.startsWith("/")) {
        cookie.path = attributeValue;
      } else if (name === "secure") cookie.secure = true;
      else if (name === "httponly") cookie.httpOnly = true;
      else if (name === "samesite" && attributeValue) cookie.sameSite = attributeValue;
      else if (name === "max-age" && /^-?\d+$/.test(attributeValue)) maxAge = Number(attributeValue);
      else if (name === "expires" && attributeValue) {
        const timestamp = Date.parse(attributeValue);
        if (Number.isFinite(timestamp)) cookie.expires = Math.floor(timestamp / 1000);
      }
    }
    if (cookie.invalidDomain || !/^[A-Za-z0-9_-]{1,80}$/.test(key)) continue;
    const expiredByDate = Number.isFinite(cookie.expires) && cookie.expires <= Math.floor(Date.now() / 1000);
    if (!value || maxAge !== null && maxAge <= 0 || expiredByDate) {
      deletions.push({ key, domain: cookie.domain, path: cookie.path });
      continue;
    }
    if (maxAge !== null) cookie.expires = Math.floor(Date.now() / 1000) + maxAge;
    accepted.push(cookie);
  }
  return { accepted, deletions };
}

function extractIdentity(html) {
  const patterns = [
    /"USER_ID"\s*:\s*"?([0-9]{5,30})"?/,
    /"actorID"\s*:\s*"?([0-9]{5,30})"?/,
    /"ACCOUNT_ID"\s*:\s*"?([0-9]{5,30})"?/
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match) return match[1];
  }
  return null;
}

/**
 * Establishes and validates an owner-supplied personal Facebook web session.
 * This is a session bootstrap layer, not a password-login or MQTT implementation.
 */
async function createPersonalSession({
  appState,
  fetchImpl = globalThis.fetch,
  userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
  timeoutMs = 20000,
  onDiagnostic = null
} = {}) {
  if (typeof fetchImpl !== "function") throw new TypeError("A Fetch-compatible implementation is required");
  if (onDiagnostic !== null && typeof onDiagnostic !== "function") throw new TypeError("onDiagnostic must be a function");
  const emitDiagnostic = event => { if (onDiagnostic) { try { onDiagnostic(event); } catch {} } };
  if (typeof userAgent !== "string" || !userAgent.trim() || userAgent.length > 1024) {
    throw new TypeError("A valid User-Agent is required");
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 120000) {
    throw new TypeError("timeoutMs must be between 1000 and 120000");
  }

  const cookies = validateSessionCookies(appState);
  const jar = new CookieJar(cookies);
  const userId = cookies.find(cookie => cookie.key === "c_user")?.value;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("Facebook session validation timed out")), timeoutMs);
  let closed = false;

  try {
    const bootstrapStartedAt = Date.now();
    const bootstrapResponse = await fetchImpl(FACEBOOK_ORIGIN + "/", {
      method: "GET",
      redirect: "manual",
      headers: {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        cookie: jar.getCookieHeader(FACEBOOK_ORIGIN + "/"),
        "user-agent": userAgent
      },
      signal: controller.signal
    });

    const response = bootstrapResponse;
    const { accepted: bootstrapCookies, deletions: bootstrapDeletions } = collectResponseCookies(response, new URL(FACEBOOK_ORIGIN + "/"));
    if (bootstrapCookies.length) jar.setCookies(bootstrapCookies);
    if (bootstrapDeletions.length) jar.deleteCookies(bootstrapDeletions);
    emitDiagnostic({ phase: "response", request: { url: FACEBOOK_ORIGIN + "/", method: "GET" }, response: { status: response.status, contentType: response.headers?.get?.("content-type") || "", bodyBytes: Number(response.headers?.get?.("content-length") || 0) }, durationMs: Date.now() - bootstrapStartedAt });
    if (response.status >= 500) {
      throw sessionError("Facebook is temporarily unavailable while validating the session", "FCA_UPSTREAM_UNAVAILABLE", "error");
    }
    const declaredLength = Number(response.headers?.get?.("content-length") || 0);
    if (declaredLength > MAX_RESPONSE_BYTES) {
      throw sessionError("Facebook session response exceeded the safety limit", "FCA_RESPONSE_TOO_LARGE", "error");
    }
    const html = await response.text();
    if (Buffer.byteLength(html, "utf8") > MAX_RESPONSE_BYTES) {
      throw sessionError("Facebook session response exceeded the safety limit", "FCA_RESPONSE_TOO_LARGE", "error");
    }
    const state = detectSessionChallenge(response, html);
    if (state === "checkpoint") {
      throw sessionError("Facebook requires the account owner to complete a checkpoint", "FCA_CHECKPOINT_REQUIRED", state);
    }
    if (state === "logged_out" || response.status === 401 || response.status === 403) {
      throw sessionError("The supplied Facebook AppState is expired or not authenticated", "FCA_SESSION_EXPIRED", "logged_out");
    }
    if (!response.ok) {
      throw sessionError("Facebook session validation failed with HTTP " + response.status, "FCA_SESSION_VALIDATION_FAILED", "error");
    }

    const pageUserId = extractIdentity(html);
    const pageTokens = extractFacebookTokens(html);
    if (pageUserId && pageUserId !== userId) {
      throw sessionError("Facebook returned a different account than the supplied c_user session", "FCA_SESSION_IDENTITY_MISMATCH", "error");
    }

    return Object.freeze({
      userId,
      state: "active",
      validatedAt: Date.now(),
      getTokens() {
        if (closed) throw new Error("Facebook session is closed");
        return { ...pageTokens };
      },
      getCookieHeader(url = FACEBOOK_ORIGIN + "/") {
        if (closed) throw new Error("Facebook session is closed");
        const target = url instanceof URL ? url : new URL(url);
        if (target.protocol !== "https:" || !/(^|\.)facebook\.com$|(^|\.)messenger\.com$/.test(target.hostname)) {
          throw new TypeError("Personal session cookies may only be used with Facebook/Messenger HTTPS hosts");
        }
        return jar.getCookieHeader(target);
      },
      async request(input, options = {}) {
        if (closed) throw new Error("Facebook session is closed");
        const target = input instanceof URL ? new URL(input.href) : new URL(input);
        if (target.protocol !== "https:" || !/(^|\.)facebook\.com$|(^|\.)messenger\.com$/.test(target.hostname)) {
          throw new TypeError("Personal session requests are restricted to Facebook/Messenger HTTPS hosts");
        }
        const method = String(options.method || "GET").toUpperCase();
        if (!["GET", "HEAD", "POST"].includes(method)) {
          throw new TypeError("Personal session request method is not supported");
        }
        const headers = new Headers(options.headers || {});
        if (headers.has("cookie") || headers.has("host")) {
          throw new TypeError("Cookie and Host headers are managed by the personal session");
        }
        headers.set("cookie", jar.getCookieHeader(target));
        headers.set("user-agent", userAgent);
        const requestController = new AbortController();
        const timeout = setTimeout(() => requestController.abort(new Error("Facebook request timed out")), timeoutMs);
        const onAbort = () => requestController.abort(options.signal.reason);
        if (options.signal) {
          if (options.signal.aborted) onAbort();
          else options.signal.addEventListener("abort", onAbort, { once: true });
        }
        const requestStartedAt = Date.now();
        try {
          const response = await fetchImpl(target, {
            ...options,
            method,
            headers,
            redirect: "manual",
            signal: requestController.signal
          });
          emitDiagnostic({ phase: "response", request: { url: target.origin + target.pathname, method }, response: { status: response.status, contentType: response.headers?.get?.("content-type") || "", bodyBytes: Number(response.headers?.get?.("content-length") || 0) }, durationMs: Date.now() - requestStartedAt });
          const { accepted, deletions } = collectResponseCookies(response, target);
          if (accepted.length) jar.setCookies(accepted);
          if (deletions.length) jar.deleteCookies(deletions);
          return response;
        } catch (error) {
          emitDiagnostic({ phase: "error", request: { url: target.origin + target.pathname, method }, errorCode: typeof error?.code === "string" ? error.code : undefined });
          throw error;
        } finally {
          clearTimeout(timeout);
          options.signal?.removeEventListener("abort", onAbort);
        }
      },
      getAppState() {
        if (closed) throw new Error("Facebook session is closed");
        return jar.cookies.map(cookie => ({ ...cookie }));
      },
      close() { closed = true; jar.clear(); }
    });
  } catch (error) {
    if (error?.name === "AbortError" || controller.signal.aborted) {
      throw sessionError("Facebook session validation timed out", "FCA_SESSION_TIMEOUT", "error");
    }
    const state = classifySessionState(error);
    if (state === "checkpoint" || state === "logged_out") throw error;
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { createPersonalSession, detectSessionChallenge, extractIdentity, extractFacebookTokens };
