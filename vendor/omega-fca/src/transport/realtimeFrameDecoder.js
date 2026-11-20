"use strict";

const DEFAULT_MAX_FRAME_BYTES = 1024 * 1024;

function findJsonObjectEnd(text, start) {
  if (text[start] !== "{") return -1;
  const stack = ["}"];
  let inString = false;
  let escaped = false;
  for (let i = start + 1; i < text.length; i++) {
    const char = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") stack.push("}");
    else if (char === "[") stack.push("]");
    else if (char === "}" || char === "]") {
      if (stack.pop() !== char) return -1;
      if (stack.length === 0) {
        // A stray closing container immediately after this object means the
        // candidate belongs to a malformed JSON fragment, not a frame.
        let next = i + 1;
        while (next < text.length && /\s/.test(text[next])) next++;
        if (text[next] === "}" || text[next] === "]") return -1;
        return i + 1;
      }
    }
  }
  return -1;
}

function decodeRealtimeFrame(frame, { maxFrameBytes = DEFAULT_MAX_FRAME_BYTES } = {}) {
  if (!Number.isInteger(maxFrameBytes) || maxFrameBytes < 1 || maxFrameBytes > 16 * 1024 * 1024) {
    throw new TypeError("maxFrameBytes must be an integer between 1 and 16777216");
  }
  if (!(Buffer.isBuffer(frame) || frame instanceof Uint8Array)) {
    throw new TypeError("Realtime frame must be a Buffer or Uint8Array");
  }
  const bytes = Buffer.from(frame);
  if (bytes.length === 0 || bytes.length > maxFrameBytes) {
    const error = new Error("Realtime frame is empty or exceeds the configured size limit");
    error.code = "FCA_REALTIME_FRAME_SIZE_INVALID";
    throw error;
  }

  // Captured Messenger frames contain a binary prefix followed by a JSON
  // envelope. We deliberately do not interpret the undocumented prefix.
  const text = bytes.toString("utf8");
  let start = text.indexOf("{");
  while (start !== -1) {
    const end = findJsonObjectEnd(text, start);
    if (end !== -1) {
      try {
        const envelope = JSON.parse(text.slice(start, end));
        if (envelope && typeof envelope === "object" && !Array.isArray(envelope) &&
            Array.isArray(envelope.events) &&
            envelope.events.every(event => event && typeof event === "object" &&
              !Array.isArray(event) && typeof event.name === "string")) {
          return Object.freeze({
            envelope,
            events: Object.freeze(envelope.events.map(event => Object.freeze({
              name: event.name,
              args: event.args === undefined ? null : event.args
            })))
          });
        }
      } catch {
        // Try the next object boundary; never expose frame bytes in errors.
      }
    }
    start = text.indexOf("{", start + 1);
  }

  const error = new Error("Realtime frame does not contain a supported events JSON envelope");
  error.code = "FCA_REALTIME_FRAME_ENVELOPE_UNSUPPORTED";
  error.retryable = false;
  throw error;
}

function summarizeRealtimeFrame(frame, options) {
  const decoded = decodeRealtimeFrame(frame, options);
  return Object.freeze({
    eventCount: decoded.events.length,
    eventNames: Object.freeze(decoded.events.map(event => event.name))
  });
}

module.exports = { DEFAULT_MAX_FRAME_BYTES, decodeRealtimeFrame, summarizeRealtimeFrame };
