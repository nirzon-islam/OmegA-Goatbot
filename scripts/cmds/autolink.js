const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");
const { execFile } = require("child_process");

// ================= সেটিংস =================
// লিংকের কোনো লিমিট নেই — যত লিংক দেবে সব ডাউনলোড হবে
const CONCURRENCY = 4;        // একসাথে কয়টা ডাউনলোড চলবে
const SEND_LIMIT_MB = 24;     // মেসেঞ্জারে সরাসরি পাঠানোর সাইজ; এর বড় হলে অটো ছোট (কমপ্রেস) করবে
const HARD_LIMIT_MB = 500;    // এর চেয়ে বড় ফাইল নামাবে না (সার্ভার বাঁচাতে)
const SHOW_ERRORS = true;     // false দিলে ডাউনলোড ফেইল হলে চ্যাটে কিছু লিখবে না (শুধু কনসোলে দেখাবে)
const COMPRESS = true;        // বড় ভিডিও অটো ছোট করে পাঠাবে (ffmpeg লাগে)
const TIMEOUT_MS = 90000;     // সংযোগ আটকে গেলে থামানোর সীমা
const LONG_TIMEOUT_MS = 600000; // বড় ডাউনলোড/কমপ্রেসের সর্বোচ্চ সময় (১০ মিনিট)
const CACHE_DIR = path.join(__dirname, "cache", "autolink");
const YTDLP = process.env.YTDLP_PATH || "yt-dlp";

// ডাউনলোডার API লিস্ট ({url} এর জায়গায় লিংক বসবে)। কোনো API মরে গেলে পরেরটা চেষ্টা করবে।
// অন্য কাজ করা API জানা থাকলে এখানে নতুন লাইন যোগ করো।
const APIS = [
  "https://nayan-video-downloader.vercel.app/alldown?url={url}",
  "https://noobs-api.top/dipto/alldl?url={url}"
];

// যে সাইটগুলোর লিংক ধরবে
const SITES = new RegExp(
  "(youtube\\.com|youtu\\.be|facebook\\.com|fb\\.watch|fb\\.com|tiktok\\.com|instagram\\.com|" +
  "twitter\\.com|x\\.com|threads\\.net|pinterest\\.com|pin\\.it|reddit\\.com|vimeo\\.com|" +
  "dailymotion\\.com|twitch\\.tv|soundcloud\\.com|likee\\.video|capcut\\.com|snapchat\\.com|" +
  "linkedin\\.com|bilibili\\.com|9gag\\.com|streamable\\.com)",
  "i"
);
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
// ==========================================

function extractLinks(text) {
  const all = text.match(/https?:\/\/[^\s]+/gi) || [];
  const clean = all.map(u => u.replace(/[)\]}>,.!?]+$/, ""));
  return [...new Set(clean)].filter(u => SITES.test(u));
}

// MP4 ফাইলে অডিও ট্র্যাক আছে কিনা দেখে (ffmpeg ছাড়াই)
function hasAudioTrack(filepath) {
  try {
    const size = fs.statSync(filepath).size;
    const CH = 4 * 1024 * 1024;
    const fd = fs.openSync(filepath, "r");
    const read = (pos, len) => {
      const b = Buffer.alloc(len);
      const n = fs.readSync(fd, b, 0, len, pos);
      return b.slice(0, n).toString("latin1");
    };
    const text = size <= CH * 2 ? read(0, size) : read(0, CH) + read(size - CH, CH);
    fs.closeSync(fd);
    return /hdlr[\s\S]{8}soun/.test(text);
  } catch (_) { return true; }
}

// ভিডিও লিংক থেকে ফাইল নামায়
async function saveStream(videoUrl, id, title) {
  const filepath = path.join(CACHE_DIR, `${id}.mp4`);
  const res = await axios.get(videoUrl, {
    responseType: "stream",
    timeout: TIMEOUT_MS,
    headers: { "User-Agent": BROWSER_UA }
  });
  const len = Number(res.headers["content-length"] || 0);
  if (len && len / 1024 / 1024 > HARD_LIMIT_MB) {
    res.data.destroy();
    throw new Error(`ভিডিও খুবই বড় (${(len / 1024 / 1024).toFixed(0)}MB)`);
  }
  try {
    await new Promise((ok, fail) => {
      let got = 0;
      const w = fs.createWriteStream(filepath);
      res.data.on("data", c => {
        got += c.length;
        if (got / 1024 / 1024 > HARD_LIMIT_MB) res.data.destroy(new Error("ভিডিও খুবই বড়"));
      });
      res.data.pipe(w);
      w.on("finish", ok);
      w.on("error", fail);
      res.data.on("error", fail);
    });
  } catch (e) {
    fs.remove(filepath).catch(() => {});
    throw e;
  }
  return { title: title || "", filepath, directUrl: videoUrl, noAudio: !hasAudioTrack(filepath) };
}

// শেয়ার লিংক খুলে আসল লিংক বের করা + ট্র্যাকিং বাদ
async function resolveUrl(url) {
  try {
    if (/facebook\.com\/share\/|fb\.watch|fb\.com\/|pin\.it|vm\.tiktok\.com|vt\.tiktok\.com/i.test(url)) {
      const res = await axios.get(url, {
        maxRedirects: 10, timeout: 15000,
        headers: { "User-Agent": BROWSER_UA },
        validateStatus: () => true
      });
      const finalUrl = res.request && res.request.res && res.request.res.responseUrl;
      if (finalUrl && !/login|checkpoint/i.test(finalUrl)) url = finalUrl;
    }
    if (/facebook\.com|fb\.watch/i.test(url)) {
      const u = new URL(url);
      ["mibextid", "fbclid", "rdid", "share_url", "sfnsn"].forEach(k => u.searchParams.delete(k));
      url = u.toString();
    }
  } catch (_) {}
  return url;
}

// ---------- পদ্ধতি ১: TikTok ----------
async function tiktokDownload(url, id) {
  const { data } = await axios.get("https://www.tikwm.com/api/", { params: { url, hd: 1 }, timeout: 30000 });
  const d = data && data.data;
  const videoUrl = d && (d.hdplay || d.play);
  if (!videoUrl) throw new Error("TikTok ভিডিও পাওয়া যায়নি");
  return await saveStream(videoUrl, id, d.title);
}

// ---------- পদ্ধতি ২: Facebook (পেজ থেকে সরাসরি, একাধিক লিংক ও ব্রাউজার ভেদে) ----------
const FB_UAS = [
  BROWSER_UA,
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)"
];

function fbCandidates(url) {
  const out = [url];
  const m = url.match(/\/(?:reel|videos?)\/(\d+)/) || url.match(/[?&]v=(\d+)/);
  if (m) {
    out.push(`https://www.facebook.com/reel/${m[1]}`);
    out.push(`https://m.facebook.com/watch/?v=${m[1]}`);
  }
  return [...new Set(out)];
}

// পেজ থেকে সব ভিডিও লিংক বের করে। rank: 0 = HD (শব্দসহ), 1 = SD (শব্দসহ), 2 = og:video (অনেক সময় শব্দ ছাড়া)
function fbExtract(html) {
  const unesc = s => s
    .replace(/\\\//g, "/").replace(/\\u0025/gi, "%").replace(/\\u0026/gi, "&")
    .replace(/\\u002F/gi, "/").replace(/\\u003D/gi, "=").replace(/&amp;/g, "&");
  const list = [];
  const add = (re, rank) => {
    const g = new RegExp(re.source, "g");
    let m;
    while ((m = g.exec(html))) list.push({ url: unesc(m[1]), rank });
  };
  add(/"browser_native_hd_url":"([^"]+)"/, 0);
  add(/"playable_url_quality_hd":"([^"]+)"/, 0);
  add(/hd_src(?:_no_ratelimit)?["']?\s*:\s*"([^"]+)"/, 0);
  add(/"browser_native_sd_url":"([^"]+)"/, 1);
  add(/"playable_url":"([^"]+)"/, 1);
  add(/sd_src(?:_no_ratelimit)?["']?\s*:\s*"([^"]+)"/, 1);
  add(/<meta property="og:video(?::secure_url|:url)?" content="([^"]+)"/, 2);
  const tm = html.match(/<meta property="og:title" content="([^"]*)"/);
  return { list, title: tm ? unesc(tm[1]) : "" };
}

// লিংকগুলো একে একে নামিয়ে শব্দ (অডিও) আছে এমনটা বেছে নেয়; কোনোটায় শব্দ না থাকলে প্রথমটাই ফেরত দেয়
async function pickWithAudio(urls, id, title) {
  let silent = null, lastErr;
  for (let i = 0; i < Math.min(urls.length, 4); i++) {
    try {
      const f = await saveStream(urls[i], `${id}_c${i}`, title);
      if (!f.noAudio) {
        if (silent) fs.remove(silent.filepath).catch(() => {});
        return f;
      }
      if (!silent) silent = f; else fs.remove(f.filepath).catch(() => {});
    } catch (e) { lastErr = e; }
  }
  if (silent) return silent;
  throw lastErr || new Error("ভিডিও নামানো যায়নি");
}

async function facebookDownload(url, id) {
  const combos = [];
  for (const u of fbCandidates(url)) for (const ua of FB_UAS) combos.push([u, ua]);
  let lastErr;
  const attempt = async ([u, ua]) => {
    const { data: html } = await axios.get(u, {
      timeout: 12000,
      maxRedirects: 5,
      headers: {
        "User-Agent": ua,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Sec-Fetch-Mode": "navigate"
      }
    });
    return fbExtract(String(html));
  };
  // সব পেজ একসাথে আনা হয়; HD লিংক পেলেই আর অপেক্ষা না করে এগিয়ে যায়
  const pages = await new Promise(resolve => {
    const got = [];
    let done = 0, finished = false;
    const finish = () => { if (!finished) { finished = true; resolve(got); } };
    combos.forEach(c =>
      attempt(c)
        .then(p => { got.push(p); if (p.list.some(x => x.rank === 0)) finish(); })
        .catch(e => { lastErr = e; })
        .finally(() => { if (++done === combos.length) finish(); })
    );
  });
  const seen = new Set();
  const cands = [];
  let title = "";
  for (const p of pages) {
    if (!title && p.title) title = p.title;
    for (const c of p.list) if (!seen.has(c.url)) { seen.add(c.url); cands.push(c); }
  }
  cands.sort((a, b) => a.rank - b.rank);
  if (!cands.length) throw new Error(lastErr ? lastErr.message : "পেজে ভিডিও লিংক নেই (প্রাইভেট বা লগইন লাগে)");
  return await pickWithAudio(cands.map(c => c.url), id, title);
}

// ---------- পদ্ধতি ৩: ডাউনলোডার API (সব সাইটের জন্য, ইনস্টল লাগে না) ----------
function findMedia(obj, inputUrl) {
  const BAD = /thumb|cover|image|avatar|poster|preview|icon/i;
  const PRIORITY = ["hdplay", "hd", "high", "play", "video", "url", "download", "link", "result", "low", "sd"];
  const found = [];
  let title = "";
  (function walk(v, key) {
    if (typeof v === "string") {
      if (/^https?:\/\//i.test(v)) {
        if (!BAD.test(key) && v !== inputUrl && !/\.(jpe?g|png|webp|gif)(\?|$)/i.test(v))
          found.push({ key: key.toLowerCase(), url: v });
      } else if (/^(title|caption|desc|description)$/i.test(key) && !title) title = v;
    } else if (Array.isArray(v)) v.forEach(x => walk(x, key));
    else if (v && typeof v === "object") for (const k of Object.keys(v)) walk(v[k], k);
  })(obj, "");
  const rank = f => { const i = PRIORITY.indexOf(f.key); return i === -1 ? 99 : i; };
  found.sort((a, b) => rank(a) - rank(b));
  return { list: found.map(f => f.url), title };
}

async function apiDownload(url, id) {
  let lastErr = "কোনো API থেকে ভিডিও লিংক পাওয়া যায়নি";
  const fetchApi = async tpl => {
    const { data } = await axios.get(tpl.replace("{url}", encodeURIComponent(url)), {
      timeout: 12000, headers: { "User-Agent": BROWSER_UA }
    });
    const m = findMedia(data, url);
    if (!m.list.length) throw new Error("API খালি উত্তর দিয়েছে");
    return m;
  };
  try {
    // সব API একসাথে ডাকা হয়, যেটা আগে সঠিক উত্তর দেয় সেটা ব্যবহার হয়
    const m = await Promise.any(APIS.map(fetchApi));
    return await pickWithAudio(m.list.slice(0, 3), id, m.title);
  } catch (e) {
    lastErr = (e.errors && e.errors[0] && e.errors[0].message) || e.message || lastErr;
  }
  throw new Error(lastErr);
}

// ---------- পদ্ধতি ৪: yt-dlp (থাকলে ব্যবহার হবে, না থাকলে বাদ) ----------
const CANDIDATES = [[YTDLP], ["python3", "-m", "yt_dlp"], ["python", "-m", "yt_dlp"]];
function execYtdlp(args, opts, cb, idx = 0) {
  const [cmd, ...pre] = CANDIDATES[idx];
  execFile(cmd, [...pre, ...args], opts, (err, stdout, stderr) => {
    const missing = err && (err.code === "ENOENT" || /No module named/i.test(String(stderr)));
    if (missing && idx + 1 < CANDIDATES.length) return execYtdlp(args, opts, cb, idx + 1);
    cb(err, stdout, stderr);
  });
}

function ytdlpDownload(url, id) {
  return new Promise((resolve, reject) => {
    const args = [
      "--no-playlist", "--no-warnings", "--no-mtime", "--no-cache-dir",
      "--concurrent-fragments", "8", "--socket-timeout", "10",
      "--retries", "2", "--extractor-retries", "1",
      "-f", `best[ext=mp4][filesize<${SEND_LIMIT_MB}M]/best[ext=mp4]/best`,
      "--merge-output-format", "mp4",
      "-o", path.join(CACHE_DIR, `${id}.%(ext)s`),
      "--print", "after_move:%(title)s|||%(filepath)s",
      url
    ];
    const cookieFile = path.join(__dirname, "autolink_cookies.txt");
    if (fs.existsSync(cookieFile)) args.unshift("--cookies", cookieFile);
    execYtdlp(args, { timeout: LONG_TIMEOUT_MS, maxBuffer: 1024 * 1024 * 10 }, (err, stdout, stderr) => {
      if (err) {
        const e = new Error("yt-dlp");
        e.missing = err.code === "ENOENT" || /No module named/i.test(String(stderr));
        e.tool = "yt-dlp";
        const text = (stderr || err.message || "").toString();
        e.message = (text.split("\n").reverse().find(l => /ERROR/i.test(l)) || text).trim().slice(0, 200);
        return reject(e);
      }
      const line = stdout.trim().split("\n").pop() || "";
      const [title, filepath] = line.split("|||");
      if (!filepath || !fs.existsSync(filepath.trim())) return reject(new Error("ফাইল পাওয়া যায়নি"));
      resolve({ title: (title || "").trim(), filepath: filepath.trim() });
    });
  });
}

// ---------- YouTube: ytdl-core (npm) থাকলে ব্যবহার হবে ----------
let _ytdl;
function getYtdl() {
  if (_ytdl !== undefined) return _ytdl;
  for (const name of ["@distube/ytdl-core", "ytdl-core"]) {
    try { return (_ytdl = require(name)); } catch (_) {}
  }
  return (_ytdl = null);
}

async function youtubeDownload(url, id) {
  const ytdl = getYtdl();
  if (!ytdl) {
    const e = new Error("ytdl-core নেই");
    e.missing = true; e.tool = "@distube/ytdl-core";
    throw e;
  }
  const info = await ytdl.getInfo(url);
  // ছবি+শব্দ একসাথে থাকা ফরম্যাট (মার্জ লাগে না)
  let format;
  try {
    format = ytdl.chooseFormat(info.formats, { quality: "highest", filter: f => f.hasVideo && f.hasAudio && f.container === "mp4" });
  } catch (_) {
    format = ytdl.chooseFormat(info.formats, { quality: "highest", filter: "audioandvideo" });
  }
  const filepath = path.join(CACHE_DIR, `${id}.mp4`);
  try {
    await new Promise((ok, fail) => {
      const stream = ytdl.downloadFromInfo(info, { format, highWaterMark: 1 << 25 });
      const w = fs.createWriteStream(filepath);
      stream.pipe(w);
      stream.on("error", fail);
      w.on("finish", ok);
      w.on("error", fail);
    });
  } catch (e) {
    fs.remove(filepath).catch(() => {});
    throw e;
  }
  return { title: (info.videoDetails && info.videoDetails.title) || "", filepath };
}

// ---------- মূল ডাউনলোড: একটার পর একটা পদ্ধতি চেষ্টা ----------
async function download(rawUrl, id) {
  const url = await resolveUrl(rawUrl);
  const steps = [];
  if (/tiktok\.com/i.test(url)) steps.push(tiktokDownload);
  if (/facebook\.com|fb\.watch|fb\.com/i.test(url)) steps.push(facebookDownload);
  if (/youtube\.com|youtu\.be/i.test(url)) steps.push(youtubeDownload);
  steps.push(apiDownload, ytdlpDownload);

  const errors = [];
  const missing = [];
  let silent = null; // শব্দ ছাড়া ভিডিও পেলে রেখে দেয়, অন্য পদ্ধতিতে শব্দসহ পেলে সেটা পাঠায়
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    try {
      const r = await step(url, `${id}_s${i}`);
      if (r && r.noAudio) {
        if (!silent) silent = r; else fs.remove(r.filepath).catch(() => {});
        continue;
      }
      if (silent) fs.remove(silent.filepath).catch(() => {});
      return r;
    } catch (e) {
      if (e.missing) missing.push(e.tool || step.name);
      else errors.push(`${step.name.replace("Download", "")}: ${e.message}`);
      console.error(`[autolink] ${step.name} ব্যর্থ:`, e.message);
    }
  }
  if (silent) return silent;
  let msg = errors.slice(-2).join(" | ");
  if (missing.length) msg += (msg ? " | " : "") + "ইনস্টল নেই: " + [...new Set(missing)].join(", ");
  throw new Error(msg || "সব পদ্ধতি ব্যর্থ");
}

// একসাথে CONCURRENCY টা করে চালায়
async function runPool(items, limit, worker) {
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      await worker(items[i], i);
    }
  });
  await Promise.all(runners);
}

// টাইটেল থেকে #হ্যাশট্যাগ, "| পেজের নাম" আর HTML কোড বাদ দেয়
function cleanTitle(t) {
  if (!t) return "";
  t = String(t)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  t = t.replace(/^[^|]*\b(views?|reactions?|likes?|shares?|comments?|plays?)\b[^|]*\|\s*/i, ""); // "120K views · 2.4K reactions |"
  t = t.replace(/\s*\|[^|]*$/, "");            // শেষের "| পেজের নাম"
  t = t.replace(/#[^\s#|]+/g, "");             // সব হ্যাশট্যাগ
  t = t.replace(/\s+/g, " ").replace(/^[\s|\-–—:,.]+|[\s|\-–—:,.]+$/g, "").trim();
  return t.length > 90 ? t.slice(0, 90).trim() + "…" : t;
}

function platformName(url) {
  const map = [
    [/youtube\.com|youtu\.be/i, "YouTube"], [/facebook\.com|fb\.watch|fb\.com/i, "Facebook"],
    [/tiktok\.com/i, "TikTok"], [/instagram\.com/i, "Instagram"], [/twitter\.com|x\.com/i, "Twitter / X"],
    [/threads\.net/i, "Threads"], [/pinterest\.com|pin\.it/i, "Pinterest"], [/reddit\.com/i, "Reddit"],
    [/vimeo\.com/i, "Vimeo"], [/dailymotion\.com/i, "Dailymotion"], [/twitch\.tv/i, "Twitch"],
    [/soundcloud\.com/i, "SoundCloud"], [/likee\.video/i, "Likee"], [/capcut\.com/i, "CapCut"],
    [/snapchat\.com/i, "Snapchat"], [/linkedin\.com/i, "LinkedIn"], [/bilibili\.com/i, "Bilibili"]
  ];
  const hit = map.find(([re]) => re.test(url));
  return hit ? hit[1] : "Web";
}

// ক্যাপশন ডিজাইন
function buildCaption({ title, platform, sizeMB, origMB, secs }) {
  const lines = ["┌─ 📥 VIDEO DOWNLOAD ♨", "│"];
  if (title) lines.push(`├ 🎬 ${title}`);
  lines.push(`├ 🌐 ${platform}`);
  lines.push(`├ 📦 ${sizeMB.toFixed(2)} MB` + (origMB ? ` (মূল ${origMB.toFixed(1)} MB, কমপ্রেসড)` : ""));
  lines.push(`└ ⚡ ${secs.toFixed(1)} সেকেন্ডে`);
  return lines.join("\n");
}

// ---------- বড় ভিডিও ছোট করা (ffmpeg) ----------
let _ffmpegPath;
async function getFfmpeg() {
  if (_ffmpegPath !== undefined) return _ffmpegPath;
  const candidates = [];
  try { candidates.push(require("ffmpeg-static")); } catch (_) {}
  try { candidates.push(require("@ffmpeg-installer/ffmpeg").path); } catch (_) {}
  candidates.push("ffmpeg");
  for (const c of candidates) {
    if (!c) continue;
    const ok = await new Promise(r => execFile(c, ["-version"], { timeout: 10000 }, err => r(!err)));
    if (ok) return (_ffmpegPath = c);
  }
  return (_ffmpegPath = null);
}

function getDuration(bin, file) {
  return new Promise(resolve => {
    execFile(bin, ["-i", file], { timeout: 30000 }, (err, so, stderr) => {
      const m = String(stderr).match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
      resolve(m ? (+m[1]) * 3600 + (+m[2]) * 60 + parseFloat(m[3]) : 0);
    });
  });
}

function runFfmpeg(bin, args) {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { timeout: LONG_TIMEOUT_MS, maxBuffer: 1024 * 1024 * 20 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(String(stderr || err.message).trim().split("\n").slice(-2).join(" ").slice(0, 150)));
      resolve();
    });
  });
}

async function doCompress(input, id) {
  const bin = await getFfmpeg();
  if (!bin) throw new Error("ffmpeg নেই");
  const duration = await getDuration(bin, input);
  const output = path.join(CACHE_DIR, `${id}_small.mp4`);
  let target = SEND_LIMIT_MB * 0.92; // MB
  for (let attempt = 0; attempt < 3; attempt++) {
    const args = ["-y", "-i", input];
    if (duration > 0) {
      const total = (target * 8192) / duration;          // কিলোবিট/সেকেন্ড
      const v = Math.max(60, Math.floor(total - 64));
      const h = v >= 1200 ? 720 : v >= 500 ? 480 : 360;
      args.push("-vf", `scale=-2:'min(${h},ih)'`, "-c:v", "libx264", "-preset", "veryfast",
        "-b:v", `${v}k`, "-maxrate", `${Math.floor(v * 1.25)}k`, "-bufsize", `${v * 2}k`);
    } else {
      args.push("-vf", "scale=-2:'min(480,ih)'", "-c:v", "libx264", "-preset", "veryfast", "-crf", String(30 + attempt * 4));
    }
    args.push("-c:a", "aac", "-b:a", "64k", "-movflags", "+faststart", output);
    await runFfmpeg(bin, args);
    const mb = fs.statSync(output).size / 1024 / 1024;
    if (mb <= SEND_LIMIT_MB) return output;
    target *= 0.8;
  }
  throw new Error("কমপ্রেস করেও ছোট হয়নি");
}

// একসাথে একটাই কমপ্রেস চলবে (সার্ভার যেন আটকে না যায়)
let ffQueue = Promise.resolve();
function compressVideo(input, id) {
  const job = ffQueue.then(() => doCompress(input, id));
  ffQueue = job.catch(() => {});
  return job;
}

module.exports = {
  config: {
    name: "autolink",
    version: "2.0",
    author: "Zihad",
    countDown: 3,
    role: 0,
    description: "লিংক দিলেই অটো ভিডিও ডাউনলোড (YouTube, Facebook, TikTok, Instagram ও আরও অনেক)",
    category: "media",
    guide: { en: "{pn} on | off — অটো ডাউনলোড চালু/বন্ধ\n{pn} check — API চেক" }
  },

  onStart: async function ({ message, args, event, threadsData }) {
    const opt = (args[0] || "").toLowerCase();
    if (opt === "check") {
      const lines = [];
      for (const tpl of APIS) {
        const host = new URL(tpl.replace("{url}", "x")).origin;
        const ok = await axios.get(host, { timeout: 8000, validateStatus: () => true }).then(() => true).catch(() => false);
        lines.push(`${ok ? "✅" : "❌"} ${host}`);
      }
      lines.push(getYtdl() ? "✅ ytdl-core (YouTube)" : "⚠️ ytdl-core নেই (YouTube এর জন্য: npm i @distube/ytdl-core)");
      const ytd = await new Promise(r => execYtdlp(["--version"], { timeout: 15000 }, err => r(!err)));
      lines.push(ytd ? "✅ yt-dlp" : "⚠️ yt-dlp নেই (ঐচ্ছিক)");
      const ff = await getFfmpeg();
      lines.push(ff ? "✅ ffmpeg (বড় ভিডিও কমপ্রেস হবে)" : "⚠️ ffmpeg নেই (বড় ভিডিও কমপ্রেস হবে না, লিংক পাঠাবে)");
      return message.reply(`🔧 সিস্টেম চেক\n${lines.join("\n")}`);
    }
    if (opt !== "on" && opt !== "off") {
      const cur = await threadsData.get(event.threadID, "data.autolink");
      return message.reply(`AutoLink এখন: ${cur === false ? "বন্ধ ❌" : "চালু ✅"}\nব্যবহার: autolink on | off | check`);
    }
    await threadsData.set(event.threadID, opt === "on", "data.autolink");
    return message.reply(opt === "on" ? "✅ AutoLink চালু হয়েছে" : "❌ AutoLink বন্ধ হয়েছে");
  },

  onChat: async function ({ api, event, message, threadsData }) {
    try {
      if (!event.body) return;
      if (event.senderID === api.getCurrentUserID()) return;

      const links = extractLinks(event.body);
      if (!links.length) return;

      const enabled = await threadsData.get(event.threadID, "data.autolink");
      if (enabled === false) return;

      fs.ensureDirSync(CACHE_DIR);
      try { api.setMessageReaction("⏳", event.messageID, () => {}, true); } catch (_) {}

      let okCount = 0;
      await runPool(links, CONCURRENCY, async (link, i) => {
        const id = `${event.messageID}_${i}`.replace(/[^\w-]/g, "");
        let file, smallPath;
        try {
          const t0 = Date.now();
          file = await download(link, id);
          const origMB = fs.statSync(file.filepath).size / 1024 / 1024;
          let sendPath = file.filepath;
          if (origMB > SEND_LIMIT_MB && COMPRESS) {
            try { smallPath = await compressVideo(file.filepath, id); sendPath = smallPath; }
            catch (ce) { console.error("[autolink] কমপ্রেস ব্যর্থ:", ce.message); }
          }
          const sendMB = fs.statSync(sendPath).size / 1024 / 1024;
          const caption = buildCaption({
            title: cleanTitle(file.title),
            platform: platformName(link),
            sizeMB: sendMB,
            origMB: sendPath !== file.filepath ? origMB : 0,
            secs: (Date.now() - t0) / 1000
          });
          try {
            await message.reply({ body: caption, attachment: fs.createReadStream(sendPath) });
            okCount++;
          } catch (sendErr) {
            if (sendMB <= SEND_LIMIT_MB) throw sendErr;
            // বড় ফাইল পাঠানো গেল না → সরাসরি ডাউনলোড লিংক
            await message.reply(
              `${caption}\n\n⚠️ ভিডিওটা বড় (${origMB.toFixed(1)} MB), মেসেঞ্জারে সরাসরি যাচ্ছে না।\n🔗 ডাউনলোড লিংক:\n${file.directUrl || link}`
            );
            okCount++;
          }
        } catch (e) {
          console.error("[autolink] ব্যর্থ:", link, "|", e && e.message);
          const reason = ((e && e.message) || "অজানা সমস্যা").replace(/\s+/g, " ").slice(0, 180);
          if (SHOW_ERRORS) await message.reply(`❌ ডাউনলোড করা গেল না:\n${link}\n\n⚙️ কারণ: ${reason}`);
        } finally {
          if (file && file.filepath) fs.remove(file.filepath).catch(() => {});
          if (smallPath) fs.remove(smallPath).catch(() => {});
        }
      });

      try { api.setMessageReaction(okCount ? "✅" : "❌", event.messageID, () => {}, true); } catch (_) {}
    } catch (err) {
      console.error("[autolink]", err);
    }
  }
};
