"use strict";

/**
 * OmegA-FCA command controller for GoatBot.
 *
 * Runtime contract:
 *   global.OmegaFCA = {
 *     client: <OmegA-FCA client>,
 *     api: <connected OmegA-FCA API facade> // optional; populated after login
 *   };
 *
 * This command deliberately does not use GoatBot's own Facebook API as a
 * substitute for OmegA-FCA. The FCA transport must be initialized separately.
 */

const HELP = [
  "╭━━〔 OmegA-FCA CONTROL 〕━━╮",
  "┃ .facebook status",
  "┃ .facebook help",
  "┃ .facebook logout",
  "┃ .facebook profile <UID>",
  "┃ .facebook threads",
  "┃ .facebook thread <THREAD_ID>",
  "┃ .facebook friends",
  "┃ .facebook send <THREAD_ID> | <MESSAGE>",
  "┃ .facebook react <MESSAGE_ID> | <EMOJI>",
  "┃ .facebook read <THREAD_ID>",
  "╰━━━━━━━━━━━━━━━━━━━━━━╯",
  "",
  "Login and browsing commands become available when the OmegA-FCA",
  "transport is installed and initialized in the bot runtime."
].join("\n");

function getRuntime() {
  const runtime = global.OmegaFCA;
  if (!runtime || typeof runtime !== "object") return null;
  return runtime;
}

function getApi(runtime) {
  return runtime && runtime.api && typeof runtime.api === "object"
    ? runtime.api
    : null;
}

function clean(value, max = 1500) {
  if (value == null) return "N/A";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return String(text).slice(0, max);
}

function parsePipe(input) {
  const index = input.indexOf("|");
  if (index < 0) return null;
  const left = input.slice(0, index).trim();
  const right = input.slice(index + 1).trim();
  return left && right ? [left, right] : null;
}

async function invoke(api, method, args) {
  if (!api || typeof api[method] !== "function") {
    throw new Error("This operation is not available in the current OmegA-FCA transport.");
  }
  return api[method](...args);
}

module.exports = {
  config: {
    name: "facebook",
    aliases: ["fb", "omegafca"],
    version: "0.1.0",
    author: "OmegA",
    description: "Control the separate OmegA-FCA session",
    category: "system",
    cooldowns: 3
  },

  onStart: async function ({ api: goatApi, event, args }) {
    const action = String(args[0] || "help").toLowerCase();
    const rest = args.slice(1).join(" ").trim();
    const runtime = getRuntime();
    const fcaApi = getApi(runtime);

    const reply = message => goatApi.sendMessage(
      String(message),
      event.threadID,
      event.messageID
    );

    if (action === "help" || action === "menu") return reply(HELP);

    if (action === "status") {
      if (!runtime) {
        return reply("❌ OmegA-FCA runtime is not initialized.\nThe separate FCA transport integration is required.");
      }
      const client = runtime.client;
      let state = "runtime loaded; not connected";
      try {
        const snapshot = client && typeof client.getConnectionState === "function"
          ? client.getConnectionState()
          : null;
        if (snapshot) state = clean(snapshot, 500);
      } catch (_) {}
      return reply("〔 OmegA-FCA STATUS 〕\n" + state);
    }

    if (action === "logout") {
      if (!runtime || !runtime.client || typeof runtime.client.logout !== "function") {
        return reply("❌ OmegA-FCA client is not initialized.");
      }
      await runtime.client.logout();
      runtime.api = null;
      return reply("✅ OmegA-FCA session disconnected.");
    }

    if (!fcaApi) {
      return reply("❌ OmegA-FCA is not connected. This command does not reuse the bot's own Facebook session. Install and initialize the separate FCA transport first.");
    }

    try {
      switch (action) {
        case "profile": {
          if (!rest) return reply("Usage: .facebook profile <UID>");
          const result = await invoke(fcaApi, "getUserInfo", [rest]);
          return reply("〔 PROFILE 〕\n" + clean(result));
        }
        case "threads": {
          const result = await invoke(fcaApi, "getThreadList", [20, null, []]);
          return reply("〔 THREADS 〕\n" + clean(result));
        }
        case "thread": {
          if (!rest) return reply("Usage: .facebook thread <THREAD_ID>");
          const result = await invoke(fcaApi, "getThreadInfo", [rest]);
          return reply("〔 THREAD INFO 〕\n" + clean(result));
        }
        case "friends": {
          const result = await invoke(fcaApi, "getFriendsList", []);
          return reply("〔 FRIENDS 〕\n" + clean(result));
        }
        case "send": {
          const pair = parsePipe(rest);
          if (!pair) return reply("Usage: .facebook send <THREAD_ID> | <MESSAGE>");
          const result = await invoke(fcaApi, "sendMessage", [pair[1], pair[0]]);
          return reply("✅ Message request sent.\n" + clean(result, 400));
        }
        case "react": {
          const pair = parsePipe(rest);
          if (!pair) return reply("Usage: .facebook react <MESSAGE_ID> | <EMOJI>");
          const result = await invoke(fcaApi, "setMessageReaction", [pair[1], pair[0]]);
          return reply("✅ Reaction request sent.\n" + clean(result, 400));
        }
        case "read": {
          if (!rest) return reply("Usage: .facebook read <THREAD_ID>");
          const result = await invoke(fcaApi, "markAsRead", [rest]);
          return reply("✅ Mark-as-read request sent.\n" + clean(result, 400));
        }
        default:
          return reply("Unknown action: " + action + "\n\n" + HELP);
      }
    } catch (error) {
      console.error("[OmegA-FCA Facebook command]", error && error.message);
      return reply("❌ " + clean(error && error.message, 500));
    }
  }
};
