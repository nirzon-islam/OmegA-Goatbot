"use strict";

const DEFAULT_MAX_BINARY_PAYLOAD_BYTES = 1024 * 1024;

function findJsonObject(text) {
  for (let start = text.indexOf("{"); start !== -1; start = text.indexOf("{", start + 1)) {
    let depth = 0, quoted = false, escaped = false;
    for (let i = start; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (escaped) escaped = false;
        else if (c === "\\") escaped = true;
        else if (c === '"') quoted = false;
      } else if (c === '"') quoted = true;
      else if (c === "{") depth++;
      else if (c === "}" && --depth === 0) {
        try {
          const value = JSON.parse(text.slice(start, i + 1));
          if (value && typeof value === "object" && !Array.isArray(value)) return value;
        } catch {}
        break;
      }
    }
  }
  return null;
}

function readVarint(bytes, state) {
  let value = 0n;
  for (let shift = 0n; shift <= 63n; shift += 7n) {
    if (state.offset >= bytes.length) throw new Error("truncated varint");
    const byte = bytes[state.offset++];
    // A protobuf varint is at most 64 bits; the tenth byte may only
    // contribute bit 63. Reject over-wide encodings instead of accepting
    // arbitrary BigInt values as structurally valid protobuf fields.
    if (shift === 63n && byte > 1) throw new Error("varint overflow");
    value |= BigInt(byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) return value;
  }
  throw new Error("varint overflow");
}

// Structural inspection only: field values are deliberately never returned.
function inspectWireFields(bytes, maxFields = 512) {
  const state = { offset: 0 };
  const fields = [];
  while (state.offset < bytes.length) {
    if (fields.length >= maxFields) throw new Error("field limit exceeded");
    const tag = Number(readVarint(bytes, state));
    const number = Math.floor(tag / 8), wireType = tag & 7;
    if (number < 1 || number > 0x1fffffff ||
        wireType === 3 || wireType === 4 || wireType > 5) {
      throw new Error("invalid wire tag");
    }
    let byteLength = null;
    if (wireType === 0) readVarint(bytes, state);
    else if (wireType === 1 || wireType === 5) {
      byteLength = wireType === 1 ? 8 : 4;
      state.offset += byteLength;
      if (state.offset > bytes.length) throw new Error("truncated fixed field");
    } else if (wireType === 2) {
      const length = Number(readVarint(bytes, state));
      if (!Number.isSafeInteger(length) || length < 0 || state.offset + length > bytes.length) throw new Error("invalid length field");
      byteLength = length;
      state.offset += length;
    }
    fields.push(Object.freeze({ number, wireType, byteLength }));
  }
  return Object.freeze(fields);
}

function inspectRealtimeBinaryPayload(frame, options = {}) {
  const maxFrameBytes = options.maxFrameBytes ?? DEFAULT_MAX_BINARY_PAYLOAD_BYTES;
  const maxPayloadBytes = options.maxPayloadBytes ?? DEFAULT_MAX_BINARY_PAYLOAD_BYTES;
  for (const [name, value] of Object.entries({ maxFrameBytes, maxPayloadBytes })) {
    if (!Number.isInteger(value) || value < 1 || value > 16 * 1024 * 1024) {
      throw new TypeError(name + " must be an integer between 1 and 16777216");
    }
  }
  if (!(Buffer.isBuffer(frame) || frame instanceof Uint8Array)) throw new TypeError("Realtime frame must be a Buffer or Uint8Array");
  const bytes = Buffer.from(frame);
  if (!bytes.length || bytes.length > maxFrameBytes) {
    const error = new Error("Realtime frame is empty or exceeds the configured size limit");
    error.code = "FCA_REALTIME_FRAME_SIZE_INVALID";
    throw error;
  }
  const envelope = findJsonObject(bytes.toString("utf8"));
  if (!envelope || !Object.prototype.hasOwnProperty.call(envelope, "payload")) {
    const error = new Error("Realtime frame does not contain a supported payload envelope");
    error.code = "FCA_REALTIME_PAYLOAD_ENVELOPE_UNSUPPORTED";
    throw error;
  }
  if (typeof envelope.payload !== "string") {
    return Object.freeze({
      envelopeKind: Array.isArray(envelope.events) ? "events" : "payload",
      requestIdPresent: envelope.request_id !== undefined && envelope.request_id !== null,
      payloadEncoding: "non-string",
      payloadBytes: null,
      wireFields: Object.freeze([])
    });
  }
  const encoded = envelope.payload;
  if (!encoded || encoded.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
    return Object.freeze({ envelopeKind: "payload", requestIdPresent: envelope.request_id != null, payloadEncoding: "non-base64-string", payloadBytes: null, wireFields: Object.freeze([]) });
  }
  const payload = Buffer.from(encoded, "base64");
  if (payload.length > maxPayloadBytes) {
    const error = new Error("Realtime binary payload exceeds the configured size limit");
    error.code = "FCA_REALTIME_PAYLOAD_SIZE_INVALID";
    throw error;
  }
  let wireFields = [];
  let payloadEncoding = "base64-binary-unclassified";
  try {
    wireFields = inspectWireFields(payload);
    payloadEncoding = "protobuf-wire-compatible";
  } catch {
    // Keep unknown binary payloads opaque; do not guess their format.
  }
  const nestedJson = findJsonObject(payload.toString("utf8"));
  if (nestedJson) payloadEncoding = "base64-json";
  return Object.freeze({
    envelopeKind: "payload",
    requestIdPresent: envelope.request_id !== undefined && envelope.request_id !== null,
    payloadEncoding,
    payloadBytes: payload.length,
    wireFields: Object.freeze(wireFields)
  });
}

module.exports = { DEFAULT_MAX_BINARY_PAYLOAD_BYTES, inspectRealtimeBinaryPayload };
