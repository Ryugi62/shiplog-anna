// AC-16: Anna mobile review checklist + Toss checklist items that can be checked statically.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const BUNDLE = new URL("../../bundle/", import.meta.url).pathname;
const html = readFileSync(join(BUNDLE, "index.html"), "utf8");
const css = readFileSync(join(BUNDLE, "styles.css"), "utf8");

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const files = walk(BUNDLE);

/** Split CSS into [selector, body] rules (flat parse — enough for this stylesheet). */
function rules(source) {
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (const m of source.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(re)) out.push([m[1].trim(), m[2]]);
  return out;
}

function luminance(hex) {
  const [r, g, b] = hex.replace("#", "").match(/../g).map((x) => parseInt(x, 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}
function tokens(block) {
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));
}

describe("Anna mobile checklist (review-enforced rows)", () => {
  it("does not ship its own viewport meta (the mobile shell injects it)", () => {
    expect(html).not.toMatch(/<meta\s+name=["']viewport/i);
  });
  it("pads for safe areas with env() and the shell variables", () => {
    expect(css).toMatch(/env\(safe-area-inset-bottom\)/);
    expect(css).toMatch(/--anna-safe-area-bottom/);
  });
  it("has no hover-only interaction: every :hover selector list also covers :focus-visible", () => {
    for (const [sel] of rules(css)) {
      if (!sel.includes(":hover")) continue;
      expect(sel, sel).toMatch(/:focus-visible/);
    }
  });
  it("gives interactive controls a ≥44px touch target", () => {
    for (const cls of [".btn", ".chip", ".btn-small", ".link", ".history-open"]) {
      const rule = rules(css).find(([sel]) => sel.split(",").map((s) => s.trim()).includes(cls));
      expect(rule, cls).toBeTruthy();
      const h = Number((rule[1].match(/min-height:\s*(\d+)px/) ?? [])[1]);
      expect(h, cls).toBeGreaterThanOrEqual(44);
    }
    expect(css).toMatch(/\.pill span \{[^}]*min-height: 44px/);
    expect(css).toMatch(/\.bar \.btn \{[^}]*min-height: 52px/);
  });
  it("does not call window geometry APIs", () => {
    for (const f of files.filter((p) => p.endsWith(".js"))) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/window\.(resize|move)\(|anna\.window\.resize/);
    }
  });
});

describe("Toss checklist (static items)", () => {
  it("#10 loads no external font or CDN", () => {
    const all = files.filter((p) => /\.(html|css|js)$/.test(p)).map((p) => readFileSync(p, "utf8")).join("\n");
    expect(all).not.toMatch(/fonts\.googleapis|cdn\.jsdelivr|unpkg\.com|cdnjs/);
    expect(css).not.toMatch(/@import|url\(https?:/);
  });
  it("#3 type scale: title 22px bold, body 15–16px, meta 13px; #6 the big number ≥ 28px", () => {
    expect(css).toMatch(/\.title \{[^}]*font-size: 22px;[^}]*font-weight: 700/);
    expect(css).toMatch(/body \{[^}]*font-size: 16px/);
    expect(css).toMatch(/\.meta \{[^}]*font-size: 13px/);
    const big = Number(css.match(/\.big-num \{[^}]*font-size: (\d+)px/)[1]);
    expect(big).toBeGreaterThanOrEqual(28);
  });
  it("#4 cards use radius ≥16px and there is no box-shadow elevation", () => {
    expect(css).toMatch(/--radius: 16px/);
    expect(css).not.toMatch(/box-shadow:\s*0 \d/);
  });
  it("#9 text colours meet 4.5:1 on their backgrounds in light and dark", () => {
    const light = tokens(css.match(/:root \{([\s\S]*?)\n\}/)[1]);
    const dark = { ...light, ...tokens(css.match(/prefers-color-scheme: dark\) \{\s*:root \{([\s\S]*?)\}/)[1]) };
    const pairs = [
      ["ink", "bg"], ["ink-2", "bg"], ["ink-3", "bg"], ["ink", "surface"], ["ink-2", "surface"], ["ink-3", "surface"],
      ["on-brand", "brand-strong"], ["known-ink", "known-bg"], ["unknown-ink", "unknown-bg"],
      ["ok", "ok-bg"], ["warn", "warn-bg"], ["err", "err-bg"],
    ];
    for (const [theme, t] of [["light", light], ["dark", dark]]) {
      for (const [fg, bg] of pairs) {
        const c = contrast(t[fg], t[bg]);
        expect(c, `${theme} ${fg} on ${bg} = ${c.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
      }
    }
    expect(contrast(light["brand-strong"], light.bg)).toBeGreaterThanOrEqual(4.5); // links + big number (light)
    expect(contrast(dark.brand, dark.bg)).toBeGreaterThanOrEqual(4.5); // links + big number (dark)
  });
  it("#5 exactly one primary action, in a fixed bottom bar", () => {
    const view = readFileSync(join(BUNDLE, "src/adapters/ui/view.js"), "utf8");
    expect(view.match(/btn btn-primary/g)).toHaveLength(1);
    expect(css).toMatch(/\.bar \{[^}]*position: fixed;[^}]*bottom: 0/);
  });
});

describe("bundle upload rules", () => {
  const ALLOWED = /\.(html|css|js|json|svg|png|webp)$/;
  it("every path matches the Anna bundle path rule and type whitelist", () => {
    for (const f of files) {
      const rel = relative(BUNDLE, f);
      expect(rel, rel).toMatch(/^[A-Za-z0-9_./-]+$/);
      expect(rel, rel).toMatch(ALLOWED);
    }
  });
  it("stays far below the 50 MB / 2,000 files / 10 MB limits", () => {
    const sizes = files.map((f) => statSync(f).size);
    expect(files.length).toBeLessThan(200);
    expect(Math.max(...sizes)).toBeLessThan(10 * 1024 * 1024);
    expect(sizes.reduce((a, b) => a + b, 0)).toBeLessThan(1024 * 1024);
  });
});

describe("clean architecture", () => {
  const src = join(BUNDLE, "src");
  it("domain imports nothing from outer layers; application imports only domain", () => {
    for (const f of walk(join(src, "domain"))) expect(readFileSync(f, "utf8"), f).not.toMatch(/from "\.\.\/(application|adapters|infrastructure)/);
    for (const f of walk(join(src, "application"))) expect(readFileSync(f, "utf8"), f).not.toMatch(/from "\.\.\/(adapters|infrastructure)/);
    for (const f of walk(join(src, "adapters"))) expect(readFileSync(f, "utf8"), f).not.toMatch(/from "\.\.\/(\.\.\/)?infrastructure/);
  });
  it("only infrastructure imports the Anna SDK", () => {
    for (const f of walk(src)) {
      const text = readFileSync(f, "utf8");
      if (text.includes("_sdk/latest")) expect(f).toMatch(/infrastructure/);
    }
  });
});
