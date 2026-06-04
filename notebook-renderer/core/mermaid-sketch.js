/**
 * Mermaid Sketch Engine - Hand-drawn style post-processor for Mermaid diagrams
 * 
 * This module takes standard Mermaid SVG output and applies hand-drawn styling
 * using rough.js, including wobbly outlines, hachure fills, ghost lines, and
 * handwritten typography.
 * 
 * @module MermaidSketchEngine
 */

import { mulberry32, hashString } from './utils/seed.js';
import { parseColor } from './utils/color.js';
import { tightenViewBox, expandViewBox } from './utils/svg.js';

/**
 * Default sketch configuration - Single Source of Truth for all visual parameters
 * Can be overridden by presets
 */
export const DEFAULT_SKETCH_CONFIG = {
  // Master controls
  enabled: true,
  mermaidTheme: 'default',
  pieLabelsOutside: true,

  // Typography
  handFont: true,
  fontFamily: "'Caveat', cursive",
  fontScale: 1.15,

  // Stroke color
  strokeColor: '#1a47b8', // classic Bic blue ballpen
  forceStroke: true,

  // Outlines
  outRoughness: 0.5,
  outBowing: 3.0,
  strokeWidth: 1.6,
  outWobbleAmp: 2.0,
  outWobbleFreq: 0.04,
  outlineTex: 'ballpen', // 'ballpen' | 'pencil'
  outGrain: 0.60,
  outBlur: 0.00,

  // Hachures (fill)
  hachure: true,
  fillStyle: 'hachure', // 'hachure' | 'cross-hatch' | 'zigzag' | 'dots'
  hatRoughness: 2.0,
  hatBowing: 3.6,
  hachureGap: 5.0,
  fillWeight: 2.3,
  hachureAngle: -41,
  fillOpacity: 1.00,
  fillJitter: 0.95,
  bleed: true,
  bleedAmount: 10.0,
  edgeJitter: 3.0,
  hatchTex: 'pencil',
  hatGrain: 1.00,
  hatBlur: 0.00,

  // XY Chart
  xychartLabelAngle: 0,

  // Ghost lines
  ghostLines: true,
  ghostCount: 1,
  ghostOpacity: 0.61,
  ghostOffset: 2.6,
  ghostRoughness: 0.6,
  ghostBowing: 3.0,
  ghostWidth: 0.5,
  ghostTex: 'pencil',
  ghostGrain: 1.25,
  ghostBlur: 0.00,

  // Gantt
  ganttBarInflate: 0.35,

  // Auto-color
  autoColor: true,
};

/**
 * Color palettes for diagram nodes
 */
export const PALETTES = {
  pencil: [
    '#5B8DB8', '#C76B6B', '#6BAF6B', '#C4A94D',
    '#8E6BA8', '#CC8844', '#5BA8A0', '#C46B8A',
    '#7B9E5A', '#7A8CBB',
  ],
  pastel: [
    '#A8D8EA', '#F3B0C3', '#C6E2B5', '#FFE5A0',
    '#C3B1E1', '#FFDAC1', '#B5EAD7', '#FFB7B2',
    '#D5C4A1', '#B8D4E3',
  ],
  bold: [
    '#2176FF', '#E63946', '#2D936C', '#F9C74F',
    '#7B2D8E', '#F77F00', '#17BEBB', '#EF476F',
    '#606C38', '#457B9D',
  ],
  ballpen: [
    '#1A47B8', '#C8101E', '#1A7A1A', '#111111',
    '#7B3FA0', '#C8660A', '#005F8E', '#8B1A1A',
    '#1A5C1A', '#2255CC',
  ],
  coloredPencil: [
    '#E8312A', '#F97316', '#FACC15', '#84CC16',
    '#22C55E', '#06B6D4', '#3B82F6', '#6D28D9',
    '#EC4899', '#92400E', '#6B7280', '#1C1917',
  ],
};

/**
 * Main Sketch Engine class
 */
export class MermaidSketchEngine {
  constructor(config = {}) {
    this.config = { ...DEFAULT_SKETCH_CONFIG, ...config };
    this.palette = PALETTES.pencil;
    this._pxScale = 1;
    this._roughInstance = null;
  }

  /**
   * Update engine configuration
   * @param {Object} newConfig - Configuration overrides
   */
  configure(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Set active color palette
   * @param {string} paletteName - Name of palette from PALETTES
   */
  setPalette(paletteName) {
    if (PALETTES[paletteName]) {
      this.palette = PALETTES[paletteName];
    } else {
      console.warn(`[MermaidSketch] Unknown palette: ${paletteName}`);
    }
  }

  /**
   * Main entry: post-process a Mermaid SVG element
   * @param {SVGElement} svgEl - The rendered Mermaid SVG
   * @param {number} displayScale - Display scale factor for pixel compensation
   */
  process(svgEl, displayScale = 1) {
    if (!this.config.enabled || !svgEl) {
      console.log('[MermaidSketch] Skipping: disabled or no SVG element');
      return;
    }

    // Pixel compensation: invert display scale for consistent stroke sizes
    this._pxScale = 1 / Math.max(0.05, displayScale || 1);

    // Inject reusable SVG filters
    this._injectFilters(svgEl);

    // Initialize rough.js instance
    if (typeof rough !== 'undefined') {
      this._roughInstance = rough.svg(svgEl);
    } else {
      console.error('[MermaidSketch] rough.js not loaded!');
      return;
    }

    let colorIdx = 0;

    // Detect mindmap root nodes for special handling
    const mindmapRootShapes = new Set();
    this._detectMindmapRootShapes(svgEl, mindmapRootShapes);

    // Gather all shape elements
    const shapes = svgEl.querySelectorAll('rect, circle, ellipse, polygon, line, path');
    const drawnComponents = new Map();

    shapes.forEach(el => {
      if (this._shouldSkip(el)) return;

      const sig = this._getGeometrySignature(el);
      const tracker = sig ? (drawnComponents.get(sig) || {}) : null;

      const isShape = this._isFilledShape(el);
      const hasOrigStroke = this._getEffectiveStroke(el) !== 'none';

      // Decide what to draw, preventing duplicates
      const shouldDrawOutline = (isShape || hasOrigStroke) && (!tracker || !tracker.outline);
      const fillColor = this._resolveFill(el, colorIdx);
      const hasFill = fillColor !== 'transparent';
      const shouldDrawFill = isShape && hasFill && (!tracker || !tracker.fill);

      if (shouldDrawFill) colorIdx++;

      const seed = this._seedFrom(el);
      const stroke = this._resolveStroke(el);

      // Ghost layer (behind everything)
      if (shouldDrawOutline && this.config.ghostLines) {
        this._drawGhostLines(el, seed);
      }

      // Hachure fill layer
      if (shouldDrawFill) {
        if (this.config.hachure) {
          this._renderHachureLayer(el, fillColor, seed, svgEl);
        } else {
          this._renderSolidFill(el, fillColor, seed);
        }
      }

      // Outline layer
      if (shouldDrawOutline) {
        this._renderOutline(el, stroke, seed);
        
        // Reconstruct markers as sketchy arrowheads
        if (this._hasMarker(el)) {
          this._drawArrowMarkers(el, stroke, seed);
        }
      }

      // Update tracker
      if (tracker) {
        if (shouldDrawFill) tracker.fill = true;
        if (shouldDrawOutline) tracker.outline = true;
        if (sig) drawnComponents.set(sig, tracker);
      }

      // Hide original primitive
      el.style.setProperty('display', 'none', 'important');
      el.setAttribute('data-sketch-hidden', 'true');

      // Clear mindmap root fills
      if (mindmapRootShapes.has(el)) {
        el.style.setProperty('fill', 'transparent', 'important');
        el.style.setProperty('fill-opacity', '0', 'important');
        el.setAttribute('data-sketch-mindmap-root', 'true');
      }
    });

    // Force-clear remaining mindmap roots
    this._forceClearMindmapRoot(svgEl, mindmapRootShapes);

    // Process Gantt charts
    this._processGantt(svgEl);

    // Expand viewBox for text room
    this._padViewBox(svgEl);

    // Apply typography
    this._applyTypography(svgEl);

    console.log('[MermaidSketch] Processing complete');
  }

  /**
   * Build outline options for rough.js
   */
  _buildOutlineOpts(overrides = {}) {
    return {
      roughness: this.config.outRoughness,
      bowing: this.config.outBowing,
      strokeWidth: this._px(this.config.strokeWidth),
      stroke: this.config.strokeColor,
      fill: undefined,
      disableMultiStroke: true,
      ...overrides,
    };
  }

  /**
   * Build hachure options for rough.js
   */
  _buildHachureOpts(overrides = {}) {
    return {
      roughness: this.config.hatRoughness,
      bowing: this.config.hatBowing,
      strokeWidth: 0.001,
      stroke: 'transparent',
      fillStyle: this.config.fillStyle,
      fillWeight: this.config.fillWeight,
      hachureAngle: this.config.hachureAngle,
      hachureGap: this.config.hachureGap,
      ...overrides,
    };
  }

  /**
   * Convert logical pixels to scaled pixels
   */
  _px(value) {
    return value * this._pxScale;
  }

  /**
   * Generate seeded random number from element
   */
  _seedFrom(el) {
    const tag = el.tagName;
    const type = el.getAttribute('class') || '';
    const text = el.textContent?.slice(0, 20) || '';
    return hashString(`${tag}-${type}-${text}`);
  }

  /**
   * Check if element should be skipped
   */
  _shouldSkip(el) {
    if (el.hasAttribute('data-sketch-hidden')) return true;
    if (el.classList.contains('sketch-ghost')) return true;
    if (el.classList.contains('sketch-fill')) return true;
    if (el.classList.contains('sketch-shape')) return true;
    if (el.classList.contains('sketch-marker')) return true;
    return false;
  }

  /**
   * Check if element is a filled shape
   */
  _isFilledShape(el) {
    const tag = el.tagName.toLowerCase();
    const validTags = ['rect', 'circle', 'ellipse', 'polygon', 'path'];
    if (!validTags.includes(tag)) return false;
    
    const fill = el.getAttribute('fill');
    if (fill === 'none' || fill === 'transparent') return false;
    
    return true;
  }

  /**
   * Get effective stroke color
   */
  _getEffectiveStroke(el) {
    const stroke = el.getAttribute('stroke');
    if (!stroke || stroke === 'none') return 'none';
    return stroke;
  }

  /**
   * Resolve fill color for element
   */
  _resolveFill(el, colorIdx) {
    const fill = el.getAttribute('fill');
    if (!fill || fill === 'none' || fill === 'transparent') {
      return 'transparent';
    }
    
    // Use palette color if auto-color enabled
    if (this.config.autoColor && this.config.fillStyle !== 'solid') {
      return this.palette[colorIdx % this.palette.length];
    }
    
    return fill;
  }

  /**
   * Resolve stroke color for element
   */
  _resolveStroke(el) {
    if (this.config.forceStroke) {
      return this.config.strokeColor;
    }
    return this._getEffectiveStroke(el);
  }

  /**
   * Check if element has marker (arrowhead)
   */
  _hasMarker(el) {
    return el.getAttribute('marker-end') || el.getAttribute('marker-start');
  }

  /**
   * Get geometry signature for deduplication
   */
  _getGeometrySignature(el) {
    const tag = el.tagName;
    if (tag === 'rect') {
      return `${tag}:${el.getAttribute('x')}:${el.getAttribute('y')}:${el.getAttribute('width')}:${el.getAttribute('height')}`;
    }
    if (tag === 'circle') {
      return `${tag}:${el.getAttribute('cx')}:${el.getAttribute('cy')}:${el.getAttribute('r')}`;
    }
    if (tag === 'ellipse') {
      return `${tag}:${el.getAttribute('cx')}:${el.getAttribute('cy')}:${el.getAttribute('rx')}:${el.getAttribute('ry')}`;
    }
    if (tag === 'polygon') {
      return `${tag}:${el.getAttribute('points')}`;
    }
    if (tag === 'path') {
      return `${tag}:${el.getAttribute('d')}`;
    }
    return null;
  }

  /**
   * Detect mindmap root node shapes
   */
  _detectMindmapRootShapes(svgEl, rootSet) {
    // Look for large circles/ellipses at the start of mindmap diagrams
    const mindmapRoots = svgEl.querySelectorAll('.mindmap .node.root circle, .mindmap .node.root ellipse');
    mindmapRoots.forEach(el => rootSet.add(el));
  }

  /**
   * Force clear mindmap root shapes
   */
  _forceClearMindmapRoot(svgEl, rootSet) {
    // Additional pass to catch any missed roots
    const allShapes = svgEl.querySelectorAll('circle, ellipse');
    allShapes.forEach(el => {
      if (rootSet.has(el)) {
        el.style.setProperty('fill', 'transparent', 'important');
      }
    });
  }

  /**
   * Process Gantt chart styling
   */
  _processGantt(svgEl) {
    if (!svgEl.querySelector('.gantt')) return;
    
    // Hide section fills
    svgEl.querySelectorAll('.gantt .section-row rect').forEach(rect => {
      rect.style.setProperty('fill', 'transparent', 'important');
    });
    
    // Inflate task bars
    const inflate = this._px(this.config.ganttBarInflate * 10);
    svgEl.querySelectorAll('.gantt .task rect').forEach(rect => {
      const height = parseFloat(rect.getAttribute('height')) || 0;
      rect.setAttribute('height', height + inflate);
    });
  }

  /**
   * Pad viewBox to prevent text clipping
   */
  _padViewBox(svgEl) {
    const vb = svgEl.getAttribute('viewBox');
    if (!vb) return;
    
    const [x, y, w, h] = vb.split(/[\s,]+/).map(Number);
    const pad = this._px(20);
    svgEl.setAttribute('viewBox', `${x - pad} ${y - pad} ${w + pad * 2} ${h + pad * 2}`);
  }

  /**
   * Apply handwritten typography
   */
  _applyTypography(svgEl) {
    const fam = this.config.handFont ? this.config.fontFamily : null;
    
    // SVG Text elements
    svgEl.querySelectorAll('text, tspan').forEach(t => {
      if (fam) {
        try { t.style.fontFamily = fam; } catch(e) {}
      }
      if (this.config.handFont && t.tagName.toLowerCase() === 'text') {
        const sz = parseFloat(getComputedStyle(t).fontSize) || 14;
        t.style.fontSize = (sz * this.config.fontScale) + 'px';
      }
      
      // Readability: black text with white halo
      t.style.setProperty('fill', '#111111', 'important');
      t.style.setProperty('stroke', '#ffffff', 'important');
      t.style.setProperty('stroke-width', '3px', 'important');
      t.style.setProperty('stroke-linejoin', 'round', 'important');
      t.style.setProperty('paint-order', 'stroke fill', 'important');
    });

    // HTML text in foreignObject
    svgEl.querySelectorAll('foreignObject, foreignObject *').forEach(t => {
      if (fam) {
        try { t.style.fontFamily = fam; } catch(e) {}
      }
      t.style.setProperty('color', '#111111', 'important');
      t.style.setProperty('text-shadow', 
        '0 0 2px #ffffff, -1px -1px 0 #ffffff, 1px -1px 0 #ffffff, -1px 1px 0 #ffffff, 1px 1px 0 #ffffff', 
        'important');
    });
  }

  /**
   * Inject SVG filter definitions
   */
  _injectFilters(svgEl) {
    const defs = this._ensureDefs(svgEl);
    
    // Remove existing sketch filters
    defs.querySelectorAll('[data-sketch-filter]').forEach(f => f.remove());
    
    // Outline filter
    const oBlur = this.config.outBlur;
    const oGrain = this.config.outlineTex === 'pencil' ? this.config.outGrain : 0;
    const oWobbleAmp = this.config.outWobbleAmp;
    const oWobbleFreq = this.config.outWobbleFreq;
    
    if (oBlur > 0 || oGrain > 0 || oWobbleAmp > 0) {
      defs.insertAdjacentHTML('beforeend', this._buildFilter(
        'sketch-filter-outline', oBlur, oGrain, oWobbleAmp, oWobbleFreq
      ));
    }
    
    // Hachure filter
    const hBlur = this.config.hatBlur;
    const hGrain = this.config.hatchTex === 'pencil' ? this.config.hatGrain : 0;
    
    if (hBlur > 0 || hGrain > 0) {
      defs.insertAdjacentHTML('beforeend', this._buildFilter(
        'sketch-filter-hatch', hBlur, hGrain, 0, 0
      ));
    }
    
    // Ghost filter
    const gBlur = this.config.ghostBlur;
    const gGrain = this.config.ghostTex === 'pencil' ? this.config.ghostGrain : 0;
    
    if (gBlur > 0 || gGrain > 0) {
      defs.insertAdjacentHTML('beforeend', this._buildFilter(
        'sketch-filter-ghost', gBlur, gGrain, 0, 0
      ));
    }
  }

  /**
   * Build SVG filter XML
   */
  _buildFilter(id, blur, grain, wobbleAmp, wobbleFreq) {
    const grainSize = 100;
    let filter = `<filter id="${id}" data-sketch-filter="true" x="-50%" y="-50%" width="200%" height="200%">`;
    
    if (grain > 0) {
      filter += `
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" result="noise${id}" />
        <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${grain} -${grain * 0.5}" result="grain${id}" />
        <feBlend in="SourceGraphic" in2="grain${id}" mode="multiply" />`;
    }
    
    if (blur > 0) {
      filter += `<feGaussianBlur stdDeviation="${blur}" />`;
    }
    
    if (wobbleAmp > 0) {
      filter += `
        <feTurbulence type="turbulence" baseFrequency="${wobbleFreq}" numOctaves="2" result="wobble${id}" />
        <feDisplacementMap in="SourceGraphic" in2="wobble${id}" scale="${wobbleAmp}" xChannelSelector="R" yChannelSelector="G" />`;
    }
    
    filter += '</filter>';
    return filter;
  }

  /**
   * Ensure <defs> element exists
   */
  _ensureDefs(svgEl) {
    let defs = svgEl.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      svgEl.insertBefore(defs, svgEl.firstChild);
    }
    return defs;
  }

  /**
   * Draw ghost lines behind shapes
   */
  _drawGhostLines(el, seed) {
    const rc = this._roughInstance;
    const gCount = Math.max(1, this.config.ghostCount | 0);
    const gOff = this._px(this.config.ghostOffset);
    const gWid = this._px(this.config.ghostWidth);
    
    for (let p = 0; p < gCount; p++) {
      const ghostEl = this._drawShape(rc, el, {
        roughness: this.config.ghostRoughness,
        bowing: this.config.ghostBowing,
        strokeWidth: gWid,
        stroke: this.config.strokeColor,
        fill: undefined,
        disableMultiStroke: true,
        seed: seed + 42 + p * 13,
      });
      
      if (ghostEl) {
        const ox = (Math.random() - 0.5) * gOff * 2;
        const oy = (Math.random() - 0.5) * gOff * 2;
        this._applyTransform(el, ghostEl, `translate(${ox},${oy})`);
        ghostEl.style.opacity = this.config.ghostOpacity;
        ghostEl.classList.add('sketch-ghost');
        
        const filter = document.getElementById('sketch-filter-ghost');
        if (filter) ghostEl.setAttribute('filter', 'url(#sketch-filter-ghost)');
        
        el.parentNode.insertBefore(ghostEl, el);
      }
    }
  }

  /**
   * Render hachure fill layer
   */
  _renderHachureLayer(el, fillColor, seed, svgEl) {
    const rc = this._roughInstance;
    const opts = this._buildHachureOpts({
      fillWeight: this._px(this.config.fillWeight),
      hachureGap: this._px(this.config.hachureGap),
      fill: fillColor,
      seed,
    });
    
    const hachureEl = this._drawShape(rc, el, opts);
    if (!hachureEl) return;
    
    this._applyTransform(el, hachureEl);
    
    // Apply opacity jitter
    if (this.config.fillJitter > 0) {
      hachureEl.querySelectorAll('path').forEach(p => {
        const d = p.getAttribute('d');
        if (!d) return;
        
        const segments = d.split(/(?=[Mm])/).filter(s => s.trim().length > 0);
        if (segments.length > 1) {
          const fragment = document.createDocumentFragment();
          segments.forEach(seg => {
            const clone = p.cloneNode(false);
            clone.setAttribute('d', seg);
            const op = 1.0 - (Math.random() * this.config.fillJitter);
            clone.style.opacity = op;
            fragment.appendChild(clone);
          });
          p.parentNode.replaceChild(fragment, p);
        }
      });
    }
    
    // Wrap in group for clip + filter
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('sketch-fill');
    g.style.opacity = this.config.fillOpacity;
    
    const filt = document.getElementById('sketch-filter-hatch');
    if (filt) g.setAttribute('filter', 'url(#sketch-filter-hatch)');
    
    // Apply bleed clip
    const bleedAmt = this.config.bleed ? this._px(this.config.bleedAmount) : 0;
    const edgeJit = this._px(this.config.edgeJitter);
    
    if (bleedAmt > 0) {
      const clipId = this._createBleedClip(el, svgEl, seed, bleedAmt, edgeJit);
      if (clipId) g.setAttribute('clip-path', `url(#${clipId})`);
    } else {
      const clipId = this._createTightClip(el, svgEl, seed);
      if (clipId) g.setAttribute('clip-path', `url(#${clipId})`);
    }
    
    g.appendChild(hachureEl);
    el.parentNode.insertBefore(g, el);
  }

  /**
   * Render solid fill (fallback)
   */
  _renderSolidFill(el, fillColor, seed) {
    const rc = this._roughInstance;
    const solidEl = this._drawShape(rc, el, {
      ...this._buildHachureOpts({ fill: fillColor, fillStyle: 'solid', seed }),
    });
    
    if (solidEl) {
      this._applyTransform(el, solidEl);
      solidEl.style.opacity = this.config.fillOpacity;
      solidEl.classList.add('sketch-fill');
      el.parentNode.insertBefore(solidEl, el);
    }
  }

  /**
   * Render outline layer
   */
  _renderOutline(el, stroke, seed) {
    const rc = this._roughInstance;
    const outlineEl = this._drawMaybeDashedShape(rc, el, this._buildOutlineOpts({
      strokeWidth: this._px(this.config.strokeWidth),
      stroke,
      seed: seed + 17,
    }));
    
    if (outlineEl) {
      this._applyTransform(el, outlineEl);
      
      const filter = document.getElementById('sketch-filter-outline');
      if (filter) outlineEl.setAttribute('filter', 'url(#sketch-filter-outline)');
      
      outlineEl.classList.add('sketch-shape');
      el.parentNode.insertBefore(outlineEl, el);
    }
  }

  /**
   * Draw arrow markers
   */
  _drawArrowMarkers(el, stroke, seed) {
    // Simplified marker implementation
    const rc = this._roughInstance;
    const markerEl = rc.path(
      `M 0 0 L 10 5 L 5 5 Z`,
      this._buildOutlineOpts({ stroke, seed })
    );
    
    if (markerEl) {
      markerEl.setAttribute('transform', this._getTransform(el));
      return markerEl;
    }
    return null;
  }

  /**
   * Create tight clip path
   */
  _createTightClip(el, svgEl, seed) {
    const defs = this._ensureDefs(svgEl);
    const id = `clip-tight-${seed}-${Math.random().toString(36).slice(2, 7)}`;
    const cp = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
    cp.setAttribute('id', id);
    
    const clone = el.cloneNode(false);
    clone.removeAttribute('style');
    clone.removeAttribute('class');
    cp.appendChild(clone);
    defs.appendChild(cp);
    
    return id;
  }

  /**
   * Create bleed clip path
   */
  _createBleedClip(el, svgEl, seed, bleedAmt, edgeJit) {
    const defs = this._ensureDefs(svgEl);
    const bbox = el.getBBox?.();
    if (!bbox) return null;
    
    const id = `clip-bleed-${seed}-${Math.random().toString(36).slice(2, 7)}`;
    const cp = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
    cp.setAttribute('id', id);
    
    const b = bleedAmt;
    const j = edgeJit;
    const tag = el.tagName.toLowerCase();
    let shape;
    
    switch (tag) {
      case 'rect': {
        shape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        const x = parseFloat(el.getAttribute('x')) || 0;
        const y = parseFloat(el.getAttribute('y')) || 0;
        const w = parseFloat(el.getAttribute('width')) || 0;
        const h = parseFloat(el.getAttribute('height')) || 0;
        const rx = parseFloat(el.getAttribute('rx')) || 0;
        const jx = (Math.random() - 0.5) * j;
        const jy = (Math.random() - 0.5) * j;
        shape.setAttribute('x', x - b + jx);
        shape.setAttribute('y', y - b + jy);
        shape.setAttribute('width', w + b * 2);
        shape.setAttribute('height', h + b * 2);
        if (rx > 0) shape.setAttribute('rx', rx + b);
        break;
      }
      case 'circle': {
        shape = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        shape.setAttribute('cx', el.getAttribute('cx'));
        shape.setAttribute('cy', el.getAttribute('cy'));
        const r = parseFloat(el.getAttribute('r')) || 0;
        shape.setAttribute('r', r + b);
        break;
      }
      case 'ellipse': {
        shape = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
        shape.setAttribute('cx', el.getAttribute('cx'));
        shape.setAttribute('cy', el.getAttribute('cy'));
        shape.setAttribute('rx', (parseFloat(el.getAttribute('rx')) || 0) + b);
        shape.setAttribute('ry', (parseFloat(el.getAttribute('ry')) || 0) + b);
        break;
      }
      default: {
        shape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        shape.setAttribute('x', bbox.x - b);
        shape.setAttribute('y', bbox.y - b);
        shape.setAttribute('width', bbox.width + b * 2);
        shape.setAttribute('height', bbox.height + b * 2);
      }
    }
    
    const origTransform = el.getAttribute('transform');
    if (origTransform) {
      shape.setAttribute('transform', origTransform);
    }
    
    cp.appendChild(shape);
    defs.appendChild(cp);
    return id;
  }

  /**
   * Draw shape using rough.js
   */
  _drawShape(rc, el, opts) {
    const tag = el.tagName.toLowerCase();
    
    try {
      if (tag === 'rect') {
        const x = parseFloat(el.getAttribute('x')) || 0;
        const y = parseFloat(el.getAttribute('y')) || 0;
        const w = parseFloat(el.getAttribute('width')) || 0;
        const h = parseFloat(el.getAttribute('height')) || 0;
        return rc.rectangle(x, y, w, h, opts);
      }
      if (tag === 'circle') {
        const cx = parseFloat(el.getAttribute('cx')) || 0;
        const cy = parseFloat(el.getAttribute('cy')) || 0;
        const r = parseFloat(el.getAttribute('r')) || 0;
        return rc.circle(cx, cy, r, opts);
      }
      if (tag === 'ellipse') {
        const cx = parseFloat(el.getAttribute('cx')) || 0;
        const cy = parseFloat(el.getAttribute('cy')) || 0;
        const rx = parseFloat(el.getAttribute('rx')) || 0;
        const ry = parseFloat(el.getAttribute('ry')) || 0;
        return rc.ellipse(cx, cy, rx, ry, opts);
      }
      if (tag === 'polygon') {
        const pts = (el.getAttribute('points') || '').trim();
        const pairs = pts.split(/[\s,]+/).map(Number);
        const points = [];
        for (let i = 0; i < pairs.length; i += 2) {
          points.push([pairs[i], pairs[i + 1]]);
        }
        return rc.polygon(points, opts);
      }
      if (tag === 'path') {
        const d = el.getAttribute('d') || '';
        return rc.path(d, opts);
      }
      if (tag === 'line') {
        const x1 = parseFloat(el.getAttribute('x1')) || 0;
        const y1 = parseFloat(el.getAttribute('y1')) || 0;
        const x2 = parseFloat(el.getAttribute('x2')) || 0;
        const y2 = parseFloat(el.getAttribute('y2')) || 0;
        return rc.line(x1, y1, x2, y2, opts);
      }
    } catch (err) {
      console.error('[MermaidSketch] Error drawing shape:', err);
    }
    
    return null;
  }

  /**
   * Draw shape respecting dashed patterns
   */
  _drawMaybeDashedShape(rc, el, opts) {
    const strokeDasharray = el.getAttribute('stroke-dasharray');
    if (strokeDasharray && strokeDasharray !== 'none') {
      opts.dashArray = strokeDasharray.split(/[\s,]+/).map(Number);
    }
    return this._drawShape(rc, el, opts);
  }

  /**
   * Apply transform from source to target element
   */
  _applyTransform(source, target, override) {
    const transform = override || this._getTransform(source);
    if (transform) {
      target.setAttribute('transform', transform);
    }
  }

  /**
   * Get transform string from element
   */
  _getTransform(el) {
    return el.getAttribute('transform') || '';
  }
}

/**
 * Create Mermaid theme config from sketch config
 */
export function buildMermaidTheme(config) {
  return {
    theme: config.mermaidTheme,
    themeVariables: {
      background: 'transparent',
      fontFamily: config.fontFamily,
      primaryColor: parseColor(config.strokeColor, 0.05),
      primaryBorderColor: config.strokeColor,
      lineColor: config.strokeColor,
      textColor: '#222222',
      tertiaryColor: parseColor('#006600', 0.05),
      tertiaryBorderColor: '#006600',
      noteBkgColor: parseColor('#b30000', 0.05),
      noteBorderColor: '#b30000',
      noteTextColor: '#222222',
      actorBkg: parseColor(config.strokeColor, 0.05),
      actorBorder: config.strokeColor,
      actorTextColor: '#222222',
      actorLineColor: config.strokeColor,
      signalColor: '#b30000',
      signalTextColor: '#222222',
      pie1: parseColor(config.strokeColor, 0.7),
      pie2: parseColor('#b30000', 0.7),
      pie3: parseColor('#006600', 0.7),
      pie4: parseColor('#222222', 0.7),
      pieStrokeColor: config.strokeColor,
      pieStrokeWidth: '2px',
    },
    xyChart: {
      backgroundColor: 'transparent',
      plotColorPalette: config.palette ? config.palette.join(', ') : '',
    },
    look: config.enabled ? 'handDrawn' : 'classic',
  };
}

// Export singleton instance for convenience
export const sketchEngine = new MermaidSketchEngine();

export default MermaidSketchEngine;
