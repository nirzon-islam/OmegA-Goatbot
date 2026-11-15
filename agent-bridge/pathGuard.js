"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(process.env.AGENT_WORKSPACE_ROOT || process.cwd());
const DENIED_SEGMENTS = new Set([
  ".", "..", ".git", "node_modules", ".env", ".env.local", ".env.production",
  "account.txt", "account.txt.bak", "Fca_Database", "cache", "secrets",
  "appstate", "appstates", "sessions", "session", "credentials", "cookies", "backups"
]);
const DENIED_NAMES = /^(?:\.env(?:\..*)?|.*(?:appstate|cookie|credential|secret|token|private.?key|account.?txt|session.?store).*)$/i;
const ALLOWED_EXTENSIONS = new Set([
  ".js", ".cjs", ".mjs", ".json", ".md", ".txt", ".yml", ".yaml",
  ".lang", ".html", ".css", ".xml", ".sql", ".sh"
]);

function isWithinRoot(candidate) {
  return candidate === ROOT || candidate.startsWith(ROOT + path.sep);
}

function isDeniedSegment(segment) {
  return DENIED_SEGMENTS.has(segment) || segment.startsWith(".") ||
    DENIED_NAMES.test(segment);
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
  let current = ROOT;
  const relative = path.relative(ROOT, absolute);
  for (const part of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) {
      throw new Error("Symbolic links are not allowed");
    }
  }
}

function normalizeSegments(input, maxLength) {
  if (typeof input !== "string" || !input.trim() || input.length > maxLength) {
    throw new Error("Invalid file path");
  }
  const value = input.trim();
  if (value.includes("\\0") || value.includes("\\\\") || value.startsWith("/")) {
    throw new Error("Invalid file path");
  }
  const segments = value.split("/");
  if (segments.some(part => !part || isDeniedSegment(part))) {
    throw new Error("Path is protected or malformed");
  }
  const normalized = path.posix.normalize(value);
  if (normalized !== value) throw new Error("Path is not normalized");
  return normalized;
}

function normalizeRelative(input) {
  const normalized = normalizeSegments(input, 500);
  const extension = path.posix.extname(normalized).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new Error("File extension is not supported for safe text editing");
  }
  const absolute = path.resolve(ROOT, normalized);
  if (!isWithinRoot(absolute)) throw new Error("Path escapes workspace root");
  rejectSymlinkEscape(absolute);
  return { relative: normalized, absolute };
}

function normalizeDirectory(input) {
  if (input === ".") return { relative: ".", absolute: ROOT };
  const normalized = normalizeSegments(input, 300);
  const absolute = path.resolve(ROOT, normalized);
  if (!isWithinRoot(absolute)) throw new Error("Path escapes workspace root");
  rejectSymlinkEscape(absolute);
  if (fs.existsSync(absolute) && !fs.lstatSync(absolute).isDirectory()) {
    throw new Error("Target is not a directory");
  }
  return { relative: normalized, absolute };
}

module.exports = {
  normalizeRelative,
  normalizeDirectory,
  isDeniedSegment,
  ALLOWED_EXTENSIONS: Object.freeze([...ALLOWED_EXTENSIONS])
};
