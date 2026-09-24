"""Local QA: count RPCs in the anna-app dev harness log panel after one sample run."""
import asyncio, re, sys
PORT = sys.argv[1] if len(sys.argv) > 1 else "5180"
SHOT = sys.argv[2] if len(sys.argv) > 2 else ""
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1280, "height": 1000})
        await pg.goto("http://localhost:" + PORT + "/", wait_until="networkidle")
        for _ in range(40):
            fr = next((f for f in pg.frames if "/anna-apps/" in f.url), None)
            if fr and await fr.query_selector("#sample-btn"): break
            await pg.wait_for_timeout(250)
        await fr.click("#sample-btn")
        await fr.wait_for_selector("#screen-result:not([hidden])", timeout=20000)
        await pg.wait_for_timeout(800)
        text = await pg.inner_text("body")
        reqs = re.findall(r"→ req\s+(\S+)", text)
        res = re.findall(r"← res (\w+)\s+(\S+)", text)
        from collections import Counter
        print("requests:", dict(Counter(reqs)))
        print("responses:", dict(Counter(f"{a} {m}" for a, m in res)))
        print("denied/error lines:", [l for l in text.splitlines() if re.search(r"denied|permission|res err", l)][:10])
        if SHOT:
            el = await pg.query_selector("iframe#app")
            await el.screenshot(path=SHOT)
        await b.close()
asyncio.run(main())
