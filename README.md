<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://readme-typing-svg.herokuapp.com?font=JetBrains+Mono&weight=700&size=18&duration=3000&pause=800&color=00FFD1&background=00000000&center=true&vCenter=true&width=700&lines=GoatBot-Pro;Facebook+Messenger+Bot+Framework;Built+on+Goat+Bot+V2+%E2%80%94+Modified+by+EryXenX;Fast+%E2%80%A2+Smart+%E2%80%A2+Reliable+%E2%80%A2+Powerful" />
  <source media="(prefers-color-scheme: light)" srcset="https://readme-typing-svg.herokuapp.com?font=JetBrains+Mono&weight=700&size=18&duration=3000&pause=800&color=0E7C86&background=00000000&center=true&vCenter=true&width=700&lines=GoatBot-Pro;Facebook+Messenger+Bot+Framework;Built+on+Goat+Bot+V2+%E2%80%94+Modified+by+EryXenX;Fast+%E2%80%A2+Smart+%E2%80%A2+Reliable+%E2%80%A2+Powerful" />
  <img src="https://readme-typing-svg.herokuapp.com?font=JetBrains+Mono&weight=700&size=18&duration=3000&pause=800&color=0E7C86&background=00000000&center=true&vCenter=true&width=700&lines=GoatBot-Pro;Facebook+Messenger+Bot+Framework;Built+on+Goat+Bot+V2+%E2%80%94+Modified+by+EryXenX;Fast+%E2%80%A2+Smart+%E2%80%A2+Reliable+%E2%80%A2+Powerful" />
</picture>

<br/>

![Version](https://img.shields.io/badge/Version-7.1.0-0E7C86?style=for-the-badge&logo=github&logoColor=white)
![Node](https://img.shields.io/badge/Node.js-20.x-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Base](https://img.shields.io/badge/Based_on-Goat_Bot_V2-FF6B6B?style=for-the-badge&logo=github&logoColor=white)
![Fork](https://img.shields.io/badge/Fork_by-EryXenX-6E40C9?style=for-the-badge&logo=github&logoColor=white)
![FCA](https://img.shields.io/badge/FCA-%40eryxenx%2Ffca-0E7C86?style=for-the-badge&logoColor=white)

</div>

---

## ◈ About

Assalamu Alaikum! **OmegA-Goatbot** is based on [Goat Bot V2](https://github.com/ntkhang03/Goat-Bot-V2) by **ntkhang03** and includes improvements and custom features. Maintained and customized by **Md SalmaN (NirZon)**. Original fork credits are preserved below.

| Feature | Description |
|---|---|
| 🔌 **Custom FCA** | Keeps `@eryxenx/fca` as default; includes a guarded, opt-in `@nirzon-islam/omega-fca` migration path |
| ⚙️ **Handler Improvements** | No-prefix system for bot admins, smart command suggestion |
| 🌐 **Multi-Language** | Supports EN, BN, HI, TL, AR, VI |
| 🎨 **UI Overhaul** | Redesigned message templates with clean formatting |
| 🛡️ **React Unsend** | Auto-unsend messages on specific emoji reactions |
| 🔧 **Setting Command** | Full bot config control via chat — no need to edit files manually |

> ⚠️ For educational purposes only. Any misuse or illegal activity is solely the user's responsibility.


## ◈ সহজ Setup Guide (বাংলা)

### যা লাগবে
- GitHub account
- Node.js 20 (Local setup-এর জন্য)
- Facebook account-এর valid login cookies
- Railway অথবা VPS
- Agent ব্যবহার করতে চাইলে Agent Backend ও MongoDB

### 1. GoatBot চালু করো

Repository clone/download করে project folder-এ terminal খুলে চালাও:

```bash
npm install
```

Facebook login cookies JSON array format-এ project-এর root folder-এর `account.txt` ফাইলে রাখো। তারপর `config.json`-এ নিজের Facebook UID `adminBot`-এ এবং পছন্দের prefix সেট করো।

Bot চালু করো:

```bash
npm start
```

### 2. Railway-তে Deploy

1. [Railway](https://railway.com/) খুলে **New Project → Deploy from GitHub Repo** নির্বাচন করো।
2. `OmegA-Goatbot` repository connect করো।
3. **Settings → Deploy**-এ Start Command হিসেবে দাও:

```bash
npm start
```

4. **Variables** tab-এ গিয়ে মনে রাখবে:

```env
PORT
```

Railway নিজে থেকেই `PORT` তৈরি করে দেয়—সাধারণত আলাদা করে value বসানোর দরকার নেই। এই repository-র বর্তমান code-এ `PORT` ছাড়া Railway-এর জন্য অন্য কোনো custom Environment Variable বাধ্যতামূলক নয়। তাই অকারণে `MONGODB_URI`, `COOKIE` বা অন্য variable যোগ কোরো না।

5. Facebook login-এর জন্য project-এর `account.txt` ফাইলে cookies JSON array format-এ দিতে হবে। Bot-এর settings যেমন prefix ও admin UID `config.json` থেকে নিয়ন্ত্রণ করা হয়।
6. **Deploy** করো এবং **Deployments → View Logs** থেকে login ও startup status দেখো।

VPS-এও `npm install` এবং `npm start` চালাতে পারো। Bot সবসময় চালু রাখতে process manager ব্যবহার করতে পারো।

**Render ব্যবহার কোরো না:** এই bot-এর persistent MQTT/WebSocket connection এবং filesystem session storage দরকার, যা Render-এ compatible নয়।

### 3. Agent Backend (ঐচ্ছিক)

Agent ব্যবহার করতে চাইলে [Agent Backend](https://github.com/nirzon-islam/Agent-Backend) আলাদাভাবে Render Web Service হিসেবে deploy করো। সেখানে MongoDB URI, Admin login এবং অন্তত একটি AI provider-এর API key configure করতে হবে। বিস্তারিত variable list ও setup ওই repository-র README / setup guide-এ দেওয়া আছে।

**নোট:** শুধু Agent Backend deploy করলেই GoatBot-এর সঙ্গে connection তৈরি হবে না। GoatBot-এর ব্যবহৃত branch-এ Agent integration support থাকতে হবে এবং প্রয়োজনীয় bridge configuration থাকতে হবে।

### দরকারি লিংক
- [OmegA-Goatbot Repository](https://github.com/nirzon-islam/OmegA-Goatbot)
- [Agent Backend](https://github.com/nirzon-islam/Agent-Backend)
- [Railway](https://railway.com/)
- [Render](https://render.com/)
- [MongoDB Atlas](https://www.mongodb.com/atlas)
- [Node.js](https://nodejs.org/)

### নিরাপত্তা
- `account.txt`-এর cookies, API key, database URI বা password কাউকে দেবে না।
- এগুলো কখনো GitHub-এ upload কোরো না।
- নিজের Facebook UID ছাড়া অন্য কাউকে bot admin কোরো না।

---

## ◈ Support

<div align="center">

[![Messenger Group](https://img.shields.io/badge/Join%20Support%20Group-0084FF?style=for-the-badge&logo=messenger&logoColor=white)](https://m.me/j/AbayU2oh5OPVLvZm/?send_source=gc%3Acopy_invite_link_c)
[![Facebook](https://img.shields.io/badge/Facebook-1877F2?style=for-the-badge&logo=facebook&logoColor=white)](https://facebook.com/EryXenX)
[![GitHub](https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/EryXenX)
[![YouTube](https://img.shields.io/badge/YouTube-FF0000?style=for-the-badge&logo=youtube&logoColor=white)](https://youtube.com/@EryXenX)
[![Telegram](https://img.shields.io/badge/Telegram-0088CC?style=for-the-badge&logo=telegram&logoColor=white)](https://t.me/EryXenX_Official)
[![Instagram](https://img.shields.io/badge/Instagram-E4405F?style=for-the-badge&logo=instagram&logoColor=white)](https://instagram.com/EryXenX)

</div>

---

## ◈ Setup Tutorial

<div align="center">

### 📹 Watch Before You Start

<a href="https://youtu.be/gPf_BFhQz_w?si=-iknmkmFd_NcRahY">
  <img src="https://img.youtube.com/vi/gPf_BFhQz_w/maxresdefault.jpg" alt="GoatBot-Pro Setup Tutorial" width="680" />
</a>

<br/>

[![Watch Tutorial](https://img.shields.io/badge/▶%20Watch%20Full%20Setup%20Tutorial-FF0000?style=for-the-badge&logo=youtube&logoColor=white)](https://youtu.be/gPf_BFhQz_w?si=-iknmkmFd_NcRahY)

</div>

---

## ◈ Setup

```bash
git clone https://github.com/nirzon-islam/OmegA-Goatbot.git
cd OmegA-Goatbot
npm install
npm start
```

Add your Facebook cookies to `account.txt` (JSON array format from EditThisCookie), then configure `config.json`.

---

## ◈ Running the Bot

### 1. Add your admin UID

In `config.json`, add your Facebook UID to `adminBot` — this is the ID
that can control the bot from chat (admin-only commands, `{prefix}setting`,
no-prefix commands if enabled, etc.):

```json
"adminBot": [
  "your_facebook_uid_here",
  " ",
  " "
]
```

### 2. Add your session cookies

Export your Facebook cookies (JSON array format, e.g. via the
EditThisCookie browser extension) and paste them into `account.txt` at
the project root. This is the login session the bot uses — without a
valid `account.txt`, the bot can't log in.

### 3. Deploy

**Railway or a VPS** — both work fine:

```bash
npm install
npm start
```

On Railway, just connect the repo and it builds/runs the same way. On a
VPS, run it directly or under a process manager (`pm2 start index.js`,
`screen`, `tmux`, etc.) so it stays alive after you disconnect.

**Render — does not work.** Render's platform is not compatible with how
this bot runs (persistent MQTT/WebSocket connection + filesystem writes
for session/appstate). Don't deploy this on Render — use Railway or a VPS
instead.

---

## ◈ Command Structure

Commands go in `scripts/cmds/yourcommand.js`.

```js
module.exports = {
  config: {
    name: "commandname",
    version: "1.0.0",
    author: "YourName",
    countDown: 5,
    role: 0,
    shortDescription: "...",
    longDescription: "...",
    category: "fun",
    guide: "{prefix}commandname [args]"
  },

  onStart: async function ({ api, event, args, message, getLang }) {
    message.reply("Hello!");
  },

  onReply: async function ({ api, event, Reply, message }) {
    if (event.senderID !== Reply.author) return;
    message.reply(`You replied: ${event.body}`);
  },

  onReaction: async function ({ api, event, Reaction, message }) {
    message.reply(`You reacted with: ${event.reaction}`);
  },

  onChat: async function ({ api, event, message }) {
    if (event.body === "hello") message.reply("hi!");
  },

  onEvent: async function ({ api, event, message }) {
    if (event.logMessageType === "log:subscribe") {
      message.reply("Welcome!");
    }
  }
};
```

---

## ◈ Permission Roles

| Value | Who can use |
|---|---|
| `0` | Everyone |
| `1` | Group admins only |
| `2` | Bot admins only (set in `config.json`) |

---

## ◈ API Reference

```js
message.reply("text")
api.sendMessage("text", threadID)
api.sendMessage({ body: "text", attachment }, tid)
api.setMessageReaction("✅", event.messageID, () => {}, true)
api.unsendMessage(messageID)
api.getCurrentUserID()
await api.getThreadInfo(threadID)
await api.getUserInfo(userID)
```

---

## ◈ onReply Pattern

```js
const sent = await message.reply("What's your name?");
global.GoatBot.onReply.set(sent.messageID, {
  commandName: "mycommand",
  messageID: sent.messageID,
  author: event.senderID,
  step: 1
});

onReply: async function ({ api, event, Reply, message }) {
  if (event.senderID !== Reply.author) return;
  message.reply(`Hello, ${event.body}!`);
}
```

---

## ◈ Event Types

```js
switch (event.logMessageType) {
  case "log:subscribe":
  case "log:unsubscribe":
  case "log:thread-name":
  case "log:thread-image":
  case "log:thread-admins":
}
```

---

## ◈ config.json Key Options

```json
{
  "prefix": "-",
  "adminBot": ["your_facebook_id"],
  "noPrefix": { "enable": false },
  "e2ee": { "enable": true },
  "reactUnsend": {
    "enable": true,
    "onlyAdmin": true,
    "emojis": ["😡"]
  },
  "optionsFca": {
    "listenEvents": true,
    "autoMarkDelivery": false,
    "updatePresence": false,
    "selfListen": false,
    "autoReconnect": true
  }
}
```

### E2EE (Encrypted Messaging)

`config.e2ee.enable` controls whether the bot connects Facebook's E2EE
(Signal Protocol encrypted threads) layer on startup.

- `true` — E2EE connects on login. Needed if you want the bot to send/receive
  in end-to-end encrypted threads. This runs a second, independent login to
  Facebook using the same session, which carries extra account-flagging risk
  (see below).
- `false` — E2EE is skipped entirely, bot runs on the regular MQTT session
  only. Safer against account flags/logouts; encrypted threads just won't
  work with the bot.

**Toggle it from chat** — `{prefix}setting` → **Connection (FCA / MQTT)**
→ **E2EE**. This flips `config.e2ee.enable` and saves `config.json`
automatically, but **needs a bot restart** to actually take effect (E2EE
only connects once, at login).

**Or edit `config.json` directly** and restart the bot:

```json
"e2ee": { "enable": false }
```

---

## ◈ OmegA-FCA package migration (experimental)

This branch includes an opt-in provider path for the published `@nirzon-islam/omega-fca` package.

- The default remains `@eryxenx/fca`; existing deployments are unchanged.
- `@nirzon-islam/omega-fca` is an optional dependency so the bot can continue installing while the package release is pending.
- After the package is published and installed, set `OMEGA_FCA_PROVIDER=omega` in the deployment environment to request it.
- The provider guard refuses the switch unless both `config.json` settings are explicitly disabled:
  - `e2ee.enable: false` — OmegA-FCA does not yet expose the legacy `api.e2ee` Messenger integration.
  - `humanizer.enable: false` — the GoatBot humanizer currently depends on FCA-specific methods not yet verified in OmegA-FCA.
- To keep the current production behavior, leave `OMEGA_FCA_PROVIDER` unset (or set it to `eryxenx`).

**Important:** source-level callback/API compatibility is not live Facebook validation. Do not enable the OmegA-FCA provider for production until package publication, bot regression tests, MQTT readiness/recovery checks, and an authorized Railway/VPS login test have passed.

## ◈ Command Anti-Spam (Humanizer)

Every command reply goes through `@eryxenx/fca`'s built-in humanizer —
the bot waits a delay before replying to a command, shows the typing
indicator for exactly that window, and enforces a per-thread cooldown so
command spam gets dropped instead of flooding replies. Plain chat
(non-commands) is untouched — no delay, no typing.

The delay is set from `config.json`, so you can make replies faster or
slower (or turn the delay off entirely) without touching the code:

```json
"humanizer": {
  "enable": true,      // false = reply instantly, no delay, no typing
  "delayMs": 3000,     // how long to wait (and show typing) before replying
  "cooldownMs": 5500,  // min gap between two accepted commands, per thread
  "maxPerMinute": 20   // global cap on accepted commands
}
```

`delayMs` also accepts a range, e.g. `[2000, 4000]`, for a random delay.
The typing indicator always lasts exactly the delay, so the two never
drift apart. Change it live from chat with `{prefix}setting` →
Bot Behavior → Typing Indicator, or edit `config.json` and restart.

This applies automatically to:
- normal prefixed commands (`/help`, etc.)
- no-prefix admin commands (when `config.noPrefix.enable: true`)
- `onChat` triggers (e.g. typing `prefix` with no `/`)
- `onReply` flows — including multi-step ones like `{prefix}setting`'s
  "reply with a number" menus

No setup needed on the GoatBot side — it's active as soon as the bot logs
in. See `@eryxenx/fca`'s own README for configuration options
(`reactDelayMs`, `cooldownMs`, `maxPerMinute`, disabling it entirely, etc.).

---

<div align="center">
  <sub>Built on the shoulders of giants · Respect Open Source · Credit your sources</sub>
  <br/>
  <sub><b>Original Work © NTKhang (ntkhang03) &nbsp;|&nbsp; Fork by EryXenX (Mohammad Akash)</b></sub>
</div>
