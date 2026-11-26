"use strict";

const fs = require("fs");
const path = require("path");
const { loadOrCreateE2EEIdentity } = require("./e2eeIdentity");
const { logE2EE } = require("./e2eeDiagnostics");

function packageVersion(packageName, entryPoint) {
  try {
    const packageJson = path.resolve(path.dirname(entryPoint), "..", "package.json");
    return JSON.parse(fs.readFileSync(packageJson, "utf8")).version || "unknown";
  } catch {
    return "unknown";
  }
}

/** OmegA-FCA is the only supported FCA provider. */
function loadFcaProvider(_config = {}, loadPackage = require) {
  const packageName = "@nirzon-islam/omega-fca";
  let login;
  try {
    login = loadPackage(packageName);
  } catch (error) {
    throw new Error(
      "OmegA-FCA is required but is not installed. Install @nirzon-islam/omega-fca before starting GoatBot.",
      { cause: error }
    );
  }
  if (typeof login !== "function") {
    throw new TypeError(packageName + " must export a callable CommonJS login function.");
  }

  let version = "unknown";
  try { version = packageVersion(packageName, require.resolve(packageName)); } catch { }
  return { login, packageName, version, provider: "omega" };
}

/**
 * Provision local E2EE identity material automatically for the authenticated
 * Facebook account. No Railway key/device/module variables are required.
 * Signal runtime loading and Messenger registration are separate later steps.
 */
function buildFcaLoginOptions(config = {}, accountId = "", env = process.env) {
  const options = { ...(config.optionsFca || {}) };
  if (config.e2ee?.enable !== true) return options;

  const startedAt = Date.now();
  try {
    const normalizedAccountId = String(accountId || "").trim();
    if (!/^\d{5,30}$/.test(normalizedAccountId)) {
      throw new Error("A verified Facebook account ID is not available");
    }

    const storageRoot = env.OMEGA_E2EE_STORAGE_PATH || path.join(process.cwd(), "data", "e2ee");
    const identity = loadOrCreateE2EEIdentity(normalizedAccountId, storageRoot);
    options.e2ee = {
      enabled: true,
      storagePath: identity.storagePath,
      encryptionKey: identity.encryptionKey,
      localDeviceId: identity.localDeviceId
    };
    logE2EE(identity.created ? "identity.created" : "identity.ready", {
      accountId: normalizedAccountId, status: "ready", stage: "local-identity", durationMs: Date.now() - startedAt
    });
  } catch (error) {
    logE2EE("identity.unavailable", {
      accountId, status: "unavailable", stage: "local-identity", durationMs: Date.now() - startedAt,
      reason: error && error.message === "A verified Facebook account ID is not available" ? "account-id-unavailable" : "local-storage-or-identity-error"
    });
    Object.defineProperty(options, "e2eeUnavailableReason", {
      value: String(error && error.message || "Local E2EE initialization failed").slice(0, 200),
      enumerable: false
    });
  }
  return options;
}

module.exports = { loadFcaProvider, buildFcaLoginOptions };
