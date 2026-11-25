"use strict";

const fs = require("fs");
const path = require("path");

const PREFERRED_FCA_PACKAGES = [
  "@nirzon-islam/omega-fca",
  "@eryxenx/fca",
  "fca-unofficial",
  "facebook-chat-api"
];

function discoverFcaPackages(root = process.cwd()) {
  const found = new Set(PREFERRED_FCA_PACKAGES);
  const manifestPath = path.join(root, "package.json");
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    for (const section of ["dependencies", "optionalDependencies", "devDependencies"]) {
      for (const name of Object.keys(manifest[section] || {})) {
        if (/(^|[-/@])fca($|[-/])|facebook.*chat|chat.*api/i.test(name)) found.add(name);
      }
    }
  } catch {}

  // Also discover installed FCA packages even when they were added manually
  // and are not declared in the root manifest.
  const modulesPath = path.join(root, "node_modules");
  try {
    for (const entry of fs.readdirSync(modulesPath, { withFileTypes: true })) {
      if (entry.name.startsWith("@") && entry.isDirectory()) {
        const scopePath = path.join(modulesPath, entry.name);
        for (const scoped of fs.readdirSync(scopePath, { withFileTypes: true })) {
          if (!scoped.isDirectory()) continue;
          const name = entry.name + "/" + scoped.name;
          if (/(^|[-/@])fca($|[-/])|facebook.*chat|chat.*api/i.test(name)) found.add(name);
        }
      } else if (entry.isDirectory() && !entry.name.startsWith(".")) {
        if (/(^|[-/@])fca($|[-/])|facebook.*chat|chat.*api/i.test(entry.name)) found.add(entry.name);
      }
    }
  } catch {}
  return [...found];
}

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
function loadFcaProvider(_config = {}, loadPackage = require, discoverPackages = discoverFcaPackages) {
  const candidates = discoverPackages();
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

  throw new Error("No compatible FCA package was found automatically. Install any FCA package exposing login(appState, options, callback) and returning an API with getCurrentUserID() and listenMqtt(). Detected candidates: " + failures.join("; "));
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

module.exports = { PREFERRED_FCA_PACKAGES, discoverFcaPackages, getLoginExport, loadFcaProvider, buildFcaLoginOptions };
