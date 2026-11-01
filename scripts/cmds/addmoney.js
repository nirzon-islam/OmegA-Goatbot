module.exports = {
  config: {
    name: "addmoney",
    aliases: ["adm", "givemoney"],
    version: "1.0.0",
    author: "NirZon",
    countDown: 3,
    role: 2,
    shortDescription: "Add virtual money to user",
    longDescription: "Admin can add virtual money to any user.",
    category: "economy",
    guide: {
      en: "{pn} @mention <amount>\n"
        + "{pn} <userID> <amount>\n\n"
        + "Examples:\n"
        + "{pn} @user 5000\n"
        + "{pn} 100012345678 10000"
    }
  },

  onStart: async function ({ message, event, args, usersData }) {
    const targetID = Object.keys(event.mentions || {})[0];

    let uid;
    let amount;

    if (targetID) {
      uid = targetID;
      amount = Number(args[args.length - 1]);
    } else {
      uid = args[0];
      amount = Number(args[1]);
    }

    if (
      !uid ||
      !/^\d{6,}$/.test(String(uid)) ||
      !Number.isSafeInteger(amount) ||
      amount <= 0
    ) {
      return message.reply(
        "⚠️ INVALID COMMAND!\n\n" +
        "📌 Usage:\n" +
        "addmoney @mention <amount>\n" +
        "addmoney <userID> <amount>\n\n" +
        "📝 Example:\n" +
        "addmoney @user 5000\n" +
        "addmoney 100012345678 10000"
      );
    }

    try {
      const userData = await usersData.get(uid);
      const currentMoney = Number(userData?.data?.money ?? 100);

      if (
        !Number.isSafeInteger(currentMoney) ||
        currentMoney < 0 ||
        currentMoney + amount > Number.MAX_SAFE_INTEGER
      ) {
        return message.reply("❌ Invalid balance or amount too large!");
      }

      const newBalance = currentMoney + amount;

      await usersData.set(uid, {
        money: newBalance
      }, "data");

      let name = "User";

      try {
        name = await usersData.getName(uid);
      } catch (e) {}

      return message.reply(
        "✅ MONEY ADDED SUCCESSFULLY!\n\n" +
        `👤 User: ${name}\n` +
        `🆔 UID: ${uid}\n` +
        `💰 Added: $${amount.toLocaleString()}\n` +
        `🏦 New Balance: $${newBalance.toLocaleString()}`
      );

    } catch (error) {
      console.error("AddMoney Error:", error);
      return message.reply(
        "❌ Failed to add money!\nCheck bot console for details."
      );
    }
  }
};

