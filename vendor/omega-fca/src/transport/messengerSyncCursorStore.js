"use strict";

const { saveSession, loadSession, deleteSession } = require("../security/sessionStore");

function createMessengerSyncCursorStore(options = {}) {
  if (typeof options.filePath !== "string" || !options.filePath) throw new TypeError("filePath is required");
  if (typeof options.key !== "string" && !Buffer.isBuffer(options.key) && !(options.key instanceof Uint8Array)) {
    throw new TypeError("An encryption key is required");
  }
  const userId = String(options.userId ?? "");
  if (!/^\d{5,30}$/.test(userId)) throw new TypeError("userId must be a numeric Facebook ID");
  let current = null;

  function validate(cursor) {
    if (!cursor || typeof cursor !== "object" || Array.isArray(cursor)) throw new TypeError("cursor must be an object");
    const syncToken = cursor.syncToken == null ? null : cursor.syncToken;
    const lastSeqId = cursor.lastSeqId == null ? null : cursor.lastSeqId;
    if (syncToken !== null && (typeof syncToken !== "string" || syncToken.length < 1 || syncToken.length > 4096)) throw new TypeError("syncToken is invalid");
    if (lastSeqId !== null && !(typeof lastSeqId === "string" && /^\d{1,30}$/.test(lastSeqId)) &&
        !(Number.isSafeInteger(lastSeqId) && lastSeqId >= 0)) throw new TypeError("lastSeqId is invalid");
    if (syncToken === null && lastSeqId === null) throw new TypeError("cursor must contain a sync token or sequence ID");
    return Object.freeze({ syncToken, lastSeqId });
  }

  return Object.freeze({
    load() {
      try {
        const record = loadSession(options.filePath, options.key);
        if (!record || record.kind !== "omega-messenger-sync-cursor" || record.userId !== userId) {
          throw new Error("Stored Messenger cursor belongs to a different account or format");
        }
        current = validate(record.cursor);
        return current;
      } catch (error) {
        if (error.code === "ENOENT") return null;
        throw error;
      }
    },
    save(cursor) {
      const normalized = validate(cursor);
      saveSession(options.filePath, { kind: "omega-messenger-sync-cursor", userId, cursor: normalized }, options.key);
      current = normalized;
      return current;
    },
    clear() {
      deleteSession(options.filePath);
      current = null;
    },
    get current() { return current; }
  });
}

module.exports = { createMessengerSyncCursorStore };
