const config = {
  name: "tradingguide",
  aliases: ["trguide", "tradeguide", "tg"],
  version: "2.0.0",
  author: "NirZon",
  role: 0,
  countDown: 3,
  shortDescription: "Bilingual Trading Guide",
  category: "economy"
};

module.exports = {
  config,

  onStart: async function ({ api, event, args }) {
    const { threadID, messageID } = event;

    const language = (args[0] || "both").toLowerCase();

    const bangla = 
`╭━━━━━━━━━━━━━━━━━━╮
       📊 TRADING GUIDE 🇧🇩
╰━━━━━━━━━━━━━━━━━━╯

👋 Welcome to NirZon's Binary Trading!

━━━━━━━━━━━━━━━━━━
📈 ১. MARKET SYSTEM
━━━━━━━━━━━━━━━━━━

📊 trade market
লাইভ BTC/USD Market চালু করবে।

🛑 trade stop
Market View বন্ধ করবে।

Market Features:
• প্রতি ৪ সেকেন্ডে Update
• মোট ৩টি Chart Message
• প্রতি Chart-এ ৫ বার Edit
• মোট ১৫টি Successful Edit
• ৩টি Chart শেষে Auto Stop

━━━━━━━━━━━━━━━━━━
🟢 ২. BINARY TRADING
━━━━━━━━━━━━━━━━━━

📈 UP Trade:
trade up <amount> <time>

📉 DOWN Trade:
trade down <amount> <time>

উদাহরণ:
• trade up 500 30s
• trade down 1000 1m
• trade up 2000 2m

⏱️ Expiry:
Minimum: 15 Seconds
Maximum: 5 Minutes

💵 Payout: 75% - 92%

🏆 WIN:
Stake + Profit ফেরত পাবে।

🤝 DRAW:
সম্পূর্ণ Stake ফেরত পাবে।

💸 LOSS:
Invest করা টাকা হারাবে।

⚠️ একসাথে একজনের একটি Trade চলবে।

━━━━━━━━━━━━━━━━━━
🏦 ৩. WALLET SYSTEM
━━━━━━━━━━━━━━━━━━

💰 trade wallet
Main এবং Trading Balance দেখাবে।

💵 Main Balance:
তোমার মূল Bot Balance।

📊 Trading Balance:
শুধুমাত্র Trading-এর জন্য ব্যবহৃত টাকা।

━━━━━━━━━━━━━━━━━━
📥 ৪. DEPOSIT SYSTEM
━━━━━━━━━━━━━━━━━━

Command:
trade deposit <amount>

Example:
trade deposit 5000

• Deposit Instant হবে।
• Main Balance থেকে টাকা কাটবে।
• Trading Balance-এ যোগ হবে।

━━━━━━━━━━━━━━━━━━
📤 ৫. WITHDRAW SYSTEM
━━━━━━━━━━━━━━━━━━

Command:
trade withdraw <amount>

Example:
trade withdraw 3000

• Withdrawal-এর জন্য Admin Approval লাগবে।
• Request করার সময় টাকা Trading Balance থেকে Hold হবে।
• Approve হলে Main Balance-এ যোগ হবে।
• Reject হলে Trading Balance-এ ফেরত আসবে।

━━━━━━━━━━━━━━━━━━
👑 ৬. ADMIN COMMANDS
━━━━━━━━━━━━━━━━━━

📋 Pending Request:
trade requests

✅ Approve:
trade approve <ID>

❌ Reject:
trade reject <ID>

শুধুমাত্র Config-এর Admin-রা ব্যবহার করতে পারবে।

━━━━━━━━━━━━━━━━━━
📚 ৭. ALL COMMANDS
━━━━━━━━━━━━━━━━━━

• trade help
• trade market
• trade stop
• trade wallet
• trade balance
• trade deposit <amount>
• trade withdraw <amount>
• trade up <amount> <time>
• trade down <amount> <time>

ADMIN:
• trade requests
• trade approve <ID>
• trade reject <ID>

━━━━━━━━━━━━━━━━━━
⚠️ IMPORTANT RULES
━━━━━━━━━━━━━━━━━━

1. Trading শুধু Trading Balance ব্যবহার করবে।
2. Main Balance সরাসরি Trade-এ ব্যবহার হবে না।
3. Deposit Automatic।
4. Withdrawal Admin Approval-এর মাধ্যমে হবে।
5. একসাথে একটি Active Trade।
6. এটি Simulated BTC/USD Market।
7. Real Bitcoin Price বা Real Trading নয়।

╭━━━━━━━━━━━━━━━━━━╮
       👨‍💻 DEVELOPER
            NirZon
╰━━━━━━━━━━━━━━━━━━╯

🍀 Happy Trading!`;

    const english =
`╭━━━━━━━━━━━━━━━━━━╮
       📊 TRADING GUIDE 🇬🇧
╰━━━━━━━━━━━━━━━━━━╯

👋 Welcome to NirZon's Binary Trading!

━━━━━━━━━━━━━━━━━━
📈 1. MARKET SYSTEM
━━━━━━━━━━━━━━━━━━

📊 trade market
Start the Live BTC/USD Market.

🛑 trade stop
Stop the Market View.

Market Features:
• Updates every 4 seconds
• 3 Chart Messages
• 5 Edits per Chart
• 15 Successful Edits Total
• Automatically stops after 3 Charts

━━━━━━━━━━━━━━━━━━
🟢 2. BINARY TRADING
━━━━━━━━━━━━━━━━━━

📈 UP Trade:
trade up <amount> <time>

📉 DOWN Trade:
trade down <amount> <time>

Examples:
• trade up 500 30s
• trade down 1000 1m
• trade up 2000 2m

⏱️ Expiry:
Minimum: 15 Seconds
Maximum: 5 Minutes

💵 Payout: 75% - 92%

🏆 WIN:
Receive your stake + profit.

🤝 DRAW:
Your full stake is refunded.

💸 LOSS:
Your invested amount is lost.

⚠️ Only one active trade per user.

━━━━━━━━━━━━━━━━━━
🏦 3. WALLET SYSTEM
━━━━━━━━━━━━━━━━━━

💰 trade wallet
View your Main and Trading Balance.

💵 Main Balance:
Your regular Bot Balance.

📊 Trading Balance:
Money reserved for Trading only.

━━━━━━━━━━━━━━━━━━
📥 4. DEPOSIT SYSTEM
━━━━━━━━━━━━━━━━━━

Command:
trade deposit <amount>

Example:
trade deposit 5000

• Deposit is instant.
• Money is deducted from Main Balance.
• Money is added to Trading Balance.

━━━━━━━━━━━━━━━━━━
📤 5. WITHDRAW SYSTEM
━━━━━━━━━━━━━━━━━━

Command:
trade withdraw <amount>

Example:
trade withdraw 3000

• Admin approval is required.
• Requested money is held from Trading Balance.
• Approved amount goes to Main Balance.
• Rejected amount is refunded to Trading Balance.

━━━━━━━━━━━━━━━━━━
👑 6. ADMIN COMMANDS
━━━━━━━━━━━━━━━━━━

📋 View Pending Requests:
trade requests

✅ Approve Request:
trade approve <ID>

❌ Reject Request:
trade reject <ID>

Only configured Bot Admins can use these commands.

━━━━━━━━━━━━━━━━━━
📚 7. ALL COMMANDS
━━━━━━━━━━━━━━━━━━

• trade help
• trade market
• trade stop
• trade wallet
• trade balance
• trade deposit <amount>
• trade withdraw <amount>
• trade up <amount> <time>
• trade down <amount> <time>

ADMIN:
• trade requests
• trade approve <ID>
• trade reject <ID>

━━━━━━━━━━━━━━━━━━
⚠️ IMPORTANT RULES
━━━━━━━━━━━━━━━━━━

1. Trading uses Trading Balance only.
2. Main Balance cannot be used directly for trades.
3. Deposits are automatic.
4. Withdrawals require Admin Approval.
5. Only one active trade per user.
6. This is a simulated BTC/USD Market.
7. It does not use real Bitcoin prices or real trading.

╭━━━━━━━━━━━━━━━━━━╮
       👨‍💻 DEVELOPER
            NirZon
╰━━━━━━━━━━━━━━━━━━╯

🍀 Happy Trading!`;

    let output;

    if (["bn", "bangla"].includes(language)) {
      output = bangla;
    } else if (["en", "english"].includes(language)) {
      output = english;
    } else {
      output = `${bangla}\n\n${"━".repeat(20)}\n\n${english}`;
    }

    return api.sendMessage(
      output,
      threadID,
      messageID
    );
  }
};
