"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createClient,
  createFacebookMqttClient,
  createGoatBotLogin,
  normalizeMessengerDelta
} = require("@nirzon-islam/omega-fca");
const goatBotLogin = require("../bot/login/omegaFca");

test("published FCA package exposes the GoatBot integration entry points", () => {
  assert.equal(typeof createClient, "function");
  assert.equal(typeof createFacebookMqttClient, "function");
  assert.equal(typeof createGoatBotLogin, "function");
  assert.equal(typeof normalizeMessengerDelta, "function");
});

test("GoatBot adapter normalizes FCA read events to the dispatcher's read_receipt name", () => {
  const receipt = normalizeMessengerDelta({
    class: "ReadReceipt",
    messageMetadata: {
      actorFbId: "reader-1",
      threadKey: { threadFbId: "thread-1" },
      watermarkTimestamp: 1700000000000
    }
  });
  assert.equal(receipt.type, "read");
  const compatible = goatBotLogin.normalizeGoatBotEvent(receipt);
  assert.equal(compatible.type, "read_receipt");
  assert.equal(compatible.reader || compatible.userID, "reader-1");
  assert.equal(compatible.threadID, "thread-1");
});

test("FCA quoted reply events expose the legacy nested messageReply object", () => {
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
  assert.equal(reply.type, "message_reply");
  assert.equal(reply.messageReply.messageID, "quoted-1");
  assert.equal(reply.messageReply.senderID, "quoted-sender");
  assert.equal(reply.messageReply.attachments[0].type, "photo");
  assert.equal(reply.messageReply.attachments[0].url, "https://cdn.example/quoted.jpg");
});

test("legacy sendMessage third-argument reply ID is preserved by the FCA facade", async () => {
  let received;
  const client = createClient({
    authenticate: async () => ({
      getCurrentUserID: async () => "123456",
      sendMessage: async input => {
        received = input;
        return { messageID: "sent-1" };
      },
      listen: () => () => {},
      disconnect: async () => {}
    }),
    reconnect: { maxAttempts: 1, minDelayMs: 0, maxDelayMs: 0 }
  });

  try {
    const api = await client.login({
      mode: "appstate",
      appState: [
        { key: "c_user", value: "123456" },
        { key: "xs", value: "synthetic-session" }
      ]
    });
    await api.sendMessage("reply body", "thread-1", "quoted-1");
    assert.deepEqual(received, {
      threadID: "thread-1",
      message: "reply body",
      replyToMessageID: "quoted-1"
    });
  } finally {
    await client.logout();
  }
});
