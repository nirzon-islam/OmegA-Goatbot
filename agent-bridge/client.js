"use strict";

const crypto = require("crypto");

const MAX_CLOCK_DRIFT_MS = 5 * 60 * 1000;

function requiredEnv(name) {
  const value = process.env[name];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function createSignedHeaders({ secret, method, url, body, now = Date.now(), nonce }) {
  if (!secret || typeof secret !== "string" || secret.length < 32) {
    throw new Error("Bridge secret must contain at least 32 characters");
  }

  const timestamp = String(now);
  const requestNonce = nonce || crypto.randomBytes(24).toString("hex");
  const rawBody = body === undefined ? "" : JSON.stringify(body);
  const bodyHash = crypto.createHash("sha256").update(rawBody).digest("hex");
  const signedPayload = [
    timestamp,
    requestNonce,
    String(method).toUpperCase(),
    url,
    bodyHash
  ].join("\n");
  const signature = crypto.createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");

  return {
    "content-type": "application/json",
    "x-agent-timestamp": timestamp,
    "x-agent-nonce": requestNonce,
    "x-agent-signature": signature
  };
}

function createBridgeClient() {
  const baseUrl = requiredEnv("AGENT_BACKEND_URL").replace(/\/+$/, "");
  const secret = requiredEnv("AGENT_BRIDGE_SECRET");

  let parsed;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error("AGENT_BACKEND_URL must be a valid URL");
  }

  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
    throw new Error("Agent Backend URL must use HTTPS");
  }

  async function post(path, payload) {
    if (!path.startsWith("/api/bridge/") || path.includes("..")) {
      throw new Error("Invalid Bridge API path");
    }

    const body = payload || {};
    const headers = createSignedHeaders({
      secret,
      method: "POST",
      url: path,
      body
    });

    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000)
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.message || `Bridge request failed (${response.status})`);
      error.status = response.status;
      throw error;
    }
    return data;
  }

  return Object.freeze({ post });
}

module.exports = { createBridgeClient, createSignedHeaders };
