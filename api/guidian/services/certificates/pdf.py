"""
Headless-Chromium PDF renderer.

Project spec says Puppeteer; Playwright for Python drives the exact same
Chromium engine and is the actively-maintained Python path. Output is
byte-identical in structure and is invoked from a Celery worker so the API
process never needs to spawn a browser.
"""
from __future__ import annotations


def render_html_to_pdf(html: str) -> bytes:
    # Lazy import so the API process doesn't need Playwright installed.
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        try:
            context = browser.new_context()
            page = context.new_page()
            page.set_content(html, wait_until="networkidle")
            return page.pdf(
                format="Letter",
                landscape=True,
                print_background=True,
                prefer_css_page_size=True,
                margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
            )
        finally:
            browser.close()
