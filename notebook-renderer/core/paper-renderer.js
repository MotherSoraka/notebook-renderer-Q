/**
 * Paper Renderer - Notebook-style Markdown/Math/Mermaid renderer
 * 
 * Renders content onto realistic notebook paper with grid snapping,
 * semantic multi-color inks, and hand-drawn aesthetics.
 * 
 * @module PaperRenderer
 */

import { loadPreset, validatePreset, mergePresets } from './preset-loader.js';
import { MermaidSketchEngine, buildMermaidTheme } from './mermaid-sketch.js';

/**
 * Default paper renderer configuration
 */
export const DEFAULT_PAPER_CONFIG = {
  // Grid & Layout
  gridSize: 32,          // Line height in px
  fontSize: 26,          // Base font size in px
  verticalOffset: 6,     // First line offset from top
  
  // Paper appearance
  paperBg: '#fdf6e3',    // Warm paper color
  lineColor: '#b5d8f6',  // Light blue lines
  marginColor: '#ff8c8c', // Red margin line
  deskColor: '#1a1a1a',  // Background behind paper
  
  // Ink colors (semantic)
  inkBlue: '#000080',    // Default text
  inkRed: '#b30000',     // Strong/emphasis
  inkGreen: '#006600',   // Emphasis/italic
  inkBlack: '#222222',   // Code/headings
  
  // Typography
  fontFamily: "'Caveat', 'Amiri', cursive",
  codeFont: "'Fira Code', monospace",
  
  // Layout
  paddingLeft: 100,      // Left padding (after margin line)
  paddingRight: 40,      // Right padding
  paddingBottom: 100,    // Bottom padding
  
  // Features
  enableGridSnap: true,  // Snap elements to grid
  enableRTL: true,       // Auto-detect RTL languages
  enablePagination: false, // Split into pages
  
  // Pagination settings
  paginationFormat: 'A4', // 'A4' | 'phone' | custom
  pageWidth: 210,        // mm (A4 width)
  pageHeight: 297,       // mm (A4 height)
  pageMargin: 20,        // mm
  
  // Mermaid integration
  enableMermaid: true,
  mermaidConfig: null,   // Will use sketch engine defaults
  
  // Math (KaTeX)
  enableMath: true,
};

/**
 * Paper Renderer class
 */
export class PaperRenderer {
  constructor(container, config = {}) {
    this.container = typeof container === 'string' 
      ? document.querySelector(container) 
      : container;
    
    if (!this.container) {
      throw new Error('[PaperRenderer] Container element not found');
    }
    
    this.config = { ...DEFAULT_PAPER_CONFIG, ...config };
    this.sketchEngine = new MermaidSketchEngine(this.config.mermaidConfig || {});
    this.contentElement = null;
    this.observer = null;
    this.pages = [];
    
    console.log('[PaperRenderer] Initialized', this.config);
  }
  
  /**
   * Load and apply a preset configuration
   * @param {string|Object} preset - Preset name or preset object
   */
  async applyPreset(preset) {
    let presetObj;
    
    if (typeof preset === 'string') {
      presetObj = await loadPreset(preset);
    } else {
      presetObj = preset;
    }
    
    if (validatePreset(presetObj)) {
      // Merge preset into config
      const merged = mergePresets(this.config, presetObj);
      this.configure(merged);
      console.log('[PaperRenderer] Applied preset:', presetObj.name || 'custom');
    } else {
      console.warn('[PaperRenderer] Invalid preset, skipping');
    }
  }
  
  /**
   * Update renderer configuration
   * @param {Object} newConfig - Configuration overrides
   */
  configure(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    // Update sketch engine if mermaid config changed
    if (newConfig.mermaidConfig) {
      this.sketchEngine.configure(newConfig.mermaidConfig);
    }
    
    // Apply CSS variables
    this._applyCSSVariables();
  }
  
  /**
   * Render markdown content
   * @param {string} markdown - Markdown text to render
   * @returns {Promise<void>}
   */
  async renderMarkdown(markdown) {
    console.log('[PaperRenderer] Rendering markdown...');
    
    // Initialize marked if available
    if (typeof marked !== 'undefined') {
      marked.use({ gfm: true, breaks: true });
    } else {
      console.warn('[PaperRenderer] marked.js not loaded, raw HTML output');
    }
    
    // Parse markdown
    const html = typeof marked !== 'undefined' 
      ? marked.parse(markdown) 
      : `<p>${markdown}</p>`;
    
    return this.renderHTML(html);
  }
  
  /**
   * Render HTML content
   * @param {string} html - HTML to render
   * @returns {Promise<void>}
   */
  async renderHTML(html) {
    console.log('[PaperRenderer] Rendering HTML...');
    
    // Create/reuse content element
    if (!this.contentElement) {
      this.contentElement = document.createElement('div');
      this.contentElement.className = 'paper-content';
      this.container.appendChild(this.contentElement);
    }
    
    this.contentElement.innerHTML = html;
    
    // Post-process content
    await this._postProcess();
    
    // Apply grid snapping
    if (this.config.enableGridSnap) {
      this._enableGridSnapping();
    }
    
    // Handle pagination
    if (this.config.enablePagination) {
      this._applyPagination();
    }
    
    console.log('[PaperRenderer] Render complete');
  }
  
  /**
   * Render from URL (fetches markdown)
   * @param {string} url - URL to fetch markdown from
   * @returns {Promise<void>}
   */
  async renderFromURL(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
      const text = await res.text();
      return this.renderMarkdown(text);
    } catch (err) {
      console.error('[PaperRenderer] Fetch error:', err);
      this.container.innerHTML = `<p style="color: red;">Error: ${err.message}</p>`;
    }
  }
  
  /**
   * Post-process rendered content
   */
  async _postProcess() {
    // Auto-RTL detection
    if (this.config.enableRTL) {
      this._applyAutoRTL();
    }
    
    // Process Mermaid blocks
    if (this.config.enableMermaid && typeof mermaid !== 'undefined') {
      await this._processMermaidBlocks();
    }
    
    // Process Math blocks
    if (this.config.enableMath && typeof katex !== 'undefined') {
      this._processMathBlocks();
    }
    
    // Process code blocks
    this._processCodeBlocks();
  }
  
  /**
   * Apply auto-RTL direction to content
   */
  _applyAutoRTL() {
    const elements = this.contentElement.querySelectorAll(
      'p, h1, h2, h3, h4, h5, h6, li, blockquote, td, th'
    );
    elements.forEach(el => el.setAttribute('dir', 'auto'));
  }
  
  /**
   * Process Mermaid code blocks
   */
  async _processMermaidBlocks() {
    const mermaidBlocks = this.contentElement.querySelectorAll(
      'pre code.language-mermaid'
    );
    
    if (mermaidBlocks.length === 0) return;
    
    // Wrap each mermaid block
    mermaidBlocks.forEach(block => {
      const pre = block.parentElement;
      const wrapper = document.createElement('div');
      wrapper.className = 'mermaid-wrapper grid-snap';
      wrapper.innerHTML = `<div class="mermaid">${block.textContent}</div>`;
      pre.replaceWith(wrapper);
    });
    
    // Render mermaid diagrams
    try {
      await mermaid.run({ querySelector: '.mermaid' });
      
      // Apply sketch styling to rendered SVGs
      const svgs = this.contentElement.querySelectorAll('.mermaid svg');
      svgs.forEach(svg => {
        this.sketchEngine.process(svg);
      });
    } catch (err) {
      console.error('[PaperRenderer] Mermaid render error:', err);
    }
  }
  
  /**
   * Process KaTeX math blocks
   */
  _processMathBlocks() {
    const mathBlocks = this.contentElement.querySelectorAll(
      'pre code.language-math'
    );
    
    mathBlocks.forEach(block => {
      const pre = block.parentElement;
      const wrapper = document.createElement('div');
      wrapper.className = 'math-block grid-snap';
      wrapper.textContent = block.textContent;
      pre.replaceWith(wrapper);
      
      try {
        katex.render(block.textContent, wrapper, {
          displayMode: true,
          throwOnError: false,
        });
      } catch (err) {
        console.error('[PaperRenderer] KaTeX render error:', err);
      }
    });
  }
  
  /**
   * Process code blocks
   */
  _processCodeBlocks() {
    const codeBlocks = this.contentElement.querySelectorAll('pre code');
    codeBlocks.forEach(code => {
      const pre = code.parentElement;
      if (!pre.classList.contains('language-mermaid') && 
          !pre.classList.contains('language-math')) {
        pre.classList.add('code-block');
      }
    });
  }
  
  /**
   * Enable grid snapping for elements
   */
  _enableGridSnapping() {
    const getGridSize = () => this.config.gridSize;
    
    const snapElement = (el, currentGrid) => {
      if (el.tagName === 'TR') {
        el.style.height = 'auto';
        const naturalHeight = el.getBoundingClientRect().height;
        const linesNeeded = Math.max(1, Math.ceil((naturalHeight - 4) / currentGrid));
        el.style.height = `${linesNeeded * currentGrid}px`;
      } else {
        el.style.marginBottom = '0px';
        const naturalHeight = el.getBoundingClientRect().height;
        if (naturalHeight === 0) return;
        
        const linesNeeded = Math.ceil(naturalHeight / currentGrid);
        const targetHeight = linesNeeded * currentGrid;
        const driftCorrection = targetHeight - naturalHeight;
        
        // Smart spacing: paragraphs get blank line, headings sit tight
        const tag = el.tagName.toLowerCase();
        const tightTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
        const extraMargin = tightTags.includes(tag) ? 0 : currentGrid;
        
        el.style.marginBottom = `${driftCorrection + extraMargin}px`;
      }
    };
    
    // Initial snap
    const currentGrid = getGridSize();
    const elementsToTrack = this.contentElement.querySelectorAll(
      '> *:not(style), tr'
    );
    elementsToTrack.forEach(el => snapElement(el, currentGrid));
    
    // Setup resize observer for dynamic updates
    if (this.observer) {
      this.observer.disconnect();
    }
    
    this.observer = new ResizeObserver(entries => {
      window.requestAnimationFrame(() => {
        const grid = getGridSize();
        for (let entry of entries) {
          snapElement(entry.target, grid);
        }
      });
    });
    
    elementsToTrack.forEach(el => this.observer.observe(el));
  }
  
  /**
   * Apply pagination to split content into pages
   */
  _applyPagination() {
    console.log('[PaperRenderer] Applying pagination...');
    
    // Convert mm to pixels (assuming 96 DPI)
    const mmToPx = mm => mm * 3.78;
    const pageWidthPx = mmToPx(this.config.pageWidth);
    const pageHeightPx = mmToPx(this.config.pageHeight);
    const marginPx = mmToPx(this.config.pageMargin);
    
    // Get all direct children
    const children = Array.from(this.contentElement.children);
    if (children.length === 0) return;
    
    // Clear existing pagination
    this.contentElement.innerHTML = '';
    this.pages = [];
    
    // Create pages
    let currentPage = this._createPage(pageWidthPx, pageHeightPx, marginPx);
    this.contentElement.appendChild(currentPage);
    this.pages.push(currentPage);
    
    let currentPageContent = currentPage.querySelector('.page-content');
    let usedHeight = 0;
    
    children.forEach(child => {
      const childHeight = child.getBoundingClientRect().height;
      
      // Check if element fits on current page
      if (usedHeight + childHeight > pageHeightPx - marginPx * 2) {
        // Start new page
        currentPage = this._createPage(pageWidthPx, pageHeightPx, marginPx);
        this.contentElement.appendChild(currentPage);
        this.pages.push(currentPage);
        currentPageContent = currentPage.querySelector('.page-content');
        usedHeight = 0;
      }
      
      currentPageContent.appendChild(child);
      usedHeight += childHeight;
    });
    
    console.log(`[PaperRenderer] Created ${this.pages.length} page(s)`);
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
    
    const content = document.createElement('div');
    content.className = 'page-content';
    page.appendChild(content);
    
    return page;
  }
  
  /**
   * Apply CSS variables to container
   */
  _applyCSSVariables() {
    const root = this.container;
    
    root.style.setProperty('--grid', `${this.config.gridSize}px`);
    root.style.setProperty('--font-size', `${this.config.fontSize}px`);
    root.style.setProperty('--offset', `${this.config.verticalOffset}px`);
    root.style.setProperty('--paper-bg', this.config.paperBg);
    root.style.setProperty('--line-color', this.config.lineColor);
    root.style.setProperty('--margin-color', this.config.marginColor);
    root.style.setProperty('--desk-color', this.config.deskColor);
    root.style.setProperty('--ink-blue', this.config.inkBlue);
    root.style.setProperty('--ink-red', this.config.inkRed);
    root.style.setProperty('--ink-green', this.config.inkGreen);
    root.style.setProperty('--ink-black', this.config.inkBlack);
  }
  
  /**
   * Export rendered content as image
   * @param {string} format - Image format ('png', 'jpeg', 'svg')
   * @param {number} scale - Scale factor for export
   * @returns {Promise<string>} Data URL of exported image
   */
  async exportImage(format = 'png', scale = 2) {
    console.log('[PaperRenderer] Exporting as', format);
    
    // This would require html2canvas or similar library
    // Placeholder for future implementation
    throw new Error('[PaperRenderer] exportImage not yet implemented');
  }
  
  /**
   * Destroy renderer and cleanup
   */
  destroy() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    
    if (this.contentElement) {
      this.contentElement.remove();
      this.contentElement = null;
    }
    
    console.log('[PaperRenderer] Destroyed');
  }
}

/**
 * Create inline styles for paper renderer
 */
export function getPaperRendererStyles() {
  return `
    .paper-renderer {
      background-color: var(--desk-color, #1a1a1a);
      padding: 40px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      font-family: sans-serif;
    }
    
    .paper-content {
      width: 100%;
      max-width: 900px;
      background-color: var(--paper-bg, #fdf6e3);
      position: relative;
      box-shadow: 0 20px 50px rgba(0,0,0,0.5);
      border-radius: 4px 12px 12px 4px;
      background-image: 
        url('data:image/svg+xml;utf8,%3Csvg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"%3E%3Cfilter id="noiseFilter"%3E%3CfeTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/%3E%3C/filter%3E%3Crect width="100%25" height="100%25" filter="url(%23noiseFilter)" opacity="0.06"/%3E%3C/svg%3E'),
        repeating-linear-gradient(
          to bottom,
          transparent,
          transparent calc(var(--grid) - 1px),
          var(--line-color) calc(var(--grid) - 1px),
          var(--line-color) var(--grid)
        );
      background-position: 0 0, 0 var(--offset);
    }
    
    .paper-content::before {
      content: '';
      position: absolute;
      top: 0; bottom: 0; left: 80px;
      width: 2px;
      background-color: var(--margin-color, #ff8c8c);
      z-index: 1;
    }
    
    .paper-content::after {
      content: '';
      position: absolute;
      top: 0; bottom: 0; left: 15px;
      width: 30px;
      background-image: radial-gradient(circle at 15px 15px, var(--desk-color, #1a1a1a) 10px, transparent 11px);
      background-size: 100% calc(var(--grid) * 3);
      background-position: 0 calc(var(--offset) + var(--grid));
      z-index: 2;
    }
    
    .paper-content > * {
      position: relative;
      z-index: 3;
      padding-left: 100px;
      padding-right: 40px;
      font-family: var(--font-family, 'Caveat', 'Amiri', cursive);
      font-size: var(--font-size, 26px);
      color: var(--ink-blue, #000080);
      line-height: var(--grid, 32px);
    }
    
    /* Semantic colors */
    .paper-content strong, .paper-content b {
      color: var(--ink-red, #b30000);
      font-weight: 600;
    }
    .paper-content em, .paper-content i {
      color: var(--ink-green, #006600);
      font-style: normal;
    }
    .paper-content code {
      color: var(--ink-black, #222222);
      font-family: var(--code-font, 'Fira Code', monospace);
      font-size: 0.8em;
    }
    
    /* Grid snap wrapper */
    .grid-snap {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      margin-bottom: 0;
    }
    
    /* Mermaid wrapper */
    .mermaid-wrapper {
      padding: 10px;
    }
    .mermaid-wrapper svg {
      width: 100% !important;
      max-width: 100%;
      height: auto !important;
    }
    
    /* Code blocks */
    .code-block {
      font-family: var(--code-font, 'Fira Code', monospace);
      font-size: calc(var(--font-size, 26px) * 0.6);
      background: rgba(0,0,0,0.03);
      padding: calc(var(--grid, 32px) - 2px) 20px 0 20px;
      width: 100%;
      border: 2px dashed var(--ink-blue, #000080);
      border-radius: 255px 15px 225px 15px/15px 225px 15px 255px;
      color: var(--ink-black, #222222);
      overflow-x: auto;
    }
    
    /* Tables */
    .paper-content table {
      border-collapse: separate;
      border-spacing: 0;
      width: 100%;
      margin: 0 auto;
      font-family: var(--font-family, 'Caveat', 'Amiri', cursive);
      font-size: calc(var(--font-size, 26px) * 0.9);
      color: var(--ink-black, #222222);
    }
    .paper-content th, .paper-content td {
      padding: 0 10px;
      text-align: left;
      line-height: calc(var(--grid, 32px) - 4px);
      vertical-align: bottom;
      border: 1.5px solid var(--ink-blue, #000080);
      border-radius: 255px 15px 225px 15px/15px 225px 15px 255px;
    }
    
    /* Pagination */
    .paper-page {
      background-color: var(--paper-bg, #fdf6e3);
      box-shadow: 0 10px 30px rgba(0,0,0,0.3);
      margin: 20px auto;
      page-break-after: always;
    }
    .paper-page + .paper-page {
      margin-top: 40px;
    }
  `;
}

// Export singleton factory
export function createPaperRenderer(container, config) {
  return new PaperRenderer(container, config);
}

export default PaperRenderer;
