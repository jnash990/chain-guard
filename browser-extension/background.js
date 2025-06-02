// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Chain Guard extension installed');
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'CHECK_API_KEY') {
    chrome.storage.local.get('tornApiKey', (result) => {
      sendResponse({ hasApiKey: !!result.tornApiKey });
    });
    return true; // Required for async sendResponse
  }
}); 