// Popup script for SpyWeb extension

let inspecting = false;

// Constants
const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB max for uploaded images

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

// New text styling elements
const textMaskColorInput = document.getElementById('textMaskColor');
const textMaskFontSelect = document.getElementById('textMaskFont');
const textMaskSizeInput = document.getElementById('textMaskSize');

// Image upload elements
const maskImageFileInput = document.getElementById('maskImageFile');
const uploadImageBtn = document.getElementById('uploadImageBtn');
const uploadedFileName = document.getElementById('uploadedFileName');

// Modal elements
const confirmModal = document.getElementById('confirmModal');
const confirmCancelBtn = document.getElementById('confirmCancel');
const confirmOkBtn = document.getElementById('confirmOk');

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
    
    // Register this floating panel window for always-on-top behavior
    const currentWindow = await chrome.windows.getCurrent();
    chrome.runtime.sendMessage({
      action: 'registerFloatingPanel',
      windowId: currentWindow.id
    });
    
    // Unregister when the window is closed
    window.addEventListener('beforeunload', () => {
      chrome.runtime.sendMessage({ action: 'unregisterFloatingPanel' });
    });
  }
  
  // Load saved settings (sync storage for regular settings)
  const settings = await chrome.storage.sync.get(['maskSettings']);
  if (settings.maskSettings) {
    applySettings(settings.maskSettings);
  }
  
  // Load local image separately from local storage
  const localData = await chrome.storage.local.get(['maskImageLocal']);
  if (localData.maskImageLocal) {
    // If settings indicate to use local image, apply it
    if (settings.maskSettings && settings.maskSettings.useLocalImage) {
      maskImageInput.value = localData.maskImageLocal;
      uploadedFileName.textContent = '✓ Local image loaded';
    }
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
  // Only apply maskImage (URL) if not using local image
  // Local image is applied separately in DOMContentLoaded
  if (settings.maskImage && !settings.useLocalImage) {
    maskImageInput.value = settings.maskImage;
  }
  if (settings.maskScope) {
    document.querySelector(`input[name="maskScope"][value="${settings.maskScope}"]`).checked = true;
  }
  // Apply new text styling settings
  if (settings.textMaskColor) {
    textMaskColorInput.value = settings.textMaskColor;
  }
  if (settings.textMaskFont) {
    textMaskFontSelect.value = settings.textMaskFont;
  }
  if (settings.textMaskSize) {
    textMaskSizeInput.value = settings.textMaskSize;
  }
}

// Get current settings
function getCurrentSettings() {
  const maskType = document.querySelector('input[name="maskType"]:checked').value;
  const maskScope = document.querySelector('input[name="maskScope"]:checked').value;
  const maskImageValue = maskImageInput.value;
  
  // Check if the current image is a local image (data URL)
  const isLocalImage = maskImageValue.startsWith('data:');
  
  return {
    maskType,
    maskText: maskTextInput.value,
    maskColor: maskColorInput.value,
    // Only include URL in maskImage, not data URLs (local images stored separately)
    maskImage: isLocalImage ? '' : maskImageValue,
    useLocalImage: isLocalImage,
    maskScope,
    // New text styling settings
    textMaskColor: textMaskColorInput.value,
    textMaskFont: textMaskFontSelect.value,
    textMaskSize: textMaskSizeInput.value
  };
}

// Handle local image storage - stores data URLs in local storage (larger quota)
// and clears local storage when switching to URL-based images
async function handleLocalImageStorage(maskImageValue) {
  if (maskImageValue.startsWith('data:')) {
    // Store local image in local storage (larger quota)
    await chrome.storage.local.set({ maskImageLocal: maskImageValue });
  } else {
    // Clear local image when switching to URL or clearing the input
    await chrome.storage.local.remove(['maskImageLocal']);
  }
}

// Save settings
async function saveSettings() {
  const settings = getCurrentSettings();
  const maskImageValue = maskImageInput.value;
  
  // Handle local image storage separately
  await handleLocalImageStorage(maskImageValue);
  
  // Save settings to sync storage (without the large data URL)
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
  
  // Include the actual image data for content script
  const settingsWithImage = {
    ...settings,
    maskImage: maskImageInput.value // Include actual value for content script
  };
  
  const tabId = await getTargetTabId();
  if (tabId) {
    chrome.tabs.sendMessage(tabId, {
      action: inspecting ? 'stopInspection' : 'startInspection',
      settings: settingsWithImage
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

// Show custom confirmation modal
function showConfirmModal() {
  confirmModal.style.display = 'flex';
}

// Hide custom confirmation modal
function hideConfirmModal() {
  confirmModal.style.display = 'none';
}

// Clear all masks button - shows custom modal
clearAllBtn.addEventListener('click', () => {
  showConfirmModal();
});

// Handle modal cancel button
confirmCancelBtn.addEventListener('click', () => {
  hideConfirmModal();
});

// Handle modal confirm button
confirmOkBtn.addEventListener('click', async () => {
  hideConfirmModal();
  
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
});

// Close modal when clicking outside the modal content
confirmModal.addEventListener('click', (event) => {
  if (event.target === confirmModal) {
    hideConfirmModal();
  }
});

// Save settings and broadcast to content script if inspecting
async function saveAndBroadcastSettings() {
  const settings = getCurrentSettings();
  const maskImageValue = maskImageInput.value;
  
  // Handle local image storage separately
  await handleLocalImageStorage(maskImageValue);
  
  // Save settings to sync storage (without the large data URL)
  await chrome.storage.sync.set({ maskSettings: settings });
  
  // For content script, we need to include the actual image data
  // Build settings with the actual image for the content script
  const settingsWithImage = {
    ...settings,
    maskImage: maskImageValue // Include actual value for content script
  };
  
  // Always broadcast settings change to content script
  // This ensures content script has latest settings even if popup's inspecting state is out of sync
  const tabId = await getTargetTabId();
  if (tabId) {
    chrome.tabs.sendMessage(tabId, {
      action: 'updateSettings',
      settings: settingsWithImage
    }).catch((error) => {
      // Expected error when content script not loaded (e.g., on chrome:// pages)
      // Other errors are silently ignored as they don't affect core functionality
      if (error.message && !error.message.includes('Receiving end does not exist')) {
        console.debug('SpyWeb: Could not update settings on tab:', error.message);
      }
    });
  }
}

// Save settings when changed
document.querySelectorAll('input[name="maskType"], input[name="maskScope"]').forEach(input => {
  input.addEventListener('change', saveAndBroadcastSettings);
});

[maskTextInput, maskColorInput, maskImageInput, textMaskColorInput, textMaskSizeInput].forEach(input => {
  input.addEventListener('input', saveAndBroadcastSettings);
});

// Font select needs 'change' event
textMaskFontSelect.addEventListener('change', saveAndBroadcastSettings);

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
  
  // Create a new popup window that stays on top
  chrome.windows.create({
    url: chrome.runtime.getURL(`popup.html?floating=true&tabId=${tabId}`),
    type: 'popup',
    width: 380,
    height: 600,
    top: currentWindow.top + 50,
    left: currentWindow.left + currentWindow.width - 400,
    focused: true
  }, (newWindow) => {
    // The popup window will be created with focus
    // Close the current popup
    window.close();
  });
});

// Upload image button handler - triggers file input
uploadImageBtn.addEventListener('click', () => {
  maskImageFileInput.click();
});

// File input change handler - converts uploaded image to data URL
maskImageFileInput.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  
  // Validate file type
  if (!file.type.startsWith('image/')) {
    showStatus('Please select an image file', 'error');
    return;
  }
  
  // Validate file size to avoid storage issues
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    showStatus('Image too large. Max size: 2MB', 'error');
    return;
  }
  
  try {
    // Convert to data URL
    const dataUrl = await readFileAsDataURL(file);
    
    // Set the data URL as the mask image
    maskImageInput.value = dataUrl;
    
    // Automatically select the "image" mask type when uploading a local image
    const imageRadioBtn = document.querySelector('input[name="maskType"][value="image"]');
    if (imageRadioBtn) {
      imageRadioBtn.checked = true;
    }
    
    // Show uploaded file name
    uploadedFileName.textContent = `✓ ${file.name}`;
    
    // Save settings
    await saveAndBroadcastSettings();
    
    showStatus('Image uploaded successfully', 'success');
  } catch (error) {
    showStatus(`Error reading image: ${error.message || 'Unknown error'}`, 'error');
  }
});

// Helper function to read file as data URL
function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// Clear uploaded file name when URL input changes
maskImageInput.addEventListener('input', () => {
  // Clear uploaded file indicator if user types a URL manually
  if (!maskImageInput.value.startsWith('data:')) {
    uploadedFileName.textContent = '';
  }
  // Note: Local image storage is handled by handleLocalImageStorage() in saveAndBroadcastSettings()
});
