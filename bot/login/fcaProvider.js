"use strict";

const fs = require("fs");
const path = require("path");

const DEFAULT_FCA_PACKAGES = [
  "@nirzon-islam/omega-fca",
  "@eryxenx/fca",
  "fca-unofficial",
  "facebook-chat-api"
];

function packageVersion(packageName, entryPoint) {
  try {
    let directory = path.dirname(entryPoint);
    while (directory !== path.dirname(directory)) {
      const packageJson = path.join(directory, "package.json");
      if (fs.existsSync(packageJson)) {
        const metadata = JSON.parse(fs.readFileSync(packageJson, "utf8"));
        if (metadata.name === packageName) return metadata.version || "unknown";
      }
      directory = path.dirname(directory);
    }
  } catch {}
  return "unknown";
}

function getLoginExport(loaded) {
  if (typeof loaded === "function") return loaded;
  if (loaded && typeof loaded.login === "function") return loaded.login;
  if (loaded?.default && typeof loaded.default === "function") return loaded.default;
  if (loaded?.default && typeof loaded.default.login === "function") return loaded.default.login;
  return null;
}

/**
 * Load a compatible FCA login implementation.
 * Select one explicitly with FCA_PACKAGE / OMEGA_FCA_PACKAGE, otherwise use
 * the first installed supported package. All providers must implement the
 * common login(appState, options, callback) contract and return an API with
 * getCurrentUserID() and listenMqtt().
 */
function loadFcaProvider(config = {}, loadPackage = require) {
  const configured = process.env.FCA_PACKAGE || process.env.OMEGA_FCA_PACKAGE ||
    config.fcaPackage || config.fcaProvider?.package;
  const candidates = configured
    ? [String(configured).trim()]
    : DEFAULT_FCA_PACKAGES;
  const failures = [];

  for (const packageName of candidates) {
    if (!packageName) continue;
    try {
      const loaded = loadPackage(packageName);
      const login = getLoginExport(loaded);
      if (!login) {
        failures.push(packageName + ": no callable login export");
        continue;
      }
      let version = "unknown";
      try { version = packageVersion(packageName, require.resolve(packageName)); } catch {}
      return {
        login,
        packageName,
        version,
        provider: packageName === "@nirzon-islam/omega-fca" ? "omega" : "compatible",
        contract: "callback-login"
      };
    } catch (error) {
      failures.push(packageName + ": " + String(error?.code || error?.message || "load failed").slice(0, 100));
    }
  }

  const selection = configured
    ? "Configured FCA package " + configured + " could not be loaded."
    : "No supported FCA package is installed.";
  throw new Error(selection + " Install a compatible FCA package or set FCA_PACKAGE to its installed package name. Providers must expose login(appState, options, callback), getCurrentUserID() and listenMqtt(). Details: " + failures.join("; "));
}

/**
 * Build common FCA options. Signal remains opt-in and requires an explicitly
 * configured compatible libsignal module; unsupported FCA providers may ignore
 * or reject the optional e2ee option, so it is never silently enabled.
 */
function buildFcaLoginOptions(config = {}, accountId = "", env = process.env, loadModule = require) {
  const options = { ...(config.optionsFca || {}) };
  if (config.e2ee?.enable !== true) return options;

  if (!/^\d{5,30}$/.test(String(accountId))) {
    throw new Error("OmegA E2EE requires a verified Facebook account ID");
  }
  const encodedKey = env.OMEGA_E2EE_ENCRYPTION_KEY;
  const moduleName = env.OMEGA_E2EE_SIGNAL_MODULE;
  const deviceId = Number(env.OMEGA_E2EE_DEVICE_ID);
  if (typeof encodedKey !== "string" || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encodedKey) ||
      !Number.isSafeInteger(deviceId) || deviceId < 1 || !moduleName) {
    throw new Error("OmegA E2EE is enabled but OMEGA_E2EE_ENCRYPTION_KEY (base64 32-byte key), OMEGA_E2EE_DEVICE_ID and OMEGA_E2EE_SIGNAL_MODULE are not configured");
  }
  const encryptionKey = Buffer.from(encodedKey, "base64");
  if (encryptionKey.length !== 32 || encryptionKey.toString("base64") !== encodedKey) {
    throw new Error("OMEGA_E2EE_ENCRYPTION_KEY must encode exactly 32 bytes");
  }
  let signalModule;
  try {
    signalModule = loadModule(moduleName);
  } catch (error) {
    throw new Error("Configured OMEGA_E2EE_SIGNAL_MODULE could not be loaded", { cause: error });
  }
  if (!signalModule || typeof signalModule.PrivateKey?.generate !== "function") {
    throw new TypeError("Configured Signal module is not compatible with OmegA-FCA");
  }
  const storageRoot = env.OMEGA_E2EE_STORAGE_PATH || path.join(process.cwd(), "data", "e2ee");
  options.e2ee = {
    enabled: true,
    storagePath: path.join(path.resolve(storageRoot), String(accountId)),
    encryptionKey,
    localDeviceId: deviceId,
    signalModule
  };
  return options;
}

module.exports = { DEFAULT_FCA_PACKAGES, getLoginExport, loadFcaProvider, buildFcaLoginOptions };
