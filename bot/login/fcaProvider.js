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

module.exports = { loadFcaProvider };
