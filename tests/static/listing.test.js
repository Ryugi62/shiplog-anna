// Listing fields (app.json → `anna-app apps sync-meta`) stay inside the documented limits
// (anna.partners/developers/apps/app-listing.md) and every asset the listing points at exists.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../../", import.meta.url).pathname;
const app = JSON.parse(readFileSync(join(ROOT, "app.json"), "utf8"));
const CATEGORIES = ["productivity", "developer-tools", "creative", "data", "lifestyle", "education", "communication", "entertainment", "utilities"];
const PNG = [0x89, 0x50, 0x4e, 0x47];

function isPng(path) {
  const head = readFileSync(join(ROOT, path)).subarray(0, 4);
  return PNG.every((b, i) => head[i] === b);
}

describe("listing (app.json)", () => {
  it("keeps name, tagline and description inside the Listing tab limits", () => {
    expect(app.name.length).toBeGreaterThan(0);
    expect(app.name.length).toBeLessThanOrEqual(120);
    expect(app.tagline.length).toBeLessThanOrEqual(160);
    expect(app.description.length).toBeLessThanOrEqual(20000);
  });

  it("uses a valid slug and category", () => {
    expect(app.slug).toMatch(/^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$/);
    expect(CATEGORIES).toContain(app.category);
  });

  it("points at a logo under 2 MB", () => {
    expect(existsSync(join(ROOT, app.logo_file))).toBe(true);
    expect(statSync(join(ROOT, app.logo_file)).size).toBeLessThan(2 * 1024 * 1024);
  });

  it("lists 1 to 6 screenshots, each a PNG file in the repo, result screen first", () => {
    expect(app.screenshots.length).toBeGreaterThanOrEqual(1);
    expect(app.screenshots.length).toBeLessThanOrEqual(6);
    for (const shot of app.screenshots) {
      expect(existsSync(join(ROOT, shot))).toBe(true);
      expect(isPng(shot)).toBe(true);
    }
    expect(app.screenshots[0]).toBe("assets/screenshot-2-result.png");
  });

  it("keeps the three public URLs on https", () => {
    for (const key of ["homepage_url", "support_url", "privacy_url"]) {
      expect(app[key]).toMatch(/^https:\/\//);
      expect(app[key].length).toBeLessThanOrEqual(500);
    }
  });
});
