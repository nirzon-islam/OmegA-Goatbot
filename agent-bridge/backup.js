"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { normalizeRelative } = require("./pathGuard");

const BACKUP_ROOT = path.resolve(__dirname, "backups");

function backupFile(relativePath) {
  const target = normalizeRelative(relativePath);
  if (!fs.existsSync(target.absolute)) {
    return { created: false, reason: "not_found" };
  }

  const stat = fs.lstatSync(target.absolute);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error("Only regular files can be backed up");
  }

  const content = fs.readFileSync(target.absolute);
  const digest = crypto.createHash("sha256").update(content).digest("hex");
  const destination = path.join(BACKUP_ROOT, digest.slice(0, 2), digest, path.basename(target.relative));

  fs.mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 });
  if (!fs.existsSync(destination)) {
    fs.writeFileSync(destination, content, { flag: "wx", mode: 0o600 });
  }

  return {
    created: true,
    backupId: digest,
    originalPath: target.relative,
    size: content.length
  };
}

module.exports = { backupFile };
