const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const https = require("https");

let pendingDownloads = {};

module.exports = {
config: {
name: "youtube",
aliases: ["youtube", "yts"],
version: "1.0.0",
author: "NirZon, API Aminul",
role: 0,
category: "media",
shortDescription: "Search & download YouTube videos interactively",
longDescription: "Search YouTube, show top results, then reply with a number to download the video.",
guide: {
en: "{pn} [search term] - Search YouTube\nReply 1-5 to download the video",
bn: "{pn} [সার্চ শব্দ] - ইউটিউব সার্চ\n1-5 নম্বর রিপ্লাই করলে ভিডিও ডাউনলোড হবে"
}
},

onStart: async function({ api, event, args }) {
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
    `https://aminul-youtube-api.vercel.app/search?query=${encodeURIComponent(query)}`
  );

  const data = res.data;

  if (!data || data.length === 0) {
    return api.sendMessage(
      "😔 No videos found! Try another keyword.",
      threadID,
      messageID
    );
  }

  const videos = data.slice(0, 5);

  pendingDownloads[threadID] = videos;

  let attachments = [];

  let msg = `🎬 **YouTube Search Results** 🎬\n`;
  msg += `🔎 **Query:** ${query}\n\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

  for (let i = 0; i < videos.length; i++) {
    const v = videos[i];

    msg += `✨ **${i + 1}. ${v.title}**\n`;
    msg += `👤 Channel: ${v.author?.name || "Unknown"}\n`;
    msg += `⏱ Duration: ${v.duration?.timestamp || "N/A"}\n`;
    msg += `👁 Views: ${v.views?.toLocaleString() || "N/A"}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

    if (v.thumbnail) {
      try {
        const thumbPath = await downloadImage(
          v.thumbnail,
          `thumb_${threadID}_${i}.jpg`
        );

        attachments.push(fs.createReadStream(thumbPath));
      } catch (thumbErr) {
        console.error("Thumbnail download error:", thumbErr);
      }
    }
  }

  msg += `\n📥 Reply with **1-${videos.length}** to download your chosen video!\n`;
  msg += `\n💜 Powered by NirZon`;

  return api.sendMessage(
    {
      body: msg,
      attachment: attachments.length > 0 ? attachments : null
    },
    threadID,
    messageID
  );

} catch (err) {
  console.error("Search error:", err);

  return api.sendMessage(
    "⚠️ YouTube search is temporarily unavailable. Please try again later.\n\n💜 - NirZon",
    threadID,
    messageID
  );
}

},

onChat: async function({ api, event }) {
const threadID = event.threadID;
const messageID = event.messageID;
const message = event.body?.trim();

if (
  !message ||
  !pendingDownloads[threadID] ||
  !/^[1-5]$/.test(message)
) {
  return;
}

const index = parseInt(message) - 1;
const video = pendingDownloads[threadID][index];

if (!video) {
  return api.sendMessage(
    "❌ Invalid selection! Please choose a valid video number.",
    threadID,
    messageID
  );
}

const title = video.title;
const url = video.url;

const loadingMsg = await api.sendMessage(
  `〔 💜 YT DOWNLOADER 〕\n` +
  `⏳ Preparing your video...\n\n` +
  `🎬 Title: ${title}\n` +
  `📥 Status: Downloading\n` +
  `━━━━━━━━━━━━━━━━━━━━━━`,
  threadID
);

try {
  const downloadInfo = await axios.get(
    `https://aminul-rest-api-three.vercel.app/downloader/alldownloader?url=${encodeURIComponent(url)}`
  );

  const videoData = downloadInfo.data?.data?.data;

  if (!videoData) {
    throw new Error("Invalid API response structure");
  }

  const videoUrl = videoData.high || videoData.low;

  if (!videoUrl) {
    return api.sendMessage(
      "❌ Sorry! This video is unavailable for downloading.\n\n💜 Powered by NirZon",
      threadID,
      messageID
    );
  }

  const cacheDir = path.join(__dirname, "cache");

  await fs.ensureDir(cacheDir);

  const filePath = path.join(
    cacheDir,
    `yt_${threadID}_${Date.now()}.mp4`
  );

  await downloadFile(videoUrl, filePath);

  await api.sendMessage(
    {
      body:
        `.  〔 💜 YT DOWNLOADER 〕\n` +
        `✅ DOWNLOAD SUCCESSFUL!\n\n` +
        `🎬 Title: ${title}\n` +
        `📥 Status: Completed\n` +
        `🎥 Format: MP4\n\n` +
        `✨ Your video is ready!\n` +
        `💜 Enjoy your video!\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `⚡ Powered by NirZon`,
      attachment: fs.createReadStream(filePath)
    },
    threadID,
    () => {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  );

  // Clean up thumbnails
  for (let i = 0; i < 5; i++) {
    const thumbPath = path.join(
      __dirname,
      `thumb_${threadID}_${i}.jpg`
    );

    if (fs.existsSync(thumbPath)) {
      fs.unlinkSync(thumbPath);
    }
  }

} catch (err) {
  console.error("Download error:", err);

  api.sendMessage(
    `━━━〔 ⚠️ DOWNLOAD FAILED 〕━━━\n` +
    `❌ Unable to download this video.\n` +
    `🔄 Please try again later.\n\n` +
    `💜 - NirZon\n` +
    `━━━━━━━━━━━━━━━━━━━━━━`,
    threadID,
    messageID
  );
}

delete pendingDownloads[threadID];

}
};

// Download thumbnail
async function downloadImage(url, filename) {
try {
const response = await axios({
method: "GET",
url: url,
responseType: "arraybuffer"
});

const filePath = path.join(__dirname, filename);

await fs.writeFile(filePath, response.data);

return filePath;

} catch (error) {
throw new Error("Failed to download image: ${error.message}");
}
}

// Download video file
function downloadFile(url, filepath) {
return new Promise((resolve, reject) => {
const file = fs.createWriteStream(filepath);

https.get(url, (response) => {
  if (
    response.statusCode === 301 ||
    response.statusCode === 302 ||
    response.statusCode === 303 ||
    response.statusCode === 307 ||
    response.statusCode === 308
  ) {
    const redirectUrl = response.headers.location;

    file.close();

    if (!redirectUrl) {
      return reject(new Error("Redirect URL missing"));
    }

    return downloadFile(redirectUrl, filepath)
      .then(resolve)
      .catch(reject);
  }

  if (response.statusCode !== 200) {
    file.close();

    return reject(
      new Error(`Download failed: HTTP ${response.statusCode}`)
    );
  }

  response.pipe(file);

  file.on("finish", () => {
    file.close(resolve);
  });

  file.on("error", (err) => {
    file.close();

    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }

    reject(err);
  });

}).on("error", (err) => {
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
  }

  reject(err);
});

});
                    }
