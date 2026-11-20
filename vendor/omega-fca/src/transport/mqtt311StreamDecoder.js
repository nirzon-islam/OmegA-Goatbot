"use strict";

const { decodeRemainingLength, decodePacket } = require("./mqtt311Codec");

/**
 * Incremental MQTT 3.1.1 stream decoder.
 * TCP/WebSocket stream chunks are not guaranteed to align with packet boundaries.
 */
function createMqtt311StreamDecoder({ maxPacketBytes = 1024 * 1024, maxBufferedBytes = 2 * 1024 * 1024 } = {}) {
  if (!Number.isInteger(maxPacketBytes) || maxPacketBytes < 2 || maxPacketBytes > 16 * 1024 * 1024) {
    throw new TypeError("maxPacketBytes must be between 2 and 16777216");
  }
  if (!Number.isInteger(maxBufferedBytes) || maxBufferedBytes < maxPacketBytes || maxBufferedBytes > 32 * 1024 * 1024) {
    throw new TypeError("maxBufferedBytes must be between maxPacketBytes and 33554432");
  }
  let buffered = Buffer.alloc(0);
  let closed = false;

  function push(chunk) {
    if (closed) throw new Error("MQTT stream decoder is closed");
    if (!(Buffer.isBuffer(chunk) || chunk instanceof Uint8Array || chunk instanceof ArrayBuffer)) {
      throw new TypeError("MQTT stream chunk must be bytes");
    }
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    if (buffered.length + bytes.length > maxBufferedBytes) {
      buffered = Buffer.alloc(0);
      throw new Error("MQTT stream buffer exceeded configured limit");
    }
    if (bytes.length) buffered = buffered.length ? Buffer.concat([buffered, bytes]) : Buffer.from(bytes);
    const packets = [];
    while (buffered.length >= 2) {
      const remaining = decodeRemainingLength(buffered);
      if (!remaining) break;
      const packetLength = remaining.offset + remaining.value;
      if (packetLength > maxPacketBytes) {
        buffered = Buffer.alloc(0);
        throw new Error("MQTT packet exceeded configured size limit");
      }
      if (buffered.length < packetLength) break;
      const packetBytes = buffered.subarray(0, packetLength);
      const decoded = decodePacket(packetBytes, { maxPacketBytes });
      if (decoded) packets.push(decoded);
      buffered = buffered.subarray(packetLength);
    }
    return packets;
  }

  return Object.freeze({
    push,
    reset() { if (closed) throw new Error("MQTT stream decoder is closed"); buffered = Buffer.alloc(0); },
    close() { closed = true; buffered = Buffer.alloc(0); },
    get bufferedBytes() { return buffered.length; },
    get closed() { return closed; }
  });
}

module.exports = { createMqtt311StreamDecoder };
