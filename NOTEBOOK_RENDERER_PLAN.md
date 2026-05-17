# Notebook Renderer — Project Plan & Implementation Blueprint

**Status:** Draft v1
**Audience:** Anyone implementing this — including a junior developer picking it up cold.
**Goal:** Turn two HTML demo files (`Paper-Renderer.html`, `Mermaid-Engine-Playground.html`) into a clean, plug-and-play rendering library usable from Python scripts, Telegram bots, websites, and standalone HTML.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Background: Current State](#2-background-current-state)
3. [Goals & Engineering Principles](#3-goals--engineering-principles)
4. [Target Architecture](#4-target-architecture)
5. [Preset Schema (Canonical Format)](#5-preset-schema-canonical-format)
6. [Module Specifications](#6-module-specifications)
7. [Implementation Phases](#7-implementation-phases)
8. [Refactoring Checklist](#8-refactoring-checklist)
9. [Testing & Verification](#9-testing--verification)
10. [Risks & Gotchas](#10-risks--gotchas)
11. [Definition of Done](#11-definition-of-done)
12. [Glossary](#12-glossary)

---

## 1. Project Overview

### What we're building

A small, focused rendering library with two engines:

- **Paper Engine** — renders Markdown onto realistic notebook paper (lined background, ring-binder holes, margin line, ink colors, hand-drawn typography, grid-snapped layout, optional RTL, optional pagination).
- **Sketch Engine** — post-processes Mermaid SVG output into a hand-drawn look using Rough.js (ghost lines, hachure fills, pencil/ballpen textures, palette-driven coloring, per-diagram-type fixers for Pie, XY chart, Gantt, Mindmap).

Both engines are pure JavaScript modules. They can be used:

- **Standalone** — Paper alone for notes/letters, Sketch alone for stylized diagrams.
- **Together** — Paper uses Sketch as an optional plugin for `mermaid` code fences.
- **From any host** — Python (headless browser), Node.js, websites (client-side or server-side), pre-rendering at build time.

All styling is driven by **JSON preset files**. Two HTML pages exist on top of the engines:
- A **Designer** (the existing playground, refactored) for authoring presets visually.
- A **Renderer** (headless, no UI) that consumes a preset + markdown and produces images.

### What success looks like

A Python user writes:

```python
from notebook_renderer import render_markdown
png_bytes = render_markdown("# Hello\n\nWorld.", preset="blue-bic")
```

…and gets back a PNG identical to what they designed in the Designer. They can paginate to A4 or phone-screen. They can use the same preset in a website's JS bundle and get identical output in the browser.

### Out of scope (for v1)

- LaTeX-quality typography optimization (paragraph balancing, microtypography).
- Real-time collaborative editing of presets.
- A hosted preset marketplace.
- Rendering anything other than Markdown + Mermaid + KaTeX math.
- Watermarking, encryption, or other DRM features.

---

## 2. Background: Current State

There are two HTML files. Read them before touching anything.

### `Paper-Renderer.html` (~440 lines)

A single-file demo. Loads CDN dependencies (KaTeX, Marked, Mermaid v11, Google Fonts). On `DOMContentLoaded`:

1. Fetches `sample.md` from the same directory.
2. Parses Markdown with Marked.js (`gfm: true, breaks: true`).
3. Injects the HTML into a `.content` div inside a styled `.paper` element.
4. Walks for ` ```mermaid ` and ` ```math ` code blocks, replaces them with `<div class="mermaid">` / `<div class="math-block">` wrappers.
5. Runs KaTeX on the math blocks.
6. Runs `mermaid.run()` on the diagrams (using Mermaid's built-in `look: 'handDrawn'` theme).
7. Sets `dir="auto"` on block elements for native RTL.
8. After a `setTimeout(300)`, snaps every block to a CSS grid using `ResizeObserver`.
9. Wires three sliders (grid size, font size, vertical offset) to CSS variables.

**Strengths:**
- Clean CSS variable system (`--grid`, `--font-size`, `--paper-bg`, ink colors).
- Smart grid snapping with drift correction per element.
- Multi-color semantic ink (red `<strong>`, green `<em>`, black `<code>`, blue body, dashed-red `<a>`).
- Realistic paper texture using inline SVG noise filter.
- Native auto-RTL via `dir="auto"`.
- Hand-drawn tables with Rough.js-style border-radius.

**Problems:**
- Hard-coded inline Mermaid initialization conflicts with the Sketch Engine. Mermaid's native `handDrawn` look is inferior to the Sketch Engine's RoughJS post-processing.
- `setTimeout(300)` race condition — snapping can fire before Mermaid SVGs land.
- No way to feed content other than `sample.md` (requires a local server because of CORS).
- All design tokens are hard-coded in the HTML. No preset system.
- Mixes demo content, UI controls, and the renderer in one file.

### `Mermaid-Engine-Playground.Html` (~3,717 lines)

A much more sophisticated playground. Single file. Loads Mermaid v11 (UMD) and Rough.js. Organized into 7 modules in one `<script>` block:

| Module | Lines | Purpose |
|---|---|---|
| `ThemeConfig` | ~95 | Single source of truth for all sketch settings. ~40 properties. |
| `Palettes` | ~50 | Color palettes (pencil, pastel, bold, ballpen, coloredPencil). |
| `Presets` | ~190 | **Sample Mermaid diagram code** (Flowchart, Sequence, Class, ER, Pie, etc.). Misleadingly named. |
| `SketchEngine` | ~1,400 | The core post-processor. Takes a Mermaid SVG, rewrites with RoughJS: ghost lines, hachures with bleed, filters, palette-driven auto-coloring, special handling for Gantt/Mindmap/Pie/XY. |
| `PieLabelEngine` | ~150 | Repositions pie chart labels outside the wedges. |
| `XYChartLabelEngine` | ~200 | Auto-rotates X-axis labels when they overlap. |
| `MermaidBridge` | ~70 | Initializes Mermaid, renders code to SVG. |
| `Playground` | ~340 | UI controller — sliders, buttons, tabs, preset chips. |
| `AutoFit` | ~160 | Resizes the preview SVG to fit the canvas. |
| `SvgViewBoxUtil` | ~80 | Generic SVG viewBox tightening. |

**Strengths:**
- `ThemeConfig` is already a serializable preset object — we just don't call it that yet.
- Clean separation of palette, theme, engine, and UI controller.
- Sophisticated visual output: ghost lines, hachure bleed, pencil grain filters, multi-pass rendering.
- Per-diagram-type fixers (Gantt bar inflate, Pie label repositioning, XY label rotation, Mindmap root force-clear).
- Pixel-compensation for display scale (lines stay consistent thickness at any zoom).

**Problems:**
- Everything lives in one HTML file. To use the engine elsewhere you'd have to copy-paste a 3,000-line script tag.
- Naming clash: `Presets` means "sample diagram code", not "saved theme configurations".
- `Math.random()` used in places that should be deterministic (filter seeds, ghost offset jitter) — same diagram renders differently each time.
- Implicit global `mermaid.initialize` — fights with any host that initializes Mermaid separately.
- Playground UI tightly coupled to engine; engine can't be used without DOM hooks.

### What's the same

Both files:
- Use Mermaid v11 but load it differently (one ESM, one UMD).
- Reference some of the same Google Fonts (Caveat, Amiri).
- Use single-source-of-truth design tokens (CSS variables in one, JS object in the other).
- Have race conditions hidden under `setTimeout` calls.
- Are demos, not libraries — content, UI, and engine are entangled.

---

## 3. Goals & Engineering Principles

These are non-negotiable. Every decision below should be checkable against this list.

### 3.1 DRY (Don't Repeat Yourself)

- One preset schema covers both engines plus pagination. Not two parallel schemas.
- One CSS variable system used by both Designer and Renderer.
- One Mermaid initialization path. Both engines never call `mermaid.initialize` from different places.
- Shared utilities (color parsing, SVG bbox math, font loading) live in one helper module, not duplicated.

### 3.2 SSoT (Single Source of Truth)

- The JSON preset is the **only** way to configure rendering. No "preset + extra override flags". If you want a variant, use the `extends` field.
- The Designer reads/writes presets. The Renderer reads them. There is no third source.
- Version your schema (`"version": 1` in every preset). When you change the schema, bump the version and provide a migration path.

### 3.3 Plug-and-Play

- Engines have no DOM dependencies beyond what they're operating on. `SketchEngine.process(svgEl)` takes the SVG element and works.
- Engines have no Python/Node specifics. They're pure JS modules running in a browser (real or headless).
- Optional features are optional. Loading the Paper engine without the Sketch engine works. Loading Sketch without Paper works.

### 3.4 Deterministic Output

- Same input + same preset → byte-identical (or near-identical) output across runs.
- All RNG seeded explicitly. No raw `Math.random()` in the rendering path.
- Font loading awaited before measurement. No `setTimeout` band-aids.

### 3.5 Host-Agnostic

- The same JS code runs in:
  - The Designer (interactive)
  - The headless Renderer (Playwright/Puppeteer)
  - A website (client-side)
  - A Node.js render service (server-side)
- The contract for "I am done rendering, you can screenshot now" is one explicit signal: `window.__renderReady === true` plus a `notebook:ready` event.

### 3.6 Clean Code

- Functions do one thing. If a function is over ~80 lines, it gets split.
- Names describe behavior, not implementation. `renderHachureLayer(...)` not `doFillStuff(...)`.
- Magic numbers get named constants. `const A4_HEIGHT_PX = 1123;`
- Dead code gets deleted. If a function isn't called, remove it.
- Comments explain *why*, not *what*. The code already shows *what*.

### 3.7 Bundle Everything

- For production use (Telegram bot on a VPS), every CDN dependency is a failure point.
- Self-host all libraries (Mermaid, RoughJS, KaTeX, Marked) and fonts.
- Provide a "CDN mode" for development and a "bundled mode" for production.

---

## 4. Target Architecture

### 4.1 Three layers

```
┌────────────────────────────────────────────────────────────┐
│ CONSUMERS                                                  │
│ Python script · Telegram bot · Website · Node.js service   │
└────────────────────────────────────────────────────────────┘
                            ↑
┌────────────────────────────────────────────────────────────┐
│ HOSTS                                                      │
│ Designer (interactive)     ·     Renderer (headless)       │
└────────────────────────────────────────────────────────────┘
                            ↑
┌────────────────────────────────────────────────────────────┐
│ CORE ENGINES                                               │
│ paper-renderer.js  ·  mermaid-sketch.js  ·  pagination.js  │
│                  preset-loader.js  ·  utils/               │
└────────────────────────────────────────────────────────────┘
                            ↑
┌────────────────────────────────────────────────────────────┐
│ PRESETS (JSON, version-controlled)                         │
│ presets/blue-bic.json · pencil-grid.json · journal.json    │
└────────────────────────────────────────────────────────────┘
```

### 4.2 File and folder structure (final state)

```
notebook-renderer/
├── README.md
├── NOTEBOOK_RENDERER_PLAN.md          ← this file
├── package.json                       ← for npm publishing (optional)
├── LICENSE
│
├── core/                              ← pure JS engines, no DOM UI
│   ├── paper-renderer.js              ← Paper engine
│   ├── mermaid-sketch.js              ← Sketch engine
│   ├── pagination.js                  ← Page splitting logic
│   ├── preset-loader.js               ← Validate, extend, resolve presets
│   └── utils/
│       ├── color.js                   ← Color parsing/conversion
│       ├── svg.js                     ← SVG bbox/viewBox helpers
│       ├── ready.js                   ← Deterministic "render done" signal
│       └── seed.js                    ← Seeded RNG wrappers
│
├── vendor/                            ← Self-hosted CDN libraries
│   ├── mermaid.min.js                 ← v11.x pinned
│   ├── rough.min.js                   ← v4.6.6 pinned
│   ├── marked.min.js                  ← pinned
│   ├── katex/                         ← KaTeX dist + fonts
│   └── fonts/                         ← woff2 files for all used fonts
│
├── presets/
│   ├── README.md                      ← How to write a preset
│   ├── schema.json                    ← JSON Schema for validation
│   ├── _base.json                     ← Base preset (everything extends this)
│   ├── blue-bic.json                  ← Classic blue ballpen + ruled paper
│   ├── pencil-grid.json               ← Graphite pencil + grid paper
│   ├── journal-warm.json              ← Warm-tone journal aesthetic
│   ├── pastel-soft.json               ← Soft pastel palette
│   └── bold-ink.json                  ← Bold/vibrant inks
│
├── hosts/
│   ├── designer.html                  ← The playground, refactored
│   ├── designer.css
│   ├── designer.js                    ← Just the UI controller
│   ├── renderer.html                  ← Headless, no UI
│   └── renderer.js                    ← Awaitable entry point
│
├── python/
│   ├── notebook_renderer/
│   │   ├── __init__.py
│   │   ├── renderer.py                ← Playwright wrapper
│   │   ├── presets.py                 ← Preset discovery
│   │   └── _assets/                   ← Copy of hosts/ + core/ + vendor/
│   ├── setup.py
│   ├── pyproject.toml
│   ├── README.md
│   └── tests/
│
├── examples/
│   ├── sample.md                      ← Existing demo content
│   ├── python_telegram_bot.py
│   ├── python_cli.py
│   └── website_embed/
│       ├── index.html
│       └── embed.js
│
└── tests/
    ├── visual/                        ← Reference PNGs + diff runner
    └── unit/                          ← JS unit tests
```

### 4.3 Data flow

**Designer mode:**
```
User adjusts slider → Designer UI writes to in-memory preset object
                    → Engines re-render with new preset
                    → User clicks "Save" → preset.json written to disk/localStorage
```

**Headless mode (Python or build script):**
```
Python: renderer.render_markdown(md, preset="blue-bic")
   ↓
Playwright launches Chromium, navigates to hosts/renderer.html
   ↓
page.evaluate('window.PaperRenderer.render({markdown, preset})')
   ↓
Engine awaits: fonts.ready, all mermaid renders, KaTeX, snap pass
   ↓
window.__renderReady = true
   ↓
Playwright detects flag, screenshots each .page element
   ↓
Returns list of PNG bytes to Python
```

**Website client-side:**
```
Website imports core/*.js as ES modules
   ↓
On page load: PaperRenderer.render({markdown, preset: 'blue-bic', target: '#diagram'})
   ↓
Engine renders directly into the user's DOM
```

**Website server-side:**
```
Web request → Node.js or Python service → same headless flow as above
           → Returns image as HTTP response (Cache-Control: long)
```

---

## 5. Preset Schema (Canonical Format)

This is the most important contract in the project. Get it right; everything else follows.

### 5.1 Top-level shape

```json
{
  "name": "blue-bic",
  "version": 1,
  "description": "Classic blue ballpen on ruled notebook paper",
  "extends": "_base",
  "paper": { ... },
  "sketch": { ... },
  "pagination": { ... },
  "mermaid": { ... },
  "math": { ... }
}
```

### 5.2 Required fields

- `name` (string) — Unique identifier. Lowercase, hyphenated. Used as the filename.
- `version` (integer) — Schema version. Currently `1`.

### 5.3 Optional fields

#### `extends` (string)

Name of another preset to inherit from. Deep-merge: child fields override parent fields. Use `_base` as the root of inheritance chains. Resolution is recursive; cycles are an error.

Example:

```json
{
  "name": "blue-bic-large",
  "extends": "blue-bic",
  "paper": { "fontSize": 32, "gridSize": 40 }
}
```

#### `paper` (object) — Paper Engine settings

```json
{
  "background": "#fdf6e3",
  "lineColor": "#b5d8f6",
  "marginColor": "#ff8c8c",
  "deskColor": "#1a1a1a",

  "gridSize": 32,
  "fontSize": 26,
  "verticalOffset": 6,
  "noise": 0.06,

  "fontFamily": "'Caveat', 'Amiri', cursive",
  "monoFontFamily": "'Fira Code', monospace",

  "showRuledLines": true,
  "showMarginLine": true,
  "showHoles": true,
  "showNoise": true,

  "inks": {
    "default":  "#000080",
    "strong":   "#b30000",
    "em":       "#006600",
    "code":     "#222222",
    "heading":  "#222222",
    "link":     "#000080"
  },

  "padding": {
    "left":   100,
    "right":  40,
    "top":    6,
    "bottom": 100
  },

  "maxWidth": 900,
  "borderRadius": "4px 12px 12px 4px"
}
```

#### `sketch` (object) — Sketch Engine settings

Mirror the existing `ThemeConfig` shape from the playground. Every key from `ThemeConfig` becomes a key in `sketch`:

```json
{
  "enabled": true,
  "mermaidTheme": "default",
  "pieLabelsOutside": true,

  "handFont": true,
  "fontFamily": "'Caveat', cursive",
  "fontScale": 1.15,

  "strokeColor": "#1a47b8",
  "forceStroke": true,

  "outRoughness": 0.5,
  "outBowing": 3.0,
  "strokeWidth": 1.6,
  "outWobbleAmp": 2.0,
  "outWobbleFreq": 0.04,
  "outlineTexture": "ballpen",
  "outGrain": 0.60,
  "outBlur": 0.0,

  "hachure": true,
  "fillStyle": "hachure",
  "hatRoughness": 2.0,
  "hatBowing": 3.6,
  "hachureGap": 5.0,
  "fillWeight": 2.3,
  "hachureAngle": -41,
  "fillOpacity": 1.0,
  "fillJitter": 0.95,
  "bleed": true,
  "bleedAmount": 10.0,
  "edgeJitter": 3.0,
  "hatchTexture": "pencil",
  "hatGrain": 1.0,
  "hatBlur": 0.0,

  "xychartLabelAngle": 0,

  "ghostLines": true,
  "ghostCount": 1,
  "ghostOpacity": 0.61,
  "ghostOffset": 2.6,
  "ghostRoughness": 0.6,
  "ghostBowing": 3.0,
  "ghostWidth": 0.5,
  "ghostTexture": "pencil",
  "ghostGrain": 1.25,
  "ghostBlur": 0.0,

  "ganttBarInflate": 0.35,

  "autoColor": true,
  "palette": "ballpen",

  "seed": 1234
}
```

The `seed` field is new. It's the master RNG seed; all per-shape seeds derive from it deterministically.

#### `pagination` (object)

```json
{
  "enabled": false,
  "size": "A4",
  "orientation": "portrait",
  "customSize": null,
  "marginsMm": { "top": 20, "right": 20, "bottom": 20, "left": 20 },
  "blockBehavior": {
    "mermaid": "scale-to-fit",
    "table":   "avoid-break",
    "code":    "avoid-break",
    "heading": "keep-with-next"
  }
}
```

Page size presets (resolved by the loader to pixel dimensions at 96dpi):

| `size`       | Width  | Height | Use case |
|--------------|--------|--------|----------|
| `A4`         | 794    | 1123   | Print, PDF export |
| `A5`         | 559    | 794    | Half-size print |
| `Letter`     | 816    | 1056   | US paper |
| `phone`      | 412    | 915    | Telegram, mobile |
| `phone-tall` | 412    | 1830   | Long phone screenshots |
| `square`     | 1080   | 1080   | Social media |
| `custom`     | —      | —      | Use `customSize: {width, height}` |

**Critical:** the loader **adjusts the page height to be a multiple of `paper.gridSize` plus `paper.verticalOffset`** so ruled lines align across pages. A 1123px A4 with grid=32 and offset=6 becomes 1126px (35 grid lines + 6 offset). Document this clearly.

#### `mermaid` (object) — Mermaid initialization overrides

```json
{
  "theme": "default",
  "securityLevel": "loose",
  "fontFamily": "'Caveat', cursive",
  "flowchart": { "curve": "basis" },
  "sequence":  { "mirrorActors": false }
}
```

These pass through to `mermaid.initialize`. Sketch Engine settings already cover most theming, but some Mermaid behavior (e.g. flowchart curve type) is only configurable here.

#### `math` (object) — KaTeX settings

```json
{
  "engine": "katex",
  "throwOnError": false,
  "displayMode": true,
  "color": "#222222"
}
```

### 5.4 Inheritance and validation rules

1. **Default chain:** every preset implicitly extends `_base` unless `extends: null` is explicitly set.
2. **Deep merge:** child fields override parent fields key by key. Arrays are *replaced*, not merged.
3. **Cycle detection:** A → B → A is an error.
4. **Missing parent:** error at load time, not at render time.
5. **Cross-references:** if `paper.mermaidPreset: "ballpen-classic"` is set, the loader resolves it and applies the named Sketch preset on top of the inline `sketch` block. If the named preset doesn't exist, error at load time.
6. **Validation:** every preset is validated against `presets/schema.json` (JSON Schema Draft 2020-12). Reject on first error with a clear message.

### 5.5 The `_base` preset

`_base.json` defines every field with sensible defaults. It is the only preset that has no `extends`. All other presets only specify the fields they want to change. This keeps preset files small and readable.

---

## 6. Module Specifications

Each module gets its own file with one clear purpose. Junior devs: read this section before writing any code.

### 6.1 `core/paper-renderer.js`

**Purpose:** Take Markdown + a preset, produce a styled DOM tree.

**Exports:**
```js
export const PaperRenderer = {
  // Main entry point. Async. Resolves when fully rendered + snapped.
  async render({
    markdown,         // string, required
    target,           // DOM element OR selector OR null (renderer creates one)
    preset,           // preset name OR preset object, required
    plugins,          // { mermaid?: {engine, preset}, math?: {engine, ...} }
    pagination,       // optional pagination override
    debounce          // ms; default 0 in headless, 80 in interactive
  }) { /* ... */ },

  // Apply only the CSS variables (no markdown parsing). Used by Designer.
  applyPaperStyles(preset, targetEl) { /* ... */ },
};
```

**Behavior:**
1. Resolve the preset (via `preset-loader`).
2. Apply CSS variables to the target's host element.
3. Parse markdown with Marked.js (`gfm: true, breaks: true`).
4. Inject HTML into target.
5. For each `<code class="language-mermaid">`:
   - If `plugins.mermaid` is provided, call it.
   - Else fall back to vanilla Mermaid with current handDrawn theme.
   - Else leave as `<pre><code>`.
6. For each `<code class="language-math">` and `$$...$$` blocks: render with KaTeX.
7. Set `dir="auto"` on block elements for RTL.
8. `await document.fonts.ready`.
9. Run grid-snap pass on all top-level elements.
10. If `pagination.enabled`, hand off to `pagination.js`.
11. Set `window.__renderReady = true` and dispatch `notebook:ready` event.

**Dependencies:** Marked.js, preset-loader, pagination, utils/svg, utils/ready.

**No DOM-UI logic.** No sliders, no buttons. Just the rendering function.

### 6.2 `core/mermaid-sketch.js`

**Purpose:** Render Mermaid code to an SVG, then post-process with Rough.js.

**Exports:**
```js
export const MermaidSketch = {
  // Async. Renders + post-processes. Returns the SVG element.
  async render({
    code,             // string, required
    target,           // DOM element to render into
    preset,           // preset name OR preset object OR just the sketch sub-object
    seed              // optional override
  }) { /* ... */ },

  // Process an already-rendered SVG. Used when Mermaid is rendered elsewhere.
  process(svgEl, sketchConfig, displayScale = 1) { /* ... */ },

  // Initialize Mermaid. Idempotent.
  initMermaid(config) { /* ... */ },
};

// For convenience, also export the sub-engines as testable units:
export { PieLabelEngine, XYChartLabelEngine, SvgViewBoxUtil, Palettes };
```

**Behavior of `process`:**
- Take an SVG and a sketch config object.
- Walk every `rect`, `circle`, `ellipse`, `polygon`, `line`, `path` in the SVG.
- For each: draw ghost layer (behind), hachure fill (if enabled), outline (with RoughJS), arrow markers if applicable.
- Apply hand-drawn font and white text-halo to all text.
- Special handlers: Gantt section bars, Mindmap root, Pie labels, XY chart label rotation.
- Pad the viewBox so text/sketches don't clip.

**Refactored from the current playground**, with these changes:
- All RNG seeded from `sketchConfig.seed`.
- No global side effects (no `window.mermaid = ...`).
- `mermaid.initialize` only called from `initMermaid`, which is idempotent.
- Renamed `Presets` (diagram samples) to `Examples` to free up the word.

### 6.3 `core/pagination.js`

**Purpose:** Take a fully-rendered, snapped `.content` div and split it into `.page` containers.

**Exports:**
```js
export const Pagination = {
  apply(contentEl, paginationConfig, paperConfig) {
    // Walks contentEl's children, packs them into pages.
    // Returns array of created page elements.
  },
};
```

**Algorithm:**
1. Compute target page height: `floor((pageSize.height - margins) / gridSize) * gridSize + verticalOffset`.
2. Create page 1. Move children one by one until next child would overflow.
3. Apply per-block-type rules:
   - `mermaid`, `image`, `pre/code`, `table`, `blockquote`, `katex-display`: never split. If too big for remaining space, start new page.
   - If element is taller than a full page: scale-to-fit (for diagrams/images) OR allow overflow with warning (for code/tables — configurable).
   - Headings: keep-with-next. Never the last element on a page.
   - Paragraphs: allowed to split between lines. Use CSS `break-inside: auto`.
4. Each page gets its own `.paper` background, margin, holes, ruled lines.
5. Number pages via `data-page` attribute.

**Pagination runs *after* the snap pass, never before.** The snap pass rounds heights to grid multiples; pagination needs final heights to make correct break decisions.

### 6.4 `core/preset-loader.js`

**Purpose:** Load, validate, resolve, and merge presets.

**Exports:**
```js
export const PresetLoader = {
  async load(nameOrObject, presetIndex) { /* ... */ },
  validate(preset) { /* ... */ },
  resolve(preset, presetIndex) { /* deep-merge inheritance chain */ },
  diff(presetA, presetB) { /* for Designer: show what changed */ },
};
```

`presetIndex` is a `Map<string, Preset>` populated at startup by scanning `presets/*.json`. In the browser, this is loaded via `fetch`. In the Designer, it also includes localStorage user presets.

### 6.5 `core/utils/`

Small, focused helpers. No one util file is over ~200 lines.

- `color.js` — `parseColor`, `rgbToHsl`, `classifyColor`, `lighten`, `darken`. Extracted from the SketchEngine internals.
- `svg.js` — `getBBox`, `tightenViewBox`, `padViewBox`. Extracted from `SvgViewBoxUtil`.
- `ready.js` — `awaitFonts()`, `awaitImages()`, `signalReady()`. The deterministic ready signal.
- `seed.js` — Seeded PRNG (mulberry32 or similar). All consumers use this instead of `Math.random()`.

### 6.6 `hosts/designer.html` + `designer.js`

**Purpose:** Visual preset authoring tool. The current playground, refactored.

**Layout:** Same three-pane structure as the existing playground.
- Left sidebar: tabs (Editor / Presets / Theme / Paper / Pagination).
- Center: live preview of paper with sample content.
- Right: collapsible details panel (per-block info, current preset diff).

**Features beyond the current playground:**
- Save preset (writes JSON to localStorage + offers download).
- Load preset (file picker, paste JSON, or pick from list).
- Duplicate preset.
- Reset to base.
- Export all user presets as a single .zip.
- Switch between Paper-only / Sketch-only / Combined preview modes.

**Imports** the engines from `core/`. Does no rendering itself.

### 6.7 `hosts/renderer.html` + `renderer.js`

**Purpose:** Headless rendering target. No UI.

**Behavior:**
- Empty body except for a `<div id="render-root">`.
- On load, exposes `window.PaperRenderer.render(...)` and `window.MermaidSketch.render(...)`.
- Accepts input three ways:
  1. URL params: `?content=<base64-md>&preset=<name>`
  2. `postMessage` from parent window.
  3. Caller sets `window.NOTEBOOK_INPUT = {...}` and calls `window.PaperRenderer.render(window.NOTEBOOK_INPUT)`.
- Sets `window.__renderReady = true` when complete.
- Dispatches `notebook:ready` event.

### 6.8 `python/notebook_renderer/`

**Purpose:** Pythonic API over the headless renderer.

**Public API:**
```python
from notebook_renderer import Renderer, render_markdown, render_diagram

# One-shot helpers (creates and disposes a Renderer per call)
png = render_markdown(markdown, preset="blue-bic", pagination=None)
png = render_diagram(mermaid_code, preset="ballpen-classic", format="png")

# Long-running renderer (reuses the browser across calls)
with Renderer() as r:
    for doc in many_documents:
        r.render_markdown(doc.text, preset=doc.preset)
```

**Implementation:**
- Uses Playwright (sync API) with bundled Chromium.
- Ships the entire `core/`, `hosts/`, `vendor/`, `presets/` tree inside the Python package under `_assets/`.
- `Renderer.__init__` launches Chromium, navigates to `_assets/hosts/renderer.html` via `file://`.
- `render_markdown` does `page.evaluate('window.PaperRenderer.render(...)')` and `page.wait_for_function('window.__renderReady === true')`.
- Screenshots each `.page` element (or the whole `#render-root` if no pagination).
- Returns `bytes` (single) or `list[bytes]` (paginated).

**Dependencies:** `playwright`, `Pillow` (for optional post-processing).

---

## 7. Implementation Phases

Eight phases, each independently shippable. Don't skip ahead.

### Phase 0 — Preparation (½ day)

**Goal:** Project skeleton in place. Existing code preserved.

**Tasks:**
1. Create the directory structure from §4.2.
2. Move `Paper-Renderer.html` to `examples/legacy/paper-renderer-original.html`.
3. Move `Mermaid-Engine-Playground.Html` to `examples/legacy/mermaid-playground-original.html`.
4. Create empty stub files for every file in §4.2 with a one-line header comment describing its purpose.
5. Initialize `package.json` (even if just for npm name + deps list).
6. Set up basic linting (ESLint, Prettier) and an editor config.

**Acceptance:**
- Directory tree matches §4.2.
- Linter runs (even if no real code yet).
- Original files still openable for reference.

---

### Phase 1 — Preset Schema (1 day)

**Goal:** The canonical JSON contract exists and is validated.

**Tasks:**
1. Write `presets/schema.json` — JSON Schema Draft 2020-12 for the format in §5.
2. Write `presets/_base.json` — every field with documented defaults. Extract values from the existing `ThemeConfig` and Paper Renderer CSS.
3. Write 3 example presets:
   - `presets/blue-bic.json` — Mirror the existing Paper Renderer aesthetic. Blue ballpen.
   - `presets/pencil-grid.json` — Pencil texture, gray palette, grid paper background.
   - `presets/journal-warm.json` — Warm tones, cursive font, no margin line.
4. Write `core/preset-loader.js`:
   - `load(name)` — fetch + parse + validate.
   - `resolve(preset, index)` — walk `extends` chain, deep-merge.
   - `validate(preset)` — run against schema.
5. Unit-test with Vitest or similar:
   - Validation rejects malformed presets with clear error messages.
   - Inheritance: `pencil-grid` extends `_base`, all defaults present after resolve.
   - Cycle detection: A extends B, B extends A → throws.
   - Missing parent: throws at load.

**Acceptance:**
- `PresetLoader.load('blue-bic')` returns a fully-resolved preset object.
- Schema rejects `{name: "foo"}` (missing version), `{version: 1}` (missing name), etc.
- All three example presets validate successfully.
- Test coverage on the loader is ≥90%.

**Documentation deliverable:** `presets/README.md` explains the schema with examples. A junior dev should be able to write a new preset by reading this file alone.

---

### Phase 2 — Engine Extraction (2 days)

**Goal:** Engines work as ES modules, independent of any UI.

**Tasks:**
1. Extract from `Mermaid-Engine-Playground.Html` into `core/mermaid-sketch.js`:
   - `SketchEngine` → main object, methods unchanged but operate on a passed-in config instead of the global `ThemeConfig`.
   - `Palettes` → exported.
   - `PieLabelEngine`, `XYChartLabelEngine`, `SvgViewBoxUtil` → exported.
   - `MermaidBridge` → renamed to internal `_mermaid` helpers, exposed via `MermaidSketch.render` and `MermaidSketch.initMermaid`.
2. Rename `Presets` (diagram code samples) to `Examples` and move to `examples/diagrams.js` (only used by the Designer).
3. Replace every `Math.random()` in the rendering path with seeded calls via `utils/seed.js`. Document each replacement with a comment.
4. Extract from `Paper-Renderer.html` into `core/paper-renderer.js`:
   - Marked.js wiring.
   - Mermaid + KaTeX block detection.
   - Grid-snap logic (the ResizeObserver + `snapElement` function).
   - RTL auto-direction.
5. In Paper Renderer:
   - Remove the inline `mermaid.initialize` call entirely.
   - Replace `setTimeout(300)` with `await document.fonts.ready` plus explicit `await` on all Mermaid render promises.
   - Make `applyPaperStyles(preset, targetEl)` set CSS variables from the preset.
6. Write `core/utils/ready.js`: `awaitFonts()`, `awaitImages()`, `signalReady()` with the global flag + event.
7. Smoke test by hand: create a temporary HTML file that imports both engines and renders the existing `sample.md`. Visual output should match the original (modulo intentional improvements).

**Acceptance:**
- `core/paper-renderer.js` and `core/mermaid-sketch.js` are pure JS modules. No top-level DOM queries, no `document.addEventListener` outside exported functions.
- Engines can be imported and called from a fresh HTML file with nothing but `<script type="module">`.
- Running `MermaidSketch.render({code, target, preset})` twice with the same seed produces byte-identical output (test with `outerHTML` comparison or canvas readback).
- No `Math.random()` calls remain in the rendering path (grep proves it).
- `setTimeout(300)` is gone from `paper-renderer.js`.

---

### Phase 3 — Plugin Hook Architecture (½ day)

**Goal:** Paper engine cleanly delegates Mermaid to the Sketch engine (or skips it).

**Tasks:**
1. Add the `plugins` parameter to `PaperRenderer.render`:
   ```js
   PaperRenderer.render({
     markdown,
     target,
     preset: 'blue-bic',
     plugins: {
       mermaid: { engine: MermaidSketch, preset: 'ballpen-classic' },
       math:    { engine: 'katex' }
     }
   });
   ```
2. Inside Paper Renderer's mermaid block handler:
   - If `plugins.mermaid` is provided, call `plugins.mermaid.engine.render({code, target, preset: plugins.mermaid.preset})`.
   - If not, fall back to vanilla Mermaid with the preset's `mermaid` block.
   - If `plugins.mermaid: null` is explicitly passed, leave the fence as `<pre><code>`.
3. Support `paper.mermaidPreset` as a shortcut: if the resolved Paper preset has `paper.mermaidPreset`, set up the plugin automatically.
4. Smoke test: render `sample.md` once with plugin, once without. Compare visually.

**Acceptance:**
- Three modes work: plugin enabled, plugin disabled (vanilla mermaid), plugin null (no mermaid).
- A Paper preset can reference a Sketch preset by name and it Just Works.
- Removing the `mermaid-sketch.js` import from the page (Paper-only mode) still renders prose correctly; mermaid fences fall back gracefully.

---

### Phase 4 — Headless Renderer (1 day)

**Goal:** A no-UI HTML page Python can drive.

**Tasks:**
1. Create `hosts/renderer.html`:
   - Empty body except `<div id="render-root"></div>`.
   - Loads `core/paper-renderer.js`, `core/mermaid-sketch.js` as modules.
   - Loads all CDN libs from `vendor/`, not from CDNs.
2. Create `hosts/renderer.js`:
   - Reads input from URL params, postMessage, or `window.NOTEBOOK_INPUT`.
   - Calls `PaperRenderer.render({markdown, target: '#render-root', preset, plugins})`.
   - Awaits render completion, then sets `window.__renderReady = true` and dispatches `notebook:ready`.
3. Test manually by:
   - Opening `renderer.html?content=base64(...)&preset=blue-bic` in a browser.
   - Verifying `window.__renderReady` flips to `true` after render.
   - Verifying the DOM matches what the Designer would produce.
4. Add a tiny test HTML that uses postMessage to feed content (no URL encoding needed for large markdown).

**Acceptance:**
- `renderer.html` works from `file://`, `http://localhost`, and `https://`.
- `window.__renderReady` is reliably `true` after every input — no timing flakes across 50 consecutive renders.
- Page has no visible UI, no scrollbars, no console errors.
- Total page load + first render < 2s for a 2-page document on commodity hardware.

---

### Phase 5 — Designer Refactor (2-3 days)

**Goal:** The existing playground, cleaned up, now reads/writes presets.

**Tasks:**
1. Create `hosts/designer.html` — single-file, but imports `core/*` as modules and `designer.js` for the UI controller.
2. Migrate the existing playground's controls into `designer.js`:
   - Slider bindings → write into in-memory preset object, then call `PaperRenderer.applyPaperStyles` and `MermaidSketch.process` to re-render.
   - Preset chips → now load from the preset library (built-in + localStorage).
   - Add "Save as…", "Load…", "Duplicate", "Reset", "Export JSON", "Import JSON" buttons.
3. Add a Paper-config tab (mirroring the existing Sketch-config tab). Sliders for grid size, font size, offset, ink colors, etc.
4. Add a Pagination tab. Toggle, page size dropdown, margin inputs.
5. Add a Live Diff panel (collapsible): shows the JSON delta between the current state and the base preset.
6. Add a "Mode" switcher: Paper-only / Sketch-only / Combined.
7. Refactor as you go — strip dead code, replace duplicated event-listener setup with a helper, kill magic numbers.

**Acceptance:**
- Every existing playground control still works.
- "Save" creates a JSON file that round-trips: loading it back reproduces the visual exactly.
- The three example presets from Phase 1 load correctly.
- Mode switcher hides irrelevant tabs cleanly.

---

### Phase 6 — Pagination (2-3 days)

**Goal:** Multi-page output with no broken layouts.

**Tasks:**
1. Implement `core/pagination.js` per §6.3.
2. Define page size constants in one place (a `PAGE_SIZES` object in pagination.js).
3. Implement page-height-multiple-of-grid adjustment.
4. Implement block behavior rules: avoid-break, keep-with-next, scale-to-fit.
5. Handle the "block taller than a page" edge case explicitly:
   - Mermaid/image: auto-scale-down to fit, preserve aspect ratio.
   - Code block: allow overflow with `console.warn`. Document the per-block escape hatch (`data-overflow="allow"`).
6. Each generated `.page` element gets:
   - Fixed `width × height` from preset.
   - Same paper background, ruled lines, holes, margin.
   - Position relative; pages stack vertically with a gap (so screenshots can target each independently).
7. Test cases:
   - 1-paragraph doc → 1 page.
   - 10-page-worth of paragraphs → 10 pages, ruled lines align.
   - Doc with 5 mermaid diagrams → each diagram appears whole on some page.
   - Doc with a giant table → behavior matches the configured rule.
   - Edge: heading at bottom of page → moved to top of next page.

**Acceptance:**
- All test cases produce correct output (verify by visual inspection of generated PNGs).
- Re-running pagination on the same doc produces identical page boundaries (deterministic).
- Ruled lines on page N align with ruled lines on page N+1 (no half-pixel drift).

---

### Phase 7 — Python Wrapper (1-2 days)

**Goal:** `pip install notebook-renderer` works; the example Telegram bot script runs.

**Tasks:**
1. Set up `python/pyproject.toml` with Playwright as a dependency.
2. Write `python/notebook_renderer/renderer.py` with the `Renderer` class:
   - Launches Chromium via Playwright on `__enter__`.
   - Navigates to bundled `renderer.html`.
   - `render_markdown(md, preset, pagination=None)` sets `window.NOTEBOOK_INPUT`, calls render, waits for ready, screenshots.
   - `render_diagram(code, preset, format='png')` similar but uses `MermaidSketch.render`.
   - Disposes on `__exit__`.
3. Write `__init__.py` that exposes one-shot helpers `render_markdown` and `render_diagram`.
4. Bundle the entire `core/`, `hosts/`, `vendor/`, `presets/` tree under `python/notebook_renderer/_assets/` using `package_data` in `setup.py`.
5. Write `python/notebook_renderer/presets.py`:
   - `list_presets()` → names of all bundled presets.
   - `get_preset(name)` → parsed dict.
   - `register_preset(json_dict)` → register a runtime preset (passed inline, not from disk).
6. Write tests in `python/tests/`:
   - Smoke: `render_markdown("hello")` returns PNG bytes that decode as valid PNG.
   - Determinism: same input twice → same hash.
   - Pagination: 5-page doc returns list of 5 PNGs.
   - Diagram: `render_diagram("flowchart TD\nA-->B")` returns valid PNG.
7. Write `examples/python_telegram_bot.py` — minimal aiogram bot that uses the renderer.

**Acceptance:**
- `pip install -e python/` succeeds.
- `python -m notebook_renderer.tests` passes.
- Telegram bot example runs end-to-end with a real bot token.
- Cold start (first render) < 3s. Warm render (reusing `Renderer`) < 500ms for a 1-page document.

---

### Phase 8 — Polish, CDN-bundling, Documentation (1-2 days)

**Goal:** Production-ready release.

**Tasks:**
1. Self-host vendor libraries:
   - Download Mermaid v11.x.x → `vendor/mermaid.min.js`.
   - Download RoughJS 4.6.6 → `vendor/rough.min.js`.
   - Download Marked → `vendor/marked.min.js`.
   - Download KaTeX dist + fonts → `vendor/katex/`.
   - Self-host all Google Fonts as woff2 in `vendor/fonts/` with a `vendor/fonts/fonts.css` that defines `@font-face`.
2. Update every HTML host to load from `vendor/` instead of CDNs. Provide a `?cdn=1` query param for development that flips back to CDN (faster page reloads when developing).
3. Write `README.md` at the project root:
   - 5-line elevator pitch.
   - Quickstart for each consumer (Python, browser direct, browser server-rendered).
   - Link to this plan, the schema docs, and the API reference.
4. Write `python/README.md` with the Python-specific API and examples.
5. Write `examples/website_embed/` with a working static site demo.
6. Generate API reference for `core/*.js` using JSDoc.
7. Tag a v0.1.0 release.

**Acceptance:**
- Pulling the repo and running `npm install` (if applicable) + `python -m http.server` works with no network access.
- README quickstart for each consumer works on a fresh machine in under 5 minutes.
- Total bundle size of `vendor/` is documented and under 5 MB.

---

## 8. Refactoring Checklist

Things to fix while you're in there. Junior devs: don't bring these across to the new code.

### From `Paper-Renderer.html`

- [ ] **Remove `setTimeout(300)` before snapping.** Replace with proper promise awaits.
- [ ] **Remove inline `mermaid.initialize`.** Move to the engine module.
- [ ] **Hard-coded `fetch('sample.md')`.** Replace with the three input modes from §6.7.
- [ ] **`document.documentElement` queries inside the render function.** Pass target element explicitly.
- [ ] **Three duplicate slider event listeners.** Replace with a single helper:
  ```js
  function bindSlider(id, varName, suffix='') {
    const el = document.getElementById(id);
    el.addEventListener('input', e => root.style.setProperty(varName, e.target.value + suffix));
  }
  ```
- [ ] **`marked.use({...})` called inside the render function.** Move to module init; configure once.
- [ ] **`forceRecalculation` and `startObserving` defined inline.** Extract to named functions in the snap module.
- [ ] **CSS variables defined in `:root`.** They should be settable per-paper, not global. Use `.paper { ... }` selector with the variable definitions.

### From `Mermaid-Engine-Playground.Html`

- [ ] **`Presets` named misleadingly.** Rename diagram code library to `Examples`.
- [ ] **`Math.random()` in filter seed generation** (search for `seed: Math.floor(Math.random() * 99)`). Replace with seeded RNG.
- [ ] **`Math.random()` in ghost offset jitter.** Same fix.
- [ ] **`window.mermaid = mermaid` global pollution.** Remove. Engines export their bridge.
- [ ] **`_renderTimer` setTimeout debounce.** Make configurable per-call (0 for headless).
- [ ] **`ThemeConfig` has methods (`buildOutlineOpts`, `buildHachureOpts`) mixed with data.** Move methods to the engine; keep the config as pure data so it serializes cleanly to JSON.
- [ ] **`forceStroke` is declared twice** (lines ~834 and ~885 of the original). Remove the duplicate.
- [ ] **`@deprecated _hslOf` helper.** Either remove or migrate the one caller.
- [ ] **DOM cache (`this.els`) is on the Playground.** Should not exist in the engine at all. Move entirely to `designer.js`.
- [ ] **`SvgViewBoxUtil.tightenToVisibleContent` is called from XYChartLabelEngine.** That's a layering violation; XYChart shouldn't reach into a generic utility's internals. Either expose a public method or duplicate the small bit needed.
- [ ] **Mindmap "two-pass force clear"** suggests the first pass is incomplete. Investigate and fix the root cause, then remove the second pass.

### Cross-cutting

- [ ] **Inconsistent quoting.** Pick single or double quotes; let Prettier enforce.
- [ ] **Mix of `var`, `let`, `const`.** Use `const` by default, `let` when reassigning, never `var`.
- [ ] **Magic numbers everywhere** (`80px` for margin line, `1.6` for h1 size, etc.). Extract to named constants.
- [ ] **No JSDoc on public functions.** Add `/** @param ... */` blocks on every exported function.
- [ ] **No error boundaries.** Wrap engine entry points in try/catch and surface errors via a structured `{ok: false, error}` return + console error.

---

## 9. Testing & Verification

### 9.1 Unit tests (JS)

Per module. Use Vitest or Jest. Target: ≥80% coverage on `core/`.

- `preset-loader.test.js` — validation, inheritance, cycle detection, missing-parent.
- `paper-renderer.test.js` — mock DOM (jsdom), feed markdown, assert structure.
- `mermaid-sketch.test.js` — feed a known SVG, assert post-processed structure has expected ghost/hachure/outline groups.
- `pagination.test.js` — feed a mock DOM with N children of known heights, assert correct page boundaries.
- `utils/seed.test.js` — same seed produces same sequence; different seeds produce different sequences.
- `utils/color.test.js` — color parsing edge cases (rgb, rgba, hex, hsl, named colors).

### 9.2 Visual regression tests

Maintain a small corpus of reference renders. Use Playwright + pixel-match.

Corpus:
- `sample.md` rendered with each example preset.
- Each Mermaid diagram type (Flowchart, Sequence, Class, ER, Pie, XY chart, Gantt, Mindmap, Journey, Quadrant, Block, Git) with the default sketch preset.
- A 3-page document with pagination.

Reference PNGs stored in `tests/visual/refs/`. On every CI run:
- Re-render with same seeds.
- Compare to references with `pixelmatch`, tolerance ≤0.1% pixel difference.
- On failure, dump the diff image to `tests/visual/diffs/`.

### 9.3 Python integration tests

Per `python/tests/`:

- `test_renderer.py`:
  - Basic render returns valid PNG bytes (PIL can open it).
  - Pagination returns the correct number of pages.
  - Determinism: two consecutive renders with same input produce same hash.
  - Cold start < 3s; warm render < 500ms (for a representative 1-page doc).
- `test_presets.py`:
  - All bundled presets are listed.
  - Loading each preset produces a valid render.
  - Inline preset registration works.

### 9.4 Manual smoke checks

Before tagging any release, manually verify:

- Open Designer → load each preset → adjust each slider → verify live preview updates.
- Open Designer → save a preset → reload page → load the saved preset → confirm visual match.
- Render `sample.md` with three different presets via Python → eyeball each PNG.
- Run the Telegram bot example end-to-end with a real bot.
- Embed the website example in a fresh HTML page → confirm identical output.

### 9.5 CI

Minimum CI pipeline (GitHub Actions or similar):
- Install Node + Python dependencies.
- Install Playwright browsers.
- Run lint.
- Run unit tests.
- Run visual regression tests.
- Run Python tests.

---

## 10. Risks & Gotchas

Documented here so a junior dev doesn't fall into the same traps we already see coming.

### 10.1 Font loading is the #1 source of flakes

If fonts aren't loaded when the snap pass measures elements, every block's height is wrong and the entire layout is off. Mitigation:
- Always `await document.fonts.ready` before the first snap.
- Listen for `document.fonts.fontschange` events and re-snap.
- In headless mode, preload all woff2 files explicitly with `<link rel="preload">`.
- Test: temporarily throttle fonts in dev tools, confirm the renderer still works.

### 10.2 Snap-pass and pagination order

Pagination must run **after** the snap pass, never before or interleaved. The snap pass changes element heights; pagination decisions made before snapping are wrong by construction. Document this clearly in the code with a comment + an `assert` that the snap pass has completed (e.g. a flag on the content element).

### 10.3 Deterministic output requires every seed pinned

- Per-shape RoughJS seeds: derive from `sketchConfig.seed + shapeIndex` (already structured this way, just enforce).
- SVG filter `<feTurbulence seed>`: currently `Math.floor(Math.random() * 99)` — replace with seeded value.
- Ghost offset jitter: replace `Math.random()` with seeded.
- Document the seed contract: same `seed` field → same pixel output (modulo browser rendering differences).

### 10.4 CDN dependencies will fail in production

Telegram bots run on VPSes with flaky outbound networking. Every external resource (fonts, scripts) is a failure mode. Self-host everything in `vendor/`. In dev, allow CDN mode (faster iteration). In production, refuse CDN mode.

### 10.5 Mermaid versions are not stable

Mermaid v11 ships breaking changes in minor versions. Pin to a specific patch version (`11.4.1`, not `11`). Run visual regression tests when bumping.

### 10.6 Headless Chrome renders fonts differently from your local browser

System font rendering varies. Test your reference presets in Playwright headless early, not just in the Designer. Don't tune visuals only in interactive mode; what looks right there may shift slightly in headless.

### 10.7 RTL text inside Mermaid SVGs

The Paper Renderer's `dir="auto"` trick works for HTML prose, but Mermaid lays out SVG text with absolute coordinates. Right-to-left languages in diagram labels need separate handling — either reverse the text in the input or use a Mermaid theme that supports RTL. Test with Farsi labels specifically.

### 10.8 Pagination + RTL + Tables

Three forces collide. v1: keep tables atomic (never split mid-page). RTL paragraphs split normally. Document the known interactions in the user guide.

### 10.9 LocalStorage is per-origin

User presets saved in the Designer on `file://` won't show up when the Designer is served from `http://localhost`. Export/Import JSON buttons are the migration path. Tell users in the Designer UI.

### 10.10 Playwright browser bundling

Playwright bundles its own Chromium. The Python package will be ~300 MB after `playwright install chromium`. Document this. Offer an optional "lite" mode that uses the system Chrome via `executable_path`.

### 10.11 Memory leaks in long-running renderers

If a user keeps a `Renderer()` open and renders thousands of documents, Mermaid's internal SVG ID counter grows and DOM nodes from previous renders may not be GC'd. Mitigation:
- Clear `#render-root` between renders.
- Reset `MermaidSketch._counter` periodically.
- Document a "restart every N renders" pattern for very long-running services.

---

## 11. Definition of Done

The project is "done" (v1.0) when **every** item below is true:

### Functional

- [ ] All eight phases complete.
- [ ] Python: `pip install notebook-renderer` works on Linux, macOS, Windows.
- [ ] Python: `render_markdown(md, preset='blue-bic')` returns a valid PNG in under 500ms warm.
- [ ] Python: pagination produces multiple PNGs that visually match the Designer preview.
- [ ] Designer: can author a preset from scratch, save it, reload it, render with it.
- [ ] Designer: can switch between Paper-only / Sketch-only / Combined modes.
- [ ] Website: embedding `<script type="module" src=".../paper-renderer.js">` and calling `PaperRenderer.render` produces identical output to the Python version.
- [ ] Standalone Sketch usage: `render_diagram(code, preset='ballpen-classic')` works without any Paper code present.
- [ ] Standalone Paper usage: `render_markdown(md, preset='blue-bic', plugins: {mermaid: null})` works without loading the Sketch engine at all.

### Quality

- [ ] Zero `Math.random()` in the rendering path (grep proves it).
- [ ] Zero `setTimeout` race conditions in the engines (grep + comment review).
- [ ] No CDN dependencies in the production build (`vendor/` contains everything).
- [ ] Lint passes with zero errors and zero warnings.
- [ ] Unit test coverage ≥80% on `core/`.
- [ ] Visual regression suite passes with 0% diff on the reference corpus.
- [ ] Python tests pass on the three OS targets in CI.

### Documentation

- [ ] `README.md` covers all three consumer types with working quickstarts.
- [ ] `presets/README.md` explains the schema with examples.
- [ ] `python/README.md` covers the Python API.
- [ ] Every exported function has JSDoc.
- [ ] The Telegram bot example runs end-to-end with documented setup.

### Repo hygiene

- [ ] Repo can be cloned + built + tested from a fresh machine in under 10 minutes.
- [ ] No dead code, no commented-out blocks, no `TODO` comments without a tracked issue.
- [ ] No file over 1,000 lines (except `vendor/`).
- [ ] Linter and formatter run on every commit (pre-commit hook).

---

## 12. Glossary

- **Paper Engine** — The renderer that lays markdown out on notebook-style paper. Defined in `core/paper-renderer.js`.
- **Sketch Engine** — The post-processor that turns Mermaid SVGs into hand-drawn-looking ones. Defined in `core/mermaid-sketch.js`. Sometimes called "Mermaid Engine" in legacy code.
- **Preset** — A versioned JSON object describing how to render. Contains paper, sketch, pagination, mermaid, and math sub-configurations. Stored in `presets/`.
- **Designer** — The interactive HTML page for authoring presets visually. Built on top of the engines.
- **Renderer** (capital R) — The headless HTML page used for programmatic rendering. Has no UI.
- **renderer** (lowercase) — Generic term, or the Python `Renderer` class.
- **Host** — An HTML page that uses the engines. Designer and Renderer are the two stock hosts; users can write their own.
- **Plugin** — An optional engine slotted into another engine's render pipeline. Currently: Sketch can plug into Paper for mermaid blocks; KaTeX/MathJax can plug into Paper for math blocks.
- **Snap pass** — The grid-alignment step in Paper Renderer that rounds every block's height to a multiple of the grid size.
- **Ghost lines** — In the Sketch Engine, faint duplicate outlines drawn behind shapes to mimic the "double-traced" look of hand-drawing.
- **Hachure** — Parallel-line shading used to fill shapes in the sketch style. Provided by RoughJS.
- **Bleed** — Extending hachure fills slightly past a shape's outline (clipped via SVG masks) to mimic how ink/pencil sometimes overflows the intended boundary.
- **`extends`** — The preset inheritance mechanism. A preset that has `"extends": "foo"` deep-merges its own fields on top of preset `foo`'s.
- **`_base`** — The root preset in the inheritance chain. Defines defaults for every field.

---

## Appendix A: API Quick Reference

### JavaScript (consumed by Designer, Renderer, websites)

```js
import { PaperRenderer } from './core/paper-renderer.js';
import { MermaidSketch } from './core/mermaid-sketch.js';
import { PresetLoader } from './core/preset-loader.js';

// Render markdown to a target element
await PaperRenderer.render({
  markdown:   '# Hello\n\nWorld.',
  target:     '#render-root',
  preset:     'blue-bic',
  plugins:    { mermaid: { engine: MermaidSketch, preset: 'ballpen-classic' } },
  pagination: { enabled: true, size: 'A4' }
});

// Render a single Mermaid diagram
await MermaidSketch.render({
  code:    'flowchart TD\nA-->B',
  target:  '#diagram',
  preset:  'ballpen-classic'
});

// Load a preset programmatically
const preset = await PresetLoader.load('blue-bic');
```

### Python (consumed by scripts, bots)

```python
from notebook_renderer import render_markdown, render_diagram, Renderer

# One-shot
png = render_markdown(md, preset='blue-bic')
png = render_diagram('flowchart TD\nA-->B', preset='ballpen-classic')
pages = render_markdown(md, preset='blue-bic', pagination='A4')

# Reusable
with Renderer() as r:
    for doc in docs:
        r.render_markdown(doc.md, preset=doc.preset)
```

---

## Appendix B: Recommended Reading

Before touching the code, skim these:

- The Mermaid v11 theming docs: https://mermaid.js.org/config/theming.html
- RoughJS API: https://github.com/rough-stuff/rough/wiki
- Marked.js options: https://marked.js.org/using_advanced
- KaTeX rendering API: https://katex.org/docs/api.html
- Playwright Python API: https://playwright.dev/python/docs/intro
- JSON Schema Draft 2020-12: https://json-schema.org/draft/2020-12/release-notes.html

---

**End of plan.**

When a phase is complete, mark its checkbox in §11 (Definition of Done) and commit. When all checkboxes are ticked, tag v1.0.
