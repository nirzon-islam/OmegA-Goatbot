const { getTime } = global.utils;

module.exports = {
  config: {
    name: "antileave",
    version: "2.5.3",
    author: "EryXenX",
    category: "events"
  },

  onStart: async ({ api, event, usersData, message }) => {
    if (event.logMessageType !== "log:unsubscribe") return;

    const { threadID, logMessageData, author } = event;
    const leftID = logMessageData.leftParticipantFbId;

    if (leftID === author) {
      let userName = null;

      // Try the cached database name first.
      try {
        const storedName = await usersData.getName(leftID);
        if (typeof storedName === "string" && storedName.trim()) {
          userName = storedName.trim();
        }
      } catch (err) {
        console.warn("[antileave] Cached name lookup failed:", err.message);
      }

      // If no cached name exists, fetch the profile through FCA.
      if (!userName) {
        try {
          const userInfo = await api.getUserInfo([leftID]);
          const profileName = userInfo && userInfo[leftID] && userInfo[leftID].name;
          if (typeof profileName === "string" && profileName.trim()) {
            userName = profileName.trim();
          }
        } catch (err) {
          console.warn("[antileave] Facebook profile lookup failed:", err.message);
        }
      }

      userName = userName || "Unknown User";

      const boldMap = {
        A: "𝗔", B: "𝗕", C: "𝗖", D: "𝗗", E: "𝗘", F: "𝗙", G: "𝗚", H: "𝗛", I: "𝗜", J: "𝗝",
        K: "𝗞", L: "𝗟", M: "𝗠", N: "𝗡", O: "𝗢", P: "𝗣", Q: "𝗤", R: "𝗥", S: "𝗦", T: "𝗧",
        U: "𝗨", V: "𝗩", W: "𝗪", X: "𝗫", Y: "𝗬", Z: "𝗭",
        a: "𝗮", b: "𝗯", c: "𝗰", d: "𝗱", e: "𝗲", f: "𝗳", g: "𝗴", h: "𝗵", i: "𝗶", j: "𝗷",
        k: "𝗸", l: "𝗹", m: "𝗺", n: "𝗻", o: "𝗼", p: "𝗽", q: "𝗾", r: "𝗿", s: "𝘀", t: "𝘁",
        u: "𝘂", v: "𝘃", w: "𝘄", x: "𝘅", y: "𝘆", z: "𝘇"
      };

      const boldName = userName.split("").map(c => boldMap[c] || c).join("");

      const form = {
        body: `😹 ${boldName} haha tried to leave...  
Without permission🫩
🚫 Not allowed here!
🔄 Added back 😇`
      };

      try {
        await api.addUserToGroup(leftID, threadID);
        await message.send(form);
      } catch (err) {
        console.error("[antileave] Failed to re-add member or send message:", err);
      }
    }
  }
};
