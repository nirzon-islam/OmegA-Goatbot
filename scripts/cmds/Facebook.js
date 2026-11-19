"use strict";

/**
 * GoatBot command surface for the separate OmegA-FCA runtime.
 * The runtime is installed by the FCA bootstrap, never by borrowing GoatBot's
 * own Facebook session:
 *   global.OmegaFCA = { client, api, login? }
 * login() must use an already provisioned secure credential/session provider;
 * credentials and cookies are intentionally not accepted in chat messages.
 */

const HELP = [
  "╭━━〔 OmegA-FCA CONTROL 〕━━╮",
  "┃ .facebook status",
  "┃ .facebook login",
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
  "Login requires a secure credential provider configured by the FCA runtime.",
  "Cookies/passwords are never accepted in group chat."
].join("\n");

function getRuntime() {
  const runtime = global.OmegaFCA;
  return runtime && typeof runtime === "object" ? runtime : null;
}

function clean(value, max = 1500) {
  if (value == null) return "N/A";
  let output;
  try {
    output = typeof value === "string" ? value : JSON.stringify(value);
  } catch {
    output = "[unserializable response]";
  }
  return String(output).slice(0, max);
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
    const error = new Error("This operation is not available in the installed OmegA-FCA transport.");
    error.code = "FCA_METHOD_UNAVAILABLE";
    throw error;
  }
  return api[method](...args);
}

module.exports = {
  config: {
    name: "facebook",
    aliases: ["fb", "omegafca"],
    version: "0.1.1",
    author: "OmegA",
    description: "Control the separate OmegA-FCA session",
    category: "system",
    cooldowns: 3
  },

  onStart: async function ({ api: goatApi, event, args = [] }) {
    const action = String(args[0] || "help").toLowerCase();
    const rest = args.slice(1).join(" ").trim();
    const runtime = getRuntime();
    const fcaApi = runtime && runtime.api;

    const reply = message => goatApi.sendMessage(
      String(message),
      event.threadID,
      event.messageID
    );

    if (action === "help" || action === "menu") return reply(HELP);

    if (action === "login") {
      if (!runtime || typeof runtime.login !== "function") {
        return reply("❌ Secure OmegA-FCA login provider is not configured. No credentials were collected from chat.");
      }
      try {
        await runtime.login();
        return reply("✅ OmegA-FCA login flow completed.");
      } catch (error) {
        console.error("[OmegA-FCA login]", error && error.message);
        return reply("❌ Login failed: " + clean(error && error.message, 400));
      }
    }

    if (action === "status") {
      if (!runtime) return reply("❌ OmegA-FCA runtime is not initialized.");
      let state = "runtime loaded; not connected";
      try {
        const snapshot = runtime.client && typeof runtime.client.getConnectionState === "function"
          ? runtime.client.getConnectionState()
          : null;
        if (snapshot) state = clean(snapshot, 500);
      } catch (error) {
        state = "status unavailable: " + clean(error.message, 200);
      }
      const identity = fcaApi && typeof fcaApi.getCurrentUserID === "function"
        ? "\nVerified session ID: " + clean(fcaApi.getCurrentUserID(), 80)
        : "";
      return reply("〔 OmegA-FCA STATUS 〕\n" + state + identity);
    }

    if (action === "logout") {
      if (!runtime || !runtime.client || typeof runtime.client.logout !== "function") {
        return reply("❌ OmegA-FCA client is not initialized.");
      }
      try {
        await runtime.client.logout();
        runtime.api = null;
        return reply("✅ OmegA-FCA session disconnected.");
      } catch (error) {
        console.error("[OmegA-FCA logout]", error && error.message);
        return reply("❌ Logout failed: " + clean(error && error.message, 400));
      }
    }

    if (!fcaApi) {
      return reply("❌ OmegA-FCA is not connected. Run .facebook login after configuring its secure login provider.");
    }

    try {
      switch (action) {
        case "profile": {
          if (!rest) return reply("Usage: .facebook profile <UID>");
          return reply("〔 PROFILE 〕\n" + clean(await invoke(fcaApi, "getUserInfo", [rest])));
        }
        case "threads":
          return reply("〔 THREADS 〕\n" + clean(await invoke(fcaApi, "getThreadList", [20, null, []])));
        case "thread": {
          if (!rest) return reply("Usage: .facebook thread <THREAD_ID>");
          return reply("〔 THREAD INFO 〕\n" + clean(await invoke(fcaApi, "getThreadInfo", [rest])));
        }
        case "friends":
          return reply("〔 FRIENDS 〕\n" + clean(await invoke(fcaApi, "getFriendsList", [])));
        case "send": {
          const pair = parsePipe(rest);
          if (!pair) return reply("Usage: .facebook send <THREAD_ID> | <MESSAGE>");
          await invoke(fcaApi, "sendMessage", [pair[1], pair[0]]);
          return reply("✅ Message sent.");
        }
        case "react": {
          const pair = parsePipe(rest);
          if (!pair) return reply("Usage: .facebook react <MESSAGE_ID> | <EMOJI>");
          await invoke(fcaApi, "setMessageReaction", [pair[1], pair[0]]);
          return reply("✅ Reaction updated.");
        }
        case "read": {
          if (!rest) return reply("Usage: .facebook read <THREAD_ID>");
          await invoke(fcaApi, "markAsRead", [rest]);
          return reply("✅ Thread marked as read.");
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
