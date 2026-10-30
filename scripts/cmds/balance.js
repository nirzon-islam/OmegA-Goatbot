
const fs = require("fs-extra");
const path = require("path");
const crypto = require("crypto");
const { createCanvas } = require("@napi-rs/canvas");

function formatBalance(num) {
  num = Number(num) || 0;
  if (num >= 1e12) return (num / 1e12).toFixed(2) + "t";
  if (num >= 1e9) return (num / 1e9).toFixed(2) + "b";
  if (num >= 1e6) return (num / 1e6).toFixed(2) + "m";
  if (num >= 1e3) return (num / 1e3).toFixed(2) + "k";
  return num.toFixed(0);
}

function getTargetID({ event, args }) {
  if (event.messageReply) {
    return event.messageReply.senderID;
  }

  if (event.mentions && Object.keys(event.mentions).length > 0) {
    return Object.keys(event.mentions)[0];
  }

  const lastArg = args[args.length - 1];

  if (lastArg && /^\d{6,}$/.test(lastArg)) {
    return lastArg;
  }

  return null;
}

module.exports = {
  config: {
    name: "balance",
    aliases: ["bal"],
    version: "2.0.0",
    author: "NirZon",
    countDown: 5,
    role: 0,
    shortDescription: "View GOAT BANK virtual card",
    longDescription: "View your virtual bank card and transfer money.",
    category: "economy",
    guide: {
      en: "{pn}: View your card\n{pn} @tag: View another user's card\n{pn} transfer <amount> @tag: Transfer money"
    }
  },

  onStart: async function ({ message, usersData, event, args }) {
    try {
      const { senderID } = event;

      // =================================
      // MONEY TRANSFER SYSTEM
      // =================================

      if (args[0]?.toLowerCase() === "transfer") {
        const amount = Number(args[1]);

        if (!Number.isSafeInteger(amount) || amount <= 0) {
          return message.reply(
            "❌ Please enter a valid amount!\nExample: -balance transfer 1000 @friend"
          );
        }

        const targetID = getTargetID({
          event,
          args: args.slice(2)
        });

        if (!targetID) {
          return message.reply(
            "❌ Mention someone or reply to their message to transfer money."
          );
        }

        if (targetID === senderID) {
          return message.reply(
            "❌ You can't transfer money to yourself."
          );
        }

        const senderData = await usersData.get(senderID);
        const senderBalance = Number(senderData?.data?.money || 0);

        if (senderBalance < amount) {
          return message.reply(
            `❌ Insufficient balance!\n💰 Your Balance: $${formatBalance(senderBalance)}`
          );
        }

        const receiverData = await usersData.get(targetID);
        const receiverBalance = Number(receiverData?.data?.money || 0);

        const newSenderBalance = senderBalance - amount;
        const newReceiverBalance = receiverBalance + amount;

        // Update sender and receiver using Daily's data.money field
        await usersData.set(
          senderID,
          { money: newSenderBalance },
          "data"
        );

        try {
          await usersData.set(
            targetID,
            { money: newReceiverBalance },
            "data"
          );
        } catch (error) {
          // Refund sender if receiver update fails
          await usersData.set(
            senderID,
            { money: senderBalance },
            "data"
          );
          throw error;
        }

        const senderName = await usersData.getName(senderID);
        const receiverName = await usersData.getName(targetID);

        return message.reply(
`╭━━━〔 💸 TRANSFER SUCCESS 〕━━━╮
┃ 👤 From: ${senderName}
┃ 👥 To: ${receiverName}
┃ 💵 Amount: $${formatBalance(amount)}
┣━━━━━━━━━━━━━━━━━━━━━━
┃ 💰 Your New Balance:
┃ $${formatBalance(newSenderBalance)}
╰━━━━━━━━━━━━━━━━━━━━━━╯

✦ GOAT BANK | Powered by NirZon`
        );
      }

      // =================================
      // VIEW BANK CARD
      // =================================

      const targets = Object.keys(event.mentions || {}).length
        ? Object.keys(event.mentions)
        : event.messageReply
          ? [event.messageReply.senderID]
          : [senderID];

      const cacheDir = path.join(__dirname, "cache");
      await fs.ensureDir(cacheDir);

      for (const uid of targets) {
        const userData = await usersData.get(uid);

        // IMPORTANT: Same balance field used by daily.js
        const balance = Number(userData?.data?.money || 0);

        let name = userData.name || "GOAT MEMBER";

        if (event.mentions?.[uid]) {
          name = event.mentions[uid].replace("@", "") || name;
        } else if (usersData.getName) {
          name = await usersData.getName(uid) || name;
        }

        // Permanent UID-based 16-digit card number
        const hash = crypto
          .createHash("sha256")
          .update(String(uid))
          .digest("hex");

        const cardNumber = (
          BigInt("0x" + hash) % 10000000000000000n
        ).toString().padStart(16, "0");

        // Card tiers
        let tier;

        if (balance >= 100000) {
          tier = {
            name: "GOAT ELITE",
            subtitle: "ULTIMATE MEMBER",
            colors: ["#171717", "#75551c", "#f8d879", "#fff0b0"],
            accent: "#ffe7a0"
          };
        } else if (balance >= 50000) {
          tier = {
            name: "DIAMOND",
            subtitle: "DIAMOND MEMBER",
            colors: ["#090b22", "#30235d", "#9c70ff", "#e2caff"],
            accent: "#c9a5ff"
          };
        } else if (balance >= 20000) {
          tier = {
            name: "GOLD",
            subtitle: "GOLD MEMBER",
            colors: ["#38200a", "#9a5c13", "#f4bd4f", "#fff0a3"],
            accent: "#ffdb78"
          };
        } else if (balance >= 5000) {
          tier = {
            name: "SILVER",
            subtitle: "SILVER MEMBER",
            colors: ["#102333", "#235c86", "#72c5f2", "#d9f4ff"],
            accent: "#9ce0ff"
          };
        } else {
          tier = {
            name: "STARTER",
            subtitle: "STARTER MEMBER",
            colors: ["#20242b", "#444c58", "#929eaa", "#e1e7ed"],
            accent: "#c6d0dc"
          };
        }

        // Create card canvas
        const canvas = createCanvas(1000, 600);
        const ctx = canvas.getContext("2d");

        // Background
        const bg = ctx.createLinearGradient(0, 0, 1000, 600);
        bg.addColorStop(0, tier.colors[0]);
        bg.addColorStop(0.55, tier.colors[1]);
        bg.addColorStop(1, tier.colors[2]);

        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.roundRect(0, 0, 1000, 600, 38);
        ctx.fill();

        // Decorative circles
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = tier.colors[3];

        ctx.beginPath();
        ctx.arc(900, 80, 230, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(750, 550, 300, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 1;

        // Border
        ctx.strokeStyle = tier.colors[3];
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(12, 12, 976, 576, 32);
        ctx.stroke();

        // Bank name
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 48px Arial";
        ctx.fillText("GOAT BANK", 55, 85);

        ctx.fillStyle = tier.accent;
        ctx.font = "22px Arial";
        ctx.fillText("VIRTUAL WALLET", 58, 120);

        // Powered by NirZon
        ctx.textAlign = "right";
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 25px Arial";
        ctx.fillText("POWERED BY NIRZON", 945, 75);

        ctx.fillStyle = tier.accent;
        ctx.font = "bold 22px Arial";
        ctx.fillText(tier.name, 945, 112);

        ctx.textAlign = "left";

        // Card chip
        ctx.fillStyle = "#e6c77c";
        ctx.beginPath();
        ctx.roundRect(60, 165, 105, 78, 13);
        ctx.fill();

        ctx.strokeStyle = "#96743b";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(112, 165);
        ctx.lineTo(112, 243);
        ctx.moveTo(60, 204);
        ctx.lineTo(165, 204);
        ctx.stroke();

        // Contactless
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 6;

        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(195, 204, 20 + i * 13, -0.8, 0.8);
          ctx.stroke();
        }

        // Card number
        const formattedNumber = cardNumber.match(/.{1,4}/g).join(" ");

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 43px monospace";
        ctx.fillText(formattedNumber, 60, 320);

        // Cardholder
        ctx.fillStyle = tier.accent;
        ctx.font = "19px Arial";
        ctx.fillText("CARD HOLDER", 60, 385);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 34px Arial";
        ctx.fillText(String(name).toUpperCase().slice(0, 22), 60, 430);

        // Membership
        ctx.fillStyle = tier.accent;
        ctx.font = "bold 23px Arial";
        ctx.fillText(tier.subtitle, 60, 475);

        // Balance panel
        ctx.fillStyle = "rgba(0,0,0,0.28)";
        ctx.beginPath();
        ctx.roundRect(45, 500, 910, 70, 18);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.font = "21px Arial";
        ctx.fillText("AVAILABLE WALLET BALANCE", 70, 530);

        ctx.fillStyle = tier.accent;
        ctx.font = "bold 32px Arial";
        ctx.fillText(
          "$" + balance.toLocaleString("en-US"),
          70,
          562
        );

        // Virtual card label
        ctx.textAlign = "right";
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 25px Arial";
        ctx.fillText("GOAT", 925, 455);

        ctx.font = "16px Arial";
        ctx.fillStyle = tier.accent;
        ctx.fillText("VIRTUAL CARD", 925, 480);

        ctx.textAlign = "left";

        // Save card
        const filePath = path.join(cacheDir, `goat_${uid}.png`);

        try {
          await fs.writeFile(filePath, await canvas.encode("png"));

          await message.reply({
            body:
              `💳 GOAT BANK | ${tier.name}\n` +
              `👤 Holder: ${name}\n` +
              `💰 Balance: $${balance.toLocaleString("en-US")}`,
            attachment: fs.createReadStream(filePath)
          });
        } finally {
          await fs.remove(filePath);
        }
      }

    } catch (error) {
      console.error("GOAT BANK Error:", error);

      return message.reply(
        "❌ Could not generate your virtual card or complete the transfer. Please try again."
      );
    }
  }
};
