const fs = require("fs");
const axios = require("axios");
const path = require("path");

let lastPlayed = -1;
let isPlaying = false;

module.exports = {
  config: {
    name: "gan",
    version: "1.0.0",
    role: 0,
    author: "NirZon",
    shortDescription: "Play a random song 🎶",
    longDescription: "Plays a random song from the preset Catbox links.",
    category: "media",
    guide: "{p}gan"
  },

  onStart: async function ({ api, event }) {
    const { threadID, messageID } = event;

    const songLinks = [
      "https://files.catbox.moe/u0ctfd.mp3",
      "https://files.catbox.moe/c6b9rr.mp3",
      "https://files.catbox.moe/l5e9qv.mp3",
      "https://files.catbox.moe/yo9wvh.mp3",
      "https://files.catbox.moe/65yeoi.mp3",
      "https://files.catbox.moe/up2h29.mp3",
      "https://files.catbox.moe/l9r4c5.mp3",
      "https://files.catbox.moe/4r5gdz.mp3",
      "https://files.catbox.moe/12grz0.mp3",
      "https://files.catbox.moe/aaqddo.mp3",
      "https://files.catbox.moe/k3acvx.mp3",
      "https://files.catbox.moe/nry1qv.mp3",
      "https://files.catbox.moe/23e8u1.mp3",
      "https://files.catbox.moe/y8dzik.mp3",
      "https://files.catbox.moe/z9d2e6.mp3",
      "https://files.catbox.moe/q4m2ad.mp3",
      "https://files.catbox.moe/y8bg4r.mp3",
      "https://files.catbox.moe/q61co1.mp3",
      "https://files.catbox.moe/euq7fo.mp3",
      "https://files.catbox.moe/avlqok.mp3",
      "https://files.catbox.moe/v0twt3.mp3",
      "https://files.catbox.moe/qmpvpt.mp3"
    ];

    if (isPlaying) {
      return api.sendMessage(
        "⏳ A song is already being prepared! Please wait 🎧",
        threadID,
        messageID
      );
    }

    isPlaying = true;
    let filePath;

    try {
      api.setMessageReaction("🎵", messageID, () => {}, true);

      let index;
      do {
        index = Math.floor(Math.random() * songLinks.length);
      } while (index === lastPlayed && songLinks.length > 1);

      const url = songLinks[index];
      lastPlayed = index;

      const cacheDir = path.join(__dirname, "cache");
      await fs.promises.mkdir(cacheDir, { recursive: true });

      filePath = path.join(cacheDir, `song_${Date.now()}.mp3`);

      const response = await axios.get(url, {
        responseType: "stream",
        timeout: 30000,
        maxRedirects: 5,
        validateStatus: status => status >= 200 && status < 300
      });

      const writer = fs.createWriteStream(filePath);
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
        response.data.on("error", reject);
      });

      const stats = await fs.promises.stat(filePath);
      if (stats.size === 0) {
        throw new Error("Downloaded file is empty");
      }

      api.sendMessage(
        {
          body: "╭── 🎶 𝐒𝐎𝐍𝐆 🎶 ──╮\n\n🎧 Here's your song!\n💜 Enjoy the music ✨\n\n╰─── 𝐍𝐢𝐫𝐙𝐨𝐧'𝐬 𝐁𝐨𝐭 ───╯",
          attachment: fs.createReadStream(filePath)
        },
        threadID,
        (err) => {
          if (err) console.error("Send song error:", err);

          fs.promises.unlink(filePath).catch(() => {});
          isPlaying = false;
        },
        messageID
      );

    } catch (err) {
      console.error("GAN command error:", err.message);

      api.sendMessage(
        "❌ Couldn't download or send the song.\n🔄 Please try again!",
        threadID,
        () => {
          if (filePath) {
            fs.promises.unlink(filePath).catch(() => {});
          }
          isPlaying = false;
        },
        messageID
      );
    }
  }
};

