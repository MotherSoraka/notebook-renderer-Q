/**
 * Pagination Engine - Split rendered content into pages
 * 
 * Handles page breaks for different formats (A4, phone screens, custom sizes)
 * with intelligent content flow and overflow handling.
 * 
 * @module PaginationEngine
 */

/**
 * Standard page format presets
 */
export const PAGE_FORMATS = {
  A4: {
    width: 210,      // mm
    height: 297,     // mm
    name: 'A4',
    aspectRatio: 0.707,
  },
  Letter: {
    width: 215.9,
    height: 279.4,
    name: 'Letter',
    aspectRatio: 0.773,
  },
  phone: {
    width: 375,      // pixels (typical modern smartphone)
    height: 812,
    name: 'Phone',
    aspectRatio: 0.462,
    unit: 'px',
  },
  phoneSmall: {
    width: 320,
    height: 568,
    name: 'Phone Small',
    aspectRatio: 0.563,
    unit: 'px',
  },
  phoneLarge: {
    width: 414,
    height: 896,
    name: 'Phone Large',
    aspectRatio: 0.462,
    unit: 'px',
  },
  square: {
    width: 1080,
    height: 1080,
    name: 'Square',
    aspectRatio: 1.0,
    unit: 'px',
  },
};

/**
 * Default pagination configuration
 */
export const DEFAULT_PAGINATION_CONFIG = {
  format: 'A4',
  margin: 20,        // mm (or px for pixel-based formats)
  gutter: 10,        // Space between pages when displayed
  scale: 1,          // Output scale factor
  dpi: 96,           // Dots per inch for conversion
  
  // Content flow
  avoidOrphans: true,      // Prevent single lines at top of page
  avoidWidows: true,       // Prevent single lines at bottom of page
  breakInsideAvoid: true,  // Try not to break inside elements
  
  // Debugging
  debug: false,
};

/**
 * Pagination Engine class
 */
export class PaginationEngine {
  constructor(config = {}) {
    this.config = { ...DEFAULT_PAGINATION_CONFIG, ...config };
    this.pages = [];
    this.currentPage = null;
    this.contentHeight = 0;
  }
  
  /**
   * Configure pagination engine
   * @param {Object} newConfig - Configuration overrides
   */
  configure(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }
  
  /**
   * Get page dimensions in pixels
   * @returns {Object} { width, height, margin }
   */
  getPageDimensions() {
    const format = PAGE_FORMATS[this.config.format] || PAGE_FORMATS.A4;
    const isPixels = format.unit === 'px' || this.config.format === 'phone';
    
    let width, height, margin;
    
    if (isPixels) {
      width = format.width * this.config.scale;
      height = format.height * this.config.scale;
      margin = this.config.margin * this.config.scale;
    } else {
      // Convert mm to pixels
      const mmToPx = mm => mm * (this.config.dpi / 25.4);
      width = mmToPx(format.width) * this.config.scale;
      height = mmToPx(format.height) * this.config.scale;
      margin = mmToPx(this.config.margin) * this.config.scale;
    }
    
    return { width, height, margin, format };
  }
  
  /**
   * Paginate content element into pages
   * @param {HTMLElement} contentElement - Element containing content to paginate
   * @returns {Array<HTMLElement>} Array of page elements
   */
  paginate(contentElement) {
    console.log('[Pagination] Starting pagination...', this.config);
    
    const { width, height, margin, format } = this.getPageDimensions();
    const availableHeight = height - margin * 2;
    
    // Get all direct children
    const children = Array.from(contentElement.children);
    if (children.length === 0) {
      console.warn('[Pagination] No content to paginate');
      return [];
    }
    
    // Clear existing pages
    this.pages = [];
    
    // Create first page
    this.currentPage = this._createPage(width, height, margin);
    this.pages.push(this.currentPage);
    
    let currentPageContent = this.currentPage.querySelector('.page-content');
    let usedHeight = 0;
    
    children.forEach((child, index) => {
      const childHeight = child.getBoundingClientRect().height;
      const childMarginTop = parseFloat(getComputedStyle(child).marginTop) || 0;
      const childMarginBottom = parseFloat(getComputedStyle(child).marginBottom) || 0;
      const totalChildHeight = childHeight + childMarginTop + childMarginBottom;
      
      // Check if we need to start a new page
      if (usedHeight + totalChildHeight > availableHeight) {
        // Try to fit on current page with adjustments
        if (this.config.breakInsideAvoid && usedHeight > 0) {
          // Start new page
          this._startNewPage(width, height, margin);
          currentPageContent = this.currentPage.querySelector('.page-content');
          usedHeight = 0;
        }
      }
      
      // Clone the child to place on page
      const childClone = child.cloneNode(true);
      
      // Preserve styles
      childClone.style.marginTop = `${childMarginTop}px`;
      childClone.style.marginBottom = `${childMarginBottom}px`;
      
      currentPageContent.appendChild(childClone);
      usedHeight += totalChildHeight;
      
      if (this.config.debug) {
        console.log(`[Pagination] Placed ${child.tagName} (${totalChildHeight.toFixed(1)}px), used: ${usedHeight.toFixed(1)}/${availableHeight.toFixed(1)}`);
      }
    });
    
    console.log(`[Pagination] Created ${this.pages.length} page(s)`);
    return this.pages;
  }
  
  /**
   * Paginate from HTML string
   * @param {string} html - HTML content to paginate
   * @param {HTMLElement} container - Container to append pages to
   * @returns {Array<HTMLElement>} Array of page elements
   */
  paginateHTML(html, container) {
    // Create temporary container
    const temp = document.createElement('div');
    temp.innerHTML = html;
    
    // Paginate the content
    const pages = this.paginate(temp);
    
    // Append pages to actual container
    container.innerHTML = '';
    pages.forEach(page => container.appendChild(page));
    
    return pages;
  }
  
  /**
   * Start a new page
   */
  _startNewPage(width, height, margin) {
    this.currentPage = this._createPage(width, height, margin);
    this.pages.push(this.currentPage);
  }
  
  /**
   * Create a page element
   */
  _createPage(width, height, margin) {
    const page = document.createElement('div');
    page.className = 'paper-page';
    page.style.width = `${width}px`;
    page.style.height = `${height}px`;
    page.style.padding = `${margin}px`;
    page.style.position = 'relative';
    page.style.overflow = 'hidden';
    
    const content = document.createElement('div');
    content.className = 'page-content';
    content.style.width = '100%';
    content.style.height = '100%';
    page.appendChild(content);
    
    return page;
  }
  
  /**
   * Get total page count
   * @returns {number} Number of pages
   */
  getPageCount() {
    return this.pages.length;
  }
  
  /**
   * Get specific page
   * @param {number} index - Page index (0-based)
   * @returns {HTMLElement|null} Page element or null
   */
  getPage(index) {
    return this.pages[index] || null;
  }
  
  /**
   * Export pages as images (requires html2canvas)
   * @param {string} format - Image format ('png', 'jpeg')
   * @param {number} quality - Image quality (0-1)
   * @returns {Promise<Array<string>>} Array of data URLs
   */
  async exportPages(format = 'png', quality = 0.95) {
    if (typeof html2canvas === 'undefined') {
      throw new Error('[Pagination] html2canvas not loaded');
    }
    
    const dataUrls = [];
    
    for (const page of this.pages) {
      const canvas = await html2canvas(page, {
        backgroundColor: getComputedStyle(page).backgroundColor,
        scale: this.config.scale,
        useCORS: true,
      });
      
      const dataUrl = canvas.toDataURL(`image/${format}`, quality);
      dataUrls.push(dataUrl);
    }
    
    return dataUrls;
  }
  
  /**
   * Render pages to canvas
   * @param {HTMLCanvasElement} canvas - Canvas to render to
   * @param {number} pageIndex - Page index to render
   */
  renderToCanvas(canvas, pageIndex) {
    const page = this.pages[pageIndex];
    if (!page) {
      throw new Error(`[Pagination] Page ${pageIndex} not found`);
    }
    
    const ctx = canvas.getContext('2d');
    const { width, height } = this.getPageDimensions();
    
    canvas.width = width;
    canvas.height = height;
    
    // This would require more complex rendering logic
    // Placeholder for future implementation
    console.warn('[Pagination] renderToCanvas not fully implemented');
  }
  
  /**
   * Clear all pages
   */
  clear() {
    this.pages.forEach(page => page.remove());
    this.pages = [];
    this.currentPage = null;
  }
  
  /**
   * Destroy pagination engine
   */
  destroy() {
    this.clear();
    console.log('[Pagination] Destroyed');
  }
}

/**
 * Calculate optimal font size for content to fit on page
 * @param {HTMLElement} content - Content element
 * @param {Object} pageDimensions - Page dimensions
 * @returns {number} Optimal font size
 */
export function calculateOptimalFontSize(content, pageDimensions) {
  const { height, margin } = pageDimensions;
  const availableHeight = height - margin * 2;
  
  let fontSize = 26; // Start with default
  const minFontSize = 12;
  const maxFontSize = 40;
  
  while (fontSize >= minFontSize) {
    content.style.fontSize = `${fontSize}px`;
    const contentHeight = content.getBoundingClientRect().height;
    
    if (contentHeight <= availableHeight) {
      return fontSize;
    }
    
    fontSize -= 1;
  }
  
  return minFontSize;
}

/**
 * Split text into pages based on character count
 * @param {string} text - Text to split
 * @param {number} charsPerPage - Approximate characters per page
 * @returns {Array<string>} Array of text chunks
 */
export function splitTextByChars(text, charsPerPage = 1000) {
  const chunks = [];
  let currentChunk = '';
  
  const words = text.split(' ');
  
  words.forEach(word => {
    if ((currentChunk + word).length > charsPerPage) {
      chunks.push(currentChunk.trim());
      currentChunk = word + ' ';
    } else {
      currentChunk += word + ' ';
    }
  });
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

// Export singleton instance
export const paginationEngine = new PaginationEngine();

export default PaginationEngine;
