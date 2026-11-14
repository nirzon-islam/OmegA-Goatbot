"use strict";

const { executeApprovedAction } = require("./executor");

const MAX_RESULT_CHARS = 10000;

function createWorker({ client, execute = executeApprovedAction }) {
  if (!client || typeof client.getQueue !== "function" ||
      typeof client.claim !== "function" ||
      typeof client.reportResult !== "function" ||
      typeof execute !== "function") {
    throw new Error("Worker requires a Bridge client and executor");
  }

  async function processTask(taskId) {
    if (typeof taskId !== "string" || !taskId || taskId.length > 128) {
      throw new Error("Invalid queued task ID");
    }

    let claimed;
    try {
      const response = await client.claim(taskId);
      if (!response || response.success !== true || !response.task ||
          response.task.taskId !== taskId || !response.task.action ||
          response.task.type !== response.task.action.type) {
        throw new Error("Claim response does not match the queued task");
      }
      claimed = response.task;
    } catch (error) {
      // A failed claim is not an execution failure; it may already be claimed.
      if (error.status === 409) return { taskId, skipped: true, reason: "not_claimable" };
      throw error;
    }

    try {
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

  return Object.freeze({ pollOnce, processTask });
}

module.exports = { createWorker };
