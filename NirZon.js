/**
 * OmegA Bot - Core Runtime
 * Maintainer: NirZon
 *
 * Based on Goat Bot V2 by NTKhang.
 * Original upstream: https://github.com/ntkhang03/Goat-Bot-V2
 *
 * This file initializes the bot runtime, configuration, shared globals,
 * Agent Bridge bootstrap, restart handling, and Facebook login startup.
 */

// Route crashes through the structured logger so they render with the same
// `[ ERROR ]` badge as everything else instead of a bare console dump.
process.on('unhandledRejection', error => {
        const log = global.utils?.log;
        if (log) log.err("UNHANDLED", "Unhandled promise rejection", error);
        else console.error(error);
});
process.on('uncaughtException', error => {
        const log = global.utils?.log;
        if (log) log.err("UNCAUGHT", "Uncaught exception", error);
        else console.error(error);
});

const axios = require("axios");
const fs = require("fs-extra");
const nodemailer = require("nodemailer");
const { execSync } = require('child_process');
const log = require('./logger/log.js');
const path = require("path");

// Temporary diagnostic: print the actual Railway working directory.
console.log("[AGENT] Workspace root:", process.cwd());
console.log("[AGENT] Project root:", __dirname);

process.env.BLUEBIRD_W_FORGOTTEN_RETURN = 0; // Disable warning: "Warning: a promise was created in a handler but was not returned from it"

function validJSON(pathDir) {
	try {
		if (!fs.existsSync(pathDir))
			throw new Error(`File "${pathDir}" not found`);
		execSync(`npx jsonlint "${pathDir}"`, { stdio: 'pipe' });
		return true;
	}
	catch (err) {
		let msgError = err.message;
		msgError = msgError.split("\n").slice(1).join("\n");
		const indexPos = msgError.indexOf("    at");
		msgError = msgError.slice(0, indexPos != -1 ? indexPos - 1 : msgError.length);
		throw new Error(msgError);
	}
}

const { NODE_ENV } = process.env;
const dirConfig = path.normalize(`${__dirname}/config${['production', 'development'].includes(NODE_ENV) ? '.dev.json' : '.json'}`);
const dirConfigCommands = path.normalize(`${__dirname}/configCommands${['production', 'development'].includes(NODE_ENV) ? '.dev.json' : '.json'}`);
const dirAccount = path.normalize(`${__dirname}/account${['production', 'development'].includes(NODE_ENV) ? '.dev.txt' : '.txt'}`);

for (const pathDir of [dirConfig, dirConfigCommands]) {
	try {
		validJSON(pathDir);
	}
	catch (err) {
		log.error("CONFIG", `Invalid JSON file "${pathDir.replace(__dirname, "")}":\n${err.message.split("\n").map(line => `  ${line}`).join("\n")}\nPlease fix it and restart bot`);
		process.exit(0);
	}
}
const config = require(dirConfig);
if (config.whiteListMode?.whiteListIds && Array.isArray(config.whiteListMode.whiteListIds))
	config.whiteListMode.whiteListIds = config.whiteListMode.whiteListIds.map(id => id.toString());
const configCommands = require(dirConfigCommands);

global.GoatBot = {
	startTime: Date.now() - process.uptime() * 1000, // time start bot (ms)
	commands: new Map(), // store all commands
	eventCommands: new Map(), // store all event commands
	commandFilesPath: [], // [{ filePath: "", commandName: [] }
	eventCommandsFilesPath: [], // [{ filePath: "", commandName: [] }
	aliases: new Map(), // store all aliases
	onFirstChat: [], // store all onFirstChat [{ commandName: "", threadIDsChattedFirstTime: [] }}]
	onChat: [], // store all onChat
	onEvent: [], // store all onEvent
	onReply: new Map(), // store all onReply
	onReaction: new Map(), // store all onReaction
	onAnyEvent: [], // store all onAnyEvent
	config, // store config
	configCommands, // store config commands
	envCommands: {}, // store env commands
	envEvents: {}, // store env events
	envGlobal: {}, // store env global
	reLoginBot: function () { }, // function relogin bot, will be set in bot/login/login.js
	Listening: null, // store current listening handle
	oldListening: [], // store old listening handle
	callbackListenTime: {}, // store callback listen 
	storage5Message: [], // store 5 message to check listening loop
	fcaApi: null, // store fca api
	botID: null // store bot id
};

global.db = {
	// all data
	allThreadData: [],
	allUserData: [],
	allDashBoardData: [],
	allGlobalData: [],

	// model
	threadModel: null,
	userModel: null,
	dashboardModel: null,
	globalModel: null,

	// handle data
	threadsData: null,
	usersData: null,
	dashBoardData: null,
	globalData: null,

	receivedTheFirstMessage: {}

	// all will be set in bot/login/loadData.js
};

global.client = {
	dirConfig,
	dirConfigCommands,
	dirAccount,
	countDown: {},
	cache: {},
	database: {
		creatingThreadData: [],
		creatingUserData: [],
		creatingDashBoardData: [],
		creatingGlobalData: []
	},
	commandBanned: configCommands.commandBanned
};

const utils = require("./utils.js");
global.utils = utils;
const { colors } = utils;

global.temp = {
	createThreadData: [],
	createUserData: [],
	createThreadDataError: [], // Can't get info of groups with instagram members
	filesOfGoogleDrive: {
		arraybuffer: {},
		stream: {},
		fileNames: {}
	},
	contentScripts: {
		cmds: {},
		events: {}
	}
};

// watch dirConfigCommands file and dirConfig
const watchAndReloadConfig = (dir, type, prop, logName) => {
	let lastModified = fs.statSync(dir).mtimeMs;
	let isFirstModified = true;

	fs.watch(dir, (eventType) => {
		if (eventType === type) {
			const oldConfig = global.GoatBot[prop];

			// wait 200ms to reload config
			setTimeout(() => {
				try {
					// if file change first time (when start bot, maybe you know it's called when start bot?) => not reload
					if (isFirstModified) {
						isFirstModified = false;
						return;
					}
					// if file not change => not reload
					if (lastModified === fs.statSync(dir).mtimeMs) {
						return;
					}
					global.GoatBot[prop] = JSON.parse(fs.readFileSync(dir, 'utf-8'));
					log.success(logName, `Reloaded ${dir.replace(process.cwd(), "")}`);
				}
				catch (err) {
					log.warn(logName, `Can't reload ${dir.replace(process.cwd(), "")}`);
					global.GoatBot[prop] = oldConfig;
				}
				finally {
					lastModified = fs.statSync(dir).mtimeMs;
				}
			}, 200);
		}
	});
};

watchAndReloadConfig(dirConfigCommands, 'change', 'configCommands', 'CONFIG COMMANDS');
watchAndReloadConfig(dirConfig, 'change', 'config', 'CONFIG');

global.GoatBot.envGlobal = global.GoatBot.configCommands.envGlobal;
global.GoatBot.envCommands = global.GoatBot.configCommands.envCommands;
global.GoatBot.envEvents = global.GoatBot.configCommands.envEvents;

// Secure Agent Bridge worker is opt-in and remains disabled unless both flags are true.
try {
  const { startBridgeWorker } = require("./agent-bridge/runtime");
  global.GoatBot.agentBridgeWorker = startBridgeWorker({
    log,
    getAccountStatus: () => {
      const raw = String(global.statusAccountBot || "unknown").toLowerCase();
      const accountId = String(global.GoatBot?.botID || global.botID || "");
      const listenerReady = Boolean(
        global.GoatBot?.fcaApi &&
        global.GoatBot?.Listening &&
        /^\d{5,30}$/.test(accountId)
      );
      // "good" is set by the successful MQTT callback; require the live API,
      // listener handle and a valid account ID before reporting online.
      const sessionState = raw === "good" && listenerReady ? "online" :
        raw === "checkpoint" ? "checkpoint" :
        raw === "can't login" || raw === "logged_out" ? "logged_out" :
        raw === "error" ? "error" : "unknown";
      const messages = {
        online: "Facebook session is authenticated and the listener is active.",
        logged_out: "Facebook session is no longer authenticated.",
        checkpoint: "Facebook checkpoint requires manual completion.",
        error: "Facebook listener reported an authentication or connection error.",
        unknown: "Facebook authentication has not yet been confirmed."
      };
      return {
        workerState: "online",
        sessionState,
        accountId: String(global.GoatBot.botID || global.botID || ""),
        message: messages[sessionState]
      };
    }
  });
} catch (error) {
  log.warn("AGENT BRIDGE", "Worker not started: " + String(error.message || "configuration error"));
}

// Allow Agent Bridge to accept the first Facebook account before normal login
// has created the full in-process recovery handler. login.js replaces this
// bootstrap with its live-session switcher once GoatBot is initialized.
try {
  const { bootstrapFacebookLogin } = require("./agent-bridge/bootstrapRecovery");
  global.GoatBot.recoverFacebookSession = bootstrapFacebookLogin;
} catch (error) {
  log.warn("AGENT BRIDGE", "Initial Facebook login handler unavailable: " + String(error.message || "configuration error"));
}

// ———————————————— LOAD LANGUAGE ———————————————— //
const getText = global.utils.getText;

// ———————————————— AUTO RESTART ———————————————— //
if (config.autoRestart) {
	const time = config.autoRestart.time;
	if (!isNaN(time) && time > 0) {
		utils.log.info("AUTO RESTART", getText("Goat", "autoRestart1", utils.convertTime(time, true)));
		setTimeout(() => {
			utils.log.info("AUTO RESTART", "Restarting...");
			process.exit(2);
		}, time);
	}
	else if (typeof time == "string" && time.match(/^((((\d+,)+\d+|(\d+(\/|-|#)\d+)|\d+L?|\*(\/\d+)?|L(-\d+)?|\?|[A-Z]{3}(-[A-Z]{3})?) ?){5,7})$/gmi)) {
		utils.log.info("AUTO RESTART", getText("Goat", "autoRestart2", time));
		const cron = require("node-cron");
		cron.schedule(time, () => {
			utils.log.info("AUTO RESTART", "Restarting...");
			process.exit(2);
		});
	}
}

(async () => {
	// ———————————————————— LOGIN ———————————————————— //
	require(`./bot/login/login${NODE_ENV === 'development' ? '.dev.js' : '.js'}`);
})();
