// Options page script for SpyWeb

let maskedElements = {};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadMaskedElements();
  renderMaskedElements();
  
  // Set up event listeners
  document.getElementById('clearAllBtn').addEventListener('click', clearAllMasks);
  document.getElementById('exportBtn').addEventListener('click', exportSettings);
  document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('importFile').click();
  });
  document.getElementById('importFile').addEventListener('change', importSettings);
});

// Load masked elements from storage
async function loadMaskedElements() {
  const data = await chrome.storage.local.get(['maskedElements']);
  maskedElements = data.maskedElements || {};
}

// Render masked elements list
function renderMaskedElements() {
  const listContainer = document.getElementById('maskedList');
  
  // Check if there are any masked elements
  const domains = Object.keys(maskedElements);
  if (domains.length === 0) {
    listContainer.innerHTML = '<p class="empty-state">No masked elements yet. Start masking elements from the extension popup!</p>';
    return;
  }
  
  // Clear container
  listContainer.innerHTML = '';
  
  // Group by domain
  domains.forEach(domain => {
    const elements = maskedElements[domain];
    if (!elements || elements.length === 0) return;
    
    // Create domain group
    const domainGroup = document.createElement('div');
    domainGroup.className = 'domain-group';
    
    // Domain header
    const header = document.createElement('div');
    header.className = 'domain-header';
    header.innerHTML = `
      <h2>${domain}</h2>
      <span class="domain-count">${elements.length} element${elements.length !== 1 ? 's' : ''}</span>
    `;
    domainGroup.appendChild(header);
    
    // Element list
    const elementList = document.createElement('div');
    elementList.className = 'element-list';
    
    elements.forEach((element, index) => {
      const item = createElementItem(element, domain, index);
      elementList.appendChild(item);
    });
    
    domainGroup.appendChild(elementList);
    listContainer.appendChild(domainGroup);
  });
}

// Create element item HTML
function createElementItem(element, domain, index) {
  const item = document.createElement('div');
  item.className = 'element-item';
  
  const info = document.createElement('div');
  info.className = 'element-info';
  
  const selector = document.createElement('div');
  selector.className = 'element-selector';
  selector.textContent = element.selector;
  
  const meta = document.createElement('div');
  meta.className = 'element-meta';
  
  const maskType = element.settings?.maskType || 'text';
  const maskTypeText = maskType.charAt(0).toUpperCase() + maskType.slice(1);
  
  meta.innerHTML = `
    <span>Type: <span class="badge">${maskTypeText}</span></span>
    ${element.isInput ? '<span class="badge badge-input">Input Element</span>' : ''}
    ${element.scope === 'all' ? '<span class="badge badge-global">Global</span>' : ''}
    <span>Added: ${new Date(element.timestamp).toLocaleDateString()}</span>
  `;
  
  info.appendChild(selector);
  info.appendChild(meta);
  
  const actions = document.createElement('div');
  actions.className = 'element-actions';
  
  const removeBtn = document.createElement('button');
  removeBtn.className = 'btn-small btn-remove';
  removeBtn.textContent = 'Remove';
  removeBtn.addEventListener('click', () => removeElement(domain, index));
  
  actions.appendChild(removeBtn);
  
  item.appendChild(info);
  item.appendChild(actions);
  
  return item;
}

// Remove element
async function removeElement(domain, index) {
  if (!maskedElements[domain]) return;
  
  maskedElements[domain].splice(index, 1);
  
  // Clean up empty domain
  if (maskedElements[domain].length === 0) {
    delete maskedElements[domain];
  }
  
  // Save to storage
  await chrome.storage.local.set({ maskedElements });
  
  // Re-render
  renderMaskedElements();
  
  // Notify content scripts to refresh
  const tabs = await chrome.tabs.query({});
  tabs.forEach(tab => {
    chrome.tabs.sendMessage(tab.id, { action: 'refreshMasks' }).catch(() => {
      // Ignore errors for tabs without content script
    });
  });
  
  showStatus('Element removed successfully', 'success');
}

// Clear all masks
async function clearAllMasks() {
  if (!confirm('Are you sure you want to clear all masked elements from all websites?')) {
    return;
  }
  
  maskedElements = {};
  await chrome.storage.local.set({ maskedElements });
  
  renderMaskedElements();
  
  // Notify all tabs
  const tabs = await chrome.tabs.query({});
  tabs.forEach(tab => {
    chrome.tabs.sendMessage(tab.id, { action: 'refreshMasks' }).catch(() => {
      // Ignore errors for tabs without content script loaded
    });
  });
  
  showStatus('All masks cleared', 'success');
}

// Export settings
async function exportSettings() {
  const data = {
    maskedElements,
    settings: await chrome.storage.sync.get(['maskSettings']),
    exportDate: new Date().toISOString(),
    version: '1.0.0'
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `spyweb-settings-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  
  showStatus('Settings exported successfully', 'success');
}

// Import settings
async function importSettings(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    
    if (data.maskedElements) {
      maskedElements = data.maskedElements;
      await chrome.storage.local.set({ maskedElements });
    }
    
    if (data.settings && data.settings.maskSettings) {
      await chrome.storage.sync.set({ maskSettings: data.settings.maskSettings });
    }
    
    renderMaskedElements();
    
    // Notify all tabs
    const tabs = await chrome.tabs.query({});
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { action: 'refreshMasks' }).catch(() => {});
    });
    
    showStatus('Settings imported successfully', 'success');
  } catch (error) {
    showStatus('Error importing settings: ' + error.message, 'error');
  }
  
  // Reset file input
  event.target.value = '';
}

// Show status message
function showStatus(message, type = 'info') {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = message;
  statusDiv.className = `status show ${type}`;
  setTimeout(() => {
    statusDiv.classList.remove('show');
  }, 3000);
}
