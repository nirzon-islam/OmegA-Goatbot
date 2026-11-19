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

> **Development status:** The Facebook connection layer is undergoing private FCA integration work. Its implementation and compatibility are not exposed as a public package link. Some legacy FCA methods may still be under migration, so verify the current branch and tests before production use.

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

## 🤖 Optional Agent Backend

Agent features require a separately deployed backend and a compatible bot-side integration. Deploying the backend alone does not connect it to OmegA Bot.

Backend setup, database configuration, provider credentials, and bridge settings are maintained separately and are not linked from this public project page.

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
