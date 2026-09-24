"""Render listing assets locally: logo PNG from bundle/icon.svg, and an input-screen screenshot
(real UI with the sample notes typed in — no AI output) from the running anna-app dev harness."""
import asyncio, sys
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent.parent
SVG = (ROOT / "bundle" / "icon.svg").read_text()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 512, "height": 512})
        sized = SVG.replace("<svg ", '<svg width="512" height="512" ', 1)
        await pg.set_content("<html><body style='margin:0;background:transparent'>" + sized + "</body></html>")
        await pg.locator("svg").screenshot(path=str(ROOT / "assets" / "logo-512.png"), omit_background=True)
        port = sys.argv[1] if len(sys.argv) > 1 else "5180"
        ctx = await b.new_context(viewport={"width": 1280, "height": 1000}, device_scale_factor=2, color_scheme="light")
        pg2 = await ctx.new_page()
        await pg2.goto(f"http://localhost:{port}/", wait_until="networkidle")
        for _ in range(40):
            fr = next((f for f in pg2.frames if "/anna-apps/" in f.url), None)
            if fr and await fr.query_selector("#notes"): break
            await pg2.wait_for_timeout(250)
        await pg2.evaluate("() => { const f = document.querySelector('iframe#app'); f.style.width = '560px'; f.style.height = '900px'; }")
        await fr.evaluate("""async () => {
          const m = await import('./src/adapters/ui/copy.js');
          const n = document.querySelector('#notes'); n.value = m.SAMPLE_NOTES; n.dispatchEvent(new Event('input'));
          document.querySelector('#project').value = 'Invoicer';
        }""")
        await pg2.wait_for_timeout(300)
        await (await pg2.query_selector("iframe#app")).screenshot(path=str(ROOT / "assets" / "screenshot-1-input.png"))
        await b.close()

asyncio.run(main())
