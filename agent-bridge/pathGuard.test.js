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

test("default workspace is stable when the process starts outside the repository", () => {
  const { execFileSync } = require("child_process");
  const path = require("path");
  const modulePath = path.join(__dirname, "pathGuard.js");
  const script = "const guard = require(" + JSON.stringify(modulePath) + "); " +
    "const result = guard.normalizeRelative('scripts/cmds/example.js'); " +
    "process.stdout.write(result.absolute);";
  const absolute = execFileSync(process.execPath, ["-e", script], {
    cwd: path.parse(__dirname).root,
    env: { ...process.env, AGENT_WORKSPACE_ROOT: "" },
    encoding: "utf8"
  });
  assert.ok(absolute.startsWith(path.resolve(__dirname, "..") + path.sep));
});
