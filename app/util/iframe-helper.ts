/**
 * Iframe Helper Utilities for Commerce7 Embedded Apps
 * 
 * Commerce7 uses an older version of iframe-resizer that doesn't always
 * properly handle dynamic content height changes. These utilities help
 * manually trigger height updates when needed.
 */

/**
 * Notify the parent iframe to resize based on current content height
 * This works with iframe-resizer.contentWindow.js
 */
export function notifyParentOfHeightChange() {
  if (typeof window === 'undefined') return;
  
  try {
    // Method 1: Use iframe-resizer's native API (if available)
    if ((window as any).parentIFrame) {
      // Tell iframe-resizer to recalculate the size
      (window as any).parentIFrame.size();
      return;
    }
    
    // Method 2: Fallback to postMessage (if script hasn't loaded yet)
    if (window.parent && window.parent !== window) {
      const height = Math.max(
        document.body.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.clientHeight,
        document.documentElement.scrollHeight,
        document.documentElement.offsetHeight
      );
      
      window.parent.postMessage({
        type: 'resize',
        height: height
      }, '*');
    }
    
  } catch (error) {
    console.warn('Failed to notify parent of height change:', error);
  }
}

/**
 * Setup automatic height notifications on content changes
 * Call this once when your app loads
 * 
 * Note: With iframeResizer.contentWindow.js loaded, this is mostly redundant
 * as the script handles automatic resizing. But we keep this for extra
 * reliability and to handle edge cases.
 */
export function setupAutoResize() {
  if (typeof window === 'undefined') return;
  
  // Wait for iframe-resizer script to initialize
  const checkIframeResizer = () => {
    if ((window as any).parentIFrame) {
      console.log('✅ iframe-resizer connected');
      // Trigger initial size calculation
      notifyParentOfHeightChange();
    } else {
      console.warn('⚠️ iframe-resizer not available yet, retrying...');
      setTimeout(checkIframeResizer, 100);
    }
  };
  
  // Check after a short delay to let the script load
  setTimeout(checkIframeResizer, 100);
  
  // Notify after images load
  window.addEventListener('load', () => {
    notifyParentOfHeightChange();
  });
  
  // Create a ResizeObserver to watch for content changes
  // This helps trigger updates when iframe-resizer misses changes
  if ('ResizeObserver' in window) {
    const resizeObserver = new ResizeObserver(() => {
      notifyParentOfHeightChange();
    });
    
    // Observe the body element
    resizeObserver.observe(document.body);
  }
}

/**
 * Force scroll to top of the iframe
 * Useful after navigation or form submissions
 */
export function scrollToTop() {
  if (typeof window === 'undefined') return;
  
  try {
    // Method 1: Use iframe-resizer API if available
    if ((window as any).parentIFrame && (window as any).parentIFrame.scrollTo) {
      (window as any).parentIFrame.scrollTo(0, 0);
      return;
    }
    
    // Method 2: Scroll the embedded iframe content
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Also try to notify parent
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: 'scrollToTop'
      }, '*');
    }
  } catch (error) {
    console.warn('Failed to scroll to top:', error);
  }
}

/**
 * Check if we're running in an embedded iframe
 */
export function isEmbedded(): boolean {
  if (typeof window === 'undefined') return false;
  
  try {
    return window.self !== window.top;
  } catch (e) {
    // If we can't access window.top, we're likely in a cross-origin iframe
    return true;
  }
}

