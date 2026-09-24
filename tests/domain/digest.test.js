import { describe, it, expect } from "vitest";
import { digestNotes, MAX_HIGHLIGHTS } from "../../bundle/src/domain/digest.js";

const WEEK = [
  "a1b2c3d feat(export): add CSV export for invoices (#42)",
  "b2c3d4e feat: team invites",
  "c3d4e5f fix: crash when the cart is empty",
  "d4e5f6a perf: dashboard loads in 1.2s instead of 3.8s",
  "e5f6a7b chore(deps): bump vite from 5.0.0 to 5.1.0",
  "f6a7b8c Merge pull request #43 from me/invites",
  "a7b8c9d release v1.4.0",
].join("\n");

describe("digestNotes (AC-4)", () => {
  it("counts changes per kind and separates noise", () => {
    const d = digestNotes(WEEK);
    expect(d.changeCount).toBe(7);
    expect(d.counts.feat).toBe(2);
    expect(d.counts.fix).toBe(1);
    expect(d.counts.perf).toBe(1);
    expect(d.noiseCount).toBe(2);
    expect(d.shippedCount).toBe(5);
    expect(d.versions).toEqual(["v1.4.0"]);
    expect(d.refs).toEqual(["#42"]);
  });

  it("orders highlights feat → perf → fix and excludes noise", () => {
    const d = digestNotes(WEEK);
    expect(d.highlights.map((h) => h.kind)).toEqual(["release", "feat", "feat", "perf", "fix"]);
    expect(d.highlights.some((h) => h.kind === "noise")).toBe(false);
  });

  it("AC-4 knownNumbers = numbers in the notes + digest counts", () => {
    const d = digestNotes(WEEK);
    for (const n of ["42", "1.2", "3.8", "1.4.0", "43", "7", "2", "1", "5"]) {
      expect(d.knownNumbers.has(n)).toBe(true);
    }
    expect(d.knownNumbers.has("40")).toBe(false);
  });

  it("caps highlights and flags truncation", () => {
    const many = Array.from({ length: 40 }, (_, i) => `feat: feature number ${i + 1}`).join("\n");
    const d = digestNotes(many);
    expect(d.highlights.length).toBe(MAX_HIGHLIGHTS);
    expect(d.truncated).toBe(true);
    expect(d.counts.feat).toBe(40);
  });

  it("isUsable is false for input with no meaningful change", () => {
    expect(digestNotes("").isUsable).toBe(false);
    expect(digestNotes("wip\nMerge branch 'x'").isUsable).toBe(false);
    expect(digestNotes("feat: add export").isUsable).toBe(true);
  });
});
