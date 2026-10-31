export interface TestFollowingResult {
  success: boolean;
  status?: number;
  totalReturned?: number;
  users?: Array<{ pk: string; username: string; fullName: string }>;
  error?: string;
  body?: string;
}

export interface UserProfileData {
  userId: string;
  username: string;
  fullName: string;
}

export interface FetchProfileResult {
  success: boolean;
  data?: UserProfileData;
  error?: string;
  status?: number;
}

export async function getCurrentTabUrl(): Promise<string | null> {
  try {
    const tabs = await browser.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });
    const activeTab = tabs[0];
    if (activeTab?.url) {
      return activeTab.url;
    }

    const fallbackTabs = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    return fallbackTabs[0]?.url ?? null;
  } catch (error) {
    console.error("Error getting current tab URL:", error);
    return null;
  }
}

export function isInstagramUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === "instagram.com" ||
      parsed.hostname.endsWith(".instagram.com")
    );
  } catch {
    return false;
  }
}

export async function getDsUserId(): Promise<string | null> {
  try {
    const browserObj = typeof browser !== "undefined" ? (browser as any) : null;
    const chromeObj =
      typeof globalThis !== "undefined" ? (globalThis as any).chrome : null;
    const cookiesApi = browserObj?.cookies || chromeObj?.cookies;

    if (!cookiesApi) {
      console.warn("Cookies API is not available");
      return null;
    }

    const cookie = await cookiesApi.get({
      url: "https://www.instagram.com",
      name: "ds_user_id",
    });
    return cookie?.value ?? null;
  } catch (error) {
    console.error("Error getting ds_user_id cookie:", error);
    return null;
  }
}

export async function fetchUserProfile(
  userId: string
): Promise<FetchProfileResult> {
  try {
    const tabs = await browser.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });
    const tabId = tabs[0]?.id;
    if (!tabId) {
      return { success: false, error: "No active tab found" };
    }

    try {
      const response = await browser.tabs.sendMessage(tabId, {
        type: "FETCH_USER_PROFILE",
        userId,
      });
      if (response?.success) return response;
    } catch {
      // Content script message failed; fallback to scripting API
    }

    const browserObj = typeof browser !== "undefined" ? (browser as any) : null;
    const chromeObj =
      typeof globalThis !== "undefined" ? (globalThis as any).chrome : null;
    const scriptingApi = browserObj?.scripting || chromeObj?.scripting;

    if (!scriptingApi) {
      return {
        success: false,
        error: "Scripting API not available",
      };
    }

    const results = await scriptingApi.executeScript({
      target: { tabId },
      func: async (uid: string) => {
        function getCookie(name: string): string | null {
          const match = document.cookie.match(
            new RegExp("(^|;\\s*)(" + name + ")=([^;]*)")
          );
          return match && match[3] ? decodeURIComponent(match[3]) : null;
        }

        const csrfToken = getCookie("csrftoken") || "";
        const headers: Record<string, string> = {
          "x-ig-app-id": "936619743392459",
          "x-csrftoken": csrfToken,
          "x-requested-with": "XMLHttpRequest",
          accept: "*/*",
          referer: "https://www.instagram.com/",
        };

        // Try /api/v1/users/{userId}/info/
        try {
          const res = await fetch(
            `https://www.instagram.com/api/v1/users/${uid}/info/`,
            {
              method: "GET",
              headers,
              credentials: "include",
            }
          );
          if (res.ok) {
            const json = await res.json();
            const user = json?.user;
            if (user?.username) {
              return {
                success: true,
                data: {
                  userId: uid,
                  username: user.username,
                  fullName: user.full_name ?? "",
                },
              };
            }
          }
        } catch {}

        // Fallback: /api/v1/accounts/current_user/?edit=true
        try {
          const res = await fetch(
            "https://www.instagram.com/api/v1/accounts/current_user/?edit=true",
            {
              method: "GET",
              headers,
              credentials: "include",
            }
          );
          if (res.ok) {
            const json = await res.json();
            const user = json?.user;
            if (user?.username) {
              return {
                success: true,
                data: {
                  userId: uid,
                  username: user.username,
                  fullName: user.full_name ?? "",
                },
              };
            }
          }
        } catch {}

        // Fallback: DOM profile link
        const profileLink = Array.from(
          document.querySelectorAll('a[href^="/"]')
        ).find((a) => {
          const href = a.getAttribute("href") || "";
          const match = href.match(/^\/([a-zA-Z0-9._]+)\/?$/);
          return match && a.querySelector("img");
        });

        if (profileLink) {
          const href = profileLink.getAttribute("href") || "";
          const match = href.match(/^\/([a-zA-Z0-9._]+)\/?$/);
          if (match && match[1]) {
            return {
              success: true,
              data: {
                userId: uid,
                username: match[1],
                fullName: "",
              },
            };
          }
        }

        return {
          success: false,
          error: "Could not fetch user profile",
        };
      },
      args: [userId],
    });

    return (
      results[0]?.result ?? {
        success: false,
        error: "Empty execution result",
      }
    );
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function testFetchFollowing(
  userId: string
): Promise<TestFollowingResult> {
  try {
    const tabs = await browser.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });
    const tabId = tabs[0]?.id;
    if (!tabId) {
      return { success: false, error: "No active tab found" };
    }

    try {
      const response = await browser.tabs.sendMessage(tabId, {
        type: "TEST_FETCH_FOLLOWING",
        userId,
      });
      if (response) return response;
    } catch {
      // Content script message failed; fallback to direct tab injection via scripting API
    }

    const browserObj = typeof browser !== "undefined" ? (browser as any) : null;
    const chromeObj =
      typeof globalThis !== "undefined" ? (globalThis as any).chrome : null;
    const scriptingApi = browserObj?.scripting || chromeObj?.scripting;

    if (!scriptingApi) {
      return {
        success: false,
        error: "Could not establish connection. Please reload Instagram tab.",
      };
    }

    const results = await scriptingApi.executeScript({
      target: { tabId },
      func: async (uid: string) => {
        function getCookie(name: string): string | null {
          const match = document.cookie.match(
            new RegExp("(^|;\\s*)(" + name + ")=([^;]*)")
          );
          return match && match[3] ? decodeURIComponent(match[3]) : null;
        }

        const csrfToken = getCookie("csrftoken") || "";
        const headers: Record<string, string> = {
          "x-ig-app-id": "936619743392459",
          "x-csrftoken": csrfToken,
          "x-requested-with": "XMLHttpRequest",
          accept: "*/*",
          referer: "https://www.instagram.com/",
        };

        const url = `https://www.instagram.com/api/v1/friendships/${uid}/following/?count=10`;

        try {
          const res = await fetch(url, {
            method: "GET",
            headers,
            credentials: "include",
          });

          const text = await res.text();
          let json: any = null;
          try {
            json = JSON.parse(text);
          } catch {}

          if (!res.ok || !json) {
            return {
              success: false,
              status: res.status,
              body: text.slice(0, 300),
            };
          }

          const users = (json.users ?? []).map((u: any) => ({
            pk: String(u.pk ?? u.id),
            username: u.username,
            fullName: u.full_name ?? "",
          }));

          return {
            success: true,
            status: res.status,
            totalReturned: users.length,
            users,
          };
        } catch (e: any) {
          return { success: false, error: String(e) };
        }
      },
      args: [userId],
    });

    return (
      results[0]?.result ?? {
        success: false,
        error: "Empty execution result",
      }
    );
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
