"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const command = require("../scripts/cmds/Facebook");

function harness(args) {
  const sent = [];
  const api = { sendMessage: async (...values) => { sent.push(values); } };
  const event = { threadID: "thread-1", messageID: "message-1" };
  return {
    sent,
    run: () => command.onStart({ api, event, args })
  };
}

test("Facebook command metadata is registered", () => {
  assert.equal(command.config.name, "facebook");
  assert.ok(command.config.aliases.includes("fb"));
});

test("help is available without an FCA runtime", async () => {
  delete global.OmegaFCA;
  const h = harness(["help"]);
  await h.run();
  assert.match(h.sent[0][0], /\.facebook status/);
  assert.match(h.sent[0][0], /\.facebook login/);
});

test("login fails safely when secure provider is missing", async () => {
  delete global.OmegaFCA;
  const h = harness(["login"]);
  await h.run();
  assert.match(h.sent[0][0], /Secure OmegA-FCA login provider is not configured/);
});

test("status reports missing runtime without throwing", async () => {
  delete global.OmegaFCA;
  const h = harness(["status"]);
  await h.run();
  assert.match(h.sent[0][0], /runtime is not initialized/);
});

test("send command calls FCA facade with message and thread ID", async () => {
  const calls = [];
  global.OmegaFCA = {
    api: { sendMessage: async (...args) => { calls.push(args); } }
  };
  const h = harness(["send", "thread-9", "|", "hello"]);
  await h.run();
  assert.deepEqual(calls, [["hello", "thread-9"]]);
  assert.match(h.sent[0][0], /Message sent/);
  delete global.OmegaFCA;
});

test("unsupported operations return a safe error", async () => {
  global.OmegaFCA = { api: {} };
  const h = harness(["friends"]);
  await h.run();
  assert.match(h.sent[0][0], /not available in the installed OmegA-FCA transport/);
  delete global.OmegaFCA;
});
