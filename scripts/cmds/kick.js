module.exports = {
  config: {
    name: "kick",
    version: "1.4.1",
    author: "Fixed by EryXenX",
    countDown: 5,
    role: 1,
    description: {
      en: "Kick member out of chat box"
    },
    category: "box chat",
    guide: {
      en: " {pn} @tags or reply to kick"
    }
  },
  langs: {
    en: { needAdmin: "Bot is not admin, please add bot as admin" },
    bn: { needAdmin: "Bot admin e nei, age bot ke admin banan" }
  },
  onStart: async function ({ message, event, args, threadsData, api, getLang }) {
    // live admin check
    try {
      const threadInfo = await api.getThreadInfo(event.threadID);
      const adminIDs = threadInfo.adminIDs.map(a => a.id || a);
      const botID = api.getCurrentUserID();
      
      if (!adminIDs.includes(botID)) {
        return message.reply(getLang("needAdmin"));
      }
    } catch (e) {
      // fallback to old method if getThreadInfo fails
      const adminIDs = await threadsData.get(event.threadID, "adminIDs");
      if (!adminIDs || !adminIDs.includes(api.getCurrentUserID())) {
        return message.reply(getLang("needAdmin"));
      }
    }

    async function kickAndCheckError(uid) {
      try {
        await api.removeUserFromGroup(uid, event.threadID);
      } catch (e) {
        return message.reply(getLang("needAdmin"));
      }
    }

    if (!args[0] && !event.messageReply) {
      return message.SyntaxError();
    }

    if (event.messageReply) {
      await kickAndCheckError(event.messageReply.senderID);
    } else {
      const uids = Object.keys(event.mentions);
      if (uids.length === 0) return message.SyntaxError();
      for (const uid of uids) {
        await kickAndCheckError(uid);
      }
    }
  }
}
