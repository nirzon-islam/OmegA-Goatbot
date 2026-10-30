const fs = require("fs-extra");
const axios = require("axios");
const request = require("request");
const path = require("path");

module.exports = {
config: {
name: "autolink",
version: "2.0.0",
author: "NirZon",
countDown: 5,
role: 0,
shortDescription: "Auto-download & send videos silently (no messages)",
longDescription: "Automatically downloads and sends videos from links silently.",
category: "media"
},

onStart: async function () {},

onChat: async function ({ api, event }) {
const { threadID, messageID, body } = event;
if (!body) return;

const match = body.match(/https?:\/\/[^\s]+/);
if (!match) return;

const url = match[0];

const react = (emoji) =>
  new Promise(resolve => {
    api.setMessageReaction(emoji, messageID, () => resolve(), true);
  });

let filePath;

try {
  await react("⏳");

  const apiURL =
    `https://aminul-rest-api-three.vercel.app/downloader/alldownloader?url=${encodeURIComponent(url)}`;

  const res = await axios.get(apiURL, { timeout: 60000 });

  const data = res?.data?.data?.data;

  if (!data) {
    await react("❌");
    return;
  }

  const { title, high, low } = data;
  const videoURL = high || low;

  if (!videoURL) {
    await react("❌");
    return;
  }

  const cacheDir = path.join(__dirname, "cache");
  await fs.ensureDir(cacheDir);

  filePath = path.join(
    cacheDir,
    `autolink_${Date.now()}_${Math.random().toString(36).slice(2)}.mp4`
  );

  // Download video
  await new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filePath);

    const stream = request({
      url: videoURL,
      timeout: 120000
    });

    stream.on("response", response => {
      if (response.statusCode !== 200) {
        stream.abort();
        reject(new Error(`HTTP ${response.statusCode}`));
      }
    });

    stream.on("error", err => {
      file.destroy();
      reject(err);
    });

    file.on("error", reject);
    file.on("finish", () => file.close(resolve));

    stream.pipe(file);
  });

  const stat = await fs.stat(filePath);

  if (!stat.size) {
    await react("❌");
    return;
  }

  // Send video with title only
  await new Promise((resolve, reject) => {
    api.sendMessage(
      {
        body: `🎬 𝗧𝗜𝗧𝗟𝗘:\n${title || "Unknown"}`,
        attachment: fs.createReadStream(filePath)
      },
      threadID,
      (err) => err ? reject(err) : resolve(),
      messageID
    );
  });

  await react("✅");

} catch (err) {
  console.error("[AUTOLINK ERROR]", err);
  await react("❌").catch(() => {});
} finally {
  if (filePath) {
    await fs.remove(filePath).catch(() => {});
  }
}

}
};
