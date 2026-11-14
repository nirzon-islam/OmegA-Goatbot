"use strict";

const LOCKED_AUTHOR = "NirZon";

const commandModule = {
  config: {
    name: "agent",
    aliases: ["aiagent"],
    version: "1.0.0",
    author: "NirZon",
    role: 2,
    shortDescription: "Submit a request to the secure Agent Backend",
    longDescription: "Queues a non-executable request for owner review and planning.",
    category: "owner",
    guide: "{pn} <request> | {pn} status <taskId>"
  },

  onStart: async function ({ message, args, event }) {
    const senderId = String(event?.senderID || message?.senderID || "");
    const allowedIds = (process.env.AGENT_ALLOWED_SENDER_IDS || "")
      .split(",").map(value => value.trim()).filter(Boolean);

    if (!senderId || !allowedIds.includes(senderId)) {
      return message.reply("⛔ এই Agent command ব্যবহারের অনুমতি নেই।");
    }

    const description = Array.isArray(args) ? args.join(" ").trim() : "";
    if (args?.[0]?.toLowerCase() === "status" && typeof args[1] === "string") {
      if (process.env.AGENT_BRIDGE_ENABLED !== "true") return message.reply("⚠️ Agent Bridge এখন বন্ধ আছে।");
      try {
        const { createBridgeClient } = require("../../agent-bridge/client");
        const status = await createBridgeClient().getRequestStatus(senderId, args[1]);
        const task = status.task;
        return message.reply("📋 Task: " + task.taskId + "\nStatus: " + task.status + (task.error ? "\nReason: " + task.error : "") + (task.result ? "\nResult: " + task.result : ""));
      } catch (error) {
        return message.reply("❌ Task status পাওয়া যায়নি। Task ID পরীক্ষা করুন।");
      }
    }
    if (description.length < 3 || description.length > 2000) {
      return message.reply("ব্যবহার: !agent <কী কাজ করতে হবে লিখুন>");
    }

    if (process.env.AGENT_BRIDGE_ENABLED !== "true") {
      return message.reply("⚠️ Agent Bridge এখন বন্ধ আছে।");
    }

    try {
      const { createBridgeClient } = require("../../agent-bridge/client");
      const client = createBridgeClient();
      const response = await client.submitRequest(senderId, description);

      return message.reply(
        "✅ Request backend-এ জমা হয়েছে।\n" +
        "Task: " + response.task.taskId + "\n" +
        "Status: " + response.task.status + "\n" +
        "এটি এখনো শুধু request—Owner approval ছাড়া কোনো file change বা execution হবে না।"
      );
    } catch (error) {
      console.error("[AGENT COMMAND]", error.message);
      return message.reply("❌ Agent request পাঠানো যায়নি। Backend/Bridge configuration পরীক্ষা করুন।");
    }
  }
};

if (commandModule.config.author !== LOCKED_AUTHOR) {
  throw new Error("[agent] Author lock mismatch");
}

module.exports = commandModule;
