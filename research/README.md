# Instagram Follower & Following Architecture Research (2026)

This document synthesizes findings from reverse-engineering modern, actively maintained Instagram extensions and tools (including `EdvinCodes/InstagramUnfollowers`, `SocialMediaTooling/IG_Follower_Scraper`, and `MaxDonchenko/instagram-not-mutual-followers`).

---

## 1. Why `web_profile_info` Failed with Status 429

### Finding:
Instagram actively blocks and rate-limits the endpoint:
`https://www.instagram.com/api/v1/users/web_profile_info/?username={username}`
When called programmatically from extension/fetch contexts, Instagram's Meta Edge firewall responds with an HTTP 429 / 404 HTML challenge page:
```html
<title>Page Not Found &bull; Instagram</title>
<h2>Error</h2>
<p>Please wait a few minutes before you try again.</p>
```

### Industry Consensus:
As documented in `EdvinCodes/InstagramUnfollowers` (Release v9.0.4):
> *"Unfollow uses the id from the scan. It no longer asks `web_profile_info` first, so a 429 on that lookup cannot stop the queue."*

**Conclusion:** Production extensions **do not** call `web_profile_info`. We should completely avoid calling this endpoint.

---

## 2. Authentication & User Identification

### How extensions detect the current logged-in user:
1. **User ID:**
   Extensions read the browser cookie directly:
   ```ts
   const userId = getCookie('ds_user_id'); // e.g. "55802650331"
   ```
   No API call is needed to retrieve the viewer's numerical ID.

2. **CSRF Token:**
   Extracted from document cookies:
   ```ts
   const csrfToken = getCookie('csrftoken');
   ```

---

## 3. The Working API Endpoints for Followers & Following

### Architecture Shift:
- **Legacy GraphQL (`query_hash`):** Deprecated. Sometime around late 2024 to 2026, Instagram's GraphQL `query_hash` endpoint stopped returning `edges` (returning empty lists with 200 OK).
- **Current Standard (Internal REST API):** All modern extensions use the internal REST endpoints that the Instagram Web application itself queries:

### Endpoints:
```http
GET https://www.instagram.com/api/v1/friendships/{userId}/following/?count=50
GET https://www.instagram.com/api/v1/friendships/{userId}/followers/?count=50
```

### Required Request Headers:
```json
{
  "x-ig-app-id": "936619743392459",
  "x-csrftoken": "<csrftoken_from_cookie>",
  "x-requested-with": "XMLHttpRequest",
  "accept": "*/*",
  "referer": "https://www.instagram.com/"
}
```
Credentials must be set to `credentials: 'include'`.

---

## 4. Pagination & Query Parameters

### Query Parameters:
| Parameter | Description |
| :--- | :--- |
| `count` | Target batch size per cycle (typically 50; Instagram server-chunks followers to ~15-25). |
| `max_id` | Cursor for next page (retrieved from `response.next_max_id`). |
| `rank_token` | Returned by Instagram as `follow_ranking_token`. Passing it in subsequent page requests prevents items from shifting between pages. |
| `search_surface` | Set to `"follow_list_page"`. |

### Pagination Flow:
```typescript
let nextMaxId: string | null = null;
let rankToken: string | null = null;

do {
  const url = new URL(`https://www.instagram.com/api/v1/friendships/${userId}/${kind}/`);
  url.searchParams.set('count', '50');
  url.searchParams.set('search_surface', 'follow_list_page');
  if (nextMaxId) url.searchParams.set('max_id', nextMaxId);
  if (rankToken) url.searchParams.set('rank_token', rankToken);

  const res = await fetch(url.toString(), { headers, credentials: 'include' });
  const data = await safeJsonParse(res);

  // Collect users
  for (const user of data.users) {
    allUsers.push(user);
  }

  nextMaxId = data.next_max_id ? String(data.next_max_id) : null;
  rankToken = data.follow_ranking_token ?? null;

  // Crucial pacing delay between requests
  await sleep(1500 + Math.random() * 1000);
} while (nextMaxId);
```

---

## 5. Rate Limit Protection & Defenses

1. **Defensive JSON Parsing:**
   Instagram sometimes returns HTTP 200 OK with an HTML challenge page (e.g. `<p>Please wait...</p>`). If `res.json()` is called directly, it throws `SyntaxError: Unexpected token <`.
   Extensions always use safe JSON parsing:
   ```typescript
   async function safeJsonParse(res: Response) {
     try {
       const text = await res.text();
       return JSON.parse(text);
     } catch {
       return null; // Indicates challenge or rate limit HTML page
     }
   }
   ```

2. **Pacing Delay:**
   - 1.5s to 2.5s randomized sleep between pagination cycles.
   - If HTTP 429 or HTML challenge occurs, trigger exponential backoff (e.g. pause 60 seconds before retrying).

---

## 6. How Imbalance is Computed

1. **Step 1:** Download all accounts from `/following/`.
2. **Step 2:** Download all accounts from `/followers/`.
3. **Step 3:** Cross-reference locally in memory:
   ```typescript
   const followerIds = new Set(followers.map(u => String(u.pk)));
   const followingIds = new Set(following.map(u => String(u.pk)));

   // People you follow who do NOT follow you back:
   const notFollowingBack = following.filter(u => !followerIds.has(String(u.pk)));

   // People who follow you but you do NOT follow back (Fans):
   const fans = followers.filter(u => !followingIds.has(String(u.pk)));

   // Mutual follows:
   const mutuals = following.filter(u => followerIds.has(String(u.pk)));
   ```
4. **Optimization:**
   Items returned in the `following` list often include `user.friendship_status.followed_by: boolean`. If `true`, they are confirmed mutuals without waiting for the full followers list.

---

## 7. Recommended Architecture for IG-Imbalance

1. **Popup UI:**
   - Shows current user ID (`ds_user_id`).
   - "Start Analysis" button.
   - Progress bar (e.g. "Fetching Following: 120/450", "Fetching Followers: 50/380").
   - Results view with tabs: "Not Following Back", "Fans", "Mutuals".

2. **Content Script (`entrypoints/content.ts`):**
   - Runs in Instagram page context (`origin: https://www.instagram.com`).
   - Executes `fetchFriendships(userId, 'following')` and `fetchFriendships(userId, 'followers')`.
   - Sends batch progress messages back to Popup.
