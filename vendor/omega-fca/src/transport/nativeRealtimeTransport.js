"use strict";

const { EventEmitter } = require("node:events");
const { DEFAULT_MAX_FRAME_BYTES } = require("./realtimeFrameDecoder");

const DEFAULT_CONNECT_TIMEOUT_MS = 15000;
const DEFAULT_CLOSE_TIMEOUT_MS = 3000;
const DEFAULT_PROTOCOL_SETUP_TIMEOUT_MS = 15000;

function transportError(message, code, retryable = false) {
  const error = new Error(message);
  error.code = code;
  error.retryable = retryable;
  return error;
}

function withTimeout(promise, timeoutMs, signal) {
  let timer;
  let abortHandler;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(transportError(
      "Realtime protocol setup timed out", "FCA_WS_PROTOCOL_SETUP_TIMEOUT", true
    )), timeoutMs);
  });
  const aborted = signal ? new Promise((_, reject) => {
    abortHandler = () => reject(signal.reason || transportError("Connection aborted", "FCA_WS_ABORTED"));
    if (signal.aborted) abortHandler();
    else signal.addEventListener("abort", abortHandler, { once: true });
  }) : new Promise(() => {});
  return Promise.race([Promise.resolve(promise), timeout, aborted]).finally(() => {
    clearTimeout(timer);
    if (signal && abortHandler) signal.removeEventListener("abort", abortHandler);
  });
}

function attach(socket, event, handler) {
  if (typeof socket.on === "function") {
    socket.on(event, handler);
    return () => {
      if (typeof socket.off === "function") socket.off(event, handler);
      else if (typeof socket.removeListener === "function") socket.removeListener(event, handler);
    };
  }
  if (typeof socket.addEventListener === "function") {
    socket.addEventListener(event, handler);
    return () => socket.removeEventListener?.(event, handler);
  }
  throw new TypeError("WebSocket implementation must support on() or addEventListener()");
}

function asBytes(data) {
  if (Buffer.isBuffer(data) || data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  return null;
}

/**
 * Creates the protocol-neutral native WebSocket runtime.
 *
 * The Facebook-specific handshake, subscription, frame encoding and action
 * schemas must be supplied by a separately verified protocol adapter. This
 * module deliberately contains no guessed Facebook endpoint or wire fields.
 */
function createNativeRealtimeTransport(options = {}) {
  const {
    url,
    socketFactory,
    protocol,
    protocols,
    headers,
    connectTimeoutMs = DEFAULT_CONNECT_TIMEOUT_MS,
    closeTimeoutMs = DEFAULT_CLOSE_TIMEOUT_MS,
    protocolSetupTimeoutMs = DEFAULT_PROTOCOL_SETUP_TIMEOUT_MS,
    maxFrameBytes = DEFAULT_MAX_FRAME_BYTES,
    onDiagnostic
  } = options;

  if (typeof url !== "string" || !/^wss:\/\//i.test(url)) {
    throw new TypeError("A verified wss:// URL is required");
  }
  if (typeof socketFactory !== "function") throw new TypeError("socketFactory is required");
  if (!protocol || typeof protocol !== "object" ||
      typeof protocol.authenticate !== "function" ||
      typeof protocol.subscribe !== "function" ||
      typeof protocol.decodeFrame !== "function" ||
      typeof protocol.encodeAction !== "function") {
    throw new TypeError("protocol must implement authenticate, subscribe, decodeFrame and encodeAction");
  }
  for (const [name, value] of [["connectTimeoutMs", connectTimeoutMs], ["closeTimeoutMs", closeTimeoutMs], ["protocolSetupTimeoutMs", protocolSetupTimeoutMs]]) {
    if (!Number.isInteger(value) || value < 1 || value > 120000) throw new TypeError(name + " must be between 1 and 120000");
  }
  if (!Number.isInteger(maxFrameBytes) || maxFrameBytes < 1 || maxFrameBytes > 16 * 1024 * 1024) {
    throw new TypeError("maxFrameBytes must be between 1 and 16777216");
  }

  const emitter = new EventEmitter();
  let socket = null;
  let state = "idle";
  let listener = null;
  let detach = [];
  let connectPromise = null;
  let disconnectPromise = null;
  let terminalError = null;
  let generation = 0;

  const diagnostic = (phase, extra = {}) => {
    if (typeof onDiagnostic !== "function") return;
    try { onDiagnostic(Object.freeze({ phase, state, at: new Date().toISOString(), ...extra })); } catch {}
  };

  function cleanupListeners() {
    for (const remove of detach.splice(0)) {
      try { remove(); } catch {}
    }
  }

  function notifyFailure(error) {
    if (terminalError) return;
    terminalError = error instanceof Error ? error : new Error(String(error));
    state = "disconnected";
    diagnostic("socket_error", { code: terminalError.code || null });
    emitter.emit("transportError", terminalError);
    if (listener) {
      const callback = listener;
      listener = null;
      try { callback(terminalError); } catch {}
    }
    // A terminal socket failure must release the underlying connection and
    // every registered handler; otherwise a failed transport can leak.
    cleanupListeners();
    const failedSocket = socket;
    socket = null;
    try { protocol.closeRequests?.(terminalError); } catch {}
    try { failedSocket?.close?.(); } catch {}
  }

  async function connect(context = {}) {
    if (state === "connected") return driver;
    if (connectPromise) return connectPromise;
    if (disconnectPromise) await disconnectPromise;
    const currentGeneration = ++generation;
    state = "connecting";
    terminalError = null;
    diagnostic("connecting");

    connectPromise = (async () => {
      const signal = context.signal;
      if (signal?.aborted) throw signal.reason || transportError("Connection aborted", "FCA_WS_ABORTED");
      let candidate;
      let factoryTimer;
      let abortFactory;
      const factoryPromise = Promise.resolve().then(() => socketFactory({ url, protocols, headers, signal }));
      // If the factory resolves after timeout/abort, close the orphaned socket.
      factoryPromise.then(lateSocket => {
        if (currentGeneration !== generation || state !== "connecting") {
          try { lateSocket?.close?.(); } catch {}
        }
      }, () => {});
      try {
        candidate = await new Promise((resolve, reject) => {
          let settled = false;
          const finish = (error, value) => {
            if (settled) return;
            settled = true;
            clearTimeout(factoryTimer);
            if (signal && abortFactory) signal.removeEventListener("abort", abortFactory);
            if (error) reject(error);
            else resolve(value);
          };
          factoryTimer = setTimeout(() => finish(
            transportError("WebSocket creation timed out", "FCA_WS_CREATE_TIMEOUT", true)
          ), connectTimeoutMs);
          if (signal) {
            abortFactory = () => finish(signal.reason || transportError("Connection aborted", "FCA_WS_ABORTED"));
            signal.addEventListener("abort", abortFactory, { once: true });
            if (signal.aborted) abortFactory();
          }
          factoryPromise.then(value => finish(null, value), () => finish(
            transportError("WebSocket creation failed", "FCA_WS_CREATE_FAILED", true)
          ));
        });
      } finally {
        clearTimeout(factoryTimer);
        if (signal && abortFactory) signal.removeEventListener("abort", abortFactory);
      }
      if (!candidate || typeof candidate.send !== "function") {
        throw transportError("socketFactory returned an invalid WebSocket", "FCA_WS_INVALID_SOCKET");
      }
      socket = candidate;

      await new Promise((resolve, reject) => {
        let settled = false;
        let timer;
        let abortHandler = null;
        const finish = (error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          if (signal && abortHandler) signal.removeEventListener("abort", abortHandler);
          removeOpen();
          removeError();
          removeClose();
          if (error) reject(error);
          else resolve();
        };
        const removeOpen = attach(candidate, "open", () => finish());
        const removeError = attach(candidate, "error", () => finish(transportError("WebSocket connection failed", "FCA_WS_CONNECT_FAILED", true)));
        const removeClose = attach(candidate, "close", () => finish(transportError("WebSocket closed before opening", "FCA_WS_CLOSED_EARLY", true)));
        timer = setTimeout(() => finish(transportError("WebSocket connection timed out", "FCA_WS_CONNECT_TIMEOUT", true)), connectTimeoutMs);
        if (signal) {
          abortHandler = () => finish(signal.reason || transportError("Connection aborted", "FCA_WS_ABORTED"));
          signal.addEventListener("abort", abortHandler, { once: true });
          if (signal.aborted) abortHandler();
        }
        if (candidate.readyState === 1) finish();
      });

      if (currentGeneration !== generation) throw transportError("Connection superseded", "FCA_WS_SUPERSEDED");
      const waitForFrame = (timeoutMs = protocolSetupTimeoutMs) => new Promise((resolve, reject) => {
        let settled = false;
        let timer;
        const finish = (error, value) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          removeMessage();
          if (signal) signal.removeEventListener("abort", onAbort);
          if (error) reject(error); else resolve(value);
        };
        const removeMessage = attach(candidate, "message", message => {
          const raw = message?.data !== undefined ? message.data : message;
          finish(null, raw);
        });
        const onAbort = () => finish(signal.reason || transportError("Connection aborted", "FCA_WS_ABORTED"));
        timer = setTimeout(() => finish(transportError("Timed out waiting for realtime protocol frame", "FCA_WS_PROTOCOL_FRAME_TIMEOUT", true)), timeoutMs);
        if (signal) {
          signal.addEventListener("abort", onAbort, { once: true });
          if (signal.aborted) onAbort();
        }
      });
      const contextWithSignal = { ...context, url, waitForFrame };
      try {
        await withTimeout((async () => {
          await protocol.authenticate(candidate, contextWithSignal);
          await protocol.subscribe(candidate, contextWithSignal);
        })(), protocolSetupTimeoutMs, signal);
      } catch (error) {
        if (error?.code === "FCA_WS_PROTOCOL_SETUP_TIMEOUT" || error?.code === "FCA_WS_ABORTED") throw error;
        throw transportError("Protocol authentication or subscription failed", "FCA_WS_PROTOCOL_SETUP_FAILED", false);
      }
      if (currentGeneration !== generation) throw transportError("Connection superseded", "FCA_WS_SUPERSEDED");

      detach.push(attach(candidate, "message", (message, isBinary) => {
        if (currentGeneration !== generation || state !== "connected") return;
        const raw = message?.data !== undefined ? message.data : message;
        const bytes = asBytes(raw);
        const incomingBytes = typeof raw === "string" ? Buffer.byteLength(raw, "utf8")
          : bytes ? bytes.byteLength
          : Number.isFinite(raw?.size) ? raw.size : null;
        if (incomingBytes !== null && incomingBytes > maxFrameBytes) {
          notifyFailure(transportError("Incoming frame exceeds configured size limit", "FCA_WS_FRAME_TOO_LARGE"));
          return;
        }
        try {
          const decoded = protocol.decodeFrame(raw, { isBinary: Boolean(isBinary), maxFrameBytes, socket: candidate });
          const events = Array.isArray(decoded) ? decoded : decoded?.events;
          if (!Array.isArray(events)) throw transportError("Protocol decoder returned no events array", "FCA_WS_DECODE_CONTRACT");
          for (const event of events) {
            if (listener) {
              try { listener(null, event); } catch (error) { emitter.emit("listenerError", error); }
            }
            emitter.emit("event", event);
          }
        } catch {
          diagnostic("frame_rejected");
          emitter.emit("frameRejected", Object.freeze({ byteLength: bytes?.byteLength ?? null }));
        }
      }));
      detach.push(attach(candidate, "error", () => notifyFailure(
        transportError("WebSocket transport error", "FCA_WS_RUNTIME_ERROR", true)
      )));
      detach.push(attach(candidate, "close", (code) => {
        if (currentGeneration === generation && state !== "closing" && state !== "closed") {
          notifyFailure(transportError("WebSocket closed unexpectedly", "FCA_WS_UNEXPECTED_CLOSE", true));
        }
        diagnostic("closed", { closeCode: Number.isInteger(code) ? code : null });
      }));

      state = "connected";
      diagnostic("connected");
      emitter.emit("connected", snapshot());
      return driver;
    })().catch(async error => {
      if (socket) {
        const failed = socket;
        socket = null;
        try { failed.close?.(); } catch {}
      }
      cleanupListeners();
      if (currentGeneration === generation && state !== "closing" && state !== "closed") state = "disconnected";
      diagnostic("connect_failed", { code: error.code || null });
      throw error;
    }).finally(() => { connectPromise = null; });
    return connectPromise;
  }

  function snapshot() {
    return Object.freeze({ state, connected: state === "connected", generation });
  }

  const driver = Object.freeze({
    listen(callback) {
      if (typeof callback !== "function") throw new TypeError("listener callback is required");
      if (state !== "connected") throw transportError("WebSocket is not connected", "FCA_WS_NOT_CONNECTED");
      if (listener) throw transportError("A listener is already attached", "FCA_WS_LISTENER_EXISTS");
      listener = callback;
      return () => { if (listener === callback) listener = null; };
    },
    async sendRequest(payload, requestOptions) {
      if (state !== "connected" || !socket) throw transportError("WebSocket is not connected", "FCA_WS_NOT_CONNECTED", true);
      if (typeof protocol.request !== "function") throw transportError("Protocol does not support request-response actions", "FCA_WS_REQUEST_UNSUPPORTED");
      return protocol.request(socket, payload, requestOptions);
    },
    async sendMessage(input, requestOptions) {
      if (state !== "connected" || !socket) throw transportError("WebSocket is not connected", "FCA_WS_NOT_CONNECTED", true);
      if (typeof protocol.sendMessage !== "function") throw transportError("Protocol does not support Messenger sendMessage", "FCA_WS_ACTION_UNSUPPORTED");
      return protocol.sendMessage(socket, input, requestOptions);
    },
    async sendAction(action) {
      if (state !== "connected" || !socket) throw transportError("WebSocket is not connected", "FCA_WS_NOT_CONNECTED", true);
      let frame;
      try { frame = await protocol.encodeAction(action); }
      catch { throw transportError("Protocol action encoding failed", "FCA_WS_ACTION_ENCODE_FAILED"); }
      if (!(typeof frame === "string" || Buffer.isBuffer(frame) || frame instanceof Uint8Array || frame instanceof ArrayBuffer)) {
        throw transportError("Protocol encoder returned an unsupported frame", "FCA_WS_ACTION_FRAME_INVALID");
      }
      const outgoingBytes = typeof frame === "string" ? Buffer.byteLength(frame, "utf8")
        : frame instanceof ArrayBuffer ? frame.byteLength
        : frame.byteLength;
      if (outgoingBytes > maxFrameBytes) throw transportError("Outgoing frame exceeds configured size limit", "FCA_WS_FRAME_TOO_LARGE");
      await new Promise((resolve, reject) => {
        try {
          if (socket.send.length >= 2) socket.send(frame, error => error ? reject(error) : resolve());
          else { socket.send(frame); resolve(); }
        } catch { reject(transportError("WebSocket send failed", "FCA_WS_SEND_FAILED", true)); }
      });
      return Object.freeze({ sent: true });
    },
    async disconnect() {
      if (disconnectPromise) return disconnectPromise;
      ++generation;
      state = "closing";
      listener = null;
      cleanupListeners();
      const current = socket;
      socket = null;
      try { protocol.closeRequests?.(transportError("WebSocket disconnected", "FCA_WS_DISCONNECTED", true)); } catch {}
      disconnectPromise = (async () => {
        if (current && typeof current.close === "function") {
          await new Promise(resolve => {
            let done = false;
            const finish = () => { if (done) return; done = true; clearTimeout(timer); removeClose(); resolve(); };
            const removeClose = attach(current, "close", finish);
            const timer = setTimeout(finish, closeTimeoutMs);
            try { current.close(); } catch { finish(); }
            if (current.readyState === 3) finish();
          });
        }
        state = "closed";
        diagnostic("disconnected");
        emitter.emit("disconnected", snapshot());
      })().finally(() => { disconnectPromise = null; });
      return disconnectPromise;
    },
    getConnectionState: snapshot
  });

  return Object.freeze({
    connect,
    disconnect: () => driver.disconnect(),
    getDriver: () => driver,
    snapshot,
    on: (event, callback) => { emitter.on(event, callback); return () => emitter.off(event, callback); }
  });
}

module.exports = { DEFAULT_CONNECT_TIMEOUT_MS, DEFAULT_CLOSE_TIMEOUT_MS, DEFAULT_PROTOCOL_SETUP_TIMEOUT_MS, createNativeRealtimeTransport };
