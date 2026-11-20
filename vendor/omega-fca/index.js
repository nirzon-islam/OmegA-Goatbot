"use strict";

const { normalizeCookies, validateSessionCookies, parseCookieHeader, parseNetscapeCookies } = require("./src/security/cookies");
const { redactSecrets } = require("./src/security/redact");
const { createDiagnosticRecorder } = require("./src/security/diagnostics");
const { classifySessionState, describeError } = require("./src/security/sessionState");
const { encryptSession, decryptSession } = require("./src/security/sessionCrypto");
const { saveSession, loadSession, deleteSession } = require("./src/security/sessionStore");
const { ConnectionSupervisor } = require("./src/runtime/connection");
const { EventDispatcher } = require("./src/events/dispatcher");
const { CookieJar } = require("./src/network/cookieJar");
const { createRequestClient, retryAfterMs, isRetryableStatus } = require("./src/network/requestClient");
const { createPersonalSession, detectSessionChallenge, extractIdentity, extractFacebookTokens } = require("./src/auth/personalSession");
const { createAuthenticationAttempt, AUTHENTICATION_ATTEMPT_STATES } = require("./src/auth/authenticationAttempt");
const { parseAccountText, loadAccountConfig } = require("./src/auth/accountConfig");
const { generateTotp } = require("./src/auth/totp");
const { normalizeFacebookResponse, stripFacebookJsonPrefix, createFacebookError } = require("./src/auth/facebookResponse");
const { createFacebookWebClient, assertFacebookUrl, toFormBody } = require("./src/auth/facebookWebClient");
const { createClient } = require("./src/api/client");
const { createGoatBotLogin } = require("./src/compat/goatbotLogin");
const { createFacebookMqttClient } = require("./src/compat/facebookMqttClient");
const { createLegacyFcaProvider } = require("./src/compat/legacyFcaTransport");
const { verifyLicenseToken } = require("./src/license/verify");
const { createLicenseProvider } = require("./src/license/provider");
const { validateTransportDriver, createTransportFactory } = require("./src/transport/contract");
const { createMetaMessengerTransport, normalizeWebhookPayload, verifyWebhookSignature, verifyWebhookChallenge } = require("./src/transport/metaMessenger");
const { decodeRealtimeFrame, summarizeRealtimeFrame, DEFAULT_MAX_FRAME_BYTES } = require("./src/transport/realtimeFrameDecoder");
const { inspectRealtimeBinaryPayload, DEFAULT_MAX_BINARY_PAYLOAD_BYTES } = require("./src/transport/binaryPayloadInspector");
const { inspectRealtimeSyncEnvelope, DEFAULT_MAX_SYNC_FRAME_BYTES } = require("./src/transport/realtimeSyncEnvelope");
const { createNativeRealtimeTransport, DEFAULT_CONNECT_TIMEOUT_MS, DEFAULT_CLOSE_TIMEOUT_MS, DEFAULT_PROTOCOL_SETUP_TIMEOUT_MS } = require("./src/transport/nativeRealtimeTransport");
const { DEFAULT_GATEWAY_URL, DEFAULT_APP_ID, FACEBOOK_GATEWAY_SUBSCRIPTIONS, encodeGatewaySubscription, decodeGatewayFrame, createFacebookGatewayProtocol } = require("./src/transport/facebookGatewayProtocol");
const mqtt311Codec = require("./src/transport/mqtt311Codec");
const { createMqtt311StreamDecoder } = require("./src/transport/mqtt311StreamDecoder");
const { createMqttRequestTracker } = require("./src/transport/mqttRequestTracker");
const { MESSENGER_MQTT_APP_ID, SEND_MESSAGE_VERSION_ID, offlineThreadingId, createMessengerSendMessageRequest } = require("./src/transport/messengerActions");
const { DEFAULT_MQTT_URL, DEFAULT_MQTT_APP_ID, DEFAULT_MQTT_TOPICS, createFacebookMqttProtocol } = require("./src/transport/facebookMqttProtocol");
const { parseMessengerSyncPayload, normalizeMessengerDelta } = require("./src/transport/facebookMqttEvents");
const { createMessengerSyncCursorStore } = require("./src/transport/messengerSyncCursorStore");
const { createFacebookMqttDriver } = require("./src/transport/facebookMqttDriver");
const { createFacebookThreadApi, DOC_IDS: FACEBOOK_THREAD_DOC_IDS } = require("./src/transport/facebookThreadApi");
const { parseVersion, compareVersions, verifyUpdateManifest, verifyArtifactDigest } = require("./src/update/manifest");

module.exports = {
  normalizeCookies, validateSessionCookies, parseCookieHeader, parseNetscapeCookies,
  redactSecrets, createDiagnosticRecorder, classifySessionState, describeError, encryptSession, decryptSession,
  saveSession, loadSession, deleteSession, ConnectionSupervisor, EventDispatcher,
  CookieJar, createRequestClient, retryAfterMs, isRetryableStatus, createPersonalSession, detectSessionChallenge, extractIdentity, extractFacebookTokens,
  createAuthenticationAttempt, AUTHENTICATION_ATTEMPT_STATES,
  parseAccountText, loadAccountConfig, generateTotp,
  normalizeFacebookResponse, stripFacebookJsonPrefix, createFacebookError,
  createFacebookWebClient, assertFacebookUrl, toFormBody, createClient,
  createGoatBotLogin, createFacebookMqttClient, createLegacyFcaProvider, verifyLicenseToken, createLicenseProvider,
  validateTransportDriver, createTransportFactory, createMetaMessengerTransport,
  normalizeWebhookPayload, verifyWebhookSignature, verifyWebhookChallenge,
  decodeRealtimeFrame, summarizeRealtimeFrame, DEFAULT_MAX_FRAME_BYTES,
  inspectRealtimeBinaryPayload, DEFAULT_MAX_BINARY_PAYLOAD_BYTES,
  inspectRealtimeSyncEnvelope, DEFAULT_MAX_SYNC_FRAME_BYTES,
  createNativeRealtimeTransport, DEFAULT_CONNECT_TIMEOUT_MS, DEFAULT_CLOSE_TIMEOUT_MS, DEFAULT_PROTOCOL_SETUP_TIMEOUT_MS,
  DEFAULT_GATEWAY_URL, DEFAULT_APP_ID, FACEBOOK_GATEWAY_SUBSCRIPTIONS, encodeGatewaySubscription, decodeGatewayFrame, createFacebookGatewayProtocol, mqtt311Codec, createMqtt311StreamDecoder, createMqttRequestTracker, MESSENGER_MQTT_APP_ID, SEND_MESSAGE_VERSION_ID, offlineThreadingId, createMessengerSendMessageRequest, DEFAULT_MQTT_URL, DEFAULT_MQTT_APP_ID, DEFAULT_MQTT_TOPICS, createFacebookMqttProtocol, parseMessengerSyncPayload, normalizeMessengerDelta, createMessengerSyncCursorStore, createFacebookMqttDriver, createFacebookThreadApi, FACEBOOK_THREAD_DOC_IDS,
  parseVersion, compareVersions, verifyUpdateManifest, verifyArtifactDigest,
  version: require("./package.json").version
};
