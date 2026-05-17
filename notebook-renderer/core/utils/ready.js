/**
 * Ready Signal Utilities
 * Provides deterministic "render done" signaling for headless rendering.
 * 
 * @module core/utils/ready
 */

/**
 * Waits for all specified fonts to be loaded.
 * Uses the Font Loading API.
 * 
 * @param {string[]} fontFamilies - Array of font family names to wait for
 * @param {number} timeout - Timeout in ms (default: 10000)
 * @returns {Promise<void>} Resolves when all fonts are ready
 */
export async function awaitFonts(fontFamilies = [], timeout = 10000) {
  if (!document.fonts || !document.fonts.ready) {
    console.log('[ready] Font Loading API not available, skipping font wait');
    return Promise.resolve();
  }
  
  const startTime = Date.now();
  
  // Wait for document.fonts.ready first
  try {
    await Promise.race([
      document.fonts.ready,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Font loading timeout')), timeout)
      )
    ]);
  } catch (e) {
    console.warn('[ready] Font loading error:', e);
  }
  
  // Check individual fonts if specified
  if (fontFamilies.length > 0) {
    const checks = fontFamilies.map(family => {
      return new Promise((resolve) => {
        const fontString = `16px "${family}"`;
        if (document.fonts.check(fontString)) {
          resolve();
        } else {
          const checkInterval = setInterval(() => {
            if (document.fonts.check(fontString)) {
              clearInterval(checkInterval);
              resolve();
            } else if (Date.now() - startTime > timeout) {
              clearInterval(checkInterval);
              console.warn(`[ready] Font timeout: ${family}`);
              resolve(); // Resolve anyway to avoid blocking forever
            }
          }, 50);
        }
      });
    });
    
    await Promise.all(checks);
  }
  
  console.log('[ready] All fonts loaded');
}

/**
 * Waits for all images in a container to load.
 * 
 * @param {HTMLElement} container - Container element
 * @param {number} timeout - Timeout in ms (default: 5000)
 * @returns {Promise<void>} Resolves when all images are loaded
 */
export async function awaitImages(container, timeout = 5000) {
  const images = container.querySelectorAll('img');
  if (images.length === 0) return;
  
  const promises = Array.from(images).map(img => {
    if (img.complete) return Promise.resolve();
    
    return new Promise((resolve, reject) => {
      const onLoad = () => {
        img.removeEventListener('load', onLoad);
        img.removeEventListener('error', onError);
        resolve();
      };
      
      const onError = (e) => {
        img.removeEventListener('load', onLoad);
        img.removeEventListener('error', onError);
        console.warn('[ready] Image failed to load:', img.src);
        resolve(); // Resolve anyway to avoid blocking
      };
      
      img.addEventListener('load', onLoad);
      img.addEventListener('error', onError);
      
      // Timeout for this image
      setTimeout(() => {
        img.removeEventListener('load', onLoad);
        img.removeEventListener('error', onError);
        console.warn('[ready] Image timeout:', img.src);
        resolve();
      }, timeout);
    });
  });
  
  await Promise.all(promises);
  console.log(`[ready] All ${images.length} images loaded`);
}

/**
 * Waits for all external stylesheets to load.
 * 
 * @param {number} timeout - Timeout in ms (default: 5000)
 * @returns {Promise<void>} Resolves when all stylesheets are loaded
 */
export async function awaitStylesheets(timeout = 5000) {
  const links = document.querySelectorAll('link[rel="stylesheet"]');
  if (links.length === 0) return;
  
  const promises = Array.from(links).map(link => {
    if (link.sheet) return Promise.resolve();
    
    return new Promise((resolve) => {
      const onLoad = () => {
        link.removeEventListener('load', onLoad);
        link.removeEventListener('error', onError);
        resolve();
      };
      
      const onError = () => {
        link.removeEventListener('load', onLoad);
        link.removeEventListener('error', onError);
        console.warn('[ready] Stylesheet failed to load:', link.href);
        resolve();
      };
      
      link.addEventListener('load', onLoad);
      link.addEventListener('error', onError);
      
      setTimeout(() => {
        link.removeEventListener('load', onLoad);
        link.removeEventListener('error', onError);
        resolve();
      }, timeout);
    });
  });
  
  await Promise.all(promises);
  console.log(`[ready] All ${links.length} stylesheets loaded`);
}

/**
 * Signals that rendering is complete.
 * Sets window.__renderReady flag and dispatches custom event.
 */
export function signalReady() {
  window.__renderReady = true;
  
  const event = new CustomEvent('notebook:ready', {
    detail: { timestamp: Date.now() }
  });
  
  window.dispatchEvent(event);
  console.log('[ready] Render complete signal sent');
}

/**
 * Checks if rendering is ready.
 * 
 * @returns {boolean} True if ready
 */
export function isReady() {
  return window.__renderReady === true;
}

/**
 * Waits for the render ready signal.
 * 
 * @param {number} timeout - Timeout in ms (default: 30000)
 * @returns {Promise<boolean>} Resolves to true when ready, false on timeout
 */
export function waitForReady(timeout = 30000) {
  return new Promise((resolve) => {
    if (window.__renderReady === true) {
      resolve(true);
      return;
    }
    
    const onReady = () => {
      cleanup();
      resolve(true);
    };
    
    const cleanup = () => {
      window.removeEventListener('notebook:ready', onReady);
      clearTimeout(timer);
    };
    
    const timer = setTimeout(() => {
      cleanup();
      console.warn('[ready] WaitForReady timeout');
      resolve(false);
    }, timeout);
    
    window.addEventListener('notebook:ready', onReady, { once: true });
  });
}

/**
 * Resets the ready state.
 * Call this before starting a new render.
 */
export function resetReady() {
  window.__renderReady = false;
  console.log('[ready] Ready state reset');
}
