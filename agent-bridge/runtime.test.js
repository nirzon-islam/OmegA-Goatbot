"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { getDefaultAccountStatus } = require("./runtime");

test("Bridge reports detailed Facebook checkpoint after recovery rollback", () => {
  const previous = {
    status: global.statusAccountBot,
    detail: global.facebookSessionStatus,
    goatBot: global.GoatBot,
    botID: global.botID
  };
  try {
    global.statusAccountBot = "unknown";
    global.facebookSessionStatus = {
      state: "checkpoint",
      message: "Facebook security checkpoint detected. Complete verification manually."
    };
    global.GoatBot = { botID: "123456789" };
    const status = getDefaultAccountStatus();
    assert.equal(status.state, "checkpoint");
    assert.match(status.message, /Complete verification manually/);
    assert.equal(status.accountId, "123456789");
  } finally {
    if (previous.status === undefined) delete global.statusAccountBot;
    else global.statusAccountBot = previous.status;
    if (previous.detail === undefined) delete global.facebookSessionStatus;
    else global.facebookSessionStatus = previous.detail;
    if (previous.goatBot === undefined) delete global.GoatBot;
    else global.GoatBot = previous.goatBot;
    if (previous.botID === undefined) delete global.botID;
    else global.botID = previous.botID;
  }
});

test("Bridge keeps normal online status authoritative over stale recovery detail", () => {
  const previousStatus = global.statusAccountBot;
  const previousDetail = global.facebookSessionStatus;
  try {
    global.statusAccountBot = "good";
    global.facebookSessionStatus = { state: "checkpoint", message: "Old checkpoint" };
    const status = getDefaultAccountStatus();
    assert.equal(status.state, "online");
    assert.equal(status.message, "Old checkpoint");
  } finally {
    if (previousStatus === undefined) delete global.statusAccountBot;
    else global.statusAccountBot = previousStatus;
    if (previousDetail === undefined) delete global.facebookSessionStatus;
    else global.facebookSessionStatus = previousDetail;
  }
});
