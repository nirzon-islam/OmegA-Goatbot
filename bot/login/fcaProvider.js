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
 * Build optional local Signal runtime options. The per-account encryption key
 * and device ID are generated and persisted automatically; no Railway secrets
 * are required for local key material. Step 2 will own Signal engine loading.
 */
function buildFcaLoginOptions(config = {}, accountId = "", env = process.env, loadModule = require) {
  const options = { ...(config.optionsFca || {}) };
  if (config.e2ee?.enable !== true) return options;

  const moduleName = env.OMEGA_E2EE_SIGNAL_MODULE;
  if (!moduleName) {
    throw new Error("OmegA E2EE Signal engine is not available yet; local identity was not initialized");
  }

  let signalModule;
  try { signalModule = loadModule(moduleName); }
  catch (error) {
    throw new Error("Configured OMEGA_E2EE_SIGNAL_MODULE could not be loaded", { cause: error });
  }
  if (!signalModule || typeof signalModule.PrivateKey?.generate !== "function") {
    throw new TypeError("Configured Signal module is not compatible with OmegA-FCA");
  }

  const storageRoot = env.OMEGA_E2EE_STORAGE_PATH || path.join(process.cwd(), "data", "e2ee");
  const identity = loadOrCreateE2EEIdentity(accountId, storageRoot);
  options.e2ee = {
    enabled: true,
    storagePath: identity.storagePath,
    encryptionKey: identity.encryptionKey,
    localDeviceId: identity.localDeviceId,
    signalModule
  };
  return options;
}

module.exports = { loadFcaProvider, buildFcaLoginOptions };
