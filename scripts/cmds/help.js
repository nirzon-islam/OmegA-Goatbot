
const fs = require("fs-extra");
const path = require("path");
const https = require("https");

module.exports = {
  config: {
    name: "help",
    aliases: ["menu", "commands"],
    version: "2.0.0",
    author: "NirZon",
    shortDescription: "Show all commands smartly",
    longDescription: "Show all commands in stylish UI",
    category: "system",
    guide: "{pn} [command name]"
  },

  onStart: async function ({ message, args, prefix }) {
    const allCommands = global.GoatBot.commands;

    if (!allCommands || typeof allCommands.values !== "function") {
      return message.reply("❌ Command list is not available!");
    }

    // Fancy font
    const fancyFont = (str) =>
      String(str).replace(/[A-Za-z]/g, c => {
        const map = {
          A:"𝐀",B:"𝐁",C:"𝐂",D:"𝐃",E:"𝐄",F:"𝐅",G:"𝐆",H:"𝐇",
          I:"𝐈",J:"𝐉",K:"𝐊",L:"𝐋",M:"𝐌",N:"𝐍",O:"𝐎",P:"𝐏",
          Q:"𝐐",R:"𝐑",S:"𝐒",T:"𝐓",U:"𝐔",V:"𝐕",W:"𝐖",X:"𝐗",
          Y:"𝐘",Z:"𝐙",
          a:"𝐚",b:"𝐛",c:"𝐜",d:"𝐝",e:"𝐞",f:"𝐟",g:"𝐠",h:"𝐡",
          i:"𝐢",j:"𝐣",k:"𝐤",l:"𝐥",m:"𝐦",n:"𝐧",o:"𝐨",p:"𝐩",
          q:"𝐪",r:"𝐫",s:"𝐬",t:"𝐭",u:"𝐮",v:"𝐯",w:"𝐰",x:"𝐱",
          y:"𝐲",z:"𝐳"
        };
        return map[c] || c;
      });

    const cleanCategoryName = text =>
      text ? String(text).toLowerCase() : "others";

    // Individual command information
    if (args[0]) {
      const cmdName = args[0].toLowerCase();

      const cmd =
        allCommands.get(cmdName) ||
        [...allCommands.values()].find(c =>
          c.config.name?.toLowerCase() === cmdName ||
          c.config.aliases?.some(alias =>
            alias.toLowerCase() === cmdName
          )
        );

      if (!cmd) {
        return message.reply(
`╭━━━〔 ❌ COMMAND NOT FOUND 〕━━━╮
┃ ✦ Command : ${fancyFont(cmdName)}
┃ ✦ Try     : ${prefix}help
╰━━━━━━━━━━━━━━━━━━━━━━╯`
        );
      }

      const usage = typeof cmd.config.guide === "string"
        ? cmd.config.guide.replace(/{pn}/g, prefix + cmd.config.name)
        : `${prefix}${cmd.config.name}`;

      const infoMsg =
`╭━━━〔 🧩 COMMAND INFO 〕━━━╮
┃ ✦ Name     : ${fancyFont(cmd.config.name)}
┃ ✦ Aliases  : ${cmd.config.aliases?.join(", ") || "None"}
┃ ✦ Category : ${fancyFont((cmd.config.category || "Others").toUpperCase())}
┃ ✦ Version  : v${cmd.config.version || "1.0"}
┃ ✦ Author   : ${cmd.config.author || "Unknown"}
┃ ✦ Access   : ${Number(cmd.config.role || 0) > 0 ? "Admin Only 🔒" : "Everyone 🌐"}
┣━━━━━━━━━━━━━━━━━━━━━━
┃ 📝 DESCRIPTION
┃ ${cmd.config.longDescription || cmd.config.shortDescription || "No description"}
┣━━━━━━━━━━━━━━━━━━━━━━
┃ 📖 USAGE
┃ ${usage}
╰━━━━━━━━━━━━━━━━━━━━━━╯`;

      return message.reply(infoMsg);
    }

    // Organize commands
    const categories = {};

    for (const [name, cmd] of allCommands) {
      const cat = cleanCategoryName(cmd.config.category);

      if (!categories[cat]) {
        categories[cat] = [];
      }

      categories[cat].push({
        name,
        locked: Number(cmd.config.role || 0) > 0
      });
    }

    const categoryNames = Object.keys(categories).sort();

    let msg =
`╔════════════════════╗
║    ✦ 𝗕𝗢𝗧 𝗛𝗘𝗟𝗣 ✦
╚════════════════════╝

╭━━━〔 📊 STATISTICS 〕━━━╮
┃ ✦ 📦 Total Commands : ${allCommands.size}
┃ ✦ 📂 Total Categories : ${categoryNames.length}
┃ ✦ 🔰 Prefix : ${prefix}
╰━━━━━━━━━━━━━━━━━━━━━━╯
`;

    // Double column alignment
    const makeCommand = cmd =>
      `⚙ ${fancyFont(cmd.name)}${cmd.locked ? " 🔒" : ""}`;

    const figureSpace = "\u2007";
    const columnWidth = 21;

    for (const cat of categoryNames) {
      const commands = categories[cat].sort((a, b) =>
        a.name.localeCompare(b.name)
      );

      msg += `\n╭──〔 📂 ${fancyFont(cat.toUpperCase())} 〕──⦿\n`;

      for (let i = 0; i < commands.length; i += 2) {
        const first = commands[i];
        const second = commands[i + 1];

        const left = makeCommand(first);
        const right = second ? makeCommand(second) : "";

        const padding = figureSpace.repeat(
          Math.max(2, columnWidth - left.length)
        );

        msg += `┃ ${left}${padding}${right}\n`;
      }

      msg += `╰━━━━━━━━━━━━━━━━━━━━━━╯\n`;
    }

    msg += `
╭━━━〔 ℹ INFORMATION 〕━━━╮
┃ ✦ 🔒 = Admin Only
┃ ✦ 🌐 = Everyone
┃ ✦ Use: ${prefix}help [command]
┃ ✦ Owner: 𝗡𝗜𝗥𝗭𝗢𝗡
╰━━━━━━━━━━━━━━━━━━━━━━╯

✦ ━━━━━ 𝗡𝗜𝗥𝗭𝗢𝗡 𝗕𝗢𝗧 ━━━━━ ✦`;

    // Random GIF
    const gifURLs = [
      "https://i.imgur.com/Xw6JTfn.gif",
      "https://i.imgur.com/mW0yjZb.gif",
      "https://i.imgur.com/KQBcxOV.gif"
    ];

    const randomGifURL =
      gifURLs[Math.floor(Math.random() * gifURLs.length)];

    const gifFolder = path.join(__dirname, "cache");

    try {
      await fs.ensureDir(gifFolder);

      const gifName = path.basename(randomGifURL);
      const gifPath = path.join(gifFolder, gifName);

      if (!await fs.pathExists(gifPath)) {
        await downloadGif(randomGifURL, gifPath);
      }

      return message.reply({
        body: msg,
        attachment: fs.createReadStream(gifPath)
      });

    } catch (error) {
      console.error("[HELP GIF ERROR]", error);
      return message.reply(msg);
    }
  }
};

// GIF Downloader
function downloadGif(url, dest, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) {
      return reject(new Error("Too many redirects"));
    }

    const file = fs.createWriteStream(dest);

    const request = https.get(url, response => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        const location = response.headers.location;
        response.resume();
        file.close();

        if (!location) {
          fs.unlink(dest, () => {});
          return reject(new Error("Redirect location missing"));
        }

        fs.unlink(dest, () => {
          downloadGif(new URL(location, url).href, dest, redirects + 1)
            .then(resolve)
            .catch(reject);
        });

        return;
      }

      if (response.statusCode !== 200) {
        response.resume();
        file.close();
        fs.unlink(dest, () => {});
        return reject(new Error(`HTTP ${response.statusCode}`));
      }

      response.pipe(file);

      file.on("finish", () => {
        file.close(err => {
          if (err) {
            fs.unlink(dest, () => {});
            return reject(err);
          }
          resolve();
        });
      });

      file.on("error", err => {
        file.close();
        fs.unlink(dest, () => {});
        reject(err);
      });
    });

    request.setTimeout(20000, () => {
      request.destroy(new Error("GIF download timeout"));
    });

    request.on("error", err => {
      file.close();
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}
