const fs = require("fs-extra");
const request = require("request");
const path = require("path");

module.exports = {
  config: {
    name: "owner",
    version: "2.0.0",
    author: "NirZon",
    role: 0,
    shortDescription: "Owner information with image",
    category: "Information",
    guide: {
      en: "owner"
    }
  },

  onStart: async function ({ api, event }) {
    const ownerText = 
`╭─ 👑 Oᴡɴᴇʀ Iɴғᴏ 👑 ─╮
│ 👤 Nᴀᴍᴇ       : NɪʀZᴏɴ Isʟᴀᴍ
│ 🧸 Nɪᴄᴋ       : Nɪʀᴏᴏ
│ 🎂 Aɢᴇ        : 22+
│ 💼 Pʀᴏғᴇssɪᴏɴ : Jᴏʙ & Sɪɴɢɪɴɢ
│ 🏡 Lᴏᴄᴀᴛɪᴏɴ : PɪɴɢɴA, Sᴀʀɪsʜᴀʙᴀʀɪ
│.......................
│ 👑 Nᴀᴍᴇ       : RɪʏA Isʟᴀᴍ
│ 🧸 Nɪᴄᴋ       : Nɪᴢᴜ
│ 🎂 Aɢᴇ        : 17+
│ 💼 Pʀᴏғᴇssɪᴏɴ : Sɪɴɢɪɴɢ 
│ 🏡 Lᴏᴄᴀᴛɪᴏɴ   : PɪɴɢɴA, Sᴀʀɪsʜᴀʙᴀʀɪ 
├─ 🔗 Cᴏɴᴛᴀᴄᴛ ─╮
│ 📘 facebook : https://www.facebook.com/61561645647195
│ 💬 Messanger: https://m.me/61561645647195 
╰────────────────╯`;

    const cacheDir = path.join(__dirname, "cache");
    const imgPath = path.join(cacheDir, "owner.jpg");

    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir);

    const imgLink = "https://i.imgur.com/awrrOff.jpeg";

    const send = () => {
      api.sendMessage(
        {
          body: ownerText,
          attachment: fs.createReadStream(imgPath)
        },
        event.threadID,
        () => fs.unlinkSync(imgPath),
        event.messageID
      );
    };

    request(encodeURI(imgLink))
      .pipe(fs.createWriteStream(imgPath))
      .on("close", send);
  }
};
