"""Local QA against `anna-app dev --mock-llm fixtures/mock-llm.jsonl` (production dispatcher + ACL).

Drives the ShipLog iframe headlessly: sample run → result, checks overflow at 320/390/1280 in
light and dark, and saves captures to docs/qa/. Mock LLM output is for QA only (not for the listing).
Usage: python3 scripts/qa_harness.py
"""
import asyncio
import json
from pathlib import Path

from playwright.async_api import async_playwright

OUT = Path(__file__).resolve().parent.parent / "docs" / "qa"
OUT.mkdir(parents=True, exist_ok=True)
URL = "http://localhost:5180/"


async def app_frame(page):
    for _ in range(60):
        for f in page.frames:
            if "/anna-apps/" in f.url:
                try:
                    if await f.query_selector("#q"):
                        return f
                except Exception:
                    pass
        await page.wait_for_timeout(250)
    raise RuntimeError("ShipLog frame not found")


async def overflow(frame):
    return await frame.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth")


async def run(p, scheme, mobile, width, locale="en-US"):
    browser = await p.chromium.launch()
    ctx = await browser.new_context(viewport={"width": 1280, "height": 1000}, color_scheme=scheme, locale=locale)
    page = await ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    await page.goto(URL, wait_until="networkidle")
    if mobile:
        await page.click("#ff-mobile")
        await page.wait_for_timeout(500)
    frame = await app_frame(page)
    frame_errors = []
    iframe = await page.query_selector("iframe#app")
    await page.evaluate(
        "(w) => { const f = document.querySelector('iframe#app'); f.style.width = w + 'px'; f.style.height = '860px'; }", width
    )
    await page.wait_for_timeout(400)
    tag = f"{'mobile' if mobile else 'desktop'}-{width}-{scheme}" + ("" if locale == "en-US" else f"-{locale}")
    res = {"case": tag}
    res["question"] = await frame.inner_text("#q")
    res["input_overflow_px"] = await overflow(frame)
    await iframe.screenshot(path=str(OUT / f"input-{tag}.png"))
    await frame.click("#sample-btn")
    await frame.wait_for_selector("#screen-result:not([hidden])", timeout=20000)
    await page.wait_for_timeout(300)
    res["result_overflow_px"] = await overflow(frame)
    res["big_num"] = await frame.inner_text("#big-num")
    res["subline"] = await frame.inner_text("#subline")
    res["verdict"] = await frame.inner_text("#verdict")
    res["x_count"] = await frame.inner_text('[data-draft="xPost"] .count')
    res["known_marks"] = await frame.eval_on_selector_all("mark.num-known", "els => els.length")
    res["unknown_marks"] = await frame.eval_on_selector_all("mark.num-unknown", "els => els.length")
    res["cta"] = await frame.inner_text("#cta")
    await iframe.screenshot(path=str(OUT / f"result-{tag}.png"))
    # history persists within the harness window session
    await frame.click("#edit-btn")
    await frame.wait_for_selector("#screen-input:not([hidden])")
    res["history_visible"] = await frame.eval_on_selector("#history", "e => !e.hidden")
    res["streak"] = await frame.inner_text("#streak")
    res["page_errors"] = errors + frame_errors
    # RPC log shown by the harness dashboard (right panel)
    res["rpc_log_excerpt"] = (await page.inner_text("body"))[-1200:]
    await browser.close()
    return res


async def main():
    results = []
    async with async_playwright() as p:
        for scheme in ("light", "dark"):
            for mobile, width in ((False, 1280), (False, 560), (True, 390), (True, 320)):
                results.append(await run(p, scheme, mobile, width))
        for loc in ("ko-KR", "zh-CN"):
            results.append(await run(p, "light", True, 320, loc))
    (OUT / "qa-results.json").write_text(json.dumps(results, indent=2, ensure_ascii=False))
    for r in results:
        print(json.dumps({k: v for k, v in r.items() if k != "rpc_log_excerpt"}, ensure_ascii=False))


asyncio.run(main())
