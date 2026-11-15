const { db, utils, GoatBot } = global;
const { config } = GoatBot;
const { log, getText } = utils;
const { creatingThreadData, creatingUserData } = global.client.database;

module.exports = async function (usersData, threadsData, event) {
	const { threadID } = event;
	const senderID = event.senderID || event.author || event.userID;

	// ———————————— CHECK THREAD DATA ———————————— //
	// E2EE threads are not queryable via the normal getThreadInfo/Graph API
	// path — that's what was hanging. Skip DB thread-creation for them;
	// handlerEvents.js supplies a safe default threadData object instead.
	if (threadID && !event.isE2EE) {
		try {
			if (global.temp.createThreadDataError.includes(threadID))
				return;

			const findInCreatingThreadData = creatingThreadData.find(t => t.threadID == threadID);
			if (!findInCreatingThreadData) {
				if (global.db.allThreadData.some(t => t.threadID == threadID))
					return;

				const threadData = await threadsData.create(threadID);
				log.info("DATABASE", `New Thread: ${threadID} | ${threadData.threadName} | ${config.database.type}`);
			}
			else {
				await findInCreatingThreadData.promise;
			}
		}
		catch (err) {
			if (err.name != "DATA_ALREADY_EXISTS") {
				// Facebook may temporarily reject getThreadInfo with GraphQL error
				// 1357004 even while MQTT messages are arriving normally. Do not
				// permanently blacklist that thread: create a minimal local record
				// so message commands can still be parsed and handled.
				const errorText = String(err?.message || err);
				const transientFacebookThreadError =
					/1357004|Sorry, something went wrong/i.test(errorText) ||
					String(err?.error || "") === "1357004";
				if (transientFacebookThreadError) {
					try {
						const participantIDs = Array.isArray(event.participantIDs)
							? event.participantIDs
							: [];
						const fallbackThreadInfo = {
							threadName: event.threadName || (event.isGroup ? `Group ${threadID}` : `Chat ${threadID}`),
							userInfo: participantIDs.map(id => ({
								id: String(id),
								name: "",
								gender: null
							})),
							adminIDs: [],
						nicknames: {},
							threadType: event.isGroup ? 2 : 1,
							threadTheme: null,
						emoji: null,
						imageSrc: null,
						approvalMode: false
						};
						const fallbackData = await threadsData.create(threadID, fallbackThreadInfo);
						log.warn("DATABASE", `Facebook thread info unavailable for ${threadID}; using minimal local thread data so commands remain available`);
						return;
					}
					catch (fallbackError) {
						log.err("DATABASE", `Fallback thread creation failed for ${threadID}`, fallbackError);
					}
				}
				global.temp.createThreadDataError.push(threadID);
				log.err("DATABASE", getText("handlerCheckData", "cantCreateThread", threadID), err);
			}
		}
	}


	// ————————————— CHECK USER DATA ————————————— //
	if (senderID) {
		try {
			const findInCreatingUserData = creatingUserData.find(u => u.userID == senderID);
			if (!findInCreatingUserData) {
				if (db.allUserData.some(u => u.userID == senderID))
					return;

				const userData = await usersData.create(senderID);
				log.info("DATABASE", `New User: ${senderID} | ${userData.name} | ${config.database.type}`);
			}
			else {
				await findInCreatingUserData.promise;
			}
		}
		catch (err) {
			if (err.name != "DATA_ALREADY_EXISTS")
				log.err("DATABASE", getText("handlerCheckData", "cantCreateUser", senderID), err);
		}
	}
};