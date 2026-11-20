"use strict";

const REQUIRED_DRIVER_METHODS = Object.freeze(["listen"]);
const OPTIONAL_DRIVER_METHODS = Object.freeze([
  "disconnect", "getCurrentUserID", "sendRequest", "sendMessage", "getUserInfo", "getThreadInfo",
  "getThreadList", "markAsRead", "setMessageReaction", "sendTypingIndicator",
  "unsendMessage", "changeNickname", "addUserToGroup", "removeUserFromGroup",
  "createNewGroup", "getThreadHistory", "getMessage", "getFriendsList", "getUserID"
]);

function validateTransportDriver(driver) {
  if (!driver || typeof driver !== "object" || Array.isArray(driver)) {
    throw new TypeError("Transport provider must return a driver object");
  }
  for (const method of REQUIRED_DRIVER_METHODS) {
    if (typeof driver[method] !== "function") {
      const error = new Error("Transport driver is missing required method: " + method);
      error.code = "FCA_TRANSPORT_CONTRACT_INVALID";
      error.retryable = false;
      throw error;
    }
  }
  for (const method of OPTIONAL_DRIVER_METHODS) {
    if (driver[method] !== undefined && typeof driver[method] !== "function") {
      const error = new Error("Transport driver method must be a function: " + method);
      error.code = "FCA_TRANSPORT_CONTRACT_INVALID";
      error.retryable = false;
      throw error;
    }
  }
  return driver;
}

function createTransportFactory(provider) {
  if (typeof provider !== "function") throw new TypeError("Transport provider must be a function");
  return async context => validateTransportDriver(await provider(context));
}

module.exports = { REQUIRED_DRIVER_METHODS, OPTIONAL_DRIVER_METHODS, validateTransportDriver, createTransportFactory };
