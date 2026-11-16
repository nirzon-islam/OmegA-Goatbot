# Railway Agent Bridge

`!agent` কমান্ড দিয়ে Owner GoatBot server-এর project file নিয়ে কাজের অনুরোধ করতে পারবেন। AI Planner কাজের নির্দিষ্ট action/plan তৈরি করবে; Railway Worker কোনো পরিবর্তন করার আগে Dashboard থেকে Owner-এর approval বাধ্যতামূলক।

## Project workspace access

Agent workspace-এর সাধারণ text/code project file পড়তে, list করতে, নতুন file তৈরি করতে এবং edit করতে পারে। যেমন:

- `scripts/cmds/`: Messenger command files
- `scripts/events/`: event handlers
- `modules/`, `utils/`: shared modules ও helper
- `config.json`, documentation এবং অন্যান্য supported text/code files

নিরাপত্তার জন্য hidden files, `.git/`, `node_modules/`, `.env*`, credentials, cookies, account/appstate/session data, `Fca_Database/`, secrets এবং cache path নিষিদ্ধ। Symlink এবং workspace-এর বাইরের path প্রত্যাখ্যান করা হয়। Supported text extensions: `.js`, `.cjs`, `.mjs`, `.json`, `.md`, `.txt`, `.yml`, `.yaml`, `.lang`, `.html`, `.css`, `.xml`, `.sql`, `.sh`।

## Supported operations

- `read`, `list`, `readMany`: file/directory inspect.
- `create`: নতুন file তৈরি; existing file overwrite করে না।
- `edit`: existing file edit; আগে content-addressed backup তৈরি করে।
- `test`: JavaScript syntax check; code execute করে না।
- `plan`: এক approval-এ সর্বোচ্চ ১২টি sequential safe file step।

Delete, arbitrary shell, eval, package install/update এবং process restart এই worker executor-এ enabled নয়। কোনো package/dependency change বা destructive operation লাগলে আলাদা reviewed implementation ও explicit critical confirmation প্রয়োজন হবে; সাধারণ file approval দিয়ে এগুলো চালানো যাবে না।

একটি file সর্বোচ্চ ৬৪ KiB। Directory scan সর্বোচ্চ ৩০টি file এবং readMany মোট ৩০ KiB content নেয়। Agent read/create/edit/readMany-এর file content task result-এ downloadable attachment হিসেবে ফেরত দেয়; Dashboard-এর task result থেকে প্রতিটি file download করা যায়।

## Approval and execution

1. `!agent <request>` পাঠালে Sender ID allowlist যাচাই করে signed HTTPS Bridge-এ request যায়।
2. Backend Planner exact action/plan তৈরি করে এবং approval record-এ action hash সংরক্ষণ করে।
3. Owner Dashboard-এ পুরো plan দেখে approve/reject করেন।
4. Railway Worker approved task single-use claim করে; claim endpoint action hash ও expiry পুনরায় যাচাই করে।
5. Worker ফলাফল এবং downloadable file content Backend-এ পাঠায়।

Free-text request কখনো সরাসরি execute হয় না। Executor কেবল approved structured action চালায়। Approval না থাকলে কোনো file change হয় না।

## Railway environment variables

```env
AGENT_BRIDGE_ENABLED=false
AGENT_WORKER_ENABLED=false
AGENT_BACKEND_URL=
AGENT_BRIDGE_SECRET=
AGENT_ALLOWED_SENDER_IDS=
AGENT_WORKSPACE_ROOT=
```

- `AGENT_BRIDGE_ENABLED`: signed Bridge চালু/বন্ধ।
- `AGENT_WORKER_ENABLED`: approved task worker চালু/বন্ধ।
- `AGENT_BACKEND_URL`: HTTPS Agent Backend base URL, trailing slash ছাড়া।
- `AGENT_BRIDGE_SECRET`: Backend-এর `BRIDGE_SECRET`-এর সঙ্গে একই, কমপক্ষে ৩২ অক্ষর।
- `AGENT_ALLOWED_SENDER_IDS`: অনুমোদিত Messenger Sender ID-গুলোর comma-separated তালিকা।
- `AGENT_WORKSPACE_ROOT`: deployed GoatBot repository workspace path।

Backend-এও Bridge enabled, একই secret ও Sender ID allowlist, AI provider এবং MongoDB replica-set transaction support থাকতে হবে। এই পরিবর্তনগুলো deploy করে runtime integration test না করা পর্যন্ত দুইটি enable flag `false` রাখবে।

**এই Agent Bridge-এর জন্য পুরোনো bot `config.json` বা Facebook login/session configuration প্রতিস্থাপন করবে না।**
