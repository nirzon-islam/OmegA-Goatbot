const { drive } = global.utils;
const { nickNameBot } = global.GoatBot.config;
const { createCanvas, loadImage } = require("canvas");
const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");

const FONT = '"Noto Sans Bengali", "Noto Sans", "Segoe UI", Arial, sans-serif';
const C = {
  bg: "#05040b",
  panel: "#090711",
  purple: "#a855f7",
  purple2: "#7c3aed",
  pink: "#d946ef",
  white: "#f7f4ff",
  muted: "#aaa2c3",
  line: "rgba(168,85,247,0.34)"
};

module.exports = {
  config: {
    name: "welcome",
    version: "2.0.0",
    author: "NirZon",
    category: "events"
  },

  langs: {
    en: {
      defaultWelcomeMessage:
        "Welcome {userName} 💜\nGlad to have you here! Enjoy your stay.",
      botAddedMessage:
        "━━━━━━━━━━━━━━━━━━\n🤖 Thanks for adding me to the group!\n\n👑 Bot Owner: NirZon\n⚙️ Prefix: {prefix}\n\nLet's make this group more fun together! 💜\n━━━━━━━━━━━━━━━━━━"
    }
  },

  onStart: async ({ threadsData, message, event, api, usersData, getLang }) => {
    if (event.logMessageType !== "log:subscribe") return;

    const { threadID } = event;
    const threadData = await threadsData.get(threadID);
    if (!threadData.settings.sendWelcomeMessage) return;

    const addedMembers = event.logMessageData.addedParticipants || [];
    const threadName = threadData.threadName || "Our Group";
    const prefix = global.utils.getPrefix(threadID);
    const inviterID = event.author;

    for (const user of addedMembers) {
      const userID = user.userFbId;
      const botID = api.getCurrentUserID();

      if (userID == botID) {
        if (nickNameBot) await api.changeNickname(nickNameBot, threadID, botID);
        return message.send(getLang("botAddedMessage").replace(/\{prefix\}/g, prefix));
      }

      const userName = user.fullName || "New Member";
      const inviterName = inviterID
        ? await usersData.getName(inviterID).catch(() => "A member")
        : "A member";
      const memberCount = (event.participantIDs || []).length;

      let { welcomeMessage = getLang("defaultWelcomeMessage") } = threadData.data || {};
      welcomeMessage = welcomeMessage
        .replace(/\{userName\}/g, userName)
        .replace(/\{userTag\}/g, userName)
        .replace(/\{threadName\}/g, threadName)
        .replace(/\{memberCount\}/g, memberCount)
        .replace(/\{inviterName\}/g, inviterName);

      let welcomeImagePath = null;
      try {
        welcomeImagePath = await createWelcomeCard({
          userName,
          threadName,
          memberCount,
          inviterName,
          newUserID: userID,
          inviterID,
          threadID,
          api
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
          .filter(x => x.status === "fulfilled")
          .map(x => x.value);
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

// Do not hard-code a Facebook access token in the source file.
// The bot API's profile thumbnail is used instead.
async function downloadImage(url) {
  try {
    const res = await axios({
      method: "GET",
      url,
      responseType: "arraybuffer",
      timeout: 12000
    });
    return Buffer.from(res.data);
  } catch {
    return null;
  }
}

async function getProfileImage(userID, api) {
  try {
    const info = await api.getUserInfo([userID]);
    const src = info && info[userID] && info[userID].thumbSrc;
    if (!src) return null;
    const buffer = await downloadImage(src);
    return buffer ? await loadImage(buffer).catch(() => null) : null;
  } catch {
    return null;
  }
}

async function getGroupImage(threadID, api) {
  try {
    const info = await api.getThreadInfo(threadID);
    if (!info || !info.imageSrc) return null;
    const buffer = await downloadImage(info.imageSrc);
    return buffer ? await loadImage(buffer).catch(() => null) : null;
  } catch {
    return null;
  }
}

// Keep original Unicode text intact. In particular, do not convert UTF-8
// through latin1: that was the source of broken Bengali group names.
function unicodeToPlain(str) {
  if (!str) return "";
  const ranges = [
    [0x1D400, 0x1D419, "A"], [0x1D41A, 0x1D433, "a"],
    [0x1D434, 0x1D44D, "A"], [0x1D44E, 0x1D467, "a"],
    [0x1D468, 0x1D481, "A"], [0x1D482, 0x1D49B, "a"],
    [0x1D5D4, 0x1D5ED, "A"], [0x1D5EE, 0x1D607, "a"],
    [0x1D63C, 0x1D655, "A"], [0x1D656, 0x1D66F, "a"],
    [0x1D7CE, 0x1D7D7, "0"],
    [0xFF21, 0xFF3A, "A"], [0xFF41, 0xFF5A, "a"],
    [0xFF10, 0xFF19, "0"],
    [0x24B6, 0x24CF, "A"], [0x24D0, 0x24E9, "a"]
  ];
  let out = "";
  for (const char of String(str)) {
    const cp = char.codePointAt(0);
    let converted = false;
    for (const [start, end, base] of ranges) {
      if (cp >= start && cp <= end) {
        out += String.fromCodePoint(base.codePointAt(0) + cp - start);
        converted = true;
        break;
      }
    }
    out += converted ? "" : char;
  }
  return out;
}

function cleanText(value) {
  return unicodeToPlain(String(value || "").normalize("NFC"));
}

function ordinal(n) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
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
    const sw = size / scale;
    const sh = size / scale;
    const sx = (img.width - sw) / 2;
    const sy = (img.height - sh) / 2;
    ctx.drawImage(img, sx, sy, sw, sh, x - radius, y - radius, size, size);
  } else {
    ctx.fillStyle = "#211633";
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    ctx.fillStyle = "#c4a5fd";
    ctx.font = `bold ${Math.round(radius * 0.65)}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("?", x, y);
  }
  ctx.restore();
}

function fitText(ctx, value, maxWidth, maxSize = 32, minSize = 13, weight = "bold") {
  let text = String(value || "");
  let size = maxSize;
  ctx.font = `${weight} ${size}px ${FONT}`;
  while (ctx.measureText(text).width > maxWidth && size > minSize) {
    size--;
    ctx.font = `${weight} ${size}px ${FONT}`;
  }
  if (ctx.measureText(text).width > maxWidth) {
    while (text.length > 1 && ctx.measureText(text + "…").width > maxWidth) {
      text = text.slice(0, -1);
    }
    text += "…";
  }
  return { text, size };
}

function neonLine(ctx, x1, y, x2, color = C.purple) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
  ctx.restore();
}

async function createWelcomeCard({
  userName, threadName, memberCount, inviterName,
  newUserID, inviterID, threadID, api
}) {
  const W = 1200;
  const H = 630;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const [newUserImg, inviterImg, groupImg] = await Promise.all([
    getProfileImage(newUserID, api),
    inviterID ? getProfileImage(inviterID, api) : Promise.resolve(null),
    getGroupImage(threadID, api)
  ]);

  const safeUser = cleanText(userName);
  const safeInviter = cleanText(inviterName);
  const safeGroup = cleanText(threadName);

  // Dark purple background with subtle light.
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#080510");
  bg.addColorStop(0.52, "#030208");
  bg.addColorStop(1, "#0b0615");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(300, 300, 20, 300, 300, 470);
  glow.addColorStop(0, "rgba(124,58,237,0.17)");
  glow.addColorStop(1, "rgba(124,58,237,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Minimal outer frame and split.
  ctx.save();
  ctx.strokeStyle = "rgba(168,85,247,0.55)";
  ctx.lineWidth = 2;
  ctx.shadowColor = C.purple;
  ctx.shadowBlur = 15;
  roundRect(ctx, 8, 8, W - 16, H - 16, 20);
  ctx.stroke();
  ctx.restore();

  const splitX = 455;
  ctx.strokeStyle = "rgba(168,85,247,0.45)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(splitX, 12);
  ctx.lineTo(splitX, H - 12);
  ctx.stroke();

  // Left panel: larger avatar, shifted slightly right.
  const leftCX = 242;
  const avatarY = 275;
  const avatarR = 145;

  ctx.textAlign = "center";
  ctx.fillStyle = "#f5eaff";
  ctx.font = `600 19px ${FONT}`;
  ctx.fillText("N E W   M E M B E R", leftCX, 70);
  neonLine(ctx, 112, 88, 372, C.pink);

  ctx.save();
  ctx.shadowColor = C.purple;
  ctx.shadowBlur = 28;
  ctx.strokeStyle = C.purple;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(leftCX, avatarY, avatarR + 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = "rgba(233,213,255,0.65)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(leftCX, avatarY, avatarR + 16, 0, Math.PI * 2);
  ctx.stroke();

  circleAvatar(ctx, newUserImg, leftCX, avatarY, avatarR);

  const userFit = fitText(ctx, safeUser, 390, 39, 17);
  ctx.font = `bold ${userFit.size}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillStyle = C.white;
  ctx.shadowColor = "rgba(168,85,247,0.45)";
  ctx.shadowBlur = 8;
  ctx.fillText(userFit.text, leftCX, 478);
  ctx.shadowBlur = 0;

  // Member badge.
  const badgeText = `${ordinal(memberCount)} Member`;
  ctx.font = `bold 21px ${FONT}`;
  const badgeW = Math.max(230, ctx.measureText(badgeText).width + 82);
  const badgeX = leftCX - badgeW / 2;
  const badgeY = 515;
  ctx.fillStyle = "rgba(124,58,237,0.12)";
  roundRect(ctx, badgeX, badgeY, badgeW, 48, 24);
  ctx.fill();
  ctx.strokeStyle = C.purple;
  ctx.lineWidth = 2;
  ctx.shadowColor = C.purple;
  ctx.shadowBlur = 10;
  roundRect(ctx, badgeX, badgeY, badgeW, 48, 24);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#eadcff";
  ctx.textAlign = "center";
  ctx.fillText(badgeText, leftCX, badgeY + 31);

  // Right panel.
  const x = 505;
  const right = 1150;
  const rightW = right - x;

  ctx.textAlign = "left";
  const heading = "Welcome To Our Group";
  const headFit = fitText(ctx, heading, rightW, 48, 30);
  ctx.font = `bold ${headFit.size}px ${FONT}`;
  const headGrad = ctx.createLinearGradient(x, 0, right, 0);
  headGrad.addColorStop(0, "#ffffff");
  headGrad.addColorStop(0.7, "#eadcff");
  headGrad.addColorStop(1, C.pink);
  ctx.fillStyle = headGrad;
  ctx.fillText(headFit.text, x, 105);
  neonLine(ctx, x, 125, x + 245, C.pink);

  // Group information.
  ctx.fillStyle = "#d8b4fe";
  ctx.font = `600 15px ${FONT}`;
  ctx.fillText("G R O U P", x, 175);

  const gx = x;
  const gy = 195;
  const gs = 112;
  ctx.save();
  ctx.shadowColor = C.purple;
  ctx.shadowBlur = 12;
  ctx.fillStyle = "#100a1b";
  roundRect(ctx, gx, gy, gs, gs, 22);
  ctx.fill();
  ctx.restore();

  if (groupImg) {
    ctx.save();
    roundRect(ctx, gx + 4, gy + 4, gs - 8, gs - 8, 19);
    ctx.clip();
    ctx.drawImage(groupImg, gx + 4, gy + 4, gs - 8, gs - 8);
    ctx.restore();
  } else {
    ctx.fillStyle = "#c084fc";
    ctx.font = `bold 42px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText("G", gx + gs / 2, gy + 70);
  }

  ctx.strokeStyle = C.purple;
  ctx.lineWidth = 2;
  roundRect(ctx, gx, gy, gs, gs, 22);
  ctx.stroke();

  const groupTextX = gx + gs + 28;
  const groupTextW = right - groupTextX;
  const groupFit = fitText(ctx, safeGroup, groupTextW, 34, 15);
  ctx.textAlign = "left";
  ctx.font = `bold ${groupFit.size}px ${FONT}`;
  ctx.fillStyle = C.white;
  ctx.fillText(groupFit.text, groupTextX, gy + 62);

  ctx.font = `400 19px ${FONT}`;
  ctx.fillStyle = C.muted;
  ctx.fillText("Friends  •  Vibes  •  Forever", groupTextX, gy + 91);

  neonLine(ctx, x, 335, right, "rgba(168,85,247,0.35)");

  // Added by.
  ctx.fillStyle = "#d8b4fe";
  ctx.font = `600 15px ${FONT}`;
  ctx.fillText("A D D E D   B Y", x, 380);

  const invCX = x + 56;
  const invCY = 465;
  ctx.save();
  ctx.shadowColor = C.pink;
  ctx.shadowBlur = 13;
  ctx.strokeStyle = C.pink;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(invCX, invCY, 57, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  circleAvatar(ctx, inviterImg, invCX, invCY, 52);

  const invTextX = x + 130;
  const invFit = fitText(ctx, safeInviter, right - invTextX, 34, 15);
  ctx.font = `bold ${invFit.size}px ${FONT}`;
  ctx.fillStyle = C.white;
  ctx.textAlign = "left";
  ctx.fillText(invFit.text, invTextX, invCY + 11);

  neonLine(ctx, x, 540, right, "rgba(168,85,247,0.25)");

  // Simple footer.
  ctx.save();
  ctx.fillStyle = "rgba(124,58,237,0.10)";
  ctx.strokeStyle = "rgba(168,85,247,0.65)";
  ctx.lineWidth = 2;
  ctx.shadowColor = C.purple;
  ctx.shadowBlur = 12;
  roundRect(ctx, x, 555, rightW, 55, 17);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.textAlign = "center";
  ctx.font = `bold 27px ${FONT}`;
  const footerGrad = ctx.createLinearGradient(650, 0, 1000, 0);
  footerGrad.addColorStop(0, "#f5eaff");
  footerGrad.addColorStop(0.55, "#c084fc");
  footerGrad.addColorStop(1, "#e879f9");
  ctx.fillStyle = footerGrad;
  ctx.fillText("Powered By NirZon", x + rightW / 2, 592);

  const tempPath = path.join(__dirname, `temp_welcome_${Date.now()}.png`);
  await fs.writeFile(tempPath, canvas.toBuffer("image/png"));
  return tempPath;
}
