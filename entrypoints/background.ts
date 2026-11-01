export default defineBackground(() => {
  const setupDnrRules = async () => {
    try {
      const dnr =
        (globalThis as any).chrome?.declarativeNetRequest ||
        (browser as any)?.declarativeNetRequest;
      if (!dnr?.updateDynamicRules) return;

      await dnr.updateDynamicRules({
        removeRuleIds: [1],
        addRules: [
          {
            id: 1,
            priority: 1,
            action: {
              type: "modifyHeaders",
              requestHeaders: [
                {
                  header: "Referer",
                  operation: "set",
                  value: "https://www.instagram.com/",
                },
                {
                  header: "Origin",
                  operation: "set",
                  value: "https://www.instagram.com/",
                },
              ],
            },
            condition: {
              requestDomains: ["cdninstagram.com", "fbcdn.net"],
              resourceTypes: ["image", "xmlhttprequest"],
            },
          },
        ],
      });
      console.log("[Background] Instagram CDN DNR rules updated.");
    } catch (err) {
      console.error("[Background] Failed to update DNR rules:", err);
    }
  };

  setupDnrRules();

  browser.runtime.onInstalled.addListener(() => {
    setupDnrRules();
  });
});
