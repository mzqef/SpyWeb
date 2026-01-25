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

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  // Load saved settings
  const settings = await chrome.storage.sync.get(['maskSettings']);
  if (settings.maskSettings) {
    applySettings(settings.maskSettings);
  }

  // Update inspection button state
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs[0]) {
    chrome.tabs.sendMessage(tabs[0].id, { action: 'getInspectionState' }, (response) => {
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
  } else {
    inspectBtn.classList.remove('active');
    inspectBtnText.textContent = 'Start Inspection';
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
  
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs[0]) {
    chrome.tabs.sendMessage(tabs[0].id, {
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
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) {
      const url = new URL(tabs[0].url);
      const domain = url.hostname;
      
      // Get all masked elements
      const data = await chrome.storage.local.get(['maskedElements']);
      const maskedElements = data.maskedElements || {};
      
      // Clear for current domain
      delete maskedElements[domain];
      
      await chrome.storage.local.set({ maskedElements });
      
      // Notify content script to refresh
      chrome.tabs.sendMessage(tabs[0].id, { action: 'refreshMasks' }, (response) => {
        if (!chrome.runtime.lastError) {
          showStatus('All masks cleared for this site', 'success');
        }
      });
    }
  }
});

// Save settings when changed
document.querySelectorAll('input[name="maskType"], input[name="maskScope"]').forEach(input => {
  input.addEventListener('change', saveSettings);
});

[maskTextInput, maskColorInput, maskImageInput].forEach(input => {
  input.addEventListener('input', saveSettings);
});
