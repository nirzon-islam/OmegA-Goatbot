# Railway Agent Bridge (বাংলা নির্দেশিকা)

`!agent` কমান্ডটি বটের বর্তমান command loader-এর মাধ্যমে চালু হয়। এই কমান্ড দিয়ে সাধারণ ভাষায় নির্দেশ দিলে সেটি Agent Backend-এ পাঠানো হয়। Backend-এর AI Planner নির্দেশটিকে নির্দিষ্ট সীমার মধ্যে থাকা কোনো কাজ অথবা কয়েকটি ধাপের পরিকল্পনায় রূপ দেয়। Worker কাজটি নেওয়ার আগে Owner-কে Dashboard থেকে সম্পূর্ণ পরিকল্পনাটি অনুমোদন করতে হবে।

`EryXenX.js` থেকে Background Worker চালু হবে কেবল তখনই, যখন `AGENT_BRIDGE_ENABLED=true` এবং `AGENT_WORKER_ENABLED=true` — দুটোই সেট করা থাকবে। `!agent` কমান্ড ব্যবহারের জন্য `AGENT_BRIDGE_ENABLED=true` থাকতে হবে এবং বার্তাপ্রেরকের Sender ID `AGENT_ALLOWED_SENDER_IDS`-এর তালিকায় থাকতে হবে।

## যেসব কাজ করা যাবে

- `read`: `languages/` ফোল্ডারের ভেতরের একটি সাধারণ ফাইল পড়তে পারবে।
- `list`: কোনো language directory-এর সমর্থিত `.lang` ও `.js` ফাইলের তালিকা দেখাতে পারবে।
- `readMany`: নির্দিষ্ট সীমার মধ্যে একাধিক সমর্থিত ফাইল পড়তে পারবে।
- `create`: `languages/`-এর ভেতরে নতুন `.lang` অথবা `.js` ফাইল তৈরি করতে পারবে। আগে থেকে থাকা ফাইলের ওপর লিখতে পারবে না।
- `edit`: `languages/`-এর ভেতরের সমর্থিত কোনো ফাইল সম্পাদনা করতে পারবে। সম্পাদনার আগে একটি content-addressed backup তৈরি হবে।
- `test`: `vm.Script` ব্যবহার করে JavaScript ফাইলের syntax/compile check করবে; ফাইলটি execute করবে না।
- `plan`: Owner সম্পূর্ণ পরিকল্পনাটি অনুমোদন করার পর ধারাবাহিকভাবে ১–১২টি যাচাইকৃত ধাপ চালাতে পারবে।

**যেসব কাজ সমর্থিত নয়:** Shell command, `eval`, package script, ইচ্ছামতো test runner, ফাইল delete, package install অথবা runtime code path-এ পরিবর্তন করা যাবে না।

একটি ফাইল পড়া বা লেখার সর্বোচ্চ সীমা ৬৪ KiB। Directory থেকে সর্বোচ্চ ৩০টি ফাইল এবং সব মিলিয়ে ৩০ KiB content পড়া যাবে। Symlink ও hidden path বাদ দেওয়া হবে অথবা প্রত্যাখ্যান করা হবে। নিরাপত্তার জন্য কাজের অনুমোদিত জায়গা শুধু `languages/` ফোল্ডার।

## অনুমোদন ও কাজ সম্পন্ন হওয়ার ধাপ

1. `!agent <request>` পাঠালে Sender ID-ভিত্তিক অনুরোধটি signed API-এর মাধ্যমে Agent Backend-এ যায়।
2. Backend Planner অনুরোধ থেকে তৈরি action/plan যাচাই করে এবং Owner-এর জন্য একটি approval record তৈরি করে।
3. Owner Backend Dashboard থেকে নির্দিষ্ট পরিকল্পনাটি অনুমোদন অথবা বাতিল করেন।
4. Railway Worker অনুমোদিত কাজের queue পরীক্ষা করে, কাজটি একবারের জন্য claim করে এবং অনুমোদিত payload অনুযায়ী কাজ সম্পন্ন করে।
5. Worker কাজের ফলাফল Backend-এ পাঠায়। Owner Dashboard অথবা `!agent status <taskId>` দিয়ে কাজের অবস্থা দেখা যায়।

Executor মূল free-text অনুরোধ থেকে নিজে কোনো command বা file path তৈরি করে না। Backend-এর approval record-এ সংরক্ষিত এবং single-use claim endpoint থেকে পাওয়া নির্দিষ্ট action-ই Executor-এর কাছে পাঠানো হয়।

## Railway-এর প্রয়োজনীয় Environment Variables

Backend integration test এবং database transaction check সফলভাবে সম্পন্ন হওয়ার পরই Railway → Variables-এ নিচের variable-গুলো সেট করবে।

```env
AGENT_BRIDGE_ENABLED=false
AGENT_WORKER_ENABLED=false
AGENT_BACKEND_URL=
AGENT_BRIDGE_SECRET=
AGENT_ALLOWED_SENDER_IDS=
AGENT_WORKSPACE_ROOT=
```

**Variable-গুলোর কাজ:**

- `AGENT_BRIDGE_ENABLED`: Agent Bridge চালু/বন্ধ রাখে। Backend যাচাই না হওয়া পর্যন্ত `false` রাখবে।
- `AGENT_WORKER_ENABLED`: Background Worker চালু/বন্ধ রাখে। অনুমোদিত কাজ চালানোর সিদ্ধান্ত না নেওয়া পর্যন্ত `false` রাখবে।
- `AGENT_BACKEND_URL`: Deploy করা Agent Backend-এর Base URL। শেষে `/` দেবে না।
- `AGENT_BRIDGE_SECRET`: Backend-এর `BRIDGE_SECRET`-এর সঙ্গে একই, এলোমেলোভাবে তৈরি করা কমপক্ষে ৩২ অক্ষরের Secret দিতে হবে।
- `AGENT_ALLOWED_SENDER_IDS`: যেসব Facebook Sender ID `!agent` ব্যবহার করতে পারবে, সেগুলো কমা দিয়ে আলাদা করে লিখবে।
- `AGENT_WORKSPACE_ROOT`: Deploy করা Bot-এর workspace path দিতে হবে। এটি যেন checkout করা repository-তেই নির্দেশ করে, তা যাচাই করবে।

Backend-এও একই `BRIDGE_SECRET`, একই Sender ID allowlist, `BRIDGE_ENABLED=true` এবং একটি AI provider configure করা থাকতে হবে। MongoDB-তে replica-set transaction সমর্থন থাকতে হবে।

## পরীক্ষা ও নিরাপত্তা

GitHub Actions-এ Unit Test এবং syntax check চলে। তবে এগুলো Live MongoDB replica-set integration test অথবা Backend, Dashboard approval, Railway Worker ও task result reporting-এর End-to-End test-এর বিকল্প নয়।

এই runtime পরীক্ষাগুলো সফল না হওয়া পর্যন্ত Worker-সংক্রান্ত দুইটি flag `false` রাখবে।

**Bridge setup করার জন্য বটের আগের `config.json` পরিবর্তন বা প্রতিস্থাপন করবে না।** এই Bridge উপরের Environment Variables ব্যবহার করে এবং বটের বর্তমান login/session ও command configuration থেকে আলাদা থাকে।
