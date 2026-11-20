"use strict";

const { EventEmitter } = require("node:events");
const { createHmac, timingSafeEqual } = require("node:crypto");
const { createRequestClient } = require("../network/requestClient");

const GRAPH_HOST = "graph.facebook.com";

function verifyWebhookSignature(rawBody, signature, appSecret) {
  if (!(rawBody instanceof Uint8Array) || typeof signature !== "string" ||
      !/^sha256=[a-f0-9]{64}$/i.test(signature) ||
      typeof appSecret !== "string" || !appSecret) return false;
  const expected = Buffer.from("sha256=" + createHmac("sha256", appSecret).update(Buffer.from(rawBody)).digest("hex"));
  const supplied = Buffer.from(signature.toLowerCase());
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

function verifyWebhookChallenge(query, verifyToken) {
  if (!query || typeof query !== "object" || query["hub.mode"] !== "subscribe" ||
      typeof query["hub.verify_token"] !== "string" ||
      typeof query["hub.challenge"] !== "string" ||
      typeof verifyToken !== "string" || !verifyToken) return null;
  const supplied = Buffer.from(query["hub.verify_token"]);
  const expected = Buffer.from(verifyToken);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  return query["hub.challenge"];
}

function normalizeWebhookPayload(payload) {
  if (!payload || payload.object !== "page" || !Array.isArray(payload.entry)) {
    throw new TypeError("Expected a Messenger Page webhook payload");
  }
  const events = [];
  for (const entry of payload.entry) {
    if (!entry || !Array.isArray(entry.messaging)) continue;
    for (const item of entry.messaging) {
      if (!item || typeof item !== "object") continue;
      const base = {
        object: "page",
        pageID: String(entry.id || ""),
        senderID: item.sender?.id == null ? null : String(item.sender.id),
        recipientID: item.recipient?.id == null ? null : String(item.recipient.id),
        timestamp: Number.isFinite(item.timestamp) ? item.timestamp : null
      };
      if (item.message) {
        events.push({
          ...base, type: "message",
          messageID: item.message.mid == null ? null : String(item.message.mid),
          text: typeof item.message.text === "string" ? item.message.text : null,
          attachments: Array.isArray(item.message.attachments) ? item.message.attachments : [],
          isEcho: Boolean(item.message.is_echo),
          replyTo: item.message.reply_to || null
        });
      } else if (item.postback) {
        events.push({ ...base, type: "postback", title: item.postback.title || null, payload: item.postback.payload || null });
      } else if (item.delivery) {
        events.push({ ...base, type: "delivery", mids: Array.isArray(item.delivery.mids) ? item.delivery.mids : [], watermark: item.delivery.watermark || null });
      } else if (item.read) {
        events.push({ ...base, type: "read", watermark: item.read.watermark || null });
      } else if (item.account_linking) {
        events.push({ ...base, type: "account_linking", status: item.account_linking.status || null, authorizationCode: item.account_linking.authorization_code || null });
      } else if (item.referral) {
        events.push({ ...base, type: "referral", referral: item.referral });
      }
    }
  }
  return events;
}

function createMetaMessengerTransport({
  pageAccessToken,
  pageId,
  apiVersion,
  appSecret,
  fetchImpl = globalThis.fetch,
  timeoutMs = 20_000
} = {}) {
  if (typeof pageAccessToken !== "string" || !pageAccessToken.trim()) {
    throw new TypeError("A Page access token is required");
  }
  pageAccessToken = pageAccessToken.trim();
  if (typeof pageId !== "string" || !/^\d{5,30}$/.test(pageId)) {
    throw new TypeError("A numeric Page ID is required");
  }
  if (typeof apiVersion !== "string" || !/^v\d+\.\d+$/.test(apiVersion)) {
    throw new TypeError("Set a supported Graph API version, for example vXX.X");
  }
  if (appSecret !== undefined && (typeof appSecret !== "string" || !appSecret)) {
    throw new TypeError("appSecret must be non-empty text when provided");
  }

  const request = createRequestClient({ fetchImpl, timeoutMs, maxAttempts: 2 });
  const events = new EventEmitter();
  let closed = false;

  async function postSendApi(payload) {
    if (closed) throw new Error("Messenger transport is disconnected");
    const url = new URL("https://" + GRAPH_HOST + "/" + apiVersion + "/me/messages");
    const response = await request(url, {
      method: "POST",
      retryable: false,
      headers: {
        authorization: "Bearer " + pageAccessToken,
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || body?.error) {
      const error = new Error(body?.error?.message || "Meta Messenger Send API request failed");
      error.code = body?.error?.code ? "META_GRAPH_" + body.error.code : "META_GRAPH_REQUEST_FAILED";
      error.status = response.status;
      error.fbtraceId = body?.error?.fbtrace_id || null;
      throw error;
    }
    return body;
  }

  function validateRecipientId(recipientId) {
    if (typeof recipientId !== "string" || !/^\d{5,30}$/.test(recipientId)) {
      throw new TypeError("A valid page-scoped recipient ID is required");
    }
  }

  async function sendMessage(recipientId, message) {
    validateRecipientId(recipientId);
    if (!message || typeof message !== "object" || Array.isArray(message)) {
      throw new TypeError("Message must be a Messenger message object");
    }
    return postSendApi({ recipient: { id: recipientId }, message });
  }

  function validateGraphId(value, label) {
    if (typeof value !== "string" || !/^[A-Za-z0-9_.:-]{1,128}$/.test(value)) {
      throw new TypeError("A valid " + label + " is required");
    }
    return encodeURIComponent(value);
  }

  function validatePageLimit(limit) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new TypeError("Page size must be an integer between 1 and 100");
    }
  }

  async function graphGet(path, params = {}) {
    if (closed) throw new Error("Messenger transport is disconnected");
    const url = new URL("https://" + GRAPH_HOST + "/" + apiVersion + "/" + path);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }
    const response = await request(url, {
      method: "GET",
      headers: { authorization: "Bearer " + pageAccessToken }
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || body?.error) {
      const error = new Error(body?.error?.message || "Meta Graph API request failed");
      error.code = body?.error?.code ? "META_GRAPH_" + body.error.code : "META_GRAPH_REQUEST_FAILED";
      error.status = response.status;
      error.fbtraceId = body?.error?.fbtrace_id || null;
      throw error;
    }
    return body;
  }

  function paginationParams(limit, after) {
    validatePageLimit(limit);
    if (after !== undefined && after !== null &&
        (typeof after !== "string" || !after || after.length > 2048)) {
      throw new TypeError("Pagination cursor must be non-empty text up to 2048 characters");
    }
    return { limit, ...(after ? { after } : {}) };
  }

  function getUserInfo(userId, fields = ["first_name", "last_name", "profile_pic"]) {
    validateRecipientId(userId);
    const allowedFields = new Set(["first_name", "last_name", "profile_pic", "locale", "timezone", "gender"]);
    if (!Array.isArray(fields) || fields.length < 1 || fields.length > allowedFields.size ||
        fields.some(field => !allowedFields.has(field)) || new Set(fields).size !== fields.length) {
      throw new TypeError("Profile fields must be a non-empty list of supported Messenger profile fields");
    }
    return graphGet(encodeURIComponent(userId), { fields: fields.join(",") });
  }

  function getThreadList(limit = 25, after) {
    return graphGet(pageId + "/conversations", {
      fields: "id,updated_time,participants,unread_count",
      ...paginationParams(limit, after)
    });
  }

  function getThreadInfo(threadId) {
    const id = validateGraphId(threadId, "conversation ID");
    return graphGet(id, { fields: "id,participants,updated_time,is_owner" });
  }

  function getThreadHistory(threadId, limit = 25, after) {
    const id = validateGraphId(threadId, "conversation ID");
    return graphGet(id + "/messages", {
      fields: "id,created_time,from,to,message,attachments",
      ...paginationParams(limit, after)
    });
  }

  function getMessage(messageId) {
    const id = validateGraphId(messageId, "message ID");
    return graphGet(id, { fields: "id,created_time,from,to,message,attachments" });
  }

  async function sendSenderAction(recipientId, action) {
    validateRecipientId(recipientId);
    if (!["typing_on", "typing_off", "mark_seen"].includes(action)) {
      throw new TypeError("Unsupported Messenger sender action");
    }
    return postSendApi({ recipient: { id: recipientId }, sender_action: action });
  }

  async function sendTypingIndicator(recipientId, typing = true) {
    if (typeof typing !== "boolean") throw new TypeError("typing must be a boolean");
    return sendSenderAction(recipientId, typing ? "typing_on" : "typing_off");
  }

  function markAsRead(recipientId) {
    return sendSenderAction(recipientId, "mark_seen");
  }

  function listen(callback) {
    if (closed) throw new Error("Messenger transport is disconnected");
    if (typeof callback !== "function") throw new TypeError("listener callback is required");
    const listener = event => {
      try { callback(null, event); }
      catch (error) {
        try { events.emit("listenerCallbackError", error); } catch {}
      }
    };
    events.on("event", listener);
    return () => events.off("event", listener);
  }

  function publishWebhook(rawBody, signature) {
    if (closed) throw new Error("Messenger transport is disconnected");
    if (!appSecret) {
      throw new Error("appSecret is required to verify Messenger webhook signatures");
    }
    if (!(rawBody instanceof Uint8Array) || rawBody.byteLength > 1024 * 1024 ||
        !verifyWebhookSignature(rawBody, signature, appSecret)) {
      const error = new Error("Messenger webhook signature verification failed");
      error.code = "META_WEBHOOK_SIGNATURE_INVALID";
      throw error;
    }
    let payload;
    try { payload = JSON.parse(Buffer.from(rawBody).toString("utf8")); }
    catch {
      const error = new Error("Messenger webhook body is not valid JSON");
      error.code = "META_WEBHOOK_PAYLOAD_INVALID";
      throw error;
    }
    const normalized = normalizeWebhookPayload(payload).filter(event => event.pageID === pageId);
    for (const event of normalized) events.emit("event", event);
    return normalized.length;
  }

  async function disconnect() {
    if (closed) return;
    closed = true;
    events.removeAllListeners();
  }

  return Object.freeze({
    getCurrentUserID: () => pageId,
    sendMessage,
    getUserInfo,
    getThreadList,
    getThreadInfo,
    getThreadHistory,
    getMessage,
    sendTypingIndicator,
    markAsRead,
    listen,
    publishWebhook,
    disconnect,
    getCapabilities: () => Object.freeze({
      authentication: "page-access-token",
      inbound: "verified-webhook",
      outbound: "messenger-send-api",
      supportedActions: Object.freeze(["sendMessage", "getUserInfo", "getThreadList", "getThreadInfo", "getThreadHistory", "getMessage", "sendTypingIndicator", "markAsRead"]),
      userSessionEmulation: false,
      mqtt: false
    })
  });
}

module.exports = { createMetaMessengerTransport, normalizeWebhookPayload, verifyWebhookSignature, verifyWebhookChallenge };
