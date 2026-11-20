<div align="center">

<img src="https://readme-typing-svg.herokuapp.com?font=Orbitron&weight=800&size=34&pause=900&color=00E5FF&center=true&vCenter=true&width=760&lines=Welcome+to+OmegA+Bot;Powered+by+NirZon;Messenger+Automation+Reimagined" alt="OmegA Bot animated title" />

<img src="https://capsule-render.vercel.app/api?type=venom&height=180&color=0:071A2B,45:075985,100:00D4FF&text=OMEGA%20BOT&fontColor=FFFFFF&fontSize=54&fontAlignY=52&animation=fadeIn&stroke=00E5FF&strokeWidth=1" width="100%" alt="OmegA Bot banner" />

### Facebook Messenger Bot Framework

**A customized Goat Bot V2 project — developed and maintained by NirZon.**

![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-2563EB?style=for-the-badge)
![Maintainer](https://img.shields.io/badge/Maintained%20by-NirZon-7C3AED?style=for-the-badge)
![Project](https://img.shields.io/badge/Project-OmegA%20Bot-0891B2?style=for-the-badge)

*Fast • Flexible • Customizable • Community-driven*

</div>

---

## ✦ About OmegA Bot

**OmegA Bot** is a customized Facebook Messenger bot framework built on the open-source [Goat Bot V2](https://github.com/ntkhang03/Goat-Bot-V2), originally created by **NTKhang**.

The project is developed and maintained by **NirZon**. It brings together modular commands, event listeners, configurable bot behavior, and optional backend integrations in one extensible framework.

## ⚡ Features

| Feature | Description |
|---|---|
| ⚙️ Modular commands | Supports command handlers such as onStart, onReply, onReaction, onChat, and onEvent |
| 🛡️ Admin controls | Configure bot administrators and command permissions |
| 🌐 Multi-language | Language support for several locales, including English and Bengali |
| 🎛️ Chat settings | Manage supported bot settings through chat commands |
| 💬 Event handling | Respond to group events and Messenger activity |
| 🤖 Optional Agent | Connect a separately deployed agent service when the matching integration is configured |

> **Facebook connection status:** This branch is wired to the public npm package `@nirzon-islam/omega-fca`. Its AppState login and GoatBot callback adapter are implemented, but the native Facebook MQTT protocol is experimental and has not yet been verified against a live authorized account. Treat first deployment as a controlled test, not a production-ready release.

---

## 🚀 Quick Start

### Requirements

- Node.js 20.x
- npm 7 or newer
- A Facebook session supported by the connection layer configured in your checkout
- Railway or a VPS for a persistent bot process
- MongoDB and the separate Agent Backend only if you use optional agent features

### Install

```bash
git clone https://github.com/nirzon-islam/OmegA-Goatbot.git
cd OmegA-Goatbot
npm install
```

Configure the bot using the configuration files and session method supported by your selected branch. Keep all credentials and session data private.

### Run

```bash
npm start
```

Development mode:

```bash
npm run dev
```

---

## 🔧 Configuration & Security

- Set your bot administrator UID and command prefix in the project's configuration.
- Keep Facebook session data, access tokens, API keys, database URLs, and passwords private.
- Never commit `account.txt`, session files, or production environment files.
- Use a private repository or deployment secret manager for sensitive configuration.
- If a Facebook login challenge or checkpoint appears, resolve it through the account owner's official login flow. Never attempt to bypass security checks.

## ☁️ Deployment

### Railway

1. Create a Railway project and connect this repository.
2. Select the branch you want to test.
3. Set the start command to `npm start`.
4. Add only environment variables required by the current code and enabled integrations.
5. Deploy, then inspect the service logs for startup and connection errors.

Railway normally supplies the `PORT` variable for web services. A bot process does not need extra custom variables unless the application or an enabled integration explicitly requires them.

### VPS

Install Node.js 20.x, clone the repository, run `npm install`, configure the bot, and start it with `npm start`. A process manager such as PM2 can keep the process alive.

**Hosting note:** OmegA Bot relies on a persistent Messenger connection and may write session/runtime data. Use a host that supports long-running processes and persistent storage. Verify filesystem and networking behavior before deploying.

---

<div align="center">

<img src="https://readme-typing-svg.herokuapp.com?font=Orbitron&weight=700&size=25&pause=1000&color=A78BFA&center=true&vCenter=true&width=650&lines=OMEGA+AGENT+SYSTEM;Your+Bot.+Your+Control.;AI-Powered+Management+Layer" alt="OmegA Agent animated heading" />

<img src="https://capsule-render.vercel.app/api?type=rect&height=4&color=0:00E5FF,50:8B5CF6,100:00E5FF" width="85%" alt="Agent section divider" />

### 🧠 OmegA Agent Backend
**A separate control center for AI-assisted bot management**

[![Agent Backend](https://img.shields.io/badge/Agent%20Backend-Visit%20Repository-8B5CF6?style=for-the-badge&logo=github&logoColor=white)](https://github.com/nirzon-islam/Agent-Backend)
[![Runtime](https://img.shields.io/badge/Runtime-Node.js%2020-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)

</div>

OmegA Agent Backend is the separately hosted management and AI layer for OmegA Bot. It provides an owner-authenticated dashboard, AI provider configuration, task planning, approval-controlled operations, activity history, and supported recovery workflows.

**The backend is required for the optional AI Agent and remote management features.** The core Messenger bot can run independently, but Agent features will not work without the backend, database, provider configuration, and a compatible bot-side bridge.

#### What the Agent system provides

| Module | Purpose |
|---|---|
| Owner Dashboard | Protected owner access to agent settings and workflows |
| AI Providers | Main, Fallback and Backup provider slots |
| AI Task Assistant | Code analysis, task planning and supported project actions |
| Approval Center | Review and approve controlled actions before execution |
| Activity History | Track tasks and agent activity |
| Backup & Rollback | Recovery support for supported file changes |
| Account Recovery | Protected Facebook session reconnection workflow with account-ID validation and verification |
| Bot Bridge | Signed communication between the backend and a compatible OmegA Bot runtime |

#### System architecture

```text
Owner / Messenger
       │
       ▼
OmegA Agent Backend (Render)
       │
       ├── MongoDB
       ├── AI Providers
       └── Owner Dashboard
                │
         Signed Bridge
          (opt-in setup)
                │
                ▼
       OmegA Bot Runtime (Railway)
```

#### Deployment overview

1. Open the [OmegA Agent Backend repository](https://github.com/nirzon-islam/Agent-Backend).
2. Follow its [deployment guide](https://github.com/nirzon-islam/Agent-Backend/blob/main/DEPLOYMENT.md) and `.env.example`.
3. Deploy it as a Render **Web Service** with `npm install` (or `npm ci` when a lockfile is present) and `npm start`.
4. Configure MongoDB, owner login credentials and the AI settings encryption key in the host environment settings.
5. Verify `/api/health`, sign in to the owner dashboard and configure Main, Fallback and Backup AI providers.
6. Connect the backend to the exact OmegA Bot revision only after matching bridge configuration and completing end-to-end tests.

#### Important setup & security notes

- MongoDB must support replica-set transactions; MongoDB Atlas is recommended by the backend project.
- Keep the bridge disabled until both deployed revisions have passed integration tests. The backend defaults to `BRIDGE_ENABLED=false`.
- When enabling the bridge, use a strong random secret of at least 32 characters and configure the matching secret on both sides using the variable names supported by the checked-out revision.
- Keep Facebook cookies/AppState, API keys, database URLs, owner passwords and encryption keys out of Git, chat messages and logs.
- Facebook checkpoints and security challenges must be resolved by the account owner through the official flow. The Agent does not bypass them.
- A healthy backend endpoint confirms service/database health; it does not by itself prove Messenger, AI provider or bridge integration is working.

> **Compatibility notice:** The Agent Backend and OmegA Bot are separate deployments. Deploying one does not automatically connect the other. Confirm that their bridge protocol and configuration match before enabling remote actions. Account reconnection and other live Facebook workflows must be tested with an authorized account in a controlled environment.

<div align="center">

*Independent service • Owner-controlled actions • Approval-first automation*

</div>

---

## 🔷 OmegA-FCA · Facebook connection

OmegA-Goatbot consumes OmegA-FCA as a normal npm dependency. The GitHub source repository is private; the published GitHub Packages package is public, so a normal install does not require a GitHub token.

```text
GoatBot startup
  └─ bot/login/login.js
      └─ bot/login/omegaFca.js
          └─ @nirzon-islam/omega-fca
              ├─ AppState validation/session bootstrap
              ├─ experimental Messenger MQTT transport
              ├─ FCA-style listenMqtt callback facade
              └─ supported thread/message methods
```

### Current login method: AppState only

Email/password and username/password login are deliberately deferred. Do not add Facebook passwords or 2FA secrets to `config.json`.

1. Export an AppState/cookie array for an account you own or are authorized to operate.
2. Put the JSON cookie array in the project-root `account.txt`.
3. Keep the file private. It is already excluded by `.gitignore`.
4. Ensure the cookie array belongs to the account you intend the bot to use and includes the required session cookies (including `c_user` and `xs`).

Example shape only (use real values locally; never commit them):

```json
[
  { "key": "c_user", "value": "ACCOUNT_ID", "domain": "facebook.com" },
  { "key": "xs", "value": "SESSION_VALUE", "domain": "facebook.com" }
]
```

The bot reads `account.txt` as JSON. Raw cookie headers and Netscape exports are not accepted by the current GoatBot startup path. A missing, malformed, expired or checkpointed AppState will prevent Facebook login. Resolve checkpoints through Facebook as the account owner; the bot does not bypass them.

### Install and run

Requirements: Node.js 20.x and npm 7+.

```bash
npm install
npm start
```

For Railway:
- Connect the `fca-migration-cleanup` branch for this test.
- Build/install command: `npm install` (or let Railway use the repository's normal Node install).
- Start command: `npm start`.
- No `NODE_AUTH_TOKEN` is required while the published GitHub Packages package remains public.
- Supply `account.txt` through a secure deployment mechanism or a persistent private volume. Do not put AppState in Git, README, logs, or public environment output.
- Use a persistent Node.js service. Verify the runtime has outbound WebSocket access and persistent storage if session files are expected.

### Compatibility and test status

Implemented in the current integration:
- GoatBot imports the published package through `bot/login/omegaFca.js`.
- The adapter accepts the AppState supplied by `login.js` and returns the callback-style login result expected by GoatBot.
- The client facade exposes `listenMqtt`, `stopListening`, `getCurrentUserID`, and supported API methods.
- GoatBot consumes the package's explicit `ready` event before marking the Facebook session online.
- The runtime recovery path validates the replacement AppState account ID and waits for the candidate listener before swapping sessions.

Important limitations:
- Native Facebook MQTT broker acceptance and message delivery have **not** been confirmed with a live authorized Facebook account.
- Event decoding and message-send wire compatibility remain experimental; Facebook may change undocumented endpoints and protocol fields.
- The package does not yet provide complete FCA method parity or E2EE.
- The existing humanizer configuration is not currently applied by the native package adapter.
- A successful npm install or synthetic test does not prove Facebook authentication, MQTT receive/send, reconnect, or all bot commands work.

### First-run verification

After starting the bot, inspect logs in this order:

1. Package loads without `MODULE_NOT_FOUND`.
2. AppState JSON is read and validated (never print cookie values).
3. Facebook session bootstrap succeeds.
4. Messenger WebSocket/MQTT protocol setup completes.
5. GoatBot receives the `ready` event and reports the account online.
6. Send a test message only to a conversation you control; verify the bot receives and replies.

If step 3 or 4 fails, keep the service logs (with cookies and tokens redacted) and stop repeated login attempts. Do not interpret the process merely staying alive as a successful Facebook connection.

---
 
## 🧩 Create Your First Command

Create a file under `scripts/cmds/`, for example `scripts/cmds/hello.js`:

```js
module.exports = {
  config: {
    name: "hello",
    version: "1.0.0",
    author: "NirZon",
    countDown: 5,
    role: 0,
    shortDescription: "Say hello",
    longDescription: "Replies with a greeting",
    category: "utility",
    guide: "{prefix}hello"
  },

  onStart: async function ({ message }) {
    message.reply("Hello from OmegA Bot!");
  }
};
```

### Permission roles

| Role | Permission |
|---|---|
| `0` | Everyone |
| `1` | Group administrators |
| `2` | Bot administrators |

The exact available APIs and event fields depend on the connection provider and compatibility layer installed in your checkout. Check the source and tests before relying on a method.

---

## 🔗 Project & Contact

- **OmegA Bot:** https://github.com/nirzon-islam/OmegA-Goatbot
- **Email:** [salmanxhowdhury@gmail.com](mailto:salmanxhowdhury@gmail.com)
- **Facebook:** https://www.facebook.com/61561645647195
- **Telegram:** https://t.me/dark_shades1
- **Original Goat Bot V2:** https://github.com/ntkhang03/Goat-Bot-V2
- **Node.js:** https://nodejs.org/
- **Railway:** https://railway.com/

## 📜 Credits & License

OmegA Bot is based on **Goat Bot V2**, originally created by **NTKhang**. The upstream project's original license and attribution are respected. OmegA Bot's custom development and maintenance are by **NirZon**.

See the repository's `LICENSE` file for the applicable license terms.

---

<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&height=120&section=footer&color=0:00D4FF,50:075985,100:071A2B&animation=twinkling" width="100%" alt="Animated footer" />

**OmegA Bot · Developed with care by NirZon**

*Open source roots. Independent vision. OmegA identity.*

</div>
