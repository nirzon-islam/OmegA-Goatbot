"use strict";

let running = false;

async function bootstrapFacebookLogin({ botId, cookie, progress = async () => {} }) {
  if (running) throw new Error("A Facebook login is already running");
  running = true;
  try {
    if (typeof botId !== "string" || !/^\d{5,30}$/.test(botId)) {
      throw new Error("Invalid target Facebook account ID");
    }
    if (!global.GoatBot?.config || !global.GoatBot?.config.optionsFca) {
      throw new Error("GoatBot configuration is not ready; retry after startup");
    }
    if (typeof global.GoatBot.recoverFacebookSession !== "function") {
      throw new Error("Safe Facebook recovery is not ready; retry after GoatBot startup");
    }

    // Candidate-first recovery keeps the active MQTT listener alive until the
    // replacement account has authenticated and its listener is ready.
    const result = await global.GoatBot.recoverFacebookSession({
      botId,
      cookie,
      progress
    });
    global.facebookSessionStatus = {
      state: "online",
      accountId: botId,
      message: result?.message || "Facebook session active",
      changedAt: Date.now()
    };
    return result || { state: "online", message: "Facebook login completed" };
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
    throw new Error(safeMessage);
  } finally {
    running = false;
  }
}

bootstrapFacebookLogin.isBootstrap = true;

module.exports = { bootstrapFacebookLogin };
