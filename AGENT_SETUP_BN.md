# 🤖 Agent Setup Help — OmegA-Goatbot

**Project Owner:** Md SalmaN (NirZon)  
**GoatBot Repository:** https://github.com/nirzon-islam/OmegA-Goatbot  
**Agent Backend Repository:** https://github.com/nirzon-islam/Agent-Backend  
**Agent Backend URL:** https://agent-backend-jron.onrender.com

এই ফাইলটি GoatBot repository-র Agent integration setup reference। GoatBot কীভাবে configure করতে হয় এবং Agent Backend-এর সঙ্গে সংযোগের জন্য কোন setting লাগে—তা এখানে লেখা আছে।

## ১. দুই repository-র দায়িত্ব 🗂️

- **OmegA-Goatbot (এই repository):** Facebook Messenger bot/runtime। Railway বা VPS-এ চালানো হয়।
- **Agent-Backend:** AI planner, task/approval manager, dashboard ও secure bridge server। Render-এ host করা হয়।

Agent-এর backend configuration Agent-Backend repository-তে থাকবে। GoatBot-এর bot config, Facebook session এবং runtime source এই repository-তে থাকবে।

## ২. GoatBot-এর সাধারণ setup

এই repository-র README অনুযায়ী:

1. Node.js 20.x runtime ব্যবহার করো।
2. Repository clone করে project directory-তে ঢোকো।
3. dependency install করো: `npm install`
4. Facebook cookie JSON array format-এ project root-এর `account.txt` ফাইলে দাও।
5. `config.json`-এ bot configuration এবং `adminBot`-এ bot admin Facebook UID configure করো।
6. README-তে দেখানো startup command `node index.js`; Railway/VPS deployment-এ project-এর configured start command যাচাই করো।

`account.txt`-এর cookie হলো Facebook login session। এটিকে password-এর মতো গোপন রাখবে। GitHub-এ commit করবে না, Messenger-এ পাঠাবে না এবং screenshot-এ প্রকাশ করবে না। Session invalid/expired হলে Owner নিরাপদে নতুন session দেবে।

## ৩. Railway deployment 🚂

- GoatBot-এর runtime Railway বা VPS-এর জন্য; repository README-তে Render ব্যবহার না করতে বলা হয়েছে, কারণ persistent MQTT/WebSocket connection ও session/appstate filesystem write দরকার।
- Railway project-এর সংশ্লিষ্ট service-এ repository ও branch ঠিক আছে কি না দেখো।
- Variables/Deploy logs থেকে runtime status, start command ও restart reason পরীক্ষা করো।
- Render-এর Agent Backend এবং Railway-এর GoatBot আলাদা service; একটির environment variable অন্যটিতে বসবে না।

## ৪. Agent Backend-এর সঙ্গে সংযোগ 🔗

Agent Backend-এর deployment reference অনুযায়ী GoatBot worker host-এ নিচের variable-গুলো ব্যবহৃত হয়:

| Variable | কী দিতে হবে |
|---|---|
| `AGENT_BRIDGE_ENABLED` | GoatBot bridge client enable flag |
| `AGENT_WORKER_ENABLED` | worker enable flag |
| `AGENT_BACKEND_URL` | `https://agent-backend-jron.onrender.com` |
| `AGENT_BRIDGE_SECRET` | Agent Backend Render-এর `BRIDGE_SECRET`-এর সঙ্গে হুবহু একই secret |
| `AGENT_WORKSPACE_ROOT` | optional; worker workspace path; unset থাকলে documented default process working directory |

**সতর্কতা — branch/source যাচাই আবশ্যক:** OmegA-Goatbot-এর main branch README-তে Agent bridge/worker setup documented নেই এবং main branch code search-এ `AGENT_BRIDGE_ENABLED`, `AGENT_WORKER_ENABLED`, `AGENT_BACKEND_URL` reference পাওয়া যায়নি। তাই এই variables Agent-Backend deployment guide-এ নির্ধারিত হলেও, GoatBot-এর active branch-এ সংশ্লিষ্ট bridge/worker code উপস্থিত না থাকলে এগুলো একা integration চালু করবে না। Environment variable enable করার আগে active Railway branch-এর runtime entry (যেমন `EryXenX.js`) ও worker source পরীক্ষা করো।

### Shared secret 🔐

1. কমপক্ষে ৩২-character random secret তৈরি করো।
2. Agent-Backend Render Environment-এ `BRIDGE_SECRET` হিসেবে রাখো।
3. GoatBot Railway Variables-এ একই value `AGENT_BRIDGE_SECRET` হিসেবে রাখো।
4. দুই পাশের value হুবহু match করতে হবে।
5. Secret কোনো code, README, issue, Messenger chat, screenshot বা এই help file-এ লিখবে না।

Bridge enable করার backend flag হলো `BRIDGE_ENABLED`; GoatBot-side documented flags হলো `AGENT_BRIDGE_ENABLED` এবং `AGENT_WORKER_ENABLED`। Backend deployment guide অনুযায়ী integration ও database-backed tests সম্পন্ন/যাচাই না হওয়া পর্যন্ত bridge এবং worker disabled রাখতে হবে।

## ৫. Sender permission 👤

Agent Backend-এ sender permission configure হয়:

- `AGENT_ALLOWED_SENDER_IDS`: যেসব Facebook sender Agent-এ request পাঠাতে পারবে।
- `AGENT_OWNER_SENDER_IDS`: যেসব Owner sender Messenger থেকে pending approval দেখা/approve/reject করতে পারবে।

এই variable-গুলোর authoritative backend configuration Agent-Backend Render Environment-এ। GoatBot-এ একই নামে variable যোগ করার আগে active GoatBot source সেটি পড়ে কি না যাচাই করো। Facebook UID অনুমান করে বসাবে না।

## ৬. GoatBot-এর নিজস্ব config ⚙️

Repository README-তে বর্ণিত:
- `config.json`-এর `prefix` — command prefix;
- `adminBot` — bot admin UID list;
- `noPrefix.enable` — admin no-prefix behavior;
- `e2ee.enable` — encrypted thread support connection;
- `optionsFca` — FCA/MQTT connection options;
- `humanizer` — command reply delay/cooldown settings।

কিছু setting `{prefix}setting` command দিয়ে live পরিবর্তন করা যায় বলে README-তে উল্লেখ আছে। Exact current behavior জানতে active branch-এর config ও command source দেখবে।

## ৭. Worker-এর documented capability

Agent-Backend deployment guide অনুযায়ী worker capability-র মধ্যে আছে workspace inventory/read, create/edit, backup-সহ delete, hash-verified restore, move/rename, directory create, empty-directory removal, JavaScript syntax check, fixed npm operations (`npm ci --ignore-scripts`, `npm update --ignore-scripts`) এবং Owner-approved supervisor restart।

Protected path-এর মধ্যে Git metadata, dependency folders, hidden files, credentials, account/appstate/cookie data এবং internal backup storage আছে। Arbitrary shell command বা npm lifecycle script চালানো হয় না।

এই capability Agent-Backend documentation-এ বর্ণিত; active GoatBot branch-এ worker integration সত্যিই আছে কি না source দেখে নিশ্চিত হবে।

## ৮. Troubleshooting 🧰

| সমস্যা | কী পরীক্ষা করবে |
|---|---|
| GoatBot login হচ্ছে না | `account.txt`-এর cookie format/session validity, Railway logs |
| Bot বারবার restart হচ্ছে | Railway deploy/runtime logs, startup error, Node version ও dependency install |
| Command কাজ করছে না | `config.json` prefix, command file ও admin UID |
| Agent request backend-এ পৌঁছায় না | active branch-এ bridge client আছে কি না, bridge flag, backend URL, signed request logs |
| Bridge unauthorized | Render `BRIDGE_SECRET` ও Railway `AGENT_BRIDGE_SECRET` exact match |
| Sender denied | backend `AGENT_ALLOWED_SENDER_IDS`-এ সঠিক sender UID |
| Owner approval denied | backend `AGENT_OWNER_SENDER_IDS`-এ সঠিক Owner UID |
| Worker কাজ করছে না | active worker source, worker flag, workspace path, Railway logs |
| Agent API unavailable | Render service status ও `/api/health` |

## ৯. গুরুত্বপূর্ণ security rules

- Facebook cookie/AppState, API key, database URI, password এবং bridge secret কখনো commit/share করবে না।
- `account.txt` runtime credential file; public repository-তে রাখা যাবে না।
- Owner approval ছাড়া sensitive file modification বা restart করা যাবে না।
- কোনো secret Git history-তে চলে গেলে provider থেকে rotate/revoke করতে হবে।
- Setup guide পড়া বা environment variable যোগ করা মানেই live integration verified নয়।

## ১০. Related source files 📚

**এই GoatBot repository**
- `README.md` — install, login, Railway/VPS runtime, command structure ও config overview
- `config.json` — bot configuration
- `account.txt` — local/runtime Facebook session cookie file; secret
- `index.js` — README-তে দেখানো startup entry
- `EryXenX.js` — Agent-Backend deployment doc-এ worker startup entry হিসেবে উল্লেখিত; active branch-এ আছে কি না যাচাই করবে

**Agent-Backend repository**
- `.env.example` — Render environment reference
- `agent/config.js` — backend config
- `AGENT_DEPLOYMENT.md` — Render/Railway bridge variable reference
- `agent/routes/bridge.js` — backend bridge endpoints

---

**Maintained for:** Md SalmaN (NirZon)  
**Projects:** OmegA-Goatbot × Agent Backend  
**Note:** এই নথি setup reference; এটি নিজে কোনো Railway/Render deploy বা restart করে না।
