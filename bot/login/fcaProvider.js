"use strict";

const fs = require("fs");
const path = require("path");

const PREFERRED_FCA_PACKAGES = [
  "@nirzon-islam/omega-fca",
  "@eryxenx/fca",
  "fca-unofficial",
  "facebook-chat-api"
];
const FCA_PACKAGE_PATTERN = /(^|[-/@])fca($|[-/])|facebook.*chat|chat.*api/i;

function discoverFcaPackages(root = process.cwd()) {
  const found = new Set(PREFERRED_FCA_PACKAGES);
  const manifestPath = path.join(root, "package.json");
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    for (const section of ["dependencies", "optionalDependencies", "devDependencies"]) {
      for (const name of Object.keys(manifest[section] || {})) {
        if (FCA_PACKAGE_PATTERN.test(name)) found.add(name);
      }
    }
  } catch {}

  // Discover installed FCA packages even when they were added manually.
  const modulesPath = path.join(root, "node_modules");
  try {
    for (const entry of fs.readdirSync(modulesPath, { withFileTypes: true })) {
      if (entry.name.startsWith("@") && entry.isDirectory()) {
        const scopePath = path.join(modulesPath, entry.name);
        for (const scoped of fs.readdirSync(scopePath, { withFileTypes: true })) {
          if (!scoped.isDirectory()) continue;
          const name = entry.name + "/" + scoped.name;
          if (FCA_PACKAGE_PATTERN.test(name)) found.add(name);
        }
      } else if (entry.isDirectory() && !entry.name.startsWith(".") &&
          FCA_PACKAGE_PATTERN.test(entry.name)) {
        found.add(entry.name);
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
 * Load any installed FCA that implements the GoatBot callback-login contract.
 * FCA_PACKAGE (or OMEGA_FCA_PACKAGE for backwards compatibility) selects an
 * exact installed package. Without it, known/declared/installed FCA packages
 * are discovered and tried in priority order.
 */
function loadFcaProvider(_config = {}, loadPackage = require, discoverPackages = discoverFcaPackages, env = process.env) {
  const explicitPackage = String(env.FCA_PACKAGE || env.OMEGA_FCA_PACKAGE || "").trim();
  const candidates = explicitPackage ? [explicitPackage] : discoverPackages();
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
      try {
        const entryPoint = require.resolve(packageName);
        version = packageVersion(packageName, entryPoint);
      } catch {}
      return {
        login,
        packageName,
        version,
        provider: packageName === "@nirzon-islam/omega-fca" ? "omega" : "compatible",
        contract: "callback-login"
      };
    } catch (error) {
      failures.push(packageName + ": " + String(error?.code || error?.message || "load failed").slice(0, 100));
      if (explicitPackage) break;
    }
  }

  const selectionHint = explicitPackage
    ? "The package selected by FCA_PACKAGE is not installed or does not export a compatible login function."
    : "Install a compatible FCA or set FCA_PACKAGE to its installed package name.";
  throw new Error(selectionHint + " Required contract: login({ appState }, options, callback), returning an API with getCurrentUserID() and listenMqtt(). Detected candidates: " + failures.join("; "));
}

/**
 * Build common FCA options. Signal remains opt-in and requires an explicitly
 * configured compatible libsignal module; unsupported FCA providers may ignore
 * or reject the optional e2ee option, so it is never silently enabled.
 */
function buildFcaLoginOptions(config = {}, accountId = "", env = process.env, loadModule = require) {
  const options = { ...(config.optionsFca || {}) };
  if (config.e2ee?.enable !== true) return options;

  if (!/^\\d{5,30}$/.test(String(accountId))) {
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
