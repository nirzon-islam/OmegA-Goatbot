
const createThreadSync = ({ api, threadsData }) => {
	const syncing = new Map();

	const sleep = ms =>
		new Promise(resolve => setTimeout(resolve, ms));

	function normalizeID(id) {
		if (id && typeof id === "object") {
			id = id.id ?? id.userID ?? id.uid;
		}

		return id == null ? "" : String(id);
	}

	function validateThreadInfo(info) {
		if (!info || typeof info !== "object")
			throw new Error("Invalid thread information");

		if (!Array.isArray(info.participantIDs))
			throw new Error("Invalid participantIDs");

		if (!Array.isArray(info.adminIDs))
			throw new Error("Invalid adminIDs");

		const participants = info.participantIDs
			.map(normalizeID)
			.filter(Boolean);

		const admins = info.adminIDs
			.map(normalizeID)
			.filter(Boolean);

		if (participants.length !== info.participantIDs.length)
			throw new Error("Invalid member ID detected");

		if (admins.length !== info.adminIDs.length)
			throw new Error("Invalid admin ID detected");

		return {
			participants,
			admins
		};
	}

	async function syncThread(threadID, options = {}) {
		threadID = String(threadID);

		if (!threadID)
			throw new Error("Thread ID is required");

		// Prevent duplicate simultaneous sync
		if (syncing.has(threadID))
			return syncing.get(threadID);

		const task = (async () => {
			const attempts = options.attempts || 3;
			let lastError;

			for (let attempt = 1; attempt <= attempts; attempt++) {
				try {
					const info = await api.getThreadInfo(threadID);

					const validated = validateThreadInfo(info);

					// Do not overwrite database with incomplete information
					if (!validated.participants.length)
						throw new Error("Empty member list received");

					await threadsData.refreshInfo(threadID, info);

					return {
						success: true,
						threadID,
						members: validated.participants.length,
						admins: validated.admins.length
					};
				}
				catch (error) {
					lastError = error;

					console.error(
						`[ThreadSync] Sync attempt ${attempt}/${attempts} failed:`,
						threadID,
						error.message || error
					);

					if (attempt < attempts)
						await sleep(attempt * 1500);
				}
			}

			throw lastError;
		})();

		syncing.set(threadID, task);

		try {
			return await task;
		}
		finally {
			syncing.delete(threadID);
		}
	}

	async function syncAllThreads() {
		const allThreads = await threadsData.getAll();

		if (!Array.isArray(allThreads))
			throw new Error("Could not retrieve thread list");

		const results = {
			total: allThreads.length,
			success: 0,
			failed: 0
		};

		// Process in small batches
		const batchSize = 3;

		for (let i = 0; i < allThreads.length; i += batchSize) {
			const batch = allThreads.slice(i, i + batchSize);

			const batchResults = await Promise.allSettled(
				batch.map(thread => {
					const threadID = thread.threadID || thread.id;

					if (!threadID)
						throw new Error("Missing thread ID");

					return syncThread(threadID);
				})
			);

			for (const result of batchResults) {
				if (result.status === "fulfilled")
					results.success++;
				else {
					results.failed++;

					console.error(
						"[ThreadSync] Batch sync failed:",
						result.reason
					);
				}
			}

			await sleep(1000);
		}

		console.log(
			`[ThreadSync] Completed: ${results.success}/${results.total} synced, ${results.failed} failed`
		);

		return results;
	}

	return {
		syncThread,
		syncAllThreads,
		isSyncing: threadID => syncing.has(String(threadID))
	};
};

module.exports = createThreadSync;
