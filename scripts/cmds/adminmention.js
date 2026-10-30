module.exports = {
  config: {
    name: "adminmention",
    version: "2.0.0",
    author: "NirZon",
    countDown: 0,
    role: 0,
    shortDescription: "Replies angrily when someone tags admins",
    longDescription: "If anyone mentions an admin, bot will angrily reply with random messages.",
    category: "system"
  },

  onStart: async function () {},

  onChat: async function ({ event, message }) {
    const adminIDs = ["61561645647195", "100090071683807", "100092480994957"].map(String);

    // Skip if sender is admin
    if (adminIDs.includes(String(event.senderID))) return;

    // যদি কেউ মেনশন দেয়
    const mentionedIDs = event.mentions ? Object.keys(event.mentions).map(String) : [];
    const isMentioningAdmin = adminIDs.some(id => mentionedIDs.includes(id));

    if (!isMentioningAdmin) return;

    // র‍্যান্ডম রাগী রিপ্লাই
    const REPLIES = [
  "ওরে মেনশন দিস না, বস এখন বউয়ের সাথে মিটিংয়ে আছে! 😭",
  "বসকে ডাকিস কেন? উনি কি তোর হারানো আত্মীয়? 😂",
  "মেনশন দেখে বসের আত্মা অনলাইন থেকে অফলাইন হয়ে গেল! 👻",
  "বস এখন VIP, তোর ডাক শুনার সময় নাই! 😎",
  "একটু ধৈর্য ধর, বস NASA-র সাথে মিটিং করছে! 🚀",
  "এত মেনশন না দিয়ে একটা CV পাঠা, বস চাকরি দিবে! 😂",
  "বসকে ডাকিস না, উনার ঘুমেরও সম্মান আছে! 😴",
  "এই যে মেনশন মাস্টার, একটু ব্রেক নে! 🐸",
  "বস এখন নিজের জীবন নিয়েই ব্যস্ত, তোরটা পরে দেখবে! 🤣",
  "মেনশন দিয়ে লাভ নাই, বসের মন এখন Airplane Mode! ✈️",
  "বসকে ডাকতে হলে আগে Appointment নিতে হবে! 😌",
  "তোর মেনশন দেখে বস ফোনটাই উল্টা করে রাখছে! 😂",
  "বস কি তোর Google Assistant নাকি? ডাকলেই হাজির হবে! 🤨",
  "এত ডাকাডাকি করিস কেন? বস কি তোর হারানো WiFi? 📶",
  "বস এখন ব্যস্ত, বিরক্ত করার জন্য ধন্যবাদ! 🥰",
  "মেনশন কম কর, আঙুলেরও বিশ্রাম দরকার! 😭",
  "বসের নাম নিলে ট্যাক্স দিতে হয়, জানিস না? 💸",
  "তোর মেনশন দেখে বসের BP বেড়ে গেছে! 🩺",
  "বস এখন ধ্যানে আছে, তোর ডাক শুনলে নির্বাণ নষ্ট হবে! 🧘",
  "এই মেনশনবাজ, বসকে একটু শান্তিতে থাকতে দে! 🤣",
  "বস এখন রাজপ্রাসাদে, তুই দরজায় অপেক্ষা কর! 👑",
  "মেনশন দিয়ে বসকে পাওয়া যায় না, লটারি কাটতে হয়! 🎟️",
  "বসের সাথে কথা বলতে চাইলে আগে নিজের পরিচয় দে! 😂",
  "বস এখন ঘুমাচ্ছে, স্বপ্নেও তোর মেনশন সহ্য করছে না! 🥲",
  "তোর সাহস দেখে মশারাও ভয় পেয়ে গেছে! 🦟",
  "বসকে ডাকিস না, উনি এখন নিজের সাথে ঝগড়া করছেন! 😭",
  "মেনশন করে লাভ কী? বস তো তোর Notification-ও দেখে না! 🤣",
  "বস এখন ব্যস্ত, পরে আসিস... আর না আসলেও সমস্যা নাই! 😏",
  "এই যে ভাই, Admin-এর নাম জপলে কি পূণ্য হয়? 🐸",
  "আরেকবার মেনশন দিলে বসের পক্ষ থেকে তোকে চা খাওয়াবো... বিষ ছাড়া! ☕😂"
];
    const randomReply = REPLIES[Math.floor(Math.random() * REPLIES.length)];
    return message.reply(randomReply);
  }
};
