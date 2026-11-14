"use strict";

const fs = require("fs");
const path = require("path");

// Railway may start Node with cwd="/". Anchor the default workspace to this
// module's parent (the repository root), while allowing an explicit override.
const ROOT = path.resolve(process.env.AGENT_WORKSPACE_ROOT || path.join(__dirname, ".."));
const DENIED_SEGMENTS = new Set([
  ".", "..", ".git", ".github", "node_modules", ".env", "account.txt",
  "account.txt.bak", "Fca_Database", "cache", ".cache", "secrets",
  "credentials", "private", "sessions", "session", "appstate", "logs",
  "backups", "backup", "coverage", "dist", "build"
]);
const DENIED_FILES = new Set([
  "config.json", "config.dev.json", "config.production.json",
  "configCommands.json", "configCommands.dev.json",
  "package-lock.json", "yarn.lock", "pnpm-lock.yaml"
]);
const ALLOWED_EXTENSIONS = new Set([
  ".js", ".json", ".md", ".yml", ".yaml", ".lang", ".css", ".html", ".txt"
]);

function isWithinRoot(candidate) {
  return candidate === ROOT || candidate.startsWith(ROOT + path.sep);
}

function rejectSymlinkEscape(absolute) {
  let cursor = absolute;
  while (!fs.existsSync(cursor)) {
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  const realRoot = fs.realpathSync(ROOT);
  const realExisting = fs.realpathSync(cursor);
  if (realExisting !== realRoot && !realExisting.startsWith(realRoot + path.sep)) {
    throw new Error("Path resolves outside workspace root");
  }
  if (fs.existsSync(absolute) && fs.lstatSync(absolute).isSymbolicLink()) {
    throw new Error("Symbolic links are not allowed");
  }
}

function validateSegments(value) {
  const segments = value.split("/");
  if (segments.some(part => !part || DENIED_SEGMENTS.has(part) || part.startsWith("."))) {
    throw new Error("Path is protected or malformed");
  }
  return segments;
}

function validateFileName(relative) {
  const base = path.posix.basename(relative);
  if (DENIED_FILES.has(base) || /(^|\.)env($|\.)/i.test(base) ||
      /(^|[._-])(secret|credential|private|appstate|session|token)([._-]|$)/i.test(base)) {
    throw new Error("Sensitive file is protected");
  }
  if (!ALLOWED_EXTENSIONS.has(path.posix.extname(base).toLowerCase())) {
    throw new Error("File type is not supported for Agent access");
  }
}

function normalizeRelative(input) {
  if (typeof input !== "string" || !input.trim() || input.length > 300) {
    throw new Error("Invalid file path");
  }
  const value = input.trim();
  if (value.includes("\0") || value.includes("\\") || value.startsWith("/")) {
    throw new Error("Invalid file path");
  }
  validateSegments(value);
  const normalized = path.posix.normalize(value);
  if (normalized !== value) throw new Error("Path is outside the approved workspace");
  validateFileName(normalized);
  const absolute = path.resolve(ROOT, normalized);
  if (!isWithinRoot(absolute)) throw new Error("Path escapes workspace root");
  rejectSymlinkEscape(absolute);
  return { relative: normalized, absolute };
}

function normalizeDirectory(input) {
  if (typeof input !== "string" || !input.trim() || input.length > 200) throw new Error("Invalid directory path");
  const value = input.trim();
  if (value.includes("\0") || value.includes("\\") || value.startsWith("/")) throw new Error("Invalid directory path");
  validateSegments(value);
  const normalized = path.posix.normalize(value);
  if (normalized !== value) throw new Error("Directory is outside the approved workspace");
  const absolute = path.resolve(ROOT, normalized);
  if (!isWithinRoot(absolute)) throw new Error("Path escapes workspace root");
  rejectSymlinkEscape(absolute);
  if (fs.existsSync(absolute) && !fs.lstatSync(absolute).isDirectory()) throw new Error("Target is not a directory");
  return { relative: normalized, absolute };
}

function isSupportedTextFile(name) {
  const relative = String(name || "").replace(/\\/g, "/");
  try { validateSegments(relative); validateFileName(relative); return true; }
  catch { return false; }
}

module.exports = {
  normalizeRelative,
  normalizeDirectory,
  isSupportedTextFile,
  ALLOWED_EXTENSIONS: Object.freeze([...ALLOWED_EXTENSIONS])
};
