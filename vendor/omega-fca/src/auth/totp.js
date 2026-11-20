"use strict";

const crypto = require("node:crypto");

function decodeBase32(secret) {
  if (typeof secret !== "string" || !secret.trim()) throw new TypeError("TOTP secret must be non-empty Base32 text");
  const normalized = secret.toUpperCase().replace(/[\s=-]/g, "");
  if (!/^[A-Z2-7]+$/.test(normalized)) throw new TypeError("TOTP secret must use Base32 characters A-Z and 2-7");
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of normalized) bits += alphabet.indexOf(char).toString(2).padStart(5, "0");
  const bytes = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) bytes.push(parseInt(bits.slice(offset, offset + 8), 2));
  if (!bytes.length) throw new TypeError("TOTP secret is too short");
  return Buffer.from(bytes);
}

function generateTotp(secret, options = {}) {
  const digits = options.digits === undefined ? 6 : options.digits;
  const period = options.period === undefined ? 30 : options.period;
  const algorithm = String(options.algorithm || "sha1").toLowerCase();
  const timestamp = options.timestamp === undefined ? Date.now() : options.timestamp;
  if (!Number.isInteger(digits) || digits < 6 || digits > 8) throw new RangeError("TOTP digits must be between 6 and 8");
  if (!Number.isInteger(period) || period < 1 || period > 300) throw new RangeError("TOTP period must be between 1 and 300 seconds");
  if (!Number.isFinite(timestamp) || timestamp < 0) throw new TypeError("TOTP timestamp must be a non-negative number");
  if (!["sha1", "sha256", "sha512"].includes(algorithm)) throw new TypeError("Unsupported TOTP algorithm");
  const counter = BigInt(Math.floor(timestamp / 1000 / period));
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(counter);
  const digest = crypto.createHmac(algorithm, decodeBase32(secret)).update(message).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % (10 ** digits)).padStart(digits, "0");
}

module.exports = { generateTotp };
