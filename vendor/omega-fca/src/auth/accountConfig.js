"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { parseCookieHeader, parseNetscapeCookies, normalizeCookies } = require("../security/cookies");

function resolveProjectFile(root, filePath, label) {
  const target = path.resolve(root, filePath);
  const relative = path.relative(root, target);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new TypeError(label + " must be inside the project root");
  }
  try {
    const real = fs.realpathSync(target);
    const realRelative = path.relative(root, real);
    if (!realRelative || realRelative.startsWith("..") || path.isAbsolute(realRelative)) {
      throw new TypeError(label + " must resolve inside the project root");
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  return target;
}

function parseAccountText(text) {
  if (typeof text !== "string" || !text.trim()) throw new TypeError("account.txt must contain cookie data");
  const source = text.trim();
  if (source.length > 256 * 1024) throw new TypeError("account.txt exceeds 256 KiB");
  if (/^(?:fb_email|email|fb_username|username|fb_password|password|fb_2fa_secret|2FASecret)\s*=/im.test(source)) {
    throw new TypeError("account.txt is AppState/cookie-only; put fb_email, password and 2FASecret in config.json → facebookAccount");
  }
  if (source.startsWith("[") || source.startsWith("{")) {
    const parsed = JSON.parse(source);
    const cookies = Array.isArray(parsed) ? parsed : parsed && (parsed.appState || parsed.cookies);
    if (!Array.isArray(cookies)) throw new TypeError("account.txt JSON must contain a cookie array");
    return normalizeCookies(cookies);
  }
  if (source.startsWith("#") || source.includes("\t")) return parseNetscapeCookies(source);
  return parseCookieHeader(source.replace(/\|/g, ";"));
}


function loadAccountConfig({
  cwd = process.cwd(),
  accountFile = "account.txt",
  configFile = "config.json", // Reserved for the later credential-login phase; not read here.
  appStateFile = null,
  env = process.env
} = {}) {
  const root = path.resolve(cwd);
  const accountPath = resolveProjectFile(root, accountFile, "accountFile");
  try {
    const stat = fs.statSync(accountPath);
    if (!stat.isFile()) throw new Error("account.txt must be a regular file");
    const raw = fs.readFileSync(accountPath, "utf8").trim();
    if (raw) return Object.freeze({ mode: "appstate", appState: parseAccountText(raw), source: "account.txt" });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  // This release path is intentionally AppState-only. Credential login is
  // deferred; config.json and FB_* environment values are not read here.

  const statePath = resolveProjectFile(root, appStateFile || "appstate.json", "AppState file");
  try {
    const stat = fs.statSync(statePath);
    if (!stat.isFile() || stat.size > 1024 * 1024) throw new Error("AppState file must be a regular file no larger than 1 MiB");
    const parsed = JSON.parse(fs.readFileSync(statePath, "utf8"));
    const appState = Array.isArray(parsed) ? parsed : parsed && (parsed.appState || parsed.cookies);
    if (!Array.isArray(appState) || appState.length === 0) throw new Error("AppState file must contain a non-empty cookie array");
    return Object.freeze({ mode: "appstate", appState: normalizeCookies(appState), source: "appstate.json" });
  } catch (error) {
    if (error.code === "ENOENT") {
      const missing = new Error("No Facebook AppState found: add cookies to account.txt or appstate.json");
      missing.code = "FCA_ACCOUNT_CONFIG_MISSING";
      throw missing;
    }
    throw error;
  }
}

module.exports = { parseAccountText, loadAccountConfig, resolveProjectFile };
