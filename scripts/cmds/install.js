const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const cheerio = require("cheerio");
const { execFile } = require("child_process");
const Module = require("module");

const { GoatBot } = global;

const VERSION = "1.0.0";
const AUTHOR = "NirZon";

function isURL(value) {
	try {
		new URL(value);
		return true;
	}
	catch {
		return false;
	}
}

function getDomain(url) {
	try {
		return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
	}
	catch {
		return null;
	}
}

function extractUrlFromText(text) {
	const match = String(text || "").match(/https?:\/\/[^\s<>"']+/i);
	return match ? match[0].replace(/[),.!?]+$/, "") : null;
}

function normalizeFileName(fileName) {
	let name = path.basename(String(fileName || "").trim());
	if (!name.toLowerCase().endsWith(".js"))
		name += ".js";
	return name;
}

function extractCommandName(code) {
	if (typeof code !== "string")
		return null;

	const match = code.match(/\bname\s*:\s*["'`]([^"'`]+)["'`]/i);
	if (!match || !/^[a-zA-Z0-9_-]+$/.test(match[1].trim()))
		return null;

	return `${match[1].trim()}.js`;
}

function cleanCodeResponse(code, contentType = "") {
	if (typeof code !== "string")
		return null;

	let result = code.trim();

	if (contentType.includes("text/html") &&
		!result.includes("module.exports") &&
		!result.includes("exports.")) {
		const $ = cheerio.load(result);
		result = $("pre").first().text().trim() || $("#content").text().trim();
	}

	result = result
		.replace(/^```(?:javascript|js|node)?\s*/i, "")
		.replace(/\s*```$/i, "")
		.trim();

	return result || null;
}

async function fetchCodeFromUrl(url) {
	const domain = getDomain(url);
	if (!domain)
		return null;

	let fixedUrl = url;

	if (domain === "pastebin.com" && !url.includes("/raw/")) {
		const id = new URL(url).pathname.split("/").filter(Boolean)[0];
		if (id)
			fixedUrl = `https://pastebin.com/raw/${id}`;
	}

	if (domain === "github.com" && url.includes("/blob/")) {
		fixedUrl = url
			.replace("https://github.com/", "https://raw.githubusercontent.com/")
			.replace("/blob/", "/");
	}

	if (domain === "gist.github.com" && !url.includes("/raw")) {
		fixedUrl = `${url.replace(/\/$/, "")}/raw`;
	}

	try {
		const response = await axios.get(fixedUrl, {
			timeout: 30000,
			maxContentLength: 5 * 1024 * 1024,
			maxBodyLength: 5 * 1024 * 1024,
			responseType: "text",
			validateStatus: status => status >= 200 && status < 400
		});

		const body = typeof response.data === "string"
			? response.data
			: String(response.data);

		return cleanCodeResponse(body, response.headers?.["content-type"] || "");
	}
	catch {
		return null;
	}
}

function runCommand(file, args, options = {}) {
	return new Promise((resolve, reject) => {
		execFile(file, args, {
			...options,
			windowsHide: true,
			maxBuffer: 10 * 1024 * 1024
		}, (error, stdout, stderr) => {
			if (error) {
				error.stdout = stdout;
				error.stderr = stderr;
				return reject(error);
			}
			resolve({ stdout, stderr });
		});
	});
}

function getRequiredPackages(code) {
	const packages = new Set();
	const patterns = [
		/require\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g,
		/import\s+(?:[^"'`]+?\s+from\s+)?["'`]([^"'`]+)["'`]/g
	];

	for (const regex of patterns) {
		let match;
		while ((match = regex.exec(code)) !== null) {
			let name = match[1];
			if (!name || name.startsWith(".") || name.startsWith("/") ||
				name.startsWith("node:") || path.isAbsolute(name))
				continue;

			if (Module.builtinModules.includes(name))
				continue;

			name = name.startsWith("@")
				? name.split("/").slice(0, 2).join("/")
				: name.split("/")[0];

			// Prevent shell/package-name injection and malformed package names.
			if (/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/i.test(name))
				packages.add(name);
		}
	}

	return [...packages];
}

async function installMissingPackages(code) {
	const packages = getRequiredPackages(code);
	const installed = [];

	for (const packageName of packages) {
		try {
			require.resolve(packageName, { paths: [process.cwd()] });
			continue;
		}
		catch {
			// Package is not installed.
		}

		try {
			await runCommand("npm", ["install", "--save", packageName], {
				cwd: process.cwd()
			});
			installed.push(packageName);
		}
		catch (error) {
			throw new Error(
				`Could not install "${packageName}". ` +
				`${String(error.stderr || error.message).trim()}`
			);
		}
	}

	return installed;
}

function detectModuleType(command) {
	const category = String(command?.config?.category || "").toLowerCase();
	return category === "events" ? "event" : "command";
}

function validateModuleExport(command) {
	if (!command || typeof command !== "object")
		throw new Error("File must export a command/event object.");

	if (!command.config || typeof command.config !== "object")
		throw new Error("config is missing.");

	if (typeof command.config.name !== "string" ||
		!command.config.name.trim() ||
		!/^[a-zA-Z0-9_-]+$/.test(command.config.name.trim()))
		throw new Error("config.name is missing or invalid.");

	if (typeof command.config.category !== "string" ||
		!command.config.category.trim())
		throw new Error("config.category is missing.");

	if (typeof command.onStart !== "function")
		throw new Error("onStart() is required.");

	const type = detectModuleType(command);

	if (type === "command") {
		const role = Number(command.config.role ?? 0);
		if (!Number.isInteger(role) || role < 0 || role > 2)
			throw new Error("Invalid command role. Use 0, 1 or 2.");
		command.config.role = role;
	}

	return type;
}

function ensureDirectories() {
	const root = process.cwd();
	const commandDir = path.join(root, "scripts", "cmds");
	const eventDir = path.join(root, "scripts", "events");
	fs.ensureDirSync(commandDir);
	fs.ensureDirSync(eventDir);
	return { commandDir, eventDir };
}

function clearRequireCache(filePath) {
	try {
		delete require.cache[require.resolve(filePath)];
	}
	catch {
		// Not cached.
	}
}

function removeCommandRegistrations(commandName, oldCommand) {
	const lowerName = String(commandName).toLowerCase();

	GoatBot.commands?.delete(lowerName);

	if (GoatBot.aliases) {
		for (const [alias, target] of GoatBot.aliases.entries()) {
			if (String(target).toLowerCase() === lowerName ||
				(oldCommand?.config?.aliases || []).some(item =>
					String(item).toLowerCase() === String(alias).toLowerCase()))
				GoatBot.aliases.delete(alias);
		}
	}

	for (const listName of ["onChat", "onEvent", "onAnyEvent"]) {
		if (Array.isArray(GoatBot[listName])) {
			GoatBot[listName] = GoatBot[listName].filter(
				name => String(name).toLowerCase() !== lowerName
			);
		}
	}

	if (Array.isArray(GoatBot.onFirstChat)) {
		GoatBot.onFirstChat = GoatBot.onFirstChat.filter(
			item => String(item?.commandName).toLowerCase() !== lowerName
		);
	}

	if (Array.isArray(GoatBot.commandFilesPath)) {
		GoatBot.commandFilesPath = GoatBot.commandFilesPath.filter(
			item => !(item?.commandName || []).some(
				name => String(name).toLowerCase() === lowerName
			)
		);
	}
}

function registerCommand(command, filePath) {
	const name = command.config.name.trim();
	const key = name.toLowerCase();

	if (!(GoatBot.commands instanceof Map))
		throw new Error("GoatBot.commands Map is not initialized.");

	if (!(GoatBot.aliases instanceof Map))
		throw new Error("GoatBot.aliases Map is not initialized.");

	command.location = filePath;

	const aliases = Array.isArray(command.config.aliases)
		? command.config.aliases
		: [];
	const validAliases = [];

	for (const alias of aliases) {
		if (typeof alias !== "string" || !alias.trim())
			throw new Error(`Invalid alias in "${name}".`);

		const aliasKey = alias.trim().toLowerCase();
		if (aliasKey === key)
			throw new Error(`Alias "${alias}" duplicates command name.`);

		if (aliases.filter(item =>
			String(item).trim().toLowerCase() === aliasKey).length > 1)
			throw new Error(`Duplicate alias "${alias}".`);

		const owner = GoatBot.aliases.get(aliasKey);
		if (owner && String(owner).toLowerCase() !== key)
			throw new Error(`Alias "${alias}" already belongs to "${owner}".`);

		validAliases.push(aliasKey);
	}

	GoatBot.commands.set(key, command);
	for (const alias of validAliases)
		GoatBot.aliases.set(alias, key);

	if (typeof command.onChat === "function") {
		GoatBot.onChat ||= [];
		if (!GoatBot.onChat.some(item => String(item).toLowerCase() === key))
			GoatBot.onChat.push(key);
	}

	if (typeof command.onFirstChat === "function") {
		GoatBot.onFirstChat ||= [];
		GoatBot.onFirstChat.push({
			commandName: key,
			threadIDsChattedFirstTime: []
		});
	}

	if (typeof command.onEvent === "function") {
		GoatBot.onEvent ||= [];
		if (!GoatBot.onEvent.some(item => String(item).toLowerCase() === key))
			GoatBot.onEvent.push(key);
	}

	if (typeof command.onAnyEvent === "function") {
		GoatBot.onAnyEvent ||= [];
		if (!GoatBot.onAnyEvent.some(item => String(item).toLowerCase() === key))
			GoatBot.onAnyEvent.push(key);
	}

	GoatBot.commandFilesPath ||= [];
	GoatBot.commandFilesPath = GoatBot.commandFilesPath.filter(
		item => !(item?.commandName || []).some(
			itemName => String(itemName).toLowerCase() === key
		)
	);
	GoatBot.commandFilesPath.push({
		filePath: path.normalize(filePath),
		commandName: [name, ...validAliases]
	});

	return command;
}

function registerEvent(command, filePath) {
	if (!(GoatBot.eventCommands instanceof Map))
		throw new Error("GoatBot.eventCommands Map is not initialized.");

	const name = command.config.name.trim();
	const key = name.toLowerCase();
	command.location = filePath;
	GoatBot.eventCommands.set(key, command);
	return command;
}

async function callOnLoad(command, api) {
	if (typeof command.onLoad !== "function")
		return;

	await command.onLoad({
		api,
		threadModel: global.threadModel,
		userModel: global.userModel,
		dashBoardModel: global.dashBoardModel,
		globalModel: global.globalModel,
		threadsData: global.db?.threadsData,
		usersData: global.db?.usersData,
		dashBoardData: global.db?.dashBoardData,
		globalData: global.db?.globalData
	});
}

async function loadInstalledModule(filePath, api, overwrite = false) {
	clearRequireCache(filePath);

	let command;
	try {
		command = require(filePath);
	}
	catch (error) {
		throw new Error(`Module load failed: ${error.stack || error.message}`);
	}

	const type = validateModuleExport(command);
	const name = command.config.name.trim();
	const key = name.toLowerCase();
	const registry = type === "event" ? GoatBot.eventCommands : GoatBot.commands;
	const existing = registry?.get(key);

	if (existing && !overwrite)
		throw new Error(`${type} "${name}" is already loaded.`);

	if (type === "command" && existing)
		removeCommandRegistrations(name, existing);

	try {
		if (type === "event")
			registerEvent(command, filePath);
		else
			registerCommand(command, filePath);

		await callOnLoad(command, api);
		return { command, type, name };
	}
	catch (error) {
		if (type === "event")
			GoatBot.eventCommands.delete(key);
		else
			removeCommandRegistrations(name, command);
		throw error;
	}
}

function getInstallMessage(type, fileName, location, extra = "") {
	const label = type === "event" ? "Event" : "Command";
	return (
		`✅ 𝐈𝐧𝐬𝐭𝐚𝐥𝐥𝐞𝐝: ${fileName}\n` +
		`📂 𝐓𝐲𝐩𝐞: ${label}\n` +
		`📍 𝐋𝐨𝐜𝐚𝐭𝐢𝐨𝐧: ${location}\n` +
		`📌 𝐒𝐭𝐚𝐭𝐮𝐬: 𝐋𝐨𝐚𝐝𝐞𝐝 𝐒𝐮𝐜𝐜𝐞𝐬𝐬𝐟𝐮𝐥𝐥𝐲\n` +
		`👑 𝐀𝐮𝐭𝐡𝐨𝐫: ${AUTHOR}` +
		(extra ? `\n${extra}` : "")
	);
}

function getFailureMessage(fileName, error) {
	return `❌ 𝐈𝐧𝐬𝐭𝐚𝐥𝐥 𝐟𝐚𝐢𝐥𝐞𝐝: ${fileName || "unknown"}\n⚠️ ${error}`;
}

function makeTempFile(dir, prefix, fileName) {
	return path.join(dir, `.${prefix}-${Date.now()}-${process.pid}-${fileName}`);
}

module.exports = {
	config: {
		name: "install",
		version: VERSION,
		author: AUTHOR,
		countDown: 3,
		role: 2,
		hasPrefix: false,
		shortDescription: "Automatically install commands and events",
		longDescription: "Install GoatBot command or event modules from replied code, direct code, or a URL. Automatically detects the module type, saves it in the correct folder, installs missing dependencies, registers it in the running bot, and supports reaction-based overwrite.",
		description: "Automatically install GoatBot commands and events from code or URL",
		category: "owner"
	},

	onStart: async function ({ args, message, event, api }) {
		let rawCode = "";
		let fileName = "";

		try {
			// Method 1: reply to source code or URL.
			if (event.messageReply?.body) {
				const replyText = event.messageReply.body.trim();
				const url = extractUrlFromText(replyText);
				rawCode = url ? await fetchCodeFromUrl(url) : replyText;
				if (!rawCode)
					return message.reply("❌ 𝐂𝐨𝐮𝐥𝐝 𝐧𝐨𝐭 𝐟𝐞𝐭𝐜𝐡 𝐜𝐨𝐝𝐞 𝐟𝐫𝐨𝐦 𝐭𝐡𝐞 𝐔𝐑𝐋.");
				fileName = extractCommandName(rawCode) || "";
			}
			// Method 2: install <URL>
			else if (args[0] && isURL(args[0])) {
				rawCode = await fetchCodeFromUrl(args[0]);
				if (!rawCode)
					return message.reply("❌ 𝐈𝐧𝐯𝐚𝐥𝐢𝐝 𝐨𝐫 𝐮𝐧𝐫𝐞𝐚𝐜𝐡𝐚𝐛𝐥𝐞 𝐔𝐑𝐋.");
				fileName = extractCommandName(rawCode) || "";
			}
			// Method 3: install <filename.js> <code>
			else if (args.length >= 2) {
				fileName = normalizeFileName(args[0]);
				rawCode = args.slice(1).join(" ");
			}

			if (!rawCode) {
				return message.reply(
					"⚠️ 𝐍𝐨 𝐜𝐨𝐝𝐞 𝐩𝐫𝐨𝐯𝐢𝐝𝐞𝐝.\n\n" +
					"𝐔𝐬𝐚𝐠𝐞:\n" +
					"• Reply to code/URL\n" +
					"• install <URL>\n" +
					"• install <name.js> <code>"
				);
			}

			rawCode = cleanCodeResponse(rawCode);
			if (!rawCode)
				return message.reply("❌ 𝐂𝐨𝐝𝐞 𝐢𝐬 𝐞𝐦𝐩𝐭𝐲.");

			// Syntax check only; module execution happens during validation below.
			try {
				new Function(rawCode);
			}
			catch (error) {
				return message.reply(`❌ 𝐈𝐧𝐯𝐚𝐥𝐢𝐝 𝐉𝐚𝐯𝐚𝐒𝐜𝐫𝐢𝐩𝐭.\n⚠️ ${error.message}`);
			}

			if (!fileName)
				fileName = extractCommandName(rawCode) || "";

			if (!fileName)
				return message.reply("❌ 𝐂𝐨𝐮𝐥𝐝 𝐧𝐨𝐭 𝐝𝐞𝐭𝐞𝐜𝐭 config.name.");

			fileName = normalizeFileName(fileName);
			const { commandDir, eventDir } = ensureDirectories();

			// Validate module in a temporary .js file to detect category/type.
			const tempDir = path.join(process.cwd(), "scripts", "tmp");
			fs.ensureDirSync(tempDir);
			const tempPath = makeTempFile(tempDir, "install-check", fileName);
			fs.writeFileSync(tempPath, rawCode, "utf8");

			let testCommand;
			let type;
			try {
				clearRequireCache(tempPath);
				testCommand = require(tempPath);
				type = validateModuleExport(testCommand);
			}
			catch (error) {
				clearRequireCache(tempPath);
				fs.removeSync(tempPath);
				return message.reply(`❌ 𝐕𝐚𝐥𝐢𝐝𝐚𝐭𝐢𝐨𝐧 𝐟𝐚𝐢𝐥𝐞𝐝.\n⚠️ ${error.message}`);
			}
			clearRequireCache(tempPath);
			fs.removeSync(tempPath);

			fileName = normalizeFileName(`${testCommand.config.name}.js`);
			const targetDir = type === "event" ? eventDir : commandDir;
			const finalPath = path.join(targetDir, fileName);
			const relativePath = path.relative(process.cwd(), finalPath).split(path.sep).join("/");

			const registry = type === "event" ? GoatBot.eventCommands : GoatBot.commands;
			const key = testCommand.config.name.trim().toLowerCase();
			const existing = registry?.get(key);

			if (existing) {
				return message.reply(
					`⚠️ ${testCommand.config.name} 𝐚𝐥𝐫𝐞𝐚𝐝𝐲 𝐞𝐱𝐢𝐬𝐭𝐬.\n\n` +
					`📂 Type: ${type}\n📍 Location: ${relativePath}\n\n` +
					`React to this message to overwrite.`,
					(err, info) => {
						if (err || !info?.messageID || !GoatBot.onReaction)
							return;

						GoatBot.onReaction.set(info.messageID, {
							commandName: "install",
							author: event.senderID,
							data: { rawCode, fileName, type, relativePath }
						});
					}
				);
			}

			let installedPackages = [];
			try {
				installedPackages = await installMissingPackages(rawCode);
			}
			catch (error) {
				return message.reply(getFailureMessage(fileName, error.message));
			}

			fs.ensureDirSync(targetDir);
			fs.writeFileSync(finalPath, rawCode, "utf8");

			try {
				const loaded = await loadInstalledModule(finalPath, api, false);
				const extra = installedPackages.length
					? `📦 𝐃𝐞𝐩𝐞𝐧𝐝𝐞𝐧𝐜𝐢𝐞𝐬: ${installedPackages.join(", ")}`
					: "";
				return message.reply(getInstallMessage(loaded.type, fileName, relativePath, extra));
			}
			catch (error) {
				clearRequireCache(finalPath);
				if (fs.existsSync(finalPath))
					fs.removeSync(finalPath);
				return message.reply(getFailureMessage(fileName, error.message));
			}
		}
		catch (error) {
			return message.reply(getFailureMessage(fileName, error.message || "Unknown error"));
		}
	},

	onReaction: async function ({ Reaction, event, message, api }) {
		if (event.userID !== Reaction.author)
			return;

		const data = Reaction.data || {};
		const rawCode = data.rawCode;
		let fileName = data.fileName;

		if (!rawCode || !fileName)
			return message.reply("❌ 𝐎𝐯𝐞𝐫𝐰𝐫𝐢𝐭𝐞 𝐝𝐚𝐭𝐚 𝐢𝐬 𝐦𝐢𝐬𝐬𝐢𝐧𝐠.");

		let backupPath = null;
		let finalPath = null;
		let hadOldFile = false;
		let oldRegistryEntry = null;

		try {
			const { commandDir, eventDir } = ensureDirectories();
			const tempDir = path.join(process.cwd(), "scripts", "tmp");
			fs.ensureDirSync(tempDir);

			const tempPath = makeTempFile(tempDir, "overwrite-check", fileName);
			fs.writeFileSync(tempPath, rawCode, "utf8");

			let newCommand;
			let type;
			try {
				clearRequireCache(tempPath);
				newCommand = require(tempPath);
				type = validateModuleExport(newCommand);
			}
			catch (error) {
				clearRequireCache(tempPath);
				fs.removeSync(tempPath);
				return message.reply(`❌ 𝐎𝐯𝐞𝐫𝐰𝐫𝐢𝐭𝐞 𝐯𝐚𝐥𝐢𝐝𝐚𝐭𝐢𝐨𝐧 𝐟𝐚𝐢𝐥𝐞𝐝.\n⚠️ ${error.message}`);
			}
			clearRequireCache(tempPath);
			fs.removeSync(tempPath);

			fileName = normalizeFileName(`${newCommand.config.name}.js`);
			const targetDir = type === "event" ? eventDir : commandDir;
			finalPath = path.join(targetDir, fileName);
			const relativePath = path.relative(process.cwd(), finalPath).split(path.sep).join("/");
			const key = newCommand.config.name.trim().toLowerCase();
			const registry = type === "event" ? GoatBot.eventCommands : GoatBot.commands;
			oldRegistryEntry = registry?.get(key) || null;

			let installedPackages = [];
			try {
				installedPackages = await installMissingPackages(rawCode);
			}
			catch (error) {
				return message.reply(`❌ 𝐃𝐞𝐩𝐞𝐧𝐝𝐞𝐧𝐜𝐲 𝐢𝐧𝐬𝐭𝐚𝐥𝐥 𝐟𝐚𝐢𝐥𝐞𝐝.\n⚠️ ${error.message}`);
			}

			backupPath = `${finalPath}.install-backup`;
			hadOldFile = fs.existsSync(finalPath);
			if (hadOldFile)
				fs.copyFileSync(finalPath, backupPath);

			fs.writeFileSync(finalPath, rawCode, "utf8");

			try {
				const loaded = await loadInstalledModule(finalPath, api, true);
				if (backupPath && fs.existsSync(backupPath))
					fs.removeSync(backupPath);

				const extra = installedPackages.length
					? `📦 𝐃𝐞𝐩𝐞𝐧𝐝𝐞𝐧𝐜𝐢𝐞𝐬: ${installedPackages.join(", ")}`
					: "";
				return message.reply(
					`♻️ 𝐎𝐯𝐞𝐫𝐰𝐫𝐢𝐭𝐭𝐞𝐧: ${fileName}\n` +
					`📂 𝐓𝐲𝐩𝐞: ${loaded.type === "event" ? "Event" : "Command"}\n` +
					`📍 𝐋𝐨𝐜𝐚𝐭𝐢𝐨𝐧: ${relativePath}\n` +
					`📌 𝐒𝐭𝐚𝐭𝐮𝐬: 𝐋𝐨𝐚𝐝𝐞𝐝 𝐒𝐮𝐜𝐜𝐞𝐬𝐬𝐟𝐮𝐥𝐥𝐲\n` +
					`👑 𝐀𝐮𝐭𝐡𝐨𝐫: ${AUTHOR}` +
					(extra ? `\n${extra}` : "")
				);
			}
			catch (error) {
				clearRequireCache(finalPath);

				if (hadOldFile && fs.existsSync(backupPath)) {
					fs.copyFileSync(backupPath, finalPath);
					fs.removeSync(backupPath);
					clearRequireCache(finalPath);

					// Restore the previous in-memory registry entry.
					if (oldRegistryEntry) {
						if (type === "event")
							GoatBot.eventCommands.set(key, oldRegistryEntry);
						else {
							removeCommandRegistrations(key, GoatBot.commands.get(key));
							registerCommand(oldRegistryEntry, finalPath);
						}
					}
				}
				else if (fs.existsSync(finalPath)) {
					fs.removeSync(finalPath);
					if (type === "event")
						GoatBot.eventCommands.delete(key);
					else
						removeCommandRegistrations(key, GoatBot.commands.get(key));
				}

				return message.reply(`❌ 𝐎𝐯𝐞𝐫𝐰𝐫𝐢𝐭𝐞 𝐟𝐚𝐢𝐥𝐞𝐝: ${fileName}\n⚠️ ${error.message}`);
			}
		}
		catch (error) {
			if (backupPath && fs.existsSync(backupPath) && finalPath) {
				try {
					fs.copyFileSync(backupPath, finalPath);
					fs.removeSync(backupPath);
				}
				catch {
					// Best-effort restore.
				}
			}
			return message.reply(`❌ 𝐎𝐯𝐞𝐫𝐰𝐫𝐢𝐭𝐞 𝐟𝐚𝐢𝐥𝐞𝐝.\n⚠️ ${error.message || "Unknown error"}`);
		}
	}
};
