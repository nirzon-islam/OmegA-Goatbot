
module.exports = {
	config: {
		name: "kick",
		version: "1.4.2",
		author: "NirZon",
		countDown: 5,
		role: 1,
		description: {
			en: "Kick member out of chat box fix by NirZon"
		},
		category: "box chat",
		guide: {
			en: "{pn} @tags or reply to kick"
		}
	},

	langs: {
		en: {
			needAdmin: "⚠️ Bot is not admin. Please add bot as admin.",
			kickFailed: "❌ Failed to kick user: %1",
			success: "✅ Successfully removed user: %1"
		},
		bn: {
			needAdmin: "⚠️ Bot admin e nei, age bot ke admin banan.",
			kickFailed: "❌ Member remove kora jayni: %1",
			success: "✅ Member remove kora hoyeche: %1"
		}
	},

	onStart: async function ({ message, event, args, threadsData, api, getLang }) {
		const threadID = event.threadID;
		const botID = String(api.getCurrentUserID());
		console.log("BOT ID:", botID);
console.log("ADMIN IDS:", adminIDs);

		// Always check fresh admin information
		try {
			const threadInfo = await api.getThreadInfo(threadID);

			const adminIDs = (threadInfo.adminIDs || []).map(a =>
				String(typeof a === "object" ? a.id : a)
			);

			if (!adminIDs.includes(botID)) {
				return message.reply(getLang("needAdmin"));
			}
		}
		catch (err) {
			console.error("[KICK ADMIN CHECK]", err);
			return message.reply(
				"⚠️ Could not verify bot admin status: " + err.message
			);
		}

		if (!args[0] && !event.messageReply)
			return message.SyntaxError();

		const uids = event.messageReply
			? [String(event.messageReply.senderID)]
			: Object.keys(event.mentions);

		if (!uids.length)
			return message.SyntaxError();

		for (const uid of uids) {
			try {
				await api.removeUserFromGroup(uid, threadID);
				await message.reply(getLang("success", uid));
			}
			catch (err) {
				console.error("[KICK ERROR]", err);
				await message.reply(
					getLang("kickFailed", err.message || "Unknown error")
				);
			}
		}

		// Refresh thread data after kick
		try {
			const freshInfo = await api.getThreadInfo(threadID);
			await threadsData.refreshInfo(threadID, freshInfo);
		}
		catch (err) {
			console.error("[KICK REFRESH ERROR]", err);
		}
	}
};
