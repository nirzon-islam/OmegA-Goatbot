"use strict";

const { normalizeCookies } = require("../security/cookies");

function domainMatches(host, cookieDomain, hostOnly) {
  if (host === cookieDomain) return true;
  return !hostOnly && host.endsWith("." + cookieDomain);
}

function pathMatches(requestPath, cookiePath) {
  if (requestPath === cookiePath) return true;
  if (!requestPath.startsWith(cookiePath)) return false;
  return cookiePath.endsWith("/") || requestPath.charAt(cookiePath.length) === "/";
}

class CookieJar {
  constructor(cookies = [], { now = Date.now } = {}) {
    this.now = now;
    this.cookies = [];
    if (cookies.length) this.setCookies(cookies);
  }

  setCookies(cookies) {
    const normalized = normalizeCookies(cookies);
    for (const cookie of normalized) {
      this.cookies = this.cookies.filter(existing =>
        !(existing.key === cookie.key && existing.domain === cookie.domain && existing.path === cookie.path)
      );
      this.cookies.push(cookie);
    }
    return this;
  }

  deleteCookies(cookies) {
    if (!Array.isArray(cookies)) throw new TypeError("Cookie deletions must be an array");
    for (const cookie of cookies) {
      if (!cookie || typeof cookie.key !== "string" || typeof cookie.domain !== "string" || typeof cookie.path !== "string") {
        throw new TypeError("Invalid cookie deletion");
      }
      this.cookies = this.cookies.filter(existing =>
        !(existing.key === cookie.key && existing.domain === cookie.domain && existing.path === cookie.path)
      );
    }
    return this;
  }

  getCookieHeader(inputUrl) {
    const url = inputUrl instanceof URL ? inputUrl : new URL(inputUrl);
    const host = url.hostname.toLowerCase();
    const requestPath = url.pathname || "/";
    if (url.protocol !== "https:") throw new TypeError("Facebook session cookies may only be sent over HTTPS");
    const now = this.now();
    const matches = this.cookies.filter(cookie => {
      if (cookie.expires) {
        const expiry = cookie.expires instanceof Date ? cookie.expires.getTime()
          : typeof cookie.expires === "number" ? cookie.expires * 1000
          : Date.parse(cookie.expires);
        if (Number.isFinite(expiry) && expiry > 0 && expiry <= now) return false;
      }
      if (!domainMatches(host, cookie.domain, cookie.hostOnly)) return false;
      if (!pathMatches(requestPath, cookie.path)) return false;
      if (cookie.secure && url.protocol !== "https:") return false;
      return true;
    }).sort((a, b) => b.path.length - a.path.length);
    return matches.map(cookie => cookie.key + "=" + cookie.value).join("; ");
  }

  clear() { this.cookies = []; }
  get size() { return this.cookies.length; }
}

module.exports = { CookieJar };
