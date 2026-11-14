"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");
const { normalizeRelative, normalizeDirectory } = require("./pathGuard");
const { backupFile } = require("./backup");

const MAX_FILE_BYTES = 64 * 1024;
const MAX_READ_FILES = 30;
const MAX_READ_TOTAL_BYTES = 30000;

function executeApprovedAction(action) {
  if (!action || typeof action !== "object" || Array.isArray(action)) {
    throw new Error("Invalid action");
  }
  if (action.type === "plan") {
    if (!Array.isArray(action.steps) || action.steps.length < 1 || action.steps.length > 12) throw new Error("Invalid approved plan");
    const results = [];
    for (let index = 0; index < action.steps.length; index++) {
      results.push({ step: index + 1, ...executeApprovedAction(action.steps[index]) });
    }
    return { summary: typeof action.summary === "string" ? action.summary : "Approved multi-step task completed", steps: results };
  }
  const { type, path: relativePath } = action;
  if (typeof type !== "string" || typeof relativePath !== "string") {
    throw new Error("Action requires type and path");
  }

  const allowedKeys = type === "create" || type === "edit"
    ? new Set(["type", "path", "content"])
    : new Set(["type", "path"]);
  if (Object.keys(action).some(key => !allowedKeys.has(key))) {
    throw new Error("Action contains unsupported properties");
  }

  if (type === "list" || type === "readMany") {
    const directory = normalizeDirectory(relativePath);
    if (!fs.existsSync(directory.absolute)) throw new Error("Directory does not exist");
    const entries = [];
    function walk(current, rel) {
      for (const name of fs.readdirSync(current).sort()) {
        if (name.startsWith(".")) continue;
        const full = path.join(current, name);
        const stat = fs.lstatSync(full);
        if (stat.isSymbolicLink()) continue;
        const child = rel + "/" + name;
        if (stat.isDirectory()) { if (entries.length < MAX_READ_FILES) walk(full, child); }
        else if (stat.isFile() && /\\.(lang|js)$/.test(name) && entries.length < MAX_READ_FILES) {
          if (type === "list") entries.push({ path: child, type: "file", size: stat.size });
          else {
            if (stat.size > MAX_FILE_BYTES) throw new Error("File exceeds the 64 KiB read limit: " + child);
            entries.push({ path: child, content: fs.readFileSync(full, "utf8") });
          }
        }
      }
    }
    walk(directory.absolute, directory.relative);
    if (type === "readMany") {
      const total = entries.reduce((sum, item) => sum + Buffer.byteLength(item.content, "utf8"), 0);
      if (total > MAX_READ_TOTAL_BYTES) throw new Error("Combined file content exceeds the 256 KiB task limit");
    }
    return { path: directory.relative, entries, count: entries.length };
  }
  const target = normalizeRelative(relativePath);

  if (type === "read") {
    const stat = fs.lstatSync(target.absolute);
    if (!stat.isFile() || stat.size > MAX_FILE_BYTES) throw new Error("File is not a supported regular file");
    return { path: target.relative, content: fs.readFileSync(target.absolute, "utf8") };
  }

  if (type === "test") {
    if (!target.relative.endsWith(".js")) throw new Error("Syntax test supports JavaScript files only");
    const stat = fs.lstatSync(target.absolute);
    if (!stat.isFile() || stat.size > MAX_FILE_BYTES) throw new Error("File is not a supported regular file");
    new vm.Script(fs.readFileSync(target.absolute, "utf8"), { filename: target.relative });
    return { path: target.relative, passed: true, test: "javascript-syntax" };
  }

  if (type === "create" || type === "edit") {
    if (typeof action.content !== "string" || Buffer.byteLength(action.content, "utf8") > MAX_FILE_BYTES) {
      throw new Error("Content must be text up to 64 KiB");
    }
    const exists = fs.existsSync(target.absolute);
    if (type === "create" && exists) throw new Error("Target already exists");
    if (type === "edit" && !exists) throw new Error("Target does not exist");
    if (exists) {
      const stat = fs.lstatSync(target.absolute);
      if (!stat.isFile() || stat.size > MAX_FILE_BYTES) throw new Error("Target is not a supported regular file");
    }
    const backup = exists ? backupFile(target.relative) : null;
    fs.mkdirSync(path.dirname(target.absolute), { recursive: true });
    const temporary = target.absolute + ".agent-tmp-" + process.pid + "-" + crypto.randomBytes(8).toString("hex");
    try {
      fs.writeFileSync(temporary, action.content, { flag: "wx", mode: 0o600 });
      fs.renameSync(temporary, target.absolute);
    } catch (error) {
      try { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); } catch {}
      throw error;
    }
    return { path: target.relative, written: true, backupId: backup && backup.backupId };
  }

  throw new Error("Action type is not supported by this executor");
}

module.exports = { executeApprovedAction };
