"use strict";

const { randomUUID } = require("node:crypto");

const fs = require("node:fs");
const path = require("node:path");
const { encryptSession, decryptSession } = require("./sessionCrypto");

function saveSession(filePath, session, key) {
  const target = path.resolve(filePath);
  const directory = path.dirname(target);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const temp = path.join(directory, ".omega-session-" + randomUUID() + ".tmp");
  const envelope = JSON.stringify(encryptSession(session, key));
  let fd;
  try {
    fd = fs.openSync(temp, "wx", 0o600);
    fs.writeFileSync(fd, envelope, "utf8");
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    fs.renameSync(temp, target);
    try { fs.chmodSync(target, 0o600); } catch {}
    // Persist the directory entry where supported; file contents were fsynced above.
    let directoryFd;
    try {
      directoryFd = fs.openSync(directory, fs.constants.O_RDONLY);
      fs.fsyncSync(directoryFd);
    } catch {
      // Some platforms/filesystems do not support fsync on directories.
    } finally {
      if (directoryFd !== undefined) try { fs.closeSync(directoryFd); } catch {}
    }
  } catch (error) {
    if (fd !== undefined) try { fs.closeSync(fd); } catch {}
    try { fs.unlinkSync(temp); } catch {}
    throw error;
  }
  return target;
}

function loadSession(filePath, key) {
  const target = path.resolve(filePath);
  const noFollow = fs.constants.O_NOFOLLOW || 0;
  const fd = fs.openSync(target, fs.constants.O_RDONLY | noFollow);
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.size > 1024 * 1024) {
      throw new Error("Encrypted session file is invalid or too large");
    }
    const contents = fs.readFileSync(fd, "utf8");
    const envelope = JSON.parse(contents);
    return decryptSession(envelope, key);
  } finally {
    fs.closeSync(fd);
  }
}

function deleteSession(filePath) {
  try { fs.unlinkSync(path.resolve(filePath)); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
}

module.exports = { saveSession, loadSession, deleteSession };
