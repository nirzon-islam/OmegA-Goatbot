
const fs = require("fs-extra");
const path = require("path");

const { GoatBot } = global;

module.exports = {
  config: {
    name: "delete",
    aliases: ["del"],
    version: "1.0.0",
    author: "NirZon",
    countDown: 3,
    role: 2,
    shortDescription: "Delete and unload command files",
    longDescription:
      "Deletes command or event files and removes their registrations from the running GoatBot without restarting.",
    description:
      "Automatically deletes command/event files, aliases and in-memory registrations.",
    category: "system"
  },

  onStart: async function ({ api, event, args }) {
    const fileName = args[0];

    if (!fileName) {
      return api.sendMessage(
        "⚠️ Please provide the full file name.\n\nExample: delete adminmention.js",
        event.threadID
      );
    }

    if (!fileName.toLowerCase().endsWith(".js")) {
      return api.sendMessage(
        "❌ File extension is required!\n\nExample: delete adminmention.js",
        event.threadID
      );
    }

    if (path.basename(fileName) !== fileName) {
      return api.sendMessage(
        "❌ Invalid file name.",
        event.threadID
      );
    }

    const safeName = fileName;

    const directories = [
      path.resolve(process.cwd(), "scripts/cmds"),
      path.resolve(process.cwd(), "scripts/events")
    ];

    const filePath = directories
      .map(dir => path.join(dir, safeName))
      .find(file => fs.existsSync(file));

    if (!filePath) {
      return api.sendMessage(
        `❎ File not found: ${safeName}`,
        event.threadID
      );
    }

    let oldCommand;

    try {
      oldCommand = require(filePath);
    } catch (error) {
      return api.sendMessage(
        `❎ Could not read file.\n⚠️ ${error.message}`,
        event.threadID
      );
    }

    const name = oldCommand.config?.name;

    if (!name) {
      return api.sendMessage(
        "❎ Command name could not be detected.",
        event.threadID
      );
    }

    const key = String(name).toLowerCase();

    try {
      // Remove command registration
      if (GoatBot.commands instanceof Map) {
        GoatBot.commands.delete(key);
      }

      // Remove event registration
      if (GoatBot.eventCommands instanceof Map) {
        GoatBot.eventCommands.delete(key);
      }

      // Remove aliases
      if (GoatBot.aliases instanceof Map) {
        for (const [alias, target] of GoatBot.aliases.entries()) {
          if (String(target).toLowerCase() === key) {
            GoatBot.aliases.delete(alias);
          }
        }
      }

      // Remove chat and event listeners
      for (const list of [
        "onChat",
        "onEvent",
        "onAnyEvent"
      ]) {
        if (Array.isArray(GoatBot[list])) {
          GoatBot[list] = GoatBot[list].filter(
            item => String(item).toLowerCase() !== key
          );
        }
      }

      // Remove first chat registration
      if (Array.isArray(GoatBot.onFirstChat)) {
        GoatBot.onFirstChat = GoatBot.onFirstChat.filter(
          item =>
            String(item?.commandName).toLowerCase() !== key
        );
      }

      // Remove command file registration
      if (Array.isArray(GoatBot.commandFilesPath)) {
        GoatBot.commandFilesPath =
          GoatBot.commandFilesPath.filter(
            item =>
              !(item?.commandName || []).some(
                command =>
                  String(command).toLowerCase() === key
              )
          );
      }

      // Clear require cache
      try {
        delete require.cache[require.resolve(filePath)];
      } catch {}

      // Delete physical file
      await fs.remove(filePath);

      return api.sendMessage(
        `╭━━━〔 DELETE SUCCESS 〕━━━╮\n\n` +
        `📁 File: ${safeName}\n` +
        `🗑️ Status: Deleted\n` +
        `⚡ Memory: Unloaded\n` +
        `🔗 Aliases: Removed\n` +
        `♻️ Restart: Not required\n\n` +
        `👑 Author: NirZon\n` +
        `╰━━━━━━━━━━━━━━━━━━━━╯`,
        event.threadID
      );

    } catch (error) {
      console.error("Delete Error:", error);

      return api.sendMessage(
        `❎ Failed to delete ${safeName}.\n\n` +
        `⚠️ ${error.message}`,
        event.threadID
      );
    }
  }
};
