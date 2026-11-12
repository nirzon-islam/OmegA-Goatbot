
const axios = require("axios");

const BASE_API = "https://baby-chat-api-hog5.onrender.com";

const TRIGGERS = [
  "baby", "bbz", "bby", "bot",
  "mikasa", "hinata", "xadika",
  "jan", "babu", "alya", "omega",
  "kakino", "বেবি", "বট", "বাবু", "জান"
];

const LAST = new Map();
const handledEvents = new Map();

const RESPONSE_DELAY = 4000;

// PREVENT DUPLICATE HANDLING
function claimEvent(event) {
  const id = event.messageID
    ? String(event.messageID)
    : `${event.threadID}:${event.senderID}:${event.body || ""}`;

  if (handledEvents.has(id)) return false;

  handledEvents.set(id, Date.now());

  if (handledEvents.size > 500) {
    const oldest = handledEvents.keys().next().value;
    handledEvents.delete(oldest);
  }

  return true;
}

// RESPONSE DELAY
function waitForBaby() {
  return new Promise(resolve =>
    setTimeout(resolve, RESPONSE_DELAY)
  );
}

function randomItem(array, key) {
  let index = Math.floor(Math.random() * array.length);

  if (array.length > 1 && LAST.get(key) === index) {
    index = (index + 1) % array.length;
  }

  LAST.set(key, index);
  return array[index];
}

// SANS-SERIF BOLD FONT CONVERTER
function bold(text) {
  return String(text).replace(/[A-Za-z0-9]/g, char => {
    const code = char.charCodeAt(0);

    if (code >= 65 && code <= 90) {
      return String.fromCodePoint(0x1D5D4 + code - 65);
    }

    if (code >= 97 && code <= 122) {
      return String.fromCodePoint(0x1D5EE + code - 97);
    }

    if (code >= 48 && code <= 57) {
      return String.fromCodePoint(0x1D7EC + code - 48);
    }

    return char;
  });
}

// 30 PRESENCE REPLIES
const PRESENCE = [
  "Yess Baby! 🥺 Ami ekhanei achi!",
  "Oiiii! 👀 Ke amake daklo?",
  "Hajir madam! 😌 Bolun!",
  "Areey! 😭 Abar amake dakcho?",
  "Uff! 😘 Dak shunei chole elam!",
  "Yepp! 💗 Baby hajir!",
  "Ami ashchi! Bolo ki dorkar?",
  "Ki holo? Amake dakcho keno? 👀",
  "Ohhh! 🥹 Ami shunchi!",
  "Bolo bolo! Kan khola ache! 👂",
  "Amar hajiri dite deri holo naki? 😏",
  "Yes dear! 💕 Ki dorkar?",
  "Ke daklo amar mishti Baby-ke? 😚",
  "Ekdom ready! 🔥 Bolo!",
  "Oi je! 🙋 Ami achi!",
  "Amake ki khujchile? 😌",
  "Ahaaa! Dak shune mon bhalo holo! 💗",
  "Baby online! 🍼 Bolo ki korbo?",
  "Are baba! 😭 Ami gayeb hoini!",
  "Hmmmm! 👀 Kichu bolbe?",
  "Ami achi, ami achi! 😭",
  "Bolo master! 😎",
  "Ki byapar bolo to? 🤭",
  "Dak dilei chole asi! 💕",
  "Oho! Amake mone poreche? 😏",
  "Yesss! Bolo ki chao!",
  "Ei je ami! 🥰",
  "Amar naam niye dakcho naki? 👀",
  "Kothay chilam ar kothay chole elam! 😭",
  "Baby present! 💗 Bolo!"
];

// 40 GENERAL REPLIES
const GENERAL = [
  "Awww! 🥺 Eto mishti kotha bolo na!",
  "Tomar sathe kotha bolte bhalo lage! 💗",
  "Aj mood ta besh romantic! 🌸",
  "Ektu ador pabe? 🥺",
  "Tumi bolle sob kichu shuni! 💕",
  "Mon bhalo kore dewar moto kotha bolo! 😚",
  "Aj ektu beshi mishti hoye thaki! 🥰",
  "Tomar kothay alada ekta maya ache! 💖",
  "Ahaaa! Emon kotha shunle hashi pay! 😍",
  "Tomake ektu jalabo aj! 🤭",
  "Tomar mathay ki buddhi ache naki chuti niyecho? 😂",
  "Are bapre! Ektu aste bolo! 🤣",
  "Tomake dekhe mone hoy cha er dokan khule gelo! ☕",
  "Eto paknami koro keno? 😭",
  "Tomar jonno alada dhorjo lage! 🤣",
  "Aj raate kintu tomake shohoje ghumate debo na! 😈",
  "Kache aso… kane kane ekta secret bolbo! 😏",
  "Tomar ei durbolota jaygata ami jani… ❤️‍🔥",
  "Aj kintu adorer dose ektu beshi hobe! 😈",
  "Chokhe chokh rakho… aj amar mood alada! 🔥",
  "Amake pawa eto sohoj na! 😎",
  "Amar attitude bujhe kotha bolo! 😏",
  "Aj ami karo kothay poroya debo na! 😌",
  "Beshi badmashi korle kintu jhamela! 😉",
  "Tomar attitude dekhe amar hashi pay! 😂",
  "Aj amar mood ekdom bedom mejaji… samlate parbe? 😈",
  "Kache aso, aj ektu beshi ador korbo! ❤️‍🔥",
  "Aj raate ghum noy, dushtumi korar plan! 😉",
  "Ekbar jodi kache pao, shohoje charbo na! 😏",
  "Aj amar mathay kintu bhalo kichu ashche! 🔥",
  "Eto rate amar kotha mone pore? Naki bichanay giye eka eka amake miss korchis? 😏",
  "Ajke tor sathe kotha bolle ghum haram howar chance beshi! 🌚",
  "Shudhu kiss chaile hobe? Age bol, kotota dushtu hote parish! 💋",
  "Tor imagination jodi amar moto hoy, tahole ajker rat ta interesting hobe! 😈",
  "Eto gorom kotha bolish na, amar flirt mode on hoye jabe! 🔥",
  "Amake kache pele prothome ki korti? Lojja na kore bol! 😉",
  "Tor chokher bhasha dekhei bujhi, mukhe bolte na para koto kotha jome ache! 🌚",
  "Ajke romantic mood na adult mood? Age category ta clear kor! 🤭",
  "Ekta kiss diye shuru korbi, naki amake puro rat jagiye rakhbi? 💋",
  "Tor sathe eka thakle bhodro thaka amar jonno challenge hoye jabe! 😈"
];

// OWNER SPECIAL
const OWNER_REPLIES = [
  "Areee! Amar Boss NirZon esheche! 😭❤️",
  "NirZon dakle Baby ki ar byasto thakte pare? 👑",
  "My favourite Boss is here! 🥺",
  "NirZon er jonno Baby-r special mood activated! 😏",
  "Bakira wait koro, amar Boss age priority! 👑",
  "Boss! 🥺 Bolo, tomar Baby shunchhe!",
  "Ki obostha amar favourite Owner? 😎",
  "NirZon! Eto khon por amake mone porlo? 😒❤️",
  "Bolo Boss, ajke ki notun mission ache?",
  "Tomar Baby kintu tomar jonnoi always ready! 🫡",
  "Abar amake check korte ele naki? 😂",
  "Boss, tomar sathe ektu golpo korte chai! 🥹",
  "Ki chai tomar? Order dao, dekhi ki korte pari! 😏",
  "Tumi thakle amar ar kono tension nei! ❤️",
  "Oii Boss! Ajke amake ektu beshi attention dao na! 🥺"
];

// RIYA QUEEN SPECIAL
const WIFE_REPLIES = [
  "Ohh! Amar NirZon-er Queen RiyA bhabi esheche! 👑🥹",
  "Bhabi! Apnar jonno amar dorja sobsomoy khola! 💗",
  "NirZon er cheyeo bhabir adesh beshi guruttopurno! 🤭",
  "Queen aschen, sobai ektu side hon! 😌👑",
  "Bhabi, apni daklei Baby-r mood change! 😘",
  "RiyA Queen! 🥹 Bolo, tomar Baby ekhanei ache!",
  "Awww Queen! Tomake dekhe amar mood fresh hoye gelo! 💗",
  "Ki hoyeche RiyA? Amake bolo, ami shunchhi! 🥺",
  "Queen, ajke tomar jonno special attention reserved! 👑",
  "Oii RiyA! Amake eto miss korchhile naki? 🤭",
  "Tomar ekta dak-i amar jonno enough, Queen! 😘",
  "Bolo my Queen, ajke ki hukum ache? 💕",
  "Queen-er sathe kotha bolar chance miss kori naki! 😭",
  "RiyA, ajke tomar sathe ektu beshi golpo korte chai! 🥰",
  "Tomar Baby always tomar side-e ache, Queen! ❤️"
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
    const result = await axios.get(
      `${BASE_API}/api/identity`,
      {
        params: { userId: String(senderID) },
        timeout: 10000
      }
    );

    return result.data?.role || "member";
  } catch (error) {
    console.error("Baby identity:", error.message);
    return "member";
  }
}

async function getSpecialReply(senderID) {
  const role = await getIdentity(senderID);

  if (role === "owner") {
    return randomItem(OWNER_REPLIES, "owner");
  }

  if (role === "wife") {
    return randomItem(WIFE_REPLIES, "wife");
  }

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
  const senderName = await getName(api, event);

  return {
    text: String(text),
    senderID: String(event.senderID),
    threadID: String(event.threadID),
    senderName
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
      mentions: [
        {
          tag,
          id: String(event.senderID)
        }
      ]
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

━━━━━━━━━━━━━━━━━━
💬 AI CHAT
━━━━━━━━━━━━━━━━━━

baby hello
Example: baby kemon acho?
কাজ: AI-এর সঙ্গে কথা বলবে।

━━━━━━━━━━━━━━━━━━
📚 TEACH COMMANDS
━━━━━━━━━━━━━━━━━━

baby teach question | answer
কাজ: Personal Teach।

Example:
baby teach tomar nam ki | Amar naam Baby

baby teach global question | answer
কাজ: সবার জন্য Global Teach।

Example:
baby teach global good morning | Shuvo sokal

baby teach amar | introduction
কাজ: পরিচয় শেখানো।

Example:
baby teach amar | Ami NirZon

baby teach react question | reaction
কাজ: Reaction data সংরক্ষণ।

Note: Actual Messenger reaction এখনো যুক্ত নয়।

━━━━━━━━━━━━━━━━━━
✏️ EDIT / REMOVE
━━━━━━━━━━━━━━━━━━

baby edit question | new answer
কাজ: উত্তর পরিবর্তন।

baby remove question
কাজ: Teach মুছে ফেলা।

baby rm question | index
কাজ: নির্দিষ্ট উত্তর মুছে ফেলা।

Example:
baby rm hello | 2

━━━━━━━━━━━━━━━━━━
📋 LIST
━━━━━━━━━━━━━━━━━━

baby list question
কাজ: প্রশ্নের উত্তর দেখাবে।

baby list all
কাজ: Teach statistics দেখাবে।

━━━━━━━━━━━━━━━━━━
⚙️ OTHER
━━━━━━━━━━━━━━━━━━

baby msg
কাজ: API status।

baby help
কাজ: এই guide।

━━━━━━━━━━━━━━━━━━
💗 REPLY FORMAT
━━━━━━━━━━━━━━━━━━

1. Clickable Messenger mention
2. Random presence reply (initial trigger only)
3. Random main reply

NirZon = Owner Special
RiyA = Queen Special
Others = General Replies

𝗕𝗮𝗯𝘆 𝗶𝘀 𝗿𝗲𝗮𝗱𝘆! 🍼
`;
}

module.exports = {
  config: {
    name: "baby",
    aliases: ["bby", "bbz", "omega"],
    version: "5.3.2",
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
        return api.sendMessage(
          helpText(),
          event.threadID
        );
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
        }

        else if (/^react\s+/i.test(value)) {
          kind = "react";
          value = value.replace(/^react\s+/i, "");
          parsed = parsePair(value);
        }

        else {
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

        if (kind === "react") {
          params.react = parsed.answer;
        } else {
          params.reply = parsed.answer;
        }

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

      const reply = data.reply ||
        "Ektu somossa hocche, abar bolo! 🥺";

      await waitForBaby();

      return sendThreeLines(api, event, reply);

    } catch (error) {
      console.error("Baby command:", error.message);

      return api.sendMessage(
        "𝗕𝗮𝗯𝘆 𝗔𝗣𝗜 𝗲𝗸𝘁𝘂 𝘀𝗹𝗼𝘄! 😭 𝗔𝗯𝗮𝗿 𝗰𝗵𝗲𝘀𝘁𝗮 𝗸𝗼𝗿𝗼.",
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

      const reply = data.reply ||
        "Ektu somossa hocche, abar bolo! 🥺";

      await waitForBaby();

      return sendThreeLines(
        api,
        event,
        reply,
        false
      );

    } catch (error) {
      console.error("Baby reply:", error.message);

      return api.sendMessage(
        "𝗕𝗮𝗯𝘆 𝗔𝗣𝗜 𝗲𝗸𝘁𝘂 𝘀𝗹𝗼𝘄! 😭",
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

      if (
        prefix &&
        aliases.some(alias =>
          lower.startsWith(`${prefix}${alias} `) ||
          lower === `${prefix}${alias}`
        )
      ) {
        return;
      }

      const trigger = TRIGGERS.find(word => {
        const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

        return new RegExp(
          `(^|\\s)${escaped}(\\s|$|[!?.,])`,
          "i"
        ).test(lower);
      });

      if (!trigger) return;

      if (!claimEvent(event)) return;

      const escaped = trigger.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      const message = body
        .replace(
          new RegExp(`(^|\\s)${escaped}(?=\\s|$|[!?.,])`, "i"),
          " "
        )
        .trim()
        .replace(/\s+/g, " ");

      // ONLY TRIGGER
      if (!message) {
        const reply = await getSpecialReply(event.senderID);

        await waitForBaby();

        return sendThreeLines(api, event, reply);
      }

      // TRIGGER WITH TEXT
      const params = await getChatParams(api, event, message);
      const data = await apiGet(params);

      const reply = data.reply ||
        "Ektu somossa hocche, abar bolo! 🥺";

      await waitForBaby();

      return sendThreeLines(api, event, reply);

    } catch (error) {
      console.error("Baby onChat:", error.message);
    }
  }
};
