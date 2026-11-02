
const createThreadSync = require("../utils/threadSync");

let threadSync = null;

module.exports = {
	config: {
		name: "autoUpdateThreadInfo",
		version: "1.5.3",
		author: "NirZon",
		category: "events"
	},

	onStart: async ({ threadsData, event, api }) => {
		const supportedEvents = [
			"log:subscribe",
			"log:unsubscribe",
			"log:thread-admins",
			"log:thread-name",
			"log:thread-image",
			"log:thread-icon",
			"log:thread-color",
			"log:user-nickname"
		];

		if (!event || !supportedEvents.includes(event.logMessageType))
			return;

		const threadID = event.threadID;

		if (!threadID)
			return;

		try {
			// Initialize ThreadSync Core Engine once
			if (!threadSync) {
				threadSync = createThreadSync({
					api,
					threadsData
				});
			}

			console.log(
				`[ThreadSync] Event detected: ${event.logMessageType} | Thread: ${threadID}`
			);

			const result = await threadSync.syncThread(threadID);

			console.log(
				`[ThreadSync] Synced successfully | Thread: ${threadID} | Members: ${result.members} | Admins: ${result.admins}`
			);
		}
		catch (error) {
			console.error(
				`[ThreadSync] Sync failed | Thread: ${threadID}`,
				error
			);
		}
	}
};
