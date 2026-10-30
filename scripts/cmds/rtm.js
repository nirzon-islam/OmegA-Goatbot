const os = require("os");

module.exports = {
  config: {
    name: "rtm",
    aliases: ["rtm", "rt"],
    version: "1.0.1",
    author: "NirZon",
    countDown: 3,
    role: 0,

    shortDescription: {
      en: "Show system bot runtime"
    },

    longDescription: {
      en: "Shows system bot running time."
    },

    description: {
      en: "Show bot runtime."
    },

    category: "system",

    guide: {
      en: "{pn}"
    }
  },

  onStart: async function ({ message }) {
    try {
      const uptime = process.uptime();

      const totalHours = Math.floor(uptime / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
      const seconds = Math.floor(uptime % 60);

      const msg =
        "⏰ 𝗥𝘂𝗻𝗻𝗶𝗻𝗴 𝗧𝗶𝗺𝗲 ➪ " +
        totalHours + "𝗵 " +
        minutes + "𝗺 " +
        seconds + "𝘀 ➜ ✨☠︎︎";

      return message.reply(msg);

    } catch (error) {
      console.error("Runtime Error:", error);
      return message.reply("Runtime error!");
    }
  }
};
