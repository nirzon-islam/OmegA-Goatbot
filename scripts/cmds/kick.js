
module.exports = {
	config: {
		name: "kick",
		version: "1.5.1",
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
			needAdmin: "❌ Bot is not admin. Please make the bot an admin first.",
			checkFailed: "❌ Could not verify bot admin status: %1",
			noUser: "⚠️ Please mention or reply to a member.",
			success: "✅ Successfully removed: %1",
			failed: "❌ Failed to remove %1: %2"
		},
		bn: {
			needAdmin: "❌ Bot admin e nei! Age bot ke admin banan.",
			checkFailed: "❌ Bot-er admin status check kora jayni: %1",
			noUser: "⚠️ Kake remove korte chan mention ba reply korun.",
			success: "✅ Successfully remove kora hoyeche: %1",
			failed: "❌ Remove kora jayni %1: %2"
		}
	},

	onStart: async function ({
		message,
		event,
		threadsData,
		api,
		getLang
	}) {
		const threadID = event.threadID;
		const botID = String(api.getCurrentUserID());

		// 1. Fetch live group information
		let threadInfo;

		try {
			threadInfo = await api.getThreadInfo(threadID);

			if (!threadInfo || !Array.isArray(threadInfo.adminIDs)) {
				throw new Error("Invalid admin information received");
			}
		}
		catch (err) {
			console.error("[Kick] Admin check error:", err);

			return message.reply(
				getLang("checkFailed", err.message || "Unknown error")
			);
		}

		// 2. Normalize admin IDs
		const adminIDs = threadInfo.adminIDs
			.map(admin => {
				if (typeof admin === "object" && admin !== null) {
					return String(
						admin.id ??
						admin.userID ??
						admin.uid ??
						""
					);
				}

				return String(admin);
			})
			.filter(Boolean);

		console.log("[Kick] Bot ID:", botID);
		console.log("[Kick] Live Admin IDs:", adminIDs);

		// 3. Stop if bot is not admin
		if (!adminIDs.includes(botID)) {
			return message.reply(getLang("needAdmin"));
		}

		// 4. Get target members
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

		// 5. Remove members
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
				console.error(
					"[Kick] Remove failed:",
					uid,
					err
				);

				await message.reply(
					getLang(
						"failed",
						uid,
						err.message || "Unknown error"
					)
				);
			}
		}

		// 6. Refresh group cache after successful removal
		if (successCount > 0) {
			try {
				const freshInfo = await api.getThreadInfo(threadID);

				if (freshInfo) {
					await threadsData.refreshInfo(
						threadID,
						freshInfo
					);
				}

				console.log(
					"[Kick] Thread information refreshed."
				);
			}
			catch (err) {
				console.error(
					"[Kick] Refresh failed:",
					err
				);
			}
		}
	}
};
