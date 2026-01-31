// Background service worker for SpyWeb extension

// Track the floating panel window ID for always-on-top behavior
let floatingPanelWindowId = null;

// Initialize storage with default settings
chrome.runtime.onInstalled.addListener(async () => {
  const defaultSettings = {
    maskType: 'text',
    maskText: '████████',
    maskColor: '#000000',
    maskImage: '',
    useLocalImage: false, // Flag to indicate whether to use local image (stored separately in local storage)
    maskScope: 'current',
    // New text styling settings
    textMaskColor: '#000000',
    textMaskFont: '',
    textMaskSize: ''
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
  
  // Handle floating panel window registration for always-on-top behavior
  if (request.action === 'registerFloatingPanel') {
    floatingPanelWindowId = request.windowId;
    sendResponse({ success: true });
    return true;
  }
});

// Keep floating panel always on top when other windows are focused
chrome.windows.onFocusChanged.addListener((windowId) => {
  // If a floating panel is registered and another window gains focus,
  // bring the floating panel back to focus (always-on-top behavior)
  if (floatingPanelWindowId !== null && 
      windowId !== chrome.windows.WINDOW_ID_NONE && 
      windowId !== floatingPanelWindowId) {
    // Check if the floating panel window still exists
    chrome.windows.get(floatingPanelWindowId, (window) => {
      if (chrome.runtime.lastError) {
        // Window no longer exists, clear the ID
        floatingPanelWindowId = null;
        return;
      }
      // Bring the floating panel to front
      chrome.windows.update(floatingPanelWindowId, { focused: true });
    });
  }
});

// Clean up when the floating panel window is removed
chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === floatingPanelWindowId) {
    floatingPanelWindowId = null;
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
