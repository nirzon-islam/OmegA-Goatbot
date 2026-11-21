"use strict";

// GoatBot compatibility boundary for the currently published FCA build.
const {
  createFacebookMqttClient,
  createGoatBotLogin
} = require("@nirzon-islam/omega-fca");

const client = createFacebookMqttClient({
  reconnect: {
    maxAttempts: 3,
    minDelayMs: 1_000,
    maxDelayMs: 15_000,
    factor: 2,
    jitter: 0.2
  },
  mqtt: { keepAlive: 60 }
});

const login = createGoatBotLogin(client);
const wrappedApis = new WeakMap();

function normalizeLegacyAttachment(attachment) {
  if (!attachment || typeof attachment !== "object") return null;
  const mime = String(attachment.mime_type || attachment.mimeType || "").toLowerCase();
  const url = attachment.image?.url || attachment.video?.url || attachment.url ||
    attachment.preview_url || null;
  const type = mime.startsWith("image/") || attachment.image ? "photo" :
    mime.startsWith("video/") || attachment.video ? "video" : "file";
  return {
    ...attachment,
    type,
    url,
    ID: attachment.attachment_id || attachment.id || attachment.ID || null
  };
}

function normalizeGoatBotEvent(event) {
  if (!event || typeof event !== "object") return event;
  const source = event.rawDelta && typeof event.rawDelta === "object" ? event.rawDelta : event;
  const metadata = source.messageMetadata || {};
  const threadKey = metadata.threadKey || source.threadKey || {};

  if (event.type === "read") {
    const reader = metadata.actorFbId || source.reader || source.userID || event.reader || event.userID || null;
    const threadID = threadKey.threadFbId || threadKey.otherUserFbId || source.threadID || event.threadID || null;
    const watermarkTimestamp = metadata.watermarkTimestamp ?? source.watermarkTimestamp ?? event.watermarkTimestamp ?? null;
    return {
      ...event,
      type: "read_receipt",
      ...(reader != null ? { reader: String(reader), userID: String(reader) } : {}),
      ...(threadID != null ? { threadID: String(threadID) } : {}),
      ...(watermarkTimestamp != null ? { watermarkTimestamp } : {})
    };
  }

  if (event.type === "message_reply" && !event.messageReply) {
    const quoted = source.replyMessage || source.messageReply || {};
    const quotedAttachments = Array.isArray(quoted.attachments)
      ? quoted.attachments.map(normalizeLegacyAttachment).filter(Boolean)
      : [];
    const messageID = quoted.messageId || quoted.messageID ||
      metadata.replySourceMessageId || source.replySourceMessageId ||
      event.replyToMessageID || null;
    return {
      ...event,
      messageReply: {
        messageID: messageID == null ? null : String(messageID),
        senderID: quoted.actorFbId == null ? null : String(quoted.actorFbId),
        body: quoted.body == null ? "" : String(quoted.body),
        attachments: quotedAttachments,
        timestamp: quoted.timestamp_precise ?? quoted.timestamp ?? null,
        threadID: event.threadID == null ? null : String(event.threadID)
      }
    };
  }
  return event;
}

function wrapApi(api) {
  if (!api || typeof api !== "object") return api;
  if (wrappedApis.has(api)) return wrappedApis.get(api);
  const wrapped = new Proxy(api, {
    get(target, property, receiver) {
      if (property === "listenMqtt" && typeof target.listenMqtt === "function") {
        return callback => {
          if (typeof callback !== "function") throw new TypeError("MQTT listener callback is required");
          return target.listenMqtt((error, event) => callback(error, normalizeGoatBotEvent(event)));
        };
      }
      if (property === "sendMessage" && typeof target.sendMessage === "function") {
        return (message, threadID, callback, replyToMessageID) => {
          // GoatBot has legacy call sites that pass reply ID as argument three.
          if ((typeof callback === "string" || typeof callback === "number") && replyToMessageID == null) {
            return target.sendMessage(message, threadID, undefined, callback);
          }
          return target.sendMessage(message, threadID, callback, replyToMessageID);
        };
      }
      return Reflect.get(target, property, receiver);
    }
  });
  wrappedApis.set(api, wrapped);
  return wrapped;
}

function goatBotLogin(credentials, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = {};
  }
  if (typeof callback !== "function") throw new TypeError("GoatBot login callback is required");
  return login(credentials, options || {}, (error, api) => {
    callback(error, error ? api : wrapApi(api));
  }).then(api => wrapApi(api));
}

goatBotLogin.normalizeGoatBotEvent = normalizeGoatBotEvent;
goatBotLogin.wrapApi = wrapApi;
module.exports = goatBotLogin;
