export interface TestFollowingResult {
  success: boolean;
  status?: number;
  totalReturned?: number;
  users?: Array<{ pk: string; username: string; fullName: string }>;
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

    const response = await browser.tabs.sendMessage(tabId, {
      type: "TEST_FETCH_FOLLOWING",
      userId,
    });

    return response;
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
