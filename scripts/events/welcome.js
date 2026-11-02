const { drive } = global.utils;
const { nickNameBot } = global.GoatBot.config;
const { createCanvas, loadImage, registerFont } = require("canvas");
const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");

// Load fonts from BOTH font folders visible in the repository screenshots.
// welcome.js lives in scripts/events/, so these resolve from that directory.
const FONT_DIRS = [
  path.resolve(__dirname, "../cmds/assets/font"),
  path.resolve(__dirname, "../cmds/fonts")
];

function loadBundledFont(fileName, family, weight = "normal") {
  for (const dir of FONT_DIRS) {
    const fontPath = path.join(dir, fileName);
    try {
      if (fs.existsSync(fontPath)) {
        registerFont(fontPath, { family, weight });
        return true;
      }
    } catch (error) {
      console.warn(`[welcome] Could not register ${fileName}:`, error.message);
    }
  }
  console.warn(`[welcome] Font not found in either font folder: ${fileName}`);
  return false;
}

// Bengali and general text fonts (mostly in scripts/cmds/assets/font/).
loadBundledFont("NotoSansBengali-Regular.ttf", "Noto Sans Bengali", "normal");
loadBundledFont("NotoSansBengali-Bold.ttf", "Noto Sans Bengali", "bold");
loadBundledFont("BeVietnamPro-Regular.ttf", "Be Vietnam Pro", "normal");
loadBundledFont("BeVietnamPro-SemiBold.ttf", "Be Vietnam Pro", "600");
loadBundledFont("BeVietnamPro-Bold.ttf", "Be Vietnam Pro", "bold");
loadBundledFont("kalpurush.ttf", "Kalpurush", "normal");
loadBundledFont("kalpurush ANSI.ttf", "Kalpurush ANSI", "normal");
loadBundledFont("CourierPrime-Regular.ttf", "Courier Prime", "normal");
loadBundledFont("CourierPrime-Bold.ttf", "Courier Prime", "bold");
loadBundledFont("Kanit-SemiBoldItalic.ttf", "Kanit", "600");

// Emoji fonts (Noto Emoji variants in assets/font and NotoColorEmoji in fonts).
loadBundledFont("Noto Emoji Regular 400.ttf", "Noto Emoji", "normal");
loadBundledFont("Noto Emoji Medium 500.ttf", "Noto Emoji", "500");
loadBundledFont("Noto Emoji SemiBold 600.ttf", "Noto Emoji", "600");
loadBundledFont("Noto Emoji Bold 700.ttf", "Noto Emoji", "bold");
loadBundledFont("NotoColorEmoji.ttf", "Noto Color Emoji", "normal");

const FONT = '"Noto Sans Bengali", "Be Vietnam Pro", "Kalpurush", "Noto Emoji", sans-serif';
const SCRIPT = '"Be Vietnam Pro", "Courier Prime", cursive';

const C = {
  bg: "#05020b", panel: "#0a0613", purple: "#a855f7",
  purple2: "#7c3aed", pink: "#e879f9", white: "#fbf7ff",
  muted: "#c5b6d8", line: "rgba(168,85,247,0.42)"
};

module.exports = {
  config: {
    name: "welcome",
    version: "8.1.0",
    author: "NirZon",
    category: "events"
  },
  langs: {
    en: {
      defaultWelcomeMessage:
        "✦ 𝐖𝐄𝐋𝐂𝐎𝐌𝐄 𝐓𝐎 𝐎𝐔𝐑 𝐂𝐎𝐌𝐌𝐔𝐍𝐈𝐓𝐘 ✦\n\n" +
        "🌸 𝐇𝐞𝐲, {userName}! 𝐆𝐥𝐚𝐝 𝐭𝐨 𝐡𝐚𝐯𝐞 𝐲𝐨𝐮 𝐡𝐞𝐫𝐞!\n" +
        "🏡 𝐘𝐨𝐮'𝐫𝐞 𝐧𝐨𝐰 𝐩𝐚𝐫𝐭 𝐨𝐟: {threadName}\n" +
        "💫 𝐀 𝐧𝐞𝐰 𝐟𝐚𝐜𝐞, 𝐚 𝐧𝐞𝐰 𝐬𝐭𝐨𝐫𝐲! You're our {memberCount}th member. Make yourself comfortable and enjoy the vibes!\n\n" +
        "🕒 𝐖𝐢𝐬𝐡𝐢𝐧𝐠 𝐲𝐨𝐮 𝐚 𝐰𝐨𝐧𝐝𝐞𝐫𝐟𝐮𝐥 {timeOfDay}!\n\n" +
        "📌 𝐑𝐄𝐌𝐈𝐍𝐃𝐄𝐑: ᴋᴇᴇᴘ ɪᴛ ʀᴇꜱᴘᴇᴄᴛꜰᴜʟ, ʙᴇ ᴀᴄᴛɪᴠᴇ & ᴅᴏɴ'ᴛ ꜰᴏʀɢᴇᴛ ᴛᴏ ʀᴇᴀᴅ ᴛʜᴇ ɢʀᴏᴜᴘ ʀᴜʟᴇꜱ!",
      botAddedMessage:
        "🤖 𝐁𝐨𝐭 𝐒𝐮𝐜𝐜𝐞𝐬𝐬𝐟𝐮𝐥𝐥𝐲 𝐀𝐝𝐝𝐞𝐝!\n\n" +
        "👋 Hello everyone!\n" +
        "🏡 Group: {threadName}\n" +
        "👑 Owner: NirZon\n" +
        "⚙️ Bot Prefix: {prefix}\n\n" +
        "✨ Thanks for adding me!\n" +
        "Type {prefix}help to see my commands.\n\n" +
        "💜 Powered By NirZon"
    }
  },

  onStart: async ({ threadsData, message, event, api, usersData, getLang }) => {
    if (event.logMessageType !== "log:subscribe") return;
    const { threadID } = event;
    const threadData = await threadsData.get(threadID);
    if (!threadData.settings.sendWelcomeMessage) return;

    const addedMembers = (event.logMessageData && event.logMessageData.addedParticipants) || [];
    if (!addedMembers.length) return;
    const threadName = threadData.threadName || "Our Group";
    const prefix = global.utils.getPrefix(threadID);
    const inviterID = event.author;

    for (const user of addedMembers) {
      const userID = user.userFbId;
      const botID = api.getCurrentUserID();

      if (userID == botID) {
        if (nickNameBot) await api.changeNickname(nickNameBot, threadID, botID);
        return message.send(
          getLang("botAddedMessage")
            .replace(/\{prefix\}/g, prefix)
            .replace(/\{threadName\}/g, threadName)
        );
      }

      const userName = user.fullName || "New Member";
      const inviterName = inviterID
        ? await usersData.getName(inviterID).catch(() => "A member")
        : "A member";
      const memberCount = (event.participantIDs || []).length;
      let { welcomeMessage = getLang("defaultWelcomeMessage") } = threadData.data || {};
      if (typeof welcomeMessage !== "string" || !welcomeMessage.trim()) {
        welcomeMessage = getLang("defaultWelcomeMessage");
      }

      const dhakaHour = Number(new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Dhaka", hour: "2-digit", hourCycle: "h23"
      }).format(new Date()));
      const timeOfDay = dhakaHour < 12 ? "Morning" : dhakaHour < 17 ? "Afternoon" : dhakaHour < 20 ? "Evening" : "Night";

      welcomeMessage = welcomeMessage
        .replace(/\{userName\}/g, userName)
        .replace(/\{userTag\}/g, userName)
        .replace(/\{threadName\}/g, threadName)
        .replace(/\{memberCount\}/g, memberCount)
        .replace(/\{inviterName\}/g, inviterName)
        .replace(/\{timeOfDay\}/g, timeOfDay)
        .replace(/&amp;/g, "&");

      let welcomeImagePath = null;
      try {
        welcomeImagePath = await createWelcomeCard({
          userName, threadName, memberCount, inviterName,
          newUserID: userID, inviterID, threadID, api
        });
      } catch (err) {
        console.error("Welcome image creation failed:", err);
      }

      const form = {
        body: welcomeMessage,
        mentions: [{ tag: userName, id: userID }]
      };
      if (welcomeImagePath && fs.existsSync(welcomeImagePath)) {
        form.attachment = fs.createReadStream(welcomeImagePath);
      } else if (threadData.data && threadData.data.welcomeAttachment) {
        const attachments = threadData.data.welcomeAttachment.map(f => drive.getFile(f, "stream"));
        form.attachment = (await Promise.allSettled(attachments))
          .filter(x => x.status === "fulfilled").map(x => x.value);
      }

      await message.send(form);
      if (welcomeImagePath && fs.existsSync(welcomeImagePath)) {
        setTimeout(() => {
          try { fs.unlinkSync(welcomeImagePath); } catch (_) {}
        }, 10000);
      }
    }
  }
};

async function downloadImage(url) {
  try {
    const res = await axios({
      method: "GET", url, responseType: "arraybuffer", timeout: 12000
    });
    return Buffer.from(res.data);
  } catch (_) { return null; }
}

async function getProfileImage(userID, api) {
  try {
    const info = await api.getUserInfo([userID]);
    const src = info && info[userID] && info[userID].thumbSrc;
    if (!src) return null;
    const buffer = await downloadImage(src);
    return buffer ? await loadImage(buffer).catch(() => null) : null;
  } catch (_) { return null; }
}

async function getGroupImage(threadID, api) {
  try {
    const info = await api.getThreadInfo(threadID);
    if (!info || !info.imageSrc) return null;
    const buffer = await downloadImage(info.imageSrc);
    return buffer ? await loadImage(buffer).catch(() => null) : null;
  } catch (_) { return null; }
}

// Preserve original Unicode, normalize combining marks, and only simplify
// mathematical Latin alphabets when needed for readable names.
function unicodeToPlain(value) {
  // Keep the original Unicode styling and combining marks in member/group names.
  // NFC normalizes equivalent sequences without converting styled letters to plain text.
  return String(value || "").normalize("NFC");
}

function ordinal(n) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${n % 10 === 1 ? "st" : n % 10 === 2 ? "nd" : n % 10 === 3 ? "rd" : "th"}`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function circleAvatar(ctx, img, x, y, radius) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.clip();
  if (img) {
    const size = radius * 2;
    const scale = Math.max(size / img.width, size / img.height);
    const sw = size / scale, sh = size / scale;
    ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh,
      x - radius, y - radius, size, size);
  } else {
    ctx.fillStyle = "#211633";
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    ctx.fillStyle = "#e9d5ff";
    ctx.font = `bold ${Math.round(radius * 0.65)}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("?", x, y);
  }
  ctx.restore();
}

function fitText(ctx, value, maxWidth, maxSize = 32, minSize = 13, weight = "bold") {
  const text = String(value || "");
  let size = maxSize;
  ctx.font = `${weight} ${size}px ${FONT}`;
  while (ctx.measureText(text).width > maxWidth && size > minSize) {
    size--;
    ctx.font = `${weight} ${size}px ${FONT}`;
  }
  // Keep the full name. At the minimum size it may wrap at the caller's discretion;
  // do not silently replace unknown Unicode glyphs or cut names with ellipses.
  return { text, size };
}

function neonLine(ctx, x1, y, x2, color = C.purple, width = 2) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
  ctx.restore();
}

function drawHeart(ctx, x, y, size, color = C.pink) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 30, size / 30);
  ctx.beginPath();
  ctx.moveTo(0, 10);
  ctx.bezierCurveTo(-28, -8, -18, -28, 0, -12);
  ctx.bezierCurveTo(18, -28, 28, -8, 0, 10);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.stroke();
  ctx.restore();
}

function drawCrown(ctx, x, y, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.strokeStyle = "#d8a6ff";
  ctx.fillStyle = "rgba(168,85,247,0.16)";
  ctx.lineWidth = 2.5;
  ctx.shadowColor = C.pink;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(-22, 8); ctx.lineTo(-28, -12); ctx.lineTo(-10, 0);
  ctx.lineTo(0, -20); ctx.lineTo(10, 0); ctx.lineTo(28, -12);
  ctx.lineTo(22, 8); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-22, 13); ctx.lineTo(22, 13); ctx.stroke();
  ctx.restore();
}

function drawFlower(ctx, x, y, r, alpha = 0.65) {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#7c3aed";
  ctx.shadowColor = C.purple;
  ctx.shadowBlur = 16;
  for (let i = 0; i < 6; i++) {
    ctx.save(); ctx.rotate(i * Math.PI / 3);
    ctx.beginPath(); ctx.ellipse(0, -r * 0.58, r * 0.28, r * 0.58, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.restore();
  }
  ctx.fillStyle = "#e9d5ff";
  ctx.beginPath(); ctx.arc(0, 0, r * 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

async function createWelcomeCard({
  userName, threadName, memberCount, inviterName,
  newUserID, inviterID, threadID, api
}) {
  const W = 1536, H = 800;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  const [newUserImg, inviterImg, groupImg] = await Promise.all([
    getProfileImage(newUserID, api),
    inviterID ? getProfileImage(inviterID, api) : Promise.resolve(null),
    getGroupImage(threadID, api)
  ]);

  const safeUser = unicodeToPlain(userName);
  const safeInviter = unicodeToPlain(inviterName);
  const safeGroup = unicodeToPlain(threadName);

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#080411");
  bg.addColorStop(0.5, "#030208");
  bg.addColorStop(1, "#10051c");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Purple ambient light, corner ribbons and floral decoration.
  const glow = ctx.createRadialGradient(260, 420, 10, 260, 420, 600);
  glow.addColorStop(0, "rgba(124,58,237,0.28)");
  glow.addColorStop(1, "rgba(124,58,237,0)");
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.strokeStyle = "rgba(168,85,247,0.75)";
  ctx.lineWidth = 3; ctx.shadowColor = C.purple; ctx.shadowBlur = 18;
  roundRect(ctx, 9, 9, W - 18, H - 18, 26); ctx.stroke();
  ctx.restore();

  // Decorative diagonal corner ribbons.
  ctx.save();
  ctx.strokeStyle = "rgba(124,58,237,0.25)";
  ctx.lineWidth = 18;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath(); ctx.moveTo(-80 + i * 42, 0); ctx.lineTo(-300 + i * 42, 260); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W + 80 - i * 42, H); ctx.lineTo(W + 300 - i * 42, H - 260); ctx.stroke();
  }
  ctx.restore();

  drawFlower(ctx, 58, 690, 42, 0.55);
  drawFlower(ctx, 110, 760, 28, 0.4);
  drawFlower(ctx, 1480, 720, 26, 0.32);
  drawHeart(ctx, 90, 445, 46);
  drawHeart(ctx, 1435, 80, 42);

  const splitX = 590;
  ctx.strokeStyle = "rgba(168,85,247,0.65)";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(splitX, 18); ctx.lineTo(splitX, H - 18); ctx.stroke();

  // LEFT: new member.
  const leftCX = 294, avatarY = 340, avatarR = 180;
  ctx.textAlign = "center";
  drawCrown(ctx, leftCX, 58, 0.9);
  ctx.fillStyle = C.white;
  ctx.font = `600 24px ${FONT}`;
  ctx.fillText("N E W   M E M B E R", leftCX, 105);
  neonLine(ctx, 140, 128, 450, C.pink, 2);

  ctx.save();
  ctx.shadowColor = C.purple; ctx.shadowBlur = 28;
  ctx.strokeStyle = C.purple; ctx.lineWidth = 8;
  ctx.beginPath(); ctx.arc(leftCX, avatarY, avatarR + 10, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = "#e9d5ff"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(leftCX, avatarY, avatarR + 19, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  circleAvatar(ctx, newUserImg, leftCX, avatarY, avatarR);

  const userFit = fitText(ctx, safeUser, 500, 48, 19);
  ctx.font = `bold ${userFit.size}px ${FONT}`;
  ctx.fillStyle = C.white; ctx.shadowColor = C.purple; ctx.shadowBlur = 10;
  ctx.fillText(userFit.text, leftCX, 590); ctx.shadowBlur = 0;
  drawHeart(ctx, 485, 576, 30, "#f5eaff");

  const badgeText = `${ordinal(memberCount)} Member`;
  ctx.font = `bold 27px ${FONT}`;
  const badgeW = Math.max(300, ctx.measureText(badgeText).width + 105);
  const badgeX = leftCX - badgeW / 2, badgeY = 640;
  ctx.save();
  ctx.fillStyle = "rgba(124,58,237,0.13)";
  ctx.strokeStyle = C.purple; ctx.lineWidth = 3;
  ctx.shadowColor = C.purple; ctx.shadowBlur = 15;
  roundRect(ctx, badgeX, badgeY, badgeW, 60, 30); ctx.fill(); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = C.white; ctx.font = `bold 27px ${FONT}`;
  ctx.fillText(`♟  ${badgeText}  ✦`, leftCX, badgeY + 39);
  neonLine(ctx, 125, 748, 460, C.purple, 2);
  drawHeart(ctx, leftCX, 748, 28);

  // RIGHT: title in script style with a bright underline and crown/heart accents.
  const x = 650, right = 1490, rightW = right - x;
  ctx.textAlign = "left";
  drawCrown(ctx, x + 38, 72, 1.0);
  ctx.font = `italic 68px ${SCRIPT}`;
  ctx.fillStyle = C.white;
  ctx.shadowColor = C.pink; ctx.shadowBlur = 12;
  ctx.fillText("Welcome To Our Group", x + 58, 130);
  ctx.shadowBlur = 0;
  drawHeart(ctx, 1430, 100, 42);
  neonLine(ctx, x + 45, 158, x + 600, C.pink, 4);

  // Group block.
  ctx.fillStyle = "#d8b4fe"; ctx.font = `600 22px ${FONT}`;
  ctx.fillText("G R O U P", x, 225);
  const gx = x, gy = 250, gs = 160;
  ctx.save();
  ctx.shadowColor = C.purple; ctx.shadowBlur = 20;
  ctx.fillStyle = "#100a1b"; roundRect(ctx, gx, gy, gs, gs, 28); ctx.fill();
  ctx.restore();
  if (groupImg) {
    ctx.save(); roundRect(ctx, gx + 5, gy + 5, gs - 10, gs - 10, 24); ctx.clip();
    ctx.drawImage(groupImg, gx + 5, gy + 5, gs - 10, gs - 10); ctx.restore();
  } else {
    ctx.fillStyle = "#c084fc"; ctx.font = `bold 66px ${FONT}`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.shadowColor = C.pink; ctx.shadowBlur = 18;
    ctx.fillText("✿", gx + gs / 2, gy + gs / 2);
    ctx.shadowBlur = 0; ctx.textBaseline = "alphabetic";
  }
  ctx.strokeStyle = C.purple; ctx.lineWidth = 4;
  roundRect(ctx, gx, gy, gs, gs, 28); ctx.stroke();

  const groupTextX = gx + gs + 38;
  const groupFit = fitText(ctx, safeGroup, right - groupTextX, 48, 18);
  ctx.textAlign = "left"; ctx.font = `bold ${groupFit.size}px ${FONT}`;
  ctx.fillStyle = C.white; ctx.fillText(groupFit.text, groupTextX, gy + 88);
  ctx.font = `400 25px ${FONT}`; ctx.fillStyle = C.muted;
  ctx.fillText("●  Friends  •  Vibes  •  Forever  ♪", groupTextX, gy + 130);

  neonLine(ctx, x, 455, right, "rgba(168,85,247,0.45)", 2);

  // Added by.
  ctx.fillStyle = "#d8b4fe"; ctx.font = `600 22px ${FONT}`;
  ctx.fillText("A D D E D   B Y", x, 510);
  const invCX = x + 82, invCY = 615;
  ctx.save();
  ctx.shadowColor = C.pink; ctx.shadowBlur = 20;
  ctx.strokeStyle = C.pink; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(invCX, invCY, 72, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  circleAvatar(ctx, inviterImg, invCX, invCY, 65);
  const invTextX = x + 185;
  const invFit = fitText(ctx, safeInviter, right - invTextX, 46, 18);
  ctx.font = `bold ${invFit.size}px ${FONT}`;
  ctx.fillStyle = C.white; ctx.textAlign = "left";
  ctx.fillText(invFit.text, invTextX, invCY + 14);
  drawCrown(ctx, Math.min(right - 40, invTextX + ctx.measureText(invFit.text).width + 45), invCY - 2, 0.7);

  // Footer plaque and tagline.
  ctx.save();
  ctx.fillStyle = "rgba(13,7,25,0.88)";
  ctx.strokeStyle = "rgba(168,85,247,0.8)";
  ctx.lineWidth = 3; ctx.shadowColor = C.purple; ctx.shadowBlur = 20;
  roundRect(ctx, x, 710, rightW, 66, 24); ctx.fill(); ctx.stroke();
  ctx.restore();
  drawCrown(ctx, x + rightW / 2, 710, 0.8);
  ctx.textAlign = "center";
  ctx.font = `italic bold 39px ${SCRIPT}`;
  const footerGrad = ctx.createLinearGradient(900, 0, 1320, 0);
  footerGrad.addColorStop(0, "#fff7ff");
  footerGrad.addColorStop(0.55, "#d8b4fe");
  footerGrad.addColorStop(1, C.pink);
  ctx.fillStyle = footerGrad;
  ctx.fillText("Powered By NirZon", x + rightW / 2, 755);

  ctx.textAlign = "right";
  ctx.font = `italic 25px ${SCRIPT}`;
  ctx.fillStyle = "#f3e8ff";
  ctx.fillText("Enjoy your stay  💜", right, 795);

  const tempPath = path.join(__dirname, `temp_welcome_${Date.now()}.png`);
  await fs.writeFile(tempPath, canvas.toBuffer("image/png"));
  return tempPath;
}
