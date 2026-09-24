import { describe, it, expect } from "vitest";
import { parseDraftSet, weightedLength, fitXPost, X_LIMIT } from "../../bundle/src/domain/drafts.js";

describe("weightedLength (AC-7)", () => {
  it("counts latin chars as 1", () => {
    expect(weightedLength("hello world")).toBe(11);
  });
  it("counts CJK / Hangul / kana as 2", () => {
    expect(weightedLength("배포했어요")).toBe(10);
    expect(weightedLength("发布了")).toBe(6);
    expect(weightedLength("リリース")).toBe(8);
  });
  it("counts emoji as 2 and any URL as 23", () => {
    expect(weightedLength("🚀")).toBe(2);
    expect(weightedLength("see https://example.com/a/very/long/path/that/is/long")).toBe(4 + 23);
  });
});

describe("fitXPost (AC-6)", () => {
  it("returns short posts unchanged", () => {
    expect(fitXPost("Shipped CSV export.")).toEqual({ text: "Shipped CSV export.", trimmed: false });
  });
  it("trims long posts at a word boundary with an ellipsis within the limit", () => {
    const long = Array.from({ length: 80 }, (_, i) => `word${i}`).join(" ");
    const { text, trimmed } = fitXPost(long);
    expect(trimmed).toBe(true);
    expect(weightedLength(text)).toBeLessThanOrEqual(X_LIMIT);
    expect(text.endsWith("…")).toBe(true);
    expect(text.slice(0, -1)).toMatch(/word\d+$/);
  });
});

describe("parseDraftSet (AC-8)", () => {
  const good = { x_post: "Shipped CSV export this week.", linkedin_post: "This week I shipped CSV export.", changelog_md: "### Added\n- CSV export" };
  it("parses a bare JSON object", () => {
    expect(parseDraftSet(JSON.stringify(good))).toEqual({
      xPost: good.x_post,
      linkedinPost: good.linkedin_post,
      changelog: good.changelog_md,
    });
  });
  it("extracts JSON from ```json fences and surrounding prose", () => {
    const text = "Sure! Here you go:\n```json\n" + JSON.stringify(good, null, 2) + "\n```\nHope it helps.";
    expect(parseDraftSet(text).xPost).toBe(good.x_post);
  });
  it("throws BAD_MODEL_OUTPUT when keys are missing or JSON is invalid", () => {
    expect(() => parseDraftSet('{"x_post":"a"}')).toThrow(/BAD_MODEL_OUTPUT/);
    expect(() => parseDraftSet("no json here")).toThrow(/BAD_MODEL_OUTPUT/);
  });
  it("trims whitespace in each draft", () => {
    const d = parseDraftSet(JSON.stringify({ ...good, x_post: "  hi there  " }));
    expect(d.xPost).toBe("hi there");
  });
});
