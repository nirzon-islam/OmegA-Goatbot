"use strict";

const { randomInt } = require("node:crypto");

const MESSENGER_MQTT_APP_ID = "2220391788200892";
const SEND_MESSAGE_VERSION_ID = "6120284488008082";

function offlineThreadingId(now = Date.now(), random = randomInt(1000, 10000)) {
  if (!Number.isSafeInteger(now) || now < 1 || !Number.isInteger(random) || random < 1000 || random > 9999) {
    throw new TypeError("Invalid offline threading ID inputs");
  }
  return (BigInt(now) * 1000n + BigInt(random)).toString();
}

/**
 * Builds the observed Messenger Lightspeed send-message task envelope.
 * This is a wire-shape helper only; broker acceptance must be verified live.
 */
function createMessengerSendMessageRequest(input = {}) {
  const threadID = String(input.threadID ?? "");
  if (!/^\d{5,30}$/.test(threadID)) throw new TypeError("threadID must be a numeric Facebook ID");
  const message = input.message;
  if (typeof message !== "string" && (!message || typeof message !== "object" || Array.isArray(message))) {
    throw new TypeError("message must be a string or message object");
  }
  const body = typeof message === "string" ? message : String(message.body ?? "");
  if (Buffer.byteLength(body, "utf8") > 20000) throw new RangeError("message body exceeds 20000 bytes");
  if (message && typeof message === "object" && (message.attachment || message.url)) {
    throw new TypeError("MQTT send helper currently supports text, sticker and reply only; use a verified upload flow for attachments");
  }
  const timestamp = input.timestamp ?? Date.now();
  if (!Number.isSafeInteger(timestamp) || timestamp < 1) throw new TypeError("timestamp is invalid");
  const otid = input.otid ?? offlineThreadingId(timestamp);
  const epochId = input.epochId ?? offlineThreadingId(timestamp + 1);
  if (!/^\d{10,24}$/.test(String(otid)) || !/^\d{10,24}$/.test(String(epochId))) {
    throw new TypeError("otid and epochId must be numeric offline IDs");
  }
  const taskPayload = {
    thread_id: threadID, otid: String(otid), source: 0, send_type: message?.sticker ? 2 : 1,
    sync_group: 1, text: message?.sticker ? null : body, initiating_source: 1, skip_url_preview_gen: 0
  };
  if (message?.sticker) taskPayload.sticker_id = String(message.sticker);
  if (input.replyToMessageID != null) {
    const replyTo = String(input.replyToMessageID);
    if (!replyTo || replyTo.length > 256) throw new TypeError("replyToMessageID is invalid");
    taskPayload.reply_metadata = { reply_source_id: replyTo, reply_source_type: 1, reply_type: 0 };
  }
  const tasks = [{
    label: "46", payload: JSON.stringify(taskPayload), queue_name: threadID,
    task_id: 0, failure_count: null
  }, {
    label: "21",
    payload: JSON.stringify({ thread_id: threadID, last_read_watermark_ts: timestamp, sync_group: 1 }),
    queue_name: threadID, task_id: 1, failure_count: null
  }];
  return Object.freeze({
    app_id: MESSENGER_MQTT_APP_ID,
    payload: JSON.stringify({ tasks, epoch_id: String(epochId), version_id: SEND_MESSAGE_VERSION_ID, data_trace_id: null }),
    request_id: input.requestId ?? null,
    type: 3
  });
}

module.exports = { MESSENGER_MQTT_APP_ID, SEND_MESSAGE_VERSION_ID, offlineThreadingId, createMessengerSendMessageRequest };
