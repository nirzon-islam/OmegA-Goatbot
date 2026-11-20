"use strict";

const MAX_JSON_BYTES = 2 * 1024 * 1024;
const MAX_DELTAS = 500;
const MAX_DEPTH = 24;

function parsePayload(input) {
  if (typeof input === "string" || Buffer.isBuffer(input) || input instanceof Uint8Array) {
    const bytes = Buffer.isBuffer(input) ? input : Buffer.from(input);
    if (bytes.byteLength > MAX_JSON_BYTES) return null;
    try { return JSON.parse(bytes.toString("utf8")); } catch { return null; }
  }
  return input && typeof input === "object" ? input : null;
}

function withinDepth(value, depth = 0) {
  if (depth > MAX_DEPTH) return false;
  if (!value || typeof value !== "object") return true;
  for (const child of Object.values(value)) if (!withinDepth(child, depth + 1)) return false;
  return true;
}

function firstString(...values) {
  return values.find(value => typeof value === "string" && value.length > 0) ?? null;
}

function normalizeDelta(delta) {
  if (!delta || typeof delta !== "object" || Array.isArray(delta)) return null;
  const kind = firstString(delta.class, delta.type, delta.deltaType);
  if (!kind) return null;
  const metadata = delta.messageMetadata && typeof delta.messageMetadata === "object"
    ? delta.messageMetadata : {};
  const threadID = firstString(metadata.threadKey?.threadFbId, metadata.threadKey?.otherUserFbId,
    metadata.thread_id, delta.threadID, delta.threadId);
  const messageID = firstString(metadata.messageId, metadata.message_id, delta.messageId, delta.message_id);
  const senderID = firstString(metadata.actorFbId, metadata.senderId, delta.senderId, delta.actorId);
  const timestamp = metadata.timestamp ?? metadata.timestampMs ?? delta.timestamp;
  const base = { threadID, messageID, senderID, timestamp: timestamp ?? null, rawDelta: delta };

  switch (kind) {
    case "NewMessage":
    case "Message": {
      const replyTo = firstString(metadata.replySourceMessageId, metadata.replyToMessageId, delta.replyToMessageId);
      return {
        ...base, type: replyTo ? "message_reply" : "message",
        body: typeof delta.body === "string" ? delta.body : "",
        attachments: Array.isArray(delta.attachments) ? delta.attachments.slice(0, 100) : [],
        isGroup: Boolean(metadata.threadKey?.threadFbId)
      };
    }
    case "MessageReaction":
    case "Reaction": {
      const reaction = firstString(delta.reaction, delta.reactionEmoji, delta.reactionString);
      return { ...base, type: "message_reaction", reaction, userID: senderID };
    }
    case "MessageUnsend":
    case "UnsendMessage":
      return { ...base, type: "message_unsend" };
    case "Typing":
    case "TypingNotification":
      return { ...base, type: "typ", isTyping: delta.isTyping !== false };
    case "ReadReceipt":
    case "MarkRead":
      return { ...base, type: "read", watermarkTimestamp: delta.watermarkTimestamp ?? timestamp };
    case "Presence":
    case "PresenceUpdate":
      return { ...base, type: "presence", status: delta.status ?? delta.presence ?? null };
    case "ThreadEvent":
    case "ThreadName":
    case "ParticipantAdded":
    case "ParticipantRemoved":
      return { ...base, type: "event", logMessageType: kind, logMessageData: delta };
    default:
      return { ...base, type: "unknown_delta", deltaType: kind };
  }
}

function extractDeltas(envelope) {
  if (!envelope || typeof envelope !== "object" || !withinDepth(envelope)) return [];
  const candidates = [
    envelope.deltas,
    envelope.payload?.deltas,
    envelope.data?.deltas,
    envelope.sync_payload?.deltas,
    envelope.syncPayload?.deltas
  ];
  const deltas = candidates.find(Array.isArray);
  return deltas ? deltas.slice(0, MAX_DELTAS) : [];
}

function parseMessengerSyncPayload(input) {
  const envelope = parsePayload(input);
  if (!envelope || typeof envelope !== "object" || !withinDepth(envelope)) {
    return { events: [], envelope: null, cursor: null };
  }
  const deltas = extractDeltas(envelope);
  const events = deltas.map(normalizeDelta).filter(Boolean);
  const cursor = {
    syncToken: firstString(envelope.sync_token, envelope.syncToken, envelope.payload?.sync_token),
    lastSeqId: envelope.last_seq_id ?? envelope.lastSeqId ?? envelope.seq ?? null
  };
  if (cursor.syncToken === null && cursor.lastSeqId === null) return { events, envelope, cursor: null };
  return { events, envelope, cursor };
}

module.exports = { parseMessengerSyncPayload, normalizeMessengerDelta: normalizeDelta, MAX_JSON_BYTES, MAX_DELTAS };
