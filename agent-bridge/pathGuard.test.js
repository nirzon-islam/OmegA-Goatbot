"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { normalizeRelative, normalizeDirectory } = require("./pathGuard");

test("allows repository source and safe text files", () => {
  for (const file of [
    "scripts/cmds/example.js", "dashboard/app.js",
    "agent-bridge/README.md", "configCommands.json", "languages/bn.lang"
  ]) {
    if (file === "configCommands.json") {
      assert.throws(() => normalizeRelative(file), /Sensitive file/);
    } else {
      assert.equal(normalizeRelative(file).relative, file);
    }
  }
});

test("blocks credentials, appstate, environment files and generated dependencies", () => {
  for (const file of [
    ".env", "account.txt", "config.json", "config.dev.json",
    "agent-bridge/.env.example", "node_modules/pkg/index.js",
    ".git/config", "secrets/key.json", "bot/session/token.json",
    "Fca_Database/state.json", "package-lock.json"
  ]) assert.throws(() => normalizeRelative(file));
});

test("rejects traversal, absolute paths, symlink-like malformed paths and unsupported extensions", () => {
  for (const file of [
    "../config.json", "languages/../config.json", "/etc/passwd",
    "languages\\bn.lang", "languages/hidden.bin"
  ]) assert.throws(() => normalizeRelative(file));
  assert.throws(() => normalizeDirectory("../"));
});
