/**
 * Notebook Renderer - Main Entry Point
 * 
 * A plug-and-play module for rendering Markdown, Mermaid diagrams, 
 * and Math onto realistic notebook paper with hand-drawn aesthetics.
 * 
 * @example
 * ```javascript
 * import { PaperRenderer, MermaidSketchEngine } from './core/index.js';
 * 
 * const renderer = new PaperRenderer('#container', {
 *   gridSize: 32,
 *   fontSize: 26,
 *   enableMermaid: true,
 * });
 * 
 * await renderer.applyPreset('blue-bic');
 * await renderer.renderMarkdown('# Hello World');
 * ```
 */

// Core Engines
export { PaperRenderer, DEFAULT_PAPER_CONFIG, getPaperRendererStyles, createPaperRenderer } from './paper-renderer.js';
export { MermaidSketchEngine, DEFAULT_SKETCH_CONFIG, PALETTES, buildMermaidTheme, sketchEngine } from './mermaid-sketch.js';
export { PaginationEngine, PAGE_FORMATS, DEFAULT_PAGINATION_CONFIG, paginationEngine, calculateOptimalFontSize } from './pagination.js';

// Utilities
export { loadPreset, validatePreset, mergePresets, serializePreset, BASE_PRESET } from './preset-loader.js';
export { mulberry32, gaussianRandom, hashString } from './utils/seed.js';
export { parseColor, blendColors, colorToRgba, semanticColorMap } from './utils/color.js';
export { tightenViewBox, expandViewBox, getViewBox, parseViewBox } from './utils/svg.js';
export { waitForReady, waitForFonts, waitForImages } from './utils/ready.js';

// Version
export const VERSION = '1.0.0-alpha';

/**
 * Quick setup function for simple use cases
 * @param {string|HTMLElement} container - Container element or selector
 * @param {Object} options - Configuration options
 * @returns {Promise<PaperRenderer>} Configured renderer instance
 */
export async function setup(container, options = {}) {
  const { PaperRenderer } = await import('./paper-renderer.js');
  
  const renderer = new PaperRenderer(container, {
    gridSize: 32,
    fontSize: 26,
    enableMermaid: true,
    enableMath: true,
    enableGridSnap: true,
    ...options,
  });
  
  return renderer;
}

/**
 * Create a headless renderer for server-side/image export
 * @param {Object} config - Configuration
 * @returns {Object} Headless renderer functions
 */
export function createHeadlessRenderer(config = {}) {
  return {
    render: async (markdown) => {
      console.log('[Headless] Rendering:', markdown.slice(0, 50) + '...');
      // Implementation requires Playwright/Puppeteer
      throw new Error('Headless rendering requires browser environment');
    },
    exportImage: async (format = 'png') => {
      console.log('[Headless] Exporting as', format);
      throw new Error('Headless export requires browser environment');
    },
  };
}

export default {
  PaperRenderer,
  MermaidSketchEngine,
  PaginationEngine,
  setup,
  createHeadlessRenderer,
  VERSION,
};
