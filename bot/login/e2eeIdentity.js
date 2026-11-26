"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const IDENTITY_VERSION = 1;
const KEY_BYTES = 32;
const DEVICE_ID_MAX = 2_147_483_647;

function readIdentity(filePath, accountId) {
  const stat = fs.lstatSync(filePath);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error("OmegA E2EE identity must be a regular file");
  }
  let identity;
  try { identity = JSON.parse(fs.readFileSync(filePath, "utf8")); }
  catch { throw new Error("OmegA E2EE identity file is corrupted; refusing to replace existing keys"); }

  if (!identity || identity.version !== IDENTITY_VERSION ||
      identity.accountId !== accountId ||
      !Number.isSafeInteger(identity.localDeviceId) ||
      identity.localDeviceId < 1 || identity.localDeviceId > DEVICE_ID_MAX ||
      typeof identity.encryptionKey !== "string" ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(identity.encryptionKey)) {
    throw new Error("OmegA E2EE identity file is invalid or belongs to another account");
  }

  const encryptionKey = Buffer.from(identity.encryptionKey, "base64");
  if (encryptionKey.length !== KEY_BYTES || encryptionKey.toString("base64") !== identity.encryptionKey) {
    throw new Error("OmegA E2EE identity contains an invalid encryption key");
  }
  try { fs.chmodSync(filePath, 0o600); } catch { }
  return {
    accountId,
    localDeviceId: identity.localDeviceId,
    encryptionKey,
    storagePath: path.dirname(filePath),
    identityPath: filePath,
    created: false
  };
}

function writeIdentityAtomic(filePath, identity) {
  const directory = path.dirname(filePath);
  const temporaryPath = path.join(directory, ".identity-" + process.pid + "-" + crypto.randomBytes(8).toString("hex") + ".tmp");
  let descriptor;
  try {
    descriptor = fs.openSync(temporaryPath, "wx", 0o600);
    fs.writeFileSync(descriptor, JSON.stringify(identity, null, 2) + "\n", "utf8");
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    // link() creates the destination atomically without replacing another process's identity.
    fs.linkSync(temporaryPath, filePath);
    fs.chmodSync(filePath, 0o600);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  } finally {
    if (descriptor !== undefined) try { fs.closeSync(descriptor); } catch { }
    try { fs.unlinkSync(temporaryPath); } catch { }
  }
}

/** Create or reuse one persistent Signal identity per Facebook account. */
function loadOrCreateE2EEIdentity(accountId, storageRoot = path.join(process.cwd(), "data", "e2ee")) {
  const normalizedAccountId = String(accountId || "").trim();
  if (!/^\d{5,30}$/.test(normalizedAccountId)) throw new Error("OmegA E2EE requires a verified Facebook account ID");
  if (typeof storageRoot !== "string" || !storageRoot.trim()) throw new TypeError("OmegA E2EE storage root must be a non-empty path");

  const accountDirectory = path.join(path.resolve(storageRoot), normalizedAccountId);
  fs.mkdirSync(accountDirectory, { recursive: true, mode: 0o700 });
  try { fs.chmodSync(accountDirectory, 0o700); } catch { }
  const identityPath = path.join(accountDirectory, "identity.json");
  if (fs.existsSync(identityPath)) return readIdentity(identityPath, normalizedAccountId);

  const identity = {
    version: IDENTITY_VERSION,
    accountId: normalizedAccountId,
    localDeviceId: crypto.randomInt(1, DEVICE_ID_MAX),
    encryptionKey: crypto.randomBytes(KEY_BYTES).toString("base64")
  };
  try { writeIdentityAtomic(identityPath, identity); }
  catch (error) {
    if (error.code !== "EEXIST") throw new Error("Could not securely persist OmegA E2EE identity", { cause: error });
  }
  return { ...readIdentity(identityPath, normalizedAccountId), created: true };
}

module.exports = { loadOrCreateE2EEIdentity };
