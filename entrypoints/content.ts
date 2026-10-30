export default defineContentScript({
  matches: ['*://*.instagram.com/*'],
  main() {
    console.log('IG Imbalance content script loaded.');
  },
});
