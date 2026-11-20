"use strict";

function retryAfterMs(value, now = Date.now()) {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 120_000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, Math.min(date - now, 120_000)) : null;
}

function isRetryableStatus(status) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function combineAbortSignals(signals) {
  const controller = new AbortController();
  const cleanup = [];
  for (const signal of signals.filter(Boolean)) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }
    const onAbort = () => controller.abort(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    cleanup.push(() => signal.removeEventListener("abort", onAbort));
  }
  return {
    signal: controller.signal,
    cleanup() { for (const remove of cleanup) remove(); }
  };
}

function abortReason(signal) {
  return signal.reason || Object.assign(new Error("Request aborted"), { name: "AbortError" });
}

async function waitForRetry(delayMs, sleep, signal) {
  if (signal?.aborted) throw abortReason(signal);
  if (!signal) return sleep(delayMs);
  await new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => signal.removeEventListener("abort", onAbort);
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn(value);
    };
    const onAbort = () => finish(reject, abortReason(signal));
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) return onAbort();
    Promise.resolve().then(() => sleep(delayMs)).then(
      () => signal.aborted ? finish(reject, abortReason(signal)) : finish(resolve),
      error => finish(reject, error)
    );
  });
}

function createRequestClient({ fetchImpl = globalThis.fetch, timeoutMs = 20_000, maxAttempts = 3, baseDelayMs = 500, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), random = Math.random } = {}) {
  if (typeof fetchImpl !== "function") throw new TypeError("Fetch implementation is required");
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 5) throw new TypeError("maxAttempts must be between 1 and 5");
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) throw new TypeError("timeoutMs must be a positive integer");

  return async function request(input, options = {}) {
    const url = input instanceof URL ? input : new URL(input);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && url.hostname === "localhost")) {
      throw new TypeError("Facebook requests must use HTTPS");
    }
    if (url.username || url.password) throw new TypeError("Request URL must not contain credentials");
    const method = String(options.method || "GET").toUpperCase();
    const canRetry = options.retryable === true ||
      (options.retryable !== false && (method === "GET" || method === "HEAD"));
    const { retryable: _retryable, ...fetchOptions } = options;
    let attempt = 0;
    while (true) {
      if (options.signal?.aborted) throw abortReason(options.signal);
      let response;
      const timeoutSignal = AbortSignal.timeout(timeoutMs);
      const combined = combineAbortSignals([options.signal, timeoutSignal]);
      try {
        response = await fetchImpl(url, { ...fetchOptions, signal: combined.signal });
      } catch (error) {
        if (!canRetry || options.signal?.aborted || attempt + 1 >= maxAttempts || error?.name === "AbortError" || error?.name === "TimeoutError") throw error;
        const delay = Math.min(30_000, baseDelayMs * (2 ** attempt)) * (0.8 + random() * 0.4);
        attempt++;
        await waitForRetry(Math.round(delay), sleep, options.signal);
        continue;
      } finally {
        combined.cleanup();
      }
      if (options.signal?.aborted) throw abortReason(options.signal);
      if (!isRetryableStatus(response.status) || !canRetry || attempt + 1 >= maxAttempts) return response;
      try { await response.body?.cancel?.(); } catch {}
      const serverDelay = retryAfterMs(response.headers?.get?.("retry-after"));
      const delay = serverDelay === null
        ? Math.min(30_000, baseDelayMs * (2 ** attempt)) * (0.8 + random() * 0.4)
        : serverDelay;
      attempt++;
      await waitForRetry(Math.round(delay), sleep, options.signal);
    }
  };
}

module.exports = { createRequestClient, retryAfterMs, isRetryableStatus };
