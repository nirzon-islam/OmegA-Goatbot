"use strict";

const path = require("path");
const fs = require("fs");
const { loadFcaProvider, buildFcaLoginOptions } = require("../bot/login/fcaProvider");
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

    const fcaProvider = loadFcaProvider(global.GoatBot.config);
    await progress("provider_ready", "Using " + fcaProvider.packageName + " v" + fcaProvider.version);
    const loginOptions = buildFcaLoginOptions(global.GoatBot.config, botId);
    loginOptions.humanize = buildHumanizeOptions(global.GoatBot.config);
    candidateApi = await secureSession.loginCandidate(
      fcaProvider.login,
      appState,
      loginOptions
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
    global.facebookSessionStatus = {
      state: "unknown",
      accountId: botId,
      message: "Facebook recovery is in progress; session status is not yet verified",
      changedAt: Date.now()
    };
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
    global.facebookSessionStatus = {
      state: "online",
      accountId: botId,
      message: "Facebook session active",
      changedAt: Date.now()
    };
    await progress("online", "Facebook account is online and the GoatBot listener is active");
    return { state: "online", message: "Facebook login completed" };
  } catch (error) {
    const rawMessage = String(error?.message || "Facebook login failed");
    const checkpoint = /checkpoint|two.factor|two-factor|approvals_code|challenge_required|security.?check|login_blocked/i.test(rawMessage);
    const safeMessage = rawMessage.replace(/cookie|appstate|xs|c_user/ig, "[redacted]").slice(0, 220);
    if (checkpoint) {
      global.statusAccountBot = "checkpoint";
      global.facebookSessionStatus = {
        state: "checkpoint",
        accountId: botId,
        message: "Facebook security checkpoint detected. Complete verification manually. " + safeMessage,
        changedAt: Date.now()
      };
    }
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
        // Preserve a detected Facebook checkpoint so the Bridge can report it after rollback.
        global.statusAccountBot = checkpoint ? "checkpoint" : "unknown";
      } catch {
        throw new Error("Facebook login failed and the previous account file could not be restored; stop the bot and restore the saved account file before retrying");
      }
    }

    throw new Error(safeMessage);
  } finally {
    running = false;
  }
}

module.exports = { bootstrapFacebookLogin };
