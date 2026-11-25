"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { buildHumanizeOptions, applyHumanizerToApi } = require("./humanizerOptions");

test("uses OmegA-FCA-compatible defaults when humanizer is enabled", () => {
  assert.deepEqual(buildHumanizeOptions({}), {
    enabled: true,
    reactDelayMs: 3000,
    cooldownMs: 5500,
    maxPerMinute: 20,
    perThread: true,
    commandPrefixes: [],
    commandNames: [],
    noPrefixEnabled: false,
    noPrefixAdminIds: []
  });
});

test("disables humanizer without applying delays", () => {
  assert.deepEqual(buildHumanizeOptions({ humanizer: { enable: false } }), { enabled: false });
});

test("clamps numeric settings and preserves delay ranges", () => {
  assert.deepEqual(buildHumanizeOptions({ humanizer: {
    delayMs: [70000, -10],
    cooldownMs: 900000,
    maxPerMinute: 2000,
    perThread: false
  } }), {
    enabled: true,
    reactDelayMs: [60000, 0],
    cooldownMs: 600000,
    maxPerMinute: 1000,
    perThread: false,
    commandPrefixes: [],
    commandNames: [],
    noPrefixEnabled: false,
    noPrefixAdminIds: []
  });
});

test("uses safe fallbacks for invalid numeric settings", () => {
  assert.deepEqual(buildHumanizeOptions({ humanizer: {
    delayMs: "invalid",
    cooldownMs: NaN,
    maxPerMinute: Infinity
  } }), {
    enabled: true,
    reactDelayMs: 3000,
    cooldownMs: 5500,
    maxPerMinute: 20,
    perThread: true,
    commandPrefixes: [],
    commandNames: [],
    noPrefixEnabled: false,
    noPrefixAdminIds: []
  });
});

test("applies enabled options through the public OmegA-FCA controller API", () => {
  let applied;
  const api = { getHumanizer: () => ({ setOptions: options => { applied = options; } }) };
  assert.equal(applyHumanizerToApi(api, { humanizer: { enable: true, delayMs: 1200 } }), true);
  assert.deepEqual(applied, {
    enabled: true,
    reactDelayMs: 1200,
    cooldownMs: 5500,
    maxPerMinute: 20,
    perThread: true,
    commandPrefixes: [],
    commandNames: [],
    noPrefixEnabled: false,
    noPrefixAdminIds: []
  });
});

test("applies disabled state through setOptions", () => {
  let applied;
  const api = { getHumanizer: () => ({ setOptions: options => { applied = options; } }) };
  assert.equal(applyHumanizerToApi(api, { humanizer: { enable: false } }), true);
  assert.deepEqual(applied, { enabled: false });
});

test("returns false when controller is unavailable or throws", () => {
  assert.equal(applyHumanizerToApi(null, {}), false);
  assert.equal(applyHumanizerToApi({ getHumanizer: () => null }, {}), false);
  assert.equal(applyHumanizerToApi({ getHumanizer: () => ({ setOptions() { throw new Error("failed"); } }) }, {}), false);
});
