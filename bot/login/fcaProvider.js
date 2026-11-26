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
/**
 * GoatBot uses the same normal FCA login flow as the reference bot.
 * The previous local Signal-runtime scaffold was not connected to
 * Messenger's E2EE transport and incorrectly required private env vars.
 * Ignore legacy config.e2ee flags; login must not depend on E2EE secrets.
 */
function buildFcaLoginOptions(config = {}) {
  return { ...(config.optionsFca || {}) };
}

module.exports = { loadFcaProvider, buildFcaLoginOptions };
