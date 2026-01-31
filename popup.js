// Popup script for SpyWeb extension

let inspecting = false;

// Get DOM elements
const inspectBtn = document.getElementById('inspectBtn');
const inspectBtnText = document.getElementById('inspectBtnText');
const viewMaskedBtn = document.getElementById('viewMasked');
const clearAllBtn = document.getElementById('clearAll');
const statusDiv = document.getElementById('status');
const maskTextInput = document.getElementById('maskText');
const maskColorInput = document.getElementById('maskColor');
const maskImageInput = document.getElementById('maskImage');
const undoRedoContainer = document.getElementById('undoRedoContainer');
const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');
const popoutBtn = document.getElementById('popoutBtn');

// Check if we're running in a popup window (detect via URL parameter)
const urlParams = new URLSearchParams(window.location.search);
const isFloatingPanel = urlParams.get('floating') === 'true';
const targetTabId = urlParams.get('tabId') ? parseInt(urlParams.get('tabId')) : null;

// Helper function to get the target tab ID (works for both popup and floating panel)
async function getTargetTabId() {
  // If we're in a floating panel and have a stored tab ID, use it
  if (isFloatingPanel && targetTabId) {
    return targetTabId;
  }
  
  // Query for active tab in a normal browser window (excludes popup windows)
  const tabs = await chrome.tabs.query({ active: true, windowType: 'normal' });
  
  // Filter out extension pages
  const webTab = tabs.find(tab => tab.url && !tab.url.startsWith('chrome-extension://'));
  if (webTab) {
    return webTab.id;
  }
  
  // Fallback: get all tabs and find a non-extension one
  const allTabs = await chrome.tabs.query({ windowType: 'normal' });
  const fallbackTab = allTabs.find(tab => tab.url && !tab.url.startsWith('chrome-extension://') && !tab.url.startsWith('chrome://'));
  return fallbackTab ? fallbackTab.id : null;
}

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  // Hide popout button if we're already in a floating panel
  if (isFloatingPanel && popoutBtn) {
    popoutBtn.style.display = 'none';
  }
  
  // Load saved settings
  const settings = await chrome.storage.sync.get(['maskSettings']);
  if (settings.maskSettings) {
    applySettings(settings.maskSettings);
  }

  // Update inspection button state
  const tabId = await getTargetTabId();
  if (tabId) {
    chrome.tabs.sendMessage(tabId, { action: 'getInspectionState' }, (response) => {
      if (chrome.runtime.lastError) {
        // Content script not loaded yet, ignore
        return;
      }
      if (response && response.inspecting) {
        updateInspectButton(true);
      }
    });
  }
});

// Apply saved settings
function applySettings(settings) {
  if (settings.maskType) {
    document.querySelector(`input[name="maskType"][value="${settings.maskType}"]`).checked = true;
  }
  if (settings.maskText) {
    maskTextInput.value = settings.maskText;
  }
  if (settings.maskColor) {
    maskColorInput.value = settings.maskColor;
  }
  if (settings.maskImage) {
    maskImageInput.value = settings.maskImage;
  }
  if (settings.maskScope) {
    document.querySelector(`input[name="maskScope"][value="${settings.maskScope}"]`).checked = true;
  }
}

// Get current settings
function getCurrentSettings() {
  const maskType = document.querySelector('input[name="maskType"]:checked').value;
  const maskScope = document.querySelector('input[name="maskScope"]:checked').value;
  
  return {
    maskType,
    maskText: maskTextInput.value,
    maskColor: maskColorInput.value,
    maskImage: maskImageInput.value,
    maskScope
  };
}

// Save settings
async function saveSettings() {
  const settings = getCurrentSettings();
  await chrome.storage.sync.set({ maskSettings: settings });
}

// Update inspect button state
function updateInspectButton(isInspecting) {
  inspecting = isInspecting;
  if (isInspecting) {
    inspectBtn.classList.add('active');
    inspectBtnText.textContent = 'Stop Inspection';
    undoRedoContainer.style.display = 'flex';
    updateUndoRedoState();
  } else {
    inspectBtn.classList.remove('active');
    inspectBtnText.textContent = 'Start Inspection';
    undoRedoContainer.style.display = 'none';
  }
}

// Update undo/redo button states
async function updateUndoRedoState() {
  const tabId = await getTargetTabId();
  if (tabId) {
    chrome.tabs.sendMessage(tabId, { action: 'getUndoRedoState' }, (response) => {
      if (chrome.runtime.lastError) {
        return;
      }
      if (response) {
        undoBtn.disabled = !response.canUndo;
        redoBtn.disabled = !response.canRedo;
      }
    });
  }
}

// Show status message
function showStatus(message, type = 'info') {
  statusDiv.textContent = message;
  statusDiv.className = `status show ${type}`;
  setTimeout(() => {
    statusDiv.classList.remove('show');
  }, 3000);
}

// Inspect button handler
inspectBtn.addEventListener('click', async () => {
  await saveSettings();
  const settings = getCurrentSettings();
  
  const tabId = await getTargetTabId();
  if (tabId) {
    chrome.tabs.sendMessage(tabId, {
      action: inspecting ? 'stopInspection' : 'startInspection',
      settings
    }, (response) => {
      if (chrome.runtime.lastError) {
        showStatus('Error: Could not connect to page. Please refresh.', 'error');
        return;
      }
      
      if (response && response.success) {
        updateInspectButton(!inspecting);
        showStatus(
          inspecting ? 'Inspection stopped' : 'Click on elements to mask them',
          'success'
        );
      }
    });
  }
});

// View masked elements button
viewMaskedBtn.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// Clear all masks button
clearAllBtn.addEventListener('click', async () => {
  if (confirm('Are you sure you want to clear all masked elements?')) {
    const tabId = await getTargetTabId();
    if (tabId) {
      let tab;
      try {
        tab = await chrome.tabs.get(tabId);
      } catch (error) {
        showStatus('Error: Could not access page. Tab may have been closed.', 'error');
        return;
      }
      
      const url = new URL(tab.url);
      const domain = url.hostname;
      
      // Get all masked elements
      const data = await chrome.storage.local.get(['maskedElements']);
      const maskedElements = data.maskedElements || {};
      
      // Clear for current domain
      delete maskedElements[domain];
      
      await chrome.storage.local.set({ maskedElements });
      
      // Notify content script to refresh
      chrome.tabs.sendMessage(tabId, { action: 'refreshMasks' }, (response) => {
        if (chrome.runtime.lastError) {
          // Content script not loaded, ignore
          return;
        }
        if (response) {
          showStatus('All masks cleared for this site', 'success');
        }
      });
    }
  }
});

// Save settings and broadcast to content script if inspecting
async function saveAndBroadcastSettings() {
  const settings = getCurrentSettings();
  await chrome.storage.sync.set({ maskSettings: settings });
  
  // Broadcast settings change to content script if inspecting (Issue 3)
  if (inspecting) {
    const tabId = await getTargetTabId();
    if (tabId) {
      chrome.tabs.sendMessage(tabId, {
        action: 'updateSettings',
        settings
      }).catch((error) => {
        // Expected error when content script not loaded (e.g., on chrome:// pages)
        // Other errors are silently ignored as they don't affect core functionality
        if (error.message && !error.message.includes('Receiving end does not exist')) {
          console.debug('SpyWeb: Could not update settings on tab:', error.message);
        }
      });
    }
  }
}

// Save settings when changed
document.querySelectorAll('input[name="maskType"], input[name="maskScope"]').forEach(input => {
  input.addEventListener('change', saveAndBroadcastSettings);
});

[maskTextInput, maskColorInput, maskImageInput].forEach(input => {
  input.addEventListener('input', saveAndBroadcastSettings);
});

// Undo button handler
undoBtn.addEventListener('click', async () => {
  const tabId = await getTargetTabId();
  if (tabId) {
    chrome.tabs.sendMessage(tabId, { action: 'undo' }, (response) => {
      if (chrome.runtime.lastError) {
        showStatus('Error: Could not connect to page', 'error');
        return;
      }
      if (response) {
        undoBtn.disabled = !response.canUndo;
        redoBtn.disabled = !response.canRedo;
      }
    });
  }
});

// Redo button handler
redoBtn.addEventListener('click', async () => {
  const tabId = await getTargetTabId();
  if (tabId) {
    chrome.tabs.sendMessage(tabId, { action: 'redo' }, (response) => {
      if (chrome.runtime.lastError) {
        showStatus('Error: Could not connect to page', 'error');
        return;
      }
      if (response) {
        undoBtn.disabled = !response.canUndo;
        redoBtn.disabled = !response.canRedo;
      }
    });
  }
});

// Popout button handler - opens floating panel window
popoutBtn.addEventListener('click', async () => {
  // Get current window position to place popup nearby
  const currentWindow = await chrome.windows.getCurrent();
  
  // Get the current target tab ID to pass to the floating panel
  const tabId = await getTargetTabId();
  
  // Create a new popup window
  chrome.windows.create({
    url: chrome.runtime.getURL(`popup.html?floating=true&tabId=${tabId}`),
    type: 'popup',
    width: 380,
    height: 600,
    top: currentWindow.top + 50,
    left: currentWindow.left + currentWindow.width - 400,
    focused: true
  }, (newWindow) => {
    // Close the current popup
    window.close();
  });
});
