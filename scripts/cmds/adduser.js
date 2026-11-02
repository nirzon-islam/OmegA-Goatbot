
const { findUid } = global.utils;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

module.exports = {
	config: {
		name: "adduser",
		version: "1.6.1",
		author: "NirZon",
		countDown: 5,
		role: 1,
		description: {
			vi: "Thêm thành viên vào box chat của bạn",
			en: "Add user to box chat of you 'fixed'"
		},
		category: "box chat",
		guide: {
			en: "   {pn} [link profile | uid]"
		}
	},

	langs: {
		vi: {
			alreadyInGroup: "Đã có trong nhóm",
			successAdd: "- Đã thêm thành công %1 thành viên vào nhóm",
			failedAdd: "- Không thể thêm %1 thành viên vào nhóm",
			approve: "- Đã thêm %1 thành viên vào danh sách phê duyệt",
			invalidLink: "Vui lòng nhập link facebook hợp lệ",
			cannotGetUid: "Không thể lấy được uid của người dùng này",
			linkNotExist: "Profile url này không tồn tại",
			cannotAddUser: "Bot bị chặn tính năng hoặc người dùng này chặn người lạ thêm vào nhóm"
		},
		en: {
			alreadyInGroup: "Already in group",
			successAdd: "- Successfully added %1 members to the group",
			failedAdd: "- Failed to add %1 members to the group",
			approve: "- Added %1 members to the approval list",
			invalidLink: "Please enter a valid facebook link",
			cannotGetUid: "Cannot get uid of this user",
			linkNotExist: "This profile url does not exist",
			cannotAddUser: "Bot is blocked or this user blocked strangers from adding to the group"
		},
		tl: {
			alreadyInGroup: "Nasa grupo na",
			successAdd: "- Matagumpay na naidagdag ang %1 miyembro sa grupo",
			failedAdd: "- Nabigo ang pagdaragdag ng %1 miyembro sa grupo",
			approve: "- Naidagdag ang %1 miyembro sa listahan ng pag-apruba",
			invalidLink: "Mangyaring maglagay ng wastong facebook link",
			cannotGetUid: "Hindi makuha ang uid ng user na ito",
			linkNotExist: "Ang profile url na ito ay hindi umiiral",
			cannotAddUser: "Naka-block ang bot o naka-block ng user na ito ang mga estranyo mula sa pagdaragdag sa grupo"
		},
		hi: {
			alreadyInGroup: "Pehle se group mein hai",
			successAdd: "- %1 members ko group mein successfully add kar diya gaya",
			failedAdd: "- %1 members ko group mein add karne mein fail",
			approve: "- %1 members ko approval list mein add kar diya gaya",
			invalidLink: "Kripya valid facebook link dalein",
			cannotGetUid: "Is user ka uid nahi mil sakta",
			linkNotExist: "Ye profile url exist nahi karta",
			cannotAddUser: "Bot blocked hai ya is user ne strangers ko group mein add karne se block kar rakha hai"
		},
		ar: {
			alreadyInGroup: "موجود بالفعل في المجموعة",
			successAdd: "- تمت إضافة %1 عضو بنجاح إلى المجموعة",
			failedAdd: "- فشل إضافة %1 عضو إلى المجموعة",
			approve: "- تمت إضافة %1 عضو إلى قائمة الموافقة",
			invalidLink: "الرجاء إدخال رابط فيسبوك صحيح",
			cannotGetUid: "لا يمكن الحصول على uid لهذا المستخدم",
			linkNotExist: "عنوان url للملف الشخصي هذا غير موجود",
			cannotAddUser: "البوت محظور أو هذا المستخدم منع الغرباء من إضافته للمجموعة"
		},
		bn: {
			alreadyInGroup: "ইতিমধ্যে গ্রুপে আছে",
			successAdd: "- %1 জন সদস্যকে গ্রুপে সফলভাবে যোগ করা হয়েছে",
			failedAdd: "- %1 জন সদস্যকে গ্রুপে যোগ করতে ব্যর্থ",
			approve: "- %1 জন সদস্যকে approval তালিকায় যোগ করা হয়েছে",
			invalidLink: "অনুগ্রহ করে সঠিক facebook link দিন",
			cannotGetUid: "এই user এর uid পাওয়া যাচ্ছে না",
			linkNotExist: "এই profile url টি বিদ্যমান নেই",
			cannotAddUser: "Bot blocked আছে বা এই user অপরিচিতদের গ্রুপে add করা block করে রেখেছে"
		}
	},

	onStart: async function ({ message, api, event, args, threadsData, getLang }) {
		const threadID = event.threadID;
		const botID = String(api.getCurrentUserID());

		const success = [
			{ type: "success", uids: [] },
			{ type: "waitApproval", uids: [] }
		];

		const failed = [];

		function checkErrorAndPush(errorMessage, item) {
			item = item.replace(
				/(?:https?:\/\/)?(?:www\.)?(?:facebook|fb|m\.facebook)\.(?:com|me)/i,
				''
			);

			const found = failed.find(error => error.type === errorMessage);

			if (found)
				found.uids.push(item);
			else
				failed.push({
					type: errorMessage,
					uids: [item]
				});
		}

		// Get current thread settings
		const cachedInfo = await threadsData.get(threadID);
		const approvalMode = cachedInfo.approvalMode;

		// Fetch live group information
		let freshInfo;

		try {
			freshInfo = await api.getThreadInfo(threadID);

			if (!freshInfo || !Array.isArray(freshInfo.participantIDs))
				throw new Error("Invalid group participant information");

			await threadsData.refreshInfo(threadID, freshInfo);
		}
		catch (err) {
			console.error("[NirZon Adduser] Refresh error:", err);

			return message.reply(
				"❌ Group information refresh failed.\nError: " +
				(err.message || err)
			);
		}

		const liveMembers = new Set(
			freshInfo.participantIDs.map(id => String(id))
		);

		const adminIDs = (freshInfo.adminIDs || []).map(admin =>
			String(
				typeof admin === "object" && admin !== null
					? admin.id || admin.userID || admin.uid || ""
					: admin
			)
		);

		const regExMatchFB = /(?:https?:\/\/)?(?:www\.)?(?:facebook|fb|m\.facebook)\.(?:com|me)\/(?:(?:\w)*#!\/)?(?:pages\/)?(?:[\w\-]*\/)*([\w\-\.]+)(?:\/)?/i;

		for (const item of args) {
			let uid;
			let continueLoop = false;

			if (isNaN(item) && regExMatchFB.test(item)) {
				for (let i = 0; i < 10; i++) {
					try {
						uid = await findUid(item);
						break;
					}
					catch (err) {
						if (err.name === "SlowDown" || err.name === "CannotGetData") {
							await sleep(1000);
							continue;
						}

						checkErrorAndPush(
							err.name === "InvalidLink" ? getLang("invalidLink") :
							err.name === "CannotGetData" ? getLang("cannotGetUid") :
							err.name === "LinkNotExist" ? getLang("linkNotExist") :
							err.message,
							item
						);

						continueLoop = true;
						break;
					}
				}

				if (!uid && !continueLoop) {
					checkErrorAndPush(getLang("cannotGetUid"), item);
					continue;
				}
			}
			else if (!isNaN(item)) {
				uid = item;
			}
			else {
				continue;
			}

			if (continueLoop)
				continue;

			uid = String(uid);

			// Check live membership
			if (liveMembers.has(uid)) {
				checkErrorAndPush(getLang("alreadyInGroup"), item);
				continue;
			}

			try {
				await api.addUserToGroup(uid, threadID);

				if (approvalMode === true && !adminIDs.includes(botID))
					success[1].uids.push(uid);
				else
					success[0].uids.push(uid);

				await sleep(500);
			}
			catch (err) {
				console.error(`[NirZon Adduser] Failed to add ${uid}:`, err);

				const errorText = String(err.message || err);

				if (/already in group|member already exists/i.test(errorText)) {
					checkErrorAndPush(getLang("alreadyInGroup"), item);
				}
				else {
					checkErrorAndPush(
						getLang("cannotAddUser") + ` (${errorText})`,
						item
					);
				}
			}
		}

		// Refresh cache after processing
		try {
			const updatedInfo = await api.getThreadInfo(threadID);

			if (updatedInfo)
				await threadsData.refreshInfo(threadID, updatedInfo);
		}
		catch (err) {
			console.error("[NirZon Adduser] Final refresh error:", err);
		}

		const totalSuccess = success[0].uids.length;
		const totalApproval = success[1].uids.length;
		const totalFailed = failed.reduce(
			(total, item) => total + item.uids.length,
			0
		);

		let msg = "";

		if (totalSuccess)
			msg += `${getLang("successAdd", totalSuccess)}\n`;

		if (totalApproval)
			msg += `${getLang("approve", totalApproval)}\n`;

		if (totalFailed) {
			msg += `${getLang("failedAdd", totalFailed)}`;

			for (const item of failed) {
				msg += `\n    + ${item.uids.join("\n       ")}: ${item.type}`;
			}
		}

		await message.reply(msg || "⚠️ No valid user ID found.");
	}
};
