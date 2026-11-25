"use strict";

// Translate GoatBot's command registry and config into OmegA-FCA's
// command-aware HumanizerController options. This is rebuilt whenever the
// listener starts/restarts, so command aliases and prefix changes stay current.

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function uniqueStrings(values) {
  return [...new Set(values
    .filter(value => typeof value === "string")
    .map(value => value.trim())
    .filter(Boolean))];
}

function getCommandNames() {
  const goatBot = global.GoatBot || {};
  const commands = goatBot.commands;
  const aliases = goatBot.aliases;
  const names = [];
  if (commands && typeof commands.keys === "function") names.push(...commands.keys());
  if (aliases && typeof aliases.keys === "function") names.push(...aliases.keys());
  return uniqueStrings(names.map(name => String(name).toLowerCase()));
}

function getPrefixes(config) {
  const prefixes = [];
  if (typeof config.prefix === "string") prefixes.push(config.prefix);
  else if (Array.isArray(config.prefix)) prefixes.push(...config.prefix);
  // Include thread-specific prefixes when they are stored in thread settings.
  const threads = global.db && Array.isArray(global.db.allThreadData) ? global.db.allThreadData : [];
  for (const thread of threads) {
    const prefix = thread && thread.settings && thread.settings.prefix;
    if (typeof prefix === "string") prefixes.push(prefix);
    else if (Array.isArray(prefix)) prefixes.push(...prefix);
  }
  return uniqueStrings(prefixes);
}

function buildHumanizeOptions(config) {
  const h = (config && config.humanizer) || {};
  if (h.enable === false) return { enabled: false };

  const noPrefixEnabled = !!(config && config.noPrefix && config.noPrefix.enable === true);
  const adminIds = Array.isArray(config && config.adminBot)
    ? config.adminBot.map(String)
    : [];

  return {
    enabled: true,
    // A number is a fixed delay; a two-value array is a random delay range.
    reactDelayMs: Array.isArray(h.delayMs)
      ? h.delayMs.map(value => clampInt(value, 0, 60000, 0))
      : clampInt(h.delayMs, 0, 60000, 3000),
    cooldownMs: clampInt(h.cooldownMs, 0, 600000, 5500),
    maxPerMinute: clampInt(h.maxPerMinute, 0, 1000, 20),
    perThread: h.perThread !== false,
    commandPrefixes: getPrefixes(config),
    commandNames: getCommandNames(),
    noPrefixEnabled,
    noPrefixAdminIds: adminIds
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
