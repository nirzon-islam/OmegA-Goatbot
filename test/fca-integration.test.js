"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createFacebookMqttClient,
  createGoatBotLogin,
  normalizeMessengerDelta
} = require("@nirzon-islam/omega-fca");
const goatBotLogin = require("../bot/login/omegaFca");

test("published FCA package exposes the GoatBot integration entry points", () => {
  assert.equal(typeof createFacebookMqttClient, "function");
  assert.equal(typeof createGoatBotLogin, "function");
  assert.equal(typeof normalizeMessengerDelta, "function");
});

test("GoatBot adapter maps legacy FCA read events to read_receipt", () => {
  const receipt = normalizeMessengerDelta({
    class: "ReadReceipt",
    messageMetadata: {
      actorFbId: "reader-1",
      threadKey: { threadFbId: "thread-1" },
      watermarkTimestamp: 1700000000000
    }
  });
  const compatible = goatBotLogin.normalizeGoatBotEvent(receipt);
  assert.equal(compatible.type, "read_receipt");
  assert.equal(compatible.threadID, "thread-1");
});

test.todo("FCA rc.2 does not expose the read-receipt actor alias required by GoatBot; enable after the corrected package release");

test.todo("FCA rc.2 does not expose quoted reply content as messageReply; enable after the corrected package release");

test("GoatBot adapter shifts third-argument reply IDs into FCA's fourth argument", async () => {
  let received;
  const wrapped = goatBotLogin.wrapApi({
    sendMessage: (...args) => { received = args; return Promise.resolve("sent"); }
  });
  await wrapped.sendMessage("reply body", "thread-1", "quoted-1");
  assert.deepEqual(received, ["reply body", "thread-1", undefined, "quoted-1"]);
});

test("GoatBot adapter normalizes read events delivered by listenMqtt", () => {
  let listener;
  const wrapped = goatBotLogin.wrapApi({
    listenMqtt: callback => { listener = callback; return () => {}; }
  });
  let received;
  wrapped.listenMqtt((error, event) => { received = { error, event }; });
  listener(null, {
    type: "read",
    rawDelta: {
      messageMetadata: {
        actorFbId: "reader-2",
        threadKey: { threadFbId: "thread-2" }
      }
    }
  });
  assert.equal(received.error, null);
  assert.equal(received.event.type, "read_receipt");
  assert.equal(received.event.reader, "reader-2");
  assert.equal(received.event.threadID, "thread-2");
});
