const fs = require("fs-extra");
const path = require("path");
const crypto = require("crypto");
const { createCanvas } = require("@napi-rs/canvas");

module.exports = {
config: {
name: "balance",
aliases: ["bal"],
version: "1.0",
author: "NirZon",
countDown: 5,
role: 0,
shortDescription: "View GOAT BANK virtual card",
longDescription: "View your personalized virtual bank card and wallet balance.",
category: "economy",
guide: {
en: "{pn}: View your card\n{pn} @tag: View another user's card"
}
},

onStart: async function ({ message, usersData, event }) {
try {
const targets = Object.keys(event.mentions || {}).length
? Object.keys(event.mentions)
: [event.senderID];

  const cacheDir = path.join(__dirname, "cache");
  await fs.ensureDir(cacheDir);

  for (const uid of targets) {
    const userData = await usersData.get(uid);
    const balance = Number(userData.money || 0);

    let name = userData.name || "GOAT MEMBER";

    if (event.mentions?.[uid]) {
      name = event.mentions[uid].replace("@", "") || name;
    }

    // UID-based permanent 16-digit card number
    const hash = crypto
      .createHash("sha256")
      .update(String(uid))
      .digest("hex");

    const cardNumber = (
      BigInt("0x" + hash) % 10000000000000000n
    ).toString().padStart(16, "0");

    // Card tier based on wallet balance
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

    // Background gradient
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

    // Card border
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

    // Powered by NirZon - text only, no logo
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

    // Contactless symbol
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

    // Cardholder name
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

    // Save card image
    const filePath = path.join(cacheDir, `goat_${uid}.png`);

    await fs.writeFile(filePath, await canvas.encode("png"));

    try {
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
    "❌ Could not generate your virtual card. Please try again."
  );
}

}
};
