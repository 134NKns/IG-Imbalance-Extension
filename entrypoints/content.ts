function getCookie(name: string): string | null {
  const match = document.cookie.match(
    new RegExp("(^|;\\s*)(" + name + ")=([^;]*)")
  );
  return match && match[3] ? decodeURIComponent(match[3]) : null;
}

function getRestHeaders(): Record<string, string> {
  const csrf = getCookie("csrftoken") || "";
  let claim = "0";
  try {
    claim = sessionStorage.getItem("www-claim-v2") || "0";
  } catch {}

  return {
    "x-ig-app-id": "936619743392459",
    "x-csrftoken": csrf,
    "x-asbd-id": "359341",
    "x-ig-www-claim": claim,
    "x-requested-with": "XMLHttpRequest",
    accept: "*/*",
    referer: "https://www.instagram.com/",
  };
}

function isRateLimited(body: any): boolean {
  if (!body) return false;
  if (body.spam === true) return true;
  const msg = typeof body.message === "string" ? body.message : "";
  return (
    /^(feedback_required|checkpoint_required)$/i.test(msg.trim()) ||
    /please wait a few minutes/i.test(msg)
  );
}

function getProfileFromDom() {
  const links = Array.from(document.querySelectorAll('a[href^="/"]'));
  const ignored = new Set([
    "explore",
    "reels",
    "direct",
    "stories",
    "your_activity",
    "settings",
    "accounts",
  ]);
  for (const a of links) {
    const href = a.getAttribute("href") || "";
    const match = href.match(/^\/([a-zA-Z0-9._]+)\/?$/);
    if (match && match[1] && !ignored.has(match[1])) {
      const img = a.querySelector("img");
      if (img && (img.src || img.currentSrc)) {
        return {
          username: match[1],
          profilePicUrl: img.currentSrc || img.src,
        };
      }
    }
  }
  const headerImg = document.querySelector<HTMLImageElement>("header img");
  if (headerImg && (headerImg.src || headerImg.currentSrc)) {
    return {
      username: "",
      profilePicUrl: headerImg.currentSrc || headerImg.src,
    };
  }
  return null;
}

export default defineContentScript({
  matches: ["*://*.instagram.com/*"],
  main() {
    console.log("[Content Script] IG Imbalance loaded.");

    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      // 1. Fetch friendship page (followers or following) with cursor
      if (message?.type === "FETCH_FRIENDSHIP_PAGE") {
        const { userId, kind, maxId, count = 50 } = message;
        if (!userId || (kind !== "followers" && kind !== "following")) {
          sendResponse({ success: false, error: "Invalid parameters" });
          return true;
        }

        const qs = new URLSearchParams({ count: String(count) });
        if (maxId) {
          qs.set("max_id", maxId);
        }

        const url = `https://www.instagram.com/api/v1/friendships/${encodeURIComponent(
          userId
        )}/${kind}/?${qs.toString()}`;

        fetch(url, {
          method: "GET",
          headers: getRestHeaders(),
          credentials: "include",
        })
          .then(async (res) => {
            if (res.status === 401) {
              sendResponse({
                success: false,
                status: 401,
                error: "Login required",
              });
              return;
            }
            if (res.status === 429) {
              sendResponse({
                success: false,
                status: 429,
                error: "Rate limited by Instagram (429)",
                rateLimited: true,
              });
              return;
            }

            const text = await res.text();
            let json: any = null;
            try {
              json = JSON.parse(text);
            } catch {
              sendResponse({
                success: false,
                status: res.status,
                error: res.redirected
                  ? "Not logged in"
                  : `Unexpected response (${res.status})`,
              });
              return;
            }

            if (!res.ok || json.status === "fail") {
              const rateLimited = isRateLimited(json);
              sendResponse({
                success: false,
                status: res.status,
                error: json.message || `Request failed (${res.status})`,
                rateLimited,
              });
              return;
            }

            const users = (json.users ?? []).map((u: any) => ({
              pk: String(u.pk ?? u.id),
              username: u.username,
              fullName: u.full_name ?? "",
              profilePicUrl: u.profile_pic_url ?? "",
              isVerified: Boolean(u.is_verified),
              isPrivate: Boolean(u.is_private),
            }));

            const nextMaxId =
              json.next_max_id != null && json.next_max_id !== ""
                ? String(json.next_max_id)
                : undefined;

            sendResponse({
              success: true,
              status: res.status,
              users,
              nextMaxId,
            });
          })
          .catch((err) => {
            sendResponse({ success: false, error: String(err) });
          });

        return true;
      }

      // 2. Fetch User Profile info (Pure DOM, 0 API calls)
      if (message?.type === "FETCH_USER_PROFILE") {
        const userId = message.userId || getCookie("ds_user_id");
        if (!userId) {
          sendResponse({ success: false, error: "No ds_user_id found" });
          return true;
        }

        const domProfile = getProfileFromDom();
        if (domProfile && (domProfile.username || domProfile.profilePicUrl)) {
          sendResponse({
            success: true,
            data: {
              userId,
              username: domProfile.username,
              fullName: "",
              profilePicUrl: domProfile.profilePicUrl || "",
            },
          });
          return true;
        }

        sendResponse({
          success: false,
          error: "Could not find profile in page DOM",
        });
        return true;
      }

      // 3. Test Following (legacy)
      if (message?.type === "TEST_FETCH_FOLLOWING") {
        const userId = message.userId || getCookie("ds_user_id");
        if (!userId) {
          sendResponse({
            success: false,
            error: "No ds_user_id found",
          });
          return true;
        }

        const url = `https://www.instagram.com/api/v1/friendships/${userId}/following/?count=10`;

        fetch(url, {
          method: "GET",
          headers: getRestHeaders(),
          credentials: "include",
        })
          .then(async (res) => {
            const text = await res.text();
            let json: any = null;
            try {
              json = JSON.parse(text);
            } catch {}

            if (!res.ok || !json) {
              sendResponse({
                success: false,
                status: res.status,
                body: text.slice(0, 300),
              });
              return;
            }

            const users = (json.users ?? []).map((u: any) => ({
              pk: String(u.pk ?? u.id),
              username: u.username,
              fullName: u.full_name ?? "",
            }));

            sendResponse({
              success: true,
              status: res.status,
              totalReturned: users.length,
              users,
            });
          })
          .catch((err) => {
            sendResponse({ success: false, error: String(err) });
          });

        return true;
      }
    });
  },
});
