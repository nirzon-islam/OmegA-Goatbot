const Canvas = require("canvas");
const { createCanvas } = Canvas;
const path = require("path");
const fs = require("fs");
const os = require("os");

let fonts;
try {
  fonts = require('../../func/font.js');
} catch {
  fonts = { bold: t => t, sansSerif: t => t, monospace: t => t };
}

// Resolve fonts from this fork's actual path: scripts/cmds/assets/font
// Also supports Paste Installer's temporary command directory: /scripts/tmp
const FONT_DIR_CANDIDATES = [
  path.join(__dirname, "assets", "font"),
  path.join(__dirname, "..", "cmds", "assets", "font"),
  path.join(__dirname, "..", "assets", "font")
];
const FONT_DIR = FONT_DIR_CANDIDATES.find(dir => fs.existsSync(dir));

if (FONT_DIR) {
  const registerLudoFont = (file, weight) => {
    const fontPath = path.join(FONT_DIR, file);
    if (fs.existsSync(fontPath)) {
      Canvas.registerFont(fontPath, { family: "LudoFont", weight });
    } else {
      console.warn(`[Ludo] Font file not found: ${fontPath}`);
    }
  };

  // Latin font files available in this fork
  registerLudoFont("BeVietnamPro-Regular.ttf", "normal");
  registerLudoFont("BeVietnamPro-Bold.ttf", "bold");
  registerLudoFont("BeVietnamPro-SemiBold.ttf", "600");

  // Bengali font files available in this fork
  registerLudoFont("NotoSansBengali-Regular.ttf", "normal");
  registerLudoFont("NotoSansBengali-Bold.ttf", "bold");
} else {
  console.warn("[Ludo] Font directory not found. Checked: " + FONT_DIR_CANDIDATES.join(" | "));
}

const COLORS = [
  { key: "red", name: "Red", emoji: "🔴", hex: "#ef4444", dark: "#991b1b", start: 0, home: [[1,6],[2,6],[3,6],[4,6],[5,6],[6,6]], yard: [[2,2],[4,2],[2,4],[4,4]] },
  { key: "yellow", name: "Yellow", emoji: "🟡", hex: "#facc15", dark: "#a16207", start: 13, home: [[8,1],[8,2],[8,3],[8,4],[8,5],[8,6]], yard: [[10,2],[12,2],[10,4],[12,4]] },
  { key: "green", name: "Green", emoji: "🟢", hex: "#22c55e", dark: "#166534", start: 26, home: [[13,8],[12,8],[11,8],[10,8],[9,8],[8,8]], yard: [[10,10],[12,10],[10,12],[12,12]] },
  { key: "blue", name: "Blue", emoji: "🔵", hex: "#3b82f6", dark: "#1e40af", start: 39, home: [[6,13],[6,12],[6,11],[6,10],[6,9],[6,8]], yard: [[2,10],[4,10],[2,12],[4,12]] }
];

const TRACK = [
  [1,6],[2,6],[3,6],[4,6],[5,6],[6,5],[6,4],[6,3],[6,2],[6,1],[6,0],[7,0],[8,0],
  [8,1],[8,2],[8,3],[8,4],[8,5],[9,6],[10,6],[11,6],[12,6],[13,6],[14,6],[14,7],[14,8],
  [13,8],[12,8],[11,8],[10,8],[9,8],[8,9],[8,10],[8,11],[8,12],[8,13],[8,14],[7,14],[6,14],
  [6,13],[6,12],[6,11],[6,10],[6,9],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8],[0,7],[0,6]
];

const SAFE_TRACK_INDEXES = new Set([0,8,13,21,26,34,39,47]);
const activeGames = new Map();

const threadLanguages = new Map();

function getLanguage(threadID) {
  return threadLanguages.get(String(threadID)) || "en";
}

function textFor(lang, en, bn) {
  return lang === "bn" ? bn : en;
}

function getGuide(lang = "en") {
  if (lang === "bn") {
    return [
      "🎲 লুডু রয়্যাল 🎲",
      "কমান্ডসমূহ:",
      "• ludo bot : বটের বিরুদ্ধে ১v১",
      "• ludo bot 3 : ২টি বটের বিরুদ্ধে খেলুন",
      "• ludo bot 4 : ৩টি বটের বিরুদ্ধে খেলুন",
      "• ludo 1v1 @player : ২ জনের খেলা",
      "• ludo 1v1v1 @p2 @p3 : ৩ জনের খেলা",
      "• ludo 1v1v1v1 @p2 @p3 @p4 : ৪ জনের খেলা",
      "• ludo 2v2 @p2 @p3 @p4 : দলীয় খেলা (লাল+সবুজ বনাম হলুদ+নীল)",
      "• ludo stop : খেলা শেষ করুন",
      "• ludo status : বোর্ড দেখুন",
      "• ludo lang bn/en : ভাষা পরিবর্তন",
      "",
      "বাজি (শুধু মাল্টিপ্লেয়ার):",
      "• ludo 1v1 @player 500 : প্রত্যেকে $500 বাজি",
      "• ludo 1v1v1 @p2 @p3 1000 : প্রত্যেকে $1,000 বাজি",
      "• ludo 2v2 @p2 @p3 @p4 2000 : প্রত্যেকে $2,000 বাজি",
      "",
      "খেলার নিয়ম:",
      "1. ডাইস ফেলতে roll লিখে Reply দিন।",
      "2. একাধিক গুটি চালানো গেলে ১, ২, ৩ বা ৪ লিখুন।",
      "3. ৬ উঠলে ঘর থেকে গুটি বের হবে এবং আবার চাল পাবেন।",
      "4. প্রতিপক্ষের ঘরে পড়লে তার গুটি কাটবে।",
      "5. জিততে নিজের ৪টি গুটিই Home-এ নিতে হবে।",
      "★ তারকা চিহ্নিত ঘরে গুটি নিরাপদ থাকে।"
    ].join("\n");
  }
  return [
    "🎲 LUDO ROYAL 🎲",
    "Commands:",
    "• ludo bot : 1v1 against a bot",
    "• ludo bot 3 : play against 2 bots",
    "• ludo bot 4 : play against 3 bots",
    "• ludo 1v1 @player : 2 players",
    "• ludo 1v1v1 @p2 @p3 : 3 players",
    "• ludo 1v1v1v1 @p2 @p3 @p4 : 4 players",
    "• ludo 2v2 @p2 @p3 @p4 : teams (Red+Green vs Yellow+Blue)",
    "• ludo stop : end the game",
    "• ludo status : show the board",
    "• ludo lang bn/en : change language",
    "",
    "Bets (multiplayer only):",
    "• ludo 1v1 @player 500 : 1v1 with $500 bet each",
    "• ludo 1v1v1 @p2 @p3 1000 : 3 players with $1,000 each",
    "• ludo 2v2 @p2 @p3 @p4 2000 : teams with $2,000 each",
    "",
    "How to play:",
    "1. Reply roll to roll the dice.",
    "2. If multiple tokens can move, reply 1, 2, 3, or 4.",
    "3. A 6 lets you bring a token out and roll again.",
    "4. Land on an opponent to capture their token.",
    "5. Bring all 4 tokens home to win.",
    "★ Star squares protect tokens from capture."
  ].join("\n");
}

const GAME_EXPIRE_TIME = 1000 * 60 * 45;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

module.exports = {
  config: {
    name: "ludo",
    aliases: ["ludoking", "ludogame"],
    version: "1.0.0",
    author: "NirZon",
    countDown: 3,
    role: 0,
    description: {
      en: "🎲 Full Ludo game with Canvas board, multiplayer, bots and betting.",
      bn: "🎲 ক্যানভাস বোর্ড, মাল্টিপ্লেয়ার, বট ও বাজিসহ সম্পূর্ণ লুডু গেম।"
    },
    category: "game",
    guide: {
      en: getGuide("en"),
      bn: getGuide("bn")
    }
  },

  onStart: async function ({ message, event, args, api, usersData, commandName }) {
    cleanupExpiredGames();
    const mode = (args[0] || "").toLowerCase();
    const lang = getLanguage(event.threadID);

    if (mode === "lang" || mode === "language") {
      const requested = (args[1] || "").toLowerCase();
      if (!requested) {
        return message.reply(textFor(lang,
          '🌐 Current language: English\nUse "ludo lang bn" or "ludo lang en" to change it.',
          '🌐 বর্তমান ভাষা: বাংলা\nপরিবর্তন করতে "ludo lang en" অথবা "ludo lang bn" লিখুন।'
        ));
      }
      if (!["en", "bn"].includes(requested)) {
        return message.reply(textFor(lang,
          '❌ Invalid language. Use "ludo lang en" or "ludo lang bn".',
          '❌ ভুল ভাষা। "ludo lang en" অথবা "ludo lang bn" ব্যবহার করুন।'
        ));
      }
      threadLanguages.set(String(event.threadID), requested);
      for (const game of activeGames.values()) {
        if (String(game.threadID) === String(event.threadID)) game.lang = requested;
      }
      return message.reply(requested === "bn"
        ? "✅ ভাষা বাংলা করা হয়েছে।"
        : "✅ Language changed to English.");
    }

    if (!mode || mode === "help") {
      return message.reply(getGuide(lang));
    }
    if (mode === "stop" || mode === "end") {
      const ended = endGamesForThread(event.threadID, event.senderID);
      if (!ended) return message.reply(fonts.bold(textFor(lang, "❌ You have no active Ludo game in this group.", "❌ এই গ্রুপে আপনার কোনো চলমান লুডু গেম নেই।")));
      return message.reply(fonts.bold(textFor(lang, `✅ ${ended} game(s) ended.`, `✅ ${ended}টি গেম শেষ হয়েছে।`)));
    }
    if (mode === "status") {
      for (const game of activeGames.values()) {
        if (game.threadID === event.threadID && game.players.some(p => p.id === event.senderID)) {
          await publishState(message, game, textFor(game.lang, "📊 Board status", "📊 বোর্ডের অবস্থা"));
          return;
        }
      }
      return message.reply(fonts.bold(textFor(lang, "❌ You have no active Ludo game in this group.", "❌ এই গ্রুপে আপনার কোনো চলমান লুডু গেম নেই।")));
    }
    await handleLudoStart({ message, event, args, api, usersData, commandName });
  },

  onReply: async function ({ message, event, Reply, commandName, api, usersData }) {
    cleanupExpiredGames();
    const game = activeGames.get(Reply.gameKey || Reply.threadID);
    if (!game || game.id !== Reply.gameID) return;
    if (game.replyMessageID && global.GoatBot?.onReply) {
      global.GoatBot.onReply.delete(game.replyMessageID);
    }
    const current = game.players[game.turnIndex];
    if (!current || current.bot) return;
    if (event.senderID !== current.id) {
      return message.reply({
        body: fonts.bold(textFor(game.lang, `❌ It is not your turn! It is ${current.name}'s turn.`, `❌ এখন আপনার চাল নয়! ${current.name}-এর চাল।`)),
        mentions: [{ id: current.id, tag: current.name }]
      });
    }
    const input = (event.body || "").trim().toLowerCase().replace(/[০-৯]/g, digit =>
      String("০১২৩৪৫৬৭৮৯".indexOf(digit))
    );
    if (input === "stop" || input === "end") {
      if (game.bet > 0) await refundBets(game, usersData);
      endGame(game);
      return message.reply(fonts.bold(textFor(game.lang, "🛑 Ludo game ended. Bets have been refunded.", "🛑 লুডু গেম শেষ হয়েছে। বাজির টাকা ফেরত দেওয়া হয়েছে।")));
    }
    if (game.phase === "roll") {
      if (!["roll", "r", "dice", "🎲"].includes(input)) {
        await publishState(message, game, textFor(game.lang, `${current.name}, reply "roll" to roll the dice.`, `${current.name}, ডাইস ফেলতে "roll" লিখে Reply দিন।`));
        return;
      }
      await rollAndMaybeMove(message, game, api, usersData);
      return;
    }
    if (game.phase === "move") {
      const tokenNumber = parseInt(input.replace(/[^1-4]/g, ""), 10);
      if (!tokenNumber || !game.legalMoves.includes(tokenNumber - 1)) {
        await publishState(message, game, textFor(game.lang, `Choose a movable token: ${game.legalMoves.map(i => i + 1).join(", ")}`, `চাল দেওয়ার গুটি বেছে নিন: ${game.legalMoves.map(i => i + 1).join(", ")}`));
        return;
      }
      applyMove(game, game.turnIndex, tokenNumber - 1, game.lastRoll);
      afterHumanMove(game);
      const winnerMsg = getWinner(game);
      if (winnerMsg) {
        await payoutWinner(game, usersData);
        const finalMsg = buildWinMessage(game, winnerMsg);
        endGame(game);
        await publishState(message, game, finalMsg);
        return;
      }
      await publishState(message, game, textFor(game.lang, `${current.name} moved token ${tokenNumber}.`, `${current.name} ${tokenNumber} নম্বর গুটি চালিয়েছে।`));
      await runBots(message, game, api, usersData);
    }
  }
};

function cleanupExpiredGames() {
  const now = Date.now();
  for (const game of activeGames.values()) {
    if (now - game.updatedAt > GAME_EXPIRE_TIME) endGame(game);
  }
}

function endGame(game) {
  activeGames.delete(game.key);
  if (game.replyMessageID && global.GoatBot?.onReply) {
    global.GoatBot.onReply.delete(game.replyMessageID);
  }
}

function endGamesForThread(threadID, senderID) {
  let ended = 0;
  for (const game of [...activeGames.values()]) {
    const belongsToSender = game.players.some(p => p.id === senderID);
    if (game.threadID === threadID && (!game.botGame || belongsToSender)) {
      endGame(game);
      ended++;
    }
  }
  return ended;
}

async function handleLudoStart({ message, event, args, api, usersData, commandName }) {
  const threadID = event.threadID;
  const senderID = event.senderID;
  const mode = (args[0] || "").toLowerCase();
  const lang = getLanguage(threadID);
  const humanName = await getUserName(api, usersData, senderID, lang);

  let playerCount = 2, teamMode = false, isBotGame = false;
  if (mode === "1v1") playerCount = 2;
  else if (mode === "1v1v1") playerCount = 3;
  else if (mode === "1v1v1v1") playerCount = 4;
  else if (mode === "2v2") { playerCount = 4; teamMode = true; }
  else if (mode === "bot" || mode === "bots") {
    isBotGame = true;
    playerCount = Math.min(4, Math.max(2, parseInt(args[1], 10) || 2));
  }
  else {
    return message.reply(getGuide(lang));
  }

  const mentionedIDs = Object.keys(event.mentions || {}).filter(id => id !== senderID);
  const players = [{ id: senderID, name: humanName, bot: false }];
  for (let i = 0; i < Math.min(mentionedIDs.length, playerCount - 1); i++) {
    const id = mentionedIDs[i];
    const name = await getUserName(api, usersData, id, lang);
    players.push({ id, name, bot: false });
  }
  while (players.length < playerCount) {
    players.push({ id: `bot_${players.length}_${Date.now()}`, name: textFor(lang, `Bot Royal ${players.length}`, `রয়্যাল বট ${players.length}`), bot: true });
  }

  let betAmount = 0;
  if (!isBotGame) {
    const betArg = args.find(a => /^\d+$/.test(a) && parseInt(a,10) > 0);
    if (betArg) betAmount = parseInt(betArg,10);
  }
  if (betAmount > 0) {
    const humanPlayers = players.filter(p => !p.bot);
    for (const p of humanPlayers) {
      const ud = await usersData.get(p.id);
      const balance = ud?.money || 0;
      if (balance < betAmount) {
        return message.reply(fonts.bold(textFor(lang,
          `💸 ${p.name} does not have enough money!\nRequired: $${betAmount.toLocaleString()} | Balance: $${balance.toLocaleString()}`,
          `💸 ${p.name}-এর পর্যাপ্ত টাকা নেই!\nপ্রয়োজন: $${betAmount.toLocaleString()} | ব্যালেন্স: $${balance.toLocaleString()}`
        )));
      }
    }
    for (const p of humanPlayers) {
      const ud = await usersData.get(p.id);
      await usersData.set(p.id, { money: (ud.money || 0) - betAmount });
    }
  }

  const game = createGame(threadID, players, teamMode, commandName, isBotGame, betAmount, lang);
  game.usersData = usersData;
  activeGames.set(game.key, game);

  const betInfo = betAmount > 0
    ? textFor(lang, ` | Prize pool: $${game.pot.toLocaleString()}`, ` | মোট পুরস্কার: $${game.pot.toLocaleString()}`)
    : "";
  const startMsg = textFor(lang,
    `🎲 LUDO ROYAL started!${betInfo} Reply "roll" when it is your turn.`,
    `🎲 লুডু রয়্যাল শুরু হয়েছে!${betInfo} আপনার চাল এলে "roll" লিখে Reply দিন।`
  );
  await publishState(message, game, startMsg);
  await runBots(message, game, api, usersData);
}

function createGame(threadID, rawPlayers, teamMode, commandName, botGame, bet = 0, lang = "en") {
  const players = rawPlayers.map((player, index) => ({
    ...player,
    color: COLORS[index].key,
    emoji: COLORS[index].emoji,
    colorData: COLORS[index],
    tokens: [-1, -1, -1, -1],
    finished: 0,
    team: teamMode ? (index % 2 === 0 ? "A" : "B") : null
  }));
  const key = botGame ? `${threadID}:${rawPlayers[0].id}` : threadID;
  const humanCount = rawPlayers.filter(p => !p.bot).length;
  return {
    id: `${threadID}_${Date.now()}`,
    key, botGame, threadID, commandName, players, teamMode, lang,
    turnIndex: 0, phase: "roll", lastRoll: null, legalMoves: [],
    moveCount: 0, captures: [], log: [textFor(lang, "Game created", "গেম তৈরি হয়েছে")],
    replyMessageID: null, updatedAt: Date.now(), startedAt: Date.now(),
    bet, pot: bet * humanCount, prizePerWinner: 0, usersData: null
  };
}

async function rollAndMaybeMove(message, game, api, usersData) {
  const player = game.players[game.turnIndex];
  const roll = randomDice();
  const legal = getLegalMoves(player, roll);
  game.lastRoll = roll;
  game.legalMoves = legal;
  if (!legal.length) {
    game.log.unshift(textFor(game.lang, `${player.emoji} ${player.name} rolled ${roll} → no moves.`, `${player.emoji} ${player.name} ${roll} তুলেছে → কোনো চাল নেই।`));
    nextTurn(game, roll);
    await publishState(message, game, textFor(game.lang, `${player.emoji} ${player.name} rolled ${diceEmoji(roll)}: no token can move.`, `${player.emoji} ${player.name} ${diceEmoji(roll)} তুলেছে: কোনো গুটি চালানো যাবে না।`));
    await runBots(message, game, api, usersData);
    return;
  }
  if (legal.length === 1) {
    applyMove(game, game.turnIndex, legal[0], roll);
    afterHumanMove(game);
    const winnerMsg = getWinner(game);
    if (winnerMsg) {
      await payoutWinner(game, usersData);
      const finalMsg = buildWinMessage(game, winnerMsg);
      endGame(game);
      await publishState(message, game, finalMsg);
      return;
    }
    await publishState(message, game, textFor(game.lang, `${player.name} rolled ${diceEmoji(roll)} and moved token ${legal[0] + 1}.`, `${player.name} ${diceEmoji(roll)} তুলেছে এবং ${legal[0] + 1} নম্বর গুটি চালিয়েছে।`));
    await runBots(message, game, api, usersData);
    return;
  }
  game.phase = "move";
  await publishState(message, game, textFor(game.lang, `${player.name} rolled ${diceEmoji(roll)}! Choose a token: ${legal.map(i => i+1).join(", ")}`, `${player.name} ${diceEmoji(roll)} তুলেছে! গুটি বেছে নিন: ${legal.map(i => i+1).join(", ")}`));
}

async function runBots(message, game, api, usersData) {
  let safety = 0;
  while (activeGames.get(game.key) === game && game.players[game.turnIndex]?.bot && safety < 30) {
    safety++;
    const player = game.players[game.turnIndex];
    await sleep(900);
    const roll = randomDice();
    const legal = getLegalMoves(player, roll);
    game.lastRoll = roll;
    game.legalMoves = legal;
    if (!legal.length) {
      game.log.unshift(textFor(game.lang, `${player.name} [BOT] rolled ${roll} → no moves.`, `${player.name} [BOT] ${roll} তুলেছে → কোনো চাল নেই।`));
      nextTurn(game, roll);
      continue;
    }
    const tokenIndex = chooseBotMove(game, game.turnIndex, legal, roll);
    applyMove(game, game.turnIndex, tokenIndex, roll);
    const winnerMsg = getWinner(game);
    if (winnerMsg) {
      await payoutWinner(game, usersData);
      const finalMsg = buildWinMessage(game, winnerMsg);
      endGame(game);
      await publishState(message, game, finalMsg);
      return;
    }
    const actionText = textFor(game.lang, `${player.name} rolled ${diceEmoji(roll)} and moved token ${tokenIndex + 1}.`, `${player.name} ${diceEmoji(roll)} তুলেছে এবং ${tokenIndex + 1} নম্বর গুটি চালিয়েছে।`);
    game.log.unshift(textFor(game.lang, `${player.name} [BOT] rolled ${roll} → T${tokenIndex+1}`, `${player.name} [BOT] ${roll} তুলেছে → গুটি ${tokenIndex+1}`));
    nextTurn(game, roll);
    if (!game.players[game.turnIndex]?.bot) {
      await publishState(message, game, textFor(game.lang, `${actionText} Now it is ${game.players[game.turnIndex].name}'s turn.`, `${actionText} এখন ${game.players[game.turnIndex].name}-এর চাল।`));
      return;
    }
  }
  if (activeGames.get(game.key) === game && game.players[game.turnIndex]?.bot === false) {
    await publishState(message, game, textFor(game.lang, `It is ${game.players[game.turnIndex].name}'s turn — reply "roll".`, `এখন ${game.players[game.turnIndex].name}-এর চাল — "roll" লিখে Reply দিন।`));
  }
}

function getLegalMoves(player, roll) {
  const moves = [];
  player.tokens.forEach((progress, index) => {
    if (progress === 57) return;
    if (progress === -1 && roll === 6) moves.push(index);
    else if (progress >= 0 && progress + roll <= 57) moves.push(index);
  });
  return moves;
}

function applyMove(game, playerIndex, tokenIndex, roll) {
  const player = game.players[playerIndex];
  const before = player.tokens[tokenIndex];
  const next = before === -1 ? 0 : before + roll;
  player.tokens[tokenIndex] = next;
  game.moveCount++;
  if (next === 57) {
    player.finished++;
    game.log.unshift(textFor(game.lang, `${player.emoji} ${player.name} brought token ${tokenIndex+1} home.`, `${player.emoji} ${player.name} ${tokenIndex+1} নম্বর গুটি Home-এ নিয়েছে।`));
    return;
  }
  const position = getTokenPosition(player, next);
  if (!position || position.zone !== "track" || SAFE_TRACK_INDEXES.has(position.trackIndex)) return;
  for (const enemy of game.players) {
    if (enemy === player) continue;
    if (game.teamMode && enemy.team === player.team) continue;
    enemy.tokens.forEach((enemyProgress, enemyTokenIndex) => {
      const enemyPos = getTokenPosition(enemy, enemyProgress);
      if (enemyPos && enemyPos.zone === "track" && enemyPos.trackIndex === position.trackIndex) {
        enemy.tokens[enemyTokenIndex] = -1;
        enemy.finished = enemy.tokens.filter(t => t === 57).length;
        game.captures.push({ by: player.name, victim: enemy.name });
        game.log.unshift(textFor(game.lang, `${player.emoji} ${player.name} captured token ${enemyTokenIndex+1} from ${enemy.emoji} ${enemy.name}.`, `${player.emoji} ${player.name}, ${enemy.emoji} ${enemy.name}-এর ${enemyTokenIndex+1} নম্বর গুটি কেটেছে।`));
      }
    });
  }
}

function chooseBotMove(game, playerIndex, legal, roll) {
  const player = game.players[playerIndex];
  let best = legal[0];
  let bestScore = -999;
  for (const tokenIndex of legal) {
    const progress = player.tokens[tokenIndex];
    const next = progress === -1 ? 0 : progress + roll;
    let score = next;
    if (progress === -1) score += 20;
    if (next === 57) score += 100;
    const pos = getTokenPosition(player, next);
    if (pos && pos.zone === "track") {
      for (const enemy of game.players) {
        if (enemy === player) continue;
        if (game.teamMode && enemy.team === player.team) continue;
        if (enemy.tokens.some(t => {
          const enemyPos = getTokenPosition(enemy, t);
          return enemyPos && enemyPos.zone === "track" && enemyPos.trackIndex === pos.trackIndex;
        })) score += 60;
      }
      if (SAFE_TRACK_INDEXES.has(pos.trackIndex)) score += 8;
    }
    if (score > bestScore) { bestScore = score; best = tokenIndex; }
  }
  return best;
}

function nextTurn(game, roll) {
  if (roll !== 6) game.turnIndex = (game.turnIndex + 1) % game.players.length;
  game.phase = "roll";
  game.lastRoll = null;
  game.legalMoves = [];
}

function afterHumanMove(game) {
  nextTurn(game, game.lastRoll);
  game.phase = "roll";
  game.lastRoll = null;
  game.legalMoves = [];
}

function getWinner(game) {
  if (game.teamMode) {
    const teamA = game.players.filter(p => p.team === "A");
    const teamB = game.players.filter(p => p.team === "B");
    if (teamA.every(p => p.tokens.every(t => t === 57))) return textFor(game.lang, "🏆 Red + Green team wins the 2v2 battle!", "🏆 লাল + সবুজ দল ২v২ খেলায় জিতেছে!");
    if (teamB.every(p => p.tokens.every(t => t === 57))) return textFor(game.lang, "🏆 Yellow + Blue team wins the 2v2 battle!", "🏆 হলুদ + নীল দল ২v২ খেলায় জিতেছে!");
    return null;
  }
  const winner = game.players.find(p => p.tokens.every(t => t === 57));
  return winner ? textFor(game.lang, `🏆 ${winner.emoji} ${winner.name} wins Ludo Royal!`, `🏆 ${winner.emoji} ${winner.name} লুডু রয়্যাল জিতেছে!`) : null;
}

function getTokenPosition(player, progress) {
  if (progress < 0) return null;
  if (progress <= 51) {
    const trackIndex = (player.colorData.start + progress) % TRACK.length;
    const [col, row] = TRACK[trackIndex];
    return { zone: "track", trackIndex, col, row };
  }
  if (progress <= 56) {
    const [col, row] = player.colorData.home[progress - 52];
    return { zone: "home", col, row };
  }
  return { zone: "finish", col: 7, row: 7 };
}

async function publishState(message, game, body) {
  game.updatedAt = Date.now();
  const current = game.players[game.turnIndex];
  const details = formatDetails(game, body);
  const oldReplyMessageID = game.replyMessageID;
  if (oldReplyMessageID && global.GoatBot?.onReply) {
    global.GoatBot.onReply.delete(oldReplyMessageID);
  }
  const tmpPath = path.join(os.tmpdir(), `ludo_${game.id}_${Date.now()}.png`);
  try {
    const canvas = renderGame(game, body);
    const buffer = canvas.toBuffer("image/png");
    fs.writeFileSync(tmpPath, buffer);
  } catch (err) {
    console.error("[Ludo] Canvas error:", err);
    return message.reply(fonts.bold(`🎲 ${body}`));
  }
  const mentions = (current && !current.bot && current.id) ? [{ id: current.id, tag: current.name }] : [];
  return new Promise((resolve) => {
    message.reply({ body: details, attachment: fs.createReadStream(tmpPath), mentions }, (err, info) => {
      try { fs.unlinkSync(tmpPath); } catch (_) {}
      if (err) {
        console.error("[Ludo] Send error:", err);
        resolve();
        return;
      }
      game.replyMessageID = info.messageID;
      if (activeGames.get(game.key) === game && current && !current.bot && global.GoatBot?.onReply) {
        global.GoatBot.onReply.set(info.messageID, {
          commandName: game.commandName,
          messageID: info.messageID,
          author: current.id,
          threadID: game.threadID,
          gameKey: game.key,
          gameID: game.id
        });
      }
      resolve();
    });
  });
}

function formatDetails(game, body) {
  const current = game.players[game.turnIndex];
  const bn = game.lang === "bn";
  const mode = game.teamMode
    ? textFor(game.lang, "2v2 Team Battle", "২v২ দলীয় খেলা")
    : textFor(game.lang, `${game.players.length}-player game`, `${game.players.length} জনের খেলা`);
  const elapsed = Math.floor((Date.now() - game.startedAt) / 60000);
  const lines = [`🎲 LUDO ROYAL — ${mode}`];
  lines.push(bn
    ? `⏱ সময়: ${elapsed}মি | চাল: ${game.moveCount} | কাটাকাটি: ${game.captures.length}`
    : `⏱ Time: ${elapsed}m | Moves: ${game.moveCount} | Captures: ${game.captures.length}`);
  if (game.bet > 0) lines.push(bn
    ? `💰 বাজি: প্রত্যেকে $${game.bet.toLocaleString()} | মোট পুরস্কার: $${game.pot.toLocaleString()}`
    : `💰 Bet: $${game.bet.toLocaleString()} each | Prize pool: $${game.pot.toLocaleString()}`);
  lines.push("━━━━━━━━━━━━━━━━━━━━━━");
  if (game.lastRoll) {
    const rollLabel = game.lastRoll === 6
      ? `${diceEmoji(game.lastRoll)} 6 — ${textFor(game.lang, "EXTRA TURN!", "অতিরিক্ত চাল!")}`
      : `${diceEmoji(game.lastRoll)} (${game.lastRoll})`;
    lines.push(textFor(game.lang, `🎲 Last roll: ${rollLabel}`, `🎲 শেষ ডাইস: ${rollLabel}`));
  }
  if (current) {
    if (current.bot) lines.push(textFor(game.lang, `🤖 Turn: ${current.name} [BOT] is thinking...`, `🤖 চাল: ${current.name} [BOT] ভাবছে...`));
    else lines.push(textFor(game.lang, `👑 Turn: @${current.name}`, `👑 চাল: @${current.name}`));
    if (game.phase === "move") lines.push(textFor(game.lang, `⚡ Choose token number: ${game.legalMoves.map(i => i + 1).join(" or ")}`, `⚡ গুটির নম্বর বেছে নিন: ${game.legalMoves.map(i => i + 1).join(" অথবা ")}`));
    else lines.push(textFor(game.lang, `⚡ Reply "roll" to roll the dice`, `⚡ ডাইস ফেলতে "roll" লিখে Reply দিন`));
  }
  lines.push("━━━━━━━━━━━━━━━━━━━━━━");
  lines.push(textFor(game.lang, "📊 Scoreboard:", "📊 স্কোরবোর্ড:"));
  game.players.forEach((p, idx) => {
    const home = p.tokens.filter(t => t === 57).length;
    const onBoard = p.tokens.filter(t => t >= 0 && t < 57).length;
    const inYard = p.tokens.filter(t => t === -1).length;
    const caps = game.captures.filter(c => c.by === p.name).length;
    const bar = "█".repeat(home) + "░".repeat(4 - home);
    const arrow = idx === game.turnIndex ? " ◄" : "";
    lines.push(`${p.emoji} ${p.name}${p.bot ? " [BOT]" : ""}${arrow}`);
    lines.push(bn
      ? `   [${bar}] ${home}/4 Home | বোর্ডে: ${onBoard} | ঘরে: ${inYard}${caps > 0 ? ` | কেটেছে: ${caps}` : ""}`
      : `   [${bar}] ${home}/4 Home | Board: ${onBoard} | Yard: ${inYard}${caps > 0 ? ` | Captures: ${caps}` : ""}`);
  });
  if (game.captures.length > 0) {
    lines.push("━━━━━━━━━━━━━━━━━━━━━━");
    lines.push(textFor(game.lang, "⚔️ Recent captures:", "⚔️ সাম্প্রতিক কাটাকাটি:") + " " +
      game.captures.slice(-3).map(c => `${c.by}→${c.victim}`).join(", "));
  }
  if (game.log.length > 1) {
    lines.push("━━━━━━━━━━━━━━━━━━━━━━");
    lines.push(textFor(game.lang, "📜 Recent moves:", "📜 সাম্প্রতিক চাল:"));
    game.log.slice(1, 4).forEach(l => { if (l) lines.push(`• ${l.slice(0, 90)}`); });
  }
  lines.push("━━━━━━━━━━━━━━━━━━━━━━");
  lines.push(body);
  return lines.join("\n");
}

function randomDice() { return Math.floor(Math.random() * 6) + 1; }
function diceEmoji(n) { return ["", "1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣"][n] || String(n); }

async function payoutWinner(game, usersData) {
  if (!game.bet || !game.pot || !usersData) return;
  let winners = [];
  if (game.teamMode) {
    const teamA = game.players.filter(p => p.team === "A");
    const teamB = game.players.filter(p => p.team === "B");
    if (teamA.every(p => p.tokens.every(t => t === 57))) winners = teamA.filter(p => !p.bot);
    else if (teamB.every(p => p.tokens.every(t => t === 57))) winners = teamB.filter(p => !p.bot);
  } else {
    const winner = game.players.find(p => p.tokens.every(t => t === 57) && !p.bot);
    if (winner) winners = [winner];
  }
  if (winners.length === 0) return;
  const prize = Math.floor(game.pot / winners.length);
  game.prizePerWinner = prize;
  game.winners = winners;
  for (const w of winners) {
    try {
      const ud = await usersData.get(w.id);
      await usersData.set(w.id, { money: (ud.money || 0) + prize });
    } catch (e) { console.error("[Ludo] Payout error:", e); }
  }
}

async function refundBets(game, usersData) {
  if (!game.bet || !usersData) return;
  for (const player of game.players.filter(p => !p.bot)) {
    try {
      const ud = await usersData.get(player.id);
      await usersData.set(player.id, { money: (ud.money || 0) + game.bet });
    } catch (e) { console.error("[Ludo] Bet refund error:", e); }
  }
}

function buildWinMessage(game, baseMsg) {
  if (!game.bet || !game.prizePerWinner) return baseMsg;
  const winnerNames = (game.winners || []).map(w => w.name).join(" & ");
  return textFor(game.lang,
    `${baseMsg}\n💰 ${winnerNames} wins $${game.prizePerWinner.toLocaleString()}!`,
    `${baseMsg}\n💰 ${winnerNames} জিতেছে $${game.prizePerWinner.toLocaleString()}!`
  );
}

async function getUserName(api, usersData, userID, lang = "en") {
  if (userID.startsWith("bot")) return userID;
  try {
    if (usersData?.getName) return await usersData.getName(userID);
    const info = await api.getUserInfo(userID);
    return info[userID]?.name || textFor(lang, "Player", "খেলোয়াড়");
  } catch { return textFor(lang, "Player", "খেলোয়াড়"); }
}

// Canvas rendering helpers. Gameplay logic remains unchanged.

function renderGame(game, banner) {
  const canvas = createCanvas(1200, 1600);
  const ctx = canvas.getContext("2d");
  const boardX = 75, boardY = 175, cell = 70;
  const gradient = ctx.createLinearGradient(0,0,0,1600);
  gradient.addColorStop(0,"#0f172a"); gradient.addColorStop(0.35,"#1e1b4b");
  gradient.addColorStop(0.7,"#1a1035"); gradient.addColorStop(1,"#0f172a");
  ctx.fillStyle=gradient; ctx.fillRect(0,0,1200,1600);
  drawDecorBg(ctx);
  drawTopPanel(ctx, game, banner);
  drawBoardShadow(ctx, boardX, boardY, cell);
  drawLudoGrid(ctx, boardX, boardY, cell);
  drawYards(ctx, boardX, boardY, cell);
  drawHomePaths(ctx, boardX, boardY, cell, game.lang);
  drawArrows(ctx, boardX, boardY, cell);
  drawTokens(ctx, game, boardX, boardY, cell);
  drawInfoPanel(ctx, game);
  return canvas;
}

function drawDecorBg(ctx) {
  ctx.save(); ctx.globalAlpha=0.04;
  for(let i=0;i<6;i++){ let cx=[100,1100,600,200,950,600][i], cy=[150,200,800,1450,1500,1600][i], r=[180,220,300,160,200,250][i];
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fillStyle="#fff"; ctx.fill(); }
  ctx.restore();
}
function drawTopPanel(ctx, game, banner) {
  roundRect(ctx,60,25,1080,135,30,"#ffffff15","#ffffff40",2);
  let diceSize=110, diceX=1090-diceSize, diceY=32;
  drawDiceFace(ctx,diceX,diceY,diceSize,game.lastRoll);
  ctx.fillStyle="#f1f5f9"; ctx.font="bold 46px LudoFont"; ctx.fillText("LUDO ROYAL",85,83);
  let modeLabel=game.teamMode ? textFor(game.lang, "2v2 Team Battle", "২v২ দলীয় খেলা") : `${game.players.length}P`;
  ctx.font="bold 20px LudoFont"; ctx.fillStyle="#a5b4fc"; ctx.fillText(game.lang === "bn" ? `${modeLabel} | ${game.moveCount} চাল | ${game.captures.length} কাটাকাটি` : `${modeLabel} | ${game.moveCount} moves | ${game.captures.length} captures`,85,112);
  let bannerText=banner.length>70?banner.slice(0,68)+"…":banner;
  ctx.font="bold 22px LudoFont"; ctx.fillStyle="#fde68a"; ctx.fillText(bannerText,85,144);
}
function drawDiceFace(ctx,x,y,size,value){
  let r=18; ctx.save(); ctx.shadowColor="#000000aa"; ctx.shadowBlur=14; ctx.shadowOffsetY=6;
  roundRect(ctx,x,y,size,size,r,value===6?"#fef9c3":"#f8fafc",null,0); ctx.restore();
  let borderColor=value===6?"#b45309":value?"#3b82f6":"#64748b";
  roundRect(ctx,x,y,size,size,r,null,borderColor,value===6?5:3);
  if(!value){ ctx.fillStyle="#94a3b8"; ctx.font=`bold ${Math.floor(size*0.52)}px LudoFont`; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText("?",x+size/2,y+size/2+2); ctx.textAlign="left"; ctx.textBaseline="alphabetic"; return; }
  let dotColor=value===6?"#92400e":"#1e3a8a", dotR=size*0.085, p=size*0.26, m=size*0.5;
  let dotMap={1:[[m,m]],2:[[p,p],[size-p,size-p]],3:[[p,p],[m,m],[size-p,size-p]],4:[[p,p],[size-p,p],[p,size-p],[size-p,size-p]],5:[[p,p],[size-p,p],[m,m],[p,size-p],[size-p,size-p]],6:[[p,p*0.85],[size-p,p*0.85],[p,m],[size-p,m],[p,size-p*0.85],[size-p,size-p*0.85]]};
  ctx.fillStyle=dotColor;
  for(let [dx,dy] of (dotMap[value]||[])){ ctx.beginPath(); ctx.arc(x+dx,y+dy,dotR,0,Math.PI*2); ctx.fill(); }
}
function drawBoardShadow(ctx,x,y,cell){ ctx.save(); ctx.shadowColor="#000000aa"; ctx.shadowBlur=35; ctx.shadowOffsetY=20; roundRect(ctx,x-10,y-10,cell*15+20,cell*15+20,34,"#f8fafc",null,0); ctx.restore(); }
function drawLudoGrid(ctx,x,y,cell){ for(let row=0;row<15;row++)for(let col=0;col<15;col++)drawCell(ctx,x,y,cell,col,row,"#fff7ed"); for(let [col,row] of TRACK)drawCell(ctx,x,y,cell,col,row,"#ffffff"); for(let idx of SAFE_TRACK_INDEXES){ let [col,row]=TRACK[idx]; drawCell(ctx,x,y,cell,col,row,"#fef3c7"); drawStar(ctx,x+col*cell+cell/2,y+row*cell+cell/2,18,"#b45309"); } ctx.strokeStyle="#111827"; ctx.lineWidth=3; ctx.strokeRect(x,y,cell*15,cell*15); }
function drawYards(ctx,x,y,cell){ drawYard(ctx,x,y,cell,COLORS[0],0,0); drawYard(ctx,x,y,cell,COLORS[1],9,0); drawYard(ctx,x,y,cell,COLORS[2],9,9); drawYard(ctx,x,y,cell,COLORS[3],0,9); }
function drawYard(ctx,x,y,cell,color,col,row){ let px=x+col*cell, py=y+row*cell; roundRect(ctx,px+10,py+10,cell*6-20,cell*6-20,26,color.hex,color.dark,5); roundRect(ctx,px+62,py+62,cell*4-54,cell*4-54,28,"#fffaf0","#ffffff",4); for(let [tc,tr] of color.yard){ let cx=x+tc*cell+cell/2, cy=y+tr*cell+cell/2; drawTokenBase(ctx,cx,cy,color); } }
function drawHomePaths(ctx,x,y,cell,lang="en"){ for(let color of COLORS)for(let [col,row] of color.home)drawCell(ctx,x,y,cell,col,row,color.hex); ctx.beginPath(); ctx.moveTo(x+6*cell,y+6*cell); ctx.lineTo(x+9*cell,y+6*cell); ctx.lineTo(x+7.5*cell,y+7.5*cell); ctx.closePath(); ctx.fillStyle=COLORS[1].hex; ctx.fill(); ctx.beginPath(); ctx.moveTo(x+9*cell,y+6*cell); ctx.lineTo(x+9*cell,y+9*cell); ctx.lineTo(x+7.5*cell,y+7.5*cell); ctx.closePath(); ctx.fillStyle=COLORS[2].hex; ctx.fill(); ctx.beginPath(); ctx.moveTo(x+9*cell,y+9*cell); ctx.lineTo(x+6*cell,y+9*cell); ctx.lineTo(x+7.5*cell,y+7.5*cell); ctx.closePath(); ctx.fillStyle=COLORS[3].hex; ctx.fill(); ctx.beginPath(); ctx.moveTo(x+6*cell,y+9*cell); ctx.lineTo(x+6*cell,y+6*cell); ctx.lineTo(x+7.5*cell,y+7.5*cell); ctx.closePath(); ctx.fillStyle=COLORS[0].hex; ctx.fill(); ctx.fillStyle="#ffffff"; ctx.font="bold 40px LudoFont"; ctx.textAlign="center"; ctx.fillText(lang === "bn" ? "ঘর" : "HOME",x+7.5*cell,y+7.65*cell); ctx.textAlign="left"; }
function drawArrows(ctx,x,y,cell){ for(let color of COLORS){ let [col,row]=TRACK[color.start]; drawCell(ctx,x,y,cell,col,row,color.hex); ctx.fillStyle="#fff"; ctx.font="bold 28px LudoFont"; ctx.textAlign="center"; ctx.fillText("GO",x+col*cell+cell/2,y+row*cell+cell/2+10); ctx.textAlign="left"; } }
function drawTokens(ctx,game,x,y,cell){ let positions=new Map(); game.players.forEach(player=>{ player.tokens.forEach((progress,tokenIndex)=>{ let col,row; if(progress===-1)[col,row]=player.colorData.yard[tokenIndex]; else{ let pos=getTokenPosition(player,progress); col=pos.col; row=pos.row; } let key=`${col},${row}`; if(!positions.has(key))positions.set(key,[]); positions.get(key).push({player,tokenIndex,progress}); }); }); for(let [key,tokens] of positions.entries()){ let [col,row]=key.split(",").map(Number); tokens.forEach((token,idx)=>{ let offset=getStackOffset(idx,tokens.length); let cx=x+col*cell+cell/2+offset.x, cy=y+row*cell+cell/2+offset.y; drawToken(ctx,cx,cy,token.player.colorData,token.tokenIndex+1,token.progress===57); }); } }
function getStackOffset(index,total){ if(total===1)return{x:0,y:0}; let angle=(Math.PI*2*index)/total; let radius=total>2?15:11; return{x:Math.cos(angle)*radius,y:Math.sin(angle)*radius}; }
function drawInfoPanel(ctx,game){ let panelY=1244,panelH=340; roundRect(ctx,60,panelY,1080,panelH,30,"#ffffff12","#ffffff35",2); let currentIdx=game.turnIndex; game.players.forEach((player,index)=>{ let col=index%2, row=Math.floor(index/2); let cardX=75+col*545, cardY=panelY+12+row*106, cardW=520, cardH=92, isCurrent=index===currentIdx; if(isCurrent){ ctx.save(); ctx.shadowColor=player.colorData.hex; ctx.shadowBlur=20; roundRect(ctx,cardX-3,cardY-3,cardW+6,cardH+6,18,null,player.colorData.hex,4); ctx.restore(); } let cardBg=isCurrent?player.colorData.hex+"55":"#ffffff18"; roundRect(ctx,cardX,cardY,cardW,cardH,16,cardBg,player.colorData.hex+"88",2); let colorDot=player.colorData.hex; ctx.beginPath(); ctx.arc(cardX+22,cardY+22,10,0,Math.PI*2); ctx.fillStyle=colorDot; ctx.fill(); ctx.strokeStyle="#fff"; ctx.lineWidth=2; ctx.stroke(); ctx.fillStyle="#f8fafc"; ctx.font="bold 21px LudoFont"; let nameStr=player.name.slice(0,18)+(player.bot?" BOT":""); ctx.fillText(nameStr,cardX+40,cardY+30); if(isCurrent){ ctx.font="bold 16px LudoFont"; ctx.fillStyle="#fde68a"; ctx.textAlign="right"; ctx.fillText(game.lang === "bn" ? "আপনার চাল" : "YOUR TURN",cardX+cardW-14,cardY+30); ctx.textAlign="left"; } let homeCount=player.tokens.filter(t=>t===57).length, onBoardCount=player.tokens.filter(t=>t>=0&&t<57).length, inYardCount=player.tokens.filter(t=>t===-1).length; ctx.font="18px LudoFont"; ctx.fillStyle="#cbd5e1"; ctx.fillText(game.lang === "bn" ? `ঘর: ${homeCount}/4` : `Home: ${homeCount}/4`,cardX+12,cardY+56); ctx.fillText(game.lang === "bn" ? `বোর্ড: ${onBoardCount}` : `Board: ${onBoardCount}`,cardX+110,cardY+56); ctx.fillText(game.lang === "bn" ? `বাইরে: ${inYardCount}` : `Yard: ${inYardCount}`,cardX+196,cardY+56); let capturesMade=game.captures.filter(c=>c.by===player.name).length; if(capturesMade>0){ ctx.fillStyle="#fca5a5"; ctx.fillText(game.lang === "bn" ? `কেটেছে: ${capturesMade}` : `Captures: ${capturesMade}`,cardX+280,cardY+56); } for(let ti=0;ti<4;ti++){ let prog=player.tokens[ti], dotX=cardX+12+ti*28, dotY=cardY+75, dotR=9; ctx.beginPath(); ctx.arc(dotX,dotY,dotR,0,Math.PI*2); if(prog===57){ ctx.fillStyle="#fde68a"; ctx.fill(); ctx.strokeStyle="#b45309"; ctx.lineWidth=2; ctx.stroke(); ctx.fillStyle="#92400e"; ctx.font="bold 11px LudoFont"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText("H",dotX,dotY+1); ctx.textAlign="left"; ctx.textBaseline="alphabetic"; }else if(prog===-1){ ctx.fillStyle="#334155"; ctx.fill(); ctx.strokeStyle=player.colorData.hex+"88"; ctx.lineWidth=2; ctx.stroke(); }else{ ctx.fillStyle=player.colorData.hex; ctx.fill(); ctx.strokeStyle="#fff"; ctx.lineWidth=2; ctx.stroke(); ctx.fillStyle="#fff"; ctx.font="bold 10px LudoFont"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(String(ti+1),dotX,dotY+1); ctx.textAlign="left"; ctx.textBaseline="alphabetic"; } } }); let logY=panelY+228; roundRect(ctx,75,logY,1065,100,16,"#ffffff0a","#ffffff25",1); ctx.fillStyle="#94a3b8"; ctx.font="bold 16px LudoFont"; ctx.fillText(game.lang === "bn" ? "সাম্প্রতিক চাল" : "RECENT MOVES",100,logY+22); ctx.font="18px LudoFont"; game.log.slice(0,3).forEach((line,i)=>{ ctx.fillStyle=i===0?"#e2e8f0":"#64748b"; let safe=line.trim(); ctx.fillText(safe.slice(0,90),100,logY+46+i*22); }); }
function drawCell(ctx,x,y,cell,col,row,fill){ ctx.fillStyle=fill; ctx.fillRect(x+col*cell,y+row*cell,cell,cell); ctx.strokeStyle="#1f293733"; ctx.lineWidth=1; ctx.strokeRect(x+col*cell,y+row*cell,cell,cell); }
function drawTokenBase(ctx,cx,cy,color){ ctx.save(); ctx.globalAlpha=0.38; ctx.beginPath(); ctx.arc(cx,cy,24,0,Math.PI*2); ctx.fillStyle=color.dark; ctx.fill(); ctx.restore(); }
function drawToken(ctx,cx,cy,color,number,finished){ ctx.save(); ctx.shadowColor="#00000088"; ctx.shadowBlur=8; ctx.shadowOffsetY=5; ctx.beginPath(); ctx.arc(cx,cy,25,0,Math.PI*2); ctx.fillStyle=color.hex; ctx.fill(); ctx.lineWidth=5; ctx.strokeStyle="#fff"; ctx.stroke(); ctx.shadowColor="transparent"; ctx.fillStyle=finished?"#fde68a":"#fff"; ctx.font="bold 21px LudoFont"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(finished?"★":String(number),cx,cy+1); ctx.restore(); ctx.textAlign="left"; ctx.textBaseline="alphabetic"; }
function drawStar(ctx,cx,cy,radius,fill){ ctx.save(); ctx.beginPath(); for(let i=0;i<10;i++){ let angle=-Math.PI/2+(i*Math.PI)/5; let r=i%2===0?radius:radius/2.4; ctx.lineTo(cx+Math.cos(angle)*r,cy+Math.sin(angle)*r); } ctx.closePath(); ctx.fillStyle=fill; ctx.fill(); ctx.restore(); }
function roundRect(ctx,x,y,w,h,r,fill,stroke,lineWidth){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r); ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h); ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r); ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath(); if(fill){ ctx.fillStyle=fill; ctx.fill(); } if(stroke&&lineWidth){ ctx.strokeStyle=stroke; ctx.lineWidth=lineWidth; ctx.stroke(); } }
