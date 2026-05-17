/**
 * Preset Loader and Manager
 * Handles loading, validation, merging, and resolution of preset configurations.
 * 
 * @module core/preset-loader
 */

import { parseColor } from './utils/color.js';

/**
 * Default base preset values.
 * All other presets extend from this.
 */
export const BASE_PRESET = {
  name: '_base',
  version: 1,
  description: 'Base preset with default values',
  paper: {
    background: '#fdf6e3',
    lineColor: '#b5d8f6',
    marginColor: '#ff8c8c',
    deskColor: '#1a1a1a',
    gridSize: 32,
    fontSize: 26,
    verticalOffset: 6,
    marginLeft: 80,
    holeSpacing: 96,
    holeMargin: 15,
    textureOpacity: 0.06,
    fonts: {
      primary: 'Caveat',
      fallback: 'Amiri',
      mono: 'Fira Code',
      sizes: {
        h1: 1.6,
        h2: 1.3,
        h3: 1.1,
        body: 1.0,
        code: 0.6,
        table: 0.9
      }
    },
    ink: {
      blue: '#000080',
      red: '#b30000',
      green: '#006600',
      black: '#222222'
    },
    semanticColors: {
      body: 'blue',
      strong: 'red',
      em: 'green',
      code: 'black',
      link: 'blue',
      linkDecoration: 'red'
    }
  },
  sketch: {
    enabled: true,
    seed: 42,
    displayScale: 1,
    roughness: 1.5,
    fillStyle: 'hachure',
    fillWeight: 1.2,
    hachureGap: 4,
    hachureAngle: 135,
    curveStepCount: 18,
    curveTightness: 0.0,
    curveFitting: 0.4,
    baselineShift: -2.5,
    ghostEnabled: true,
    ghostOpacity: 0.12,
    ghostOffsetX: [-1.2, 1.5],
    ghostOffsetY: [-0.8, 1.0],
    hachureBleed: 1.8,
    strokeCap: 'round',
    strokeJoin: 'round',
    disableMultiColor: false,
    palette: 'ballpen',
    paletteOverrides: {},
    nodeColors: ['pie1', 'pie2', 'pie3', 'pie4'],
    forceClearMindmapRoot: false,
    inflateGanttBars: true,
    repositionPieLabels: true,
    rotateXYLabels: true,
    tightenViewBox: true,
    pencilGrainFilter: true,
    grainIntensity: 0.15
  },
  pagination: {
    enabled: false,
    format: 'A4',
    orientation: 'portrait',
    customWidth: null,
    customHeight: null,
    dpi: 150,
    paddingTop: 40,
    paddingBottom: 40,
    paddingLeft: 40,
    paddingRight: 40,
    cutOverlap: 8
  },
  mermaid: {
    theme: 'base',
    themeVariables: {
      background: 'transparent',
      fontFamily: "'Caveat', 'Amiri', cursive",
      primaryColor: 'rgba(0, 0, 128, 0.05)',
      primaryBorderColor: '#000080',
      lineColor: '#000080',
      textColor: '#222222'
    },
    startOnLoad: false
  },
  math: {
    displayMode: true,
    throwOnError: false,
    leqno: false,
    fleqn: false,
    output: 'html',
    trust: false,
    macros: {}
  }
};

/**
 * Deep merges two objects. Override values take precedence.
 * 
 * @param {Object} base - Base object
 * @param {Object} override - Override object
 * @returns {Object} Merged object
 */
export function deepMerge(base, override) {
  if (!override || typeof override !== 'object') return base;
  
  const result = { ...base };
  
  for (const key in override) {
    if (override.hasOwnProperty(key)) {
      const baseVal = base[key];
      const overrideVal = override[key];
      
      if (overrideVal === null || overrideVal === undefined) {
        continue;
      }
      
      if (typeof overrideVal === 'object' && !Array.isArray(overrideVal)) {
        if (typeof baseVal === 'object' && !Array.isArray(baseVal)) {
          result[key] = deepMerge(baseVal, overrideVal);
        } else {
          result[key] = { ...overrideVal };
        }
      } else {
        result[key] = overrideVal;
      }
    }
  }
  
  return result;
}

/**
 * Validates a preset against the schema.
 * 
 * @param {Object} preset - Preset to validate
 * @returns {{valid: boolean, errors: string[]}} Validation result
 */
export function validate(preset) {
  const errors = [];
  
  // Required fields
  if (!preset.name || typeof preset.name !== 'string') {
    errors.push('Missing or invalid "name" field (must be a string)');
  }
  
  if (!preset.version || preset.version !== 1) {
    errors.push('Missing or invalid "version" field (must be 1)');
  }
  
  // Validate paper section
  if (preset.paper) {
    if (preset.paper.gridSize && (typeof preset.paper.gridSize !== 'number' || preset.paper.gridSize < 10)) {
      errors.push('paper.gridSize must be a number >= 10');
    }
    if (preset.paper.fontSize && (typeof preset.paper.fontSize !== 'number' || preset.paper.fontSize < 8)) {
      errors.push('paper.fontSize must be a number >= 8');
    }
  }
  
  // Validate sketch section
  if (preset.sketch) {
    if (preset.sketch.seed && typeof preset.sketch.seed !== 'number') {
      errors.push('sketch.seed must be a number');
    }
    if (preset.sketch.roughness && (preset.sketch.roughness < 0 || preset.sketch.roughness > 10)) {
      errors.push('sketch.roughness must be between 0 and 10');
    }
  }
  
  // Validate pagination section
  if (preset.pagination) {
    const validFormats = ['A4', 'letter', 'phone', 'custom'];
    if (preset.pagination.format && !validFormats.includes(preset.pagination.format)) {
      errors.push(`pagination.format must be one of: ${validFormats.join(', ')}`);
    }
    if (preset.pagination.orientation && !['portrait', 'landscape'].includes(preset.pagination.orientation)) {
      errors.push('pagination.orientation must be "portrait" or "landscape"');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Resolves the extends chain of a preset.
 * 
 * @param {Object} preset - Preset to resolve
 * @param {Object<string, Object>} presetRegistry - Registry of available presets
 * @param {Set} visited - Set of visited preset names (for cycle detection)
 * @returns {Object} Fully resolved preset
 */
export function resolve(preset, presetRegistry = {}, visited = new Set()) {
  if (!preset) return BASE_PRESET;
  
  // Check for cycles
  if (visited.has(preset.name)) {
    console.error('[preset] Circular dependency detected:', preset.name);
    return preset;
  }
  
  visited.add(preset.name);
  
  // Start with base preset
  let resolved = { ...BASE_PRESET };
  
  // If preset extends another, resolve parent first
  if (preset.extends) {
    const parentName = preset.extends;
    const parent = presetRegistry[parentName];
    
    if (parent) {
      resolved = resolve(parent, presetRegistry, visited);
    } else if (parentName !== '_base') {
      console.warn(`[preset] Parent preset "${parentName}" not found`);
    }
  }
  
  // Merge current preset on top
  resolved = deepMerge(resolved, preset);
  
  // Remove the extends field from final result
  delete resolved.extends;
  
  return resolved;
}

/**
 * Loads a preset by name or path.
 * 
 * @param {string} nameOrPath - Preset name or file path
 * @param {Object<string, Object>} presetRegistry - Optional registry of in-memory presets
 * @returns {Promise<Object>} Loaded and resolved preset
 */
export async function load(nameOrPath, presetRegistry = {}) {
  // Check registry first
  if (presetRegistry[nameOrPath]) {
    return resolve(presetRegistry[nameOrPath], presetRegistry);
  }
  
  // Try to fetch from URL/path
  try {
    let url = nameOrPath;
    
    // If it's just a name without extension, assume JSON file in presets/
    if (!nameOrPath.includes('/') && !nameOrPath.endsWith('.json')) {
      url = `presets/${nameOrPath}.json`;
    }
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const preset = await response.json();
    return resolve(preset, presetRegistry);
  } catch (e) {
    console.error(`[preset] Failed to load preset "${nameOrPath}":`, e);
    
    // Fall back to built-in presets
    if (nameOrPath === '_base') {
      return resolve(BASE_PRESET, presetRegistry);
    }
    
    throw new Error(`Could not load preset: ${nameOrPath}`);
  }
}

/**
 * Creates a preset registry from an array of presets.
 * 
 * @param {Object[]} presets - Array of preset objects
 * @returns {Object<string, Object>} Registry keyed by preset name
 */
export function createRegistry(presets) {
  const registry = {};
  
  for (const preset of presets) {
    if (preset && preset.name) {
      registry[preset.name] = preset;
    }
  }
  
  return registry;
}

/**
 * Gets all available preset names from a registry.
 * 
 * @param {Object<string, Object>} presetRegistry - Preset registry
 * @returns {string[]} Array of preset names
 */
export function getAvailablePresets(presetRegistry = {}) {
  return Object.keys(presetRegistry);
}

/**
 * Serializes a preset to JSON string.
 * 
 * @param {Object} preset - Preset object
 * @param {boolean} pretty - Whether to pretty-print (default: true)
 * @returns {string} JSON string
 */
export function serialize(preset, pretty = true) {
  if (pretty) {
    return JSON.stringify(preset, null, 2);
  }
  return JSON.stringify(preset);
}

/**
 * Deserializes a JSON string to preset object.
 * 
 * @param {string} jsonString - JSON string
 * @returns {Object} Preset object
 */
export function deserialize(jsonString) {
  return JSON.parse(jsonString);
}
