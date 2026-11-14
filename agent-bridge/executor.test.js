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

test("allows supported repository source while protecting sensitive paths", () => {
  assert.equal(normalizeRelative("languages/bn.lang").relative, "languages/bn.lang");
  assert.equal(normalizeRelative("scripts/cmds/example.js").relative, "scripts/cmds/example.js");
  assert.equal(normalizeRelative("dashboard/app.css").relative, "dashboard/app.css");
  assert.equal(normalizeRelative("README.md").relative, "README.md");
  assert.throws(() => normalizeRelative("languages/../config.json"));
  assert.throws(() => normalizeRelative("languages/.env"));
  assert.throws(() => normalizeRelative("config.json"));
  assert.throws(() => normalizeRelative("scripts/package-lock.json"));
  assert.throws(() => normalizeRelative("scripts/hidden.bin"));
  assert.throws(() => normalizeRelative("account.txt"));
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
  const dir = path.join(root, "scripts", "cmds");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "safe.js");
  fs.writeFileSync(file, "globalThis.__agentExecuted = true;");
  assert.equal(executeApprovedAction({ type: "read", path: "scripts/cmds/safe.js" }).content.includes("__agentExecuted"), true);
  assert.equal(executeApprovedAction({ type: "test", path: "scripts/cmds/safe.js" }).passed, true);
  assert.equal(globalThis.__agentExecuted, undefined);
});

test("dangerous and unsupported operations are rejected", () => {
  assert.throws(() => executeApprovedAction({ type: "delete", path: "languages/bn.lang" }), /not supported/);
  assert.throws(() => executeApprovedAction({ type: "install", path: "languages/bn.lang" }), /not supported/);
});

test("approved plans can list and read supported repository text files", () => {
  const dir = path.join(root, "scripts", "cmds", "nested");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(root, "scripts", "cmds", "main.js"), "module.exports = {};");
  fs.writeFileSync(path.join(dir, "notes.md"), "notes");
  const listing = executeApprovedAction({ type: "list", path: "scripts/cmds" });
  assert.ok(listing.entries.some(item => item.path === "scripts/cmds/main.js"));
  const result = executeApprovedAction({
    type: "plan",
    summary: "Read-only source inventory",
    steps: [
      { type: "list", path: "scripts/cmds" },
      { type: "readMany", path: "scripts/cmds" }
    ]
  });
  assert.equal(result.steps.length, 2);
  assert.ok(result.steps[1].entries.some(item => item.path === "scripts/cmds/nested/notes.md" && item.content === "notes"));
});
