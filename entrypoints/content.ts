function getCookie(name: string): string | null {
  const match = document.cookie.match(
    new RegExp("(^|;\\s*)(" + name + ")=([^;]*)")
  );
  return match && match[3] ? decodeURIComponent(match[3]) : null;
}

export default defineContentScript({
  matches: ["*://*.instagram.com/*"],
  main() {
    console.log("[Content Script] IG Imbalance loaded.");

    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type === "TEST_FETCH_FOLLOWING") {
        const userId = message.userId || getCookie("ds_user_id");
        if (!userId) {
          sendResponse({
            success: false,
            error: "No ds_user_id found",
          });
          return true;
        }

        const csrfToken = getCookie("csrftoken") || "";
        const headers: Record<string, string> = {
          "x-ig-app-id": "936619743392459",
          "x-csrftoken": csrfToken,
          "x-requested-with": "XMLHttpRequest",
          accept: "*/*",
          referer: "https://www.instagram.com/",
        };

        const url = `https://www.instagram.com/api/v1/friendships/${userId}/following/?count=10`;

        fetch(url, {
          method: "GET",
          headers,
          credentials: "include",
        })
          .then(async (res) => {
            console.log(
              "[Content Script] friendships/following status:",
              res.status,
              res.statusText
            );

            const text = await res.text();
            let json: any = null;
            try {
              json = JSON.parse(text);
            } catch {
              // Non-JSON (e.g. HTML challenge page)
            }

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
            console.error("[Content Script] Fetch error:", err);
            sendResponse({ success: false, error: String(err) });
          });

        return true;
      }
    });
  },
});
