const axios = require("axios");
const fs = require("fs");
const os = require("os");
const path = require("path");

const API = "https://eryxenx.agi.bd/api/xhamstar";
const MAX_CARDS = 6;
const MAX_UPLOAD_MB = 25;
const DEFAULT_QUALITY = "worst";

function react(message, emoji, messageID) {
  try { message.reaction(emoji, messageID); } catch (_) {}
}

function formatDuration(value) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "string" && /[:a-zA-Z]/.test(value)) return value.trim();
  const total = Math.floor(Number(value));
  if (!Number.isFinite(total) || total <= 0) return "";
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = n => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

async function apiSearch(query) {
  const res = await axios.get(`${API}/search`, { params: { q: query, limit: 10 }, timeout: 60000 });
  return res.data;
}

async function apiDownload(url, quality, dest) {
  const res = await axios.get(`${API}/download`, {
    params: { url, quality },
    responseType: "stream",
    timeout: 900000
  });
  const title = res.headers["x-video-title"] || "Video";
  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(dest);
    res.data.pipe(out);
    out.on("finish", resolve);
    out.on("error", reject);
    res.data.on("error", reject);
  });
  return { dest, title };
}

module.exports = {
  config: {
    name: "xhamstar",
    aliases: ["xh"],
    version: "1.0.0",
    author: "EryXenX",
    countDown: 5,
    role: 0,
    shortDescription: { en: "Search and download from xhamster.com" },
    longDescription: { en: "Search xhamster and download videos via the xhamster_api service." },
    category: "media",
    guide: {
      en:
        "{pn} search <query>\n" +
        "{pn} <query>\n" +
        "{pn} <xhamster video url> [worst|half|best|720|1080] (default: worst)"
    }
  },

  onStart: async function ({ message, args, event }) {
    const list = args || [];
    const first = list[0] || "";

    if (/^https?:\/\//i.test(first)) {
      return doDownload({ message, event, url: first, quality: list[1] || DEFAULT_QUALITY });
    }

    const input = list.join(" ").trim();
    if (!input) return message.reply("Usage: xhamstar search <query>");

    const query = input.toLowerCase().startsWith("search") ? input.slice(6).trim() : input;
    if (!query) return message.reply("Empty search query.");
    return doSearch({ message, event, query });
  },

  onReply: async function ({ event, Reply, message }) {
    if (event.senderID !== Reply.author) return;
    const body = (event.body || "").trim();
    const results = Reply.results || [];
    if (!results.length) return message.reply("No result to download.");

    const dropResults = () => {
      try { message.unsend(Reply.messageID); } catch (_) {}
    };

    const n = body.match(/^(\d+)$/);
    if (n) {
      const index = parseInt(n[1], 10);
      if (index < 1 || index > results.length) {
        return message.reply(`Invalid number. Choose 1 to ${results.length}.`);
      }
      dropResults();
      return doDownload({ message, event, url: results[index - 1].url, quality: DEFAULT_QUALITY });
    }

    const d = body.match(/^download(?:\s+(\S+))?$/i);
    if (d) {
      dropResults();
      return doDownload({ message, event, url: results[0].url, quality: d[1] || DEFAULT_QUALITY });
    }
  }
};

async function doSearch({ message, event, query }) {
  const r = emoji => react(message, emoji, event.messageID);

  r("⏳");

  let data;
  try {
    data = await apiSearch(query);
  } catch (e) {
    r("❌");
    return message.reply("Search failed: " + (e.response?.data?.error || e.message));
  }
  if (!data.ok) {
    r("❌");
    return message.reply("Search failed: " + data.error);
  }
  const results = data.results || [];
  if (!results.length) {
    r("❌");
    return message.reply("No results found.");
  }

  const shown = results.slice(0, MAX_CARDS);
  const lines = shown.map((x, i) => {
    const title = (x.title || "Untitled").slice(0, 120);
    const duration = formatDuration(x.duration);
    return duration ? `${i + 1}. ${title}\nDuration: ${duration}` : `${i + 1}. ${title}`;
  });
  const body =
    `Results for "${query}"\n\n` +
    lines.join("\n\n") +
    `\n\nReply:\n- the video number (1-${shown.length}) to download that one\n- "download [quality]" for the first one`;

  const attachment = [];
  for (const x of shown) {
    if (!x.thumbnail) continue;
    try { attachment.push(await global.utils.getStreamFromURL(x.thumbnail)); } catch (_) {}
  }

  return message.reply(
    attachment.length ? { body, attachment } : { body },
    (err, info) => {
      if (err || !info) {
        r("❌");
        return;
      }
      global.GoatBot.onReply.set(info.messageID, {
        commandName: "xhamstar",
        messageID: info.messageID,
        author: event.senderID,
        results
      });
      r("🔥");
    }
  );
}

async function readApiError(e) {
  const data = e.response?.data;
  if (data && typeof data.on === "function") {
    try {
      const chunks = [];
      for await (const chunk of data) chunks.push(chunk);
      const text = Buffer.concat(chunks).toString("utf8");
      try { return JSON.parse(text).error || text; } catch (_) { return text; }
    } catch (_) {}
  } else if (data && data.error) {
    return data.error;
  }
  return e.message || "unknown error";
}

async function doDownload({ message, event, url, quality }) {
  const r = emoji => react(message, emoji, event.messageID);

  r("⏳");

  const dest = path.join(os.tmpdir(), `xhamstar-${Date.now()}.mp4`);
  const cleanup = () => { try { fs.unlinkSync(dest); } catch (_) {} };

  let title;
  try {
    ({ title } = await apiDownload(url, quality, dest));
  } catch (e) {
    cleanup();
    r("❌");
    const raw = await readApiError(e);
    return message.reply(
      "Download failed.\n" +
        "This video may be restricted, or xhamster temporarily blocked the request. Try again in a moment.\n" +
        "Details: " +
        String(raw).slice(0, 160)
    );
  }

  const sizeMb = fs.statSync(dest).size / 1024 / 1024;
  if (sizeMb > MAX_UPLOAD_MB) {
    cleanup();
    r("❌");
    const hint =
      quality === "worst"
        ? "Even the lowest quality is too big, this video is too long to send."
        : "Try a lower quality: xhamstar <video-url> worst";
    return message.reply(
      `${title}\n` +
        `Video is ${sizeMb.toFixed(2)} MB, over the ~${MAX_UPLOAD_MB} MB Messenger upload limit.\n` +
        hint
    );
  }

  try {
    await message.reply({ body: `${title}\n${sizeMb.toFixed(2)} MB`, attachment: fs.createReadStream(dest) });
    r("✅");
  } catch (e) {
    r("❌");
    message.reply("Upload failed: " + String(e?.message || e?.error || e).slice(0, 160));
  } finally {
    cleanup();
  }
}
