// Content script for SpyWeb extension

let inspecting = false;
let highlightedElement = null;
let overlay = null;
let settings = {};
let maskedElements = [];
let earlyCssStyleElement = null;

// Undo/Redo state management
let undoStack = [];
let redoStack = [];

// Apply early CSS hiding immediately (before DOM is fully loaded)
// This ensures masked elements are hidden from the start
applyEarlyCssHiding();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Inject CSS rules to hide masked elements before the page renders
async function applyEarlyCssHiding() {
  try {
    const domain = window.location.hostname;
    const data = await chrome.storage.local.get(['maskedElements']);
    const allMasked = data.maskedElements || {};
    
    // Collect selectors to hide early
    const selectorsToHide = [];
    
    // Add domain-specific masks
    if (allMasked[domain]) {
      allMasked[domain].forEach(m => {
        if (m.selector) {
          selectorsToHide.push(m.selector);
        }
      });
    }
    
    // Add global masks (scope: 'all')
    Object.keys(allMasked).forEach(d => {
      if (d !== domain) {
        const globalMasks = allMasked[d].filter(m => m.scope === 'all');
        globalMasks.forEach(m => {
          if (m.selector) {
            selectorsToHide.push(m.selector);
          }
        });
      }
    });
    
    if (selectorsToHide.length > 0) {
      // Create a style element to inject early hiding rules
      earlyCssStyleElement = document.createElement('style');
      earlyCssStyleElement.id = 'spyweb-early-hide';
      
      // Build CSS rules to hide elements immediately
      // Use visibility:hidden to preserve layout, with opacity:0 as fallback
      const cssRules = selectorsToHide.map(selector => {
        // Basic validation: selector should not be empty and should not contain dangerous characters
        // More thorough validation happens when the CSS is applied by the browser
        if (!selector || selector.includes('{') || selector.includes('}')) {
          return '';
        }
        return `${selector} { visibility: hidden !important; opacity: 0 !important; }`;
      }).filter(rule => rule).join('\n');
      
      earlyCssStyleElement.textContent = cssRules;
      
      // Insert at the earliest possible point
      if (document.head) {
        document.head.appendChild(earlyCssStyleElement);
      } else if (document.documentElement) {
        document.documentElement.appendChild(earlyCssStyleElement);
      } else {
        // Wait for documentElement to be available
        const checkInterval = setInterval(() => {
          if (document.documentElement) {
            clearInterval(checkInterval);
            document.documentElement.appendChild(earlyCssStyleElement);
          }
        }, 10);
        // Safety timeout to avoid infinite loop
        setTimeout(() => clearInterval(checkInterval), 5000);
      }
    }
  } catch (e) {
    // Silently fail if storage access fails during early loading
    console.debug('SpyWeb: Early CSS hiding failed', e);
  }
}

// Remove early CSS hiding rules (called after proper masks are applied)
function removeEarlyCssHiding() {
  if (earlyCssStyleElement) {
    earlyCssStyleElement.remove();
    earlyCssStyleElement = null;
  }
}

async function init() {
  // Load settings
  const data = await chrome.storage.sync.get(['maskSettings']);
  if (data.maskSettings) {
    settings = data.maskSettings;
    
    // If using local image, load it from local storage
    if (settings.useLocalImage) {
      const localData = await chrome.storage.local.get(['maskImageLocal']);
      if (localData.maskImageLocal) {
        settings.maskImage = localData.maskImageLocal;
      }
    }
  }
  
  // Load and apply masked elements
  await loadMaskedElements();
  applyMasks();
  
  // Remove early CSS hiding now that proper masks are applied
  removeEarlyCssHiding();
  
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
  
  // For VIDEO elements, always return the video itself as it's maskable
  if (element.tagName === 'VIDEO') {
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
  
  // Check if element is a video (video previews)
  const isVideo = element.tagName === 'VIDEO';
  
  const maskedElement = {
    selector,
    domain,
    settings: { ...settings },
    timestamp: Date.now(),
    isInput: element.tagName === 'INPUT' || element.tagName === 'TEXTAREA',
    isSvgOrIcon,
    isImage,
    isVideo,
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
  const existingIndex = allMasked[domain].findIndex(m => m.selector === selector);
  if (existingIndex === -1) {
    allMasked[domain].push(maskedElement);
    await chrome.storage.local.set({ maskedElements: allMasked });
    
    // Push to undo stack for undo/redo functionality
    undoStack.push({ action: 'add', element: maskedElement, domain });
    redoStack = []; // Clear redo stack on new action
    
    // Apply mask immediately
    maskedElements = allMasked[domain] || [];
    applyMaskToElement(element, maskedElement);
    
    // Show notification
    showNotification('Element masked successfully');
  } else {
    // Update existing mask with new settings (mask on mask)
    const previousMask = allMasked[domain][existingIndex];
    allMasked[domain][existingIndex] = maskedElement;
    await chrome.storage.local.set({ maskedElements: allMasked });
    
    // Push to undo stack for undo/redo functionality (store previous mask for undo)
    undoStack.push({ action: 'update', element: maskedElement, previousElement: previousMask, domain });
    redoStack = []; // Clear redo stack on new action
    
    // Update mask on element - need to refresh to apply new settings
    maskedElements = allMasked[domain] || [];
    
    // Remove existing mask first, then apply new one
    const existingMask = element.querySelector('.spyweb-mask');
    if (existingMask) {
      existingMask.remove();
    }
    
    // For image/video elements, also remove mask from wrapper
    if (element.tagName === 'IMG' || element.tagName === 'VIDEO') {
      const wrapperClass = element.tagName === 'VIDEO' ? 'spyweb-video-wrapper' : 'spyweb-img-wrapper';
      const wrapper = element.closest('.' + wrapperClass);
      if (wrapper) {
        const wrapperMask = wrapper.querySelector('.spyweb-mask');
        if (wrapperMask) {
          wrapperMask.remove();
        }
      }
    }
    
    applyMaskToElement(element, maskedElement);
    
    // Show notification
    showNotification('Mask updated successfully');
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
  // For image and video elements, we need special handling since we can't append children to <img>/<video>
  const isImageElement = element.tagName === 'IMG';
  const isVideoElement = element.tagName === 'VIDEO';
  
  if (isImageElement || isVideoElement) {
    const wrapperClass = isVideoElement ? 'spyweb-video-wrapper' : 'spyweb-img-wrapper';
    // Check if a SpyWeb wrapper already exists for this element
    let wrapper = element.closest('.' + wrapperClass);
    if (!wrapper) {
      // Create a wrapper for the element
      wrapper = document.createElement('span');
      wrapper.className = wrapperClass;
      wrapper.style.display = 'inline-block';
      wrapper.style.position = 'relative';
      
      // Preserve element positioning
      const computedStyle = window.getComputedStyle(element);
      if (computedStyle.display === 'block') {
        wrapper.style.display = 'block';
      }
      
      // Insert wrapper before the element and move element into it
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
    
    // Hide the original image/video so only the mask is visible
    element.style.visibility = 'hidden';
    
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
    } else {
      // Hide the original text content so only the mask is visible
      // We do this by making the element's children invisible
      hideOriginalContent(element);
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

// Hide the original content of an element so the mask fully replaces it
function hideOriginalContent(element) {
  // Store original visibility state for potential restoration
  element.setAttribute('data-spyweb-original-visibility', 'true');
  
  // Hide all child nodes except the mask
  Array.from(element.childNodes).forEach(child => {
    if (child.nodeType === Node.TEXT_NODE) {
      // For text nodes, wrap in a span and hide
      // Whitespace-only nodes are skipped as they're not visually significant
      if (child.textContent.trim()) {
        const span = document.createElement('span');
        span.className = 'spyweb-hidden-content';
        span.style.visibility = 'hidden';
        span.textContent = child.textContent;
        child.replaceWith(span);
      }
    } else if (child.nodeType === Node.ELEMENT_NODE && !child.classList.contains('spyweb-mask')) {
      // For element nodes that are not the mask, hide them
      child.classList.add('spyweb-hidden-content');
      child.style.visibility = 'hidden';
    }
  });
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

// Get the first non-transparent background color from an element or its ancestors
// maxDepth limits traversal to prevent performance issues with deeply nested DOMs
function getInheritedBackgroundColor(element, fallback = 'white', maxDepth = 10) {
  let current = element;
  let depth = 0;
  
  while (current && depth < maxDepth) {
    const style = window.getComputedStyle(current);
    const bgColor = style.backgroundColor;
    if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
      return bgColor;
    }
    current = current.parentElement;
    depth++;
  }
  
  return fallback;
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
    
    // Apply custom text styling if provided
    if (maskSettings.textMaskSize) {
      mask.style.fontSize = maskSettings.textMaskSize + 'px';
    } else {
      mask.style.fontSize = '14px';
    }
    
    if (maskSettings.textMaskColor) {
      mask.style.color = maskSettings.textMaskColor;
    }
    
    if (maskSettings.textMaskFont) {
      mask.style.fontFamily = maskSettings.textMaskFont;
    }
    
    // Set an opaque background to fully hide original content
    // Use inherited background color from the element's context
    mask.style.backgroundColor = getInheritedBackgroundColor(element, 'white');
  } else if (maskType === 'inherit') {
    // Use inherited styles with original background preserved
    // The mask must completely hide the original content
    mask.textContent = maskSettings.maskText || '████████';
    mask.style.display = 'flex';
    mask.style.alignItems = 'center';
    mask.style.justifyContent = 'center';
    
    // Apply original styles if captured, otherwise get from computed style
    const styles = maskedElement.originalStyles || {};
    
    // Preserve background from the original element - must be opaque to hide content
    const bgColor = styles.backgroundColor || computedStyle.backgroundColor;
    const bgFull = styles.background || computedStyle.background;
    
    // If the element has a non-transparent background, use it
    if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
      mask.style.backgroundColor = bgColor;
    } else if (bgFull && bgFull !== 'none') {
      mask.style.background = bgFull;
    } else {
      // Fallback: use a solid background color to ensure content is hidden
      mask.style.backgroundColor = getInheritedBackgroundColor(element.parentElement, 'white');
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
    // For solid color mask, use element's background color as default instead of black
    let defaultColor = computedStyle.backgroundColor;
    // If transparent or no background, get inherited background color
    if (!defaultColor || defaultColor === 'rgba(0, 0, 0, 0)' || defaultColor === 'transparent') {
      defaultColor = getInheritedBackgroundColor(element.parentElement, '#808080');
    }
    mask.style.backgroundColor = maskSettings.maskColor || defaultColor;
  } else if (maskType === 'blur') {
    // backdrop-filter can be performance-intensive, use with care
    mask.style.backdropFilter = 'blur(10px)';
    mask.style.webkitBackdropFilter = 'blur(10px)'; // Safari support
    mask.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
  } else if (maskType === 'image') {
    if (maskSettings.maskImage) {
      // Use a container for proper tiling/overflow handling
      const imgContainer = document.createElement('div');
      imgContainer.style.width = '100%';
      imgContainer.style.height = '100%';
      imgContainer.style.overflow = 'hidden';
      imgContainer.style.position = 'relative';
      
      // Create an img element to load and measure the image
      const imgEl = document.createElement('img');
      imgEl.src = maskSettings.maskImage;
      
      imgEl.onload = function() {
        // Verify container is still in the DOM before proceeding
        if (!imgContainer.isConnected) {
          return;
        }
        
        // Get element dimensions at load time for accurate calculations
        const elementRect = element.getBoundingClientRect();
        const elementWidth = elementRect.width;
        const elementHeight = elementRect.height;
        
        // Calculate scaled dimensions to match element width
        const imgNaturalWidth = imgEl.naturalWidth;
        const imgNaturalHeight = imgEl.naturalHeight;
        
        if (imgNaturalWidth > 0 && imgNaturalHeight > 0 && elementWidth > 0 && elementHeight > 0) {
          // Compress mask to match the smaller dimension of the area
          // e.g., if area is 100x400 and mask is 120x120, compress mask to 100x100
          const tileSize = Math.min(elementWidth, elementHeight);
          
          // Calculate how many tiles needed in each direction
          const tilesX = Math.ceil(elementWidth / tileSize);
          const tilesY = Math.ceil(elementHeight / tileSize);
          
          // Clear existing content before adding styled images
          imgContainer.innerHTML = '';
          
          // Create a grid container for proper tiling
          const gridContainer = document.createElement('div');
          gridContainer.style.display = 'flex';
          gridContainer.style.flexDirection = 'column';
          gridContainer.style.width = '100%';
          gridContainer.style.height = '100%';
          gridContainer.setAttribute('aria-hidden', 'true'); // Purely visual masking element
          
          // Create rows of tiles
          for (let row = 0; row < tilesY; row++) {
            const rowDiv = document.createElement('div');
            rowDiv.style.display = 'flex';
            rowDiv.style.flexShrink = '0';
            rowDiv.style.height = tileSize + 'px';
            
            for (let col = 0; col < tilesX; col++) {
              const tileImg = document.createElement('img');
              tileImg.src = maskSettings.maskImage;
              tileImg.style.width = tileSize + 'px';
              tileImg.style.height = tileSize + 'px';
              tileImg.style.flexShrink = '0';
              tileImg.style.objectFit = 'fill';
              rowDiv.appendChild(tileImg);
            }
            
            gridContainer.appendChild(rowDiv);
          }
          
          imgContainer.appendChild(gridContainer);
        }
      };
      
      imgEl.onerror = function() {
        // Fallback if image fails to load
        applyImageFallbackStyles(mask, '⚠️ Image unavailable');
        imgContainer.remove();
      };
      
      // Append initial image for loading (will be replaced in onload)
      imgContainer.appendChild(imgEl);
      mask.appendChild(imgContainer);
      // Set a background color for any gaps
      mask.style.backgroundColor = '#f0f0f0';
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
  document.addEventListener('keydown', onKeyDown, true);
  document.body.style.cursor = 'crosshair';
  
  showNotification('Inspection mode active - Click elements to mask (Ctrl+Z to undo)');
}

// Stop inspection mode
function stopInspection() {
  inspecting = false;
  
  document.removeEventListener('mousemove', onMouseMove, true);
  document.removeEventListener('click', onClick, true);
  document.removeEventListener('keydown', onKeyDown, true);
  document.body.style.cursor = '';
  
  removeHighlight();
  showNotification('Inspection mode stopped');
}

// Refresh masks
async function refreshMasks() {
  // Remove all existing masks
  document.querySelectorAll('.spyweb-mask').forEach(m => m.remove());
  
  // Restore hidden content
  document.querySelectorAll('.spyweb-hidden-content').forEach(el => {
    el.classList.remove('spyweb-hidden-content');
    el.style.visibility = '';
  });
  
  document.querySelectorAll('.spyweb-masked').forEach(el => {
    el.classList.remove('spyweb-masked');
    el.removeAttribute('data-spyweb-original-visibility');
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.style.color = '';
      el.style.caretColor = '';
    }
    if (el.tagName === 'IMG' || el.tagName === 'VIDEO') {
      el.style.visibility = '';
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
  
  // Unwrap videos from their wrappers
  document.querySelectorAll('.spyweb-video-wrapper').forEach(wrapper => {
    const video = wrapper.querySelector('video');
    if (video && wrapper.parentNode) {
      wrapper.parentNode.insertBefore(video, wrapper);
      wrapper.remove();
    }
  });
  
  // Reload and reapply
  await loadMaskedElements();
  applyMasks();
}

// Undo the last mask operation
async function undoMask() {
  if (undoStack.length === 0) {
    showNotification('Nothing to undo');
    return { success: false, canUndo: false, canRedo: redoStack.length > 0 };
  }
  
  const lastAction = undoStack.pop();
  const domain = lastAction.domain;
  
  // Load current masked elements
  const data = await chrome.storage.local.get(['maskedElements']);
  const allMasked = data.maskedElements || {};
  
  if (lastAction.action === 'add') {
    // Undo an add action: remove the element
    if (allMasked[domain]) {
      const index = allMasked[domain].findIndex(m => m.selector === lastAction.element.selector);
      if (index !== -1) {
        allMasked[domain].splice(index, 1);
        await chrome.storage.local.set({ maskedElements: allMasked });
        
        // Push to redo stack
        redoStack.push(lastAction);
        
        // Refresh the masks on page
        await refreshMasks();
        
        showNotification('Undo: Mask removed');
        return { success: true, canUndo: undoStack.length > 0, canRedo: true };
      }
    }
  } else if (lastAction.action === 'update') {
    // Undo an update action: restore the previous mask settings
    if (allMasked[domain]) {
      const index = allMasked[domain].findIndex(m => m.selector === lastAction.element.selector);
      if (index !== -1) {
        allMasked[domain][index] = lastAction.previousElement;
        await chrome.storage.local.set({ maskedElements: allMasked });
        
        // Push to redo stack
        redoStack.push(lastAction);
        
        // Refresh the masks on page
        await refreshMasks();
        
        showNotification('Undo: Mask reverted to previous style');
        return { success: true, canUndo: undoStack.length > 0, canRedo: true };
      }
    }
  }
  
  return { success: false, canUndo: undoStack.length > 0, canRedo: redoStack.length > 0 };
}

// Redo the last undone operation
async function redoMask() {
  if (redoStack.length === 0) {
    showNotification('Nothing to redo');
    return { success: false, canUndo: undoStack.length > 0, canRedo: false };
  }
  
  const lastUndone = redoStack.pop();
  const domain = lastUndone.domain;
  
  // Load current masked elements
  const data = await chrome.storage.local.get(['maskedElements']);
  const allMasked = data.maskedElements || {};
  
  if (lastUndone.action === 'add') {
    // Redo an add action: re-add the element
    if (!allMasked[domain]) {
      allMasked[domain] = [];
    }
    
    // Check if already exists (shouldn't happen, but just in case)
    const exists = allMasked[domain].some(m => m.selector === lastUndone.element.selector);
    if (!exists) {
      allMasked[domain].push(lastUndone.element);
      await chrome.storage.local.set({ maskedElements: allMasked });
      
      // Push back to undo stack
      undoStack.push(lastUndone);
      
      // Refresh the masks on page
      await refreshMasks();
      
      showNotification('Redo: Mask restored');
      return { success: true, canUndo: true, canRedo: redoStack.length > 0 };
    }
  } else if (lastUndone.action === 'update') {
    // Redo an update action: re-apply the updated mask settings
    if (allMasked[domain]) {
      const index = allMasked[domain].findIndex(m => m.selector === lastUndone.element.selector);
      if (index !== -1) {
        allMasked[domain][index] = lastUndone.element;
        await chrome.storage.local.set({ maskedElements: allMasked });
        
        // Push back to undo stack
        undoStack.push(lastUndone);
        
        // Refresh the masks on page
        await refreshMasks();
        
        showNotification('Redo: Mask updated again');
        return { success: true, canUndo: true, canRedo: redoStack.length > 0 };
      }
    }
  }
  
  return { success: false, canUndo: undoStack.length > 0, canRedo: redoStack.length > 0 };
}

// Get current undo/redo state
function getUndoRedoState() {
  return {
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0
  };
}

// Keyboard handler for undo/redo shortcuts during inspection
function onKeyDown(e) {
  if (!inspecting) return;
  
  // Ctrl+Z or Cmd+Z for undo
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
    e.preventDefault();
    e.stopPropagation();
    undoMask();
    return;
  }
  
  // Ctrl+Y or Cmd+Y or Ctrl+Shift+Z or Cmd+Shift+Z for redo
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
    e.preventDefault();
    e.stopPropagation();
    redoMask();
    return;
  }
}

// Listen for messages from popup and background
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
  } else if (request.action === 'updateSettings') {
    // Update settings immediately when changed from popup
    // Always update settings regardless of inspection state to ensure latest settings are used
    if (request.settings) {
      settings = request.settings;
    }
    sendResponse({ success: true });
  } else if (request.action === 'settingsUpdated') {
    // Handle settings updated from background.js storage sync
    // Sent by background.js when storage changes (syncs settings across tabs)
    if (request.settings) {
      settings = request.settings;
      // If using local image, load it from local storage asynchronously
      if (settings.useLocalImage) {
        chrome.storage.local.get(['maskImageLocal']).then(localData => {
          if (localData.maskImageLocal) {
            settings.maskImage = localData.maskImageLocal;
          }
          sendResponse({ success: true });
        });
        return true; // Keep channel open for async response
      }
    }
    sendResponse({ success: true });
  } else if (request.action === 'undo') {
    // Handle undo request from popup
    undoMask().then(result => sendResponse(result));
    return true; // Keep channel open for async response
  } else if (request.action === 'redo') {
    // Handle redo request from popup
    redoMask().then(result => sendResponse(result));
    return true; // Keep channel open for async response
  } else if (request.action === 'getUndoRedoState') {
    // Get current undo/redo availability state
    sendResponse(getUndoRedoState());
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
