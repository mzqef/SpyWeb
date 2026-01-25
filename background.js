// Background service worker for SpyWeb extension

// Initialize storage with default settings
chrome.runtime.onInstalled.addListener(async () => {
  const defaultSettings = {
    maskType: 'text',
    maskText: '████████',
    maskColor: '#000000',
    maskImage: '',
    maskScope: 'current'
  };
  
  const data = await chrome.storage.sync.get(['maskSettings']);
  if (!data.maskSettings) {
    await chrome.storage.sync.set({ maskSettings: defaultSettings });
  }
  
  console.log('SpyWeb extension installed');
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  // Open popup (this is handled automatically by the action.default_popup in manifest)
});

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getMaskedElements') {
    chrome.storage.local.get(['maskedElements'], (data) => {
      sendResponse({ maskedElements: data.maskedElements || {} });
    });
    return true;
  }
  
  if (request.action === 'updateMaskedElements') {
    chrome.storage.local.set({ maskedElements: request.maskedElements }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});

// Sync settings across tabs
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && changes.maskSettings) {
    // Settings changed, notify all tabs
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          action: 'settingsUpdated',
          settings: changes.maskSettings.newValue
        }).catch(() => {
          // Ignore errors for tabs that don't have the content script
        });
      });
    });
  }
});
