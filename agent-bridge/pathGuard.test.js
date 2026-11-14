"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeRelative } = require("./pathGuard");

test("allows only files inside the language workspace", () => {
  const result = normalizeRelative("languages/bn.lang");
  assert.equal(result.relative, "languages/bn.lang");
  assert.throws(() => normalizeRelative("scripts/cmds/example.js"), /outside the approved workspace/);
});

test("rejects paths outside approved roots and traversal attempts", () => {
  assert.throws(() => normalizeRelative("config.json"), /outside the approved workspace/);
  assert.throws(() => normalizeRelative("../config.json"));
  assert.throws(() => normalizeRelative("languages/../config.json"));
});

test("rejects protected, hidden, dependency and unsupported file paths", () => {
  assert.throws(() => normalizeRelative("languages/.env"));
  assert.throws(() => normalizeRelative("languages/node_modules/pkg/index.js"));
  assert.throws(() => normalizeRelative("languages/account.txt"));
  assert.throws(() => normalizeRelative("languages/hidden.txt"), /Only .lang and .js files/);
});

test("rejects absolute and malformed paths", () => {
  assert.throws(() => normalizeRelative("/etc/passwd"));
  assert.throws(() => normalizeRelative(""));
  assert.throws(() => normalizeRelative("languages\\\\bn.lang"));
});
