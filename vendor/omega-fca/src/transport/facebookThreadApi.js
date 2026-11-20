"use strict";

const { createFacebookWebClient } = require("../auth/facebookWebClient");
const { createFacebookError } = require("../auth/facebookResponse");

const GRAPHQL_BATCH = "https://www.facebook.com/api/graphqlbatch/";
const USER_INFO_URL = "https://www.facebook.com/chat/user_info/";
const SEND_URL = "https://www.facebook.com/messaging/send/";
const REMOVE_URL = "https://www.facebook.com/chat/remove_participants";
const NICKNAME_URL = "https://www.facebook.com/messaging/save_thread_nickname/?source=thread_settings&dpr=1";
const REACTION_URL = "https://www.facebook.com/webgraphql/mutation/";
const READ_URL = "https://www.facebook.com/ajax/mercury/change_read_status.php";

// Public FCA document IDs. Facebook changes private web query IDs without notice.
const DOC_IDS = Object.freeze({
  threadList: "1349387578499440",
  threadInfo: "1498317363570230",
  threadHistory: "1498317363570230",
  reaction: "1491398900900362"
});

function id(value, label) {
  const result = String(value ?? "");
  if (!/^\d{5,30}$/.test(result)) throw new TypeError(label + " must be a numeric Facebook ID");
  return result;
}
function object(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
function first(...values) { return values.find(value => value !== undefined && value !== null) ?? null; }
function graphResult(payload, operation) {
  if (!Array.isArray(payload) || !payload.length) {
    throw createFacebookError(operation + ": Facebook returned an unexpected GraphQL batch response", {
      code: "FCA_RESPONSE_SHAPE_INVALID", retryable: false
    });
  }
  const status = object(payload[payload.length - 1]);
  if (Number(status.error_results || 0) > 0 || status.error) {
    const detail = object(payload[0]).o0?.errors?.[0];
    throw createFacebookError(operation + ": Facebook rejected the GraphQL request" +
      (detail?.message ? ": " + String(detail.message).slice(0, 180) : ""), {
      code: "FCA_FACEBOOK_REQUEST_REJECTED", retryable: false
    });
  }
  if (Number(status.successful_results ?? 1) === 0) {
    throw createFacebookError(operation + ": Facebook reported no successful GraphQL result", {
      code: "FCA_RESPONSE_EMPTY", retryable: true
    });
  }
  return object(payload[0]).o0;
}
function threadKey(thread) {
  const key = object(thread?.thread_key);
  return first(key.thread_fbid, key.other_user_id, thread?.threadID, thread?.thread_id);
}
function participants(thread) {
  const nodes = object(thread?.all_participants).nodes;
  if (!Array.isArray(nodes)) return [];
  return nodes.map(item => {
    const actor = object(item?.messaging_actor);
    return {
      userID: actor.id == null ? null : String(actor.id),
      name: actor.name ?? null,
      profilePicture: actor.big_image_src?.uri ?? null,
      url: actor.url ?? null,
      username: actor.username ?? null,
      accountType: actor.__typename ?? null
    };
  }).filter(item => item.userID);
}
function formatThread(thread) {
  const customization = object(thread?.customization_info);
  const last = thread?.last_message?.nodes?.[0] || null;
  const people = participants(thread);
  const idValue = threadKey(thread);
  return {
    threadID: idValue == null ? null : String(idValue),
    name: thread?.name || (people.find(person => person.userID === String(thread?.thread_key?.other_user_id))?.name ?? null),
    unreadCount: Number(thread?.unread_count || 0),
    messageCount: Number(thread?.messages_count || 0),
    imageSrc: thread?.image?.uri ?? null,
    emoji: customization.emoji ?? null,
    color: customization.outgoing_bubble_color ? String(customization.outgoing_bubble_color).replace(/^FF/i, "") : null,
    nicknames: (customization.participant_customizations || []).map(item => ({
      userID: String(item.participant_id), nickname: item.nickname ?? null
    })),
    muteUntil: thread?.mute_until ?? null,
    participants: people,
    participantIDs: people.map(person => person.userID),
    adminIDs: (thread?.thread_admins || []).map(item => String(item.id ?? item)),
    folder: thread?.folder ?? null,
    isGroup: thread?.thread_type === "GROUP",
    isArchived: Boolean(thread?.has_viewer_archived),
    isSubscribed: Boolean(thread?.is_viewer_subscribed),
    timestamp: first(thread?.updated_time_precise, null),
    snippet: last?.snippet ?? null,
    snippetAttachments: last?.extensible_attachment ?? null,
    snippetSender: last?.message_sender?.messaging_actor?.id == null ? null : String(last.message_sender.messaging_actor.id),
    lastMessageTimestamp: last?.timestamp_precise ?? null,
    lastReadTimestamp: thread?.last_read_receipt?.nodes?.[0]?.timestamp_precise ?? null,
    cannotReplyReason: thread?.cannot_reply_reason ?? null,
    threadType: thread?.thread_type === "GROUP" ? 2 : 1
  };
}
function formatMessage(message, threadID, isGroup) {
  const senderID = first(message?.message_sender?.id, message?.message_sender?.messaging_actor?.id);
  const messageID = first(message?.message_id, message?.messageID);
  const body = message?.message?.text ?? message?.snippet ?? "";
  const attachments = Array.isArray(message?.blob_attachments) ? message.blob_attachments : [];
  const mentions = {};
  for (const range of message?.message?.ranges || []) {
    if (range?.entity?.id != null) mentions[String(range.entity.id)] = body.substr(range.offset || 0, range.length || 0);
  }
  return {
    type: "message", threadID: String(threadID), messageID: messageID == null ? null : String(messageID),
    senderID: senderID == null ? null : String(senderID), timestamp: first(message?.timestamp_precise, null),
    body, attachments, mentions, isGroup: Boolean(isGroup), isUnread: Boolean(message?.unread),
    messageReactions: Array.isArray(message?.message_reactions) ? message.message_reactions : []
  };
}
function callbackResult(operation, callback) {
  if (typeof callback !== "function") return operation;
  operation.then(value => callback(null, value), error => callback(error));
  return undefined;
}
function unwrapGraph(response, operation) {
  const result = graphResult(response.payload, operation);
  return result?.data ?? result;
}

function createFacebookThreadApi({ session, webClient } = {}) {
  if (!session || typeof session.request !== "function") throw new TypeError("An active personal session is required");
  const web = webClient || createFacebookWebClient({ session });
  const currentUserID = id(session.userId, "session.userId");

  async function graph(queryParams, docId, operation) {
    const payload = await web.post(GRAPHQL_BATCH, {
      av: currentUserID,
      queries: JSON.stringify({ o0: { doc_id: docId, query_params: queryParams } })
    });
    return unwrapGraph(payload, operation);
  }

  function getThreadList(limit, timestamp = null, tags = [], callback) {
    if (typeof tags === "function") { callback = tags; tags = []; }
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new TypeError("getThreadList limit must be an integer from 1 to 100");
    if (timestamp !== null && (!Number.isSafeInteger(timestamp) || timestamp < 0)) throw new TypeError("getThreadList timestamp must be an integer or null");
    if (typeof tags === "string") tags = [tags];
    if (!Array.isArray(tags) || tags.some(tag => typeof tag !== "string" || tag.length > 32)) throw new TypeError("getThreadList tags must be an array of strings");
    const operation = (async () => {
      const data = await graph({
        limit: limit + (timestamp ? 1 : 0), before: timestamp, tags,
        includeDeliveryReceipts: true, includeSeqID: false
      }, DOC_IDS.threadList, "getThreadList");
      const nodes = data?.viewer?.message_threads?.nodes;
      if (!Array.isArray(nodes)) throw createFacebookError("getThreadList: response is missing message_threads.nodes", { code: "FCA_RESPONSE_SHAPE_INVALID", retryable: false });
      if (timestamp) nodes.shift();
      return nodes.map(formatThread);
    })();
    return callbackResult(operation, callback);
  }

  function getThreadInfo(threadID, callback) {
    const thread = id(threadID, "threadID");
    const operation = (async () => {
      const data = await graph({
        id: thread, message_limit: 0, load_messages: 0, load_read_receipts: false, before: null
      }, DOC_IDS.threadInfo, "getThreadInfo");
      const raw = data?.message_thread;
      if (!raw) throw createFacebookError("getThreadInfo: response is missing message_thread", { code: "FCA_RESPONSE_SHAPE_INVALID", retryable: false });
      return formatThread(raw);
    })();
    return callbackResult(operation, callback);
  }

  function getThreadHistory(threadID, amount, timestamp, callback) {
    if (typeof timestamp === "function") { callback = timestamp; timestamp = undefined; }
    const thread = id(threadID, "threadID");
    if (!Number.isInteger(amount) || amount < 1 || amount > 100) throw new TypeError("getThreadHistory amount must be an integer from 1 to 100");
    if (timestamp !== undefined && timestamp !== null && (!Number.isSafeInteger(Number(timestamp)) || Number(timestamp) < 0)) {
      throw new TypeError("getThreadHistory timestamp must be an integer, null, or undefined");
    }
    const operation = (async () => {
      const data = await graph({
        id: thread, message_limit: amount, load_messages: 1, load_read_receipts: false,
        before: timestamp == null ? null : Number(timestamp)
      }, DOC_IDS.threadHistory, "getThreadHistory");
      const raw = data?.message_thread;
      const nodes = raw?.messages?.nodes;
      if (!Array.isArray(nodes)) throw createFacebookError("getThreadHistory: response is missing messages.nodes", { code: "FCA_RESPONSE_SHAPE_INVALID", retryable: false });
      const isGroup = raw.thread_type === "GROUP";
      return nodes.map(message => formatMessage(message, thread, isGroup)).filter(message => message.messageID);
    })();
    return callbackResult(operation, callback);
  }

  function getUserInfo(ids, callback) {
    const list = Array.isArray(ids) ? ids : [ids];
    if (!list.length || list.length > 100) throw new TypeError("getUserInfo requires 1 to 100 user IDs");
    const normalized = list.map(value => id(value, "userID"));
    const body = Object.fromEntries(normalized.map((value, index) => ["ids[" + index + "]", value]));
    const operation = (async () => {
      const response = await web.post(USER_INFO_URL, body);
      const profiles = response.payload?.payload?.profiles;
      if (!profiles || typeof profiles !== "object" || Array.isArray(profiles)) {
        throw createFacebookError("getUserInfo: response is missing payload.profiles", { code: "FCA_RESPONSE_SHAPE_INVALID", retryable: false });
      }
      return Object.fromEntries(Object.entries(profiles).map(([userID, profile]) => [userID, {
        name: profile?.name ?? null, firstName: profile?.firstName ?? null, vanity: profile?.vanity ?? null,
        thumbSrc: profile?.thumbSrc ?? null, profileUrl: profile?.uri ?? null, gender: profile?.gender ?? null,
        type: profile?.type ?? null, isFriend: Boolean(profile?.is_friend), isBirthday: Boolean(profile?.is_birthday)
      }]));
    })();
    return callbackResult(operation, callback);
  }

  function addUserToGroup(userIDs, threadID, callback) {
    const thread = id(threadID, "threadID");
    const users = (Array.isArray(userIDs) ? userIDs : [userIDs]).map(value => id(value, "userID"));
    if (!users.length || users.length > 50) throw new TypeError("addUserToGroup requires 1 to 50 user IDs");
    const stamp = Date.now();
    const body = {
      client: "mercury", action_type: "ma-type:log-message", author: "fbid:" + currentUserID,
      timestamp: stamp, timestamp_absolute: "Today", timestamp_relative: "0", timestamp_time_passed: "0",
      is_unread: false, is_cleared: false, is_forward: false, source: "source:chat:web",
      "source_tags[0]": "source:chat", log_message_type: "log:subscribe", status: "0",
      offline_threading_id: String(stamp * 1000), message_id: String(stamp * 1000),
      manual_retry_cnt: "0", thread_fbid: thread
    };
    users.forEach((user, index) => { body["log_message_data[added_participants][" + index + "]"] = "fbid:" + user; });
    const operation = web.post(SEND_URL, body).then(result => {
      if (!result.payload || result.payload.error) throw createFacebookError("addUserToGroup: Facebook rejected the group update", { code: "FCA_FACEBOOK_REQUEST_REJECTED", retryable: false });
      return result.payload;
    });
    return callbackResult(operation, callback);
  }

  function removeUserFromGroup(userID, threadID, callback) {
    const body = { uid: id(userID, "userID"), tid: id(threadID, "threadID") };
    const operation = web.post(REMOVE_URL, body).then(result => {
      if (!result.payload || result.payload.error) throw createFacebookError("removeUserFromGroup: Facebook rejected the group update", { code: "FCA_FACEBOOK_REQUEST_REJECTED", retryable: false });
      return result.payload;
    });
    return callbackResult(operation, callback);
  }

  function changeNickname(nickname, threadID, participantID, callback) {
    if (typeof nickname !== "string" || nickname.length > 80) throw new TypeError("nickname must be a string up to 80 characters");
    const body = { nickname, participant_id: id(participantID, "participantID"), thread_or_other_fbid: id(threadID, "threadID") };
    const operation = web.post(NICKNAME_URL, body).then(result => {
      if (!result.payload || result.payload.error) throw createFacebookError("changeNickname: Facebook rejected the nickname update", { code: "FCA_FACEBOOK_REQUEST_REJECTED", retryable: false });
      return result.payload;
    });
    return callbackResult(operation, callback);
  }

  function setMessageReaction(reaction, messageID, callback) {
    if (typeof reaction !== "string" || reaction.length > 16) throw new TypeError("reaction must be an emoji, shortcut, or empty string");
    if (typeof messageID !== "string" || !messageID || messageID.length > 256) throw new TypeError("messageID is invalid");
    const aliases = { ":heart_eyes:": "😍", ":love:": "😍", ":laughing:": "😆", ":haha:": "😆",
      ":open_mouth:": "😮", ":wow:": "😮", ":cry:": "😢", ":sad:": "😢", ":angry:": "😠",
      ":thumbsup:": "👍", ":like:": "👍", ":thumbsdown:": "👎", ":dislike:": "👎" };
    const value = aliases[reaction] ?? reaction;
    const body = { doc_id: DOC_IDS.reaction, variables: JSON.stringify({ data: {
      client_mutation_id: 1, actor_id: currentUserID,
      action: value === "" ? "REMOVE_REACTION" : "ADD_REACTION", message_id: messageID, reaction: value
    } }), dpr: 1 };
    const operation = web.post(REACTION_URL, body).then(result => result.payload);
    return callbackResult(operation, callback);
  }

  function markAsRead(threadID, read = true, callback) {
    if (typeof read === "function") { callback = read; read = true; }
    if (typeof read !== "boolean") throw new TypeError("read must be a boolean");
    const thread = id(threadID, "threadID");
    const body = { ["ids[" + thread + "]"]: read, watermarkTimestamp: Date.now(),
      shouldSendReadReceipt: true, commerce_last_message_type: "non_ad" };
    const operation = web.post(READ_URL, body).then(result => result.payload);
    return callbackResult(operation, callback);
  }

  return Object.freeze({ getThreadList, getThreadInfo, getThreadHistory, getUserInfo,
    addUserToGroup, removeUserFromGroup, changeNickname, setMessageReaction, markAsRead });
}

module.exports = { createFacebookThreadApi, DOC_IDS };
