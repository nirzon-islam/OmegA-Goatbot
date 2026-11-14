"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createWorker } = require("./worker");

test("worker claims approved tasks, executes and reports serialized results", async () => {
  const calls = [];
  const client = {
    async getQueue(limit) { calls.push(["queue", limit]); return { success: true, tasks: [{ taskId: "t-1" }] }; },
    async claim(taskId) { calls.push(["claim", taskId]); return { success: true, task: { taskId, type: "edit", action: { type: "edit" } } }; },
    async reportResult(payload) { calls.push(["result", payload]); return { success: true }; }
  };
  const worker = createWorker({ client, execute: async () => ({ written: true }) });
  const result = await worker.pollOnce(3);
  assert.deepEqual(result, [{ taskId: "t-1", success: true }]);
  assert.deepEqual(calls[0], ["queue", 3]);
  assert.deepEqual(calls[1], ["claim", "t-1"]);
  assert.deepEqual(calls[2], ["result", { taskId: "t-1", success: true, result: '{"written":true}' }]);
});

test("worker reports executor failures and skips already-claimed tasks", async () => {
  const reports = [];
  const client = {
    async getQueue() { return { success: true, tasks: [] }; },
    async claim() { const error = new Error("conflict"); error.status = 409; throw error; },
    async reportResult(payload) { reports.push(payload); }
  };
  const worker = createWorker({ client, execute: async () => { throw new Error("blocked path"); } });
  assert.deepEqual(await worker.processTask("t-2"), { taskId: "t-2", skipped: true, reason: "not_claimable" });
  assert.equal(reports.length, 0);
});

test("worker refuses task/action type mismatch and reports it as failure", async () => {
  const reports = [];
  const client = {
    async getQueue() { return { success: true, tasks: [] }; },
    async claim(taskId) { return { success: true, task: { taskId, type: "delete", action: { type: "edit" } } }; },
    async reportResult(payload) { reports.push(payload); }
  };
  const worker = createWorker({ client, execute: async () => "should not run" });
  const result = await worker.processTask("t-3");
  assert.equal(result.success, false);
  assert.match(reports[0].error, /does not match/);
});
