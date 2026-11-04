const fs = require("fs-extra");
const path = require("path");

const { GoatBot } = global;

function sendTemporaryMessage(api, body, threadID) {
  api.sendMessage(body, threadID, (err, info) => {
    if (err || !info?.messageID) return;

    setTimeout(() => {
      try {
        api.unsendMessage(info.messageID, () => {});
      } catch (error) {
        console.error("[Smart Delete] Auto-unsend Error:", error);
      }
    }, 10000);
  });
}

module.exports = {
  config: {
    name: "delete",
    aliases: ["del"],
    version: "2.0.0",
    author: "NirZon",
    countDown: 3,
    role: 2,
    shortDescription: "Safely delete and unload command/event files",
    longDescription:
      "Deletes a command or event by its exact filename and removes its live GoatBot registrations without restarting.",
    description:
      "Exact-filename deletion with registry cleanup and require-cache removal.",
    category: "system"
  },

  onStart: async function ({ api, event, args }) {
    const fileName = String(args[0] || "").trim();

    if (!fileName) {
      return sendTemporaryMessage(api, 
        "⚠️ Please provide the full file name.\n\n" +
        "Example:\n" +
        "delete adminmention.js",
        event.threadID
      );
    }

    // Require the exact filename; command names and aliases are not accepted.
    if (
      !fileName.toLowerCase().endsWith(".js") ||
      path.basename(fileName) !== fileName ||
      fileName === "." ||
      fileName === ".."
    ) {
      return sendTemporaryMessage(api, 
        "❌ Invalid file name!\n\n" +
        "Please provide the complete .js filename.\n" +
        "Example: delete adminmention.js",
        event.threadID
      );
    }

    const root = process.cwd();
    const commandDir = path.resolve(root, "scripts", "cmds");
    const eventDir = path.resolve(root, "scripts", "events");

    const candidates = [
      { type: "Command", dir: commandDir },
      { type: "Event", dir: eventDir }
    ].map(item => ({
      ...item,
      filePath: path.resolve(item.dir, fileName)
    }));

    // Ensure the resolved path remains inside the intended directory.
    const safeCandidates = candidates.filter(({ dir, filePath }) =>
      filePath.startsWith(dir + path.sep)
    );

    const existingFiles = safeCandidates.filter(({ filePath }) =>
      fs.existsSync(filePath) && fs.statSync(filePath).isFile()
    );

    if (existingFiles.length === 0) {
      return sendTemporaryMessage(api, 
        `❎ File not found: ${fileName}\n\n` +
        "📂 Checked folders:\n" +
        "• scripts/cmds\n" +
        "• scripts/events",
        event.threadID
      );
    }

    // Do not guess if the same filename exists in both folders.
    if (existingFiles.length > 1) {
      return sendTemporaryMessage(api, 
        `⚠️ Duplicate filename detected: ${fileName}\n\n` +
        "A file with this name exists in both Commands and Events.\n" +
        "Rename one of the files first; nothing was deleted.",
        event.threadID
      );
    }

    const target = existingFiles[0];
    const resolvedPath = target.filePath;

    // Find the already-loaded module by its registered physical location.
    // This avoids requiring/executing an arbitrary file just to inspect it.
    const samePath = value => {
      if (!value?.location) return false;

      try {
        return path.resolve(value.location) === resolvedPath;
      } catch {
        return false;
      }
    };

    let loadedModule = null;
    let registeredName = null;
    let isEvent = target.type === "Event";

    if (isEvent) {
      if (GoatBot.eventCommands instanceof Map) {
        for (const [key, value] of GoatBot.eventCommands.entries()) {
          if (samePath(value)) {
            loadedModule = value;
            registeredName = String(value.config?.name || key).toLowerCase();
            break;
          }
        }
      }
    } else if (GoatBot.commands instanceof Map) {
      for (const [key, value] of GoatBot.commands.entries()) {
        if (samePath(value)) {
          loadedModule = value;
          registeredName = String(value.config?.name || key).toLowerCase();
          break;
        }
      }
    }

    if (!loadedModule || !registeredName) {
      return sendTemporaryMessage(api, 
        `⚠️ File Not Loaded\n\n` +
        `📁 File: ${fileName}\n` +
        `📌 Type: ${target.type}\n` +
        `Nothing was deleted. Please check the loader state first.`,
        event.threadID
      );
    }

    if (registeredName === "delete") {
      return sendTemporaryMessage(api, 
        "❌ You cannot delete the active delete command itself.",
        event.threadID
      );
    }

    try {
      // Delete the physical file first. If this fails, the live command
      // remains registered and usable.
      await fs.remove(resolvedPath);

      if (isEvent) {
        GoatBot.eventCommands.delete(registeredName);
      } else {
        GoatBot.commands.delete(registeredName);

        // Remove every alias that points to this command.
        if (GoatBot.aliases instanceof Map) {
          for (const [alias, owner] of [...GoatBot.aliases.entries()]) {
            if (String(owner).toLowerCase() === registeredName) {
              GoatBot.aliases.delete(alias);
            }
          }
        }

        // Remove runtime listener registrations.
        for (const listName of ["onChat", "onEvent", "onAnyEvent"]) {
          if (Array.isArray(GoatBot[listName])) {
            GoatBot[listName] = GoatBot[listName].filter(
              item => String(item).toLowerCase() !== registeredName
            );
          }
        }

        if (Array.isArray(GoatBot.onFirstChat)) {
          GoatBot.onFirstChat = GoatBot.onFirstChat.filter(
            item =>
              String(item?.commandName).toLowerCase() !== registeredName
          );
        }

        if (Array.isArray(GoatBot.commandFilesPath)) {
          GoatBot.commandFilesPath = GoatBot.commandFilesPath.filter(
            item =>
              !(item?.commandName || []).some(
                commandName =>
                  String(commandName).toLowerCase() === registeredName
              )
          );
        }
      }

      // Remove the module from Node's require cache.
      try {
        const resolvedModulePath = require.resolve(resolvedPath);
        delete require.cache[resolvedModulePath];
      } catch {}

      return sendTemporaryMessage(api, 
        `✅ Delete Successful\n\n` +
        `📁 File: ${fileName}\n` +
        `📌 Type: ${target.type}\n` +
        `🗑️ Status: Deleted\n` +
        `⚡ Memory: Unloaded\n` +
        `🔗 Aliases: ${isEvent ? "N/A" : "Removed"}\n` +
        `♻️ Restart: Not Required\n\n` +
        `━━━━━━━━━━━━━━━━━━`,
        event.threadID
      );
    } catch (error) {
      console.error("[Smart Delete] Error:", error);

      return sendTemporaryMessage(api, 
        `❌ Delete Failed\n\n` +
        `📁 File: ${fileName}\n` +
        `❎ Status: Failed\n` +
        `⚠️ Reason: ${error.message}\n` +
        `♻️ Memory: Registration Unchanged\n\n` +
        `━━━━━━━━━━━━━━━━━━`,
        event.threadID
      );
    }
  }
};
