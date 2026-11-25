"use strict";

let running = false;
const secureSession = require("../bot/login/secureSession");

function waitForBotOnline(botId, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(() => {
      const currentId = String(global.GoatBot?.botID || global.botID || "");
      const ready = global.statusAccountBot === "good" &&
        currentId === String(botId) &&
        Boolean(global.GoatBot?.fcaApi && global.GoatBot?.Listening);
      if (ready) {
        clearInterval(timer);
        resolve({ state: "online", message: "Facebook login and MQTT listener are ready" });
        return;
      }
      if (global.statusAccountBot === "can't login" || global.statusAccountBot === "login failed") {
        clearInterval(timer);
        reject(new Error("Facebook login failed; check the sanitized Railway login log"));
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        clearInterval(timer);
        reject(new Error("Facebook login did not become ready before timeout"));
      }
    }, 500);
    if (typeof timer.unref === "function") timer.unref();
  });
}

async function bootstrapFacebookLogin({ botId, cookie, progress = async () => {} }) {
  if (running) throw new Error("A Facebook recovery is already running");
  running = true;
  let previousAccount;
  const accountPath = require("path").join(process.cwd(), "account.txt");
  let accountReplaced = false;
  try {
    if (typeof botId !== "string" || !/^\d{5,30}$/.test(botId)) {
      throw new Error("Invalid target Facebook account ID");
    }
    const appState = secureSession.validateAppState(cookie, botId);

    // Once the normal login runtime has installed its candidate-first handler,
    // always use it for account switching so the active MQTT listener is preserved.
    const currentHandler = global.GoatBot?.recoverFacebookSession;
    if (typeof currentHandler === "function" &&
        currentHandler !== bootstrapFacebookLogin &&
        currentHandler.isBootstrap !== true) {
      return await currentHandler({ botId, cookie, progress });
    }

    // First login has no active listener to preserve. Persist the validated
    // appstate, then let the normal GoatBot startup login initialize all handlers.
    if (global.GoatBot?.fcaApi || global.GoatBot?.Listening) {
      throw new Error("Facebook recovery handler is still initializing; retry shortly");
    }
    if (typeof global.GoatBot?.reLoginBot !== "function") {
      throw new Error("GoatBot login handler is not ready; retry after startup");
    }
    try { previousAccount = require("fs").readFileSync(accountPath); } catch {}
    await progress("validating", "Appstate identity and cookie structure validated");
    secureSession.writeAppStateAtomic(accountPath, appState);
    accountReplaced = true;
    global.statusAccountBot = "unknown";
    await progress("login_started", "Starting the first Facebook login through GoatBot runtime");
    await global.GoatBot.reLoginBot();
    const result = await waitForBotOnline(botId);
    await progress("online", "Facebook login and MQTT listener are ready");
    return result;
  } catch (error) {
    if (accountReplaced && previousAccount && !(global.statusAccountBot === "good" &&
        String(global.GoatBot?.botID || global.botID || "") === String(botId))) {
      const fs = require("fs");
      const temp = accountPath + ".recovery-rollback-" + process.pid + "-" + Date.now();
      try {
        fs.writeFileSync(temp, previousAccount, { flag: "wx", mode: 0o600 });
        fs.renameSync(temp, accountPath);
        try { fs.chmodSync(accountPath, 0o600); } catch {}
      } catch {
        try { fs.unlinkSync(temp); } catch {}
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
