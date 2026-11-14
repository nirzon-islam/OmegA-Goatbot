"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(process.env.AGENT_WORKSPACE_ROOT || process.cwd());
const DENIED_SEGMENTS = new Set([
  ".", "..", ".git", "node_modules", ".env", "account.txt",
  "account.txt.bak", "Fca_Database", "cache", "secrets"
]);
const ALLOWED_ROOTS = ["languages"];

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

function normalizeRelative(input) {
  if (typeof input !== "string" || !input.trim() || input.length > 300) {
    throw new Error("Invalid file path");
  }
  const value = input.trim();
  if (value.includes("\0") || value.includes("\\") || value.startsWith("/")) {
    throw new Error("Invalid file path");
  }
  const segments = value.split("/");
  if (segments.some(part => !part || DENIED_SEGMENTS.has(part) || part.startsWith("."))) {
    throw new Error("Path is protected or malformed");
  }
  const normalized = path.posix.normalize(value);
  if (normalized !== value || !ALLOWED_ROOTS.some(root => normalized.startsWith(root + "/"))) {
    throw new Error("Path is outside the approved workspace");
  }
  if (!/\.(lang|js)$/.test(normalized)) {
    throw new Error("Only .lang and .js files are allowed");
  }
  const absolute = path.resolve(ROOT, normalized);
  if (!isWithinRoot(absolute)) throw new Error("Path escapes workspace root");
  rejectSymlinkEscape(absolute);
  return { relative: normalized, absolute };
}

function normalizeDirectory(input) {
  if (typeof input !== "string" || !input.trim() || input.length > 200) throw new Error("Invalid directory path");
  const value = input.trim();
  if (value.includes("\\0") || value.includes("\\\\") || value.startsWith("/")) throw new Error("Invalid directory path");
  const segments = value.split("/");
  if (segments.some(part => !part || DENIED_SEGMENTS.has(part) || part.startsWith("."))) throw new Error("Path is protected or malformed");
  const normalized = path.posix.normalize(value);
  if (normalized !== value || !ALLOWED_ROOTS.some(root => normalized === root || normalized.startsWith(root + "/"))) throw new Error("Directory is outside the approved workspace");
  const absolute = path.resolve(ROOT, normalized);
  if (!isWithinRoot(absolute)) throw new Error("Path escapes workspace root");
  rejectSymlinkEscape(absolute);
  if (fs.existsSync(absolute) && !fs.lstatSync(absolute).isDirectory()) throw new Error("Target is not a directory");
  return { relative: normalized, absolute };
}

module.exports = { normalizeRelative, normalizeDirectory, ALLOWED_ROOTS: Object.freeze([...ALLOWED_ROOTS]) };
