"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { loadFcaProvider } = require("./fcaProvider");

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
