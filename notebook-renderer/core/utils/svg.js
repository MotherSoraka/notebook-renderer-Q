/**
 * SVG Utility Functions
 * Provides SVG viewBox manipulation, bounding box calculations, and element helpers.
 * 
 * @module core/utils/svg
 */

/**
 * Gets the current viewBox of an SVG element.
 * 
 * @param {SVGElement} svgElement - The SVG element
 * @returns {{x: number, y: number, width: number, height: number}} ViewBox object
 */
export function getViewBox(svgElement) {
  const viewBoxAttr = svgElement.getAttribute('viewBox');
  if (viewBoxAttr) {
    const parts = viewBoxAttr.split(/[\s,]+/).map(parseFloat);
    return {
      x: parts[0] || 0,
      y: parts[1] || 0,
      width: parts[2] || 0,
      height: parts[3] || 0
    };
  }
  
  // Fallback to getBBox if no viewBox attribute
  try {
    const bbox = svgElement.getBBox();
    return { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height };
  } catch (e) {
    console.warn('[svg] Could not get viewBox:', e);
    return { x: 0, y: 0, width: 0, height: 0 };
  }
}

/**
 * Sets the viewBox of an SVG element.
 * 
 * @param {SVGElement} svgElement - The SVG element
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} width - Width
 * @param {number} height - Height
 */
export function setViewBox(svgElement, x, y, width, height) {
  svgElement.setAttribute('viewBox', `${x} ${y} ${width} ${height}`);
}

/**
 * Gets the bounding box of an SVG element, with error handling.
 * 
 * @param {SVGElement} element - The SVG element
 * @returns {{x: number, y: number, width: number, height: number}} Bounding box
 */
export function getBBox(element) {
  try {
    return element.getBBox();
  } catch (e) {
    // Fallback for hidden elements or errors
    console.warn('[svg] getBBox failed, using fallback:', e);
    return { x: 0, y: 0, width: 0, height: 0 };
  }
}

/**
 * Tightens the viewBox of an SVG to fit its content exactly.
 * This removes unnecessary whitespace around the diagram.
 * 
 * @param {SVGElement} svgElement - The SVG element
 * @param {Object} options - Options
 * @param {number} options.padding - Padding around content (default: 0)
 * @param {boolean} options.preserveAspectRatio - Whether to preserve aspect ratio (default: true)
 */
export function tightenViewBox(svgElement, options = {}) {
  const { padding = 0, preserveAspectRatio = true } = options;
  
  try {
    // Get all graphical elements in the SVG
    const allElements = svgElement.querySelectorAll('*');
    if (allElements.length === 0) return;
    
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    allElements.forEach(el => {
      try {
        const bbox = el.getBBox();
        if (bbox.width > 0 && bbox.height > 0) {
          minX = Math.min(minX, bbox.x);
          minY = Math.min(minY, bbox.y);
          maxX = Math.max(maxX, bbox.x + bbox.width);
          maxY = Math.max(maxY, bbox.y + bbox.height);
        }
      } catch (e) {
        // Skip elements that can't provide bbox
      }
    });
    
    if (minX === Infinity) return; // No valid elements found
    
    const width = maxX - minX;
    const height = maxY - minY;
    
    // Apply padding
    setViewBox(
      svgElement,
      minX - padding,
      minY - padding,
      width + padding * 2,
      height + padding * 2
    );
    
    // Ensure aspect ratio is preserved if requested
    if (preserveAspectRatio) {
      const currentAspectRatio = svgElement.getAttribute('preserveAspectRatio');
      if (!currentAspectRatio) {
        svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      }
    }
    
    console.log(`[svg] Tightened viewBox to: ${minX - padding}, ${minY - padding}, ${width + padding * 2}, ${height + padding * 2}`);
  } catch (e) {
    console.error('[svg] Error tightening viewBox:', e);
  }
}

/**
 * Gets the rendered dimensions of an SVG element.
 * 
 * @param {SVGElement} svgElement - The SVG element
 * @returns {{width: number, height: number}} Dimensions
 */
export function getRenderedSize(svgElement) {
  const rect = svgElement.getBoundingClientRect();
  return {
    width: rect.width,
    height: rect.height
  };
}

/**
 * Scales an SVG to fit within given dimensions while preserving aspect ratio.
 * 
 * @param {SVGElement} svgElement - The SVG element
 * @param {number} maxWidth - Maximum width
 * @param {number} maxHeight - Maximum height
 */
export function scaleToFit(svgElement, maxWidth, maxHeight) {
  const size = getRenderedSize(svgElement);
  const scaleX = maxWidth / size.width;
  const scaleY = maxHeight / size.height;
  const scale = Math.min(scaleX, scaleY);
  
  if (scale < 1) {
    svgElement.style.transform = `scale(${scale})`;
    svgElement.style.transformOrigin = 'top left';
  }
}

/**
 * Extracts path data from an SVG element.
 * 
 * @param {SVGElement} svgElement - The SVG element
 * @returns {string[]} Array of path d attributes
 */
export function extractPaths(svgElement) {
  const paths = svgElement.querySelectorAll('path');
  return Array.from(paths).map(p => p.getAttribute('d')).filter(Boolean);
}

/**
 * Creates an SVG element with proper namespace.
 * 
 * @param {string} tagName - Element tag name
 * @returns {SVGElement} Created element
 */
export function createSvgElement(tagName) {
  return document.createElementNS('http://www.w3.org/2000/svg', tagName);
}

/**
 * Clones an SVG element deeply.
 * 
 * @param {SVGElement} svgElement - The SVG element to clone
 * @returns {SVGElement} Cloned SVG element
 */
export function cloneSvg(svgElement) {
  return svgElement.cloneNode(true);
}
