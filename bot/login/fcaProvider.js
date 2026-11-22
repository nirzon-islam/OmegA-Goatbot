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
 * Resolve the FCA provider without silently dropping GoatBot-only features.
 *
 * OmegA-FCA 0.2.x is opt-in until its Messenger E2EE and GoatBot humanizer
 * compatibility are implemented and verified. The legacy provider remains
 * the default and fallback.
 */
function loadFcaProvider(config = {}, env = process.env, loadPackage = require) {
  const requested = String(env.OMEGA_FCA_PROVIDER || "eryxenx").trim().toLowerCase();

  if (requested === "omega") {
    if (config.e2ee?.enable !== false) {
      throw new Error(
        "OmegA-FCA provider is blocked: disable config.e2ee.enable until Messenger E2EE compatibility is verified."
      );
    }

    if (config.humanizer?.enable !== false) {
      throw new Error(
        "OmegA-FCA provider is blocked: disable config.humanizer.enable until GoatBot humanizer compatibility is implemented."
      );
    }
  } else if (requested !== "eryxenx") {
    throw new Error('Unknown OMEGA_FCA_PROVIDER. Use "eryxenx" or "omega".');
  }

  const packageName = requested === "omega"
    ? "@nirzon-islam/omega-fca"
    : "@eryxenx/fca";

  let login;
  try {
    login = loadPackage(packageName);
  } catch (error) {
    if (requested === "omega") {
      throw new Error(
        "OmegA-FCA was selected but is not installed. Publish @nirzon-islam/omega-fca or install its release before enabling this provider.",
        { cause: error }
      );
    }
    throw error;
  }

  if (typeof login !== "function") {
    throw new TypeError(packageName + " must export a callable CommonJS login function.");
  }

  let version = "unknown";
  try {
    version = packageVersion(packageName, require.resolve(packageName));
  } catch { }

  return { login, packageName, version, provider: requested };
}

module.exports = { loadFcaProvider };
