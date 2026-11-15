"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "goat-agent-"));
process.env.AGENT_WORKSPACE_ROOT = root;
const { normalizeRelative, normalizeDirectory } = require("./pathGuard");
const { executeApprovedAction } = require("./executor");

test("normal GoatBot project folders are available while sensitive paths stay blocked", () => {
  for (const file of [
    "scripts/cmds/example.js", "scripts/events/welcome.js",
    "modules/example.js", "utils/helper.js", "config.json", "README.md"
  ]) assert.equal(normalizeRelative(file).relative, file);

  for (const file of [
    ".env", ".git/config", "node_modules/pkg/index.js",
    "account.txt", "Fca_Database/store.json", "secrets/key.txt",
    "scripts/cmds/appstate.json", "scripts/cmds/my-cookie.txt",
    "scripts/cmds/.hidden.js", "../outside.js", "scripts\\\\cmds\\\\bad.js"
  ]) assert.throws(() => normalizeRelative(file));

  assert.equal(normalizeDirectory("scripts/cmds").relative, "scripts/cmds");
});

test("create refuses overwrite and edit makes a backup", () => {
  const dir = path.join(root, "scripts", "cmds");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "example.js");
  const content = "module.exports = {};";
  const created = executeApprovedAction({ type: "create", path: "scripts/cmds/example.js", content });
  assert.equal(created.written, true);
  assert.equal(created.downloadableFiles[0].content, content);
  assert.throws(() => executeApprovedAction({ type: "create", path: "scripts/cmds/example.js", content: "overwrite" }), /already exists/);
  const result = executeApprovedAction({ type: "edit", path: "scripts/cmds/example.js", content: "module.exports = { ok: true };" });
  assert.ok(result.backupId);
  assert.equal(fs.readFileSync(file, "utf8"), "module.exports = { ok: true };");
});

test("read, list and syntax test work without executing code", () => {
  const dir = path.join(root, "scripts", "cmds");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "safe.js"), "globalThis.__agentExecuted = true;");
  assert.equal(executeApprovedAction({ type: "read", path: "scripts/cmds/safe.js" }).content.includes("__agentExecuted"), true);
  assert.equal(executeApprovedAction({ type: "test", path: "scripts/cmds/safe.js" }).passed, true);
  assert.equal(globalThis.__agentExecuted, undefined);
  assert.ok(executeApprovedAction({ type: "list", path: "scripts/cmds" }).entries.some(item => item.path.endsWith("safe.js")));
});

test("approved plans can list, read and return downloadable file contents", () => {
  const dir = path.join(root, "scripts", "cmds");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "one.js"), "module.exports = 1;");
  const result = executeApprovedAction({
    type: "plan", summary: "Inspect command files",
    steps: [
      { type: "list", path: "scripts/cmds" },
      { type: "readMany", path: "scripts/cmds" }
    ]
  });
  assert.equal(result.steps.length, 2);
  assert.ok(result.downloadableFiles.some(file => file.path === "scripts/cmds/one.js"));
});

test("unsupported destructive and shell operations are rejected", () => {
  assert.throws(() => executeApprovedAction({ type: "delete", path: "scripts/cmds/example.js" }), /not supported/);
  assert.throws(() => executeApprovedAction({ type: "install", path: "package.json" }), /not supported/);
  assert.throws(() => executeApprovedAction({ type: "shell", command: "rm -rf ." }), /requires type and path/);
});
