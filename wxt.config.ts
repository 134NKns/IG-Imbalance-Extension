import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";

// See https://wxt.dev/api/reference/wxt/interfaces/inlineconfig.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: "IG Imbalance",
    description: "Instagram Followers & Following Imbalance",
    permissions: [
      "activeTab",
      "tabs",
      "cookies",
      "scripting",
      "storage",
      "declarativeNetRequest",
      "declarativeNetRequestWithHostAccess",
    ],
    host_permissions: [
      "*://*.instagram.com/*",
      "*://*.cdninstagram.com/*",
      "*://*.fbcdn.net/*",
    ],
    content_security_policy: {
      extension_pages:
        "script-src 'self'; object-src 'self'; img-src 'self' https://*.cdninstagram.com https://*.fbcdn.net https://*.instagram.com data: blob:;",
    },
  },
  webExt: {
    disabled: true,
  },
});
