"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { logE2EE } = require("./e2eeDiagnostics");

test("writes structured, redacted E2EE lifecycle diagnostics", () => {
  const lines = [];
  const logger = { info: (line) => lines.push(line), warn: (line) => lines.push(line) };
  assert.equal(logE2EE("identity.created", {
    accountId: "123456789", status: "ready", stage: "local-identity", durationMs: 12,
    reason: "safe-code", encryptionKey: "must-not-appear", cookie: "must-not-appear"
  }, logger), true);
  assert.equal(lines.length, 1);
  const record = JSON.parse(lines[0].replace(/^\[E2EE\] /, ""));
  assert.equal(record.component, "omega-e2ee");
  assert.equal(record.event, "identity.created");
  assert.equal(record.account, "…6789");
  assert.equal(record.durationMs, 12);
  assert.equal("encryptionKey" in record, false);
  assert.equal("cookie" in record, false);
  assert.equal(lines[0].includes("must-not-appear"), false);
});

test("rejects unknown events and never logs raw exception objects", () => {
  const lines = [];
  const logger = { info: (line) => lines.push(line), warn: (line) => lines.push(line) };
  assert.equal(logE2EE("unknown.event", { secret: "x" }, logger), false);
  assert.equal(lines.length, 0);
});
