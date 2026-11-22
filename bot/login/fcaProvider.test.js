"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { loadFcaProvider } = require("./fcaProvider");

test("defaults to the existing EryXenX FCA provider", () => {
  const login = () => {};
  const selected = loadFcaProvider({}, {}, (name) => {
    assert.equal(name, "@eryxenx/fca");
    return login;
  });
  assert.equal(selected.login, login);
  assert.equal(selected.provider, "eryxenx");
});

test("requires E2EE to be explicitly disabled before selecting OmegA-FCA", () => {
  let loaded = false;
  assert.throws(
    () => loadFcaProvider({ e2ee: { enable: true }, humanizer: { enable: false } }, { OMEGA_FCA_PROVIDER: "omega" }, () => {
      loaded = true;
      return () => {};
    }),
    /disable config\.e2ee\.enable/
  );
  assert.equal(loaded, false);
});

test("requires GoatBot humanizer to be explicitly disabled before selecting OmegA-FCA", () => {
  assert.throws(
    () => loadFcaProvider({ e2ee: { enable: false } }, { OMEGA_FCA_PROVIDER: "omega" }, () => () => {}),
    /disable config\.humanizer\.enable/
  );
});

test("selects OmegA-FCA only when unsupported integrations are disabled", () => {
  const login = () => {};
  const selected = loadFcaProvider(
    { e2ee: { enable: false }, humanizer: { enable: false } },
    { OMEGA_FCA_PROVIDER: "omega" },
    (name) => {
      assert.equal(name, "@nirzon-islam/omega-fca");
      return login;
    }
  );
  assert.equal(selected.login, login);
  assert.equal(selected.provider, "omega");
});

test("fails clearly if the optional OmegA-FCA package is not installed", () => {
  assert.throws(
    () => loadFcaProvider(
      { e2ee: { enable: false }, humanizer: { enable: false } },
      { OMEGA_FCA_PROVIDER: "omega" },
      () => { throw new Error("MODULE_NOT_FOUND"); }
    ),
    /not installed/
  );
});

test("rejects non-callable package exports and unknown providers", () => {
  assert.throws(
    () => loadFcaProvider({}, { OMEGA_FCA_PROVIDER: "eryxenx" }, () => ({})),
    /callable CommonJS login function/
  );
  assert.throws(
    () => loadFcaProvider({}, { OMEGA_FCA_PROVIDER: "other" }, () => () => {}),
    /Unknown OMEGA_FCA_PROVIDER/
  );
});
