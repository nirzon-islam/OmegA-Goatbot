"use strict";

const DEFAULT_MAX_SYNC_FRAME_BYTES = 1024 * 1024;

function findJsonObject(text) {
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') quoted = false;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return text.slice(start, i + 1);
  }
  return null;
}

/**
 * Inspects the observed outer realtime sync envelope. The undocumented binary
 * prefix is deliberately ignored; this is an evidence parser, not a wire codec.
 */
function inspectRealtimeSyncEnvelope(frame, { maxFrameBytes = DEFAULT_MAX_SYNC_FRAME_BYTES } = {}) {
  if (!Number.isInteger(maxFrameBytes) || maxFrameBytes < 1 || maxFrameBytes > 16 * 1024 * 1024) {
    throw new TypeError("maxFrameBytes must be an integer between 1 and 16777216");
  }
  if (!(Buffer.isBuffer(frame) || frame instanceof Uint8Array)) {
    throw new TypeError("Realtime sync frame must be a Buffer or Uint8Array");
  }
  const bytes = Buffer.from(frame);
  if (bytes.length === 0 || bytes.length > maxFrameBytes) {
    const error = new Error("Realtime sync frame is empty or exceeds the configured size limit");
    error.code = "FCA_REALTIME_SYNC_FRAME_SIZE_INVALID";
    throw error;
  }
  const json = findJsonObject(bytes.toString("utf8"));
  if (!json) {
    const error = new Error("Realtime frame does not contain a complete JSON envelope");
    error.code = "FCA_REALTIME_SYNC_ENVELOPE_MISSING";
    throw error;
  }
  let envelope;
  try { envelope = JSON.parse(json); }
  catch {
    const error = new Error("Realtime frame contains malformed JSON envelope");
    error.code = "FCA_REALTIME_SYNC_ENVELOPE_INVALID";
    throw error;
  }
  if (!envelope || Array.isArray(envelope) || typeof envelope !== "object" ||
      typeof envelope.app_id !== "string" || !envelope.app_id ||
      !Number.isInteger(envelope.request_id) || !Number.isInteger(envelope.type) ||
      typeof envelope.payload !== "string") {
    const error = new Error("Realtime frame has an unsupported sync envelope shape");
    error.code = "FCA_REALTIME_SYNC_ENVELOPE_UNSUPPORTED";
    throw error;
  }
  let payload;
  try { payload = JSON.parse(envelope.payload); }
  catch {
    const error = new Error("Realtime sync payload is not valid JSON");
    error.code = "FCA_REALTIME_SYNC_PAYLOAD_INVALID";
    throw error;
  }
  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    const error = new Error("Realtime sync payload must be a JSON object");
    error.code = "FCA_REALTIME_SYNC_PAYLOAD_UNSUPPORTED";
    throw error;
  }
  return Object.freeze({
    appId: envelope.app_id,
    requestId: envelope.request_id,
    type: envelope.type,
    payload: Object.freeze(payload)
  });
}

module.exports = { DEFAULT_MAX_SYNC_FRAME_BYTES, inspectRealtimeSyncEnvelope };
