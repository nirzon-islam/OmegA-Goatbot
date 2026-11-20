"use strict";

class EventDispatcher {
  constructor({ maxSeen = 10_000, ttlMs = 10 * 60 * 1000, now = Date.now } = {}) {
    if (!Number.isInteger(maxSeen) || maxSeen < 1) throw new TypeError("maxSeen must be a positive integer");
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) throw new TypeError("ttlMs must be a positive finite number");
    if (typeof now !== "function") throw new TypeError("now must be a function");
    this.maxSeen = maxSeen;
    this.ttlMs = ttlMs;
    this.now = now;
    this.seen = new Map();
    this.inFlight = new Map();
    this.queues = new Map();
  }

  #eventKey(event) {
    const id = event && (event.messageID || event.messageId || event.eventID || event.eventId);
    return typeof id === "string" && id ? id : null;
  }

  #purgeExpired(now = this.now()) {
    for (const [id, at] of this.seen) {
      if (now - at > this.ttlMs) this.seen.delete(id);
    }
  }

  #remember(key) {
    const now = this.now();
    this.#purgeExpired(now);
    this.seen.delete(key);
    this.seen.set(key, now);
    while (this.seen.size > this.maxSeen) this.seen.delete(this.seen.keys().next().value);
  }

  dispatch(event, handler) {
    if (!event || typeof event !== "object" || typeof handler !== "function") {
      return Promise.reject(new TypeError("event and handler are required"));
    }
    const key = this.#eventKey(event);
    this.#purgeExpired();
    if (key && this.seen.has(key)) return Promise.resolve({ duplicate: true });
    if (key && this.inFlight.has(key)) {
      return this.inFlight.get(key).then(() => ({ duplicate: true }));
    }

    const threadId = String(event.threadID || event.threadId || event.senderID || "global");
    const previous = this.queues.get(threadId) || Promise.resolve();
    const current = previous.catch(() => {}).then(async () => {
      const result = await handler(event);
      // Acknowledge only after success so transient handler failures can retry.
      if (key) this.#remember(key);
      return { duplicate: false, result };
    });
    this.queues.set(threadId, current);
    if (key) this.inFlight.set(key, current);
    return current.finally(() => {
      if (this.queues.get(threadId) === current) this.queues.delete(threadId);
      if (key && this.inFlight.get(key) === current) this.inFlight.delete(key);
    });
  }

  clear() {
    this.seen.clear();
    this.inFlight.clear();
    this.queues.clear();
  }
}

module.exports = { EventDispatcher };
