# Notebook Renderer - Python Package

Python wrapper for the Notebook Renderer JavaScript library.

## Installation

```bash
pip install playwright
playwright install
```

Or install from source:

```bash
cd python
pip install -e .
```

## Usage

### Simple Usage

```python
from notebook_renderer import render_markdown

# Render to PNG bytes
png_bytes = render_markdown("# Hello World\n\nThis is a **test**.")

# Save to file
with open("output.png", "wb") as f:
    f.write(png_bytes)
```

### With Presets

```python
from notebook_renderer import render_markdown

# Use different presets
png_bytes = render_markdown("# My Notes", preset="blue-bic")
png_bytes = render_markdown("# My Notes", preset="pencil-grid")
png_bytes = render_markdown("# My Notes", preset="journal-warm")
```

### With Pagination

```python
from notebook_renderer import render_markdown

# Long document with pagination
pages = render_markdown("""
# Long Document

## Section 1
Content here...

## Section 2
More content...
""", paginate=True)

# Save each page
for i, page in enumerate(pages):
    with open(f"page_{i}.png", "wb") as f:
        f.write(page)
```

### Using the Class Directly

```python
from notebook_renderer import NotebookRenderer
import asyncio

async def main():
    async with NotebookRenderer(preset="blue-bic") as renderer:
        png_bytes = await renderer.render("# Hello World")
        
        # Save
        with open("output.png", "wb") as f:
            f.write(png_bytes)

asyncio.run(main())
```

### Command Line

```bash
# Render a file
notebook-renderer input.md -o output.png

# With custom preset
notebook-renderer notes.md -p pencil-grid -o notes.png

# With pagination
notebook-renderer long-doc.md --paginate -o pages.png
```

## Available Presets

- `blue-bic` - Classic blue ballpen on ruled paper (default)
- `pencil-grid` - Graphite pencil on grid paper
- `journal-warm` - Warm-tone journal aesthetic
- `pastel-soft` - Soft pastel palette
- `bold-ink` - Bold and vibrant inks

## Requirements

- Python 3.8+
- Playwright

## License

MIT License
