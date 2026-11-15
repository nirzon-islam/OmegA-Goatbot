# 🤖 GoatBot Setup Help

GoatBot চালু করার সহজ নির্দেশনা। নতুন ব্যবহারকারীরাও এই ধাপগুলো অনুসরণ করতে পারবে।

## যা লাগবে
- GitHub account
- Node.js 20
- Facebook account-এর valid login cookies
- Railway অথবা VPS

## Local Setup 💻

1. Repository clone/download করো।
2. Project folder-এ terminal খুলে চালাও:

```bash
npm install
```

3. Facebook cookies JSON format-এ project-এর `account.txt` ফাইলে রাখো।
4. `config.json`-এ bot prefix এবং নিজের Facebook UID `adminBot`-এ সেট করো।
5. Bot চালু করো:

```bash
node index.js
```

## Railway Setup 🚂

1. Railway-তে নতুন project তৈরি করো।
2. GitHub থেকে GoatBot repository connect করো।
3. প্রয়োজনীয় environment variables configure করো।
4. Deploy হলে logs দেখে bot চালু হয়েছে কি না যাচাই করো।

## দরকারি লিংক 🔗

- [GoatBot Repository](https://github.com/nirzon-islam/OmegA-Goatbot)
- [Agent Backend Repository](https://github.com/nirzon-islam/Agent-Backend)
- [Railway](https://railway.com/)
- [Node.js](https://nodejs.org/)

## Agent Connection

Agent Backend-এর সঙ্গে সংযোগের জন্য Agent repository-র setup guide দেখো। GoatBot-এর যে branch ব্যবহার করছো, তাতে Agent integration support থাকতে হবে।

## নিরাপত্তা 🔐

- `account.txt`-এর cookies কখনো কারও সঙ্গে share করবে না।
- `account.txt` বা কোনো password/API key GitHub-এ upload করবে না।
- নিজের Facebook UID ছাড়া অন্য কারও UID admin হিসেবে ব্যবহার করবে না।

---

**GoatBot — Setup Guide**
