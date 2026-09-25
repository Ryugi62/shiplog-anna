"""One real-model run against `anna-app dev --storage aps` (real LLM bridge + real Anna storage).

Pre-flight for App Review ("installed and used the app yourself end-to-end"): press
"Try a sample week", wait for the real Anna AI drafts, record what the screen shows, and
capture the result screen. The English light run becomes the listing screenshot
(assets/screenshot-2-result.png) because it is real model output, not a mock.
Usage: python3 scripts/real_run.py [locale ...]   (default: en-US)
"""
import asyncio
import json
import sys
from pathlib import Path

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "qa"
OUT.mkdir(parents=True, exist_ok=True)
URL = "http://localhost:5180/"


async def app_frame(page):
    for _ in range(80):
        for f in page.frames:
            if "/anna-apps/" in f.url:
                try:
                    if await f.query_selector("#sample-btn"):
                        return f
                except Exception:
                    pass
        await page.wait_for_timeout(250)
    raise RuntimeError("ShipLog frame not found")


async def run(p, locale):
    browser = await p.chromium.launch()
    ctx = await browser.new_context(
        viewport={"width": 1280, "height": 1000}, device_scale_factor=2, color_scheme="light", locale=locale
    )
    page = await ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    await page.goto(URL, wait_until="networkidle")
    frame = await app_frame(page)
    await page.evaluate(
        "() => { const f = document.querySelector('iframe#app'); f.style.width = '560px'; f.style.height = '1400px'; }"
    )
    await page.wait_for_timeout(400)
    tag = f"real-{locale}"
    res = {"case": tag, "locale": locale}
    await frame.click("#sample-btn")
    await frame.wait_for_selector("#screen-result:not([hidden])", timeout=180000)
    await page.wait_for_timeout(600)
    res["overflow_px"] = await frame.evaluate(
        "() => document.documentElement.scrollWidth - document.documentElement.clientWidth"
    )
    for key, sel in (("big_num", "#big-num"), ("subline", "#subline"), ("verdict", "#verdict"), ("cta", "#cta")):
        res[key] = await frame.inner_text(sel)
    res["x_count"] = await frame.inner_text('[data-draft="xPost"] .count')
    res["drafts"] = await frame.eval_on_selector_all(
        "[data-draft]", "els => els.map(e => ({draft: e.dataset.draft, text: e.innerText}))"
    )
    res["known_marks"] = await frame.eval_on_selector_all("mark.num-known", "els => els.length")
    res["unknown_marks"] = await frame.eval_on_selector_all("mark.num-unknown", "els => els.length")
    shot = OUT / f"result-{tag}.png"
    await (await page.query_selector("iframe#app")).screenshot(path=str(shot))
    res["screenshot"] = str(shot)
    await frame.click("#edit-btn")
    await frame.wait_for_selector("#screen-input:not([hidden])")
    # real APS storage answers in ~0.4 s (the mock is instant), so poll before reading history
    for _ in range(40):
        if await frame.eval_on_selector("#history", "e => !e.hidden"):
            break
        await page.wait_for_timeout(250)
    res["history_visible"] = await frame.eval_on_selector("#history", "e => !e.hidden")
    res["streak"] = await frame.inner_text("#streak")
    res["page_errors"] = errors
    res["rpc_log_excerpt"] = (await page.inner_text("body"))[-2500:]
    await browser.close()
    return res


async def main():
    locales = sys.argv[1:] or ["en-US"]
    results = []
    async with async_playwright() as p:
        for loc in locales:
            results.append(await run(p, loc))
    path = OUT / "real-run-results.json"
    prev = json.loads(path.read_text()) if path.exists() else []
    path.write_text(json.dumps(prev + results, indent=2, ensure_ascii=False))
    for r in results:
        print(json.dumps({k: v for k, v in r.items() if k not in ("rpc_log_excerpt", "drafts")}, ensure_ascii=False))


asyncio.run(main())
