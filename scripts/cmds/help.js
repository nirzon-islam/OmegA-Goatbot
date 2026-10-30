const fs = require("fs-extra");
const path = require("path");
const https = require("https");

module.exports = {
config: {
name: "help",
aliases: ["menu", "commands"],
version: "2.0.0",
author: "NirZon",
shortDescription: "Show all commands Smartly",
longDescription: "Show all commands in stylish UI",
category: "system",
guide: "{pn}help [command name]"
},

onStart: async function ({ message, args, prefix }) {
const allCommands = global.GoatBot.commands;

const fancyFont = (str) =>
  str.replace(/[A-Za-z]/g, c => {
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
  text ? text.toLowerCase() : "others";

// Individual command information
if (args[0]) {
  const cmdName = args[0].toLowerCase();

  const cmd =
    allCommands.get(cmdName) ||
    [...allCommands.values()].find(c =>
      c.config.aliases?.includes(cmdName)
    );

  if (!cmd)
    return message.reply(

"╭━━━〔 ❌ COMMAND NOT FOUND 〕━━━╮ ┃ ✦ Command: ${fancyFont(cmdName)} ┃ ✦ Try: ${prefix}help ╰━━━━━━━━━━━━━━━━━━━━━━╯"
);

  const usage = typeof cmd.config.guide === "string"
    ? cmd.config.guide.replace(/{pn}/g, prefix + cmd.config.name)
    : prefix + cmd.config.name;

  const infoMsg =

"╭━━━〔 🧩 COMMAND INFO 〕━━━╮ ┃ ✦ Name     : ${fancyFont(cmd.config.name)} ┃ ✦ Aliases  : ${cmd.config.aliases?.join(", ") || "None"} ┃ ✦ Category : ${fancyFont((cmd.config.category || "Others").toUpperCase())} ┃ ✦ Version  : v${cmd.config.version || "1.0"} ┃ ✦ Author   : ${cmd.config.author || "Unknown"} ┃ ✦ Access   : ${cmd.config.role > 0 ? "Admin Only 🔒" : "Everyone 🌐"} ┣━━━━━━━━━━━━━━━━━━━━━━ ┃ 📝 DESCRIPTION ┃ ${cmd.config.longDescription || cmd.config.shortDescription || "No description"} ┣━━━━━━━━━━━━━━━━━━━━━━ ┃ 📖 USAGE ┃ ${usage} ╰━━━━━━━━━━━━━━━━━━━━━━╯";

  return message.reply(infoMsg);
}

// Organize commands by category
const categories = {};

for (const [name, cmd] of allCommands) {
  const cat = cleanCategoryName(cmd.config.category);

  if (!categories[cat])
    categories[cat] = [];

  categories[cat].push({
    name,
    locked: cmd.config.role > 0
  });
}

const categoryNames = Object.keys(categories).sort();

let msg =

`╔══════════════════════════╗
║    ✦ 𝗡𝗜𝗥𝗭𝗢𝗡 𝗕𝗢𝗧 𝗛𝗘𝗟𝗣 ✦
╚══════════════════════════╝

╭━━━〔 📊 STATISTICS 〕━━━╮
┃ ✦ 📦 Total Commands : ${allCommands.size}
┃ ✦ 📂 Total Categories : ${categoryNames.length}
┃ ✦ 🔰 Prefix : ${prefix}
╰━━━━━━━━━━━━━━━━━━━━━━╯
`;

for (const cat of categoryNames) {
  const commands = categories[cat].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  msg += `\n╭──〔 📂 ${fancyFont(cat.toUpperCase())} 〕──⦿\n`;

  // Double row: two commands per line
  for (let i = 0; i < commands.length; i += 2) {
    const first = commands[i];
    const second = commands[i + 1];

    const left = `⚙ ${fancyFont(first.name)}${first.locked ? " 🔒" : ""}`;
    const right = second
      ? `⚙ ${fancyFont(second.name)}${second.locked ? " 🔒" : ""}`
      : "";

    msg += `┃ ${left}   ${right}\n`;
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

// Random GIF attachment
const gifURLs = [
  "https://i.imgur.com/Xw6JTfn.gif",
  "https://i.imgur.com/mW0yjZb.gif",
  "https://i.imgur.com/KQBcxOV.gif"
];

const randomGifURL =
  gifURLs[Math.floor(Math.random() * gifURLs.length)];

const gifFolder = path.join(__dirname, "cache");

if (!fs.existsSync(gifFolder))
  fs.mkdirSync(gifFolder, { recursive: true });

const gifName = path.basename(randomGifURL);
const gifPath = path.join(gifFolder, gifName);

if (!fs.existsSync(gifPath))
  await downloadGif(randomGifURL, gifPath);

return message.reply({
  body: msg,
  attachment: fs.createReadStream(gifPath)
});

}
};

function downloadGif(url, dest) {
return new Promise((resolve, reject) => {
const file = fs.createWriteStream(dest);

https.get(url, res => {
  if (res.statusCode !== 200) {
    file.close();
    fs.unlink(dest, () => {});
    return reject(new Error("GIF download failed"));
  }

  res.pipe(file);
  file.on("finish", () => file.close(resolve));
}).on("error", err => {
  file.close();
  fs.unlink(dest, () => {});
  reject(err);
});

});
}
