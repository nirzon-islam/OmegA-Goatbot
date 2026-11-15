"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const {
  validateAppState,
  writeAppStateAtomic,
  loginCandidate,
  listenUntilReady
} = require("./secureSession");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const cookie = (name, value) => ({ name, value, domain: ".facebook.com", path: "/", hostOnly: false, creation: Date.now() });

test("validates appstate identity and required session cookies", () => {
  const state = [cookie("c_user", "123456789"), cookie("xs", "session")];
  assert.deepEqual(validateAppState(JSON.stringify(state), "123456789"), state);
  assert.throws(() => validateAppState(JSON.stringify(state), "987654321"), /does not match/);
  assert.throws(() => validateAppState("not-json", "123456789"), /valid JSON/);
  assert.throws(() => validateAppState(JSON.stringify([cookie("c_user", "123456789")]), "123456789"), /does not match/);
});

test("writes appstate atomically with restrictive permissions", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "goat-recovery-"));
  const target = path.join(dir, "account.txt");
  try {
    writeAppStateAtomic(target, [cookie("c_user", "123456789"), cookie("xs", "secret")]);
    const saved = JSON.parse(fs.readFileSync(target, "utf8"));
    assert.equal(saved[0].value, "123456789");
    assert.equal(fs.statSync(target).mode & 0o077, 0);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("loginCandidate forces MQTT ready events and validates API shape", async () => {
  let optionsSeen;
  const api = { listenMqtt() {}, getCurrentUserID() { return "123456789"; } };
  const result = await loginCandidate((data, options, cb) => {
    optionsSeen = options;
    cb(null, api);
  }, [], {}, 100);
  assert.equal(result, api);
  assert.equal(optionsSeen.emitReady, true);
});

test("listenUntilReady resolves only after explicit ready event", async () => {
  const emitter = new EventEmitter();
  const api = { listenMqtt() { return emitter; } };
  const pending = listenUntilReady(api, () => {}, 500);
  setImmediate(() => emitter.emit("ready"));
  assert.equal(await pending, emitter);
});

test("listenUntilReady rejects on timeout", async () => {
  const api = { listenMqtt() { return new EventEmitter(); } };
  await assert.rejects(listenUntilReady(api, () => {}, 10), /readiness timed out/);
});
