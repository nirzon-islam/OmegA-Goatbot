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

test("recovery worker can switch to a different target Bot ID without current-ID matching", async () => {
  const previous = global.GoatBot;
  global.GoatBot = { botID: "111111111111" };
  const calls = [];
  const targetId = "222222222222";
  const client = {
    async getQueue() { return { success: true, tasks: [] }; },
    async claim() { throw new Error("not used"); },
    async reportResult() { return { success: true }; },
    async claim() { throw new Error("task claim not used"); },
    async reportResult() { return { success: true }; },
    async claimRecovery(...args) {
      calls.push(["claimRecovery", args]);
      return { success: true, recovery: { requestId: "a".repeat(48), botId: targetId, cookie: '[{"key":"c_user","value":"' + targetId + '","domain":".facebook.com"},{"key":"xs","value":"secret","domain":".facebook.com"}]' } };
    },
    async reportRecoveryProgress(payload) { calls.push(["progress", payload]); },
    async reportRecoveryResult(payload) { calls.push(["result", payload]); }
  };
  let received;
  const worker = createWorker({ client, execute: async () => null, recoverSession: () => async payload => { received = payload; return { state: "online" }; } });
  try {
    const result = await worker.pollRecovery();
    assert.equal(result.success, true);
    assert.deepEqual(calls[0], ["claimRecovery", []]);
    assert.equal(received.botId, targetId);
    assert.equal(calls.at(-1)[1].botId, targetId);
  } finally {
    if (previous === undefined) delete global.GoatBot; else global.GoatBot = previous;
  }
});
