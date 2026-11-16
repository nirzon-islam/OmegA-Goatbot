"use strict";

const path = require("path");
const fs = require("fs");
const login = require("@eryxenx/fca");
const secureSession = require("../bot/login/secureSession");
const { buildHumanizeOptions } = require("../bot/login/humanizerOptions");

let running = false;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForBotOnline(expectedBotId, timeoutMs = 90000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const accountId = String(global.GoatBot?.botID || global.botID || "");
    if (global.statusAccountBot === "good" &&
        global.GoatBot?.fcaApi &&
        global.GoatBot?.Listening &&
        /^\d{5,30}$/.test(accountId) &&
        accountId === expectedBotId) {
      return accountId;
    }
    if (global.statusAccountBot === "checkpoint") {
      throw new Error("Facebook checkpoint requires manual completion");
    }
    if (global.statusAccountBot === "can't login" ||
        global.statusAccountBot === "error") {
      throw new Error("GoatBot could not authenticate the supplied Facebook session");
    }
    await sleep(1000);
  }
  throw new Error("GoatBot did not become online after Facebook login");
}

function restoreAccountFile(accountPath, previousAccount, existed) {
  if (existed) {
    const tempPath = accountPath + ".recovery-rollback-" + process.pid + "-" + Date.now();
    try {
      fs.writeFileSync(tempPath, previousAccount, { mode: 0o600, flag: "wx" });
      fs.renameSync(tempPath, accountPath);
      try { fs.chmodSync(accountPath, 0o600); } catch {}
    } catch (error) {
      try { fs.unlinkSync(tempPath); } catch {}
      throw error;
    }
  } else {
    try { fs.unlinkSync(accountPath); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
  }
}

async function bootstrapFacebookLogin({ botId, cookie, progress = async () => {} }) {
  if (running) throw new Error("A Facebook login is already running");
  running = true;
  let candidateApi;
  let accountPath;
  let previousAccount;
  let accountExisted = false;
  let accountWasReplaced = false;
  try {
    if (typeof botId !== "string" || !/^\d{5,30}$/.test(botId)) {
      throw new Error("Invalid target Facebook account ID");
    }
    if (!global.GoatBot?.config || !global.GoatBot?.config.optionsFca) {
      throw new Error("GoatBot configuration is not ready; retry after startup");
    }

    const appState = secureSession.validateAppState(cookie, botId);
    await progress("validating", "Facebook cookie structure and account ID validated");

    candidateApi = await secureSession.loginCandidate(
      login,
      appState,
      Object.assign({}, global.GoatBot.config.optionsFca, {
        humanize: buildHumanizeOptions(global.GoatBot.config)
      })
    );
    if (String(candidateApi.getCurrentUserID()) !== botId) {
      throw new Error("Facebook login returned a different account ID");
    }
    await progress("authenticated", "Facebook credentials accepted; preparing GoatBot startup");

    // Close the isolated preflight session before creating GoatBot's production listener.
    try {
      await new Promise(resolve => {
        if (typeof candidateApi.stopListening !== "function") return resolve();
        let settled = false;
        const timer = setTimeout(() => {
          if (!settled) { settled = true; resolve(); }
        }, 5000);
        try {
          candidateApi.stopListening(() => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve();
          });
        } catch {
          if (!settled) { settled = true; clearTimeout(timer); resolve(); }
        }
      });
    } finally {
      try { candidateApi.stopSessionGuard?.(); } catch {}
    }
    candidateApi = null;

    // Keep the exact previous file so a failed normal startup can roll back safely.
    accountPath = path.join(process.cwd(), "account.txt");
    accountExisted = fs.existsSync(accountPath);
    if (accountExisted) previousAccount = fs.readFileSync(accountPath);

    secureSession.writeAppStateAtomic(accountPath, appState);
    accountWasReplaced = true;
    await progress("starting", "Session saved locally; starting the normal GoatBot login flow");

    if (typeof global.GoatBot?.reLoginBot !== "function") {
      throw new Error("GoatBot login handler is not ready; retry after startup");
    }

    // Clear stale state so an earlier account cannot satisfy the readiness check.
    global.statusAccountBot = "unknown";
    global.GoatBot.fcaApi = null;
    global.GoatBot.botID = null;
    global.GoatBot.Listening = null;
    global.botID = null;

    await global.GoatBot.reLoginBot();
    const onlineAccountId = await waitForBotOnline(botId);
    if (onlineAccountId !== botId) {
      throw new Error("GoatBot started with a different Facebook account");
    }
    accountWasReplaced = false;
    await progress("online", "Facebook account is online and the GoatBot listener is active");
    return { state: "online", message: "Facebook login completed" };
  } catch (error) {
    try { candidateApi?.stopListening?.(() => {}); } catch {}
    try { candidateApi?.stopSessionGuard?.(); } catch {}

    if (accountWasReplaced && accountPath) {
      try {
        // Stop any partially-created listener before restoring the previous credentials.
        const activeApi = global.GoatBot?.fcaApi;
        try { activeApi?.stopSessionGuard?.(); } catch {}
        try { activeApi?.stopListening?.(() => {}); } catch {}
        restoreAccountFile(accountPath, previousAccount, accountExisted);
        if (global.GoatBot) {
          global.GoatBot.fcaApi = null;
          global.GoatBot.Listening = null;
          global.GoatBot.botID = null;
        }
        global.botID = null;
        global.statusAccountBot = "unknown";
      } catch {
        throw new Error("Facebook login failed and the previous account file could not be restored; stop the bot and restore the saved account file before retrying");
      }
    }

    const message = String(error?.message || "Facebook login failed")
      .replace(/cookie|appstate|xs|c_user/ig, "[redacted]").slice(0, 220);
    throw new Error(message);
  } finally {
    running = false;
  }
}

module.exports = { bootstrapFacebookLogin };
