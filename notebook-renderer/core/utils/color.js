/**
 * Color Utility Functions
 * Provides color parsing, conversion, and blending operations.
 * 
 * @module core/utils/color
 */

/**
 * Parses a CSS color string into RGBA components.
 * Supports hex, rgb(), rgba(), and named colors.
 * 
 * @param {string} cssColor - CSS color string
 * @returns {{r: number, g: number, b: number, a: number}} RGBA object (values 0-255 for rgb, 0-1 for a)
 */
export function parseColor(cssColor) {
  if (!cssColor) return { r: 0, g: 0, b: 0, a: 1 };
  
  // Trim whitespace
  cssColor = cssColor.trim().toLowerCase();
  
  // Named colors (common subset)
  const namedColors = {
    black: '#000000', white: '#ffffff', red: '#ff0000',
    green: '#008000', blue: '#0000ff', yellow: '#ffff00',
    cyan: '#00ffff', magenta: '#ff00ff', gray: '#808080',
    grey: '#808080', silver: '#c0c0c0', maroon: '#800000',
    olive: '#808000', lime: '#00ff00', aqua: '#00ffff',
    teal: '#008080', navy: '#000080', fuchsia: '#ff00ff',
    purple: '#800080', orange: '#ffa500', pink: '#ffc0cb'
  };
  
  if (namedColors[cssColor]) {
    cssColor = namedColors[cssColor];
  }
  
  // Hex color (#rgb or #rrggbb or #rgba or #rrggbbaa)
  const hexMatch = cssColor.match(/^#([0-9a-f]{3,8})$/);
  if (hexMatch) {
    const hex = hexMatch[1];
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
        a: 1
      };
    } else if (hex.length === 4) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
        a: parseInt(hex[3] + hex[3], 16) / 255
      };
    } else if (hex.length === 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: 1
      };
    } else if (hex.length === 8) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: parseInt(hex.slice(6, 8), 16) / 255
      };
    }
  }
  
  // RGB/RGBA functional notation
  const rgbMatch = cssColor.match(/^rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1], 10),
      g: parseInt(rgbMatch[2], 10),
      b: parseInt(rgbMatch[3], 10),
      a: rgbMatch[4] !== undefined ? parseFloat(rgbMatch[4]) : 1
    };
  }
  
  // Default to black if parsing fails
  console.warn(`[color] Could not parse color: ${cssColor}, defaulting to black`);
  return { r: 0, g: 0, b: 0, a: 1 };
}

/**
 * Converts RGB values to hex string.
 * 
 * @param {number} r - Red (0-255)
 * @param {number} g - Green (0-255)
 * @param {number} b - Blue (0-255)
 * @returns {string} Hex color string (#rrggbb)
 */
export function rgbToHex(r, g, b) {
  const toHex = (n) => {
    const hex = Math.max(0, Math.min(255, Math.round(n))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Converts hex string to RGB values.
 * 
 * @param {string} hex - Hex color string (#rrggbb or #rgb)
 * @returns {{r: number, g: number, b: number}} RGB object
 */
export function hexToRgb(hex) {
  const { r, g, b } = parseColor(hex);
  return { r, g, b };
}

/**
 * Blends two colors with alpha compositing.
 * 
 * @param {{r: number, g: number, b: number, a: number}} color1 - Base color
 * @param {{r: number, g: number, b: number, a: number}} color2 - Overlay color
 * @param {number} alpha - Blend factor (0-1), where 0 is all color1, 1 is all color2
 * @returns {{r: number, g: number, b: number, a: number}} Blended color
 */
export function blend(color1, color2, alpha = 0.5) {
  const c1 = parseColor(typeof color1 === 'string' ? color1 : rgbToCss(color1));
  const c2 = parseColor(typeof color2 === 'string' ? color2 : rgbToCss(color2));
  
  return {
    r: Math.round(c1.r * (1 - alpha) + c2.r * alpha),
    g: Math.round(c1.g * (1 - alpha) + c2.g * alpha),
    b: Math.round(c1.b * (1 - alpha) + c2.b * alpha),
    a: c1.a * (1 - alpha) + c2.a * alpha
  };
}

/**
 * Converts RGBA object to CSS rgba() string.
 * 
 * @param {{r: number, g: number, b: number, a: number}} color - RGBA object
 * @returns {string} CSS rgba() string
 */
export function rgbToCss(color) {
  if (color.a === 1 || color.a === undefined) {
    return `rgb(${color.r}, ${color.g}, ${color.b})`;
  }
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`;
}

/**
 * Lightens or darkens a color by a percentage.
 * 
 * @param {string} cssColor - Input CSS color
 * @param {number} percent - Percentage (-100 to 100), negative darkens, positive lightens
 * @returns {string} Adjusted CSS color
 */
export function adjustLightness(cssColor, percent) {
  const color = parseColor(cssColor);
  const factor = 1 + (percent / 100);
  
  return rgbToCss({
    r: Math.max(0, Math.min(255, Math.round(color.r * factor))),
    g: Math.max(0, Math.min(255, Math.round(color.g * factor))),
    b: Math.max(0, Math.min(255, Math.round(color.b * factor))),
    a: color.a
  });
}

/**
 * Extracts the ink color name from semantic mapping.
 * 
 * @param {string} semanticName - Semantic color name (e.g., 'body', 'strong', 'em')
 * @param {Object} semanticColors - Mapping of semantic names to ink names
 * @param {Object} inkColors - Mapping of ink names to hex values
 * @returns {string} Hex color value
 */
export function getSemanticColor(semanticName, semanticColors, inkColors) {
  const inkName = semanticColors[semanticName] || 'blue';
  return inkColors[inkName] || inkColors.blue || '#000080';
}
