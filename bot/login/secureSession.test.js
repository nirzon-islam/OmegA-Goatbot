"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  validateAppState,
  writeAppStateAtomic,
  loginCandidate,
  listenUntilReady
} = require("./secureSession");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const cookie = (name, value) => ({ key: name, value, domain: ".facebook.com", path: "/", hostOnly: false, creation: Date.now() });

test("validates appstate identity and required session cookies", () => {
  const state = [{ name: "c_user", value: "123456789", domain: ".facebook.com" }, { name: "xs", value: "session", domain: ".facebook.com" }];
  const normalized = validateAppState(JSON.stringify(state), "123456789");
  assert.equal(normalized[0].key, "c_user");
  assert.equal(normalized[0].name, undefined);
  assert.throws(() => validateAppState(JSON.stringify(state), "987654321"), /does not match/);
  assert.throws(() => validateAppState("not-json", "123456789"), /valid JSON/);
  assert.throws(() => validateAppState(JSON.stringify([cookie("c_user", "123456789"), cookie("datr", "other")]), "123456789"), /does not match/);
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

test("listenUntilReady waits for a stable MQTT connection after ready", async () => {
  const api = { listenMqtt(callback) { setImmediate(() => callback({ type: "ready", error: null })); } };
  assert.deepEqual(await listenUntilReady(api, () => {}, 500, 5), { type: "ready", error: null });
});

test("listenUntilReady rejects if Facebook blocks the candidate after ready", async () => {
  const api = { listenMqtt(callback) {
    setImmediate(() => {
      callback({ type: "ready", error: null });
      setTimeout(() => callback({ error: "login_blocked", type: "account_inactive" }), 2);
    });
  } };
  await assert.rejects(listenUntilReady(api, () => {}, 500, 20), /connection rejected/);
});

test("listenUntilReady rejects on timeout", async () => {
  const api = { listenMqtt() {} };
  await assert.rejects(listenUntilReady(api, () => {}, 10), /readiness timed out/);
});

test("listenUntilReady handles FCA callback events", async () => { let forwarded; const api = { listenMqtt(callback) { callback(null, { type: "message", body: "hello" }); callback({ type: "ready", error: null }); } }; await listenUntilReady(api, (_error, event) => { forwarded = event; }, 100, 1); assert.equal(forwarded.body, "hello"); const bad = { listenMqtt(callback) { callback({ type: "stop_listen", error: "offline" }); } }; await assert.rejects(listenUntilReady(bad, () => {}, 100), /connection failed/); });
