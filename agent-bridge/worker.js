"use strict";

const { executeApprovedAction } = require("./executor");

const MAX_RESULT_CHARS = 600 * 1024;

function createWorker({ client, execute = executeApprovedAction, recoverSession = () => global.GoatBot && global.GoatBot.recoverFacebookSession }) {
  if (!client || typeof client.getQueue !== "function" ||
      typeof client.claim !== "function" ||
      typeof client.reportResult !== "function" ||
      typeof execute !== "function" || typeof recoverSession !== "function") {
    throw new Error("Worker requires a Bridge client and executor");
  }

  async function processTask(taskId) {
    if (typeof taskId !== "string" || !taskId || taskId.length > 128) {
      throw new Error("Invalid queued task ID");
    }

    let response;
    try {
      response = await client.claim(taskId);
    } catch (error) {
      if (error.status === 409) return { taskId, skipped: true, reason: "not_claimable" };
      throw error;
    }

    const claimed = response && response.task;
    try {
      if (!response || response.success !== true || !claimed ||
          claimed.taskId !== taskId || !claimed.action ||
          claimed.type !== claimed.action.type) {
        throw new Error("Claim response does not match the queued task");
      }

      const value = await execute(claimed.action);
      const serialized = typeof value === "string" ? value : JSON.stringify(value);
      await client.reportResult({
        taskId,
        success: true,
        result: String(serialized ?? "Completed").slice(0, MAX_RESULT_CHARS)
      });
      return { taskId, success: true };
    } catch (error) {
      const message = String(error && error.message || "Execution failed").slice(0, 2000);
      await client.reportResult({ taskId, success: false, error: message });
      return { taskId, success: false, error: message };
    }
  }

  // Claim the next owner-approved account switch, regardless of the worker's current Bot ID.
  let recoveryRunning = false;
  async function pollRecovery() {
    if (recoveryRunning) return { skipped: true, reason: "recovery_busy" };
    const handler = recoverSession();
    if (typeof handler !== "function" || typeof client.claimRecovery !== "function" ||
        typeof client.reportRecoveryProgress !== "function" || typeof client.reportRecoveryResult !== "function") {
      return { skipped: true, reason: "recovery_handler_unavailable" };
    }
    recoveryRunning = true;
    let handoff;
    let botId = "";
    try {
      const response = await client.claimRecovery();
      handoff = response && response.recovery;
      if (!handoff) return { skipped: true, reason: "no_pending_recovery" };
      botId = String(handoff.botId || "");
      if (!/^\d{5,30}$/.test(botId) || typeof handoff.requestId !== "string" ||
          !/^[a-f0-9]{48}$/.test(handoff.requestId) || typeof handoff.cookie !== "string" ||
          !handoff.cookie.startsWith("[")) {
        throw new Error("Recovery handoff validation failed");
      }
      const requestId = handoff.requestId;
      const progress = (state, message) => client.reportRecoveryProgress({ requestId, botId, state, message });
      await progress("validating", "Worker received appstate; validating target account");
      await progress("login_started", "Starting isolated Facebook session login");
      const result = await handler({ requestId, botId, cookie: handoff.cookie, progress });
      if (!result || result.state !== "online") {
        const state = result && result.state === "checkpoint" ? "checkpoint" : "error";
        const message = String(result && result.message || "Facebook session did not become ready").slice(0, 240);
        await progress(state, message);
        await client.reportRecoveryResult({ botId, state, message });
        return { requestId, success: false, state };
      }
      await progress("online", "Facebook MQTT listener is ready");
      await client.reportRecoveryResult({ botId, state: "online", message: "Facebook session restored" });
      return { requestId, success: true, state: "online" };
    } catch (error) {
      if (handoff && handoff.requestId && botId) {
        const message = String(error && error.message || "Recovery failed").replace(/cookie|appstate|xs|c_user/ig, "[redacted]").slice(0, 240);
        const state = /checkpoint|two.factor|two-factor|approvals_code|challenge_required|security.?check|login_blocked/i.test(message)
          ? "checkpoint" : "error";
        await client.reportRecoveryProgress({ requestId: handoff.requestId, botId, state, message }).catch(() => {});
        await client.reportRecoveryResult({ botId, state, message }).catch(() => {});
        return { success: false, state, error: "Recovery failed; see the sanitized recovery timeline" };
      }
      return { success: false, error: "Recovery failed; see the sanitized recovery timeline" };
    } finally { handoff = null; recoveryRunning = false; }
  }

  async function pollOnce(limit = 5) {
    const queue = await client.getQueue(limit);
    if (!queue || queue.success !== true || !Array.isArray(queue.tasks)) {
      throw new Error("Invalid Bridge queue response");
    }
    const results = [];
    for (const task of queue.tasks) {
      if (!task || typeof task.taskId !== "string") continue;
      results.push(await processTask(task.taskId));
    }
    return results;
  }

  return Object.freeze({ pollOnce, processTask, pollRecovery });
}

module.exports = { createWorker };
