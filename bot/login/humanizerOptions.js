"use strict";

// Translate GoatBot's humanizer config into OmegA-FCA's runtime
// HumanizerController options. The controller owns delay, cooldown,
// per-thread/global rate limiting, and the typing-indicator lifecycle.

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function buildHumanizeOptions(config) {
  const h = (config && config.humanizer) || {};
  if (h.enable === false) return { enabled: false };

  return {
    enabled: true,
    // A number is a fixed delay; a two-value array is a random delay range.
    // OmegA-FCA normalizes the range ordering in setOptions().
    reactDelayMs: Array.isArray(h.delayMs)
      ? h.delayMs.map(value => clampInt(value, 0, 60000, 0))
      : clampInt(h.delayMs, 0, 60000, 3000),
    cooldownMs: clampInt(h.cooldownMs, 0, 600000, 5500),
    maxPerMinute: clampInt(h.maxPerMinute, 0, 1000, 20),
    perThread: h.perThread !== false
  };
}

// The controller is available after the MQTT listener has initialized its
// middleware. Call this after listenMqtt() and after every listener restart.
function applyHumanizerToApi(api, config) {
  try {
    const humanizer = api && typeof api.getHumanizer === "function"
      ? api.getHumanizer()
      : null;
    if (!humanizer || typeof humanizer.setOptions !== "function") return false;

    humanizer.setOptions(buildHumanizeOptions(config));
    return true;
  } catch {
    return false;
  }
}

module.exports = { buildHumanizeOptions, applyHumanizerToApi };
