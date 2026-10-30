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

    // Fallback กรณี lastFocusedWindow ไม่มี
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
