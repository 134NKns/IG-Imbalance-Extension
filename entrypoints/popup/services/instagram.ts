export interface UserInfoResult {
  success: boolean;
  user?: any;
  status?: number;
  error?: string;
  body?: string;
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

export function getUsernameFromUrl(url: string | null | undefined): string | null {
  if (!url || !isInstagramUrl(url)) return null;
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const reserved = [
      "explore",
      "reels",
      "stories",
      "direct",
      "accounts",
      "your_activity",
      "settings",
      "p",
      "reel",
    ];
    const firstSegment = segments[0];
    if (firstSegment && !reserved.includes(firstSegment.toLowerCase())) {
      return firstSegment;
    }
    return null;
  } catch {
    return null;
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

export async function getUserInfo(username?: string): Promise<UserInfoResult> {
  try {
    const tabs = await browser.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });
    const tabId = tabs[0]?.id;
    if (!tabId) {
      return { success: false, error: "No active tab found" };
    }

    const response = await browser.tabs.sendMessage(tabId, {
      type: "GET_USER_INFO",
      username,
    });

    if (!response?.success) {
      return {
        success: false,
        status: response?.status,
        error: response?.error,
        body: response?.body,
      };
    }

    return { success: true, user: response.user };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
