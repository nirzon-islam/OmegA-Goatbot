"use strict";

const SECRET_KEYS = new Set([
  "cookie", "cookies", "appstate", "password", "pass", "xs", "cuser",
  "token", "accesstoken", "authorization", "secret", "appsecret",
  "clientsecret", "pageaccesstoken", "licensekey", "twofasecret",
  "twofactorsecret", "verifytoken", "webhookverifytoken", "sessionkey",
  "encryptionkey", "privatekey", "authorizationcode"
]);

function redactSecrets(value, key = "") {
  const normalizedKey = String(key).toLowerCase().replace(/[^a-z0-9]/g, "");
  if (SECRET_KEYS.has(normalizedKey)) return "[REDACTED]";
  if (Array.isArray(value)) return value.map(item => redactSecrets(item));
  if (!value || typeof value !== "object") return value;
  const output = {};
  for (const [childKey, childValue] of Object.entries(value)) {
    output[childKey] = redactSecrets(childValue, childKey);
  }
  return output;
}

module.exports = { redactSecrets };
