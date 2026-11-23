"use strict";

const fs = require("fs");
const path = require("path");

function packageVersion(packageName, entryPoint) {
  try {
    const packageJson = path.resolve(path.dirname(entryPoint), "..", "package.json");
    return JSON.parse(fs.readFileSync(packageJson, "utf8")).version || "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * OmegA-FCA is the only supported FCA provider.
 * No environment-variable switch or legacy FCA fallback is used.
 */
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
  try {
    version = packageVersion(packageName, require.resolve(packageName));
  } catch { }

  return { login, packageName, version, provider: "omega" };
}


/**
 * Build the single supported provider's login options. Signal is opt-in and
 * requires an operator-supplied compatible libsignal module and 32-byte key.
 * The OmegA runtime initializes local Signal state; it does not claim that
 * Facebook Messenger's private E2EE transport is wired or interoperable.
 */
function buildFcaLoginOptions(config = {}, accountId = "", env = process.env, loadModule = require) {
  const { buildHumanizeOptions } = require("./humanizerOptions");
  const options = {
    ...(config.optionsFca || {}),
    humanize: buildHumanizeOptions(config)
  };
  if (config.e2ee?.enable !== true) return options;

  if (!/^\\d{5,30}$/.test(String(accountId))) {
    throw new Error("OmegA E2EE requires a verified Facebook account ID");
  }
  const encodedKey = env.OMEGA_E2EE_ENCRYPTION_KEY;
  const moduleName = env.OMEGA_E2EE_SIGNAL_MODULE;
  const deviceId = Number(env.OMEGA_E2EE_DEVICE_ID);
  if (typeof encodedKey !== "string" || !/^[A-Za-z0-9+/]{43}=$/.test(encodedKey) ||
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
  const path = require("path");
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

module.exports = { loadFcaProvider, buildFcaLoginOptions };
