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
│   │── pyproject.toml
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
  "marginLeft": 80,
  "holeSpacing": 96,
  "holeMargin": 15,
  "textureOpacity": 0.06,
  "fonts": {
    "primary": "Caveat",
    "fallback": "Amiri",
    "mono": "Fira Code",
    "sizes": {
      "h1": 1.6,
      "h2": 1.3,
      "h3": 1.1,
      "body": 1.0,
      "code": 0.6,
      "table": 0.9
    }
  },
  "ink": {
    "blue": "#000080",
    "red": "#b30000",
    "green": "#006600",
    "black": "#222222"
  },
  "semanticColors": {
    "body": "blue",
    "strong": "red",
    "em": "green",
    "code": "black",
    "link": "blue",
    "linkDecoration": "red"
  }
}
```

#### `sketch` (object) — Sketch Engine settings

This maps 1:1 from the existing `ThemeConfig` in `Mermaid-Engine-Playground.Html`. All ~40 properties go here.

```json
{
  "enabled": true,
  "seed": 42,
  "displayScale": 1,
  "roughness": 1.5,
  "fillStyle": "hachure",
  "fillWeight": 1.2,
  "hachureGap": 4,
  "hachureAngle": 135,
  "curveStepCount": 18,
  "curveTightness": 0.0,
  "curveFitting": 0.4,
  "baselineShift": -2.5,
  "ghostEnabled": true,
  "ghostOpacity": 0.12,
  "ghostOffsetX": [-1.2, 1.5],
  "ghostOffsetY": [-0.8, 1.0],
  "hachureBleed": 1.8,
  "strokeCap": "round",
  "strokeJoin": "round",
  "disableMultiColor": false,
  "palette": "ballpen",
  "paletteOverrides": {},
  "nodeColors": ["pie1", "pie2", "pie3", "pie4"],
  "forceClearMindmapRoot": false,
  "inflateGanttBars": true,
  "repositionPieLabels": true,
  "rotateXYLabels": true,
  "tightenViewBox": true,
  "pencilGrainFilter": true,
  "grainIntensity": 0.15
}
```

#### `pagination` (object)

```json
{
  "enabled": false,
  "format": "A4",
  "orientation": "portrait",
  "customWidth": null,
  "customHeight": null,
  "dpi": 150,
  "paddingTop": 40,
  "paddingBottom": 40,
  "paddingLeft": 40,
  "paddingRight": 40,
  "cutOverlap": 8
}
```

- `format`: `"A4"`, `"letter"`, `"phone"`, or `"custom"`.
- `cutOverlap`: pixels of overlap between pages to avoid cutting content in half.

#### `mermaid` (object)

Mermaid-specific config (separate from sketch styling).

```json
{
  "theme": "base",
  "themeVariables": {
    "background": "transparent",
    "fontFamily": "'Caveat', 'Amiri', cursive",
    "primaryColor": "rgba(0, 0, 128, 0.05)",
    "primaryBorderColor": "#000080",
    "lineColor": "#000080",
    "textColor": "#222222"
  },
  "startOnLoad": false
}
```

#### `math` (object)

KaTeX configuration.

```json
{
  "displayMode": true,
  "throwOnError": false,
  "leqno": false,
  "fleqn": false,
  "output": "html",
  "trust": false,
  "macros": {}
}
```

---

## 6. Module Specifications

### 6.1 `core/paper-renderer.js`

**Exports:** `PaperRenderer` class

**Constructor:**
```js
new PaperRenderer(preset, options?)
```

**Public methods:**
- `async render(markdown, targetElement)` — Renders markdown into target DOM element.
- `applyPreset(preset)` — Applies preset CSS variables and settings.
- `snapToGrid()` — Runs grid-snapping pass on all children.
- `getPages()` — If pagination enabled, returns array of page containers.

**Dependencies:** `preset-loader`, `mermaid-sketch` (optional), `utils/ready`, `utils/svg`

### 6.2 `core/mermaid-sketch.js`

**Exports:** `SketchEngine` class

**Constructor:**
```js
new SketchEngine(themeConfig)
```

**Public methods:**
- `process(svgElement)` — Post-processes an SVG in-place.
- `setTheme(config)` — Updates theme config.
- `static createDefaultTheme()` — Returns default theme object.

**Internal sub-modules (private):**
- `_renderGhostLines()`
- `_renderHachureFill()`
- `_applyPencilGrainFilter()`
- `_fixPieChart()`
- `_fixGanttChart()`
- `_fixXYChart()`
- `_fixMindmap()`

### 6.3 `core/pagination.js`

**Exports:** `PaginationEngine` class

**Constructor:**
```js
new PaginationEngine(config)
```

**Public methods:**
- `split(contentElement, pageSize)` → `[pageElements]`
- `getPageDimensions(format, orientation, dpi)` → `{width, height}`

### 6.4 `core/preset-loader.js`

**Exports:** `PresetLoader` class

**Public methods:**
- `static async load(nameOrPath)` — Loads preset from disk or URL.
- `static resolve(preset, presetRegistry)` — Resolves `extends` chain.
- `static validate(preset)` — Validates against schema.
- `static merge(base, override)` — Deep-merge two presets.

### 6.5 Utility modules

#### `core/utils/color.js`
- `parseColor(cssColor)` → `{r, g, b, a}`
- `rgbToHex(r, g, b)` → `"#rrggbb"`
- `hexToRgb(hex)` → `{r, g, b}`
- `blend(color1, color2, alpha)` → blended color

#### `core/utils/svg.js`
- `getViewBox(svgElement)` → `{x, y, width, height}`
- `tightenViewBox(svgElement)` — Shrinks viewBox to content bounds.
- `getBBox(element)` — Cross-browser bounding box.

#### `core/utils/ready.js`
- `awaitFonts(fontFamilies)` — Waits for document.fonts.check().
- `awaitImages(container)` — Waits for all img.onload.
- `signalReady()` — Sets `window.__renderReady = true` and dispatches event.

#### `core/utils/seed.js`
- `createSeededRandom(seed)` → function returning deterministic random [0,1).
- `gaussianRandom(mean, stdDev, rng)` — Box-Muller transform.

---

## 7. Implementation Phases

### Phase 0: Setup & Directory Structure ✅
- Create folder structure as defined in §4.2.
- Add placeholder files with TODO comments.
- Write this plan document.

### Phase 1: Extract Core Engines
- Extract `SketchEngine` from `Mermaid-Engine-Playground.Html` into `core/mermaid-sketch.js`.
- Extract Paper Renderer CSS and snapping logic into `core/paper-renderer.js`.
- Remove all UI code from both engines.
- Ensure engines are pure JS classes with no DOM dependencies beyond their operation.

### Phase 2: Build Preset System
- Define JSON schema in `presets/schema.json`.
- Create `_base.json` with all defaults.
- Implement `core/preset-loader.js` with `extends` resolution.
- Create 5 starter presets: `blue-bic`, `pencil-grid`, `journal-warm`, `pastel-soft`, `bold-ink`.

### Phase 3: Utility Modules
- Implement `color.js`, `svg.js`, `ready.js`, `seed.js`.
- Replace all `Math.random()` calls in Sketch Engine with seeded RNG.
- Implement deterministic font loading with `ready.js`.

### Phase 4: Pagination Engine
- Implement `core/pagination.js`.
- Support A4, letter, phone, custom sizes.
- Implement smart content splitting (avoid cutting mid-paragraph where possible).
- Add `cutOverlap` feature.

### Phase 5: Headless Renderer Host
- Create `hosts/renderer.html` — minimal HTML with no UI.
- Create `hosts/renderer.js` — exposes `window.PaperRenderer.render()`.
- Implement ready-signal protocol (`window.__renderReady`).
- Test with Playwright: render markdown, screenshot, return PNG.

### Phase 6: Python Wrapper
- Create `python/notebook_renderer/` package.
- Implement `renderer.py` with Playwright integration.
- Implement `presets.py` for preset discovery.
- Copy assets to `_assets/` during install.
- Write `setup.py` and `pyproject.toml`.

### Phase 7: Designer Refactor
- Refactor `Mermaid-Engine-Playground.Html` into `hosts/designer.html`, `designer.css`, `designer.js`.
- Wire Designer to read/write preset JSON files.
- Add real-time preview with preset application.
- Add "Export Preset" and "Import Preset" buttons.

### Phase 8: Self-Hosting & Bundling
- Download all CDN dependencies into `vendor/`.
- Download Google Fonts as woff2 into `vendor/fonts/`.
- Update engines to use relative paths for bundled mode.
- Provide CDN vs bundled configuration toggle.

### Phase 9: Testing & Documentation
- Write visual regression tests in `tests/visual/`.
- Write unit tests for utility functions.
- Document API in `README.md`.
- Create example scripts in `examples/`.

---

## 8. Refactoring Checklist

Use this checklist when extracting code from the old HTML files:

- [ ] Remove all `setTimeout` calls; replace with proper await signals.
- [ ] Replace `Math.random()` with seeded RNG from `utils/seed.js`.
- [ ] Move all magic numbers to named constants or preset fields.
- [ ] Split functions longer than 80 lines.
- [ ] Rename vague functions (`doStuff`) to descriptive names (`renderHachureLayer`).
- [ ] Delete unused code (commented-out blocks, dead branches).
- [ ] Ensure no global namespace pollution (wrap in IIFE or ES modules).
- [ ] Add JSDoc comments to all public APIs.
- [ ] Add error handling with descriptive messages.
- [ ] Log rendering steps for debugging (with log levels).

---

## 9. Testing & Verification

### Unit Tests
- Test preset merging and `extends` resolution.
- Test color parsing utilities.
- Test seeded RNG determinism.
- Test SVG viewBox calculations.

### Visual Regression Tests
- Render sample markdown with each preset.
- Compare output PNGs against reference images.
- Allow small pixel tolerance (< 2% difference).

### Integration Tests
- Python script renders markdown → PNG.
- Website embed renders in-browser.
- Designer saves preset → Renderer loads same preset → identical output.

### Manual QA Checklist
- [ ] Mermaid diagrams render with hand-drawn style.
- [ ] Math blocks render with KaTeX.
- [ ] Grid snapping aligns all elements.
- [ ] Pagination splits content correctly.
- [ ] RTL text auto-detects and aligns right.
- [ ] Multi-color semantic ink works (strong=red, em=green, etc.).
- [ ] Paper texture and holes appear realistic.
- [ ] Same preset produces identical output across runs.

---

## 10. Risks & Gotchas

### Race Conditions
- Mermaid rendering async → wait for `mermaid.run()` completion.
- Font loading async → use `document.fonts.ready`.
- Image loading async → wait for all `img.onload`.

### Mermaid Conflicts
- Never call `mermaid.initialize` twice.
- Use one initialization path in `renderer.js` or `designer.js`.
- Sketch Engine must run AFTER Mermaid finishes rendering.

### Determinism
- Seed all randomness (Rough.js, ghost offsets, filter seeds).
- Use same seed for same preset to ensure reproducibility.

### CORS
- Local file:// URLs block fetch/XHR.
- Always run via local server (Live Server, http-server).
- Python wrapper uses headless browser, so CORS handled internally.

### Font Licensing
- Google Fonts are open-source (OFL).
- Bundle woff2 files legally.
- Attribute fonts in LICENSE file.

### Performance
- Large markdown files → slow rendering.
- Mitigation: virtualize long content, paginate early.
- Rough.js is CPU-intensive → cache rendered SVGs where possible.

---

## 11. Definition of Done

The project is complete when:

1. ✅ All 9 implementation phases are finished.
2. ✅ Python user can `pip install notebook-renderer` and render markdown in 3 lines of code.
3. ✅ 5 starter presets included and documented.
4. ✅ Pagination works for A4 and phone formats.
5. ✅ Designer can create, edit, save, and import presets.
6. ✅ Visual regression tests pass for all presets.
7. ✅ Same preset produces identical output in Designer, Renderer, and website embed.
8. ✅ All code follows DRY, SSoT, and clean code principles.
9. ✅ No dead code, no spaghetti, no `setTimeout` hacks.
10. ✅ README.md provides clear usage examples for all scenarios.

---

## 12. Glossary

- **SSoT**: Single Source of Truth — one canonical location for configuration/data.
- **DRY**: Don't Repeat Yourself — avoid duplication.
- **Preset**: JSON file defining all rendering settings.
- **Sketch Engine**: Mermaid post-processor using Rough.js.
- **Paper Engine**: Markdown-to-notebook renderer.
- **Pagination**: Splitting content into multiple pages.
- **Headless**: Running browser automation without GUI (Playwright/Puppeteer).
- **Grid Snapping**: Aligning elements to CSS grid lines.
- **Ghost Lines**: Double-outline effect in hand-drawn style.
- **Hachure**: Parallel line shading technique.
- **Rough.js**: Library for hand-drawn style graphics.
- **Mermaid**: Diagramming and charting tool.
- **KaTeX**: Fast math typesetting library.
- **Marked.js**: Markdown parser.

---

**End of Plan**
