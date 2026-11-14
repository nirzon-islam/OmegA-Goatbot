"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(process.env.AGENT_WORKSPACE_ROOT || process.cwd());

// Never allow an agent task to touch bot runtime, login, secrets, or dependency internals.
const DENIED_SEGMENTS = new Set([
  ".git",
  "node_modules",
  ".env",
  "account.txt",
  "account.txt.bak",
  "Fca_Database"
]);

const ALLOWED_ROOTS = [
  "scripts/cmds",
  "scripts/events",
  "languages",
  "dashboard"
];

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
}

function normalizeRelative(input) {
  if (typeof input !== "string" || !input.trim() || input.length > 500) {
    throw new Error("Invalid file path");
  }
  if (input.includes("\\0") || input.includes("\\\\")) {
    throw new Error("Invalid file path");
  }

  const rawSegments = input.trim().split("/");
  if (rawSegments.some(part => part === "." || part === "..")) {
    throw new Error("Path traversal is not allowed");
  }

  const normalized = path.posix.normalize(input.trim());
  if (
    normalized === "." ||
    normalized.startsWith("/") ||
    normalized === ".." ||
    normalized.startsWith("../") ||
    normalized.split("/").some(part => part === "." || part === "..")
  ) {
    throw new Error("Path traversal is not allowed");
  }

  const segments = normalized.split("/");
  if (segments.some(segment => DENIED_SEGMENTS.has(segment))) {
    throw new Error("Path is protected");
  }

  if (!ALLOWED_ROOTS.some(root => normalized === root || normalized.startsWith(root + "/"))) {
    throw new Error("Path is outside the approved workspace");
  }

  const absolute = path.resolve(ROOT, normalized);
  if (!isWithinRoot(absolute)) {
    throw new Error("Path escapes workspace root");
  }
  rejectSymlinkEscape(absolute);
  return { relative: normalized, absolute };
}

module.exports = { normalizeRelative, ALLOWED_ROOTS: Object.freeze([...ALLOWED_ROOTS]) };
