
const axios = require("axios");

const BASE_API = "https://baby-chat-api-hog5.onrender.com";

const TRIGGERS = [
  "baby", "bbz", "bby", "bot",
  "mikasa", "hinata", "xadika",
  "jan", "babu", "alya", "omega",
  "kakino", "botli", "বেবি", "বট", "বাবু", "জান"
];

const LAST = new Map();
const handledEvents = new Map();
const RESPONSE_DELAY = 4000;

// DUPLICATE PROTECTION
function claimEvent(event) {
  const id = event.messageID
    ? String(event.messageID)
    : `${event.threadID}:${event.senderID}:${event.body || ""}`;

  if (handledEvents.has(id)) return false;

  handledEvents.set(id, Date.now());

  if (handledEvents.size > 500) {
    handledEvents.delete(handledEvents.keys().next().value);
  }

  return true;
}

function waitForBaby() {
  return new Promise(resolve => setTimeout(resolve, RESPONSE_DELAY));
}

function randomItem(array, key) {
  let index = Math.floor(Math.random() * array.length);

  if (array.length > 1 && LAST.get(key) === index) {
    index = (index + 1) % array.length;
  }

  LAST.set(key, index);
  return array[index];
}

// BOLD FONT
function bold(text) {
  return String(text).replace(/[A-Za-z0-9]/g, char => {
    const code = char.charCodeAt(0);

    if (code >= 65 && code <= 90)
      return String.fromCodePoint(0x1D5D4 + code - 65);

    if (code >= 97 && code <= 122)
      return String.fromCodePoint(0x1D5EE + code - 97);

    if (code >= 48 && code <= 57)
      return String.fromCodePoint(0x1D7EC + code - 48);

    return char;
  });
}

// PRESENCE REPLIES
const PRESENCE = [
  "Yess Baby! Ami ekhanei achi!",
  "Oiiii! Ke amake daklo?",
  "Hajir! Bolun!",
  "Abar amake dakcho?",
  "Dak shunei chole elam!",
  "Baby hajir! Bolo ki dorkar?",
  "Ami ashchi! Bolo ki hoyeche?",
  "Ki holo? Amake dakcho keno?",
  "Ohh! Ami shunchi!",
  "Bolo bolo!",
  "Amar hajiri dite deri holo naki?",
  "Yes! Ki dorkar?",
  "Ke daklo amake?",
  "Ekdom ready! Bolo!",
  "Oi je! Ami achi!",
  "Amake khujchile?",
  "Dak shune chole elam!",
  "Baby online! Bolo!",
  "Ami gayeb hoini!",
  "Hmm! Kichu bolbe?",
  "Ami achi!",
  "Bolo, shunchi!",
  "Ki byapar?",
  "Dak dilei chole asi!",
  "Amake mone poreche?",
  "Bolo ki chao!",
  "Ei je ami!",
  "Amar naam niye dakcho?",
  "Chole elam!",
  "Baby present!"
];

// GENERAL REPLIES
const GENERAL = [
  "Acha, bolo shunchi.",
  "Hmm, bujhlam.",
  "Tai naki? Ektu details bolo.",
  "Besh, tarpor?",
  "Tomar kotha bujhte parchi.",
  "Acha, eta niye ki bhabcho?",
  "Hahaha, bhaloi toh!",
  "Ektu shanto hoye bolo.",
  "Bujhlam, chinta koro na.",
  "Interesting! Tarpor ki holo?",
  "Eita kintu bhalo idea.",
  "Ami shunchi, bolo.",
  "Oho, notun kichu naki?",
  "Thik ache, dekhi ki kora jay.",
  "Besh moja toh!",
  "Ektu explain korle bujhte subidha hobe.",
  "Acha, tomar kotha thik.",
  "Hmm, eta bhabar moto bishoy.",
  "Bolo, ami achi.",
  "Eto serious hoyo na!",
  "Hahaha, tumi o paro!",
  "Acha, bujhechi.",
  "Ki obostha tomar?",
  "Bhalo laglo shune.",
  "Ektu time dao, bhabi.",
  "Oho, besh!",
  "Ami tomar kotha follow korchi.",
  "Tarpor ki korle?",
  "Thik ache, chaliye jao.",
  "Acha, ekhon bujhlam.",
  "Eita abar ki kandho!",
  "Hahaha, moja pailam.",
  "Besh, shundor bolecho.",
  "Ami ekhanei achi.",
  "Bolo, ki help lagbe?",
  "Ektu bhebe dekho.",
  "Kotha ta kharap bolo ni.",
  "Acha, tomar point bujhlam.",
  "Hmm, interesting.",
  "Thik ache, bolo."
];

// OWNER REPLIES
const OWNER_REPLIES = [
  "Oii NirZon! Ki obostha?",
  "Boss esheche! Bolo, ki khobor?",
  "NirZon, ami shunchi.",
  "Bolo Boss, ki korte hobe?",
  "Abar amake check korte ele naki?",
  "Ki obostha tomar?",
  "Boss, ajke ki notun plan?",
  "Onekdin por dekha!",
  "Bolo, tomar kotha shunchi.",
  "NirZon, sob thik ache toh?",
  "Ki khobor Boss?",
  "Tomar kono help lagbe?",
  "Acha Boss, bolo.",
  "NirZon, ajke kemon acho?",
  "Bolo, ami achi."
];

// RIYA QUEEN REPLIES
const WIFE_REPLIES = [
  "Ohh! Amar NirZon-er Queen RiyA bhabi esheche!",
  "Bhabi! Apnar jonno amar dorja sobsomoy khola.",
  "NirZon er cheyeo bhabir adesh beshi guruttopurno!",
  "Queen aschen, sobai ektu side hon!",
  "Bhabi, apni daklei Baby shunte chole ashe.",
  "RiyA Queen! Bolo bhabi, ami ekhanei achi!",
  "Queen! Tomake dekhe bhalo laglo.",
  "Ki hoyeche bhabi? Amake bolo.",
  "Queen, tomar jonno special attention ache.",
  "Oii bhabi! Amake miss korchhile naki?",
  "Bolo bhabi, ki hukum ache?",
  "Queen-er sathe kotha bolar chance miss kori naki!",
  "RiyA, ajke kemon acho?",
  "Tomar Baby ekhanei ache, bhabi.",
  "Bhabi, apnar kotha shunchi.",

  // NIRZON-RELATED REPLIES
  "ভাবি, NirZon ভাই আজকাল কেমন আছেন?",
  "ভাবি, ভাই কি আপনাকে ঠিকমতো সময় দিচ্ছে?",
  "NirZon ভাইয়ের খাওয়া-দাওয়ার খোঁজ রাখছেন তো?",
  "ভাবি, ভাই আবার কাজে ডুবে গিয়ে আপনাকে ভুলে যায়নি তো?",
  "আপনাদের দুজনের ঝগড়া হয়েছে নাকি ভাবি? 🌚",
  "ভাবি, NirZon ভাই আজ আপনাকে হাসিয়েছে তো?",
  "ভাইয়ের মন খারাপ থাকলে একটু সময় দেবেন, ভাবি।",
  "ভাবি, ভাইকে নিজের যত্ন নিতেও বলবেন।",
  "NirZon ভাইয়ের দুষ্টুমি কি এখনো কমেনি?",
  "ভাবি, ভাই কি আজ আপনার কথা শুনেছে?",
  "আপনাদের দুজনের জন্য অনেক শুভকামনা। ❤️",
  "ভাবি, ভাইয়ের কোনো অভিযোগ থাকলে Baby-কে জানাবেন!",
  "NirZon ভাই আপনাকে বিরক্ত করছে, নাকি শান্তিতে আছেন?",
  "ভাবি, ভাইকে আমার পক্ষ থেকে একটু বকা দিয়ে দেবেন!",
  "Queen, King-এর খোঁজখবর ঠিকঠাক রাখছেন তো?"
];

// API REQUEST
async function apiGet(params) {
  const result = await axios.get(`${BASE_API}/baby`, {
    params,
    timeout: 30000
  });

  return result.data;
}

// OWNER / WIFE IDENTITY
async function getIdentity(senderID) {
  try {
    const result = await axios.get(`${BASE_API}/api/identity`, {
      params: { userId: String(senderID) },
      timeout: 10000
    });

    return result.data?.role || "member";
  } catch (error) {
    console.error("Baby identity:", error.message);
    return "member";
  }
}

async function getSpecialReply(senderID) {
  const role = await getIdentity(senderID);

  if (role === "owner")
    return randomItem(OWNER_REPLIES, "owner");

  if (role === "wife")
    return randomItem(WIFE_REPLIES, "wife");

  return randomItem(GENERAL, "general");
}

// GET SENDER NAME
async function getName(api, event) {
  if (event.senderName) return event.senderName;

  return new Promise(resolve => {
    try {
      api.getUserInfo(event.senderID, (err, info) => {
        resolve(
          !err && info?.[event.senderID]?.name
            ? info[event.senderID].name
            : "Member"
        );
      });
    } catch (error) {
      resolve("Member");
    }
  });
}

// COMMON CHAT PARAMETERS
async function getChatParams(api, event, text) {
  return {
    text: String(text),
    senderID: String(event.senderID),
    threadID: String(event.threadID),
    senderName: await getName(api, event)
  };
}

// THREE LINE MESSAGE + MENTION + REPLY REGISTRATION
async function sendThreeLines(api, event, reply, showPresence = true) {
  const name = await getName(api, event);
  const tag = `@${name}`;

  const body = showPresence
    ? `${tag}\n\n${bold(randomItem(PRESENCE, "presence"))}\n${bold(reply)}`
    : `${tag}\n\n${bold(reply)}`;

  return api.sendMessage(
    {
      body,
      mentions: [{
        tag,
        id: String(event.senderID)
      }]
    },
    event.threadID,
    (err, info) => {
      if (err) {
        console.error("Baby send:", err);
        return;
      }

      if (info?.messageID && global.GoatBot?.onReply) {
        global.GoatBot.onReply.set(info.messageID, {
          commandName: "baby",
          messageID: info.messageID
        });
      }
    },
    event.messageID
  );
}

// PARSE QUESTION | ANSWER
function parsePair(value) {
  const index = value.indexOf("|");
  if (index === -1) return null;

  const question = value.slice(0, index).trim();
  const answer = value.slice(index + 1).trim();

  if (!question || !answer) return null;
  return { question, answer };
}

// HELP GUIDE
function helpText() {
  return `
🍼 BABY COMMAND GUIDE

baby hello
AI Chat

baby teach question | answer
Personal Teach

baby teach global question | answer
Global Teach

baby teach amar | introduction
Introduction Teach

baby teach react question | reaction
Reaction data save

baby edit question | new answer
Edit Teach

baby remove question
Remove Teach

baby rm question | index
Remove Specific Reply

baby list question
Show Replies

baby list all
Show Statistics

baby msg
API Status

baby help
Help Guide

NirZon = Owner Special
RiyA = Queen Special

Baby is ready! 🍼
`;
}

module.exports = {
  config: {
    name: "baby",
    aliases: ["bby", "bbz", "omega"],
    version: "5.3.3",
    author: "NirZon",
    countDown: 2,
    role: 0,
    shortDescription: "Baby AI Chat",
    longDescription: "AI Chat, Shared Memory, Teach and Random Auto Reply",
    category: "ai",
    guide: "{pn} help"
  },

  onStart: async function ({ api, event, args }) {
    if (!claimEvent(event)) return;

    const input = args.join(" ").trim();
    const lower = input.toLowerCase();

    try {
      // HELP
      if (lower === "help") {
        return api.sendMessage(helpText(), event.threadID);
      }

      // BABY ALONE
      if (!input) {
        const reply = await getSpecialReply(event.senderID);
        await waitForBaby();
        return sendThreeLines(api, event, reply);
      }

      // API STATUS
      if (lower === "msg") {
        const result = await axios.get(`${BASE_API}/health`, {
          timeout: 10000
        });

        return api.sendMessage(
          result.data.status === "online"
            ? "𝗕𝗮𝗯𝘆 𝗔𝗣𝗜 𝗶𝘀 𝗢𝗡𝗟𝗜𝗡𝗘! 🟢"
            : "𝗕𝗮𝗯𝘆 𝗔𝗣𝗜 𝗢𝗙𝗙𝗟𝗜𝗡𝗘! 🔴",
          event.threadID
        );
      }

      // LIST ALL
      if (lower === "list all") {
        const data = await apiGet({
          list: "all",
          senderID: event.senderID
        });

        return api.sendMessage(
          JSON.stringify(data, null, 2),
          event.threadID
        );
      }

      // LIST QUESTION
      if (lower.startsWith("list ")) {
        const question = input.slice(5).trim();

        const data = await apiGet({
          list: question,
          senderID: event.senderID
        });

        return api.sendMessage(
          `𝗤𝘂𝗲𝘀𝘁𝗶𝗼𝗻: ${bold(question)}\n𝗔𝗻𝘀𝘄𝗲𝗿: ${bold(data.data || "Not found")}`,
          event.threadID
        );
      }

      // TEACH COMMANDS
      if (lower.startsWith("teach ")) {
        let value = input.slice(6).trim();
        let scope = "personal";
        let kind = "normal";
        let parsed;

        if (/^global\s+/i.test(value)) {
          scope = "global";
          value = value.replace(/^global\s+/i, "");
        }

        if (/^amar\s*\|/i.test(value)) {
          kind = "intro";
          const index = value.indexOf("|");
          const answer = value.slice(index + 1).trim();

          if (!answer) {
            return api.sendMessage(
              bold("Usage: baby teach amar | introduction"),
              event.threadID
            );
          }

          parsed = {
            question: "Amar porichoy",
            answer
          };
        } else if (/^react\s+/i.test(value)) {
          kind = "react";
          value = value.replace(/^react\s+/i, "");
          parsed = parsePair(value);
        } else {
          parsed = parsePair(value);
        }

        if (!parsed) {
          return api.sendMessage(
            bold("Usage: baby teach question | answer"),
            event.threadID
          );
        }

        const params = {
          teach: kind === "intro" ? "Amar porichoy" : parsed.question,
          senderID: event.senderID,
          threadID: event.threadID
        };

        if (kind === "react") params.react = parsed.answer;
        else params.reply = parsed.answer;

        if (kind === "intro") params.key = "intro";
        if (scope === "global") params.scope = "global";

        const data = await apiGet(params);

        return api.sendMessage(
          bold(data.message || "Teach Saved!"),
          event.threadID
        );
      }

      // EDIT
      if (lower.startsWith("edit ")) {
        const parsed = parsePair(input.slice(5).trim());

        if (!parsed) {
          return api.sendMessage(
            bold("Usage: baby edit question | new answer"),
            event.threadID
          );
        }

        const data = await apiGet({
          edit: parsed.question,
          replace: parsed.answer,
          senderID: event.senderID
        });

        return api.sendMessage(
          bold(data.message || "Edit complete!"),
          event.threadID
        );
      }

      // REMOVE
      if (lower.startsWith("remove ")) {
        const data = await apiGet({
          remove: input.slice(7).trim(),
          senderID: event.senderID
        });

        return api.sendMessage(
          bold(data.message || "Teach removed!"),
          event.threadID
        );
      }

      // REMOVE SPECIFIC REPLY
      if (lower.startsWith("rm ")) {
        const parsed = parsePair(input.slice(3).trim());

        if (!parsed || !/^\d+$/.test(parsed.answer)) {
          return api.sendMessage(
            bold("Usage: baby rm question | index"),
            event.threadID
          );
        }

        const data = await apiGet({
          remove: parsed.question,
          index: parsed.answer,
          senderID: event.senderID
        });

        return api.sendMessage(
          bold(data.message || "Reply removed!"),
          event.threadID
        );
      }

      // AI CHAT
      const params = await getChatParams(api, event, input);
      const data = await apiGet(params);
      const reply = data.reply || "Ektu somossa hocche, abar bolo!";

      await waitForBaby();
      return sendThreeLines(api, event, reply);

    } catch (error) {
      console.error("Baby command:", error.message);

      return api.sendMessage(
        "𝗕𝗮𝗯𝘆 𝗔𝗣𝗜 𝗲𝗸𝘁𝘂 𝘀𝗹𝗼𝘄! 𝗔𝗯𝗮𝗿 𝗰𝗵𝗲𝘀𝘁𝗮 𝗸𝗼𝗿𝗼.",
        event.threadID
      );
    }
  },

  // REPLY TO BABY'S MESSAGE
  onReply: async function ({ api, event, Reply }) {
    try {
      const text = String(event.body || "").trim();
      if (!text) return;

      const params = await getChatParams(api, event, text);
      const data = await apiGet(params);
      const reply = data.reply || "Ektu somossa hocche, abar bolo!";

      await waitForBaby();

      return sendThreeLines(api, event, reply, false);

    } catch (error) {
      console.error("Baby reply:", error.message);

      return api.sendMessage(
        "𝗕𝗮𝗯𝘆 𝗔𝗣𝗜 𝗲𝗸𝘁𝘂 𝘀𝗹𝗼𝘄!",
        event.threadID
      );
    }
  },

  // AUTOMATIC TRIGGER CHAT
  onChat: async function ({ api, event }) {
    try {
      const body = String(event.body || "").trim();
      if (!body) return;

      const lower = body.toLowerCase();
      const aliases = ["baby", "bby", "bbz", "omi"];

      const prefix = String(
        global.GoatBot?.config?.Prefix ||
        global.GoatBot?.config?.prefix ||
        ""
      );

      // IGNORE PREFIXED COMMANDS
      if (
        prefix &&
        aliases.some(alias =>
          lower.startsWith(`${prefix}${alias} `) ||
          lower === `${prefix}${alias}`
        )
      ) return;

      // FIND TRIGGER AT START OR END
      let trigger = null;
      let triggerPosition = null;

      for (const word of TRIGGERS) {
        const escaped = word.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        );

        const startRegex = new RegExp(
          `^${escaped}(?=$|[\\s.,!?;:])`,
          "i"
        );

        const endRegex = new RegExp(
          `(?:^|[\\s.,!?;:])${escaped}[\\s.,!?;:]*$`,
          "i"
        );

        if (startRegex.test(body)) {
          trigger = word;
          triggerPosition = "start";
          break;
        }

        if (endRegex.test(body)) {
          trigger = word;
          triggerPosition = "end";
          break;
        }
      }

      if (!trigger) return;
      if (!claimEvent(event)) return;

      const escaped = trigger.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      let message = body;

      // REMOVE TRIGGER
      if (triggerPosition === "start") {
        message = message.replace(
          new RegExp(`^${escaped}`, "i"),
          ""
        );
      } else {
        message = message.replace(
          new RegExp(`${escaped}[\\s.,!?;:]*$`, "i"),
          ""
        );
      }

      message = message.trim().replace(/\s+/g, " ");

      // ONLY TRIGGER
      if (!message) {
        const reply = await getSpecialReply(event.senderID);
        await waitForBaby();
        return sendThreeLines(api, event, reply);
      }

      // TRIGGER WITH TEXT
      const params = await getChatParams(api, event, message);
      const data = await apiGet(params);
      const reply = data.reply || "Ektu somossa hocche, abar bolo!";

      await waitForBaby();
      return sendThreeLines(api, event, reply);

    } catch (error) {
      console.error("Baby onChat:", error.message);
    }
  }
};
