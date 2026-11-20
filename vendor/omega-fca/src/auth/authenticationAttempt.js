"use strict";

const STATES = Object.freeze([
  "idle", "authenticating", "challenge_required", "verifying_challenge",
  "authenticated", "failed", "closed"
]);

function publicFailure() {
  // Never return provider-controlled messages, names, codes, or causes to callers.
  return new Error("Authentication failed; inspect the provider error securely");
}

function publicChallenge(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Authentication provider returned an invalid challenge");
  }
  const type = typeof value.type === "string" && /^[a-z0-9_-]{1,64}$/i.test(value.type.trim())
    ? value.type.trim() : "verification";
  // Provider messages may echo credentials, cookies, or challenge answers.
  // Keep the public prompt generic; the provider retains richer private state.
  const message = "Additional account verification is required.";
  const methods = Array.isArray(value.methods)
    ? value.methods.filter(item => typeof item === "string" && /^[a-z0-9_-]{1,64}$/i.test(item.trim())).map(item => item.trim()).slice(0, 10) : [];
  return Object.freeze({ type, message, methods: Object.freeze(methods) });
}

/**
 * Owns one authentication attempt and its owner-mediated challenge handoff.
 *
 * A provider returns { status: "authenticated", session } or
 * { status: "challenge_required", challenge, resume(answer), cancel?() }.
 * The resume and optional cancel functions remain private to this attempt.
 */
function createAuthenticationAttempt({ authenticate, maxChallengeRounds = 3 } = {}) {
  if (typeof authenticate !== "function") throw new TypeError("authenticate must be a function");
  if (!Number.isInteger(maxChallengeRounds) || maxChallengeRounds < 1 || maxChallengeRounds > 5) {
    throw new RangeError("maxChallengeRounds must be between 1 and 5");
  }

  let state = "idle";
  let challenge = null;
  let resumeProvider = null;
  let cancelProvider = null;
  let credentials = null;
  let options = null;
  let session = null;
  let operation = null;
  let challengeRounds = 0;
  let lastError = null;

  function snapshot() {
    return Object.freeze({
      state,
      challenge,
      challengeRounds,
      authenticated: state === "authenticated",
      error: lastError ? Object.freeze({
        name: "Error",
        code: null,
        // Provider-controlled codes can also contain echoed secrets; expose none.
        message: "Authentication failed; inspect the provider error securely"
      }) : null
    });
  }

  function ensureOpen() {
    if (state === "closed") throw new Error("Authentication attempt is closed");
  }

  async function consume(result) {
    if (!result || typeof result !== "object") {
      throw new TypeError("Authentication provider returned an invalid result");
    }
    if (result.status === "authenticated") {
      if (!result.session || typeof result.session !== "object") {
        throw new TypeError("Authenticated result must include a session object");
      }
      session = result.session;
      resumeProvider = null;
      cancelProvider = null;
      challenge = null;
      credentials = null;
      options = null;
      state = "authenticated";
      return session;
    }
    if (result.status === "challenge_required") {
      if (typeof result.resume !== "function") {
        throw new TypeError("Challenge result must include a resume(answer) function");
      }
      challengeRounds += 1;
      if (challengeRounds > maxChallengeRounds) {
        if (typeof result.cancel === "function") {
          try { await result.cancel(); } catch {}
        }
        throw Object.assign(new Error("Authentication challenge limit exceeded"), {
          code: "FCA_CHALLENGE_LIMIT", retryable: false
        });
      }
      challenge = publicChallenge(result.challenge);
      resumeProvider = result.resume;
      cancelProvider = typeof result.cancel === "function" ? result.cancel : null;
      state = "challenge_required";
      return null;
    }
    throw new TypeError("Authentication provider status must be authenticated or challenge_required");
  }

  function begin(input, loginOptions = {}) {
    ensureOpen();
    if (state !== "idle") return Promise.reject(new Error("Authentication attempt has already started"));
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return Promise.reject(new TypeError("Authentication credentials must be an object"));
    }
    credentials = input;
    options = loginOptions && typeof loginOptions === "object" ? loginOptions : {};
    state = "authenticating";
    operation = Promise.resolve().then(() => authenticate({ credentials, options }))
      .then(consume)
      .catch(error => {
        lastError = error instanceof Error ? error : new Error("Authentication provider failed");
        state = "failed";
        resumeProvider = null;
        cancelProvider = null;
        challenge = null;
        credentials = null;
        options = null;
        if (lastError.code === "FCA_CHALLENGE_LIMIT") throw Object.assign(new Error("Authentication challenge limit exceeded"), { code: "FCA_CHALLENGE_LIMIT", retryable: false });
        throw publicFailure();
      })
      .finally(() => { operation = null; });
    return operation;
  }

  function submitChallenge(answer) {
    ensureOpen();
    if (state !== "challenge_required" || typeof resumeProvider !== "function") {
      return Promise.reject(new Error("No authentication challenge is waiting for an answer"));
    }
    if (operation) return Promise.reject(new Error("Authentication operation is already in progress"));
    if (answer == null || (typeof answer !== "string" && (typeof answer !== "object" || Array.isArray(answer)))) {
      return Promise.reject(new TypeError("Challenge answer must be a string or an object"));
    }
    const resume = resumeProvider;
    const cancelPending = cancelProvider;
    resumeProvider = null;
    state = "verifying_challenge";
    operation = Promise.resolve().then(() => resume(answer))
      .then(consume)
      .catch(async error => {
        if (cancelPending) {
          try { await cancelPending(); } catch {}
        }
        lastError = error instanceof Error ? error : new Error("Challenge verification failed");
        state = "failed";
        resumeProvider = null;
        cancelProvider = null;
        challenge = null;
        credentials = null;
        options = null;
        if (lastError.code === "FCA_CHALLENGE_LIMIT") throw Object.assign(new Error("Authentication challenge limit exceeded"), { code: "FCA_CHALLENGE_LIMIT", retryable: false });
        throw publicFailure();
      })
      .finally(() => { operation = null; });
    return operation;
  }

  async function close() {
    if (state === "closed") return;
    if (operation) {
      try { await operation; } catch {}
    }
    const active = session;
    const cancel = cancelProvider;
    session = null;
    resumeProvider = null;
    cancelProvider = null;
    challenge = null;
    credentials = null;
    options = null;
    lastError = null;
    state = "closed";
    try {
      if (cancel) await cancel();
    } finally {
      if (active && typeof active.close === "function") await active.close();
    }
  }

  return Object.freeze({ begin, submitChallenge, close, snapshot });
}

module.exports = { createAuthenticationAttempt, AUTHENTICATION_ATTEMPT_STATES: STATES };
