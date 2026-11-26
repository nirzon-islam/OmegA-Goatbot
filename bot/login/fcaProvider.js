"use strict";

const fs = require("fs");
const path = require("path");
const { loadOrCreateE2EEIdentity } = require("./e2eeIdentity");

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
 * Prepare optional local Signal runtime options. E2EE setup is deliberately
 * fail-open: a missing engine or local-storage problem must never block normal
 * Facebook login, MQTT, or non-encrypted bot features.
 */
function buildFcaLoginOptions(config = {}, accountId = "", env = process.env, loadModule = require) {
  const options = { ...(config.optionsFca || {}) };
  if (config.e2ee?.enable !== true) return options;

  try {
    const normalizedAccountId = String(accountId || "").trim();
    if (!/^\d{5,30}$/.test(normalizedAccountId)) {
      throw new Error("A verified Facebook account ID is not available");
    }

    const moduleName = env.OMEGA_E2EE_SIGNAL_MODULE;
    if (!moduleName) throw new Error("Signal engine is not available yet");

    const signalModule = loadModule(moduleName);
    if (!signalModule || typeof signalModule.PrivateKey?.generate !== "function") {
      throw new TypeError("Configured Signal module is not compatible with OmegA-FCA");
    }

    const storageRoot = env.OMEGA_E2EE_STORAGE_PATH || path.join(process.cwd(), "data", "e2ee");
    const identity = loadOrCreateE2EEIdentity(normalizedAccountId, storageRoot);
    options.e2ee = {
      enabled: true,
      storagePath: identity.storagePath,
      encryptionKey: identity.encryptionKey,
      localDeviceId: identity.localDeviceId,
      signalModule
    };
  } catch (error) {
    Object.defineProperty(options, "e2eeUnavailableReason", {
      value: String(error && error.message || "Local E2EE initialization failed").slice(0, 200),
      enumerable: false
    });
  }
  return options;
}

module.exports = { loadFcaProvider, buildFcaLoginOptions };
