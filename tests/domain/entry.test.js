import { describe, it, expect } from "vitest";
import { isoWeekKey, weeklyStreak, createEntry } from "../../bundle/src/domain/entry.js";

describe("isoWeekKey", () => {
  it("computes ISO-8601 week keys (UTC)", () => {
    expect(isoWeekKey(new Date("2026-09-24T03:00:00Z"))).toBe("2026-W39");
    expect(isoWeekKey(new Date("2026-01-01T00:00:00Z"))).toBe("2026-W01");
    expect(isoWeekKey(new Date("2027-01-01T00:00:00Z"))).toBe("2026-W53");
  });
});

describe("weeklyStreak (AC-12)", () => {
  const at = (iso) => ({ createdAt: iso });
  const now = new Date("2026-09-24T03:00:00Z"); // W39
  it("counts consecutive weeks ending this week", () => {
    const entries = [at("2026-09-23T10:00:00Z"), at("2026-09-16T10:00:00Z"), at("2026-09-09T10:00:00Z"), at("2026-09-10T10:00:00Z")];
    expect(weeklyStreak(entries, now)).toBe(3);
  });
  it("still counts when the latest entry was last week", () => {
    expect(weeklyStreak([at("2026-09-16T10:00:00Z"), at("2026-09-09T10:00:00Z")], now)).toBe(2);
  });
  it("resets after a gap", () => {
    expect(weeklyStreak([at("2026-09-23T10:00:00Z"), at("2026-09-02T10:00:00Z")], now)).toBe(1);
    expect(weeklyStreak([at("2026-09-02T10:00:00Z")], now)).toBe(0);
    expect(weeklyStreak([], now)).toBe(0);
  });
});

describe("createEntry", () => {
  it("builds a storable entry with week key and a compact digest summary", () => {
    const e = createEntry({
      id: "abc",
      now: new Date("2026-09-24T03:00:00Z"),
      options: { tone: "build-in-public", language: "en", projectName: "Invoicer" },
      digest: { changeCount: 5, shippedCount: 4, noiseCount: 1, counts: { feat: 2 }, versions: [], highlights: [], knownNumbers: new Set(["5", "42"]) },
      drafts: { xPost: "x", linkedinPost: "l", changelog: "c" },
      check: { ok: true, issues: [] },
      notes: "n".repeat(5000),
    });
    expect(e).toMatchObject({ id: "abc", week: "2026-W39", createdAt: "2026-09-24T03:00:00.000Z", summary: { changeCount: 5, shippedCount: 4, noiseCount: 1 } });
    expect(e.drafts.xPost).toBe("x");
    expect(e.knownNumbers).toEqual(["5", "42"]);
    expect(e.notes.length).toBe(3000);
    expect(JSON.stringify(e).length).toBeLessThan(10000); // keeps 20 entries under the 256 KB legacy bucket
  });
});
