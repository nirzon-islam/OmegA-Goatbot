"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { loadFcaProvider } = require("./fcaProvider");

test("loads the default OmegA-FCA provider when installed", () => {
  const login = () => {};
  const selected = loadFcaProvider({}, (name) => {
    assert.equal(name, "@nirzon-islam/omega-fca");
    return login;
  });

  assert.equal(selected.login, login);
  assert.equal(selected.packageName, "@nirzon-islam/omega-fca");
  assert.equal(selected.provider, "omega");
});

test("falls back to an installed compatible FCA when OmegA-FCA is unavailable", () => {
  const login = () => {};
  const tried = [];
  const selected = loadFcaProvider({}, (name) => {
    tried.push(name);
    if (name === "facebook-chat-api") return { login };
    const error = new Error("missing");
    error.code = "MODULE_NOT_FOUND";
    throw error;
  });
  assert.deepEqual(tried, ["@nirzon-islam/omega-fca", "@eryxenx/fca", "fca-unofficial", "facebook-chat-api"]);
  assert.equal(selected.login, login);
  assert.equal(selected.packageName, "facebook-chat-api");
  assert.equal(selected.provider, "compatible");
});

test("automatically uses an installed custom FCA package without a selector", () => {
  const login = () => {};
  const selected = loadFcaProvider({}, (name) => {
    assert.equal(name, "my-custom-fca");
    return { default: { login } };
  }, () => ["my-custom-fca"]);
  assert.equal(selected.login, login);
  assert.equal(selected.packageName, "my-custom-fca");
});

test("fails clearly when no compatible FCA package is installed", () => {
  assert.throws(
    () => loadFcaProvider({}, () => { throw new Error("MODULE_NOT_FOUND"); }),
    /No supported FCA package is installed/
  );
});

test("reports a clear error when no discovered FCA package is compatible", () => {
  assert.throws(
    () => loadFcaProvider({}, () => ({}), () => ["broken-fca"]),
    /No compatible FCA package was found automatically/
  );
});


test("builds ordinary login options with humanizer while E2EE remains opt-in", () => {
  const { buildFcaLoginOptions } = require("./fcaProvider");
  const options = buildFcaLoginOptions({ optionsFca: { listenEvents: true }, humanizer: { enable: false } }, "123456789", {});
  assert.equal(options.listenEvents, true);
  assert.equal(options.humanize, undefined);
  assert.equal(options.e2ee, undefined);
});

test("requires explicit account-bound Signal configuration when E2EE is enabled", () => {
  const { buildFcaLoginOptions } = require("./fcaProvider");
  assert.throws(
    () => buildFcaLoginOptions({ e2ee: { enable: true } }, "123456789", {}),
    /OMEGA_E2EE_ENCRYPTION_KEY/
  );
  assert.throws(
    () => buildFcaLoginOptions({ e2ee: { enable: true } }, "", {
      OMEGA_E2EE_ENCRYPTION_KEY: Buffer.alloc(32).toString("base64"),
      OMEGA_E2EE_DEVICE_ID: "1",
      OMEGA_E2EE_SIGNAL_MODULE: "signal-test"
    }, () => ({ PrivateKey: { generate() {} } })),
    /verified Facebook account ID/
  );
});

test("rejects malformed keys and incompatible Signal modules", () => {
  const { buildFcaLoginOptions } = require("./fcaProvider");
  const env = {
    OMEGA_E2EE_ENCRYPTION_KEY: Buffer.alloc(31).toString("base64"),
    OMEGA_E2EE_DEVICE_ID: "1",
    OMEGA_E2EE_SIGNAL_MODULE: "signal-test"
  };
  assert.throws(
    () => buildFcaLoginOptions({ e2ee: { enable: true } }, "123456789", env, () => ({ PrivateKey: { generate() {} } })),
    /exactly 32 bytes/
  );
  env.OMEGA_E2EE_ENCRYPTION_KEY = Buffer.alloc(32).toString("base64");
  assert.throws(
    () => buildFcaLoginOptions({ e2ee: { enable: true } }, "123456789", env, () => ({})),
    /not compatible/
  );
});

test("builds account-isolated E2EE runtime options from explicit environment", () => {
  const { buildFcaLoginOptions } = require("./fcaProvider");
  const env = {
    OMEGA_E2EE_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
    OMEGA_E2EE_DEVICE_ID: "42",
    OMEGA_E2EE_SIGNAL_MODULE: "signal-test",
    OMEGA_E2EE_STORAGE_PATH: "/tmp/omega-signal"
  };
  const signalModule = { PrivateKey: { generate() {} } };
  const options = buildFcaLoginOptions({ e2ee: { enable: true } }, "123456789", env, (name) => {
    assert.equal(name, "signal-test");
    return signalModule;
  });
  assert.equal(options.e2ee.enabled, true);
  assert.equal(options.e2ee.localDeviceId, 42);
  assert.equal(options.e2ee.storagePath, require("path").join("/tmp/omega-signal", "123456789"));
  assert.equal(options.e2ee.encryptionKey.length, 32);
  assert.equal(options.e2ee.signalModule, signalModule);
});
