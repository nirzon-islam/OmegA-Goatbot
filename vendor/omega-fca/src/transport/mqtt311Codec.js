"use strict";

// MQTT 3.1.1 codec primitives (OASIS MQTT v3.1.1, Sections 2–3).
// This module is broker-agnostic. It intentionally contains no Facebook
// endpoint, authentication metadata, topic list, or application payload schema.

const MAX_REMAINING_LENGTH = 268435455;

function encodeRemainingLength(value) {
  if (!Number.isInteger(value) || value < 0 || value > MAX_REMAINING_LENGTH) {
    throw new RangeError("MQTT remaining length is out of range");
  }
  const out = [];
  do {
    let digit = value % 128;
    value = Math.floor(value / 128);
    if (value > 0) digit |= 0x80;
    out.push(digit);
  } while (value > 0);
  return Buffer.from(out);
}

function decodeRemainingLength(buffer, offset = 1) {
  if (!Buffer.isBuffer(buffer)) throw new TypeError("MQTT packet must be a Buffer");
  let multiplier = 1;
  let value = 0;
  let cursor = offset;
  for (let count = 0; count < 4; count++) {
    if (cursor >= buffer.length) return null;
    const digit = buffer[cursor++];
    value += (digit & 0x7f) * multiplier;
    if ((digit & 0x80) === 0) {
      if (count > 0 && (digit & 0x7f) === 0) throw new Error("Non-canonical MQTT remaining length");
      if (value > MAX_REMAINING_LENGTH) throw new Error("MQTT remaining length is out of range");
      return Object.freeze({ value, bytes: cursor - offset, offset: cursor });
    }
    multiplier *= 128;
  }
  throw new Error("Malformed MQTT remaining length");
}

function encodeUtf8(value, field = "string") {
  if (typeof value !== "string") throw new TypeError(field + " must be a string");
  const bytes = Buffer.from(value, "utf8");
  if (bytes.length > 65535 || value.includes("\u0000")) {
    throw new RangeError(field + " is not a valid MQTT UTF-8 string");
  }
  const length = Buffer.allocUnsafe(2);
  length.writeUInt16BE(bytes.length, 0);
  return Buffer.concat([length, bytes]);
}

function encodeBinary(value, field = "binary field") {
  const bytes = Buffer.from(value);
  if (bytes.length > 65535) throw new RangeError(field + " exceeds 65535 bytes");
  const length = Buffer.allocUnsafe(2);
  length.writeUInt16BE(bytes.length, 0);
  return Buffer.concat([length, bytes]);
}

function readUtf8(buffer, offset) {
  if (offset + 2 > buffer.length) throw new Error("Truncated MQTT UTF-8 length");
  const length = buffer.readUInt16BE(offset);
  const start = offset + 2;
  const end = start + length;
  if (end > buffer.length) throw new Error("Truncated MQTT UTF-8 value");
  const value = buffer.toString("utf8", start, end);
  if (value.includes("\u0000")) throw new Error("Invalid MQTT UTF-8 value");
  return { value, offset: end };
}

function readBinary(buffer, offset) {
  if (offset + 2 > buffer.length) throw new Error("Truncated MQTT binary length");
  const length = buffer.readUInt16BE(offset);
  const start = offset + 2;
  const end = start + length;
  if (end > buffer.length) throw new Error("Truncated MQTT binary value");
  return { value: buffer.subarray(start, end), offset: end };
}

function packet(header, body) {
  const payload = Buffer.from(body || []);
  return Buffer.concat([Buffer.from([header]), encodeRemainingLength(payload.length), payload]);
}

function encodeConnect(options = {}) {
  const clientId = options.clientId;
  if (typeof clientId !== "string" || !clientId.length) throw new TypeError("MQTT clientId is required");
  const keepAlive = options.keepAlive ?? 60;
  const protocolVersion = options.protocolVersion ?? 4;
  const protocolId = options.protocolId ?? (protocolVersion === 3 ? "MQIsdp" : "MQTT");
  if (![3, 4].includes(protocolVersion) || (protocolVersion === 3 && protocolId !== "MQIsdp") || (protocolVersion === 4 && protocolId !== "MQTT")) {
    throw new TypeError("MQTT protocolId and protocolVersion must be MQIsdp/3 or MQTT/4");
  }
  if (!Number.isInteger(keepAlive) || keepAlive < 0 || keepAlive > 65535) {
    throw new RangeError("MQTT keepAlive must be between 0 and 65535");
  }
  const usernamePresent = options.username !== undefined;
  const passwordPresent = options.password !== undefined;
  if (passwordPresent && !usernamePresent) throw new TypeError("MQTT password requires username");
  const cleanSession = options.cleanSession !== false;
  let flags = cleanSession ? 0x02 : 0;
  if (usernamePresent) flags |= 0x80;
  if (passwordPresent) flags |= 0x40;
  const variable = Buffer.alloc(2 + protocolId.length + 4);
  variable.writeUInt16BE(protocolId.length, 0);
  variable.write(protocolId, 2, "ascii");
  const versionOffset = 2 + protocolId.length;
  variable[versionOffset] = protocolVersion;
  variable[versionOffset + 1] = flags;
  variable.writeUInt16BE(keepAlive, versionOffset + 2);
  const payload = [encodeUtf8(clientId, "clientId")];
  if (usernamePresent) payload.push(encodeUtf8(options.username, "username"));
  if (passwordPresent) payload.push(encodeBinary(options.password, "password"));
  return packet(0x10, Buffer.concat([variable, ...payload]));
}

function encodePublish({ topic, payload, qos = 0, retain = false, dup = false, packetId } = {}) {
  if (typeof topic !== "string" || !topic.length || /[+#]/.test(topic)) {
    throw new TypeError("MQTT PUBLISH topic must be a non-empty topic name without wildcards");
  }
  if (![0, 1, 2].includes(qos)) throw new RangeError("MQTT QoS must be 0, 1, or 2");
  if (qos > 0 && (!Number.isInteger(packetId) || packetId < 1 || packetId > 65535)) {
    throw new RangeError("MQTT QoS 1/2 requires a packetId from 1 to 65535");
  }
  const flags = (dup ? 0x08 : 0) | (qos << 1) | (retain ? 1 : 0);
  const body = [encodeUtf8(topic, "topic")];
  if (qos > 0) {
    const id = Buffer.allocUnsafe(2);
    id.writeUInt16BE(packetId, 0);
    body.push(id);
  }
  body.push(Buffer.from(payload ?? []));
  return packet(0x30 | flags, Buffer.concat(body));
}

function encodeSubscribe(packetId, subscriptions) {
  if (!Number.isInteger(packetId) || packetId < 1 || packetId > 65535) {
    throw new RangeError("MQTT SUBSCRIBE requires a packetId from 1 to 65535");
  }
  if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
    throw new TypeError("MQTT SUBSCRIBE requires at least one subscription");
  }
  const id = Buffer.allocUnsafe(2);
  id.writeUInt16BE(packetId, 0);
  const entries = subscriptions.map(item => {
    if (!item || typeof item.topic !== "string" || !item.topic.length ||
        ![0, 1, 2].includes(item.qos ?? 0)) throw new TypeError("Invalid MQTT subscription");
    return Buffer.concat([encodeUtf8(item.topic, "topic filter"), Buffer.from([item.qos ?? 0])]);
  });
  return packet(0x82, Buffer.concat([id, ...entries]));
}

function encodePacketId(type, packetId) {
  if (!Number.isInteger(packetId) || packetId < 1 || packetId > 65535) {
    throw new RangeError("MQTT acknowledgement requires a packetId from 1 to 65535");
  }
  const id = Buffer.allocUnsafe(2);
  id.writeUInt16BE(packetId, 0);
  const headers = { puback: 0x40, pubrec: 0x50, pubrel: 0x62, pubcomp: 0x70, unsubscribe: 0xa2 };
  if (!Object.hasOwn(headers, type)) throw new TypeError("Unsupported MQTT packet type");
  if (type === "unsubscribe") throw new TypeError("Use encodeUnsubscribe for UNSUBSCRIBE packets");
  return packet(headers[type], id);
}

function encodeUnsubscribe(packetId, topics) {
  if (!Number.isInteger(packetId) || packetId < 1 || packetId > 65535) {
    throw new RangeError("MQTT UNSUBSCRIBE requires a packetId from 1 to 65535");
  }
  if (!Array.isArray(topics) || topics.length === 0 || topics.some(topic => typeof topic !== "string" || !topic)) {
    throw new TypeError("MQTT UNSUBSCRIBE requires topic filters");
  }
  const id = Buffer.allocUnsafe(2);
  id.writeUInt16BE(packetId, 0);
  return packet(0xa2, Buffer.concat([id, ...topics.map(topic => encodeUtf8(topic, "topic filter"))]));
}

function encodePingReq() { return Buffer.from([0xc0, 0x00]); }
function encodeDisconnect() { return Buffer.from([0xe0, 0x00]); }

function decodePacket(buffer, { maxPacketBytes = 1024 * 1024 } = {}) {
  if (!Buffer.isBuffer(buffer)) buffer = Buffer.from(buffer);
  if (buffer.length < 2 || buffer.length > maxPacketBytes) throw new Error("Invalid MQTT packet size");
  const remaining = decodeRemainingLength(buffer);
  if (!remaining) return null;
  const end = remaining.offset + remaining.value;
  if (end > buffer.length) return null;
  if (end !== buffer.length) throw new Error("Trailing bytes after MQTT packet");
  const header = buffer[0];
  const type = header >> 4;
  const flags = header & 0x0f;
  const body = buffer.subarray(remaining.offset, end);
  const packetTypes = ["reserved", "connect", "connack", "publish", "puback", "pubrec", "pubrel", "pubcomp", "subscribe", "suback", "unsubscribe", "unsuback", "pingreq", "pingresp", "disconnect", "reserved"];
  if (type === 0 || type === 15) throw new Error("Reserved MQTT packet type");
  const requiredFlags = { 1: 0, 2: 0, 4: 0, 5: 0, 6: 2, 7: 0, 8: 2, 9: 0, 10: 2, 11: 0, 12: 0, 13: 0, 14: 0 };
  if (type !== 3 && flags !== requiredFlags[type]) {
    throw new Error("Invalid MQTT fixed-header flags");
  }
  if (type === 2) {
    if (body.length !== 2 || body[0] > 1 || body[1] > 5 || (body[1] !== 0 && body[0] !== 0)) {
      throw new Error("Invalid MQTT CONNACK");
    }
    return Object.freeze({ type: "connack", sessionPresent: Boolean(body[0] & 1), returnCode: body[1] });
  }
  if (type === 3) {
    const topic = readUtf8(body, 0);
    const qos = (flags >> 1) & 3;
    if (qos === 3) throw new Error("Invalid MQTT PUBLISH QoS");
    let offset = topic.offset;
    let packetId;
    if (qos > 0) {
      if (offset + 2 > body.length) throw new Error("Truncated MQTT PUBLISH packetId");
      packetId = body.readUInt16BE(offset);
      if (packetId === 0) throw new Error("Invalid MQTT PUBLISH packetId");
      offset += 2;
    }
    return Object.freeze({ type: "publish", topic: topic.value, qos, dup: Boolean(flags & 8), retain: Boolean(flags & 1), packetId, payload: body.subarray(offset) });
  }
  if ([4, 5, 6, 7, 9, 11].includes(type)) {
    if (body.length < 2) throw new Error("Truncated MQTT acknowledgement");
    const packetId = body.readUInt16BE(0);
    if (packetId === 0) throw new Error("Invalid MQTT packetId");
    if (type === 9) {
      const grants = Array.from(body.subarray(2));
      if (grants.length === 0 || grants.some(grant => ![0, 1, 2, 0x80].includes(grant))) {
        throw new Error("Invalid MQTT SUBACK return codes");
      }
      return Object.freeze({ type: "suback", packetId, grants });
    }
    if (type === 4 || type === 5 || type === 6 || type === 7 || type === 11) {
      if (type !== 9 && body.length !== 2 && !(type === 9)) throw new Error("Invalid MQTT acknowledgement length");
      return Object.freeze({ type: packetTypes[type], packetId });
    }
  }
  if (type === 13 || type === 12 || type === 14) {
    if (body.length !== 0) throw new Error("Invalid MQTT control packet length");
    return Object.freeze({ type: packetTypes[type] });
  }
  return Object.freeze({ type: packetTypes[type], flags, body: Buffer.from(body) });
}

module.exports = {
  MAX_REMAINING_LENGTH,
  encodeRemainingLength,
  decodeRemainingLength,
  encodeConnect,
  encodePublish,
  encodeSubscribe,
  encodePacketId,
  encodeUnsubscribe,
  encodePingReq,
  encodeDisconnect,
  decodePacket
};
