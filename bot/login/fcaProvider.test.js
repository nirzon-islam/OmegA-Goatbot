"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { loadFcaProvider, buildFcaLoginOptions } = require("./fcaProvider");

test("always loads OmegA-FCA without an environment variable", () => {
  const login = () => {};
  const selected = loadFcaProvider({}, (name) => {
    assert.equal(name, "@nirzon-islam/omega-fca");
    return login;
  });
  assert.equal(selected.login, login);
  assert.equal(selected.packageName, "@nirzon-islam/omega-fca");
  assert.equal(selected.provider, "omega");
});

test("fails clearly when OmegA-FCA is not installed", () => {
  assert.throws(
    () => loadFcaProvider({}, () => { throw new Error("MODULE_NOT_FOUND"); }),
    /OmegA-FCA is required but is not installed/
  );
});

test("rejects non-callable OmegA-FCA exports", () => {
  assert.throws(() => loadFcaProvider({}, () => ({})), /callable CommonJS login function/);
});

test("keeps E2EE disabled when config.e2ee.enable is false", () => {
  const options = buildFcaLoginOptions({
    e2ee: { enable: false },
    optionsFca: { listenEvents: true, autoReconnect: true }
  }, "123456789", {});
  assert.deepEqual(options, { listenEvents: true, autoReconnect: true });
  assert.equal(options.e2ee, undefined);
});

test("automatically provisions and reuses account-scoped identity without E2EE environment variables", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "goat-e2ee-provider-"));
  const config = { e2ee: { enable: true }, optionsFca: { listenEvents: true } };
  try {
    const first = buildFcaLoginOptions(config, "123456789", { OMEGA_E2EE_STORAGE_PATH: root });
    const second = buildFcaLoginOptions(config, "123456789", { OMEGA_E2EE_STORAGE_PATH: root });
    const otherAccount = buildFcaLoginOptions(config, "987654321", { OMEGA_E2EE_STORAGE_PATH: root });

    assert.equal(first.listenEvents, true);
    assert.equal(first.e2ee.encryptionKey.length, 32);
    assert.ok(first.e2ee.localDeviceId > 0);
    assert.equal(second.e2ee.localDeviceId, first.e2ee.localDeviceId);
    assert.deepEqual(second.e2ee.encryptionKey, first.e2ee.encryptionKey);
    assert.notEqual(otherAccount.e2ee.localDeviceId, first.e2ee.localDeviceId);
    assert.notDeepEqual(otherAccount.e2ee.encryptionKey, first.e2ee.encryptionKey);

    const identityPath = path.join(root, "123456789", "identity.json");
    assert.equal(fs.statSync(identityPath).mode & 0o077, 0);
    assert.ok(fs.existsSync(path.join(root, "987654321", "identity.json")));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("keeps normal login options when the optional Signal engine is unavailable", () => {
  const options = buildFcaLoginOptions({
    e2ee: { enable: true },
    optionsFca: { listenEvents: true, autoReconnect: true }
  }, "123456789", {});
  assert.deepEqual(options, { listenEvents: true, autoReconnect: true });
  assert.match(options.e2eeUnavailableReason, /Signal engine is not available/);
  assert.equal(options.e2ee, undefined);
});

test("skips optional E2EE for invalid account IDs without blocking normal login", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "goat-e2ee-invalid-"));
  try {
    const options = buildFcaLoginOptions(
      { e2ee: { enable: true }, optionsFca: { listenEvents: true } },
      "../not-an-account",
      { OMEGA_E2EE_STORAGE_PATH: root }
    );
    assert.equal(options.listenEvents, true);
    assert.match(options.e2eeUnavailableReason, /verified Facebook account ID/);
    assert.deepEqual(fs.readdirSync(root), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
