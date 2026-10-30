function getCookie(name: string): string | null {
  const match = document.cookie.match(
    new RegExp("(^|;\\s*)(" + name + ")=([^;]*)")
  );
  return match && match[3] ? decodeURIComponent(match[3]) : null;
}

function getUsernameFromDOM(): string | null {
  const reserved = [
    "/",
    "/explore/",
    "/reels/",
    "/direct/",
    "/stories/",
    "/accounts/",
    "/your_activity/",
    "/settings/",
  ];

  // Try checking sidebar profile link with avatar image
  const links = Array.from(document.querySelectorAll('a[href^="/"]'));
  for (const link of links) {
    const href = link.getAttribute("href") || "";
    if (
      reserved.includes(href) ||
      href.startsWith("/direct/") ||
      href.startsWith("/stories/") ||
      href.startsWith("/p/") ||
      href.startsWith("/reel/")
    ) {
      continue;
    }

    const match = href.match(/^\/([a-zA-Z0-9._]+)\/?$/);
    if (match && match[1]) {
      const hasImg = link.querySelector("img");
      if (hasImg) {
        return match[1];
      }
    }
  }

  // Fallback: check current pathname
  const pathMatch = window.location.pathname.match(/^\/([a-zA-Z0-9._]+)\/?$/);
  if (pathMatch && pathMatch[1]) {
    const candidate = pathMatch[1].toLowerCase();
    if (!reserved.includes("/" + candidate + "/")) {
      return pathMatch[1];
    }
  }

  return null;
}

export default defineContentScript({
  matches: ["*://*.instagram.com/*"],
  main() {
    console.log("[Content Script] IG Imbalance loaded.");

    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type === "GET_USER_INFO") {
        const detectedUsername = message.username || getUsernameFromDOM();
        if (!detectedUsername) {
          sendResponse({
            success: false,
            error: "Could not detect username from page",
          });
          return true;
        }

        const csrfToken = getCookie("csrftoken") || "";
        const headers: Record<string, string> = {
          "x-ig-app-id": "936619743392459",
          "x-asbd-id": "129477",
          "x-requested-with": "XMLHttpRequest",
        };

        if (csrfToken) {
          headers["x-csrftoken"] = csrfToken;
        }

        fetch(
          `https://www.instagram.com/api/v1/users/web_profile_info/?username=${detectedUsername}`,
          {
            method: "GET",
            headers,
            credentials: "include",
          }
        )
          .then(async (res) => {
            console.log(
              "[Content Script] web_profile_info status:",
              res.status,
              res.statusText
            );

            if (!res.ok) {
              const bodyText = await res.text();
              sendResponse({
                success: false,
                status: res.status,
                body: bodyText,
              });
              return;
            }

            const json = await res.json();
            const rawUser = json?.data?.user;
            if (!rawUser) {
              sendResponse({ success: false, error: "Empty user in response" });
              return;
            }

            sendResponse({
              success: true,
              user: {
                id: rawUser.id,
                username: rawUser.username,
                fullName: rawUser.full_name,
                followerCount: rawUser.edge_followed_by?.count ?? 0,
                followingCount: rawUser.edge_follow?.count ?? 0,
              },
            });
          })
          .catch((err) => {
            console.error("[Content Script] Fetch error:", err);
            sendResponse({ success: false, error: String(err) });
          });

        return true;
      }
    });
  },
});
