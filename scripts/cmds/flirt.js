const delay = (ms) => new Promise(res => setTimeout(res, ms));

const activeFlirts = new Map();

module.exports = {
config: {
name: "flirt",
version: "1.0.0",
role: 0,
author: "NirZon",
description: "Sender name diye flirting messages pathabe",
category: "fun",
usages: "flirt @mention | flirt stop",
cooldowns: 5,
},

onStart: async function({
message,
event,
args,
api,
usersData
}) {
const senderID = event.senderID;

// Stop a running flirt session
if (args[0]?.toLowerCase() === "stop") {
  const running = activeFlirts.get(senderID);

  if (!running) {
    return message.reply("😅 Tomar flirt off kore dilam..!");
  }

  running.stop = true;
  return message.reply("🛑 Flirt stop request received!");
}

// Prevent duplicate sessions by the same sender
if (activeFlirts.has(senderID)) {
  return message.reply(
    "⏳ Tomar flirt already cholche! Bondho korte `flirt stop` dao."
  );
}

try {
  const mention = Object.keys(event.mentions || {})[0];

  if (!mention) {
    return message.reply(
      "😅 Jar jonno message jabe take -flirt likhe @mention koro..!"
    );
  }

  const name = event.mentions[mention];

  const arraytag = [
    {
      id: mention,
      tag: name
    }
  ];

  let senderName = "Unknown";

  try {
    const senderInfo = await usersData.get(senderID);
    senderName = senderInfo?.name || "Unknown";
  } catch (err) {
    console.error("Sender name error:", err);
  }

  const messages = [
    `${senderName} tomake valobashe ${name}..❤️`,
    `${senderName} sobsomoy tomar pashe ache ${name}..🫶`,
    `${senderName} tomake khub miss kore ${name}..😘`,
    `${senderName} tomake niye vabe ${name}..🌸`,
    `${senderName} chay tumi sobsomoy hasho ${name}..😊`,
    `${senderName} er kache tumi onek special ${name}..💝`,
    `${senderName} tomar jonno sob korte raji ${name}..💌`,
    `${senderName} tomar kotha sobsomoy vabe ${name}..🥰`,
    `${senderName} sudhu tomakei chay ${name}..💖`,
    `${senderName} tomake chara kichu vabte pare na ${name}..😍`,
    `${senderName} tomake sarajibon valobasbe ${name}..💛`,
    `${senderName} tomar jonno opekkha korche ${name}..🌹`,
    `${senderName} er mone tumi onek sundor ${name}..🌸`,
    `${senderName} sobsomoy tomar hashi dekhte chay ${name}..😄`,
    `${senderName} tomake kache pete chay ${name}..🫶`,
    `${senderName} sobsomoy tomar khoj rakhe ${name}..❤️`,
    `${senderName} tomake niye sopno dekhe ${name}..🌙`,
    `${senderName} tomar valobasha chay ${name}..💖`,
    `${senderName} tomake aj o mone korche ${name}..💌`,
    `${senderName} sobsomoy tonar kothai vabche ${name}..🥰`,
    `${senderName} tomake sarakkhon mone rakhe ${name}..💛`,
    `${senderName} tomar songe somoy katate chay ${name}..🌹`,
    `${senderName} tomake prio mone kore ${name}..💝`,
    `${senderName} sudhu matro tomar jonnoi ache ${name}..🫶`,
    `${senderName} tomar sathe haste chay ${name}..😄`,
    `${senderName} tomar khushi chay ${name}..❤️`,
    `${senderName} tomake sobsomoy miss kore ${name}..💌`,
    `${senderName} tomar jonno dua korche ${name}..🌸`,
    `${senderName} tomake pronoy kore dekhte chay ${name}..💖`,
    `${senderName} tomar kache sobsomoy firbe ${name}..💛`,
    `${senderName} er tomake vabtei valo lage ${name}..🥰`,
    `${senderName} tomar songe sopno vag korte chay ${name}..🌙`,
    `${senderName} tomake kokhono vuobe na ${name}..💝`,
    `${senderName} er kache tomar hashi tai shokti ${name}..😄`,
    `${senderName} tomar jonno sobsomoy opekkha korbe ${name}..🌹`,
    `${senderName} tomar valobasha chirokal chaibe ${name}..❤️`,
    `${senderName} er tonar kotha bar bar mone pore ${name}..💌`,
    `${senderName} tomake buke joriye nite chay ${name}..💖`,
    `${senderName} tomar jonno tar hridoy khule rekheche ${name}..💛`,
    `${senderName} tomake chirokal mone rakhbe ${name}..🥰`,
    `${senderName} er tonar valobasha prappo ${name}..🌸`,
    `${senderName} sobsomoy tomar pashe thakbe ${name}..🌙`,
    `${senderName} tomake niye protidin chinta kore ${name}..💝`,
    `${senderName} tomake onek beshi valobashe ${name}..💌`,
    `${senderName} tomake always happy rakhte chay ${name}..😄`,
    `${senderName} tomar jonno sob kichu korte pare ${name}..🌹`,
    `${senderName} tomar songe protiti muhurto upovog korte chay ${name} 🫶`,
    `${senderName} tomay onek sukh dibe ${name}..❤️`,
    `${senderName} tomar valobashay purno ${name}..💖`
  ];

  const run = {
    stop: false
  };

  activeFlirts.set(senderID, run);

  try {
    await message.reply(
      `😎 starting my engine "NirZon style normal flirting" only for ${name}-...`
    );

    for (const msg of messages) {
      if (run.stop) {
        break;
      }

      await delay(3000);

      if (run.stop) {
        break;
      }

      await message.reply({
        body: msg,
        mentions: arraytag
      });
    }

    if (run.stop) {
      await message.reply("🛑 Flirt delivery stopped!");
    } else {
      await message.reply(
        `💘 finally fuel ended ${name}-er proti valobasha delivery complete 😅`
      );
    }
  } finally {
    if (activeFlirts.get(senderID) === run) {
      activeFlirts.delete(senderID);
    }
  }
} catch (err) {
  console.error("Flirt command error:", err);

  try {
    await message.reply("❌ Something is error, please try again");
  } catch (replyErr) {
    console.error("Flirt error reply failed:", replyErr);
  }
}

}
};

