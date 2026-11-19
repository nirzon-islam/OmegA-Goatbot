<div align="center">

# OmegA Bot
### Facebook Messenger Bot Framework

**A customized Goat Bot V2 project maintained by NirZon.**

![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)
![Project](https://img.shields.io/badge/Project-OmegA%20Bot-0E7C86?style=for-the-badge)

*Fast • Flexible • Community-driven*

</div>

---

## About OmegA Bot

**OmegA Bot** is a customized Facebook Messenger bot framework built on the open-source [Goat Bot V2](https://github.com/ntkhang03/Goat-Bot-V2) project, originally created by **NTKhang**.

This repository is maintained and developed by **NirZon**. It brings together command handling, event listeners, configurable bot behavior, and optional backend integrations in one extensible project.

### Highlights

| Feature | Description |
|---|---|
| Command system | Modular commands with onStart, onReply, onReaction, onChat, and onEvent handlers |
| Admin controls | Configure bot administrators and command permissions |
| Multi-language | Language support for several locales, including English and Bengali |
| Custom settings | Manage supported bot settings through chat commands |
| Event handling | Respond to group events and Messenger activity |
| Optional Agent backend | Connect an independently deployed agent service when the matching integration is configured |

> **Development note:** The FCA integration is being migrated and verified in the fca-migration-cleanup branch. Do not assume that every legacy FCA method has already been replaced or that this branch is a production-ready drop-in migration. Check the current package manifest and migration tests before deployment.

---

## Requirements

- Node.js 20.x
- npm 7 or newer
- A Facebook session supported by the FCA implementation currently configured in this branch
- Railway or a VPS for a persistent bot process
- MongoDB and the separate Agent Backend only if you use the optional agent features

## Quick start

Clone the repository and install dependencies:

```bash
git clone https://github.com/nirzon-islam/OmegA-Goatbot.git
cd OmegA-Goatbot
npm install
```

Configure the bot using the configuration files and session method supported by the current branch. Keep credentials and session data out of Git.

Start the bot:

```bash
npm start
```

For local development:

```bash
npm run dev
```

## Configuration and security

- Set your bot administrator UID and command prefix in the project's configuration.
- Keep Facebook session data, access tokens, API keys, database URLs, and passwords private.
- Never commit account.txt, session files, or production environment files.
- Use a private repository or deployment secret manager for sensitive configuration.
- If a Facebook login challenge or checkpoint appears, resolve it through the account owner's official login flow. Do not attempt to bypass security checks.

## Deployment

### Railway

1. Create a Railway project and connect this repository.
2. Select the branch you intend to test.
3. Use npm start as the start command.
4. Configure only the environment variables required by the current code and enabled integrations.
5. Deploy and inspect the service logs for startup and connection errors.

Railway normally supplies the PORT variable for web services. A bot process does not need an extra custom variable unless the current application or an enabled integration explicitly requires it.

### VPS

Install Node.js 20.x, clone the repository, run npm install, configure the bot, and start it with npm start. A process manager such as PM2 can keep the process alive.

**Hosting note:** This bot relies on a persistent Messenger connection and may write session/runtime data. Choose a host that supports long-running processes and persistent storage. Verify the host's filesystem and networking behavior before deploying.

## Optional Agent Backend

Agent features require a separately deployed backend and a compatible bot-side integration. Deploying the backend alone does not connect it to OmegA Bot.

Backend setup, database configuration, provider credentials, and bridge settings must follow the instructions in the [Agent Backend repository](https://github.com/nirzon-islam/Agent-Backend).

## Creating a command

Create a file under scripts/cmds/, for example scripts/cmds/hello.js:

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
| 0 | Everyone |
| 1 | Group administrators |
| 2 | Bot administrators |

The exact available APIs and event fields depend on the FCA provider and compatibility layer currently installed. Refer to the source and tests before relying on a method.

## Project links

- **Bot repository:** https://github.com/nirzon-islam/OmegA-Goatbot
- **FCA library:** https://github.com/nirzon-islam/OmegA-FCA
- **Agent Backend:** https://github.com/nirzon-islam/Agent-Backend
- **Node.js:** https://nodejs.org/
- **Railway:** https://railway.com/

## Credits and license

OmegA Bot is based on **Goat Bot V2**, originally created by **NTKhang**. The upstream project's original license and attribution must be respected. OmegA Bot's custom development and maintenance are by **NirZon**.

This project is distributed under the MIT license where applicable; see the repository's LICENSE file for the exact terms.

---

<div align="center">

**OmegA Bot · Developed and maintained by NirZon**

*Built with respect for the open-source projects that made it possible.*

</div>
