
module.exports = {
	config: {
		name: "autoUpdateThreadInfo",
		version: "1.5.2",
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

		// Ignore unrelated events
		if (!event || !supportedEvents.includes(event.logMessageType))
			return;

		const threadID = event.threadID;

		if (!threadID)
			return;

		try {
			console.log(
				`[NirZon ThreadSync] Event detected: ${event.logMessageType} | Thread: ${threadID}`
			);

			// Fetch latest group information
			const freshThreadInfo = await api.getThreadInfo(threadID);

			if (!freshThreadInfo) {
				throw new Error("Facebook returned empty thread information");
			}

			// Validate essential group information
			if (
				!Array.isArray(freshThreadInfo.participantIDs) ||
				!Array.isArray(freshThreadInfo.adminIDs)
			) {
				throw new Error("Invalid participantIDs or adminIDs in API response");
			}

			// Update database and cached thread information
			await threadsData.refreshInfo(threadID, freshThreadInfo);

			console.log(
				`[NirZon ThreadSync] Successfully synced | Thread: ${threadID} | Members: ${freshThreadInfo.participantIDs.length} | Admins: ${freshThreadInfo.adminIDs.length}`
			);
		}
		catch (err) {
			console.error(
				`[NirZon ThreadSync] Sync failed | Event: ${event.logMessageType} | Thread: ${threadID}`,
				err
			);
		}
	}
};
