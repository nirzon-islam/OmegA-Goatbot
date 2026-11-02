
module.exports = {
	config: {
		name: "kick",
		version: "1.5.0",
		author: "NirZon",
		countDown: 5,
		role: 1,
		description: {
			en: "Kick member out of chat box fixed"
		},
		category: "box chat",
		guide: {
			en: "{pn} @tags or reply to kick"
		}
	},

	langs: {
		en: {
			needAdmin: "⚠️ Bot is not admin. Please add bot as admin.",
			checkFailed: "❌ Could not verify bot admin status: %1",
			noUser: "⚠️ Please mention or reply to a member.",
			success: "✅ Successfully removed: %1",
			failed: "❌ Failed to remove %1: %2"
		},
		bn: {
			needAdmin: "⚠️ Bot admin e nei, age bot ke admin banan.",
			checkFailed: "❌ Admin status check kora jayni: %1",
			noUser: "⚠️ Kake remove korte chan mention ba reply korun.",
			success: "✅ Successfully remove kora hoyeche: %1",
			failed: "❌ Remove kora jayni %1: %2"
		}
	},

	onStart: async function ({
		message,
		event,
		args,
		threadsData,
		api,
		getLang
	}) {
		const threadID = event.threadID;
		const botID = String(api.getCurrentUserID());

		// 1. Check live group admin status
		let threadInfo;

		try {
			threadInfo = await api.getThreadInfo(threadID);

			if (!threadInfo || !Array.isArray(threadInfo.adminIDs)) {
				throw new Error("Invalid admin information received.");
			}
		}
		catch (err) {
			console.error("[KICK] Admin check failed:", err);
			return message.reply(
				getLang("checkFailed", err.message || "Unknown error")
			);
		}

		const adminIDs = threadInfo.adminIDs.map(admin =>
			String(
				typeof admin === "object" && admin !== null
					? admin.id
					: admin
			)
		);

		console.log("[KICK] Bot ID:", botID);
		console.log("[KICK] Admin IDs:", adminIDs);

		if (!adminIDs.includes(botID)) {
			return message.reply(getLang("needAdmin"));
		}

		// 2. Get target members
		let targetIDs = [];

		if (event.messageReply) {
			targetIDs = [String(event.messageReply.senderID)];
		}
		else {
			targetIDs = Object.keys(event.mentions || {});
		}

		targetIDs = [...new Set(targetIDs)];

		if (!targetIDs.length) {
			return message.reply(getLang("noUser"));
		}

		// 3. Remove members
		let successCount = 0;

		for (const uid of targetIDs) {
			try {
				await api.removeUserFromGroup(uid, threadID);
				successCount++;

				await message.reply(
					getLang("success", uid)
				);
			}
			catch (err) {
				console.error("[KICK] Remove failed:", uid, err);

				await message.reply(
					getLang(
						"failed",
						uid,
						err.message || "Unknown error"
					)
				);
			}
		}

		// 4. Refresh group information
		if (successCount > 0) {
			try {
				const freshInfo = await api.getThreadInfo(threadID);

				await threadsData.refreshInfo(
					threadID,
					freshInfo
				);

				console.log("[KICK] Thread information refreshed.");
			}
			catch (err) {
				console.error("[KICK] Refresh failed:", err);
			}
		}
	}
};
