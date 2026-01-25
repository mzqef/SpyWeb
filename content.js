// Content script for SpyWeb extension

let inspecting = false;
let highlightedElement = null;
let overlay = null;
let settings = {};
let maskedElements = [];

// Initialize
init();

async function init() {
  // Load settings
  const data = await chrome.storage.sync.get(['maskSettings']);
  if (data.maskSettings) {
    settings = data.maskSettings;
  }
  
  // Load and apply masked elements
  await loadMaskedElements();
  applyMasks();
  
  // Create overlay for highlighting
  createOverlay();
}

// Create highlight overlay
function createOverlay() {
  overlay = document.createElement('div');
  overlay.id = 'spyweb-highlight-overlay';
  overlay.style.display = 'none';
  document.body.appendChild(overlay);
}

// Get element selector
function getElementSelector(element) {
  // Try to get a unique selector
  if (element.id) {
    return `#${element.id}`;
  }
  
  let path = [];
  while (element && element.nodeType === Node.ELEMENT_NODE) {
    let selector = element.nodeName.toLowerCase();
    
    if (element.className && typeof element.className === 'string') {
      const classes = element.className.trim().split(/\s+/)
        .filter(c => !c.startsWith('spyweb-'));
      if (classes.length > 0) {
        selector += '.' + classes.join('.');
      }
    }
    
    // Add nth-child if needed for uniqueness
    let sibling = element;
    let nth = 1;
    while (sibling = sibling.previousElementSibling) {
      if (sibling.nodeName.toLowerCase() === element.nodeName.toLowerCase()) {
        nth++;
      }
    }
    
    if (nth > 1) {
      selector += `:nth-of-type(${nth})`;
    }
    
    path.unshift(selector);
    element = element.parentElement;
    
    // Limit depth
    if (path.length >= 5) break;
  }
  
  return path.join(' > ');
}

// Highlight element on hover
function highlightElement(element) {
  if (!element || element === highlightedElement) return;
  
  highlightedElement = element;
  const rect = element.getBoundingClientRect();
  
  overlay.style.display = 'block';
  overlay.style.top = (rect.top + window.scrollY) + 'px';
  overlay.style.left = (rect.left + window.scrollX) + 'px';
  overlay.style.width = rect.width + 'px';
  overlay.style.height = rect.height + 'px';
}

// Remove highlight
function removeHighlight() {
  if (overlay) {
    overlay.style.display = 'none';
  }
  highlightedElement = null;
}

// Mouse move handler for inspection
function onMouseMove(e) {
  if (!inspecting) return;
  
  e.preventDefault();
  e.stopPropagation();
  
  const element = document.elementFromPoint(e.clientX, e.clientY);
  if (element && !element.classList.contains('spyweb-highlight-overlay')) {
    highlightElement(element);
  }
}

// Click handler for selecting element
function onClick(e) {
  if (!inspecting) return;
  
  e.preventDefault();
  e.stopPropagation();
  
  const element = e.target;
  if (element && !element.classList.contains('spyweb-highlight-overlay')) {
    addMaskedElement(element);
    removeHighlight();
  }
}

// Add element to masked list
async function addMaskedElement(element) {
  const selector = getElementSelector(element);
  const rect = element.getBoundingClientRect();
  const domain = window.location.hostname;
  
  const maskedElement = {
    selector,
    domain,
    settings: { ...settings },
    timestamp: Date.now(),
    isInput: element.tagName === 'INPUT' || element.tagName === 'TEXTAREA',
    scope: settings.maskScope || 'current'
  };
  
  // Load current masked elements
  const data = await chrome.storage.local.get(['maskedElements']);
  const allMasked = data.maskedElements || {};
  
  if (!allMasked[domain]) {
    allMasked[domain] = [];
  }
  
  // Check if already masked
  const exists = allMasked[domain].some(m => m.selector === selector);
  if (!exists) {
    allMasked[domain].push(maskedElement);
    await chrome.storage.local.set({ maskedElements: allMasked });
    
    // Apply mask immediately
    maskedElements = allMasked[domain] || [];
    applyMaskToElement(element, maskedElement);
    
    // Show notification
    showNotification('Element masked successfully');
  } else {
    showNotification('Element already masked');
  }
}

// Load masked elements for current page
async function loadMaskedElements() {
  const domain = window.location.hostname;
  const data = await chrome.storage.local.get(['maskedElements']);
  const allMasked = data.maskedElements || {};
  
  maskedElements = [];
  
  // Add domain-specific masks
  if (allMasked[domain]) {
    maskedElements.push(...allMasked[domain]);
  }
  
  // Add global masks (scope: 'all')
  Object.keys(allMasked).forEach(d => {
    if (d !== domain) {
      const globalMasks = allMasked[d].filter(m => m.scope === 'all');
      maskedElements.push(...globalMasks);
    }
  });
}

// Apply all masks
function applyMasks() {
  maskedElements.forEach(maskedElement => {
    try {
      const elements = document.querySelectorAll(maskedElement.selector);
      elements.forEach(el => {
        applyMaskToElement(el, maskedElement);
      });
    } catch (e) {
      console.error('Error applying mask:', e);
    }
  });
}

// Apply mask to a single element
function applyMaskToElement(element, maskedElement) {
  // Remove existing mask if any
  const existingMask = element.querySelector('.spyweb-mask');
  if (existingMask) {
    existingMask.remove();
  }
  
  // Mark element as masked
  element.classList.add('spyweb-masked');
  
  // Create mask overlay
  const mask = document.createElement('div');
  mask.className = 'spyweb-mask';
  
  // Apply mask style based on settings
  const maskSettings = maskedElement.settings || {};
  const maskType = maskSettings.maskType || 'text';
  
  if (maskType === 'text') {
    mask.textContent = maskSettings.maskText || '████████';
    mask.style.display = 'flex';
    mask.style.alignItems = 'center';
    mask.style.justifyContent = 'center';
    mask.style.fontSize = '14px';
  } else if (maskType === 'color') {
    mask.style.backgroundColor = maskSettings.maskColor || '#000000';
  } else if (maskType === 'blur') {
    mask.style.backdropFilter = 'blur(10px)';
    mask.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
  } else if (maskType === 'image') {
    if (maskSettings.maskImage) {
      mask.style.backgroundImage = `url(${maskSettings.maskImage})`;
      mask.style.backgroundSize = 'cover';
      mask.style.backgroundPosition = 'center';
    }
  }
  
  // For input elements, allow interaction
  if (maskedElement.isInput) {
    mask.style.pointerEvents = 'none';
    element.style.color = 'transparent';
    element.style.caretColor = 'black';
  }
  
  // Position mask
  element.style.position = 'relative';
  element.appendChild(mask);
}

// Show notification
function showNotification(message) {
  const notification = document.createElement('div');
  notification.className = 'spyweb-notification';
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);
  
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 2000);
}

// Start inspection mode
function startInspection(newSettings) {
  inspecting = true;
  settings = newSettings || settings;
  
  document.addEventListener('mousemove', onMouseMove, true);
  document.addEventListener('click', onClick, true);
  document.body.style.cursor = 'crosshair';
  
  showNotification('Inspection mode active - Click elements to mask');
}

// Stop inspection mode
function stopInspection() {
  inspecting = false;
  
  document.removeEventListener('mousemove', onMouseMove, true);
  document.removeEventListener('click', onClick, true);
  document.body.style.cursor = '';
  
  removeHighlight();
  showNotification('Inspection mode stopped');
}

// Refresh masks
async function refreshMasks() {
  // Remove all existing masks
  document.querySelectorAll('.spyweb-mask').forEach(m => m.remove());
  document.querySelectorAll('.spyweb-masked').forEach(el => {
    el.classList.remove('spyweb-masked');
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.style.color = '';
      el.style.caretColor = '';
    }
  });
  
  // Reload and reapply
  await loadMaskedElements();
  applyMasks();
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startInspection') {
    startInspection(request.settings);
    sendResponse({ success: true });
  } else if (request.action === 'stopInspection') {
    stopInspection();
    sendResponse({ success: true });
  } else if (request.action === 'getInspectionState') {
    sendResponse({ inspecting });
  } else if (request.action === 'refreshMasks') {
    refreshMasks();
    sendResponse({ success: true });
  }
  
  return true;
});

// Re-apply masks on dynamic content changes
const observer = new MutationObserver(() => {
  // Debounce to avoid excessive re-application
  clearTimeout(observer.timer);
  observer.timer = setTimeout(() => {
    applyMasks();
  }, 500);
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});
