import { describe, it, expect } from "vitest";
import { errorText, issueText, defaultLanguage, ERROR_TEXT, SAMPLE_NOTES } from "../../bundle/src/adapters/ui/copy.js";
import { segmentNumbers } from "../../bundle/src/adapters/ui/highlight.js";
import { digestNotes } from "../../bundle/src/domain/digest.js";

describe("ui copy", () => {
  it("has a message for every error code the app can raise", () => {
    for (const code of ["EMPTY_NOTES", "QUOTA", "NOT_ALLOWED", "TIMEOUT", "PROVIDER", "UNAVAILABLE", "BAD_MODEL_OUTPUT", "INVALID_REPO", "NOT_FOUND", "RATE_LIMITED", "NO_RECENT_COMMITS", "NETWORK", "UNKNOWN"]) {
      expect(ERROR_TEXT[code]).toBeTruthy();
    }
    expect(errorText({ code: "nope" })).toBe(ERROR_TEXT.UNKNOWN);
    expect(errorText(undefined)).toBe(ERROR_TEXT.UNKNOWN);
  });

  it("explains issues in plain words", () => {
    expect(issueText({ code: "UNSUPPORTED_NUMBER", draft: "xPost", value: "40" })).toContain('"40"');
  });

  it("maps browser languages to output languages", () => {
    expect(defaultLanguage("ko-KR")).toBe("ko");
    expect(defaultLanguage("zh-TW")).toBe("zh-TW");
    expect(defaultLanguage("zh-CN")).toBe("zh-CN");
    expect(defaultLanguage("pt-PT")).toBe("pt-BR");
    expect(defaultLanguage("en-GB")).toBe("en");
    expect(defaultLanguage(undefined)).toBe("en");
  });

  it("the sample week is usable and has noise to skip", () => {
    const d = digestNotes(SAMPLE_NOTES);
    expect(d.isUsable).toBe(true);
    expect(d.noiseCount).toBeGreaterThanOrEqual(3);
    expect(d.versions).toContain("v1.4.0");
  });
});

describe("segmentNumbers", () => {
  it("marks known and unknown numbers and keeps the text intact", () => {
    const segs = segmentNumbers("Loads in 1.2s, 40% faster (#42)", ["1.2", "42"]);
    expect(segs.map((s) => s.text).join("")).toBe("Loads in 1.2s, 40% faster (#42)");
    expect(segs.filter((s) => s.kind !== "plain").map((s) => [s.text, s.kind])).toEqual([
      ["1.2", "known"],
      ["40", "unknown"],
      ["42", "known"],
    ]);
  });
  it("handles text without numbers", () => {
    expect(segmentNumbers("no numbers", [])).toEqual([{ text: "no numbers", kind: "plain" }]);
  });
});

describe("i18n tables", async () => {
  const { MESSAGES, uiLocale, countsLine, errorText } = await import("../../bundle/src/adapters/ui/copy.js");
  const shape = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v && typeof v === "object" && !Array.isArray(v) ? shape(v) : typeof v]));
  it("every locale has exactly the English keys (nested)", () => {
    const en = shape(MESSAGES.en);
    for (const loc of ["zh-CN", "ko"]) expect(shape(MESSAGES[loc]), loc).toEqual(en);
  });
  it("picks the UI locale from the browser language", () => {
    expect(uiLocale("ko-KR")).toBe("ko");
    expect(uiLocale("zh-TW")).toBe("zh-CN");
    expect(uiLocale("ja-JP")).toBe("en");
    expect(uiLocale(undefined)).toBe("en");
  });
  it("formats counts per locale", () => {
    const counts = { feat: 2, fix: 1, noise: 3 };
    expect(countsLine(counts, "en")).toBe("2 features, 1 fix");
    expect(countsLine(counts, "zh-CN")).toBe("2 个新功能、1 个修复");
    expect(countsLine(counts, "ko")).toBe("기능 2개, 수정 1개");
  });
  it("localizes errors with an English fallback for unknown locales", () => {
    expect(errorText({ code: "QUOTA" }, "ko")).toMatch(/Anna AI 사용량/);
    expect(errorText({ code: "QUOTA" }, "xx")).toMatch(/quota/);
  });
});
