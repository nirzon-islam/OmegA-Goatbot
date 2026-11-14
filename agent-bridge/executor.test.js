"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "goat-agent-"));
process.env.AGENT_WORKSPACE_ROOT = root;
const { normalizeRelative } = require("./pathGuard");
const { executeApprovedAction } = require("./executor");

test("only language workspace paths are allowed", () => {
  assert.equal(normalizeRelative("languages/bn.lang").relative, "languages/bn.lang");
  assert.throws(() => normalizeRelative("scripts/cmds/example.js"));
  assert.throws(() => normalizeRelative("dashboard/app.js"));
  assert.throws(() => normalizeRelative("languages/../config.json"));
  assert.throws(() => normalizeRelative("languages/.env"));
  assert.throws(() => normalizeRelative("languages/hidden.txt"));
});

test("create refuses overwrite and edit makes a backup", () => {
  const dir = path.join(root, "languages");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "bn.lang");
  assert.deepEqual(executeApprovedAction({ type: "create", path: "languages/bn.lang", content: "hello" }).written, true);
  assert.throws(() => executeApprovedAction({ type: "create", path: "languages/bn.lang", content: "overwrite" }), /already exists/);
  const result = executeApprovedAction({ type: "edit", path: "languages/bn.lang", content: "updated" });
  assert.ok(result.backupId);
  assert.equal(fs.readFileSync(file, "utf8"), "updated");
});

test("read and syntax test do not execute code", () => {
  const dir = path.join(root, "languages");
  fs.writeFileSync(path.join(dir, "safe.js"), "globalThis.__agentExecuted = true;");
  assert.equal(executeApprovedAction({ type: "read", path: "languages/safe.js" }).content.includes("__agentExecuted"), true);
  assert.equal(executeApprovedAction({ type: "test", path: "languages/safe.js" }).passed, true);
  assert.equal(globalThis.__agentExecuted, undefined);
});

test("dangerous and unsupported operations are rejected", () => {
  assert.throws(() => executeApprovedAction({ type: "delete", path: "languages/bn.lang" }), /not supported/);
  assert.throws(() => executeApprovedAction({ type: "install", path: "languages/bn.lang" }), /not supported/);
});
