// code from goatstore
// api: https://omega-store-owe7.onrender.com
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const HARD_FALLBACK_BASE = "https://omega-store-owe7.onrender.com";
function envOverride() {
  const v = process.env.STORE_API_BASE;
  return v && v.startsWith("http") ? v.replace(/\/$/, "") : null;
}
let _apiBase = null;

async function getApiBase() {
  return envOverride() || HARD_FALLBACK_BASE;
}

async function storeGet(pathSuffix, config) {
  const base = await getApiBase();
  return await axios.get(`${base}${pathSuffix}`, config);
}

async function storePost(pathSuffix, data, config) {
  const base = await getApiBase();
  return await axios.post(`${base}${pathSuffix}`, data, config);
}

const premium = (function () {

  let state = { adminUid: null, premiumUsers: [], premiumCommands: [], premiumAuthors: [] };
  let _lastRefresh = 0;
  const REFRESH_INTERVAL = 1000 * 60 * 5;
  let _refreshing = null;

  function normUid(uid) { return String(uid == null ? "" : uid).trim(); }
  function normName(s) { return String(s == null ? "" : s).trim().toLowerCase(); }

  function refresh(force = false) {
    if (!force && Date.now() - _lastRefresh < REFRESH_INTERVAL) return Promise.resolve(state);
    if (_refreshing) return _refreshing;
    _refreshing = (async () => {
      try {
        const res = await storeGet(`/miraistore/premium`);
        if (res.data && !res.data.error) {
          state = {
            adminUid: res.data.adminUid || state.adminUid || null,
            premiumUsers: res.data.premiumUsers || [],
            premiumCommands: res.data.premiumCommands || [],
            premiumAuthors: res.data.premiumAuthors || []
          };
          _lastRefresh = Date.now();
        }
      } catch (_) {
      } finally {
        _refreshing = null;
      }
      return state;
    })();
    return _refreshing;
  }

  function isAdmin(senderId) { return !!state.adminUid && normUid(senderId) === state.adminUid; }

  function isPremiumUser(senderId) { return state.premiumUsers.some(u => normUid(u) === normUid(senderId)); }

  function isPremiumAuthor(author) { return state.premiumAuthors.some(a => normName(a) === normName(author)); }

  function isPremiumCmd(cmdName, author) {
    if (cmdName) {
      if (state.premiumCommands.some(c => normName(c) === normName(cmdName))) return true;
    }
    return isPremiumAuthor(author);
  }

  function isPremiumViewer(senderId) { return isAdmin(senderId) || isPremiumUser(senderId); }

  function isFiltered(cmdName, author, senderId) { return isPremiumCmd(cmdName, author) && !isPremiumViewer(senderId); }
  function canExecutePremium(senderId) { return isAdmin(senderId) || isPremiumUser(senderId); }
  function isAdminViewer(senderId) { return isAdmin(senderId); }

  async function mutate(action, value, senderId) {
    try {
      const res = await storePost(`/miraistore/premium`, { senderId, action, value });
      const data = res.data || {};
      if (Array.isArray(data.premiumUsers)) {
        state = {
          adminUid: data.adminUid || state.adminUid || null,
          premiumUsers: data.premiumUsers,
          premiumCommands: data.premiumCommands || [],
          premiumAuthors: data.premiumAuthors || []
        };
        _lastRefresh = Date.now();
      }
      if (data.error) return { ok: false, error: data.error };
      return { ok: data.ok !== false };
    } catch (e) {
      return { ok: false, error: e.response?.data?.error || "Premium API error." };
    }
  }

  async function addPremiumUser(uid, senderId) {
    const u = normUid(uid);
    if (!u) return { ok: false, error: "UID required" };
    if (isAdmin(u)) return { ok: false, error: "Admin is already premium by default" };
    return mutate("addUser", u, senderId);
  }

  async function removePremiumUser(uid, senderId) {
    const u = normUid(uid);
    if (!u) return { ok: false, error: "UID required" };
    return mutate("removeUser", u, senderId);
  }

  async function addPremiumCmd(cmdName, senderId) {
    const n = normName(cmdName);
    if (!n) return { ok: false, error: "Command name required" };
    return mutate("addCommand", n, senderId);
  }

  async function removePremiumCmd(cmdName, senderId) {
    const n = normName(cmdName);
    if (!n) return { ok: false, error: "Command name required" };
    return mutate("removeCommand", n, senderId);
  }

  async function addPremiumAuthor(author, senderId) {
    const a = normName(author);
    if (!a) return { ok: false, error: "Author name required" };
    return mutate("addAuthor", a, senderId);
  }

  async function removePremiumAuthor(author, senderId) {
    const a = normName(author);
    if (!a) return { ok: false, error: "Author name required" };
    return mutate("removeAuthor", a, senderId);
  }

  function listPremium() {
    return {
      adminUid: state.adminUid,
      premiumUsers: [...state.premiumUsers],
      premiumCommands: [...state.premiumCommands],
      premiumAuthors: [...state.premiumAuthors]
    };
  }

  refresh(true);

  return {
    isAdmin,
    isPremiumUser,
    isPremiumAuthor,
    isPremiumCmd,
    isPremiumViewer,
    canExecutePremium,
    isFiltered,
    isAdminViewer,
    addPremiumUser,
    removePremiumUser,
    addPremiumCmd,
    removePremiumCmd,
    addPremiumAuthor,
    removePremiumAuthor,
    listPremium,
    refresh
  };
})();


async function checkAbuseGuard(senderID) {
  try {
    const res = await storeGet(`/miraistore/ratelimit/status`, {
      params: { clientFp: senderID },
      timeout: 6000
    });
    return res.data || { blocked: false };
  } catch (_) {
    return { blocked: false };
  }
}

function formatDuration(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}h ${m}m ${s}s`;
}

const userSeenNoti = new Map();
const AUTOSYNC_CACHE_PATH = path.join(process.cwd(), "goatstore_sync_cache.json");
const DIR_CACHE_PATH = path.join(process.cwd(), "goatstore_dircache.json");

let _updateCheckCache = null;
const UPDATE_CHECK_INTERVAL = 1000 * 60 * 30;

const MAX_EDITS_PER_MESSAGE = 5;

function getPrefix(threadData) {
  try {
    if (threadData?.data?.prefix) return threadData.data.prefix;
    if (global.GoatBot?.config?.prefix) return global.GoatBot.config.prefix;
  } catch (_) {}
  return "!";
}

function loadSyncCache() {
  try { return JSON.parse(fs.readFileSync(AUTOSYNC_CACHE_PATH, "utf8")); }
  catch { return {}; }
}

function saveSyncCache(cache) {
  try { fs.writeFileSync(AUTOSYNC_CACHE_PATH, JSON.stringify(cache, null, 2)); }
  catch (_) {}
}

let _autoupdateInFlight = false;
let _autoSyncInFlight = false;
let _timersStarted = false;
const _installInFlight = new Set();
const _uploadInFlight = new Set();

function atomicWrite(filePath, content) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tempPath, content, "utf8");
  try { fs.renameSync(tempPath, filePath); }
  catch (err) { try { fs.unlinkSync(tempPath); } catch (_) {} throw err; }
}

async function stampUploadCode(code) {
  const apiBase = await getApiBase();
  return `// code from goatstore\n// api: ${apiBase}\n${code}`;
}

function hashContent(content) {
  let h = 0;
  for (let i = 0; i < content.length; i++) h = (h * 31 + content.charCodeAt(i)) | 0;
  return h.toString(16);
}

function parseVer(value) {
  const raw = String(value == null ? "" : value).trim().replace(/^v/i, "");
  const match = raw.match(/^(\d+(?:\.\d+)*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/);
  if (!match) return null;
  return { core: match[1].split(".").map(n => Number(n)), pre: match[2] || "" };
}

function cmpVer(a, b) {
  const pa = parseVer(a), pb = parseVer(b);
  if (!pa || !pb) return 0;
  for (let i = 0; i < Math.max(pa.core.length, pb.core.length); i++) {
    const d = (pa.core[i] || 0) - (pb.core[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  if (!pa.pre && pb.pre) return 1;
  if (pa.pre && !pb.pre) return -1;
  if (pa.pre === pb.pre) return 0;
  if (!pa.pre) return 0;
  const aa = pa.pre.split("."), bb = pb.pre.split(".");
  for (let i = 0; i < Math.max(aa.length, bb.length); i++) {
    if (aa[i] == null) return -1;
    if (bb[i] == null) return 1;
    if (aa[i] === bb[i]) continue;
    const an = /^\d+$/.test(aa[i]), bn = /^\d+$/.test(bb[i]);
    if (an && bn) return Number(aa[i]) > Number(bb[i]) ? 1 : -1;
    if (an !== bn) return an ? -1 : 1;
    return aa[i] > bb[i] ? 1 : -1;
  }
  return 0;
}

function extractConfigBlock(src) {
  const patterns = [/\bconfig\s*:\s*\{/, /module\.exports\.config\s*=\s*\{/];
  let idx = -1;
  for (const re of patterns) { const m = re.exec(src); if (m) { idx = m.index + m[0].lastIndexOf("{"); break; } }
  if (idx < 0) return src;
  let depth = 0, quote = null, escaped = false, lineComment = false, blockComment = false;
  for (let i = idx; i < src.length; i++) {
    const c = src[i], n = src[i + 1];
    if (lineComment) { if (c === "\n") lineComment = false; continue; }
    if (blockComment) { if (c === "*" && n === "/") { blockComment = false; i++; } continue; }
    if (quote) { if (escaped) escaped = false; else if (c === "\\") escaped = true; else if (c === quote) quote = null; continue; }
    if (c === "/" && n === "/") { lineComment = true; i++; continue; }
    if (c === "/" && n === "*") { blockComment = true; i++; continue; }
    if (c === "\"" || c === "'" || c === "`") { quote = c; continue; }
    if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return src.slice(idx, i + 1);
  }
  return src.slice(idx);
}

function readMetaValue(block, keys) {
  for (const key of keys) {
    const re = new RegExp("(?:\\b|[\"'])" + key + "[\"']?\\s*:\\s*([\"'`])([^\\n]*?)\\1", "i");
    const m = block.match(re);
    if (m && m[2].trim()) return m[2].trim();
  }
  return null;
}

function extractMetadata(src, fallbackName = "") {
  const block = extractConfigBlock(src);
  const name = readMetaValue(block, ["name"]) || fallbackName;
  const author = readMetaValue(block, ["author", "credits"]) || "Unknown";
  const version = readMetaValue(block, ["version"]) || "N/A";
  const category = readMetaValue(block, ["category"]) || "Uncategorized";
  return { name, author, version, category };
}

function detectFramework(code) {
  const configBlock = extractConfigBlock(code);

  const hasCredits    = /\bcredits\s*:/.test(configBlock);
  const hasPermission = /\bhasPerm(?:i)?ssion\s*[:(]/i.test(configBlock);
  if (hasCredits && hasPermission) return "mirai";

  const hasAuthor = /\bauthor\s*:/.test(configBlock);
  const hasRole   = /\brole\s*:/.test(configBlock);
  if (hasAuthor && hasRole) return "goat";

  const isGoatStructure =
    /module\.exports\s*=\s*\{/.test(code) &&
    /onStart\s*[:(]|onChat\s*[:(]|onLoad\s*[:(]/.test(code);
  if (isGoatStructure) return "goat";

  const isMiraiStructure =
    /module\.exports\.config\s*=/.test(code) ||
    /module\.exports\.run\s*=/.test(code);
  if (isMiraiStructure) return "mirai";

  return "other";
}


const EVENTS_NAME_PATTERNS = ["events", "event"];
const SCAN_SKIP_DIRS = new Set(["node_modules", ".git", ".cache", ".github", "dist", "build"]);

function loadDirCache() {
  try { return JSON.parse(fs.readFileSync(DIR_CACHE_PATH, "utf8")); }
  catch { return {}; }
}

function saveDirCache(cache) {
  try { fs.writeFileSync(DIR_CACHE_PATH, JSON.stringify(cache, null, 2)); }
  catch (_) {}
}

let _dirCache = loadDirCache();

function scanForDir(startDir, namePatterns, maxDepth = 2) {
  const queue = [{ dir: startDir, depth: 0 }];
  while (queue.length) {
    const { dir, depth } = queue.shift();
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { continue; }
    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      if (SCAN_SKIP_DIRS.has(ent.name)) continue;
      if (ent.name.startsWith(".")) continue;
      const lower = ent.name.toLowerCase();
      const full = path.join(dir, ent.name);
      if (namePatterns.includes(lower)) return full;
      if (depth < maxDepth) queue.push({ dir: full, depth: depth + 1 });
    }
  }
  return null;
}

function getCmdsDir(forceRescan = false) {
  if (!forceRescan && _dirCache.cmdsDir && fs.existsSync(_dirCache.cmdsDir)) return _dirCache.cmdsDir;
  const dir = __dirname;
  _dirCache.cmdsDir = dir;
  saveDirCache(_dirCache);
  return dir;
}

function getEventsDir(forceRescan = false) {
  if (!forceRescan && _dirCache.eventsDir && fs.existsSync(_dirCache.eventsDir)) return _dirCache.eventsDir;
  const cmdsDir = getCmdsDir(forceRescan);
  const parent = path.dirname(cmdsDir);
  const roots = [...new Set([parent, path.dirname(parent), process.cwd()])];
  let dir = null;
  for (const root of roots) {
    dir = scanForDir(root, EVENTS_NAME_PATTERNS, 3);
    if (dir) break;
  }
  if (!dir) dir = path.join(parent, "events");
  _dirCache.eventsDir = dir;
  saveDirCache(_dirCache);
  return dir;
}

function findLocalFile(fileName, kind) {
  const dirs = kind === "event" ? [getEventsDir()] : [getCmdsDir(), getEventsDir()];
  for (const dir of dirs) {
    const direct = path.join(dir, fileName);
    if (fs.existsSync(direct)) return { filePath: direct, dirs };
    const withExt = direct.endsWith(".js") ? null : direct + ".js";
    if (withExt && fs.existsSync(withExt)) return { filePath: withExt, dirs };
  }
  return { filePath: null, dirs };
}

function relDir(p) {
  const rel = path.relative(process.cwd(), p);
  return rel || ".";
}

function fileNotFoundMsg(fileName, dirs, prefix) {
  return (
    `❌ File not found: "${fileName}"\nSearched in:\n` +
    dirs.map(d => `• ${relDir(d)}`).join("\n") +
    `\n💡 Wrong location? Check with: ${prefix}gs dirs`
  );
}

async function checkSelfUpdate() {
  const now = Date.now();
  if (_updateCheckCache && (now - _updateCheckCache.checkedAt) < UPDATE_CHECK_INTERVAL)
    return _updateCheckCache.result;
  try {
    const res = await storeGet(`/miraistore/search?q=goatstore&limit=10&framework=goat&kind=command`);
    const cmds = Array.isArray(res.data?.commands) ? res.data.commands : [];
    const match =
      cmds.find(c => c.name?.toLowerCase() === "goatstore" && c.author === module.exports.config.author) ||
      cmds.find(c => c.name?.toLowerCase() === "goatstore");
    if (!match) { _updateCheckCache = { checkedAt: now, result: null }; return null; }
    const current = module.exports.config.version;
    const latest = match.version || "N/A";
    const result = {
      hasUpdate: cmpVer(latest, current) > 0,
      currentVersion: current,
      latestVersion: latest,
      latestId: match.id,
      description: match.description || match.changelog || ""
    };
    _updateCheckCache = { checkedAt: now, result };
    return result;
  } catch (_) { return null; }
}

async function getTodayUpdates(senderID = null) {
  try {
    const res = await storeGet(`/miraistore/list?limit=50&framework=goat&clientFp=${encodeURIComponent(senderID || "")}`);
    const today = new Date().toDateString();
    return (res.data.commands || [])
      .filter(cmd => new Date(cmd.uploadDate).toDateString() === today)
      .filter(cmd => premium.isPremiumViewer(senderID) || !premium.isPremiumCmd(cmd.name, cmd.author));
  } catch (_) { return []; }
}

async function getTrending(limit = 5) {
  const parse = d => Array.isArray(d) ? d : (Array.isArray(d?.commands) ? d.commands : null);
  try {
    const res = await storeGet(`/miraistore/trending?limit=${limit}`);
    const list = parse(res.data);
    if (list) return list.slice(0, limit);
  } catch (_) {}
  return null;
}

async function runAutoSync() {
  if (_autoSyncInFlight) return;
  _autoSyncInFlight = true;
  try { return await runAutoSyncInternal(); }
  finally { _autoSyncInFlight = false; }
}

async function runAutoSyncInternal() {
  const log = global.utils?.log || {
    info: (tag, msg) => console.log(`[${tag}] ${msg}`),
    warn: (tag, msg) => console.warn(`[${tag}] ${msg}`)
  };
  let uploaded = 0, updated = 0, skipped = 0, failed = 0, consecutiveErrors = 0;
  const folders = [
    { dir: getCmdsDir(), kind: "command" },
    { dir: getEventsDir(), kind: "event" }
  ].filter(f => fs.existsSync(f.dir));

  if (!folders.length) return;

  const cache = loadSyncCache();

  for (const { dir, kind } of folders) {
    const files = fs.readdirSync(dir).filter(f => f.endsWith(".js"));
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const cacheKey = `${kind}:${file}`;
      let content;
      try { content = fs.readFileSync(fullPath, "utf8"); } catch (_) { continue; }

      const hash = hashContent(content);
      if (cache[cacheKey] === hash) continue;

      try { new Function(content); } catch (_) { continue; }
      const fw = detectFramework(content);
      if (fw !== "goat") continue;

      try {
        const meta = extractMetadata(content, path.basename(file, ".js"));
        const author = meta.author;
        const displayName = meta.name || path.basename(file, ".js");
        const version = meta.version;
        const category = meta.category;
        if (!author || author === "Unknown" || !version || version === "N/A" || !parseVer(version)) {
          skipped++;
          continue;
        }
        const lookup = await storeGet(`/miraistore/search?q=${encodeURIComponent(displayName)}&limit=50&framework=goat&kind=${encodeURIComponent(kind)}`);
        const entries = Array.isArray(lookup.data?.commands) ? lookup.data.commands : [];
        const existing = entries.find(c => String(c.name || "").toLowerCase() === displayName.toLowerCase()
          && String(c.author || "").toLowerCase() === String(author).toLowerCase()
          && String(c.kind || kind) === String(kind)) || null;
        if (existing) {
          const cmp = cmpVer(version, existing.version);
          if (cmp <= 0) {
            skipped++;
            cache[cacheKey] = hash;
            continue;
          }
        }
        const stampedContent = await stampUploadCode(content);
        const body = {
          rawCode: stampedContent, framework: "goat", kind,
          name: displayName, author, version, category,
          ...(existing?.id != null ? { existingId: existing.id, expectedVersion: existing.version } : {})
        };
        const res = await storePost(`/miraistore/upload`, body);
        if (res.data?.error) {
          skipped++;
        } else if (res.data?.updated) {
          updated++;
          cache[cacheKey] = hash;
        } else {
          uploaded++;
          cache[cacheKey] = hash;
        }
        consecutiveErrors = 0;
      } catch (err) {
        failed++;
        if (++consecutiveErrors >= 5) {
          saveSyncCache(cache);
          return log.warn("GOATSTORE", `AutoSync stopped: store API unreachable (${err.response?.data?.error || err.message})`);
        }
      }

      await new Promise(r => setTimeout(r, 500));
    }
  }

  saveSyncCache(cache);
  if (uploaded || updated || failed || skipped)
    log.info("GOATSTORE", `AutoSync done — ${uploaded} uploaded, ${updated} updated, ${skipped} skipped, ${failed} failed`);
}

const buildBar = pct => "█".repeat(Math.floor(pct / 10)) + "░".repeat(10 - Math.floor(pct / 10));
const frames = ["◖", "◕", "◔", "◓", "◒", "◑", "◐"];

async function animateInstall(api, threadID, name) {
  const steps = [
    { label: "Downloading source",  pct: 30,  delay: 600 },
    { label: "Verifying integrity", pct: 60,  delay: 900 },
    { label: "Writing to disk",     pct: 85,  delay: 700 },
    { label: "Registering command", pct: 100, delay: 600 }
  ];
  const info = await api.sendMessage(`📦 Installing ${name}...\n\n◖ Fetching package info...\n[░░░░░░░░░░] 0%`, threadID);
  for (let i = 0; i < steps.length; i++) {
    await new Promise(r => setTimeout(r, steps[i].delay));
    await api.editMessage(`📦 Installing ${name}...\n\n${frames[i]} ${steps[i].label}...\n[${buildBar(steps[i].pct)}] ${steps[i].pct}%`, info.messageID);
  }
  return info.messageID;
}

async function animateUpload(api, threadID, name) {
  const steps = [
    { label: "Reading file",         pct: 30,  delay: 500 },
    { label: "Uploading directly",   pct: 70,  delay: 900 },
    { label: "Finalizing registration", pct: 100, delay: 500 }
  ];
  const info = await api.sendMessage(`📤 Uploading ${name}...\n\n◖ Preparing upload...\n[░░░░░░░░░░] 0%`, threadID);
  for (let i = 0; i < steps.length; i++) {
    await new Promise(r => setTimeout(r, steps[i].delay));
    await api.editMessage(`📤 Uploading ${name}...\n\n${frames[i]} ${steps[i].label}...\n[${buildBar(steps[i].pct)}] ${steps[i].pct}%`, info.messageID);
  }
  return info.messageID;
}

function autoloadCommand(filePath) {
  const registry = global.GoatBot?.commands;
  const before = registry instanceof Map ? new Map(registry) : null;
  try {
    delete require.cache[require.resolve(filePath)];
    const cmd = require(filePath);
    if (!cmd?.config?.name) throw new Error("Missing config.name.");
    const name = cmd.config.name.toLowerCase();
    registry.set(name, cmd);
    if (Array.isArray(cmd.config.aliases))
      cmd.config.aliases.forEach(a => registry.set(String(a).toLowerCase(), cmd));
    if (typeof cmd.onLoad === "function") cmd.onLoad({});
    return { success: true, name };
  } catch (err) {
    if (before && registry) { registry.clear(); for (const [k, v] of before) registry.set(k, v); }
    try { delete require.cache[require.resolve(filePath)]; } catch (_) {}
    return { success: false, reason: err.message };
  }
}

async function doInstall(api, threadID, senderID, id, forceKind = null) {
  const installKey = `${threadID}:${senderID}:${id}:${forceKind || "auto"}`;
  if (_installInFlight.has(installKey)) return;
  _installInFlight.add(installKey);
  try { return await doInstallInternal(api, threadID, senderID, id, forceKind); }
  finally { _installInFlight.delete(installKey); }
}

async function doInstallInternal(api, threadID, senderID, id, forceKind = null) {
  let cmdData = null;
  try {
    const res = await storeGet(`/miraistore/search?q=${encodeURIComponent(id)}&clientFp=${encodeURIComponent(senderID || "")}`);
    const data = res.data;
    if (!isNaN(id) && data?.rawCode && !Array.isArray(data)) cmdData = data;
    else if (Array.isArray(data?.commands)) cmdData = data.commands.find(c => String(c.id) === String(id));
    if (!cmdData?.rawCode) return api.sendMessage("❌ Command not found or rawCode missing.", threadID);
  } catch (err) {
    return api.sendMessage(err.response?.data?.message || "❌ Failed to fetch command info.", threadID);
  }

  if (cmdData.framework !== "goat")
    return api.sendMessage(
      `❌ This is not a GoatBot file!\n` +
      `├‣ Category : ${cmdData.framework || "unknown"}\n` +
      `╰────────────◊\n` +
      `⚠️ Only goat-framework commands/events can be installed here.`,
      threadID
    );

  try { new Function(cmdData.rawCode); }
  catch (err) { return api.sendMessage(`❌ Syntax error in remote code.\n${err.message}`, threadID); }

  if (premium.isPremiumCmd(cmdData.name, cmdData.author)    && !premium.canExecutePremium(senderID, cmdData.name, cmdData.author))    return api.sendMessage("*This command is premium only*", threadID);
  const displayName = cmdData.name || `gs_${id}`;
  const isEvent = forceKind === "event" ? true : forceKind === "command" ? false : cmdData.kind === "event";

  let pid;
  try { pid = await animateInstall(api, threadID, displayName); } catch (_) {}

  const fileName = displayName.replace(/\s+/g, "_") + ".js";
  const baseDir = process.cwd();
  const installDir = isEvent ? getEventsDir() : getCmdsDir();
  const filePath = path.join(installDir, fileName);
  const locLabel = path.relative(baseDir, filePath);

  try {
    if (!fs.existsSync(installDir)) fs.mkdirSync(installDir, { recursive: true });
    const existed = fs.existsSync(filePath);
    const previous = existed ? fs.readFileSync(filePath) : null;
    if (previous) atomicWrite(`${filePath}.bak`, previous.toString("utf8"));
    atomicWrite(filePath, cmdData.rawCode);
    if (!isEvent) {
      const loadCheck = autoloadCommand(filePath);
      if (!loadCheck.success) {
        if (previous) atomicWrite(filePath, previous.toString("utf8"));
        else { try { fs.unlinkSync(filePath); } catch (_) {} }
        if (pid) api.unsendMessage(pid);
        return api.sendMessage(`❌ Install rolled back. Registration failed: ${loadCheck.reason}`, threadID);
      }
    }
  } catch (err) {
    if (pid) api.unsendMessage(pid);
    return api.sendMessage(`❌ Failed to write file:\n${err.message}`, threadID);
  }

  try { await storePost(`/miraistore/install/${cmdData.id}`, { clientFp: senderID }); } catch (_) {}

  const load = isEvent ? { success: false } : { success: true, name: displayName };

  const msg =
    `✅ Installed Successfully!\n` +
    `╭─‣ Name : ${cmdData.name || "Unknown"}\n` +
    `├‣ Type : ${typeBadge(cmdData)}\n` +
    `├‣ Author : ${cmdData.author || "Unknown"}\n` +
    `├‣ Version : ${cmdData.version || "N/A"}\n` +
    `├‣ Category : ${cmdData.category || "N/A"}\n` +
    `├‣ ID : ${id}\n` +
    `├‣ Location : ${locLabel}\n` +
    `╰────────────◊\n` +
    (load.success ? `🚀 "${load.name}" is now live! No restart needed.`
      : isEvent ? `⚠️ Event saved. Restart bot to apply.`
      : `⚠️ Autoload failed: ${load.reason}`);

  if (pid) {
    try { await api.editMessage(msg, pid); setTimeout(() => api.unsendMessage(pid).catch(() => {}), 5000); }
    catch (_) { api.sendMessage(msg, threadID); }
  } else api.sendMessage(msg, threadID);
}

async function doSelfUpdateSilent(api, threadID, selfUpdate) {
  let cmdData = null;
  try {
    const res = await storeGet(`/miraistore/search?q=${encodeURIComponent(selfUpdate.latestId)}`);
    const data = res.data;
    // The API returns a single command object for ObjectId lookups and may
    // return a commands array for search responses. Accept both response shapes.
    if (data && !Array.isArray(data) && typeof data.rawCode === "string") {
      cmdData = data;
    } else if (Array.isArray(data?.commands)) {
      cmdData = data.commands.find(c => String(c.id) === String(selfUpdate.latestId)) || null;
    }
    if (!cmdData?.rawCode) return false;
  } catch (_) { return false; }

  try { new Function(cmdData.rawCode); }
  catch (_) { return false; }

  let previous;
  try {
    previous = fs.readFileSync(__filename);
    atomicWrite(`${__filename}.bak`, previous.toString("utf8"));
    atomicWrite(__filename, cmdData.rawCode);
  } catch (_) { return false; }

  const load = autoloadCommand(__filename);
  if (!load.success) {
    try { atomicWrite(__filename, previous.toString("utf8")); autoloadCommand(__filename); } catch (_) {}
    return false;
  }
  try { await storePost(`/miraistore/install/${cmdData.id}`, { }); } catch (_) {}

  const changelog = (cmdData.description || cmdData.changelog || "No changelog provided.").trim();

  if (api && threadID) {
    const msg =
      `♻️ Auto-Updated OmegA Store!\n` +
      `╭─‣ Version : v${cmdData.version || selfUpdate.latestVersion}\n` +
      `├‣ ID : ${cmdData.id}\n` +
      `╰────────────◊\n` +
      `📝 Changelog:\n${changelog}\n\n` +
      (load.success ? `🚀 Live now! No restart needed.` : `⚠️ Reload failed (${load.reason}) — restart bot to apply.`);
    api.sendMessage(msg, threadID).catch(() => {});
  }
  return true;
}

async function maybeAutoUpdate(api, threadID) {
  if (_autoupdateInFlight) return;
  const selfUpdate = await checkSelfUpdate();
  if (!selfUpdate?.hasUpdate) return;
  _autoupdateInFlight = true;
  try {
    await doSelfUpdateSilent(api, threadID, selfUpdate);
  } finally {
    _autoupdateInFlight = false;
  }
}

function typeBadge(cmd) {
  if (cmd.framework === "goat")  return cmd.kind === "event" ? "🐐 G-Event" : "🐐 G-Bot";
  if (cmd.framework === "mirai") return cmd.kind === "event" ? "🌌 Mirai-E" : "🌌 Mirai";
  return "📦 Other";
}

function authorLine(cmd) {
  const v = cmd.version && cmd.version !== "N/A" ? ` (v${cmd.version})` : "";
  return `${cmd.author || "Unknown"}${v}`;
}

function resultBlock(cmd) {
  const isP = premium.isPremiumCmd(cmd.name, cmd.author);
  const nameLine =isP ? `\u262F ${cmd.name}` : cmd.name;
  return (
    `╭─‣ ${nameLine} 〄\n` +
    `├‣ ID : ${cmd.id}\n` +
    `├‣ Type : ${typeBadge(cmd)}\n` +
    `├‣ Author : ${cmd.author || "Unknown"}\n` +
    `├‣ Version : ${cmd.version && cmd.version !== "N/A" ? ` ${cmd.version}` : " N/A"}\n` +
    `├‣ Category : ${cmd.category}\n` +
    `╰────────────◊\n` +
    ` ✰ Upload : ${new Date(cmd.uploadDate || Date.now()).toDateString()}\n\n`
  );
}

function listBlock(cmd) {
  const isP = premium.isPremiumCmd(cmd.name, cmd.author);
  const nameLine =isP ? `\u262F ${cmd.name}` : cmd.name;
  return (
    `╭─‣ ${nameLine} 〄\n` +
    `├‣ ID : ${cmd.id}\n` +
    `├‣ Author : ${cmd.author || "Unknown"}\n` +
    `├‣ Version : ${cmd.version && cmd.version !== "N/A" ? ` ${cmd.version}` : " N/A"}\n` +
    `├‣ Category : ${cmd.category}\n` +
    `╰────────────◊\n` +
    ` ✰ Upload : ${new Date(cmd.uploadDate || Date.now()).toDateString()}\n\n`
  );
}

async function sendListPage(api, threadID, senderID, kind, page, limit = 10, prefix = "!") {
  const offset = (page - 1) * limit;
  try {
    const res = await storeGet(`/miraistore/list?limit=${limit}&offset=${offset}&framework=goat&kind=${kind}&clientFp=${encodeURIComponent(senderID || "")}`);
    const data = res.data;
    if (!Array.isArray(data.commands) || !data.commands.length)
      return api.sendMessage("❌ OmegA Store • No results found for this page.", threadID);

    const totalPages = Math.ceil(data.total / limit);
    const label = kind === "event" ? "OmegA Store Events" : "OmegA Store Commands";
    let msg = `📂 ${label} — Page ${page}/${totalPages} (${data.total} total)\n\n`;
        data.commands.forEach(cmd => { if (premium.isFiltered(cmd.name, cmd.author, senderID)) return; msg += listBlock(cmd); });
    if (totalPages > 1) msg += `⏤͟͟͞͞  Page ${page}/${totalPages}\n╭‣ React or reply p ${page + 1 <= totalPages ? page + 1 : page} for nxt pg\n`;
    msg += `╰‣ reply in <id> for install`;

    const finalMsg = msg.trim();
    const sent = await api.sendMessage(finalMsg, threadID);
    {
      const h = { commandName: "goatstore", messageID: sent.messageID, listType: kind, page, totalPages, limit, mode: "list", senderID, editCount: 0 };
      global.GoatBot.onReply.set(sent.messageID, h);
      global.GoatBot.onReaction.set(sent.messageID, h);
    }
  } catch (_) { api.sendMessage("❌ List API error.", threadID); }
}


// Search strictly by file/command name and aliases only.
function matchesNameOrAliases(item, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return true;
  const name = String(item?.name || "").toLowerCase();
  const raw = item?.aliases ?? item?.alias ?? [];
  const aliases = Array.isArray(raw) ? raw : String(raw).split(/[,|]/);
  return name.includes(q) || aliases.some(a => String(a || "").trim().toLowerCase().includes(q));
}

function searchTitle(query, filterOpts) {
  if (filterOpts.author) return `👤 OmegA Store • Author: ${filterOpts.author}`;
  if (filterOpts.category && !query) return `📂 OmegA Store • Category: ${filterOpts.category}`;
  if (filterOpts.framework && !query) return `📂 OmegA Store • Category: ${filterOpts.framework}`;
  if (filterOpts.kind === "event" && !query) return `📂 OmegA Store • Events`;
  return `🔍 OmegA Store • Search: "${query}"`;
}

async function sendSearchPage(api, threadID, senderID, query, page, limit = 5, prefix = "!", filterOpts = {}) {
  try {
    // Fetch candidates, then discard matches found only in metadata.
    const fetchLimit = 100;
    let qs = `/miraistore/search?limit=${fetchLimit}&offset=0`;
    if (filterOpts.author) qs += `&author=${encodeURIComponent(filterOpts.author)}`;
    else qs += `&q=${encodeURIComponent(query || "")}`;
    if (filterOpts.framework) qs += `&framework=${filterOpts.framework}`;
    if (filterOpts.kind) qs += `&kind=${filterOpts.kind}`;
    if (filterOpts.category) qs += `&category=${encodeURIComponent(filterOpts.category)}`;
    qs += `&clientFp=${encodeURIComponent(senderID || "")}`;

    const res = await storeGet(qs);
    let commands = Array.isArray(res.data?.commands) ? res.data.commands : [];
    if (!filterOpts.author && query) commands = commands.filter(cmd => matchesNameOrAliases(cmd, query));
    commands = commands.filter(cmd => !premium.isFiltered(cmd.name, cmd.author, senderID));
    if (!commands.length) return api.sendMessage(`❌ No results found${query ? ` for "${query}"` : ""}.`, threadID);

    const total = commands.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    if (page > totalPages) return api.sendMessage("❌ No results found for this page.", threadID);
    const pageCommands = commands.slice((page - 1) * limit, page * limit);
    const title = searchTitle(query, filterOpts);
    let msg = `${title} (${total} found)\n\n`;
    pageCommands.forEach(cmd => { msg += resultBlock(cmd); });
    if (totalPages > 1) msg += `⏤͟͟͞͞  Page ${page}/${totalPages}\n╭‣ React or reply p ${page + 1 <= totalPages ? page + 1 : page} for nxt pg\n`;
    msg += `╰‣ reply in <id> for install`;

    const sent = await api.sendMessage(msg.trim(), threadID);
    const h = {
      commandName: "goatstore", messageID: sent.messageID, query,
      authorQuery: filterOpts.author || null, framework: filterOpts.framework || null,
      kind: filterOpts.kind || null, category: filterOpts.category || null,
      page, totalPages, limit, mode: "search", senderID, editCount: 0
    };
    global.GoatBot.onReply.set(sent.messageID, h);
    if (totalPages > 1) global.GoatBot.onReaction.set(sent.messageID, h);
  } catch (err) {
    api.sendMessage(err.response?.data?.message || "❌ Search API error.", threadID);
  }
}

async function renderListPageInto(messageID, kind, page, limit, senderID = null) {
  const offset = (page - 1) * limit;
  const res = await storeGet(`/miraistore/list?limit=${limit}&offset=${offset}&framework=goat&kind=${kind}&clientFp=${encodeURIComponent(senderID || "")}`);
  const data = res.data;
  if (!Array.isArray(data.commands) || !data.commands.length) return null;

  const totalPages = Math.ceil(data.total / limit);
  const label = kind === "event" ? "OmegA Store Events" : "OmegA Store Commands";
  let msg = `📂 ${label} — Page ${page}/${totalPages} (${data.total} total)\n\n`;
  data.commands.forEach(cmd => { if (premium.isFiltered(cmd.name, cmd.author, senderID)) return; msg += listBlock(cmd); });
  if (totalPages > 1) msg += `⏤͟͟͞͞  Page ${page}/${totalPages}\n╭‣ React or reply p ${page + 1 <= totalPages ? page + 1 : page} for nxt pg\n`;
  msg += `╰‣ reply in <id> for install`;
  return { text: msg.trim(), totalPages };
}

async function renderSearchPageInto(query, page, limit, filterOpts = {}, senderID = null) {
  const fetchLimit = 100;
  let qs = `/miraistore/search?limit=${fetchLimit}&offset=0`;
  if (filterOpts.author) qs += `&author=${encodeURIComponent(filterOpts.author)}`;
  else qs += `&q=${encodeURIComponent(query || "")}`;
  if (filterOpts.framework) qs += `&framework=${filterOpts.framework}`;
  if (filterOpts.kind) qs += `&kind=${filterOpts.kind}`;
  if (filterOpts.category) qs += `&category=${encodeURIComponent(filterOpts.category)}`;
  qs += `&clientFp=${encodeURIComponent(senderID || "")}`;

  const res = await storeGet(qs);
  let commands = Array.isArray(res.data?.commands) ? res.data.commands : [];
  if (!filterOpts.author && query) commands = commands.filter(cmd => matchesNameOrAliases(cmd, query));
  commands = commands.filter(cmd => !premium.isFiltered(cmd.name, cmd.author, senderID));
  if (!commands.length) return null;

  const total = commands.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  if (page > totalPages) return null;
  const pageCommands = commands.slice((page - 1) * limit, page * limit);
  const title = searchTitle(query, filterOpts);
  let msg = `${title} (${total} found)\n\n`;
  pageCommands.forEach(cmd => { msg += resultBlock(cmd); });
  if (totalPages > 1) msg += `⏤͟͟͞͞  Page ${page}/${totalPages}\n╭‣ React or reply p ${page + 1 <= totalPages ? page + 1 : page} for nxt pg\n`;
  msg += `╰‣ reply in <id> for install`;
  return { text: msg.trim(), totalPages };
}

async function uploadFile(api, threadID, filePath, kind, senderID = null) {
  const uploadKey = `${threadID}:${filePath}:${kind}`;
  if (_uploadInFlight.has(uploadKey)) return;
  _uploadInFlight.add(uploadKey);
  try { return await uploadFileInternal(api, threadID, filePath, kind, senderID); }
  finally { _uploadInFlight.delete(uploadKey); }
}

async function uploadFileInternal(api, threadID, filePath, kind, senderID = null) {
  let data;
  try { data = fs.readFileSync(filePath, "utf8"); }
  catch (err) { return api.sendMessage(`❌ Read failed:\n${err.message}`, threadID); }

  try { new Function(data); }
  catch (err) { return api.sendMessage(`❌ Syntax Error:\n${err.message}`, threadID); }

  const meta = extractMetadata(data, path.basename(filePath, ".js"));
  const displayName = meta.name || path.basename(filePath, ".js");
  const detected = detectFramework(data);
  if (detected !== "goat")
    return api.sendMessage(
      `❌ Only GoatBot files can be uploaded here.\n` +
      `├‣ Detected : "${detected}" (this looks like a ${detected === "mirai" ? "Mirai" : "plain script"} file)\n` +
      `╰────────────◊`,
      threadID
    );

  if (!meta.version || meta.version === "N/A" || !parseVer(meta.version))
    return api.sendMessage(`❌ Valid version missing in config for ${displayName}.`, threadID);

  // Client-side preflight. The backend must enforce this atomically to prevent race conditions.
  let existingEntry = null;
  try {
    const lookup = await storeGet(`/miraistore/search?q=${encodeURIComponent(displayName)}&limit=50&framework=goat&kind=${encodeURIComponent(kind)}`);
    const entries = Array.isArray(lookup.data?.commands) ? lookup.data.commands : [];
    existingEntry = entries.find(c => String(c.name || "").toLowerCase() === displayName.toLowerCase()
      && String(c.author || "").toLowerCase() === String(meta.author || "").toLowerCase()
      && String(c.kind || kind) === String(kind)) || null;
    if (existingEntry) {
      const cmp = cmpVer(meta.version, existingEntry.version);
      if (cmp === 0) return api.sendMessage(`ℹ️ ${displayName} is already at v${existingEntry.version}. No duplicate created.`, threadID);
      if (cmp < 0) return api.sendMessage(`⛔ Older version rejected. Store has v${existingEntry.version}; your file is v${meta.version}.`, threadID);
    }
  } catch (err) {
    // Continue only because the backend remains the final authority for duplicate/version rules.
  }

  let pid;
  try { pid = await animateUpload(api, threadID, displayName); } catch (_) {}

  try {
    const stampedData = await stampUploadCode(data);
    const body = {
      rawCode: stampedData, framework: "goat", kind,
      name: displayName, author: meta.author, version: meta.version,
      category: meta.category,
      ...(existingEntry?.id != null ? { existingId: existingEntry.id, expectedVersion: existingEntry.version } : {})
    };
    if (senderID) { body.uploaderID = senderID; body.clientFp = senderID; }
    const res = await storePost(`/miraistore/upload`, body);

    if (["Already exists", "Version already exists", "Version too low", "Not allowed", "Upload blocked"].includes(res.data?.error)) {
      if (pid) api.unsendMessage(pid);
      return api.sendMessage(
        `⚠️ Upload Blocked!\n` +
        `╭─‣ Name : ${displayName}\n` +
        (res.data.id ? `├‣ ID : ${res.data.id}\n` : "") +
        (res.data.currentVersion ? `├‣ Current : v${res.data.currentVersion}\n` : "") +
        `╰────────────◊\n` +
        `💡 ${res.data.message}`,
        threadID
      );
    }

    if (res.data?.olderVersion || res.data?.sameVersion || res.data?.duplicate) {
      if (pid) api.unsendMessage(pid);
      const status = res.data.olderVersion ? "Older version rejected" : "Same version already exists";
      return api.sendMessage(`⛔ ${status}. ${res.data.message || "No new Store entry was created."}`, threadID);
    }

    if (res.data?.error) {
      if (pid) api.unsendMessage(pid);
      return api.sendMessage(
        `⚠️ Upload Failed!\n` +
        `╭─‣ Name : ${displayName}\n` +
        `├‣ Error : ${res.data.error}\n` +
        `╰────────────◊\n` +
        `💡 ${res.data.message || "MiraiStore backend register korte parenai. Backend/API side check koro."}`,
        threadID
      );
    }

    const author = meta.author;
    const version = meta.version;
    const category = meta.category;

    let header = "✅ Upload Successful!";
    let note = "";
    if (res.data.updated) {
      header = "🔄 Updated Existing Entry (Overwritten)!";
      note = `💡 ${res.data.message}\n`;
    }

    const msg =
      `${header}\n` +
      `╭─‣ Name : ${displayName}\n` +
      `├‣ Type : ${res.data.type || `goat-${kind}`}\n` +
      `├‣ Version : ${version}\n` +
      `├‣ Author : ${author}\n` +
      `├‣ Category : ${category}\n` +
      `├‣ ID : ${res.data.id}\n` +
      `╰────────────◊\n` +
      note +
      `⭔ Upload : ${new Date().toDateString()}`;
    if (pid) { try { await api.editMessage(msg, pid); } catch (_) { api.sendMessage(msg, threadID); } }
    else api.sendMessage(msg, threadID);
  } catch (err) {
    if (pid) api.unsendMessage(pid);
    api.sendMessage(
      `⚠️ Store API Call Fail Korlo!\n` +
      `├‣ Error : ${err.response?.data?.error || err.message}\n` +
      `╰────────────◊\n` +
      `💡 ${err.response?.data?.message || "Request fail hoyeche, MiraiStore backend / network check koro."}`,
      threadID
    );
  }
}

module.exports = {
  config: {
    name: "goatstore",
    aliases: ["gs", "cmdstore", "commandstore"],
    version: "3.0.0",
    author: "NirZon",
    countDown: 3,
    role: 2,
    shortDescription: "OmegA Store — Search, AutoUpdate, Install, Upload, AutoSync",
    longDescription: "Browse, install, upload, and autosync commands and events from OmegA Store. Auto-detects your cmds/events folder naming. The bare-menu shows only the daily-use commands — every subcommand lives here in the guide.",
    category: "system",
    guide: {
      en:
        "{pn} — Menu / Notifications\n" +
        "{pn} <id | file name> — Search commands only\n" +
        "{pn} -a <name> — All files by an author\n" +
        "{pn} -c <goat|mirai|other|category> — Browse a framework or category\n" +
        "{pn} -e <name> — Search events\n" +
        "{pn} -e install <id> — Install as event\n" +
        "{pn} -e upload <fileName> — Upload an event file\n" +
        "{pn} n — Today's updates\n" +
        "{pn} list [page] — Command list\n" +
        "{pn} list event [page] — Event list\n" +
        "{pn} install <id> — Install a command\n" +
        "{pn} like <id> — Like\n" +
        "{pn} trend — Trending\n" +
        "{pn} upload <fileName> — Upload a command file\n" +
        "{pn} sync — Manual sync\n" +
        "{pn} dirs — Show & re-detect cmds/events locations\n" +
        "{pn} pr add <uid> — Add premium user (admin, or reply to a msg)\n" +
        "{pn} pr remove <uid> — Remove premium user (admin)\n" +
        "{pn} pr upload <cmdname> — Mark a command premium (admin)\n" +
        "{pn} pr delete <cmdname> — Unmark a command (admin)\n" +
        "{pn} pr author add|remove <authorname> — Premium by author (admin)\n" +
        "{pn} pr list — Show premium state (admin)\n" +
        "Reply \"in\" to a single result — Install\n" +
        "Reply \"in <id>\" to a list result — Install"
    },
    autoSync: true
  },

  onLoad: function () {
    if (_timersStarted) return;
    _timersStarted = true;
    setTimeout(() => {
      premium.refresh(true).catch(() => {});
      setInterval(() => { premium.refresh(true).catch(() => {}); }, 1000 * 60 * 5);
    }, 5000);
    setTimeout(() => {
      maybeAutoUpdate(null, null).catch(() => {});
      setInterval(() => { maybeAutoUpdate(null, null).catch(() => {}); }, UPDATE_CHECK_INTERVAL);
    }, 6000);
    if (module.exports.config.autoSync) {
      const ONE_DAY = 1000 * 60 * 60 * 24;
      setTimeout(() => {
        runAutoSync().catch(() => {});
        setInterval(() => { runAutoSync().catch(() => {}); }, ONE_DAY);
      }, 8000);
    }
  },

  onReply: async function ({ api, event, Reply }) {
    const { threadID, body, senderID } = event;

    const inIdMatch = body.match(/^in\s+(\d+)$/i);
    const inBareMatch = /^in$/i.test(body.trim());
    if (inIdMatch) return doInstall(api, threadID, senderID, inIdMatch[1], null);
    if (inBareMatch && Reply?.singleId) return doInstall(api, threadID, senderID, Reply.singleId, null);

    const delMatch = body.match(/^(?:rmv|delete|remove)\s+(\S+)(?:\s+(\S+))?/i);
    if (delMatch) {
      const [, delId, delSecret] = delMatch;
      try {
        const payload = delSecret ? { secret: delSecret, userID: senderID } : { userID: senderID };
        const res = await storePost(`/miraistore/delete/${delId}`, payload);
        if (res.data?.error) return api.sendMessage(`❌ ${res.data.error}`, threadID);
        return api.sendMessage(`🗑️ Deleted! ID: ${delId}`, threadID);
      } catch (_) { return api.sendMessage("❌ Delete API error.", threadID); }
    }

    const { mode, query, listType, authorQuery, framework, kind, category, page, totalPages, limit, senderID: origSender } = Reply;
    if (senderID !== origSender) return;
    const match = body.match(/^page (\d+)$/i);
    if (!match) return;
    const newPage = parseInt(match[1]);
    if (newPage < 1 || newPage > totalPages)
      return api.sendMessage(`❌ Page must be between 1 and ${totalPages}.`, threadID);
    api.unsendMessage(Reply.messageID).catch(() => {});
    const prefix = getPrefix(event.threadData);
    if (mode === "list") await sendListPage(api, threadID, senderID, listType, newPage, limit, prefix);
    else await sendSearchPage(api, threadID, senderID, query, newPage, limit, prefix, { author: authorQuery, framework, kind, category });
  },

  onChat: async function ({ api, event }) {
    const { threadID, senderID, body, messageReply } = event;
    if (!body || !messageReply) return;
    const text = body.trim();

    const inMatch  = text.match(/^in\s+(\d+)$/i);
    const rmvMatch = text.match(/^(?:rmv|remove)\s+(\d+)(?:\s+(\S+))?$/i);
    if (!inMatch && !rmvMatch) return;

    let isBotMsg = false;
    try { isBotMsg = String(messageReply.senderID) === String(api.getCurrentUserID()); } catch (_) {}
    if (!isBotMsg) return;
    const repliedBody = messageReply.body || "";
    if (!/〄|🔍|📂|MiraiStore|GoatBot Store/i.test(repliedBody)) return;

    if (inMatch) return doInstall(api, threadID, senderID, inMatch[1], null);

    const [, id, secret] = rmvMatch;
    try {
      const payload = secret ? { secret, userID: senderID } : { userID: senderID };
      const res = await storePost(`/miraistore/delete/${id}`, payload);
      if (res.data?.error) return api.sendMessage(`❌ ${res.data.error}`, threadID);
      return api.sendMessage(`🗑️ Deleted! ID: ${id}`, threadID);
    } catch (_) { return api.sendMessage("❌ Delete API error.", threadID); }
  },

  onReaction: async function ({ api, event, Reaction }) {
    const { threadID, userID } = event;

    const { mode, query, listType, authorQuery, framework, kind, category, page, totalPages, limit, senderID, messageID, editCount = 0 } = Reaction;
    if (userID !== senderID) return;
    if (page >= totalPages) return api.sendMessage("✅ Already on the last page.", threadID);

    const nextPage = page + 1;

    try {
      const rendered = mode === "list"
        ? await renderListPageInto(messageID, listType, nextPage, limit, senderID)
        : await renderSearchPageInto(query, nextPage, limit, { author: authorQuery, framework, kind, category }, senderID);

      if (!rendered) return api.sendMessage("❌ OmegA Store • No results found for this page.", threadID);

      if (editCount >= MAX_EDITS_PER_MESSAGE) {
        const sent = await api.sendMessage(rendered.text, threadID);
        const h = { commandName: "goatstore", messageID: sent.messageID, listType, query, authorQuery, framework, kind, category, page: nextPage, totalPages: rendered.totalPages, limit, mode, senderID, editCount: 0 };
        global.GoatBot.onReply.set(sent.messageID, h);
        global.GoatBot.onReaction.set(sent.messageID, h);
      } else {
        await api.editMessage(rendered.text, messageID);
        const h = { commandName: "goatstore", messageID, listType, query, authorQuery, framework, kind, category, page: nextPage, totalPages: rendered.totalPages, limit, mode, senderID, editCount: editCount + 1 };
        global.GoatBot.onReply.set(messageID, h);
        global.GoatBot.onReaction.set(messageID, h);
      }
    } catch (_) {
      api.unsendMessage(messageID).catch(() => {});
      const prefix = getPrefix(event.threadData);
      if (mode === "list") await sendListPage(api, threadID, senderID, listType, nextPage, limit, prefix);
      else await sendSearchPage(api, threadID, senderID, query, nextPage, limit, prefix, { author: authorQuery, framework, kind, category });
    }
  },

  onStart: async function ({ api, event, args, threadData }) {
    const { threadID, senderID } = event;

    const guard = await checkAbuseGuard(senderID);
    if (guard.blocked) {
      return api.sendMessage(
        `⚠️ Abnormal activity detected on your account.\n` +
        `OmegA Store access is suspended for ${formatDuration(guard.remainingSeconds || 0)}.`,
        threadID
      );
    }

    const sub = args[0]?.toLowerCase() || null;
    const prefix = getPrefix(threadData || event?.threadData);



    if (sub === "pr" || sub === "premium") {
      if (!premium.isAdmin(senderID)) return api.sendMessage("*store admin only cmd*", threadID);

      const pSub = args[1]?.toLowerCase() || null;
      const resolveUid = () => {
        if (args[2]) return args[2];
        if (event.messageReply?.senderID) return event.messageReply.senderID;



        return null;
      };

      if (pSub === "add") {
        const uid = resolveUid();
        if (!uid) return api.sendMessage(`❌ Usage: ${prefix}gs pr add <uid> (or reply to a message)`, threadID);
        const r = await premium.addPremiumUser(uid, senderID);
        return api.sendMessage(r.ok ? `✅ Premium user added: ${uid}` : `❌ ${r.error}`, threadID);
      }

      if (pSub === "remove" || pSub === "rm") {
        const uid = resolveUid();
        if (!uid) return api.sendMessage(`❌ Usage: ${prefix}gs pr remove <uid> (or reply to a message)`, threadID);
        const r = await premium.removePremiumUser(uid, senderID);
        return api.sendMessage(r.ok ? `✅ Premium user removed: ${uid}` : `❌ ${r.error}`, threadID);
      }

      if (pSub === "upload") {
        const cmdName = args.slice(2).join(" ");
        if (!cmdName) return api.sendMessage(`❌ Usage: ${prefix}gs pr upload <cmdname>`, threadID);
        const r = await premium.addPremiumCmd(cmdName, senderID);
        return api.sendMessage(r.ok ? `✅ "${cmdName}" is now a premium command` : `❌ ${r.error}`, threadID);
      }

      if (pSub === "delete" || pSub === "del") {
        const cmdName = args.slice(2).join(" ");
        if (!cmdName) return api.sendMessage(`❌ Usage: ${prefix}gs pr delete <cmdname>`, threadID);
        const r = await premium.removePremiumCmd(cmdName, senderID);
        return api.sendMessage(r.ok ? `✅ Premium status removed from "${cmdName}"` : `❌ ${r.error}`, threadID);
      }

      if (pSub === "author") {
        const aSub = args[2]?.toLowerCase() || null;
        const authorName = args.slice(3).join(" ");
        if (aSub === "add") {
          if (!authorName) return api.sendMessage(`❌ Usage: ${prefix}gs pr author add <authorname>`, threadID);
          const r = await premium.addPremiumAuthor(authorName, senderID);
          return api.sendMessage(r.ok ? `✅ All commands by "${authorName}" are now premium` : `❌ ${r.error}`, threadID);
        }
        if (aSub === "remove" || aSub === "rm") {
          if (!authorName) return api.sendMessage(`❌ Usage: ${prefix}gs pr author remove <authorname>`, threadID);
          const r = await premium.removePremiumAuthor(authorName, senderID);
          return api.sendMessage(r.ok ? `✅ Premium status removed from author "${authorName}"` : `❌ ${r.error}`, threadID);
        }
        return api.sendMessage(`❌ Usage: ${prefix}gs pr author add|remove <authorname>`, threadID);
      }

      if (pSub === "list" || pSub === "ls") {
        const s = premium.listPremium();
        const fmt = a => a.length ? a.map(x => `• ${x}`).join("\n") : "—";
        return api.sendMessage(
          `👑 Store Admin: ${s.adminUid}\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `👤 Premium Users:\n${fmt(s.premiumUsers)}\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `☯ Premium Commands:\n${fmt(s.premiumCommands)}\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `⛨ Premium Authors:\n${fmt(s.premiumAuthors)}`,
          threadID
        );
      }

      return api.sendMessage(
        `📜 Premium Manager\n` +
        `• ${prefix}gs pr add <uid>\n` +
        `• ${prefix}gs pr remove <uid>\n` +
        `• ${prefix}gs pr upload <cmdname>\n` +
        `• ${prefix}gs pr delete <cmdname>\n` +
        `• ${prefix}gs pr author add|remove <authorname>\n` +
        `• ${prefix}gs pr list — show premium state\n` +
        `• ${prefix}gs transfer <cmdname>`,
        threadID
      );
    }

    if (sub === "transfer") {
      if (!premium.isAdmin(senderID)) return api.sendMessage("*store admin only cmd*", threadID);

      const cmdName = args.slice(1).join(" ").trim();
      if (!cmdName) return api.sendMessage(`❌ Usage: ${prefix}gs transfer <cmdname>`, threadID);

      let matched = null;
      try {
        const res = await storeGet(`/miraistore/search?q=${encodeURIComponent(cmdName)}&kind=command&clientFp=${encodeURIComponent(senderID || "")}`);
        const list = res.data?.commands || [];
        const norm = s => String(s == null ? "" : s).trim().toLowerCase();
        matched = list.find(c => norm(c.name) === norm(cmdName)) || null;
      } catch (_) {
      }

      if (!matched) {
        return api.sendMessage(
          `⚠️ No public store command named "${cmdName}" found (exact match). ` +
          `Marking it premium anyway — double-check the spelling.`,
          threadID
        );
      }
      if (premium.isPremiumCmd(matched.name, matched.author)) {
        return api.sendMessage(`❌ "${matched.name}" is already premium.`, threadID);
      }

      const r = await premium.addPremiumCmd(matched.name, senderID);
      return api.sendMessage(
        r.ok
          ? `✅ "${matched.name}" (by ${matched.author}) moved from public store to premium.`
          : `❌ ${r.error}`,
        threadID
      );
    }


    maybeAutoUpdate(api, threadID).catch(() => {});

    if (!sub) {
      const updates = await getTodayUpdates(senderID);

      if (updates.length && !userSeenNoti.get(senderID)) {
        let n = `🔔 [ OmegA STORE NOTIFICATION ]\nToday ${updates.length} OmegA Store update(s)!\n━━━━━━━━━━━━━━━━━━\n`;
        updates.forEach(f => { if (premium.isFiltered(f.name, f.author, senderID)) return; n += ` ‣ ${f.name} (ID: ${f.id})\n`; });
        n += `\n(Type "${prefix}gs n" for details or "${prefix}gs" again for menu)`;
        userSeenNoti.set(senderID, true);
        return api.sendMessage(n, threadID);
      }

      const menuMsg =
        `╭━━━━━━━━━━━━━━━━━━━━╮\n` +
        `       📦 𝗢𝗠𝗘𝗚𝗔 𝗦𝗧𝗢𝗥𝗘\n` +
        `      ✦ PUBLIC COMMAND HUB ✦\n` +
        `╰━━━━━━━━━━━━━━━━━━━━╯\n` +
        `╭─ 🔎 𝗘𝗫𝗣𝗟𝗢𝗥𝗘 𝗦𝗧𝗢𝗥𝗘\n` +
        `┊ ${prefix}gs <name/id>  › Search command\n` +
        `┊ ${prefix}gs list [page]  › Command list\n` +
        `┊ ${prefix}gs list event [page]  › Event list\n` +
        `┊ ${prefix}gs -e <name>  › Search events\n` +
        `┊ ${prefix}gs -a <author>  › Author files\n` +
        `┊ ${prefix}gs -c <category>  › Category\n` +
        `╰━━━━━━━━━━━━━━━━━━━━╯\n\n` +
        `╭─ ⚡ 𝗜𝗡𝗦𝗧𝗔𝗟𝗟 & 𝗧𝗥𝗘𝗡𝗗𝗜𝗡𝗚\n` +
        `┊ ${prefix}gs install <id>  › Install command\n` +
        `┊ ${prefix}gs -e install <id>  › Install event\n` +
        `┊ ${prefix}gs like <id>  › Like a command\n` +
        `┊ ${prefix}gs trend  › Trending commands\n` +
        `┊ ${prefix}gs n  › Today's updates\n` +
        `╰━━━━━━━━━━━━━━━━━━━━╯\n\n` +
        `╭─ 🛠️ 𝗨𝗣𝗟𝗢𝗔𝗗 & 𝗠𝗔𝗡𝗔𝗚𝗘\n` +
        `┊ ${prefix}gs upload <file>  › Upload command\n` +
        `┊ ${prefix}gs -e upload <file>  › Upload event\n` +
        `┊ ${prefix}gs sync  › Manual file sync\n` +
        `┊ ${prefix}gs dirs  › Detect bot folders\n` +
        `╰━━━━━━━━━━━━━━━━━━━━╯\n\n` +
        `💡 𝗤𝗨𝗜𝗖𝗞 𝗧𝗜𝗣\n` +
        `Reply "in" to a search result to install it.\n` +
        `Use ${prefix}gs help for the full command guide.\n\n` +
        `       🌐 Powered by OmegA Store`;
      await api.sendMessage(menuMsg, threadID);
      return;
    }

    if (sub === "n" || sub === "notification") {
      const updates = await getTodayUpdates(senderID);
      if (!updates.length)
        return api.sendMessage("📅 No OmegA Store updates today.", threadID);
      let msg = `📂 Today's OmegA Store Updates\n━━━━━━━━━━━━━━━━━━\n`;
      updates.forEach(cmd => {
        if (premium.isFiltered(cmd.name, cmd.author, senderID)) return;
        msg += `╭─‣ ${cmd.name}\n├‣ ID: ${cmd.id}\n├‣ Type: ${typeBadge(cmd)}\n├‣ Author: ${cmd.author}\n╰────────────◊\n\n`;  });
      await api.sendMessage(msg.trim(), threadID);
      return;
    }

    if (sub === "sync") {
      api.sendMessage("🔄 Starting manual sync...", threadID);
      try {
        await runAutoSync();
        api.sendMessage("✅ Sync complete.", threadID);
      } catch (err) {
        api.sendMessage(`❌ Sync failed: ${err.message}`, threadID);
      }
      return;
    }

    if (sub === "dirs") {
      const cmdsDir = getCmdsDir(true);
      const eventsDir = getEventsDir(true);
      const countJs = d => { try { return fs.readdirSync(d).filter(f => f.endsWith(".js")).length; } catch { return null; } };
      const cc = countJs(cmdsDir), ec = countJs(eventsDir);
      const msg =
        `📁 Auto-detected Locations\n` +
        `╭─‣ Commands : ${relDir(cmdsDir)}${cc !== null ? ` (${cc} .js files)` : " — not found"}\n` +
        `├‣ Events    : ${relDir(eventsDir)}${ec !== null ? ` (${ec} .js files)` : " — not found"}\n` +
        `╰────────────◊\n` +
        `♻️ Auto-detect re-ran • AutoSync: ${module.exports.config.autoSync ? "ON ✅" : "OFF ❌"}`;
      return api.sendMessage(msg, threadID);
    }

    if (sub === "list" || sub === "ls") {
      const isEvent = args[1]?.toLowerCase() === "event";
      const page = Math.max(1, Number(isEvent ? args[2] : args[1]) || 1);
      return sendListPage(api, threadID, senderID, isEvent ? "event" : "command", page, 10, prefix);
    }

    if (sub === "-e" || sub === "--event" || sub === "event") {
      const action = args[1]?.toLowerCase();

      if (action === "install") {
        const id = args[2];
        if (!id) return api.sendMessage(`❌ Usage: ${prefix}gs -e install <id>`, threadID);
        return doInstall(api, threadID, senderID, id, "event");
      }

      if (action === "upload") {
        const fileName = args[2];
        if (!fileName) return api.sendMessage(`❌ Usage: ${prefix}gs -e upload <fileName>`, threadID);
        const { filePath, dirs } = findLocalFile(fileName, "event");
        if (!filePath) return api.sendMessage(fileNotFoundMsg(fileName, dirs, prefix), threadID);
        return uploadFile(api, threadID, filePath, "event", senderID);
      }

      if (!action) {
        try {
          const res = await storeGet(`/miraistore/list?limit=20&framework=goat&kind=event&clientFp=${encodeURIComponent(senderID || "")}`);
          const events = res.data.commands || [];
          if (!events.length) return api.sendMessage("❌ No OmegA Store events found.", threadID);
          let msg = `📂 OmegA Store Events (${res.data.total})\n\n`;
          events.forEach(cmd => {
            if (premium.isFiltered(cmd.name, cmd.author, senderID)) return;
            msg += `╭─‣ ${cmd.name}\n├‣ ID : ${cmd.id}\n├‣ Author : ${authorLine(cmd)}\n╰────────────◊\n\n`;
          });
          msg += `💡 Use: ${prefix}gs -e install <id>`;
          await api.sendMessage(msg.trim(), threadID);
          return;
        } catch (_) { return api.sendMessage("❌ Event list API error.", threadID); }
      }

      try {
        const res = await storeGet(`/miraistore/search?q=${encodeURIComponent(action)}&limit=100&offset=0&framework=goat&kind=event&clientFp=${encodeURIComponent(senderID || "")}`);
        const events = (res.data.commands || [])
          .filter(cmd => matchesNameOrAliases(cmd, action))
          .filter(cmd => !premium.isFiltered(cmd.name, cmd.author, senderID));
        if (!events.length) return api.sendMessage(`❌ No OmegA Store event found: "${action}"`, threadID);
        let msg = `📂 OmegA Store Events matching "${action}"\n\n`;
        events.forEach(cmd => {
          if (premium.isFiltered(cmd.name, cmd.author, senderID)) return;
          msg += `╭─‣ ${cmd.name}\n├‣ ID : ${cmd.id}\n├‣ Author : ${authorLine(cmd)}\n╰────────────◊\n\n`;
        });
        msg += `💡 Use: ${prefix}gs -e install <id>`;
        await api.sendMessage(msg.trim(), threadID);
        return;
      } catch (_) { return api.sendMessage("❌ Event search API error.", threadID); }
    }

    if (sub === "install") {
      const id = args[1];
      if (!id) return api.sendMessage(`❌ Usage: ${prefix}gs install <id>`, threadID);
      return doInstall(api, threadID, senderID, id, null);
    }

    if (sub === "like") {
      const id = args[1];
      if (!id) return api.sendMessage(`❌ Usage: ${prefix}gs like <id>`, threadID);
      try {
        const res = await storePost(`/miraistore/like/${id}`, { userID: senderID, clientFp: senderID });
        if (res.data?.message) return api.sendMessage("⚠️ Already liked.", threadID);
        return api.sendMessage(`❤️ Liked! Total Likes: ${res.data.likes}`, threadID);
      } catch (_) { return api.sendMessage("❌ Like API error.", threadID); }
    }

    if (sub === "trend" || sub === "trending") {
      const list = await getTrending(5);
      try {
        if (!list) return api.sendMessage("❌ Trending API error.", threadID);
        if (!list.length) return api.sendMessage("❌ No trending files.", threadID);
        let msg = `🔥 OmegA Store • Top Trending 🔥\n\n`;
        list.forEach((cmd, i) => {
          if (premium.isFiltered(cmd.name, cmd.author, senderID)) return;
          msg +=
            `╭─‣ ${cmd.name}${i === 0 ? " 🏆" : ""}\n` +
            `├‣ Type : ${typeBadge(cmd)}\n` +
            `├‣ Likes : ❤️ ${cmd.likes}\n` +
            `├‣ Views : 👁️ ${cmd.views}\n` +
            `├‣ ID : ${cmd.id}\n` +
            `╰────────────◊\n\n`;
        });
        await api.sendMessage(msg.trim(), threadID);
        return;
      } catch (_) { return api.sendMessage("❌ Trending API error.", threadID); }
    }

    if (sub === "upload") {
      const isEvent = args[1]?.toLowerCase() === "event";
      const fileName = isEvent ? args[2] : args[1];
      const kind = isEvent ? "event" : "command";
      if (!fileName)
        return api.sendMessage(`📁 Usage:\n• ${prefix}gs upload <fileName>\n• ${prefix}gs -e upload <fileName> (event)`, threadID);
      const { filePath, dirs } = findLocalFile(fileName, kind);
      if (!filePath) return api.sendMessage(fileNotFoundMsg(fileName, dirs, prefix), threadID);
      return uploadFile(api, threadID, filePath, kind, senderID);
    }

    if (sub === "delete") {
      const id = args[1], secret = args[2];
      if (!id) return api.sendMessage(`❌ Usage: ${prefix}gs delete <id> [secret]`, threadID);
      try {
        const payload = secret ? { secret, userID: senderID } : { userID: senderID };
        const res = await storePost(`/miraistore/delete/${id}`, payload);
        if (res.data?.error) return api.sendMessage(`❌ ${res.data.error}`, threadID);
        return api.sendMessage(`🗑️ Deleted! ID: ${id}`, threadID);
      } catch (_) { return api.sendMessage("❌ Delete API error.", threadID); }
    }

    if (sub === "-a" || sub === "--author" || sub === "author") {
      const authorName = args.slice(1).join(" ");
      if (!authorName) return api.sendMessage(`❌ Usage: ${prefix}gs -a <name>`, threadID);
      return sendSearchPage(api, threadID, senderID, "", 1, 5, prefix, { author: authorName });
    }

    if (sub === "-c" || sub === "--cat" || sub === "--category" || sub === "cat" || sub === "category") {
      const catName = args[1];
      if (!catName)
        return api.sendMessage(`❌ Usage: ${prefix}gs -c <goat|mirai|other|category name>`, threadID);
      const rest = args.slice(2).join(" ");
      if (["goat", "mirai", "other"].includes(catName.toLowerCase()))
        return sendSearchPage(api, threadID, senderID, rest, 1, 5, prefix, { framework: catName.toLowerCase() });
      return sendSearchPage(api, threadID, senderID, rest, 1, 5, prefix, { category: catName });
    }

    const query = args.join(" ");
    try {
      const res = await storeGet(`/miraistore/search?q=${encodeURIComponent(query)}&kind=command&clientFp=${encodeURIComponent(senderID || "")}`);
      const data = res.data;
      if (!data || data.message) return api.sendMessage("❌ Not found.", threadID);

      if (!isNaN(query) && !Array.isArray(data) && !data.commands) {
        const isPrem = premium.isPremiumCmd(data.name, data.author);
        if (isPrem && !premium.isPremiumViewer(senderID))
          return api.sendMessage("*This command is premium only*", threadID);

        const finalMsg = isPrem
          ? resultBlock(data) + `💬 Reply "in" to install`
          : (
              `${typeBadge(data)}\n` +
              `╭─‣ Name : ${data.name}\n` +
              `├‣ Author : ${data.author}\n` +
              `├‣ Version : ${data.version || "N/A"}\n` +
              `├‣ Category : ${data.category}\n` +
              `├‣ Views : 👁️ ${data.views}\n` +
              `├‣ Likes : ❤️ ${data.likes}\n` +
              `├‣ Installs : ⬇️ ${data.installs}\n` +
              `╰────────────◊\n` +
              `⭔ Description: ${data.description || "No description"}\n` +
              `⭔ Upload : ${new Date(data.uploadDate || Date.now()).toDateString()}\n` +
              `🌐 URL : ${data.rawUrl}\n\n` +
              `💬 Reply "in" to install`
            );
        const sent = await api.sendMessage(finalMsg, threadID);
        const h = { commandName: "goatstore", messageID: sent.messageID, singleId: data.id, mode: "single", senderID, editCount: 0 };
        global.GoatBot.onReply.set(sent.messageID, h);
        return;
      }

      await sendSearchPage(api, threadID, senderID, query, 1, 5, prefix, { kind: "command" });
    } catch (err) {
      return api.sendMessage(err.response?.data?.message || "❌ Search API error.", threadID);
    }
  }
};
