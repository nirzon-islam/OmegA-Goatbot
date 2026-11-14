"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { normalizeRelative } = require("./pathGuard");
const { backupFile } = require("./backup");

const MAX_FILE_BYTES = 64 * 1024;

function executeApprovedAction(action) {
  if (!action || typeof action !== "object" || Array.isArray(action)) {
    throw new Error("Invalid action");
  }
  const { type, path: relativePath } = action;
  if (typeof type !== "string" || typeof relativePath !== "string") {
    throw new Error("Action requires type and path");
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
    const temporary = target.absolute + ".agent-tmp-" + process.pid;
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
