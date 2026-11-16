"use strict";

const commandModule = {
  config: {
    name: "agent",
    aliases: ["aiagent"],
    version: "1.0.4",
    author: "NirZon",
    role: 2,
    shortDescription: "Submit a request to the secure Agent Backend",
    longDescription: "Queues a non-executable request for owner review and planning.",
    category: "owner",
    guide: "{pn} <request> | {pn} pending | {pn} approve <taskId> | {pn} reject <taskId> | {pn} status <taskId>"
  },

  onStart: async function ({ message, args, event }) {
    const senderId = String(event?.senderID || message?.senderID || "");
    const allowedIds = (process.env.AGENT_ALLOWED_SENDER_IDS || "")
      .split(",").map(value => value.trim()).filter(Boolean);
    const ownerIds = (process.env.AGENT_OWNER_SENDER_IDS || "")
      .split(",").map(value => value.trim()).filter(Boolean);

    if (!senderId || (!allowedIds.includes(senderId) && !ownerIds.includes(senderId))) {
      return message.reply("⛔ এই Agent command ব্যবহারের অনুমতি নেই।");
    }
    if (process.env.AGENT_BRIDGE_ENABLED !== "true") {
      return message.reply("⚠️ Agent Bridge এখন বন্ধ আছে।");
    }

    const command = String(args?.[0] || "").toLowerCase();
    const reference = typeof args?.[1] === "string" ? args[1].trim() : "";
    const { createBridgeClient } = require("../../agent-bridge/client");
    const client = createBridgeClient();

    try {
      if (command === "pending") {
        if (!ownerIds.includes(senderId)) return message.reply("⛔ শুধু Owner pending approval দেখতে পারবেন।");
        const response = await client.getPendingApprovals(senderId);
        const approvals = response.approvals || [];
        if (!approvals.length) return message.reply("📭 কোনো pending Messenger approval নেই।");
        const lines = approvals.map((item, index) =>
          (index + 1) + ". Task: " + item.taskId +
          "\nApproval: " + item.approvalId +
          "\nType: " + item.actionType +
          "\nRequest: " + item.description +
          "\nApprove: !agent approve " + item.taskId +
          "\nReject: !agent reject " + item.taskId
        );
        return message.reply("🛡️ Pending approvals (" + approvals.length + ")\n\n" + lines.join("\n\n"));
      }

      if (command === "approve" || command === "reject") {
        if (!ownerIds.includes(senderId)) return message.reply("⛔ শুধু Owner approval/rejection দিতে পারবেন।");
        if (!reference) return message.reply("ব্যবহার: !agent " + command + " <taskId>");
        const response = command === "approve"
          ? await client.approveRequest(senderId, reference)
          : await client.rejectRequest(senderId, reference);
        return message.reply(
          (command === "approve" ? "✅ Approved" : "❌ Rejected") +
          "\nTask: " + response.approval.taskId +
          "\nStatus: " + response.approval.status
        );
      }

      if (command === "status" && reference) {
        const status = await client.getRequestStatus(senderId, reference);
        const task = status.task;
        return message.reply("📋 Task: " + task.taskId + "\nStatus: " + task.status +
          (task.error ? "\nReason: " + task.error : "") +
          (task.result ? "\nResult: " + task.result : ""));
      }

      const description = Array.isArray(args) ? args.join(" ").trim() : "";
      if (description.length < 3 || description.length > 2000) {
        return message.reply(
          "ব্যবহার: !agent <request> | !agent pending | !agent approve <taskId> | " +
          "!agent reject <taskId> | !agent status <taskId>"
        );
      }

      try {
        await message.reply("⏳ Processing... Please wait!");
      } catch (replyError) {
        console.error("[AGENT WAITING REPLY]", replyError.message);
      }

      const response = await client.submitRequest(senderId, description);
      return message.reply(
        "✅ Request backend-এ জমা হয়েছে।\n" +
        "Task: " + response.task.taskId + "\n" +
        "Status: " + response.task.status + "\n" +
        "Owner Messenger থেকে !agent pending দিয়ে approval দিতে পারবেন।"
      );
    } catch (error) {
      console.error("[AGENT COMMAND]", error.message);
      return message.reply("❌ Agent request/approval সম্পন্ন হয়নি। Backend/Bridge configuration পরীক্ষা করুন।");
    }
  }
};

const _0x4a = require("crypto");
const _0x7c = [
  "85b6ca8d85faa5700d81348270a92ca2",
  "419c55f59ad7b15b24ee3c34942b0b8b"
].join("");

if (
  _0x4a.createHash("sha256").update(String(commandModule.config.author || "")).digest("hex") !== _0x7c
) {
  throw new Error("[agent] Module integrity verification failed.");
}

module.exports = commandModule;
