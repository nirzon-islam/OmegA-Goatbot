const fs = require("fs");
const path = require("path");

const config = {
  name: "trading",
  aliases: ["trade", "tr"],
  version: "2.1.0",
  author: "NirZon",
  role: 0,
  countDown: 3,
  shortDescription: "Binary Trading & Wallet",
  category: "economy"
};

// ======================================
// SETTINGS
// ======================================

const SETTINGS = {
  updateTime: 4000,
  chartPoints: 7,
  chartRows: 5,
  chartWidth: 2,
  marketTime: 60 * 1000,
  minExpiry: 15,
  maxExpiry: 300,
  minPayout: 75,
  maxPayout: 92,
  startPrice: 67420.50,
  maxCharts: 3,
  editsPerChart: 5
};

// ======================================
// GLOBAL DATA
// ======================================

let market = null;

const viewers = new Map();
const activeTrades = new Map();
const locks = new Set();

const REQUEST_FILE = path.join(
  __dirname,
  "trading_withdrawals.json"
);

let withdrawalRequests = [];

try {
  if (fs.existsSync(REQUEST_FILE)) {
    const saved = JSON.parse(
      fs.readFileSync(REQUEST_FILE, "utf8")
    );

    withdrawalRequests = Array.isArray(saved) ? saved : [];
  }
} catch (error) {
  console.error("Withdrawal load error:", error);
}

function saveRequests() {
  const tempFile = REQUEST_FILE + ".tmp";

  fs.writeFileSync(
    tempFile,
    JSON.stringify(withdrawalRequests, null, 2)
  );

  fs.renameSync(tempFile, REQUEST_FILE);
}

// ======================================
// UTILITIES
// ======================================

const random = (min, max) =>
  Math.random() * (max - min) + min;

const priceFormat = n =>
  Math.round(Number(n)).toString();

const moneyFormat = n =>
  Number(n).toFixed(2).replace(/\.00$/, "");

function formatTime(seconds) {
  seconds = Math.max(0, Math.ceil(seconds));

  const m = Math.floor(seconds / 60);
  const s = seconds % 60;

  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function getAdminIDs() {
  const ids = global.GoatBot?.config?.adminBot || [];

  return ids
    .map(id => String(id).trim())
    .filter(id => id && id !== "undefined" && id !== "null");
}

function isAdmin(uid) {
  return getAdminIDs().includes(String(uid));
}

function makeRequestID() {
  return "W" +
    Date.now().toString(36).toUpperCase() +
    Math.random().toString(36).slice(2, 5).toUpperCase();
}

// ======================================
// WALLET SYSTEM
// ======================================

async function getWallet(usersData, uid) {
  const userData = await usersData.get(uid);
  const data = userData?.data || {};

  return {
    main: Number(data.money ?? 100),
    trading: Number(data.tradeMoney ?? 0)
  };
}

async function setWallet(usersData, uid, main, trading) {
  if (
    !Number.isSafeInteger(main) ||
    !Number.isSafeInteger(trading) ||
    main < 0 ||
    trading < 0
  ) {
    throw new Error("Invalid wallet balance");
  }

  await usersData.set(uid, {
    money: main,
    tradeMoney: trading
  }, "data");

  return { main, trading };
}

async function changeWallet(
  usersData,
  uid,
  mainChange,
  tradingChange
) {
  const wallet = await getWallet(usersData, uid);

  return setWallet(
    usersData,
    uid,
    wallet.main + mainChange,
    wallet.trading + tradingChange
  );
}

// ======================================
// MARKET INITIALIZATION
// ======================================

function initMarket() {
  if (market) return;

  let price = SETTINGS.startPrice;
  const history = [];

  for (let i = 0; i < SETTINGS.chartPoints; i++) {
    price += random(-12, 12);
    history.push(price);
  }

  market = {
    price,
    history,
    startedAt: Date.now(),
    volatility: 0
  };

  setInterval(updateMarket, SETTINGS.updateTime);
}

// ======================================
// MARKET MOVEMENT
// ======================================

function updateMarket() {
  if (!market) return;

  const movement = random(-7, 7);

  market.price = Math.max(
    1,
    market.price + movement
  );

  market.volatility = Math.abs(movement);

  market.history.push(market.price);

  if (market.history.length > SETTINGS.chartPoints) {
    market.history.shift();
  }

  for (const [threadID, viewer] of viewers) {
    renderViewer(threadID, viewer);
  }

  for (const [uid, trade] of activeTrades) {
    if (Date.now() >= trade.expiresAt) {
      finishTrade(uid, trade);
    }
  }
}

// ======================================
// PAYOUT ENGINE
// ======================================

function getMarketPayout() {
  const history = market.history;
  let totalMovement = 0;

  for (let i = 1; i < history.length; i++) {
    totalMovement += Math.abs(
      history[i] - history[i - 1]
    );
  }

  const average =
    totalMovement / Math.max(1, history.length - 1);

  const volatility = Math.min(
    1,
    average / (market.price * 0.00015)
  );

  const payout = Math.round(
    SETTINGS.minPayout +
    volatility * 12 +
    random(0, 5)
  );

  return Math.max(
    SETTINGS.minPayout,
    Math.min(SETTINGS.maxPayout, payout)
  );
}

// ======================================
// CONNECTED LINE CHART
// ======================================

function makeLineChart() {
  const values = market.history;
  const rows = SETTINGS.chartRows;
  const width = values.length;

  const highest = Math.max(...values);
  const lowest = Math.min(...values);
  const range = Math.max(highest - lowest, 0.01);

  const positions = values.map(value =>
    Math.round(
      ((highest - value) / range) * (rows - 1)
    )
  );

  const chart = Array.from(
    { length: rows },
    () => Array(width).fill(" ")
  );

  for (let i = 0; i < width; i++) {
    const y = positions[i];
    let symbol = "●";

    if (i > 0) {
      const diff = positions[i] - positions[i - 1];

      if (diff < 0) symbol = "╱";
      else if (diff > 0) symbol = "╲";
      else symbol = "─";
    }

    chart[y][i] = symbol;
  }

  const output = [];

  for (let r = 0; r < rows; r++) {
    const price =
      highest - (range * r / (rows - 1));

    output.push(
      `${priceFormat(price).padStart(7)} │${chart[r].join("")}`
    );
  }

  output.push(
    "         └" + "─".repeat(width)
  );

  return output.join("\n");
}

// ======================================
// MARKET VIEW TEXT
// ======================================

function marketText() {
  const first = market.history[0];
  const last = market.price;
  const change = last - first;

  const trend =
    change >= 0 ? "🟢 BULLISH" : "🔴 BEARISH";

  const remaining =
    SETTINGS.marketTime -
    ((Date.now() - market.startedAt) % SETTINGS.marketTime);

  return (
`╭━━━━━━ BTC/USD ━━━━━━╮

💰 ${priceFormat(last)}
📈 ${change >= 0 ? "+" : ""}${priceFormat(change)}
${trend}

${makeLineChart()}

⏱️ 1M | ${formatTime(remaining / 1000)}

🟢 trade up <amount> <time>
🔴 trade down <amount> <time>

╰━━━━━━━━━━━━━━━━━━╯`
  );
}

// ======================================
// MARKET VIEW ROTATION
// ======================================

function renderViewer(threadID, viewer) {
  if (viewer.editing) return;

  if (
    viewer.chartCount >= SETTINGS.maxCharts &&
    viewer.edits >= SETTINGS.editsPerChart
  ) {
    viewers.delete(threadID);
    return;
  }

  viewer.editing = true;

  if (viewer.edits >= SETTINGS.editsPerChart) {
    if (viewer.chartCount >= SETTINGS.maxCharts) {
      viewer.editing = false;
      viewers.delete(threadID);
      return;
    }

    viewer.api.sendMessage(
      marketText(),
      threadID,
      (err, info) => {
        viewer.editing = false;

        if (err || !info) {
          viewers.delete(threadID);
          return;
        }

        viewer.messageID = info.messageID;
        viewer.chartCount++;
        viewer.edits = 0;
        viewer.errors = 0;
      }
    );

    return;
  }

  viewer.api.editMessage(
    marketText(),
    viewer.messageID,
    err => {
      viewer.editing = false;

      if (err) {
        viewer.errors++;

        if (viewer.errors >= 3) {
          viewers.delete(threadID);
        }
      } else {
        viewer.edits++;
        viewer.errors = 0;
      }
    }
  );
}

function startViewer(api, event) {
  const { threadID, messageID } = event;

  if (viewers.has(threadID)) {
    return api.sendMessage(
      "⚠️ Market already running.",
      threadID,
      messageID
    );
  }

  api.sendMessage(
    marketText(),
    threadID,
    (err, info) => {
      if (err || !info) return;

      viewers.set(threadID, {
        api,
        messageID: info.messageID,
        editing: false,
        errors: 0,
        edits: 0,
        chartCount: 1
      });
    },
    messageID
  );
}

// ======================================
// EXPIRY PARSER
// ======================================

function parseExpiry(value) {
  if (!value) return 60;

  const match = String(value).match(/^(\d+)(s|m)$/i);

  if (!match) return null;

  const amount = Number(match[1]);

  return match[2].toLowerCase() === "m"
    ? amount * 60
    : amount;
}

// ======================================
// TRADE SETTLEMENT
// ======================================

async function finishTrade(uid, trade) {
  if (activeTrades.get(uid) !== trade) return;
  if (trade.settling) return;

  trade.settling = true;

  try {
    const exitPrice = market.price;

    let result = "DRAW";
    let profit = 0;

    if (
      (trade.direction === "UP" &&
        exitPrice > trade.entryPrice) ||
      (trade.direction === "DOWN" &&
        exitPrice < trade.entryPrice)
    ) {
      result = "WIN";
      profit = Math.round(
        trade.amount * trade.payout / 100
      );
    } else if (exitPrice !== trade.entryPrice) {
      result = "LOSS";
    }

    if (result === "WIN") {
      await changeWallet(
        trade.usersData,
        uid,
        0,
        trade.amount + profit
      );
    }

    if (result === "DRAW") {
      await changeWallet(
        trade.usersData,
        uid,
        0,
        trade.amount
      );
    }

    const balance =
      (await getWallet(trade.usersData, uid)).trading;

    activeTrades.delete(uid);

    const output =
`╭━━━━ TRADE RESULT ━━━━╮

Asset: BTC/USD
Direction: ${trade.direction}

Investment: ${trade.amount}$
Payout: ${trade.payout}%

Entry: ${priceFormat(trade.entryPrice)}
Exit: ${priceFormat(exitPrice)}

${result === "WIN" ? "🏆 YOU WIN!" :
  result === "DRAW" ? "🤝 DRAW!" : "💸 YOU LOSE!"}

${result === "WIN"
  ? `Profit: +${profit}$`
  : result === "DRAW"
    ? "Stake Refunded"
    : `Lost: -${trade.amount}$`}

💰 Trading Balance: ${balance}$`;

    trade.api.sendMessage(output, trade.threadID);

  } catch (error) {
    console.error("Settlement error:", error);

    trade.settling = false;

    trade.api.sendMessage(
      "⚠️ Settlement error. Contact admin.",
      trade.threadID
    );
  }
}

// ======================================
// MAIN COMMAND
// ======================================

module.exports.config = config;

module.exports.onStart = async function ({
  api,
  event,
  args,
  usersData
}) {
  const { senderID, threadID, messageID } = event;

  const uid = String(senderID);
  const command = (args[0] || "help").toLowerCase();

  initMarket();

  // MARKET
  if (command === "market" || command === "view") {
    return startViewer(api, event);
  }

  // STOP
  if (command === "stop") {
    if (!viewers.has(threadID)) {
      return api.sendMessage(
        "❌ No active market view.",
        threadID,
        messageID
      );
    }

    viewers.delete(threadID);

    return api.sendMessage(
      "🛑 Market stopped.",
      threadID,
      messageID
    );
  }

  // WALLET
  if (
    command === "wallet" ||
    command === "balance" ||
    command === "bal"
  ) {
    const wallet = await getWallet(usersData, uid);

    return api.sendMessage(
`╭━━━━━━ MY WALLET ━━━━━━╮

💵 Main Balance: ${wallet.main}$
📊 Trading Balance: ${wallet.trading}$

📥 trade deposit <amount>
📤 trade withdraw <amount>`,
      threadID,
      messageID
    );
  }

  // DEPOSIT
  if (command === "deposit") {
    const amount = Number(args[1]);

    if (!Number.isSafeInteger(amount) || amount <= 0) {
      return api.sendMessage(
        "❌ Example: trade deposit 5000",
        threadID,
        messageID
      );
    }

    if (locks.has(uid)) {
      return api.sendMessage(
        "⏳ Please wait.",
        threadID,
        messageID
      );
    }

    locks.add(uid);

    try {
      const wallet = await getWallet(usersData, uid);

      if (wallet.main < amount) {
        return api.sendMessage(
          `❌ Insufficient Main Balance!\nBalance: ${wallet.main}$`,
          threadID,
          messageID
        );
      }

      await changeWallet(
        usersData,
        uid,
        -amount,
        amount
      );

      const updated = await getWallet(usersData, uid);

      return api.sendMessage(
`✅ DEPOSIT SUCCESSFUL

📥 Deposited: ${amount}$

💵 Main: ${updated.main}$
📊 Trading: ${updated.trading}$`,
        threadID,
        messageID
      );

    } catch (error) {
      console.error("Deposit error:", error);

      return api.sendMessage(
        "❌ Deposit failed.",
        threadID,
        messageID
      );

    } finally {
      locks.delete(uid);
    }
  }

  // WITHDRAW
  if (command === "withdraw") {
    const amount = Number(args[1]);

    if (!Number.isSafeInteger(amount) || amount <= 0) {
      return api.sendMessage(
        "❌ Example: trade withdraw 3000",
        threadID,
        messageID
      );
    }

    if (locks.has(uid)) {
      return api.sendMessage(
        "⏳ Please wait.",
        threadID,
        messageID
      );
    }

    locks.add(uid);

    try {
      const wallet = await getWallet(usersData, uid);

      if (wallet.trading < amount) {
        return api.sendMessage(
          `❌ Insufficient Trading Balance!\nBalance: ${wallet.trading}$`,
          threadID,
          messageID
        );
      }

      const requestID = makeRequestID();

      await changeWallet(
        usersData,
        uid,
        0,
        -amount
      );

      const request = {
        id: requestID,
        userID: uid,
        amount,
        status: "pending",
        createdAt: Date.now()
      };

      withdrawalRequests.push(request);

      try {
        saveRequests();
      } catch (error) {
        withdrawalRequests.pop();

        await changeWallet(
          usersData,
          uid,
          0,
          amount
        );

        throw error;
      }

      return api.sendMessage(
`📤 WITHDRAW REQUEST SENT

🆔 ID: ${requestID}
💰 Amount: ${amount}$
⏳ Status: PENDING

Admin approval হলে Main Balance-এ যোগ হবে.`,
        threadID,
        messageID
      );

    } catch (error) {
      console.error("Withdraw error:", error);

      return api.sendMessage(
        "❌ Withdrawal failed.",
        threadID,
        messageID
      );

    } finally {
      locks.delete(uid);
    }
  }

  // ADMIN REQUEST LIST
  if (command === "requests") {
    if (!isAdmin(uid)) {
      return api.sendMessage(
        "⛔ Admin only command.",
        threadID,
        messageID
      );
    }

    const pending = withdrawalRequests.filter(
      request => request.status === "pending"
    );

    if (!pending.length) {
      return api.sendMessage(
        "✅ No pending requests.",
        threadID,
        messageID
      );
    }

    const list = pending.slice(0, 15).map((request, index) =>
      `${index + 1}. ${request.id}\n` +
      `👤 User: ${request.userID}\n` +
      `💰 Amount: ${request.amount}$`
    ).join("\n\n");

    return api.sendMessage(
`📋 WITHDRAWAL REQUESTS

${list}

✅ trade approve <ID>
❌ trade reject <ID>`,
      threadID,
      messageID
    );
  }

  // ADMIN APPROVE / REJECT
  if (command === "approve" || command === "reject") {
    if (!isAdmin(uid)) {
      return api.sendMessage(
        "⛔ Admin only command.",
        threadID,
        messageID
      );
    }

    const requestID = String(args[1] || "").toUpperCase();

    if (!requestID) {
      return api.sendMessage(
        `Usage: trade ${command} <ID>`,
        threadID,
        messageID
      );
    }

    const request = withdrawalRequests.find(
      item => item.id.toUpperCase() === requestID
    );

    if (!request) {
      return api.sendMessage(
        "❌ Request not found.",
        threadID,
        messageID
      );
    }

    if (request.status !== "pending") {
      return api.sendMessage(
        `⚠️ Already ${request.status}.`,
        threadID,
        messageID
      );
    }

    if (locks.has(request.userID)) {
      return api.sendMessage(
        "⏳ User wallet busy. Try again.",
        threadID,
        messageID
      );
    }

    locks.add(request.userID);

    try {
      if (command === "approve") {
        await changeWallet(
          usersData,
          request.userID,
          request.amount,
          0
        );

        request.status = "approved";
      } else {
        await changeWallet(
          usersData,
          request.userID,
          0,
          request.amount
        );

        request.status = "rejected";
      }

      request.processedAt = Date.now();
      request.processedBy = uid;

      try {
        saveRequests();
      } catch (error) {
        request.status = "pending";
        delete request.processedAt;
        delete request.processedBy;

        if (command === "approve") {
          await changeWallet(
            usersData,
            request.userID,
            -request.amount,
            0
          );
        } else {
          await changeWallet(
            usersData,
            request.userID,
            0,
            -request.amount
          );
        }

        throw error;
      }

      api.sendMessage(
`✅ ${command.toUpperCase()} SUCCESSFUL

🆔 Request: ${request.id}
👤 User: ${request.userID}
💰 Amount: ${request.amount}$`,
        threadID,
        messageID
      );

      api.sendMessage(
        command === "approve"
          ? `✅ Your withdrawal of ${request.amount}$ was approved. Amount added to Main Balance.`
          : `❌ Your withdrawal of ${request.amount}$ was rejected. Amount refunded to Trading Balance.`,
        request.userID
      );

    } catch (error) {
      console.error("Withdrawal processing error:", error);

      return api.sendMessage(
        "⚠️ Processing failed. Check logs.",
        threadID,
        messageID
      );

    } finally {
      locks.delete(request.userID);
    }

    return;
  }

  // HELP
  if (command === "help") {
    return api.sendMessage(
`╭━━━━ BINARY TRADING ━━━━╮

📊 MARKET
• trade market
• trade stop

📈 TRADE
• trade up <amount> <time>
• trade down <amount> <time>

💰 WALLET
• trade wallet
• trade balance
• trade deposit <amount>
• trade withdraw <amount>

👑 ADMIN
• trade requests
• trade approve <ID>
• trade reject <ID>

━━━━━━━━━━━━━━━━━━
⏱️ Expiry: 15s - 5m
🔄 Market Update: 4s
📊 Charts: 3
✏️ Edits per Chart: 5
💵 Payout: 75% - 92%

EXAMPLES:
trade up 500 30s
trade down 1000 1m
trade deposit 5000
trade withdraw 3000`,
      threadID,
      messageID
    );
  }

  // UP / DOWN
  if (command === "up" || command === "down") {
    if (locks.has(uid) || activeTrades.has(uid)) {
      return api.sendMessage(
        "⏳ You already have an active trade.",
        threadID,
        messageID
      );
    }

    const amount = Number(args[1]);
    const expiry = parseExpiry(args[2]);

    if (!Number.isSafeInteger(amount) || amount <= 0) {
      return api.sendMessage(
        "❌ Enter a valid amount.\nExample: trade up 500 30s",
        threadID,
        messageID
      );
    }

    if (
      expiry === null ||
      expiry < SETTINGS.minExpiry ||
      expiry > SETTINGS.maxExpiry
    ) {
      return api.sendMessage(
        "❌ Expiry must be between 15s and 5m.",
        threadID,
        messageID
      );
    }

    locks.add(uid);

    try {
      const wallet = await getWallet(usersData, uid);

      if (wallet.trading < amount) {
        return api.sendMessage(
          `❌ Not enough Trading Balance!\nBalance: ${wallet.trading}$\nDeposit: trade deposit <amount>`,
          threadID,
          messageID
        );
      }

      await changeWallet(
        usersData,
        uid,
        0,
        -amount
      );

      const payout = getMarketPayout();

      const trade = {
        api,
        usersData,
        threadID,
        amount,
        direction: command.toUpperCase(),
        entryPrice: market.price,
        payout,
        expiresAt: Date.now() + expiry * 1000,
        settling: false
      };

      activeTrades.set(uid, trade);

      api.sendMessage(
`╭━━━━ TRADE OPENED ━━━━╮

Asset: BTC/USD
Direction: ${trade.direction}

Investment: ${amount}$
Entry: ${priceFormat(trade.entryPrice)}
Expiry: ${expiry}s

💵 Payout: ${payout}%
⌛ Remaining: ${formatTime(expiry)}

Status: WAITING...`,
        threadID,
        messageID
      );

    } catch (error) {
      console.error("Trading error:", error);

      api.sendMessage(
        "❌ Trading error. Try again.",
        threadID,
        messageID
      );

    } finally {
      locks.delete(uid);
    }

    return;
  }

  return api.sendMessage(
    "❌ Unknown command. Type: trade help",
    threadID,
    messageID
  );
};
