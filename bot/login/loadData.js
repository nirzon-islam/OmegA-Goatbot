const fs = require('fs-extra');
const chalk = require('chalk');
const path = require('path');
const { log, createOraDots, getText } = global.utils;

const bigText = `
 _   _ _____ ____  ______ ___  _   _
| \ | |_   _|  _ \|__  / _ \| \ | |
|  \| | | | | |_) | / / | | |  \| |
| |\  | | | |  _ < / /| | | | |\  |
|_| \_| |_| |_| \_\/____\___/|_| \_|
`;

const THREAD_LIST_PAGE_SIZE = 100;
const THREAD_LIST_MAX_PAGES = 100;

function toLegacyThreadInfo(thread) {
  const participants = Array.isArray(thread.participants) ? thread.participants : [];
  const nicknames = Array.isArray(thread.nicknames) ? thread.nicknames : [];

  return {
    ...thread,
    threadName: thread.name || thread.threadName || null,
    userInfo: participants.map(user => ({
      id: user.userID,
      name: user.name,
      gender: user.gender
    })),
    adminIDs: (Array.isArray(thread.adminIDs) ? thread.adminIDs : []).map(id =>
      typeof id === 'object' && id !== null ? id : ({ id })
    ),
    nicknames: nicknames.reduce((result, item) => {
      if (item && item.userID != null) result[item.userID] = item.nickname;
      return result;
    }, {}),
    threadType: thread.threadType || (thread.isGroup ? 2 : 1)
  };
}

async function getAllThreadInfo(api) {
  if (!api || typeof api.getThreadList !== 'function') {
    throw new Error('OmegA-FCA getThreadList() is not available');
  }

  const threadsById = new Map();
  let cursor = null;

  for (let page = 0; page < THREAD_LIST_MAX_PAGES; page++) {
    const items = await api.getThreadList(THREAD_LIST_PAGE_SIZE, cursor, 'INBOX');
    if (!Array.isArray(items) || items.length === 0) break;

    for (const item of items) {
      if (item && item.threadID != null) {
        threadsById.set(String(item.threadID), toLegacyThreadInfo(item));
      }
    }

    if (items.length < THREAD_LIST_PAGE_SIZE) break;

    const oldestTimestamp = Number(items[items.length - 1]?.timestamp);
    if (!Number.isSafeInteger(oldestTimestamp) || oldestTimestamp <= 0 || oldestTimestamp === cursor) {
      break;
    }
    cursor = oldestTimestamp;
  }

  return [...threadsById.values()];
}

module.exports = async function (api, createLine) {
  console.log(chalk.green(bigText));
  log.info('DATABASE', 'Loading system resources…');

  const controller = await require(path.join(__dirname, '..', '..', 'database/controller/index.js'))(api);
  const {
    threadModel, userModel, dashBoardModel, globalModel,
    threadsData, usersData, dashBoardData, globalData, sequelize
  } = controller;

  log.info('DATABASE', '🧵 Thread data: OK');
  log.info('DATABASE', '👤 User data: OK');

  const AUTO_SYNC_MIN_INTERVAL_MS = 6 * 60 * 60 * 1000;
  const lastAutoSyncPath = path.join(__dirname, '..', '..', 'database/data/lastAutoSync.json');
  let shouldAutoSync = true;
  let lastAutoSyncAt = 0;

  try {
    if (fs.existsSync(lastAutoSyncPath)) {
      lastAutoSyncAt = (fs.readJsonSync(lastAutoSyncPath) || {}).lastAutoSyncAt || 0;
      shouldAutoSync = Date.now() - lastAutoSyncAt >= AUTO_SYNC_MIN_INTERVAL_MS;
    }
  } catch {
    shouldAutoSync = true;
  }

  const autoSyncEnabled = api && global.GoatBot.config.database.autoSyncWhenStart == true;

  if (autoSyncEnabled && shouldAutoSync) {
    log.info('DATABASE', 'Auto sync enabled — refreshing thread data');
    const spin = createOraDots(getText('loadData', 'refreshingThreadData'));
    let originalLogLevel;

    try {
      if (typeof api.setOptions === 'function') {
        originalLogLevel = global.GoatBot.config.optionsFca?.logLevel;
        api.setOptions({ logLevel: 'silent' });
      }
      spin._start();

      const fetchedThreads = await getAllThreadInfo(api);
      const threadDataById = new Map(
        (Array.isArray(global.db.allThreadData) ? global.db.allThreadData : [])
          .filter(thread => thread && thread.threadID != null)
          .map(thread => [String(thread.threadID), thread])
      );

      for (const threadInfo of fetchedThreads) {
        const threadID = String(threadInfo.threadID);
        let savedThread;

        if (threadDataById.has(threadID)) {
          savedThread = await threadsData.refreshInfo(threadID, threadInfo);
        } else {
          savedThread = await threadsData.create(threadID, threadInfo);
        }

        threadDataById.set(threadID, savedThread);
        if (global.db.receivedTheFirstMessage) {
          global.db.receivedTheFirstMessage[threadID] = true;
        }
      }

      const fetchedIds = new Set(fetchedThreads.map(thread => String(thread.threadID)));
      const botID = typeof api.getCurrentUserID === 'function'
        ? String(api.getCurrentUserID())
        : null;

      for (const [threadID, thread] of threadDataById) {
        if (fetchedIds.has(threadID) || !Array.isArray(thread.members)) continue;
        const me = thread.members.find(member => String(member.userID) === botID);
        if (me && me.inGroup !== false) {
          const updated = await threadsData.set(threadID, {
            members: thread.members.map(member =>
              String(member.userID) === botID ? { ...member, inGroup: false } : member
            )
          });
          threadDataById.set(threadID, updated || thread);
        }
      }

      global.db.allThreadData = [...threadDataById.values()];
      spin._stop();
      log.info('DATABASE', getText('loadData', 'refreshThreadDataSuccess', global.db.allThreadData.length));

      try {
        fs.ensureDirSync(path.dirname(lastAutoSyncPath));
        fs.writeJsonSync(lastAutoSyncPath, { lastAutoSyncAt: Date.now() }, { spaces: 2 });
      } catch (writeError) {
        log.warn('DATABASE', 'Could not persist auto-sync timestamp', writeError);
      }
    } catch (err) {
      spin._stop();
      log.error('DATABASE', getText('loadData', 'refreshThreadDataError'), err);
    } finally {
      if (typeof api.setOptions === 'function') {
        api.setOptions({ logLevel: originalLogLevel ?? global.GoatBot.config.optionsFca?.logLevel ?? 'error' });
      }
    }
  } else if (autoSyncEnabled && !shouldAutoSync) {
    log.info('DATABASE', `Auto sync skipped — last ran ${Math.round((Date.now() - lastAutoSyncAt) / 60000)}m ago (min interval 6h)`);
  }

  log.info('DATABASE', 'System ready');

  // OmegA-FCA initializes its optional local Signal runtime during login and
  // exposes it as api.e2ee. The old _connectE2EEAndMerge hook is not part of
  // OmegA-FCA and must not be called here; local initialization is not a claim
  // that Messenger's private E2EE transport is connected.

  return {
    threadModel: threadModel || null,
    userModel: userModel || null,
    dashBoardModel: dashBoardModel || null,
    globalModel: globalModel || null,
    threadsData,
    usersData,
    dashBoardData,
    globalData,
    sequelize
  };
};
