"use strict";

const crypto = require("node:crypto");

function decodeBase64Url(value, label) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error(`Invalid update manifest ${label}`);
  }
  return Buffer.from(value, "base64url");
}

function parseVersion(value) {
  if (typeof value !== "string") throw new Error("Invalid semantic version");
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(value);
  if (!match) throw new Error("Invalid semantic version");
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), prerelease: match[4] || "" };
}

function compareVersions(left, right) {
  const a = parseVersion(left), b = parseVersion(right);
  for (const key of ["major", "minor", "patch"]) {
    if (a[key] !== b[key]) return a[key] > b[key] ? 1 : -1;
  }
  if (!a.prerelease && !b.prerelease) return 0;
  if (!a.prerelease) return 1;
  if (!b.prerelease) return -1;
  const aa = a.prerelease.split("."), bb = b.prerelease.split(".");
  for (let i = 0; i < Math.max(aa.length, bb.length); i++) {
    if (aa[i] === undefined) return -1;
    if (bb[i] === undefined) return 1;
    if (aa[i] === bb[i]) continue;
    const an = /^\d+$/.test(aa[i]), bn = /^\d+$/.test(bb[i]);
    if (an && bn) return Number(aa[i]) > Number(bb[i]) ? 1 : -1;
    if (an !== bn) return an ? -1 : 1;
    return aa[i] > bb[i] ? 1 : -1;
  }
  return 0;
}

function verifyUpdateManifest(envelope, options = {}) {
  if (!envelope || typeof envelope !== "object") throw new Error("Invalid update manifest envelope");
  const payloadBytes = decodeBase64Url(envelope.payload, "payload");
  const signature = decodeBase64Url(envelope.signature, "signature");
  const publicKey = options.publicKey;
  if (!publicKey || !crypto.verify(null, payloadBytes, publicKey, signature)) {
    throw new Error("Update manifest signature verification failed");
  }

  let manifest;
  try { manifest = JSON.parse(payloadBytes.toString("utf8")); }
  catch { throw new Error("Invalid update manifest payload"); }

  const now = options.now === undefined ? Date.now() : options.now;
  if (manifest.product !== (options.product || "@omega/fca")) throw new Error("Update manifest product mismatch");
  if (!["stable", "beta"].includes(manifest.channel)) throw new Error("Invalid update channel");
  if (options.channel && manifest.channel !== options.channel) throw new Error("Update channel mismatch");
  parseVersion(manifest.version);
  if (!Number.isFinite(manifest.issuedAt) || !Number.isFinite(manifest.expiresAt) ||
      manifest.issuedAt > now + 300000 || manifest.expiresAt <= now || manifest.expiresAt <= manifest.issuedAt) {
    throw new Error("Update manifest is expired or has invalid timestamps");
  }
  if (typeof manifest.minNode !== "string") throw new Error("Invalid minimum Node.js version");
  parseVersion(manifest.minNode);
  if (!manifest.artifact || typeof manifest.artifact !== "object" ||
      typeof manifest.artifact.url !== "string" ||
      !/^[a-f0-9]{64}$/i.test(manifest.artifact.sha256 || "")) {
    throw new Error("Invalid update artifact metadata");
  }
  let artifactUrl;
  try { artifactUrl = new URL(manifest.artifact.url); } catch { throw new Error("Invalid update artifact URL"); }
  if (artifactUrl.protocol !== "https:" || artifactUrl.username || artifactUrl.password || artifactUrl.hash) {
    throw new Error("Update artifact must use a clean HTTPS URL");
  }
  const allowedHosts = options.allowedHosts || [];
  if (!allowedHosts.includes(artifactUrl.hostname)) throw new Error("Update artifact host is not allowed");
  if (typeof manifest.releaseNotes !== "string" || manifest.releaseNotes.length > 12000) {
    throw new Error("Invalid update release notes");
  }

  const currentVersion = options.currentVersion;
  const comparison = currentVersion ? compareVersions(manifest.version, currentVersion) : 1;
  return Object.freeze({
    product: manifest.product,
    version: manifest.version,
    channel: manifest.channel,
    minNode: manifest.minNode,
    issuedAt: manifest.issuedAt,
    expiresAt: manifest.expiresAt,
    releaseNotes: manifest.releaseNotes,
    artifact: Object.freeze({ url: artifactUrl.toString(), sha256: manifest.artifact.sha256.toLowerCase() }),
    updateAvailable: comparison > 0,
    isDowngrade: comparison < 0
  });
}

function verifyArtifactDigest(bytes, expectedSha256) {
  if (!/^[a-f0-9]{64}$/i.test(String(expectedSha256 || ""))) return false;
  const actual = crypto.createHash("sha256").update(bytes).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(String(expectedSha256).toLowerCase(), "hex"));
}

module.exports = { parseVersion, compareVersions, verifyUpdateManifest, verifyArtifactDigest };
