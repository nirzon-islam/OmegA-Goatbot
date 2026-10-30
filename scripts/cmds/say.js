const axios = require("axios");

module.exports = {
config: {
name: "say",
version: "2.0.0",
author: "NirZon",
countDown: 5,
role: 0,
shortDescription: "টেক্সটকে ভয়েসে রূপান্তর করে",
longDescription: "টেক্সট অথবা কোনো মেসেজে reply দিয়ে সেটিকে ভয়েসে রূপান্তর করে পাঠাবে।",
category: "ai",
guide: {
en: "{pn} text or reply to a message"
}
},

onStart: async function ({ api, event, args, message }) {
try {
const text = event.type === "message_reply"
? event.messageReply.body
: args.join(" ");

  if (!text) {
    return message.reply(
      "❌ Please type some text or reply to a message!"
    );
  }

  const link = `https://sandipapi.onrender.com/say?text=${encodeURIComponent(text)}`;

  const voice = await global.utils.getStreamFromURL(link);

  return message.reply({
    body: "🎙️ Here's your voice!",
    attachment: voice
  });

} catch (error) {
  console.error("Say command error:", error);

  return message.reply(
    "❌ Voice generate করতে সমস্যা হয়েছে। একটু পরে চেষ্টা করো!"
  );
}

}
};
