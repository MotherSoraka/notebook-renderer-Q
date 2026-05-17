"""
Notebook Renderer - Python Wrapper

A plug-and-play module for rendering Markdown, Mermaid diagrams,
and Math onto realistic notebook paper with hand-drawn aesthetics.

Usage:
    from notebook_renderer import render_markdown
    
    # Simple usage
    png_bytes = render_markdown("# Hello World", preset="blue-bic")
    
    # With pagination
    pages = render_markdown("# Long document...", paginate=True)
"""

import os
import sys
import asyncio
from pathlib import Path
from typing import List, Optional, Union

# Try to import playwright
try:
    from playwright.async_api import async_playwright
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False
    async_playwright = None

# Get the path to the renderer HTML
ASSETS_DIR = Path(__file__).parent / "_assets"
RENDERER_HTML = ASSETS_DIR / "renderer.html"


class NotebookRenderer:
    """
    Python wrapper for the Notebook Renderer JavaScript library.
    
    Uses Playwright to run the headless browser renderer and export images.
    """
    
    def __init__(self, preset: str = "blue-bic", headless: bool = True):
        """
        Initialize the renderer.
        
        Args:
            preset: Preset name to use (e.g., "blue-bic", "pencil-grid")
            headless: Run browser in headless mode
        """
        self.preset = preset
        self.headless = headless
        self.browser = None
        self.page = None
        
        if not PLAYWRIGHT_AVAILABLE:
            raise ImportError(
                "Playwright is required for notebook_renderer. "
                "Install it with: pip install playwright\n"
                "Then run: playwright install"
            )
    
    async def _ensure_browser(self):
        """Ensure browser is launched."""
        if self.browser is None:
            playwright = await async_playwright().start()
            self.browser = await playwright.chromium.launch(headless=self.headless)
            self.page = await self.browser.new_page()
            
            # Load the renderer page
            if not RENDERER_HTML.exists():
                raise FileNotFoundError(
                    f"Renderer HTML not found at {RENDERER_HTML}. "
                    "Please ensure the notebook-renderer package is properly installed."
                )
            
            await self.page.goto(f"file://{RENDERER_HTML.absolute()}")
            await self.page.wait_for_load_state("networkidle")
    
    async def render(self, markdown: str, paginate: bool = False) -> Union[bytes, List[bytes]]:
        """
        Render Markdown to image(s).
        
        Args:
            markdown: Markdown text to render
            paginate: If True, split into multiple pages
            
        Returns:
            PNG bytes (single page) or list of PNG bytes (multiple pages)
        """
        await self._ensure_browser()
        
        # Set the markdown content
        await self.page.evaluate(f"""
            window.setMarkdown(`{markdown.replace('`', '\\`')}`);
        """)
        
        # Set preset
        await self.page.evaluate(f"""
            window.applyPreset('{self.preset}');
        """)
        
        # Enable pagination if requested
        if paginate:
            await self.page.evaluate("""
                window.togglePagination(true);
            """)
        
        # Wait for rendering to complete
        await self.page.wait_for_timeout(2000)
        
        # Export images
        if paginate:
            # Get number of pages
            num_pages = await self.page.evaluate("window.getPageCount()")
            images = []
            for i in range(num_pages):
                img_data = await self.page.evaluate(f"""
                    window.exportPage({i}, 'png');
                """)
                images.append(img_data)
            return images
        else:
            img_data = await self.page.evaluate("""
                window.exportCurrentPage('png');
            """)
            return img_data
    
    async def close(self):
        """Close the browser."""
        if self.browser:
            await self.browser.close()
            self.browser = None
            self.page = None
    
    async def __aenter__(self):
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()


def render_markdown(
    markdown: str,
    preset: str = "blue-bic",
    paginate: bool = False,
    output_path: Optional[str] = None
) -> Union[bytes, List[bytes]]:
    """
    Convenience function to render Markdown to image(s).
    
    Args:
        markdown: Markdown text to render
        preset: Preset name to use
        paginate: If True, split into multiple pages
        output_path: Optional path to save the image(s)
        
    Returns:
        PNG bytes (single page) or list of PNG bytes (multiple pages)
        
    Example:
        >>> png_bytes = render_markdown("# Hello World", preset="blue-bic")
        >>> with open("output.png", "wb") as f:
        ...     f.write(png_bytes)
    """
    if not PLAYWRIGHT_AVAILABLE:
        raise ImportError(
            "Playwright is required. Install with: pip install playwright\n"
            "Then run: playwright install"
        )
    
    async def _render():
        async with NotebookRenderer(preset=preset) as renderer:
            return await renderer.render(markdown, paginate=paginate)
    
    result = asyncio.run(_render())
    
    # Save to file if path provided
    if output_path:
        if isinstance(result, list):
            # Multiple pages
            base, ext = os.path.splitext(output_path)
            for i, img_data in enumerate(result):
                path = f"{base}_{i}{ext}"
                with open(path, "wb") as f:
                    f.write(img_data)
                print(f"Saved: {path}")
        else:
            # Single page
            with open(output_path, "wb") as f:
                f.write(result)
            print(f"Saved: {output_path}")
    
    return result


# CLI interface
if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Render Markdown to notebook-style images")
    parser.add_argument("input", nargs="?", help="Input Markdown file (or use stdin)")
    parser.add_argument("-o", "--output", default="output.png", help="Output image path")
    parser.add_argument("-p", "--preset", default="blue-bic", help="Preset to use")
    parser.add_argument("--paginate", action="store_true", help="Split into multiple pages")
    
    args = parser.parse_args()
    
    # Read input
    if args.input:
        with open(args.input, "r") as f:
            markdown = f.read()
    else:
        markdown = sys.stdin.read()
    
    # Render
    print(f"Rendering with preset '{args.preset}'...")
    result = render_markdown(
        markdown,
        preset=args.preset,
        paginate=args.paginate,
        output_path=args.output
    )
    
    print("Done!")
