"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
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
  assert.throws(
    () => loadFcaProvider({}, () => ({})),
    /callable CommonJS login function/
  );
});

test("keeps E2EE disabled when config.e2ee.enable is false", () => {
  const options = buildFcaLoginOptions({
    e2ee: { enable: false },
    optionsFca: { listenEvents: true, autoReconnect: true }
  }, "123456789", {});
  assert.deepEqual(options, { listenEvents: true, autoReconnect: true });
  assert.equal(options.e2ee, undefined);
});

test("enables the optional Signal runtime config when config.e2ee.enable is true", () => {
  const key = Buffer.alloc(32, 7).toString("base64");
  const fakeSignal = { PrivateKey: { generate() {} } };
  const options = buildFcaLoginOptions({
    e2ee: { enable: true },
    optionsFca: { listenEvents: true }
  }, "123456789", {
    OMEGA_E2EE_ENCRYPTION_KEY: key,
    OMEGA_E2EE_DEVICE_ID: "1",
    OMEGA_E2EE_SIGNAL_MODULE: "test-signal"
  }, (name) => {
    assert.equal(name, "test-signal");
    return fakeSignal;
  });
  assert.equal(options.listenEvents, true);
  assert.equal(options.e2ee.enabled, true);
  assert.equal(options.e2ee.localDeviceId, 1);
  assert.equal(options.e2ee.encryptionKey.length, 32);
  assert.match(options.e2ee.storagePath, /123456789$/);
});

test("fails clearly when E2EE is enabled without its required configuration", () => {
  assert.throws(
    () => buildFcaLoginOptions({ e2ee: { enable: true } }, "123456789", {}),
    /OMEGA_E2EE_ENCRYPTION_KEY/
  );
});

test("rejects an invalid Signal encryption key", () => {
  assert.throws(
    () => buildFcaLoginOptions({ e2ee: { enable: true } }, "123456789", {
      OMEGA_E2EE_ENCRYPTION_KEY: Buffer.alloc(16).toString("base64"),
      OMEGA_E2EE_DEVICE_ID: "1",
      OMEGA_E2EE_SIGNAL_MODULE: "test-signal"
    }, () => ({ PrivateKey: { generate() {} } })),
    /exactly 32 bytes/
  );
});
