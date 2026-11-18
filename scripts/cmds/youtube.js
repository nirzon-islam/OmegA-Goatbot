const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const https = require("https");

const pendingDownloads = {};

const DOWNLOAD_API = "https://uzairrajputapis.qzz.io/api/downloader/youtube";

module.exports = {
  config: {
    name: "youtube",
    aliases: ["yt", "yts", "video"],
    version: "1.0.1",
    author: "NirZon, API Aminul",
    role: 0,
    category: "media",
    shortDescription: "Search & download YouTube videos interactively",
    longDescription: "Search YouTube, show 3 results, then reply with a number to download the video.",
    guide: {
      en: "{pn} [search term] - Search YouTube\nReply 1-3 to download the video",
      bn: "{pn} [সার্চ শব্দ] - ইউটিউব সার্চ\n1-3 নম্বর রিপ্লাই করলে ভিডিও ডাউনলোড হবে"
    }
  },

  onStart: async function ({ api, event, args }) {
    const threadID = event.threadID;
    const messageID = event.messageID;
    const query = args.join(" ").trim();

    if (!query) {
      return api.sendMessage(
        "❌ Please provide a YouTube search keyword!",
        threadID,
        messageID
      );
    }

    try {
      const res = await axios.get(
        `https://aminul-youtube-api.vercel.app/search?query=${encodeURIComponent(query)}`,
        { timeout: 20000 }
      );

      const data = res.data;
      if (!Array.isArray(data) || data.length === 0) {
        return api.sendMessage(
          "😔 No videos found! Try another keyword.",
          threadID,
          messageID
        );
      }

      const videos = data.slice(0, 3);
      pendingDownloads[threadID] = videos;

      const attachments = [];
      let msg = `〔 💜 YOUTUBE SEARCH 〕\n`;
      msg += `🔎 Query: ${query}\n\n`;
      msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";

      for (let i = 0; i < videos.length; i++) {
        const video = videos[i];
        msg += `🎬 ${i + 1}. ${video.title || "Unknown title"}\n`;
        msg += `👤 Channel: ${video.author?.name || "Unknown"}\n`;
        msg += `⏱ Duration: ${video.duration?.timestamp || "N/A"}\n`;
        msg += `👁 Views: ${video.views?.toLocaleString?.() || "N/A"}\n`;
        msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";

        if (video.thumbnail) {
          try {
            const thumbPath = await downloadImage(
              video.thumbnail,
              `thumb_${threadID}_${i}.jpg`
            );
            attachments.push(fs.createReadStream(thumbPath));
          } catch (thumbError) {
            console.error("Thumbnail download error:", thumbError.message);
          }
        }
      }

      msg += `\n📥 Reply with 1-${videos.length} to download your chosen video!\n`;
      msg += "⚡ Powered by NirZon";

      return api.sendMessage(
        {
          body: msg,
          attachment: attachments.length ? attachments : null
        },
        threadID,
        messageID
      );
    } catch (error) {
      console.error("YouTube search error:", error.message);
      return api.sendMessage(
        "⚠️ YouTube search is temporarily unavailable. Please try again later.\n\n💜 - NirZon",
        threadID,
        messageID
      );
    }
  },

  onChat: async function ({ api, event }) {
    const threadID = event.threadID;
    const messageID = event.messageID;
    const message = event.body?.trim();

    if (!message || !pendingDownloads[threadID] || !/^[1-3]$/.test(message)) {
      return;
    }

    const index = Number(message) - 1;
    const video = pendingDownloads[threadID][index];

    if (!video) {
      return api.sendMessage(
        "❌ Invalid selection! Please choose a valid video number.",
        threadID,
        messageID
      );
    }

    // Consume this selection so the same reply cannot start duplicate downloads.
    delete pendingDownloads[threadID];

    const searchTitle = video.title || "YouTube video";

    try {
      await api.sendMessage(
        `〔 💜 YT DOWNLOADER 〕\n⏳ Preparing your video...\n\n🎬 Title: ${searchTitle}\n📥 Status: Downloading`,
        threadID,
        messageID
      );

      // The API accepts the selected YouTube video's URL through the "url" query parameter.
      const downloadResponse = await axios.get(
        `${DOWNLOAD_API}?url=${encodeURIComponent(video.url)}`,
        { timeout: 30000 }
      );

      const payload = downloadResponse.data;
      const result = payload?.result;

      if (payload?.success !== true || !result?.downloadUrl) {
        throw new Error(payload?.message || "Downloader API returned no MP4 URL");
      }

      const videoUrl = result.downloadUrl;
      const title = result.title || searchTitle;
      const cacheDir = path.join(__dirname, "cache");
      await fs.ensureDir(cacheDir);

      const filePath = path.join(
        cacheDir,
        `yt_${threadID}_${Date.now()}.mp4`
      );

      try {
        await downloadFile(videoUrl, filePath);
        const fileStats = await fs.stat(filePath);
        const videoSize = formatBytes(fileStats.size);

        await new Promise((resolve, reject) => {
          api.sendMessage(
            {
              body:
                `〔 💜 YT DOWNLOADER 〕\n\n` +
                `🎬 Title: ${title}\n` +
                `🎥 Format: MP4\n` +
                `📦 Video Size: ${videoSize}\n\n` +
                `✨ Your video is ready!\n` +
                `⚡ Powered by NirZon`,
              attachment: fs.createReadStream(filePath)
            },
            threadID,
            messageID,
            (error) => {
              if (fs.existsSync(filePath)) {
                fs.unlink(filePath).catch((cleanupError) =>
                  console.error("Video cleanup error:", cleanupError.message)
                );
              }
              if (error) reject(error);
              else resolve();
            }
          );
        });
      } catch (error) {
        if (fs.existsSync(filePath)) {
          await fs.unlink(filePath).catch(() => {});
        }
        throw error;
      }
    } catch (error) {
      console.error("YouTube download error:", error.message);
      return api.sendMessage(
        "━━━〔 ⚠️ DOWNLOAD FAILED 〕━━━\n" +
          "❌ Unable to download this video.\n" +
          "🔄 Please try again later.\n\n" +
          "💜 - NirZon",
        threadID,
        messageID
      );
    } finally {
      for (let i = 0; i < 3; i++) {
        const thumbPath = path.join(__dirname, `thumb_${threadID}_${i}.jpg`);
        if (fs.existsSync(thumbPath)) {
          await fs.unlink(thumbPath).catch(() => {});
        }
      }
    }
  }
};

async function downloadImage(url, filename) {
  const response = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 20000
  });
  const filePath = path.join(__dirname, filename);
  await fs.writeFile(filePath, response.data);
  return filePath;
}

function downloadFile(url, filepath, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) {
      return reject(new Error("Too many download redirects"));
    }

    const request = https.get(url, (response) => {
      const status = response.statusCode || 0;

      if ([301, 302, 303, 307, 308].includes(status)) {
        const redirectUrl = response.headers.location;
        response.resume();
        if (!redirectUrl) {
          return reject(new Error("Redirect URL missing"));
        }
        const nextUrl = new URL(redirectUrl, url).toString();
        return downloadFile(nextUrl, filepath, redirects + 1)
          .then(resolve)
          .catch(reject);
      }

      if (status !== 200) {
        response.resume();
        return reject(new Error(`Download failed: HTTP ${status}`));
      }

      const file = fs.createWriteStream(filepath);
      response.pipe(file);

      file.on("finish", () => file.close(resolve));
      file.on("error", (error) => {
        file.destroy();
        if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
        reject(error);
      });
      response.on("error", (error) => {
        file.destroy();
        if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
        reject(error);
      });
    });

    request.on("error", (error) => {
      if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
      reject(error);
    });
  });
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "Unknown";
  const units = ["B", "KB", "MB", "GB"];
  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );
  return `${(bytes / Math.pow(1024, unitIndex)).toFixed(2)} ${units[unitIndex]}`;
}
