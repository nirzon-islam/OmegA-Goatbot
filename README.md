<div align="center">

<img src="dashboard/images/OmegA-Goatbot_Neon%20Duo.png" alt="OmegA GoatBot — Neon Duo" width="100%" />

<br/>

# <span style="color:#00F5FF">OmegA</span> <span style="color:#FF36D7">GOATBOT</span>

### ⚡ NEON POWER · SMART AUTOMATION · MESSENGER FRAMEWORK ⚡

<p>
  <img src="https://img.shields.io/badge/NEON-EDITION-00F5FF?style=for-the-badge&labelColor=090018" />
  <img src="https://img.shields.io/badge/NODE.JS-20.x-7B2CFF?style=for-the-badge&logo=nodedotjs&logoColor=white&labelColor=090018" />
  <img src="https://img.shields.io/badge/PLATFORM-FACEBOOK_MESSENGER-FF36D7?style=for-the-badge&logo=messenger&logoColor=white&labelColor=090018" />
</p>

<p>
  <a href="#-features"><strong>FEATURES</strong></a> ·
  <a href="#-quick-start"><strong>QUICK START</strong></a> ·
  <a href="#-deployment"><strong>DEPLOYMENT</strong></a> ·
  <a href="#-documentation"><strong>DOCS</strong></a> ·
  <a href="#-support"><strong>SUPPORT</strong></a>
</p>

<img src="https://readme-typing-svg.herokuapp.com?font=JetBrains+Mono&weight=700&size=16&duration=2800&pause=700&color=00F5FF&center=true&vCenter=true&width=650&lines=Welcome+to+OmegA-Goatbot;Built+for+Messenger+Automation;Fast+%E2%80%A2+Smart+%E2%80%A2+Customizable" alt="OmegA typing banner" />

</div>

---

<div align="center">

### ◈ PROJECT SNAPSHOT

| Runtime | Framework Base | Default FCA | Maintainer |
|:---:|:---:|:---:|:---:|
| **Node.js 20** | **Goat Bot V2** | **@eryxenx/fca** | **OmegA** |

</div>

## 🌌 About OmegA

**OmegA-Goatbot** is a customized Facebook Messenger bot framework based on [Goat Bot V2](https://github.com/ntkhang03/Goat-Bot-V2), originally created by **NTKhang**. This fork adds custom handlers, interface improvements, automation features and an experimental migration path to the OmegA FCA package.

> 💠 Maintained and customized by **Md SalmaN (NirZon)**. Original project and fork credits are preserved below.

## 🚀 Features

<div align="center">

| ✨ Feature | 💎 What it does |
|:---|:---|
| 🔌 **Custom FCA** | Keeps `@eryxenx/fca` as default, with a guarded opt-in `@nirzon-islam/omega-fca` migration path |
| ⚙️ **Handler Improvements** | Admin no-prefix system and smart command suggestions |
| 🌐 **Multi-Language** | EN · BN · HI · TL · AR · VI |
| 🎨 **UI Improvements** | Redesigned message templates and clean formatting |
| 🛡️ **React Unsend** | Auto-unsend messages on configured emoji reactions |
| 🔧 **Setting Command** | Manage supported bot settings directly from chat |
| 🔐 **E2EE Options** | Configurable encrypted-message integration through the current FCA path |
| 🧠 **Humanizer** | Configurable command reply delay and anti-spam cooldown |
| 🤖 **Agent Bridge** | Optional bridge integration when its backend and bot-side configuration are available |

</div>

<sub>Feature availability depends on the active branch, configuration and connected services. Experimental features are not production guarantees.</sub>

## ⚡ Quick Start

### Requirements

- Node.js **20.x**
- npm
- Facebook session cookies in JSON-array format
- A GitHub account for cloning
- Railway or a VPS for hosting

### Install and run

```bash
git clone https://github.com/nirzon-islam/OmegA-Goatbot.git
cd OmegA-Goatbot
npm install
npm start
```

### Configure your account

1. Put your Facebook cookies in the root `account.txt` file as a JSON array.
2. Open `config.json`.
3. Add your Facebook UID to `adminBot` and choose your command prefix.
4. Start the bot with `npm start`.

<details>
<summary><strong>Example admin configuration</strong></summary>

```json
"adminBot": [
  "your_facebook_uid_here"
]
```

</details>

## ☁️ Deployment

### Railway

<div align="center">
  <img src="https://img.shields.io/badge/RECOMMENDED-RAILWAY-7B2CFF?style=for-the-badge&logo=railway&logoColor=white" />
</div>

1. Open [Railway](https://railway.com/).
2. Select **New Project → Deploy from GitHub Repo**.
3. Connect your OmegA-Goatbot repository.
4. Set the Start Command to:

```bash
npm start
```

5. Railway provides the `PORT` environment variable automatically in normal deployments; no custom value is usually needed.
6. Ensure `account.txt` and the required config files are present through your private deployment workflow.
7. Deploy and inspect **Deployments → View Logs** for startup and login status.

**Environment note:** The current repository code uses `PORT` for the uptime endpoint. Do not add guessed variables such as `MONGODB_URI` or `COOKIE` unless a specific enabled integration requires them.

### VPS

```bash
npm install
npm start
```

You can use a process manager such as PM2, screen or tmux to keep the process running after disconnecting.

### Hosting compatibility

This bot relies on persistent MQTT/WebSocket connections and filesystem session storage. The current project guidance is to use **Railway or a VPS**, not Render, for the bot process.

### Optional Agent Backend

The [Agent Backend](https://github.com/nirzon-islam/Agent-Backend) can be deployed separately as a Render Web Service when you want to use the optional agent system. Configure its MongoDB URI, admin login and at least one AI provider key according to that repository's setup guide.

> Agent Backend deployment alone does not connect it to GoatBot. The selected GoatBot branch must include Agent Bridge support and its matching bridge configuration.

## 📚 Documentation

### Command structure

Create command files inside `scripts/cmds/yourcommand.js`.

```js
module.exports = {
  config: {
    name: "commandname",
    version: "1.0.0",
    author: "YourName",
    countDown: 5,
    role: 0,
    shortDescription: "A short description",
    longDescription: "A longer description",
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

### Permission roles

| Role | Permission |
|:---:|:---|
| `0` | Everyone |
| `1` | Group admins only |
| `2` | Bot admins only (configured in `config.json`) |

### API quick reference

```js
message.reply("text")
api.sendMessage("text", threadID)
api.sendMessage({ body: "text", attachment }, threadID)
api.setMessageReaction("✅", event.messageID, () => {}, true)
api.unsendMessage(messageID)
api.getCurrentUserID()
await api.getThreadInfo(threadID)
await api.getUserInfo(userID)
```

### onReply pattern

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

### Event types

```js
switch (event.logMessageType) {
  case "log:subscribe":
  case "log:unsubscribe":
  case "log:thread-name":
  case "log:thread-image":
  case "log:thread-admins":
}
```

## 🎛️ Configuration

The following is a reference for commonly used settings. Keep the actual structure in your repository's `config.json` and verify option names against the active code before changing them.

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

### 🔐 E2EE (Encrypted Messaging)

`config.e2ee.enable` controls whether the bot initializes the E2EE integration on startup.

- `true` — requests E2EE initialization through the configured FCA integration. The current setup may perform a separate Facebook login using the same session, which carries additional account risk.
- `false` — skips E2EE initialization; the regular MQTT session remains the messaging path. Encrypted threads will not be handled by this E2EE integration.

You can use `{prefix}setting` → **Connection (FCA / MQTT)** → **E2EE** where supported, or edit `config.json` and restart the bot. A restart is required because E2EE is initialized during login.

### 🧪 OmegA-FCA migration (experimental)

This branch contains an opt-in provider path for `@nirzon-islam/omega-fca`.

- Default provider remains `@eryxenx/fca`; existing deployments retain the current behavior.
- The OmegA provider is optional and should only be enabled when the package is available in the deployment.
- Set `OMEGA_FCA_PROVIDER=omega` to request the OmegA provider.
- The provider guard requires `e2ee.enable: false` and `humanizer.enable: false` because those integrations currently depend on FCA-specific behavior not yet verified on OmegA-FCA.
- Leave the variable unset (or set it to `eryxenx`) to retain the default provider.

<blockquote>
<strong>⚠️ Experimental:</strong> Source-level compatibility is not the same as live Facebook validation. Do not enable this provider in production until package publication, regression tests, MQTT readiness/recovery checks and an authorized Railway/VPS login test have passed.
</blockquote>

### 🧠 Command Anti-Spam (Humanizer)

The current `@eryxenx/fca` humanizer can delay command replies, show typing during the delay and enforce per-thread cooldowns. Plain chat messages are not delayed by the command humanizer.

Example settings:

```json
"humanizer": {
  "enable": true,
  "delayMs": 3000,
  "cooldownMs": 5500,
  "maxPerMinute": 20
}
```

- `enable`: turn the delay behavior on or off.
- `delayMs`: delay before a command reply; can also be a range such as `[2000, 4000]`.
- `cooldownMs`: minimum gap between accepted commands in one thread.
- `maxPerMinute`: global accepted-command cap.

Where supported, settings can be changed from `{prefix}setting` → **Bot Behavior** → **Typing Indicator**. See the FCA package documentation for additional options.

## 🎬 Setup Tutorial

<div align="center">

<a href="https://youtu.be/gPf_BFhQz_w?si=-iknmkmFd_NcRahY">
  <img src="https://img.youtube.com/vi/gPf_BFhQz_w/maxresdefault.jpg" alt="OmegA GoatBot setup tutorial" width="85%" />
</a>

<br/>

<a href="https://youtu.be/gPf_BFhQz_w?si=-iknmkmFd_NcRahY">
  <img src="https://img.shields.io/badge/▶_WATCH_TUTORIAL-FF0033?style=for-the-badge&logo=youtube&logoColor=white" />
</a>

</div>

## 🛡️ Security

- Keep `account.txt`, Facebook cookies, API keys, database URIs and passwords private.
- Never commit credentials or session cookies to a public repository.
- Use a private repository and a secure deployment workflow for account data.
- Only grant bot-admin access to trusted Facebook UIDs.
- Use your own account and comply with applicable platform rules.

## 🔗 Project Links

<div align="center">

<a href="https://github.com/nirzon-islam/OmegA-Goatbot"><img src="https://img.shields.io/badge/SOURCE- OmegA--Goatbot-181717?style=for-the-badge&logo=github&logoColor=white" /></a>
<a href="https://github.com/nirzon-islam/Agent-Backend"><img src="https://img.shields.io/badge/AGENT-Agent_Backend-7B2CFF?style=for-the-badge&logo=github&logoColor=white" /></a>
<a href="https://railway.com/"><img src="https://img.shields.io/badge/HOST-Railway-7B2CFF?style=for-the-badge&logo=railway&logoColor=white" /></a>
<a href="https://nodejs.org/"><img src="https://img.shields.io/badge/RUNTIME-Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" /></a>

</div>

## 💬 Support

<div align="center">

<a href="https://m.me/j/AbayU2oh5OPVLvZm/?send_source=gc%3Acopy_invite_link_c"><img src="https://img.shields.io/badge/MESSENGER-SUPPORT_GROUP-0084FF?style=for-the-badge&logo=messenger&logoColor=white" /></a>
<a href="https://facebook.com/EryXenX"><img src="https://img.shields.io/badge/FACEBOOK-PAGE-1877F2?style=for-the-badge&logo=facebook&logoColor=white" /></a>
<a href="https://github.com/EryXenX"><img src="https://img.shields.io/badge/GITHUB-ERYXENX-181717?style=for-the-badge&logo=github&logoColor=white" /></a>
<a href="https://youtube.com/@EryXenX"><img src="https://img.shields.io/badge/YOUTUBE-CHANNEL-FF0000?style=for-the-badge&logo=youtube&logoColor=white" /></a>
<a href="https://t.me/EryXenX_Official"><img src="https://img.shields.io/badge/TELEGRAM-CHANNEL-0088CC?style=for-the-badge&logo=telegram&logoColor=white" /></a>
<a href="https://instagram.com/EryXenX"><img src="https://img.shields.io/badge/INSTAGRAM-PROFILE-E4405F?style=for-the-badge&logo=instagram&logoColor=white" /></a>

</div>

---

<div align="center">

### 💠 BUILT WITH OPEN-SOURCE SPIRIT

**Original Work © NTKhang (ntkhang03)**  
**Original Fork © EryXenX (Mohammad Akash)**  
**OmegA customization & maintenance · Md SalmaN (NirZon)**

<sub>Respect open source · Preserve credits · Build responsibly</sub>

</div>
