const fs = require("fs-extra");
const path = __dirname + "/cache/autoseen.json";

if (!fs.existsSync(path)) {
  fs.writeFileSync(path, JSON.stringify({ status: true }, null, 2));
}

const seenQueue = [];
const queuedThreads = new Set();
let isProcessingQueue = false;

function randomDelay(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function isEnabled() {
  try {
    const data = fs.readJsonSync(path, { throws: false });
    return !data || data.status !== false;
  } catch {
    return false;
  }
}

async function processSeenQueue() {
  if (isProcessingQueue) return;
  isProcessingQueue = true;

  try {
    while (seenQueue.length > 0) {
      const item = seenQueue.shift();
      await new Promise((resolve) => setTimeout(resolve, randomDelay(1500, 4000)));

      // Re-check the toggle after the delay so "off" cancels pending reads.
      if (isEnabled() && item.api && typeof item.api.markAsRead === "function") {
        try {
          await item.api.markAsRead(item.threadID);
        } catch (err) {
          console.error("AUTOSEEN markAsRead failed:", err && err.message ? err.message : err);
        }
      }

      queuedThreads.delete(item.threadID);
      if (seenQueue.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, randomDelay(800, 2000)));
      }
    }
  } finally {
    isProcessingQueue = false;
    if (seenQueue.length > 0) processSeenQueue();
  }
}

function box(title, rows, footer) {
  const lines = [`╭─‣ ${title} 〄`];
  rows.forEach(r => lines.push(`├‣ ${r}`));
  lines.push("╰────────────◊");
  lines.push(` ${footer}`);
  return lines.join("\n");
}

function status(val) {
  return val ? "ON ✦" : "OFF ◌";
}

module.exports = {
  config: {
    name: "autoseen",
    version: "2.2",
    author: "OmegA",
    countDown: 0,
    role: 0,
    shortDescription: "Automatic seen system",
    longDescription: "Bot automatically marks new messages as seen, one at a time with a delay.",
    category: "system",
    guide: {
      en: "{pn} on/off",
    },
  },

  onStart: async function ({ message, args }) {
    const data = JSON.parse(fs.readFileSync(path));

    if (!args[0]) {
      return message.reply(box("AUTOSEEN", [
        `Status : ${status(data.status)}`
      ], "Reply \"on\" or \"off\" to change"));
    }

    if (args[0].toLowerCase() === "on") {
      data.status = true;
      fs.writeFileSync(path, JSON.stringify(data, null, 2));
      return message.reply(box("AUTOSEEN", [
        "Status : ON ✦"
      ], "Autoseen is now enabled"));
    } else if (args[0].toLowerCase() === "off") {
      data.status = false;
      fs.writeFileSync(path, JSON.stringify(data, null, 2));
      return message.reply(box("AUTOSEEN", [
        "Status : OFF ◌"
      ], "Autoseen is now disabled"));
    } else {
      return message.reply("⚠️ Usage: autoseen on / off");
    }
  },

  // Marks messages as seen, but not instantly and not all at once —
  // queued and processed one at a time with a randomized delay.
  onChat: async function ({ event, api }) {
    try {
      // Read receipts are not applicable to E2EE, typing, or presence events.
      if (!event || event.isE2EE || event.type === "typ" || event.type === "presence") return;
      if (!event.threadID || !api || typeof api.markAsRead !== "function") return;

      if (!isEnabled()) return;
      if (queuedThreads.has(event.threadID)) return;

      queuedThreads.add(event.threadID);
      seenQueue.push({ threadID: event.threadID, api });
      processSeenQueue();
    } catch (e) {
      console.error("AUTOSEEN queue failed:", e && e.message ? e.message : e);
    }
  },
};
