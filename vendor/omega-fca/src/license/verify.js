"use strict";

const crypto = require("node:crypto");

function decodeSegment(segment, label) {
  if (typeof segment !== "string" || !/^[A-Za-z0-9_-]+$/.test(segment)) {
    throw new Error("Invalid license " + label);
  }
  return Buffer.from(segment, "base64url");
}

function verifyLicenseToken(token, publicKey, expected = {}) {
  if (typeof token !== "string" || token.length > 16_384) throw new Error("License token is missing or too large");
  if (typeof publicKey !== "string" || !publicKey.includes("PUBLIC KEY")) throw new Error("License verification public key is not configured");
  const parts = token.split(".");
  if (parts.length !== 2) throw new Error("Malformed license token");
  const payloadBytes = decodeSegment(parts[0], "payload");
  const signature = decodeSegment(parts[1], "signature");
  const valid = crypto.verify(null, payloadBytes, publicKey, signature);
  if (!valid) throw new Error("License signature is invalid");

  let payload;
  try { payload = JSON.parse(payloadBytes.toString("utf8")); }
  catch { throw new Error("License payload is invalid"); }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("License payload must be an object");
  if (payload.iss !== "OmegA-License-Service" || payload.aud !== "OmegA-FCA") throw new Error("License issuer or product is invalid");
  if (typeof payload.licenseId !== "string" || !/^[A-Za-z0-9_-]{8,128}$/.test(payload.licenseId)) throw new Error("License ID is invalid");
  if (!Number.isInteger(payload.iat) || !Number.isInteger(payload.exp) || payload.exp <= payload.iat) throw new Error("License time claims are invalid");
  const now = Math.floor(Date.now() / 1000);
  if (payload.iat > now + 60 || payload.exp <= now) throw new Error("License is not currently valid");
  if (expected.installationId && payload.installationId !== expected.installationId) throw new Error("License belongs to another installation");
  if (expected.ownerId && payload.ownerId !== expected.ownerId) throw new Error("License owner does not match");
  return Object.freeze({
    licenseId: payload.licenseId,
    ownerId: payload.ownerId || null,
    installationId: payload.installationId || null,
    expiresAt: new Date(payload.exp * 1000),
    features: Array.isArray(payload.features) ? payload.features.filter(item => typeof item === "string") : []
  });
}

module.exports = { verifyLicenseToken };
