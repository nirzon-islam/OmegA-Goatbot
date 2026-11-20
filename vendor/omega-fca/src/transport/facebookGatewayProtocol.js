"use strict";

const DEFAULT_GATEWAY_URL = "wss://gateway.facebook.com/ws/realtime";
const DEFAULT_APP_ID = "2220391788200892";

// Public FCA implementations use this gateway subscription family for
// Facebook web realtime notifications/presence. It is not Messenger's
// private message-sync protocol and is exposed separately for that reason.
const SUBSCRIPTIONS = Object.freeze([
  '{"x-dgw-app-XRSS-method":"Falco","x-dgw-app-xrs-body":"true","x-dgw-app-XRS-Accept-Ack":"RSAck","x-dgw-app-XRSS-http_referer":"https://www.facebook.com"}',
  '{"x-dgw-app-XRSS-method":"FBGQLS:USER_ACTIVITY_UPDATE_SUBSCRIBE","x-dgw-app-XRSS-doc_id":"9525970914181809","x-dgw-app-XRSS-routing_hint":"UserActivitySubscription","x-dgw-app-xrs-body":"true","x-dgw-app-XRS-Accept-Ack":"RSAck","x-dgw-app-XRSS-http_referer":"https://www.facebook.com"}',
  '{"x-dgw-app-XRSS-method":"FBGQLS:ACTOR_GATEWAY_EXPERIENCE_SUBSCRIBE","x-dgw-app-XRSS-doc_id":"24191710730466150","x-dgw-app-XRSS-routing_hint":"CometActorGatewayExperienceSubscription","x-dgw-app-xrs-body":"true","x-dgw-app-XRS-Accept-Ack":"RSAck","x-dgw-app-XRSS-http_referer":"https://www.facebook.com"}',
  '{"x-dgw-app-XRSS-method":"FBLQ:comet_notifications_live_query_experimental","x-dgw-app-XRSS-doc_id":"9784489068321501","x-dgw-app-XRSS-actor_id":"{{USER_ID}}","x-dgw-app-XRSS-page_id":"{{USER_ID}}","x-dgw-app-XRSS-request_stream_retry":"false","x-dgw-app-xrs-body":"true","x-dgw-app-XRS-Accept-Ack":"RSAck","x-dgw-app-XRSS-http_referer":"https://www.facebook.com"}',
  '{"x-dgw-app-XRSS-method":"FBGQLS:FRIEND_REQUEST_CONFIRM_SUBSCRIBE","x-dgw-app-XRSS-doc_id":"9687616244672204","x-dgw-app-XRSS-routing_hint":"FriendingCometFriendRequestConfirmSubscription","x-dgw-app-xrs-body":"true","x-dgw-app-XRS-Accept-Ack":"RSAck","x-dgw-app-XRSS-http_referer":"https://www.facebook.com"}',
  '{"x-dgw-app-XRSS-method":"FBGQLS:FRIEND_REQUEST_RECEIVE_SUBSCRIBE","x-dgw-app-XRSS-doc_id":"24047008371656912","x-dgw-app-XRSS-routing_hint":"FriendingCometFriendRequestReceiveSubscription","x-dgw-app-xrs-body":"true","x-dgw-app-XRS-Accept-Ack":"RSAck","x-dgw-app-XRSS-http_referer":"https://www.facebook.com"}',
  '{"x-dgw-app-XRSS-method":"FBGQLS:RTWEB_CALL_BLOCKED_SETTING_SUBSCRIBE","x-dgw-app-XRSS-doc_id":"24429620016626810","x-dgw-app-XRSS-routing_hint":"RTWebCallBlockedSettingSubscription_CallBlockSettingSubscription","x-dgw-app-xrs-body":"true","x-dgw-app-XRS-Accept-Ack":"RSAck","x-dgw-app-XRSS-http_referer":"https://www.facebook.com"}',
  '{"x-dgw-app-XRSS-method":"PresenceUnifiedJSON","x-dgw-app-xrs-body":"true","x-dgw-app-XRS-Accept-Ack":"RSAck","x-dgw-app-XRSS-http_referer":"https://www.facebook.com/friends"}'
]);

function validateId(value, name) {
  const id = String(value ?? "");
  if (!/^\d{1,30}$/.test(id)) throw new TypeError(name + " must be a numeric Facebook ID");
  return id;
}

function encodeGatewaySubscription(payload, index) {
  if (typeof payload !== "string" || !Number.isInteger(index) || index < 0 || index > 255) {
    throw new TypeError("Invalid realtime subscription");
  }
  const body = Buffer.from(payload, "utf8");
  if (body.length > 65535) throw new RangeError("Realtime subscription exceeds two-byte length");
  return Buffer.concat([Buffer.from([14, index, (body.length >> 8) & 0xff, body.length & 0xff]), body, Buffer.from([0, 0])]);
}

function decodeGatewayFrame(frame, { maxFrameBytes = 1024 * 1024 } = {}) {
  let bytes;
  if (typeof frame === "string") bytes = Buffer.from(frame, "utf8");
  else if (Buffer.isBuffer(frame) || frame instanceof Uint8Array) bytes = Buffer.from(frame);
  else if (frame instanceof ArrayBuffer) bytes = Buffer.from(frame);
  else throw new TypeError("Unsupported Facebook realtime frame type");
  if (!bytes.length || bytes.length > maxFrameBytes) throw new RangeError("Facebook realtime frame size is invalid");

  const text = bytes.toString("utf8");
  const start = text.indexOf("{");
  if (start < 0) return { events: [{ type: "raw", byteLength: bytes.length }] };
  let payload;
  try { payload = JSON.parse(text.slice(start)); }
  catch {
    const end = text.lastIndexOf("}");
    if (end < start) throw new Error("Facebook realtime frame contains invalid JSON");
    payload = JSON.parse(text.slice(start, end + 1));
  }
  const events = [];
  if (payload?.code === 200) events.push({ type: "subscription_success", payload });
  const notification = payload?.data?.viewer?.notifications_page?.edges?.[1]?.node?.notif;
  if (notification) {
    const senders = notification.tracking?.from_uids || {};
    events.push({
      type: "notification",
      notificationId: notification.notif_id ?? null,
      body: notification.body?.text ?? null,
      senderId: Object.keys(senders)[0] ?? null,
      url: notification.url ?? null,
      timestamp: notification.creation_time?.timestamp ?? null,
      seenState: notification.seen_state ?? null,
      raw: payload
    });
  }
  if (!events.length) events.push({ type: "payload", payload });
  return { events };
}

function createFacebookGatewayProtocol(options = {}) {
  const userId = validateId(options.userId, "userId");
  const deviceId = String(options.deviceId ?? userId);
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(deviceId)) throw new TypeError("deviceId is invalid");
  const appId = String(options.appId ?? DEFAULT_APP_ID);
  if (!/^\d{1,30}$/.test(appId)) throw new TypeError("appId is invalid");
  const subscriptions = options.subscriptions ?? SUBSCRIPTIONS;
  if (!Array.isArray(subscriptions) || subscriptions.length < 1 || subscriptions.length > 32) {
    throw new TypeError("subscriptions must contain between 1 and 32 entries");
  }
  const url = new URL(options.url ?? DEFAULT_GATEWAY_URL);
  if (url.protocol !== "wss:" || url.hostname !== "gateway.facebook.com" || url.pathname !== "/ws/realtime") {
    throw new TypeError("Facebook realtime URL must use the verified gateway.facebook.com/ws/realtime endpoint");
  }
  for (const [key, value] of Object.entries({
    "x-dgw-appid": appId,
    "x-dgw-appversion": "0",
    "x-dgw-authtype": "1:0",
    "x-dgw-version": "5",
    "x-dgw-uuid": userId,
    "x-dgw-tier": "prod",
    "x-dgw-deviceid": deviceId,
    "x-dgw-app-stream-group": "group1"
  })) url.searchParams.set(key, value);

  const headers = {
    Origin: "https://www.facebook.com",
    Referer: "https://www.facebook.com",
    ...(options.userAgent ? { "User-Agent": String(options.userAgent) } : {}),
    ...(options.cookie ? { Cookie: String(options.cookie) } : {})
  };
  if (options.cookie && /[\r\n]/.test(headers.Cookie)) throw new TypeError("cookie header contains invalid characters");

  return Object.freeze({
    url: url.toString(),
    headers: Object.freeze(headers),
    protocol: Object.freeze({
      async authenticate() {
        // Authentication is performed by the authenticated WebSocket upgrade
        // using the caller's owner-provided Facebook session cookies.
      },
      async subscribe(socket) {
        for (let index = 0; index < subscriptions.length; index++) {
          const payload = String(subscriptions[index]).replaceAll("{{USER_ID}}", userId);
          socket.send(encodeGatewaySubscription(payload, index));
        }
      },
      decodeFrame: decodeGatewayFrame,
      async encodeAction() {
        throw new Error("This gateway subscription transport does not support Messenger send actions");
      }
    })
  });
}

module.exports = {
  DEFAULT_GATEWAY_URL,
  DEFAULT_APP_ID,
  FACEBOOK_GATEWAY_SUBSCRIPTIONS: SUBSCRIPTIONS,
  encodeGatewaySubscription,
  decodeGatewayFrame,
  createFacebookGatewayProtocol
};
