const axios = require("axios");

const baseApiUrl = async () => {
  return "https://noobs-api.top/dipto";
};

const utils = {
  monospace: (text) => {
    const monospaceMap = {
      A: "𝗔", B: "𝗕", C: "𝗖", D: "𝗗", E: "𝗘",
      F: "𝗙", G: "𝗚", H: "𝗛", I: "𝗜", J: "𝗝",
      K: "𝗞", L: "𝗟", M: "𝗠", N: "𝗡", O: "𝗢",
      P: "𝗣", Q: "𝗤", R: "𝗥", S: "𝗦", T: "𝗧",
      U: "𝗨", V: "𝗩", W: "𝗪", X: "𝗫", Y: "𝗬",
      Z: "𝗭",
      a: "𝗮", b: "𝗯", c: "𝗰", d: "𝗱", e: "𝗲",
      f: "𝗳", g: "𝗴", h: "𝗵", i: "𝗶", j: "𝗷",
      k: "𝗸", l: "𝗹", m: "𝗺", n: "𝗻", o: "𝗼",
      p: "𝗽", q: "𝗾", r: "𝗿", s: "𝘀", t: "𝘁",
      u: "𝘂", v: "𝘃", w: "𝘄", x: "𝘅", y: "𝘆",
      z: "𝘇",
      0: "𝟶", 1: "𝟭", 2: "𝟮", 3: "𝟯", 4: "𝟰",
      5: "𝟱", 6: "𝟲", 7: "𝟳", 8: "𝟴", 9: "𝟵"
    };

    return String(text).split("").map(char => monospaceMap[char] || char).join("");
  },

  realMention: (name, uid, message) => {
    const finalMessage = `༄ ${name} ★\n\n${message}`;
    return {
      body: finalMessage,
      mentions: [{ tag: name, id: uid }]
    };
  },

  normalMention: (name, uid, message) => {
    return {
      body: message,
      mentions: [{ tag: name, id: uid }]
    };
  },

  getRandomGreeting: () => {
    const greetings = [""];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }
};

// ======================================
// CONFIG
// ======================================

module.exports.config = {
  name: "bby",
  aliases: ["baby", "hey", "kire", "bot"],
  version: "2.0.2",
  author: "NirZon",
  countDown: 0,
  role: 0,
  description: "Better than all sim simi api owner by Dipto vai",
  category: "Chatting",
  guide: {
    en:
      "{pn} [anyMessage] OR\n" +
      "teach [YourMessage] - [Reply1], [Reply2], [Reply3]... OR\n" +
      "teach [react] [YourMessage] - [react1], [react2]... OR\n" +
      "remove [YourMessage] OR\n" +
      "rm [YourMessage] - [indexNumber] OR\n" +
      "msg [YourMessage] OR\n" +
      "list OR\n" +
      "all OR\n" +
      "edit [YourMessage] - [NewMessage]"
  }
};

// ======================================
// ON START
// Command handling only
// ======================================

module.exports.onStart = async function ({
  api,
  event,
  args,
  usersData
}) {
  const link = `${await baseApiUrl()}/baby`;
  const xalman = args.join(" ").toLowerCase();
  const uid = event.senderID;

  try {
    if (!args[0]) return;

    // REMOVE
    if (args[0] === "remove") {
      const fina = xalman.replace("remove ", "");

      const dat = (
        await axios.get(
          `${link}?remove=${encodeURIComponent(fina)}&senderID=${uid}`
        )
      ).data.message;

      return api.sendMessage(dat, event.threadID, event.messageID);
    }

    // REMOVE BY INDEX
    if (args[0] === "rm" && xalman.includes("-")) {
      const [fi, f] = xalman.replace("rm ", "").split(/\s*-\s*/);

      const da = (
        await axios.get(
          `${link}?remove=${encodeURIComponent(fi)}&index=${f}`
        )
      ).data.message;

      return api.sendMessage(da, event.threadID, event.messageID);
    }

    // LIST
    if (args[0] === "list") {
      if (args[1] === "all") {
        const data = (
          await axios.get(`${link}?list=all`)
        ).data;

        const limit = parseInt(args[2]) || 100;
        const teacherList = data?.teacher?.teacherList || [];

        const limited = teacherList.slice(0, limit);

        const teachers = await Promise.all(
          limited.map(async (item) => {
            const number = Object.keys(item)[0];
            const value = item[number];

            const name =
              await usersData.getName(number).catch(() => number) ||
              "Not found";

            return { name, value };
          })
        );

        teachers.sort((a, b) => b.value - a.value);

        const output = teachers
          .map((t, i) => `${i + 1}/ ${t.name}: ${t.value}`)
          .join("\n");

        return api.sendMessage(
          `Total Teach = ${teachers.length}\n👑 | List of Teachers of baby\n${output}`,
          event.threadID,
          event.messageID
        );
      } else {
        const d = (
          await axios.get(`${link}?list=all`)
        ).data;

        return api.sendMessage(
          `❇️ | Total Teach = ${d.length || "api off"}\n` +
          `♻️ | Total Response = ${d.responseLength || "api off"}`,
          event.threadID,
          event.messageID
        );
      }
    }

    // MESSAGE LOOKUP
    if (args[0] === "msg") {
      const fuk = xalman.replace("msg ", "");

      const d = (
        await axios.get(
          `${link}?list=${encodeURIComponent(fuk)}`
        )
      ).data.data;

      return api.sendMessage(
        `Message ${fuk} = ${d}`,
        event.threadID,
        event.messageID
      );
    }

    // EDIT
    if (args[0] === "edit") {
      const parts = xalman.split(/\s*-\s*/);

      if (parts.length < 2) {
        return api.sendMessage(
          "❌ | Invalid format! Use edit [YourMessage] - [NewReply]",
          event.threadID,
          event.messageID
        );
      }

      const dA = (
        await axios.get(
          `${link}?edit=${encodeURIComponent(parts[0].replace("edit ", ""))}` +
          `&replace=${encodeURIComponent(parts[1])}&senderID=${uid}`
        )
      ).data.message;

      return api.sendMessage(
        `Changed: ${dA}`,
        event.threadID,
        event.messageID
      );
    }

    // TEACH REACT
    if (args[0] === "teach" && args[1] === "react") {
      const parts = xalman
        .replace("teach react ", "")
        .split(/\s*-\s*/);

      if (parts.length < 2) {
        return api.sendMessage(
          "❌ Use: teach react message - ❤️, 😀",
          event.threadID,
          event.messageID
        );
      }

      const msg = parts[0].trim();
      const reacts = parts[1].trim();

      const res = await axios.get(
        `${link}?teach=${encodeURIComponent(msg)}` +
        `&react=${encodeURIComponent(reacts)}`
      );

      return api.sendMessage(
        `✅ Reacts added: ${res.data.message}`,
        event.threadID,
        event.messageID
      );
    }

    // TEACH INTRO
    if (args[0] === "teach" && args[1] === "amar") {
      const parts = xalman.split(/\s*-\s*/);

      if (parts.length < 2) {
        return api.sendMessage(
          "❌ Use: teach amar message - reply",
          event.threadID,
          event.messageID
        );
      }

      const msg = parts[0].replace("teach amar ", "").trim();
      const reply = parts[1].trim();

      const res = await axios.get(
        `${link}?teach=${encodeURIComponent(msg)}` +
        `&senderID=${uid}` +
        `&reply=${encodeURIComponent(reply)}` +
        `&key=intro`
      );

      return api.sendMessage(
        `✅ Intro reply added: ${res.data.message}`,
        event.threadID,
        event.messageID
      );
    }

    // NORMAL TEACH
    if (args[0] === "teach") {
      const parts = xalman.split(/\s*-\s*/);

      if (parts.length < 2) {
        return api.sendMessage(
          "❌ Use: teach message - reply1, reply2",
          event.threadID,
          event.messageID
        );
      }

      const msg = parts[0].replace("teach ", "").trim();
      const replies = parts[1].trim();

      const res = await axios.get(
        `${link}?teach=${encodeURIComponent(msg)}` +
        `&reply=${encodeURIComponent(replies)}` +
        `&senderID=${uid}` +
        `&threadID=${event.threadID}`
      );

      const teacherName =
        (await usersData.getName(res.data.teacher).catch(() => null)) ||
        "Unknown";

      const outputMessage = utils.monospace(
        `✅ Replies added: ${res.data.message}\n` +
        `👤 Teacher: ${teacherName}\n` +
        `📚 Total Teachs: ${res.data.teachs}`
      );

      return api.sendMessage(
        outputMessage,
        event.threadID,
        event.messageID
      );
    }

    // IMPORTANT:
    // Normal chat response removed from onStart.
    // onChat will handle normal chatting.
    return;

  } catch (e) {
    console.log("BBY onStart Error:", e);

    return api.sendMessage(
      "Check console for error",
      event.threadID,
      event.messageID
    );
  }
};

// ======================================
// ON REPLY
// ======================================

module.exports.onReply = async function ({
  api,
  event,
  Reply
}) {
  try {
    if (event.type === "message_reply") {
      const a = (
        await axios.get(
          `${await baseApiUrl()}/baby?text=${encodeURIComponent(
            (event.body || "").toLowerCase()
          )}&senderID=${event.senderID}`
        )
      ).data.reply;

      const replyText = utils.monospace(a);

      await api.sendMessage(
        replyText,
        event.threadID,
        (error, info) => {
          if (error || !info) return;

          global.GoatBot.onReply.set(info.messageID, {
            commandName: "bby",
            type: "reply",
            messageID: info.messageID,
            author: event.senderID
          });
        },
        event.messageID
      );
    }
  } catch (err) {
    console.error("BBY onReply Error:", err);

    return api.sendMessage(
      `Error: ${err.message}`,
      event.threadID,
      event.messageID
    );
  }
};

// ======================================
// ON CHAT
// Normal chatting only
// ======================================

module.exports.onChat = async function ({
  api,
  event,
  usersData
}) {
  try {
    const body = event.body
      ? event.body.toLowerCase().trim()
      : "";

    const triggers = [
      "baby",
      "bbz",
      "mikasa",
      "hinata",
      "xadika",
      "bby",
      "bot",
      "jan",
      "babu",
      "alya",
      "hey",
      "kire"
    ];

    const matched = triggers.find(trigger =>
      body === trigger || body.startsWith(trigger + " ")
    );

    if (!matched) return;

    const arr = body.slice(matched.length).trim();
    const uid = event.senderID;

    const senderName =
      (await usersData.getName(uid)) || "User";

    const baseReplies = [
      "তোর তো বিয়ে হয় নাই বেবি পাইলি কই-🤦🏻",
      "পরকিয়া করছোছ নাকি শালা-🥲🤧",
      "তোকে ছাড়া বড় মন খারাপ লাগে 💔",
      "তোরে খুব মিস করছি জানিস? 🥺",
      "ডিসটার্ব করিস না 𝗡𝗶𝗿𝗭𝗼𝗻 আদর করতেছে-🌚💋",
      "এত ডাকিস না এমন থাপ্পর দিমু পেন্টে মুইতা দিবি-😾👋🏻",
      "বেবি ডাকিস না 🍼 খাওয়া-😒👍🏻",
      "কি ডাকোস কেন টাকা শেষ নাকি-🌚🤌🏻",
      "পিনিক ধরেছে যখন আমায় না ডেকে লেবু খান তখন🍋🐸",
      "ভিডিও কল দিব নাকি সোনা 🌚🫦",
      "আম্মু ডাক শালা 😾🦶🏻",
      "বেবি না ডাইকা BF কে খুজে দে-🙃🫶🏻",
      "ডাকিস না 𝗡𝗶𝗿𝗭𝗼𝗻 এর সাথে মিটিংয়ে আছি 😒🖐🏻",
      "বস ডাক বস 😾✌🏻",
      "বেবি ডাকিস না পরে কোলে উঠে দুদু খেতে মন চাইবে🌚💋",
      "Amake dakcho baby? 🙂🤌",
      "Tomake Chara kichu Valo lage na 🥲🥹",
      "Tomar naam ki 😒",
      "Amake dakcho ken? Prem korba amar sathe?🫣",
      "Sudhu baby Dake 🥲 Keu Valobashi bole na 😞💔",
      "Prem Kore mon dila nah 😭",
      "Tomar jonnoi to eto sajuguju kora 🥺",
      "Just Ekbar bolo bhalobashi\nami sob diye dibo 🫠💔",
      "Tumi chara ei chat e r keu nai amar 🥹",
      "Hayeee eto sundor kore keu dake nai age 🙈",
      "Tomake miss korchilam, ekhon e dakle 🥰",
      "Prem na korle ken dako bar bar 😤",
      "Ami to tomar e opekkhay chilam 👉👈",
      "Ekhane khali tumar jonno e boshe achi 🥺",
      "Bar bar dakle to premei porbo mone hocche 😳",
      "Emon kore dakle to gole jai ami 🫠",
      "Tomar dak sunle onno kicu mone thake na 🙈"
    ];

    // Empty trigger: random greeting
    if (!arr) {
      const randomReply =
        baseReplies[Math.floor(Math.random() * baseReplies.length)];

      const mentionObj = utils.realMention(
        senderName,
        uid,
        randomReply
      );

      return api.sendMessage(
        mentionObj,
        event.threadID,
        (error, info) => {
          if (error || !info) return;

          global.GoatBot.onReply.set(info.messageID, {
            commandName: "bby",
            type: "reply",
            messageID: info.messageID,
            author: uid
          });
        },
        event.messageID
      );
    }

    // Normal API chat response
    const a = (
      await axios.get(
        `${await baseApiUrl()}/baby?text=${encodeURIComponent(arr)}` +
        `&senderID=${uid}`
      )
    ).data.reply;

    const replyText = utils.monospace(a);

    return api.sendMessage(
      replyText,
      event.threadID,
      (error, info) => {
        if (error || !info) return;

        global.GoatBot.onReply.set(info.messageID, {
          commandName: "bby",
          type: "reply",
          messageID: info.messageID,
          author: uid
        });
      },
      event.messageID
    );

  } catch (err) {
    console.error("BBY onChat Error:", err);
  }
};
