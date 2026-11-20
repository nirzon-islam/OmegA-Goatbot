"use strict";

const { EventEmitter } = require("node:events");

const DEFAULTS = Object.freeze({ minDelayMs: 1000, maxDelayMs: 30000, factor: 2, jitter: 0.2, maxAttempts: 8 });

class ConnectionSupervisor extends EventEmitter {
  constructor({ connect, disconnect, options = {}, random = Math.random, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
    super();
    if (typeof connect !== "function") throw new TypeError("connect function is required");
    this.connectDriver = connect;
    this.disconnectDriver = typeof disconnect === "function" ? disconnect : async () => {};
    this.options = { ...DEFAULTS, ...options };
    this.random = random;
    this.sleep = sleep;
    this.state = "idle";
    this.driver = null;
    this.generation = 0;
    this.startPromise = null;
    this.stopPromise = null;
    this.stopRequested = false;
    this.listenerAttached = false;
    this.recovering = false;
    this.eventCallback = null;
    this.detachDriverListener = null;
    this.connectAbortController = null;
  }

  snapshot() { return Object.freeze({ state: this.state, connected: Boolean(this.driver), generation: this.generation }); }

  async start() {
    // A new connection must not clear stopRequested while the previous
    // driver's disconnect is still in flight.
    if (this.stopPromise) await this.stopPromise;
    if (this.startPromise) return this.startPromise;
    if (this.state === "connected") return this.driver;
    this.stopRequested = false;
    this.startPromise = this.#startLoop().finally(() => { this.startPromise = null; });
    return this.startPromise;
  }

  async #startLoop() {
    let attempt = 0;
    while (!this.stopRequested && attempt < this.options.maxAttempts) {
      this.#setState(attempt ? "reconnecting" : "connecting");
      const generation = ++this.generation;
      try {
        const controller = new AbortController();
        this.connectAbortController = controller;
        const connectPromise = Promise.resolve().then(() =>
          this.connectDriver({ attempt, generation, signal: controller.signal })
        );
        let connectResultConsumed = false;
        let rejectAbort;
        const abortPromise = new Promise((_, reject) => {
          rejectAbort = () => reject(controller.signal.reason ||
            Object.assign(new Error("Connection attempt aborted"), { name: "AbortError", retryable: false }));
          if (controller.signal.aborted) rejectAbort();
          else controller.signal.addEventListener("abort", rejectAbort, { once: true });
        });
        let driver;
        try {
          driver = await Promise.race([connectPromise, abortPromise]);
          connectResultConsumed = true;
        } catch (error) {
          // Providers should honor the signal. If one does not and resolves
          // later, dispose its driver instead of leaking an orphaned session.
          void connectPromise.then(lateDriver => {
            if (!connectResultConsumed && lateDriver) {
              return Promise.resolve().then(() => this.disconnectDriver(lateDriver)).catch(disconnectError => {
                try { this.emit("connectionError", disconnectError); } catch {}
              });
            }
          }, () => {});
          throw error;
        } finally {
          if (rejectAbort) controller.signal.removeEventListener("abort", rejectAbort);
          if (this.connectAbortController === controller) this.connectAbortController = null;
        }
        if (this.stopRequested || generation !== this.generation) {
          await this.disconnectDriver(driver);
          break;
        }
        if (!driver || typeof driver.listen !== "function") {
          const error = new Error("Transport driver must expose listen(callback)");
          error.retryable = false;
          if (driver && typeof driver === "object") {
            try { await this.disconnectDriver(driver); }
            catch (cleanupError) { error.cleanupError = cleanupError; }
          }
          throw error;
        }
        this.driver = driver;
        this.listenerAttached = false;
        this.#setState("connected");
        this.emit("connected", this.snapshot());
        return driver;
      } catch (error) {
        this.#setState("disconnected");
        this.emit("connectionError", error);
        if (this.stopRequested || error?.retryable === false) break;
        const base = Math.min(this.options.maxDelayMs, this.options.minDelayMs * Math.pow(this.options.factor, attempt));
        attempt++;
        const jitter = base * this.options.jitter * ((this.random() * 2) - 1);
        if (attempt < this.options.maxAttempts) await this.sleep(Math.max(0, Math.round(base + jitter)));
      }
    }
    if (!this.stopRequested && this.state !== "stopped") this.#setState("failed");
    return null;
  }

  listen(callback) {
    if (typeof callback !== "function") throw new TypeError("listener callback is required");
    if (!this.driver) throw new Error("Connection is not ready");
    if (this.listenerAttached) throw new Error("A listener is already attached");
    this.eventCallback = callback;
    this.#attachListener();
    let detached = false;
    return () => {
      if (detached) return;
      detached = true;
      this.eventCallback = null;
      this.#detachListener();
    };
  }

  #attachListener() {
    if (!this.driver || !this.eventCallback || this.listenerAttached) return;
    this.listenerAttached = true;
    const generation = this.generation;
    const callback = this.eventCallback;
    try {
      const detach = this.driver.listen((error, event) => {
        if (generation !== this.generation || this.stopRequested) return;
        if (error) {
          this.emit("listenerError", error);
          void this.#recover(generation);
          return;
        }
        try {
          callback(event);
        } catch (error) {
          // Application callback failures must not escape the transport event
          // loop or be mistaken for a broken socket that needs reconnecting.
          try { this.emit("listenerCallbackError", error); } catch {}
          return;
        }
        try { this.emit("event", event); }
        catch (error) {
          try { this.emit("observerError", error); } catch {}
        }
      });
      this.detachDriverListener = typeof detach === "function" ? detach : null;
    } catch (error) {
      this.listenerAttached = false;
      this.emit("listenerError", error);
      void this.#recover(generation);
    }
  }

  #detachListener() {
    const detach = this.detachDriverListener;
    this.detachDriverListener = null;
    this.listenerAttached = false;
    if (detach) {
      try { detach(); } catch (error) { this.emit("listenerError", error); }
    }
  }

  async #recover(failedGeneration) {
    if (this.recovering || this.stopRequested || failedGeneration !== this.generation) return;
    this.recovering = true;
    const previous = this.driver;
    this.driver = null;
    this.#detachListener();
    this.#setState("disconnected");
    try {
      if (previous) await this.disconnectDriver(previous);
      // stop() may run while the previous driver is being disposed. Do not
      // let recovery call start() afterward, because start() clears stopRequested.
      if (this.stopRequested || failedGeneration !== this.generation) return;
      const driver = await this.start();
      if (driver && !this.stopRequested && this.eventCallback) this.#attachListener();
    } catch (error) {
      this.emit("connectionError", error);
    } finally {
      this.recovering = false;
    }
  }

  stop() {
    if (this.stopPromise) return this.stopPromise;
    this.stopRequested = true;
    this.connectAbortController?.abort(
      Object.assign(new Error("Connection stopped"), { name: "AbortError", retryable: false })
    );
    ++this.generation;
    this.eventCallback = null;
    this.#detachListener();
    const driver = this.driver;
    const pendingStart = this.startPromise;
    this.driver = null;
    this.stopPromise = (async () => {
      let disconnectError = null;
      if (driver) {
        try { await this.disconnectDriver(driver); }
        catch (error) { disconnectError = error; }
      }
      // A connect attempt may still be resolving. #startLoop owns disposal of
      // any driver that arrives after stopRequested; wait for that cleanup
      // before reporting the supervisor as fully stopped.
      if (pendingStart) {
        try { await pendingStart; }
        catch (error) { if (!disconnectError) disconnectError = error; }
      }
      this.#setState("stopped");
      this.emit("stopped", this.snapshot());
      if (disconnectError) throw disconnectError;
    })().finally(() => {
      this.stopPromise = null;
    });
    return this.stopPromise;
  }

  #setState(next) {
    this.state = next;
    this.emit("state", this.snapshot());
  }
}

module.exports = { ConnectionSupervisor };
