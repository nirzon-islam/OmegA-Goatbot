"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeRelative } = require("./pathGuard");

test("allows supported project files inside the workspace", () => {
  for (const file of ["languages/bn.lang", "scripts/cmds/example.js", "config.json"]) {
    const result = normalizeRelative(file);
    assert.equal(result.relative, file);
    assert.ok(result.absolute);
  }
});

test("rejects traversal attempts and paths outside the workspace", () => {
  assert.throws(() => normalizeRelative("../config.json"));
  assert.throws(() => normalizeRelative("languages/../config.json"));
  assert.throws(() => normalizeRelative("scripts/../../outside.js"));
});

test("rejects protected, hidden, dependency and unsupported file paths", () => {
  assert.throws(() => normalizeRelative("languages/.env"));
  assert.throws(() => normalizeRelative("languages/node_modules/pkg/index.js"));
  assert.throws(() => normalizeRelative("languages/account.txt"));
  assert.throws(() => normalizeRelative("languages/program.exe"), /extension is not supported/);
});

test("rejects absolute and malformed paths", () => {
  assert.throws(() => normalizeRelative("/etc/passwd"));
  assert.throws(() => normalizeRelative(""));
  assert.throws(() => normalizeRelative("languages\\\\bn.lang"));
});
