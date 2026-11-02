
module.exports = {
	config: {
		name: "autoUpdateThreadInfo",
		version: "1.5.1",
		author: "NirZon",
		category: "events"
	},

	onStart: async ({ threadsData, event, api }) => {
		const types = [
			"log:subscribe",
			"log:unsubscribe",
			"log:thread-admins",
			"log:thread-name",
			"log:thread-image",
			"log:thread-icon",
			"log:thread-color",
			"log:user-nickname"
		];

		if (!types.includes(event.logMessageType))
			return;

		const { threadID } = event;

		try {
			// Fetch latest group information from Facebook
			const freshThreadInfo = await api.getThreadInfo(threadID);

			if (!freshThreadInfo)
				return;

			// Update cached and database thread information
			await threadsData.refreshInfo(threadID, freshThreadInfo);

		}
		catch (err) {
			console.error(
				`[autoUpdateThreadInfo] Failed to refresh ${threadID}:`,
				err
			);
		}
	}
};
