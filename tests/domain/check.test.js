import { describe, it, expect } from "vitest";
import { checkDrafts, extractNumbers } from "../../bundle/src/domain/check.js";
import { digestNotes } from "../../bundle/src/domain/digest.js";

const digest = digestNotes([
  "feat: add CSV export (#42)",
  "feat: team invites",
  "perf: dashboard loads in 1.2s instead of 3.8s",
  "release v1.4.0",
].join("\n"));

const ok = {
  xPost: "Shipped 2 features this week: CSV export (#42) and team invites. Dashboard now loads in 1.2s (was 3.8s). v1.4.0 is out.",
  linkedinPost: "This week I shipped 2 features and released v1.4.0. The dashboard now loads in 1.2s instead of 3.8s. What should I build next?",
  changelog: "### Added\n- CSV export (#42)\n- Team invites\n\n### Performance\n- Dashboard loads in 1.2s (was 3.8s)",
};

describe("numberSpans", () => {
  it("returns positions that slice back to the raw token", async () => {
    const { numberSpans } = await import("../../bundle/src/domain/numbers.js");
    const text = "1. Loads in 1.2s for 1,200 users";
    const spans = numberSpans(text);
    expect(spans.map((s) => text.slice(s.start, s.end))).toEqual(["1.2", "1,200"]);
    expect(spans.map((s) => s.value)).toEqual(["1.2", "1200"]);
  });
});

describe("extractNumbers", () => {
  it("keeps versions and decimals as single tokens and drops thousands separators", () => {
    expect(extractNumbers("v1.4.0 took 1.2s, 3.8s, 1,200 users, 40%")).toEqual(["1.4.0", "1.2", "3.8", "1200", "40"]);
  });
  it("counts digits attached to letters (2x → 2)", () => {
    expect(extractNumbers("2x faster")).toEqual(["2"]);
  });
  it("ignores ordered-list markers at the start of a line", () => {
    expect(extractNumbers("1. CSV export\n2) Team invites\n  3. Faster dashboard")).toEqual([]);
  });
});

describe("checkDrafts (AC-5)", () => {
  it("passes drafts whose numbers all come from the notes or counts", () => {
    const res = checkDrafts(ok, digest);
    expect(res.ok).toBe(true);
    expect(res.issues).toEqual([]);
  });

  it("AC-5 flags numbers not found in the log", () => {
    const bad = { ...ok, linkedinPost: ok.linkedinPost + " Signups grew 40% and we now have 1,200 users." };
    const res = checkDrafts(bad, digest);
    expect(res.ok).toBe(false);
    const nums = res.issues.filter((i) => i.code === "UNSUPPORTED_NUMBER").map((i) => i.value);
    expect(nums).toEqual(["40", "1200"]);
    expect(res.issues[0].draft).toBe("linkedinPost");
  });

  it("AC-6 flags X posts over 280 weighted chars", () => {
    const res = checkDrafts({ ...ok, xPost: "a ".repeat(200) }, digest);
    expect(res.issues.map((i) => i.code)).toContain("X_TOO_LONG");
  });

  it("flags empty and too-short drafts", () => {
    const res = checkDrafts({ ...ok, changelog: "", xPost: "hi" }, digest);
    const codes = res.issues.map((i) => i.code);
    expect(codes).toContain("EMPTY");
    expect(codes).toContain("TOO_SHORT");
  });

  it("flags LinkedIn posts over 3000 chars", () => {
    const res = checkDrafts({ ...ok, linkedinPost: "word ".repeat(700) }, digest);
    expect(res.issues.map((i) => i.code)).toContain("LINKEDIN_TOO_LONG");
  });
});
