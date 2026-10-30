import { defineConfig } from "wxt";

// See https://wxt.dev/api/reference/wxt/interfaces/inlineconfig.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "IG Imbalance",
    description: "Instagram Followers & Following Imbalance",
    permissions: ["activeTab", "tabs", "cookies"],
    host_permissions: ["*://*.instagram.com/*"],
  },
  webExt: {
    disabled: true,
  },
});
