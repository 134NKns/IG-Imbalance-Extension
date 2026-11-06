<p align="center">
  <img src="public/icon/128.png" width="128" alt="IG-Imbalance logo">
</p>

<p align="center">

**IG-Imbalance** — a small Chrome extension that answers one question: *who is actually following me on Instagram?*

</p>

---

It scans your followers and following, stores both lists locally in your browser, and
computes the sets you actually care about:

- **Mutual** — you follow them, they follow you
- **Fans** — they follow you, you don't follow them back
- **Not following back** — the awkward one
- **Followers / Following** — the raw lists

Then it lets you filter (Verified ✓ / Public / Private), search usernames, and jump between
the sets from a dropdown.

No server, no account, no key. Everything runs in your tab with your session and stays
in `browser.storage.local`.

## How it works

The popup doesn't ship its own HTTP client. It injects a function into the active
Instagram tab (`chrome.scripting`) and lets the page make the requests, which means it
rides on cookies, CSRF token and login state that are already there. Pagination is
throttled with a random 1.5–2.5 s jitter to stay under Instagram's rate limiter.

If a scan gets interrupted (you closed the popup mid-scan, Instagram rate-limited a page,
...), the last saved cursor survives and the next scan picks up from it. Progress lives in
`browser.storage.local`.

## Features

- Scan followers + following sequentially (following first, then followers), resumable,
  with live progress
- Relationship sets: Mutual / Fans / Not Following, with per-set counts
- Followers / Following count badges, click to switch list
- Per-account filters (Verified ✓ / Public / Private) and username search, multi-select
- Account card for the profile you're viewing, with relationship badges
- Clean reset via **Clear** (wipes scan data for the account from local storage)

## Install

```sh
npm install
npm run dev          # dev mode, loads the unpacked extension
npm run zip          # production build → .output/IG Imbalance.zip
```

Then in `chrome://extensions/` enable **Developer mode** → **Load unpacked** →
pick the `.output` folder (or use the dev one WXT opens for you).

You must be logged into Instagram in the active tab for anything to work.

## Usage

1. Open the popup on any `instagram.com` tab.
2. **Relation** section → **Scan**. First run takes a while; the progress bar tells you
   which list it's on.
3. Click **Followers** / **Following** badges, or the dropdown, to switch between sets.
4. Filter (Verified ✓ / Public / Private) or search by username.

Open someone's profile and the card up top shows where they sit relative to your last
scan: **Mutual**, **Not following back**, **Follows you**, **No relationship**, or
**No scan data**. No new request is made for that — it's a lookup in what you already
have.

## Known limits (be honest with yourself)

- These are **unofficial** Instagram endpoints. When Instagram changes them, the
  extension breaks. There is no SLA.
- The scanner is deliberately slow on purpose. Raising the jitter just means you get a
  429 sooner.
- Avatar and media CDN URLs expire, so they're read fresh each time, never cached.
- The "viewed profile" badge is only as fresh as your last scan. If you followed
  someone 10 minutes ago and haven't re-scanned, the badge is a lie.

## Project layout

```
entrypoints/
  background.ts        # declarativeNetRequest rules (CDN Referer headers)
  content.ts           # fallback REST helper (message-based)
  popup/
    App.tsx              # entry, tab/login detection
    components/
      profile/           # profile card + viewed-profile badges
      tools/             # RelationshipView (scan UI), PostViewer (hidden)
    services/
      instagram.ts       # tab injection, DOM reads, shortcode → media id
      relationship.ts    # scan state machine, storage, set math
    hooks/
      useRelationshipScan.ts
```

## License

MIT.
