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

test("GoatBot adapter maps FCA read events to read_receipt with legacy aliases", () => {
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
  assert.equal(compatible.reader, "reader-1");
  assert.equal(compatible.userID, "reader-1");
  assert.equal(compatible.threadID, "thread-1");
  assert.equal(compatible.watermarkTimestamp, 1700000000000);
});

test("GoatBot adapter builds nested messageReply with legacy attachment fields", () => {
  const reply = normalizeMessengerDelta({
    class: "NewMessage",
    messageMetadata: {
      messageId: "reply-1",
      actorFbId: "sender-1",
      threadKey: { threadFbId: "thread-1" },
      replySourceMessageId: "quoted-1"
    },
    body: "reply body",
    replyMessage: {
      messageId: "quoted-1",
      actorFbId: "quoted-sender",
      body: "quoted body",
      attachments: [{
        attachment_id: "photo-1",
        mime_type: "image/jpeg",
        image: { url: "https://cdn.example/quoted.jpg" }
      }]
    }
  });
  const compatible = goatBotLogin.normalizeGoatBotEvent(reply);
  assert.equal(compatible.type, "message_reply");
  assert.equal(compatible.messageReply.messageID, "quoted-1");
  assert.equal(compatible.messageReply.senderID, "quoted-sender");
  assert.equal(compatible.messageReply.body, "quoted body");
  assert.equal(compatible.messageReply.attachments[0].type, "photo");
  assert.equal(compatible.messageReply.attachments[0].url, "https://cdn.example/quoted.jpg");
  assert.equal(compatible.messageReply.attachments[0].ID, "photo-1");
});

test("GoatBot adapter shifts a third-argument reply ID into FCA's fourth argument", async () => {
  let received;
  const api = {
    sendMessage: (...args) => { received = args; return Promise.resolve("sent"); }
  };
  const wrapped = goatBotLogin.wrapApi(api);
  await wrapped.sendMessage("reply body", "thread-1", "quoted-1");
  assert.deepEqual(received, ["reply body", "thread-1", undefined, "quoted-1"]);
});

test("GoatBot adapter normalizes events received from listenMqtt", () => {
  let listener;
  const api = {
    listenMqtt: callback => { listener = callback; return () => {}; }
  };
  const wrapped = goatBotLogin.wrapApi(api);
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
