const axios = require("axios");
const fs = require("fs");
const os = require("os");
const path = require("path");

const API_JSON =
  "https://raw.githubusercontent.com/MR-MAHABUB-004/MAHABUB-BOT-STORAGE/refs/heads/main/APIURL.json";

let BASE_API = null;

async function getBaseApi() {
  if (BASE_API) return BASE_API;
  const res = await axios.get(API_JSON, { timeout: 15000 });
  if (!res.data?.api) throw new Error("API URL not found");
  BASE_API = String(res.data.api).replace(/\/+$/, "");
  return BASE_API;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Upscaling takes up to 1-2 minutes, so allow a long timeout.
// A timeout is NOT retried (retrying would just make the user wait twice as long).
async function upscale(imageUrl) {
  const BASE = await getBaseApi();
  let lastErr = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      // Fully encode the image link ourselves (same as the manual browser test).
      // axios `params` leaves ":" unescaped, which the API server can reject with 400.
      const reqUrl = `${BASE}/mahabub/upscale?url=${encodeURIComponent(imageUrl)}`;
      console.log("[4k] Request:", reqUrl);

      const res = await axios.get(reqUrl, { timeout: 240000 });

      console.log("[4k] Response:", JSON.stringify(res.data)?.slice(0, 500));

      const d = res.data || {};
      const out = d.image || (Array.isArray(d.images) ? d.images[0] : null);

      if (d.status !== false && out) return out;
      lastErr = new Error("API did not return an image");
    } catch (e) {
      lastErr = e;
      const rb = e?.response?.data;
      console.error(
        `[4k] API attempt ${attempt} failed:`,
        e?.response?.status || e?.code || "",
        e.message,
        rb ? (typeof rb === "string" ? rb : JSON.stringify(rb)).slice(0, 300) : ""
      );
      if (e.code === "ECONNABORTED" || e.code === "ETIMEDOUT") break; // don't wait another 4 minutes
    }
    if (attempt < 2) await wait(3000);
  }

  throw lastErr;
}

// Download the result ourselves (browser headers) and save it to a temp file.
// Result hosts can reject the default downloader, which made the command fail.
async function downloadImage(url, filePath) {
  const res = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 60000,
    maxRedirects: 5,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      Referer: "https://imglarger.com/",
      Accept: "image/*,*/*"
    }
  });

  const type = String(res.headers["content-type"] || "");
  if (/text\/html|application\/json/i.test(type)) {
    throw new Error(`Result host returned ${type} instead of an image`);
  }

  const buf = Buffer.from(res.data);
  if (buf.length < 1024) throw new Error("Downloaded image is too small");

  fs.writeFileSync(filePath, buf);
}

module.exports = {
  config: {
    name: "4k",
    aliases: ["upscale"],
    version: "1.0.0",
    role: 0,
    author: "NirZon",
    countDown: 5,
    longDescription: "𝗨 𝗖𝗮𝗻 𝗨𝗽𝘀𝗰𝗮𝗹𝗲 𝗬𝗼𝘂𝗿 𝗜𝗺𝗮𝗴𝗲 𝗶𝗻 4𝗞 𝗥𝗲𝘀𝗼𝗹𝘂𝘁𝗶𝗼𝗻.",
    category: "image",
    guide: {
      en: "{pn} 𝗥𝗲𝗽𝗹𝘆 𝘁𝗼 𝗮𝗻 𝗶𝗺𝗮𝗴𝗲 𝘁𝗼 𝘂𝗽𝗴𝗿𝗮𝗱𝗲 𝗶𝘁 𝘁𝗼 𝘂𝗹𝘁𝗿𝗮 𝗿𝗲𝘀𝗼𝗹𝘂𝘁𝗶𝗼𝗻."
    }
  },

  onStart: async function ({ message, event }) {
    // Image can be in the replied message or in the command message itself
    const att = event.messageReply?.attachments?.[0] || event.attachments?.[0];

    if (!att || !att.url || (att.type && att.type !== "photo")) {
      return message.reply("⚠️ 𝗥𝗲𝗽𝗹𝘆 𝘁𝗼 𝗮𝗻 𝗶𝗺𝗮𝗴𝗲 𝘁𝗼 𝘂𝗽𝗴𝗿𝗮𝗱𝗲 𝗶𝘁 𝘁𝗼 𝘂𝗹𝘁𝗿𝗮 𝗿𝗲𝘀𝗼𝗹𝘂𝘁𝗶𝗼𝗻..!");
    }

    const waitMsg = await message.reply(
      "⏳ ➪ 𝗨𝗽𝘀𝗰𝗮𝗹𝗶𝗻𝗴 𝘆𝗼𝘂𝗿 𝗶𝗺𝗮𝗴𝗲, 𝗽𝗹𝘇 𝘄𝗮𝗶𝘁...🤠 "
    ).catch(() => null);

    const removeWait = () => {
      if (waitMsg?.messageID) {
        try { message.unsend(waitMsg.messageID); } catch {}
      }
    };

    const tmpDir = path.join(os.tmpdir(), "mahabub-bot-4k");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const filePath = path.join(tmpDir, `upscaled_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.jpg`);

    let stage = "api";

    try {
      const imageUrl = await upscale(att.url);
      console.log("[4k] Upscaled:", imageUrl);

      stage = "download";
      await downloadImage(imageUrl, filePath);

      stage = "send";
      await message.reply({
        body: "𝗛𝗲𝗿𝗲 𝗶𝘀 𝘆𝗼𝘂𝗿 𝗨𝗽𝘀𝗰𝗮𝗹𝗲𝗱 𝗽𝗶𝗰𝘁𝘂𝗿𝗲 | ✅✨",
        attachment: fs.createReadStream(filePath)
      });

      removeWait();
    } catch (error) {
      console.error(`[4k] failed at "${stage}":`, error?.response?.status || "", error.message);
      removeWait();
      message.reply("❌ | 𝘀𝗼𝗿𝗿𝘆 𝘁𝗵𝗲𝗿𝗲 𝘄𝗮𝘀 𝗮𝗻 𝗲𝗿𝗿𝗼𝗿 𝘄𝗵𝗶𝗹𝗲 𝘂𝗽𝘀𝗰𝗮𝗹𝗶𝗻𝗴...\n𝗰𝗼𝗻𝘁𝗮𝗰𝘁 𝗡𝗶𝗿𝗭𝗼𝗻..😄");
    } finally {
      try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch {}
    }
  }
};
