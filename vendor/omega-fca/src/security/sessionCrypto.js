"use strict";

const crypto = require("node:crypto");

const FORMAT = "omega-fca-session:v1";

function resolveKey(key) {
  if ((Buffer.isBuffer(key) || key instanceof Uint8Array) && key.byteLength === 32) {
    return Buffer.from(key);
  }
  if (typeof key !== "string" || !/^[a-f0-9]{64}$/i.test(key)) {
    throw new TypeError("Session encryption key must be 32 bytes or exactly 64 hexadecimal characters");
  }
  return Buffer.from(key, "hex");
}

function encryptSession(session, key) {
  if (!session || typeof session !== "object" || Array.isArray(session)) throw new TypeError("Session must be an object");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", resolveKey(key), iv);
  cipher.setAAD(Buffer.from(FORMAT));
  const serialized = JSON.stringify(session);
  if (typeof serialized !== "string") throw new TypeError("Session must be JSON-serializable");
  const plaintext = Buffer.from(serialized, "utf8");
  if (plaintext.length > 1024 * 1024) throw new RangeError("Session data exceeds the 1 MiB limit");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Object.freeze({
    format: FORMAT,
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    data: encrypted.toString("base64url")
  });
}

function decryptSession(envelope, key) {
  if (!envelope || typeof envelope !== "object" || envelope.format !== FORMAT ||
      typeof envelope.iv !== "string" || typeof envelope.tag !== "string" || typeof envelope.data !== "string") {
    throw new TypeError("Unsupported encrypted session format");
  }
  const decode = value => {
    if (!/^[A-Za-z0-9_-]*$/.test(value) || value.length % 4 === 1) {
      throw new TypeError("Invalid encrypted session envelope");
    }
    const decoded = Buffer.from(value, "base64url");
    if (decoded.toString("base64url") !== value) throw new TypeError("Invalid encrypted session envelope");
    return decoded;
  };
  const iv = decode(envelope.iv);
  const tag = decode(envelope.tag);
  const data = decode(envelope.data);
  if (iv.length !== 12 || tag.length !== 16 || data.length > 1024 * 1024) throw new TypeError("Invalid encrypted session envelope");
  const decipher = crypto.createDecipheriv("aes-256-gcm", resolveKey(key), iv);
  decipher.setAAD(Buffer.from(FORMAT));
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(data), decipher.final()]);
  const session = JSON.parse(plaintext.toString("utf8"));
  if (!session || typeof session !== "object" || Array.isArray(session)) throw new TypeError("Decrypted session is invalid");
  return session;
}

module.exports = { encryptSession, decryptSession };
