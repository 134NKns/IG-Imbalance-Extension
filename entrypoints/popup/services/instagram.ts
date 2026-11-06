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
  profilePicUrl?: string;
  followerCount?: number;
  followingCount?: number;
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
  userId: string,
): Promise<FetchProfileResult> {
  const cacheKey = `ig_profile_${userId}`;
  // fbcdn avatar URLs carry expiring signed tokens, so never trust stale cache
  const CACHE_TTL_MS = 5 * 60 * 1000;
  try {
    const cached = (await browser.storage.local.get(cacheKey)) as Record<
      string,
      { data?: UserProfileData; ts?: number } | undefined
    >;
    const entry = cached?.[cacheKey];
    if (
      entry?.data?.profilePicUrl &&
      entry.ts &&
      Date.now() - entry.ts < CACHE_TTL_MS
    ) {
      return { success: true, data: entry.data };
    }
  } catch {}

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
      if (response?.success && response.data) {
        if (response.data.profilePicUrl) {
          browser.storage.local
            .set({ [cacheKey]: { data: response.data, ts: Date.now() } })
            .catch(() => {});
        }
        return response;
      }
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
        // Extract from page DOM (100% safe, 0 network calls)
        const profileLink = Array.from(
          document.querySelectorAll('a[href^="/"]'),
        ).find((a) => {
          const href = a.getAttribute("href") || "";
          const match = href.match(/^\/([a-zA-Z0-9._]+)\/?$/);
          const nonUser = [
            "explore",
            "reels",
            "direct",
            "stories",
            "your_activity",
            "settings",
            "accounts",
          ];
          return (
            Boolean(match && match[1] && !nonUser.includes(match[1])) &&
            Boolean(a.querySelector("img"))
          );
        });

        let domUsername = "";
        let domPicUrl = "";
        // 0) Real avatar: alt = "<username>'s profile picture"
        const avatarImg = Array.from(
          document.querySelectorAll<HTMLImageElement>(
            'img[alt*="\'s profile picture" i]',
          ),
        ).sort((a, b) => (b.naturalWidth ?? 0) - (a.naturalWidth ?? 0))[0];
        if (avatarImg) {
          const alt = avatarImg.getAttribute("alt") || "";
          const m = alt.match(/^(\S+)'s profile picture/i);
          if (m?.[1]) domUsername = m[1];
          domPicUrl = avatarImg.currentSrc || avatarImg.src || "";
        }
        if (profileLink) {
          const href = profileLink.getAttribute("href") || "";
          const match = href.match(/^\/([a-zA-Z0-9._]+)\/?$/);
          if (match && match[1]) domUsername = match[1];
          const img = profileLink.querySelector("img");
          domPicUrl = img?.currentSrc || img?.src || "";
        }

        // Also check header image if on own profile
        if (!domPicUrl) {
          const headerImg =
            document.querySelector<HTMLImageElement>("header img");
          if (headerImg) {
            domPicUrl = headerImg.currentSrc || headerImg.src || "";
          }
        }

        if (domUsername || domPicUrl) {
          return {
            success: true,
            data: {
              userId: uid,
              username: domUsername || "you",
              fullName: "",
              profilePicUrl: domPicUrl,
            },
          };
        }

        return {
          success: false,
          error: "Could not find profile in page DOM",
        };
      },
      args: [userId],
    });

    const res = results[0]?.result;
    if (res?.success && res.data) {
      if (res.data.profilePicUrl) {
        browser.storage.local
          .set({ [cacheKey]: { data: res.data, ts: Date.now() } })
          .catch(() => {});
      }
      return res;
    }

    return {
      success: false,
      error: "Empty execution result",
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function testFetchFollowing(
  userId: string,
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
            new RegExp("(^|;\\s*)(" + name + ")=([^;]*)"),
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

export interface ViewedProfileData {
  username: string;
  profilePicUrl?: string;
  userId?: string;
}

export interface FetchViewedProfileResult {
  success: boolean;
  data?: ViewedProfileData;
  error?: string;
}

const NON_USER_PATHS = new Set([
  "explore",
  "reels",
  "direct",
  "stories",
  "your_activity",
  "settings",
  "accounts",
  "p",
  "tv",
  "oembed",
  "about",
  "privacy",
  "help",
  "legal",
  "security",
  "contact",
  "f",
  "friendships",
]);

/** Extract profile username from an Instagram profile URL like /cristiano/ */
export function parseProfileUsername(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length !== 1) return null;
    const username = segments[0];
    if (!username) return null;
    if (!/^[a-zA-Z0-9._]{1,30}$/.test(username)) return null;
    if (NON_USER_PATHS.has(username.toLowerCase())) return null;
    return username;
  } catch {
    return null;
  }
}

/** Pull username + profile pic straight from the open profile page's DOM. */
export async function fetchViewedProfileDom(): Promise<FetchViewedProfileResult> {
  try {
    const tabs = await browser.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });
    const tabId = tabs[0]?.id;
    if (!tabId) {
      return { success: false, error: "No active tab found" };
    }

    const browserObj =
      typeof browser !== "undefined" ? (browser as any) : null;
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
      func: async () => {
        let username = "";
        let profilePicUrl = "";
        let vUserId: string | null = null;

        // Real avatar: alt = "<username>'s profile picture"
        const avatarImg = Array.from(
          document.querySelectorAll<HTMLImageElement>(
            'img[alt*="\'s profile picture" i]',
          ),
        ).sort((a, b) => (b.naturalWidth ?? 0) - (a.naturalWidth ?? 0))[0];
        if (avatarImg) {
          const alt = avatarImg.getAttribute("alt") || "";
          const m = alt.match(/^(\S+)'s profile picture/i);
          if (m?.[1]) username = m[1];
          profilePicUrl = avatarImg.currentSrc || avatarImg.src || "";
        }

        // Fallback: header image
        if (!profilePicUrl) {
          const headerImg =
            document.querySelector<HTMLImageElement>("header img");
          if (headerImg) {
            profilePicUrl = headerImg.currentSrc || headerImg.src || "";
          }
        }

        // Resolve numeric user id (pk) from embedded data, no network
        if (username) {
          try {
            const sd = (window as any)._sharedData;
            const p = sd?.entry_data?.ProfilePage?.[0]?.graphql?.user;
            if (p?.id && p.username === username) vUserId = String(p.id);
          } catch {}
        }
        if (!vUserId && username) {
          try {
            const marker = `"username":"${username}"`;
            const scripts = Array.from(
              document.querySelectorAll<HTMLScriptElement>("script"),
            );
            for (const s of scripts) {
              const text = s.textContent || "";
              if (!text.includes(marker)) continue;
              const m = text.match(
                new RegExp(`"id":"(\\d+)"[^}]*"username":"${username}"`),
              );
              if (m?.[1]) {
                vUserId = m[1];
                break;
              }
            }
          } catch {}
        }

        if (!username && !profilePicUrl) {
          return { success: false, error: "Could not read profile from page." };
        }

        return {
          success: true,
          data: { username, profilePicUrl, userId: vUserId ?? undefined },
        };
      },
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

export interface StoryMediaItem {
  id: string;
  mediaType: "image" | "video";
  height?: number;
  width?: number;
  imageUrl?: string;
  videoUrl?: string;
  takenAt?: number;
  username?: string;
  isVerified?: boolean;
}

export interface FetchStoryResult {
  success: boolean;
  data?: {
    userId: string;
    items: StoryMediaItem[];
  };
  error?: string;
  status?: number;
}

/** Fetch a user's active stories via reels_media. Never marks stories as seen. */
export async function fetchStory(
  userId: string,
): Promise<FetchStoryResult> {
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
        type: "FETCH_STORY",
        userId,
      });
      if (response) return response;
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
        error: "Could not establish connection. Please reload Instagram tab.",
      };
    }

    const results = await scriptingApi.executeScript({
      target: { tabId },
      func: async (uid: string) => {
        function getCookie(name: string): string | null {
          const match = document.cookie.match(
            new RegExp("(^|;\\s*)(" + name + ")=([^;]*)"),
          );
          return match && match[3] ? decodeURIComponent(match[3]) : null;
        }

        const headers: Record<string, string> = {
          "x-ig-app-id": "936619743392459",
          "x-csrftoken": getCookie("csrftoken") || "",
          "x-asbd-id": "359341",
          "x-requested-with": "XMLHttpRequest",
          accept: "*/*",
          referer: "https://www.instagram.com/",
        };

        try {
          const res = await fetch(
            `https://www.instagram.com/api/v1/feed/reels_media/?reel_ids=${encodeURIComponent(uid)}`,
            {
            method: "GET",
            headers,
            credentials: "include",
          });

          if (res.status === 429) {
            return {
              success: false,
              status: 429,
              error: "Rate limited by Instagram (429)",
            };
          }
          if (res.status === 401) {
            return { success: false, status: 401, error: "Login required" };
          }

          const json = await res.json();
          if (!res.ok || json.status === "fail") {
            return {
              success: false,
              status: res.status,
              error: json.message || `Failed (${res.status})`,
            };
          }

          const reel = json?.reels?.[uid];
          const items: any[] = reel?.items ?? [];

          const parsed = items
            .map((it: any): StoryMediaItem | null => {
              if (!it?.id) return null;
              const mediaType: "image" | "video" =
                it.media_type === 2 ? "video" : "image";
              const cands = ((it.image_versions2?.candidates ?? []) as any[])
                .filter((c) => c?.url)
                .sort((a, b) => b.width - a.width);
              const vids = ((it.video_versions ?? []) as any[])
                .filter((v) => v?.url)
                .sort((a, b) => b.height - a.height);
              const best = cands[0];
              return {
                id: String(it.id ?? it.pk),
                mediaType,
                height: it.original_height ?? it.media_height,
                width: it.original_width ?? it.media_width,
                imageUrl: best?.url,
                videoUrl: mediaType === "video" ? vids[0]?.url : undefined,
                takenAt: it.taken_at,
                username: reel?.user?.username,
                isVerified: reel?.user?.is_verified,
              };
            })
            .filter((x): x is StoryMediaItem => Boolean(x));

          return {
            success: true,
            data: { userId: uid, items: parsed },
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
