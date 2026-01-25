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

// Get the best element for masking (handle SVG, icons, images, etc.)
function getBestMaskableElement(element) {
  // For SVG elements, try to find the parent clickable/interactive element
  if (element instanceof SVGElement) {
    let current = element;
    // Walk up to find a meaningful parent (button, link, or the SVG root)
    while (current && current instanceof SVGElement) {
      if (current.tagName.toLowerCase() === 'svg') {
        // Check if svg has a clickable parent
        const parent = current.parentElement;
        if (parent && (parent.tagName === 'BUTTON' || parent.tagName === 'A' || 
            parent.onclick || parent.getAttribute('role') === 'button' ||
            parent.classList.contains('btn') || parent.classList.contains('icon') ||
            parent.style.cursor === 'pointer')) {
          return parent;
        }
        return current;
      }
      current = current.parentElement;
    }
  }
  
  // For IMG elements, always return the image itself as it's maskable
  if (element.tagName === 'IMG') {
    return element;
  }
  
  // For icon elements (i, span with icon classes), get their container
  // Handle both string and SVGAnimatedString className types
  const classNameStr = typeof element.className === 'string' 
    ? element.className 
    : (element.className?.baseVal || '');
  
  if (element.tagName === 'I' || (element.tagName === 'SPAN' && 
      (classNameStr.includes('icon') || classNameStr.includes('fa-') || 
       classNameStr.includes('material-icons') || classNameStr.includes('glyphicon')))) {
    const parent = element.parentElement;
    if (parent && (parent.tagName === 'BUTTON' || parent.tagName === 'A' || 
        parent.onclick || parent.getAttribute('role') === 'button')) {
      return parent;
    }
  }
  
  // For use elements in SVGs
  if (element.tagName.toLowerCase() === 'use') {
    let svgParent = element.closest('svg');
    if (svgParent) {
      const parent = svgParent.parentElement;
      if (parent && (parent.tagName === 'BUTTON' || parent.tagName === 'A' || 
          parent.onclick || parent.getAttribute('role') === 'button')) {
        return parent;
      }
      return svgParent;
    }
  }
  
  return element;
}

// Get element selector
function getElementSelector(element) {
  // Try to get a unique selector
  if (element.id) {
    return `#${CSS.escape(element.id)}`;
  }
  
  let path = [];
  let currentElement = element;
  while (currentElement && currentElement.nodeType === Node.ELEMENT_NODE) {
    let selector = currentElement.nodeName.toLowerCase();
    
    // Handle SVG namespace
    if (currentElement instanceof SVGElement && currentElement.tagName.toLowerCase() !== 'svg') {
      selector = currentElement.tagName.toLowerCase();
    }
    
    // Get class names (handle SVGAnimatedString for SVG elements)
    let classNames = '';
    if (currentElement.className) {
      if (typeof currentElement.className === 'string') {
        classNames = currentElement.className;
      } else if (currentElement.className.baseVal) {
        classNames = currentElement.className.baseVal;
      }
    }
    
    if (classNames) {
      const classes = classNames.trim().split(/\s+/)
        .filter(c => c && !c.startsWith('spyweb-'))
        .map(c => CSS.escape(c));
      if (classes.length > 0) {
        selector += '.' + classes.join('.');
      }
    }
    
    // Add nth-of-type if needed for uniqueness
    let sibling = currentElement;
    let nth = 1;
    while (sibling = sibling.previousElementSibling) {
      if (sibling.nodeName.toLowerCase() === currentElement.nodeName.toLowerCase()) {
        nth++;
      }
    }
    
    if (nth > 1) {
      selector += `:nth-of-type(${nth})`;
    }
    
    path.unshift(selector);
    currentElement = currentElement.parentElement;
    
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
  
  let element = document.elementFromPoint(e.clientX, e.clientY);
  if (element && !element.classList.contains('spyweb-highlight-overlay')) {
    // Get the best maskable element (handles SVG, icons, etc.)
    element = getBestMaskableElement(element);
    highlightElement(element);
  }
}

// Click handler for selecting element
function onClick(e) {
  if (!inspecting) return;
  
  e.preventDefault();
  e.stopPropagation();
  
  let element = e.target;
  if (element && !element.classList.contains('spyweb-highlight-overlay')) {
    // Get the best maskable element (handles SVG, icons, etc.)
    element = getBestMaskableElement(element);
    addMaskedElement(element);
    removeHighlight();
  }
}

// Add element to masked list
async function addMaskedElement(element) {
  const selector = getElementSelector(element);
  const rect = element.getBoundingClientRect();
  const domain = window.location.hostname;
  
  // Capture original styles if using "inherit" mask type
  let originalStyles = null;
  if (settings.maskType === 'inherit') {
    const computedStyle = window.getComputedStyle(element);
    originalStyles = {
      fontFamily: computedStyle.fontFamily,
      fontSize: computedStyle.fontSize,
      fontWeight: computedStyle.fontWeight,
      fontStyle: computedStyle.fontStyle,
      color: computedStyle.color,
      textAlign: computedStyle.textAlign,
      letterSpacing: computedStyle.letterSpacing,
      lineHeight: computedStyle.lineHeight,
      backgroundColor: computedStyle.backgroundColor,
      background: computedStyle.background,
      padding: computedStyle.padding
    };
  }
  
  // Check if element is SVG or contains icons (optimized check)
  const isSvgOrIcon = element instanceof SVGElement || 
                       element.tagName === 'I' ||
                       (element.tagName === 'BUTTON' && element.firstElementChild?.tagName === 'svg') ||
                       (element.tagName === 'A' && element.firstElementChild?.tagName === 'svg') ||
                       (element.tagName === 'SPAN' && element.firstElementChild?.tagName === 'svg');
  
  // Check if element is an image (including those with srcset)
  const isImage = element.tagName === 'IMG';
  
  const maskedElement = {
    selector,
    domain,
    settings: { ...settings },
    timestamp: Date.now(),
    isInput: element.tagName === 'INPUT' || element.tagName === 'TEXTAREA',
    isSvgOrIcon,
    isImage,
    scope: settings.maskScope || 'current',
    originalStyles
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
  // For image elements, we need special handling since we can't append children to <img>
  const isImageElement = element.tagName === 'IMG';
  
  if (isImageElement) {
    // Check if a SpyWeb wrapper already exists for this image
    let wrapper = element.closest('.spyweb-img-wrapper');
    if (!wrapper) {
      // Create a wrapper for the image
      wrapper = document.createElement('span');
      wrapper.className = 'spyweb-img-wrapper';
      wrapper.style.display = 'inline-block';
      wrapper.style.position = 'relative';
      
      // Preserve image positioning
      const computedStyle = window.getComputedStyle(element);
      if (computedStyle.display === 'block') {
        wrapper.style.display = 'block';
      }
      
      // Insert wrapper before the image and move image into it
      element.parentNode.insertBefore(wrapper, element);
      wrapper.appendChild(element);
    }
    
    // Remove existing mask if any
    const existingMask = wrapper.querySelector('.spyweb-mask');
    if (existingMask) {
      existingMask.remove();
    }
    
    // Mark element as masked
    element.classList.add('spyweb-masked');
    
    // Create mask overlay
    const mask = createMaskElement(element, maskedElement);
    mask.style.pointerEvents = 'none';
    
    // Append mask to wrapper
    wrapper.appendChild(mask);
  } else {
    // Remove existing mask if any
    const existingMask = element.querySelector('.spyweb-mask');
    if (existingMask) {
      existingMask.remove();
    }
    
    // Mark element as masked
    element.classList.add('spyweb-masked');
    
    // Create mask overlay
    const mask = createMaskElement(element, maskedElement);
    
    // For input elements, allow interaction
    if (maskedElement.isInput) {
      mask.style.pointerEvents = 'none';
      element.style.color = 'transparent';
      element.style.caretColor = 'black';
    }
    
    // For SVG/icon elements, ensure proper masking
    if (maskedElement.isSvgOrIcon) {
      mask.style.pointerEvents = 'none';
    }
    
    // Position mask
    element.style.position = 'relative';
    element.appendChild(mask);
  }
}

// Apply fallback styling when image fails or is unavailable
function applyImageFallbackStyles(mask, message) {
  mask.style.backgroundColor = '#cccccc';
  mask.textContent = message;
  mask.style.display = 'flex';
  mask.style.alignItems = 'center';
  mask.style.justifyContent = 'center';
  mask.style.fontSize = '12px';
  mask.style.color = '#666';
}

// Create the mask element with appropriate styling
function createMaskElement(element, maskedElement) {
  const mask = document.createElement('div');
  mask.className = 'spyweb-mask';
  
  // Apply mask style based on settings
  const maskSettings = maskedElement.settings || {};
  const maskType = maskSettings.maskType || 'text';
  
  // Get computed styles for inherit mode or background preservation
  const computedStyle = window.getComputedStyle(element);
  
  if (maskType === 'text') {
    mask.textContent = maskSettings.maskText || '████████';
    mask.style.display = 'flex';
    mask.style.alignItems = 'center';
    mask.style.justifyContent = 'center';
    mask.style.fontSize = '14px';
  } else if (maskType === 'inherit') {
    // Use inherited styles with original background preserved
    mask.textContent = maskSettings.maskText || '████████';
    mask.style.display = 'flex';
    mask.style.alignItems = 'center';
    mask.style.justifyContent = 'center';
    
    // Apply original styles if captured, otherwise get from computed style
    const styles = maskedElement.originalStyles || {};
    
    // Preserve background from the original element
    const bgColor = styles.backgroundColor || computedStyle.backgroundColor;
    const bgFull = styles.background || computedStyle.background;
    
    // If the element has a non-transparent background, use it
    if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
      mask.style.backgroundColor = bgColor;
    } else if (bgFull && bgFull !== 'none') {
      mask.style.background = bgFull;
    } else {
      // Fallback: set transparent so the parent's background shows through
      mask.style.backgroundColor = 'transparent';
    }
    
    // Apply font styles
    mask.style.fontFamily = styles.fontFamily || computedStyle.fontFamily;
    mask.style.fontSize = styles.fontSize || computedStyle.fontSize;
    mask.style.fontWeight = styles.fontWeight || computedStyle.fontWeight;
    mask.style.fontStyle = styles.fontStyle || computedStyle.fontStyle;
    mask.style.color = styles.color || computedStyle.color;
    mask.style.textAlign = styles.textAlign || computedStyle.textAlign;
    mask.style.letterSpacing = styles.letterSpacing || computedStyle.letterSpacing;
    mask.style.lineHeight = styles.lineHeight || computedStyle.lineHeight;
    
    // Apply padding to match original element's layout
    const padding = styles.padding || computedStyle.padding;
    if (padding && padding !== '0px') {
      mask.style.padding = padding;
      mask.style.boxSizing = 'border-box';
    }
  } else if (maskType === 'color') {
    mask.style.backgroundColor = maskSettings.maskColor || '#000000';
  } else if (maskType === 'blur') {
    // backdrop-filter can be performance-intensive, use with care
    mask.style.backdropFilter = 'blur(10px)';
    mask.style.webkitBackdropFilter = 'blur(10px)'; // Safari support
    mask.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
  } else if (maskType === 'image') {
    if (maskSettings.maskImage) {
      // Create an img element to better handle the image (including CORS issues)
      const imgEl = document.createElement('img');
      imgEl.src = maskSettings.maskImage;
      imgEl.style.width = '100%';
      imgEl.style.height = '100%';
      imgEl.style.objectFit = 'cover';
      imgEl.style.objectPosition = 'center';
      imgEl.onerror = function() {
        // Fallback if image fails to load
        applyImageFallbackStyles(mask, '⚠️ Image unavailable');
        this.remove();
      };
      mask.appendChild(imgEl);
      mask.style.backgroundColor = 'transparent';
    } else {
      // No image URL provided, show placeholder
      applyImageFallbackStyles(mask, 'No image URL');
    }
  }
  
  return mask;
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
  
  // Unwrap images from their wrappers
  document.querySelectorAll('.spyweb-img-wrapper').forEach(wrapper => {
    const img = wrapper.querySelector('img');
    if (img && wrapper.parentNode) {
      wrapper.parentNode.insertBefore(img, wrapper);
      wrapper.remove();
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
