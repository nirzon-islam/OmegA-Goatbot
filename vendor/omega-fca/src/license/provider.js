"use strict";

const { verifyLicenseToken } = require("./verify");

function createLicenseProvider({ backendUrl, licenseId, installationId, licenseKey, publicKey, fetchImpl = globalThis.fetch } = {}) {
  if (typeof backendUrl !== "string" || !backendUrl.trim()) throw new TypeError("License backend URL is required");
  let parsed;
  try { parsed = new URL(backendUrl); } catch { throw new TypeError("License backend URL is invalid"); }
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && parsed.hostname === "localhost")) throw new TypeError("License backend must use HTTPS (HTTP is allowed only on localhost)");
  if (parsed.username || parsed.password || parsed.search || parsed.hash) throw new TypeError("License backend URL must not contain credentials, query parameters, or a fragment");
  if (typeof fetchImpl !== "function") throw new TypeError("Fetch implementation is unavailable");
  if (typeof licenseId !== "string" || !/^lic_[a-f0-9]{32}$/.test(licenseId) ||
      typeof installationId !== "string" || !installationId ||
      typeof licenseKey !== "string" || licenseKey.length < 32) {
    throw new TypeError("License credentials are incomplete");
  }

  return async function refreshLicense() {
    const response = await fetchImpl(new URL("/api/fca-license/refresh", parsed.origin), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ licenseId, installationId, licenseKey }),
      signal: AbortSignal.timeout(10_000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || typeof data.token !== "string") {
      const error = new Error(data.message || "FCA license refresh failed");
      error.status = response.status;
      error.retryable = response.status >= 500 || response.status === 429;
      throw error;
    }
    verifyLicenseToken(data.token, publicKey, { installationId });
    return data.token;
  };
}

module.exports = { createLicenseProvider };
