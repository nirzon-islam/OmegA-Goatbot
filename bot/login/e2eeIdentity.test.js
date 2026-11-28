"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { loadOrCreateE2EEIdentity } = require("./e2eeIdentity");

test("creates a private persistent identity and reuses it after restart", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "omega-e2ee-"));
  try {
    const first = loadOrCreateE2EEIdentity("123456789", root);
    const second = loadOrCreateE2EEIdentity("123456789", root);
    assert.equal(first.created, true);
    assert.equal(second.created, false);
    assert.equal(first.localDeviceId, second.localDeviceId);
    assert.deepEqual(first.encryptionKey, second.encryptionKey);
    assert.equal(first.encryptionKey.length, 32);
    assert.equal(fs.statSync(first.identityPath).mode & 0o077, 0);
    assert.equal(fs.statSync(path.dirname(first.identityPath)).mode & 0o077, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("isolates identities between Facebook accounts", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "omega-e2ee-accounts-"));
  try {
    const first = loadOrCreateE2EEIdentity("123456789", root);
    const second = loadOrCreateE2EEIdentity("987654321", root);
    assert.notEqual(first.localDeviceId, second.localDeviceId);
    assert.notDeepEqual(first.encryptionKey, second.encryptionKey);
    assert.notEqual(first.storagePath, second.storagePath);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("refuses to silently replace a corrupted identity", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "omega-e2ee-corrupt-"));
  try {
    const directory = path.join(root, "123456789");
    fs.mkdirSync(directory, { recursive: true });
    const identityPath = path.join(directory, "identity.json");
    fs.writeFileSync(identityPath, "{broken", { mode: 0o600 });
    assert.throws(() => loadOrCreateE2EEIdentity("123456789", root), /corrupted/);
    assert.equal(fs.readFileSync(identityPath, "utf8"), "{broken");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("rejects invalid account identifiers and empty storage roots", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "omega-e2ee-invalid-"));
  try {
    assert.throws(() => loadOrCreateE2EEIdentity("../other", root), /verified Facebook account ID/);
    assert.throws(() => loadOrCreateE2EEIdentity("123456789", ""), /storage root/);
    assert.deepEqual(fs.readdirSync(root), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
