
const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

module.exports = {
  config: {
    name: "pastebin",
    aliases: ["bin", "pastebin", "paste"],
    version: "1.0.0",
    author: "NirZon",
    countDown: 5,
    role: 2,
    shortDescription: "Upload command source to Pastebin",
    longDescription: "Upload command source code to official Pastebin",
    category: "utility",
    guide: "{pn} <commandName>"
  },

  onStart: async function ({ args, message }) {
    const cmdName = args[0];

    if (!cmdName) {
      return message.reply(
        "❌ | Provide a command name!\nExample: -pastebin bby"
      );
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(cmdName)) {
      return message.reply("❌ | Invalid command name!");
    }

    // Read config.json
    const configPath = path.resolve(__dirname, "../../config.json");

    let botConfig;

    try {
      botConfig = await fs.readJson(configPath);
    } catch (error) {
      return message.reply(
        "❌ | Cannot read config.json. Check the file path."
      );
    }

    const apiKey = botConfig.pastebinApiKey;

    if (!apiKey) {
      return message.reply(
        "❌ | Pastebin API Key not found!\nAdd pastebinApiKey to config.json."
      );
    }

    // Case-insensitive filename search
    const files = await fs.readdir(__dirname);

    const actualFile = files.find(file =>
      file.toLowerCase() === `${cmdName}.js`.toLowerCase()
    );

    if (!actualFile) {
      return message.reply(
        `❌ | Command "${cmdName}" not found!`
      );
    }

    const cmdPath = path.join(__dirname, actualFile);

    try {
      const code = await fs.readFile(cmdPath, "utf8");

      if (!code.trim()) {
        return message.reply("❌ | Command file is empty!");
      }

      // Official Pastebin API
      const form = new URLSearchParams();

      form.append("api_dev_key", apiKey);
      form.append("api_option", "paste");
      form.append("api_paste_code", code);
      form.append("api_paste_name", actualFile);
      form.append("api_paste_private", "0");
      form.append("api_paste_expire_date", "N");
      form.append("api_paste_format", "javascript");

      const response = await axios.post(
        "https://pastebin.com/api/api_post.php",
        form.toString(),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded"
          },
          timeout: 30000,
          maxRedirects: 5
        }
      );

      const pasteUrl = String(response.data).trim();

      if (
        response.status !== 200 ||
        !/^https:\/\/pastebin\.com\/[a-zA-Z0-9]+$/.test(pasteUrl)
      ) {
        throw new Error(pasteUrl || "Invalid Pastebin response");
      }

      const pasteId = pasteUrl.split("/").pop();
      const rawUrl = `https://pastebin.com/raw/${pasteId}`;

      return message.reply(
`━━〔 ✅ PASTEBIN UPLOAD 〕━━
┃ 📄 File : ${actualFile}
┃ 🌍 Visibility : Public
┣━━━━━━━━━━━━━━━━━━━━━━
┃ 🔗 Paste Link:
┃ ${pasteUrl}
┣━━━━━━━━━━━━━━━━━━━━━━
┃ 📋 Raw Link:
┃ ${rawUrl}
╰━━━━━━━━━━━━━━━━━━━━━━╯
✦ Uploaded by NirZon`
      );

    } catch (error) {
      console.error(
        "[PASTEBIN ERROR]",
        error.response?.data || error.message
      );

      const apiError = String(
        error.response?.data || error.message || "Unknown error"
      ).slice(0, 300);

      return message.reply(
`❌ | Pastebin Upload Failed!

Reason: ${apiError}

Check your API Key and try again.`
      );
    }
  }
};
