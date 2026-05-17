# Presets

This directory contains JSON preset files that define the visual style for the Notebook Renderer.

## Structure

Each preset is a JSON file with the following structure:

```json
{
  "name": "preset-name",
  "version": 1,
  "description": "Human-readable description",
  "extends": "_base",
  "paper": { ... },
  "sketch": { ... },
  "pagination": { ... },
  "mermaid": { ... },
  "math": { ... }
}
```

## Included Presets

| Name | Description | Best For |
|------|-------------|----------|
| `_base` | Base defaults (do not use directly) | Inheritance only |
| `blue-bic` | Classic blue ballpen on ruled paper | Everyday notes, default look |
| `pencil-grid` | Graphite pencil on grid paper | Technical sketches, diagrams |
| `journal-warm` | Warm-tone journal aesthetic | Personal journals, reflective notes |
| `pastel-soft` | Soft pastel palette | Gentle, calming notes |
| `bold-ink` | Bold and vibrant inks | High-contrast, emphasis notes |

## Creating Custom Presets

1. Copy an existing preset as a starting point
2. Modify the values you want to change
3. Give it a unique name
4. Optionally extend another preset using `"extends": "preset-name"`

## Using Presets

### In Python
```python
from notebook_renderer import render_markdown
png = render_markdown("# Hello", preset="blue-bic")
```

### In JavaScript (Designer/Renderer)
```javascript
import { load } from './core/preset-loader.js';
const preset = await load('blue-bic');
```

### In Website Embed
```javascript
PaperRenderer.render({
  markdown: '# Hello',
  preset: 'blue-bic'
});
```

## Schema Reference

See `schema.json` for the complete schema definition and all available options.
