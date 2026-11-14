"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeRelative } = require("./pathGuard");

test("allows files inside explicitly approved roots", () => {
  const result = normalizeRelative("scripts/cmds/example.js");
  assert.equal(result.relative, "scripts/cmds/example.js");
});

test("rejects paths outside approved roots", () => {
  assert.throws(() => normalizeRelative("config.json"), /outside the approved workspace/);
});

test("rejects traversal attempts", () => {
  assert.throws(() => normalizeRelative("../config.json"), /Path traversal/);
  assert.throws(() => normalizeRelative("scripts/cmds/../../config.json"), /Path traversal/);
});

test("rejects protected secret and dependency paths", () => {
  assert.throws(() => normalizeRelative("scripts/cmds/.env"), /Path is protected/);
  assert.throws(() => normalizeRelative("scripts/cmds/node_modules/pkg/index.js"), /Path is protected/);
  assert.throws(() => normalizeRelative("scripts/cmds/account.txt"), /Path is protected/);
});

test("rejects absolute and malformed paths", () => {
  assert.throws(() => normalizeRelative("/etc/passwd"), /Path traversal/);
  assert.throws(() => normalizeRelative(""), /Invalid file path/);
});
