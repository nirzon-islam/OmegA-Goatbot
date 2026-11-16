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

async function waitForBotOnline(timeoutMs = 90000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const accountId = String(global.GoatBot?.botID || global.botID || "");
    if (global.statusAccountBot === "good" &&
        global.GoatBot?.fcaApi &&
        global.GoatBot?.Listening &&
        /^\\d{5,30}$/.test(accountId)) {
      return accountId;
    }
    if (global.statusAccountBot === "checkpoint") {
      throw new Error("Facebook checkpoint requires manual completion");
    }
    await sleep(1000);
  }
  throw new Error("GoatBot did not become online after Facebook login");
}

async function bootstrapFacebookLogin({ botId, cookie, progress = async () => {} }) {
  if (running) throw new Error("A Facebook login is already running");
  running = true;
  let candidateApi;
  try {
    if (typeof botId !== "string" || !/^\\d{5,30}$/.test(botId)) {
      throw new Error("Invalid target Facebook account ID");
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
      throw new Error("Facebook returned a different account ID");
    }
    await progress("authenticated", "Facebook credentials accepted; preparing GoatBot startup");

    // This is a preflight login only. Stop its temporary API before the regular
    // GoatBot startup creates the single production MQTT listener.
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
      try { candidateApi.stopSessionGuard?.(); } catch {}
    } catch {}

    const accountPath = path.join(process.cwd(), "account.txt");
    secureSession.writeAppStateAtomic(accountPath, appState);
    await progress("starting", "Session saved locally; starting the normal GoatBot login flow");

    if (typeof global.GoatBot?.reLoginBot !== "function") {
      throw new Error("GoatBot login handler is not ready; retry after startup");
    }
    await global.GoatBot.reLoginBot();
    const onlineAccountId = await waitForBotOnline();
    if (onlineAccountId !== botId) {
      throw new Error("GoatBot started with a different Facebook account");
    }
    await progress("online", "Facebook account is online and the GoatBot listener is active");
    return { state: "online", message: "Facebook login completed" };
  } catch (error) {
    try { candidateApi?.stopListening?.(() => {}); } catch {}
    try { candidateApi?.stopSessionGuard?.(); } catch {}
    const message = String(error?.message || "Facebook login failed")
      .replace(/cookie|appstate|xs|c_user/ig, "[redacted]").slice(0, 220);
    throw new Error(message);
  } finally {
    running = false;
  }
}

module.exports = { bootstrapFacebookLogin };
