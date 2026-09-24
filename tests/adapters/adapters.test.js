import { describe, it, expect } from "vitest";
import { createAnnaLlm, toAppError } from "../../bundle/src/adapters/anna-llm.js";
import { createAnnaStore } from "../../bundle/src/adapters/anna-store.js";
import { createGitHubCommits } from "../../bundle/src/adapters/github-commits.js";
import { createMemoryStore } from "../../bundle/src/adapters/memory-store.js";

const REQ = { systemPrompt: "s", messages: [{ role: "user", content: { type: "text", text: "hi" } }], maxTokens: 100, temperature: 0.5 };

describe("anna-llm adapter (AC-14)", () => {
  it("returns content.text from the SDK v0.16 shape (result resolved directly)", async () => {
    const calls = [];
    const anna = { llm: { complete: async (args, opts) => { calls.push({ args, opts }); return { role: "assistant", content: { type: "text", text: "OK" }, model: "m" }; } } };
    const llm = createAnnaLlm(anna);
    expect(await llm.complete(REQ)).toBe("OK");
    expect(calls[0].args).toMatchObject({ systemPrompt: "s", maxTokens: 100, temperature: 0.5 });
    expect(calls[0].opts.timeoutMs).toBeGreaterThanOrEqual(120000);
  });

  it("also accepts the documented {ok, result} envelope and string content", async () => {
    const anna = { llm: { complete: async () => ({ ok: true, result: { content: "plain" } }) } };
    expect(await createAnnaLlm(anna).complete(REQ)).toBe("plain");
  });

  it("maps envelope errors and thrown errors to app error codes", async () => {
    const env = { llm: { complete: async () => ({ ok: false, error: { code: "APP_QUOTA_EXCEEDED", message: "q" } }) } };
    await expect(createAnnaLlm(env).complete(REQ)).rejects.toMatchObject({ code: "QUOTA" });
    const thrown = (code, message = "x") => ({ llm: { complete: async () => { throw Object.assign(new Error(message), { code }); } } });
    await expect(createAnnaLlm(thrown("quota_exceeded")).complete(REQ)).rejects.toMatchObject({ code: "QUOTA" });
    await expect(createAnnaLlm(thrown("APP_NOT_GRANTED")).complete(REQ)).rejects.toMatchObject({ code: "NOT_ALLOWED" });
    await expect(createAnnaLlm(thrown("permission_denied")).complete(REQ)).rejects.toMatchObject({ code: "NOT_ALLOWED" });
    await expect(createAnnaLlm(thrown(undefined, "RPC llm.complete timed out after 150000ms")).complete(REQ)).rejects.toMatchObject({ code: "TIMEOUT" });
    await expect(createAnnaLlm(thrown("APP_PROVIDER_ERROR")).complete(REQ)).rejects.toMatchObject({ code: "PROVIDER" });
    await expect(createAnnaLlm(thrown("llm_disabled")).complete(REQ)).rejects.toMatchObject({ code: "UNAVAILABLE" });
    await expect(createAnnaLlm(thrown("weird")).complete(REQ)).rejects.toMatchObject({ code: "UNKNOWN" });
  });

  it("joins content given as an array of text blocks", async () => {
    const anna = { llm: { complete: async () => ({ content: [{ type: "text", text: "{\"a\":" }, { type: "text", text: "1}" }] }) } };
    expect(await createAnnaLlm(anna).complete(REQ)).toBe('{"a":1}');
  });

  it("rejects an empty model reply", async () => {
    const anna = { llm: { complete: async () => ({ content: { type: "text", text: "" } }) } };
    await expect(createAnnaLlm(anna).complete(REQ)).rejects.toMatchObject({ code: "PROVIDER" });
  });

  it("toAppError keeps the original message", () => {
    const e = toAppError(Object.assign(new Error("boom"), { code: "APP_QUOTA_EXCEEDED" }));
    expect(e.code).toBe("QUOTA");
    expect(e.message).toContain("boom");
  });
});

describe("anna-store adapter", () => {
  function fakeAnnaStorage() {
    const map = new Map();
    const log = [];
    return {
      log,
      map,
      storage: {
        set: async ({ key, value }) => { log.push(["set", key]); map.set(key, structuredClone(value)); return { etag: "e" }; },
        get: async ({ key }) => (map.has(key) ? { value: structuredClone(map.get(key)), exists: true } : { value: null, exists: false }),
        list: async ({ prefix = "" } = {}) => ({ items: [...map.keys()].filter((k) => k.startsWith(prefix)).sort().map((key) => ({ key })), next_cursor: null }),
        delete: async ({ key }) => { log.push(["delete", key]); map.delete(key); return { deleted: true }; },
      },
    };
  }

  it("saves entries under entries/<id> and lists them back", async () => {
    const anna = fakeAnnaStorage();
    const store = createAnnaStore(anna);
    await store.save({ id: "20260924T030000-aa", createdAt: "2026-09-24T03:00:00Z" });
    await store.save({ id: "20260917T030000-bb", createdAt: "2026-09-17T03:00:00Z" });
    expect([...anna.map.keys()].sort()).toEqual(["entries/20260917T030000-bb", "entries/20260924T030000-aa"]);
    const list = await store.list();
    expect(list.map((e) => e.id)).toEqual(["20260924T030000-aa", "20260917T030000-bb"]);
  });

  it("prunes beyond the keep limit, oldest first", async () => {
    const anna = fakeAnnaStorage();
    const store = createAnnaStore(anna, { keep: 2 });
    await store.save({ id: "20260901T000000-a", createdAt: "2026-09-01T00:00:00Z" });
    await store.save({ id: "20260908T000000-b", createdAt: "2026-09-08T00:00:00Z" });
    await store.save({ id: "20260915T000000-c", createdAt: "2026-09-15T00:00:00Z" });
    expect([...anna.map.keys()].sort()).toEqual(["entries/20260908T000000-b", "entries/20260915T000000-c"]);
  });

  it("removes entries and reads/writes prefs", async () => {
    const anna = fakeAnnaStorage();
    const store = createAnnaStore(anna);
    await store.save({ id: "x", createdAt: "2026-09-24T00:00:00Z" });
    await store.remove("x");
    expect(anna.map.has("entries/x")).toBe(false);
    expect(await store.getPrefs()).toEqual({});
    await store.setPrefs({ tone: "technical" });
    expect(await store.getPrefs()).toEqual({ tone: "technical" });
  });

  it("reads both the APS shape {value, exists} and a raw stored value (legacy/harness)", async () => {
    const { readValue } = await import("../../bundle/src/adapters/anna-store.js");
    expect(readValue({ value: { a: 1 }, exists: true, etag: "e" })).toEqual({ exists: true, value: { a: 1 } });
    expect(readValue({ value: null, exists: false })).toEqual({ exists: false, value: null });
    expect(readValue({ id: "x", createdAt: "t" })).toEqual({ exists: true, value: { id: "x", createdAt: "t" } });
    expect(readValue(null)).toEqual({ exists: false, value: null });
  });

  it("unwraps {ok,result} envelopes and surfaces {ok:false} as errors", async () => {
    const anna = { storage: { get: async () => ({ ok: true, result: { value: { tone: "professional" }, exists: true } }), set: async () => ({ ok: false, error: { code: "quota_exceeded", message: "full" } }) } };
    const store = createAnnaStore(anna);
    expect(await store.getPrefs()).toEqual({ tone: "professional" });
    await expect(store.setPrefs({})).rejects.toBeTruthy();
  });
});

describe("memory store", () => {
  it("implements the same port", async () => {
    const s = createMemoryStore();
    await s.save({ id: "a", createdAt: "2026-09-24T00:00:00Z" });
    expect((await s.list()).map((e) => e.id)).toEqual(["a"]);
    await s.remove("a");
    expect(await s.list()).toEqual([]);
    await s.setPrefs({ language: "ko" });
    expect(await s.getPrefs()).toEqual({ language: "ko" });
  });
});

describe("github-commits adapter (AC-13)", () => {
  const res = (status, body, headers = {}) => ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k) => headers[k.toLowerCase()] ?? null },
    json: async () => body,
  });

  it("requests the public commits API and formats `sha7 first-line`", async () => {
    const urls = [];
    const fetchImpl = async (url, init) => {
      urls.push({ url, init });
      return res(200, [
        { sha: "a1b2c3d4e5f6", commit: { message: "feat: add export\n\nlong body" } },
        { sha: "b2c3d4e5f6a7", commit: { message: "fix: crash" } },
      ]);
    };
    const src = createGitHubCommits(fetchImpl);
    const lines = await src.recentCommits({ owner: "o", repo: "r" }, "2026-09-17T03:00:00.000Z");
    expect(urls[0].url).toBe("https://api.github.com/repos/o/r/commits?since=2026-09-17T03%3A00%3A00.000Z&per_page=100");
    expect(urls[0].init.headers.Accept).toBe("application/vnd.github+json");
    expect(urls[0].init.credentials).toBe("omit");
    expect(lines).toEqual(["a1b2c3d feat: add export", "b2c3d4e fix: crash"]);
  });

  it("maps 404 → NOT_FOUND, rate limit → RATE_LIMITED, 409 → NO_RECENT_COMMITS, network → NETWORK", async () => {
    const src = (r) => createGitHubCommits(async () => (r instanceof Error ? Promise.reject(r) : r));
    const ref = { owner: "o", repo: "r" };
    await expect(src(res(404, {})).recentCommits(ref, "x")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(src(res(403, {}, { "x-ratelimit-remaining": "0" })).recentCommits(ref, "x")).rejects.toMatchObject({ code: "RATE_LIMITED" });
    await expect(src(res(429, {})).recentCommits(ref, "x")).rejects.toMatchObject({ code: "RATE_LIMITED" });
    await expect(src(res(409, {})).recentCommits(ref, "x")).rejects.toMatchObject({ code: "NO_RECENT_COMMITS" });
    await expect(src(new TypeError("Failed to fetch")).recentCommits(ref, "x")).rejects.toMatchObject({ code: "NETWORK" });
    await expect(src(res(500, {})).recentCommits(ref, "x")).rejects.toMatchObject({ code: "NETWORK" });
  });
});
