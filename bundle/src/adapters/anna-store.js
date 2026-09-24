// Adapter: EntryStore over Anna Persistent Storage (anna.storage.*, scope=app, per user).
import { unwrap } from "./rpc.js";

const PREFIX = "entries/";
const PREFS_KEY = "prefs";

/**
 * APS returns {value, exists, etag, generation}; the legacy runtime_state backend / test harness
 * return the raw stored value. Normalise both.
 * @returns {{exists: boolean, value: any}}
 */
export function readValue(res) {
  if (res === null || res === undefined) return { exists: false, value: null };
  if (typeof res === "object" && !Array.isArray(res) && "value" in res && ("exists" in res || "etag" in res || "generation" in res || Object.keys(res).length === 1)) {
    return { exists: res.exists !== false && res.value !== null && res.value !== undefined, value: res.value };
  }
  return { exists: true, value: res };
}

/** @param {{storage: {get: Function, set: Function, list: Function, delete: Function}}} anna */
export function createAnnaStore(anna, { keep = 20 } = {}) {
  async function keys() {
    const out = [];
    let cursor;
    for (let page = 0; page < 5; page += 1) {
      const res = unwrap(await anna.storage.list({ prefix: PREFIX, limit: 100, ...(cursor ? { cursor } : {}) }));
      for (const item of res?.items ?? []) out.push(item.key);
      cursor = res?.next_cursor;
      if (!cursor) break;
    }
    return out.sort().reverse(); // ids start with a UTC timestamp → newest first
  }

  return {
    async save(entry) {
      unwrap(await anna.storage.set({ key: PREFIX + entry.id, value: entry, tags: ["entry"] }));
      try {
        const all = await keys();
        for (const k of all.slice(keep)) unwrap(await anna.storage.delete({ key: k }));
      } catch {
        // pruning is best-effort
      }
    },
    async list() {
      const all = (await keys()).slice(0, keep);
      const rows = await Promise.all(all.map(async (key) => readValue(unwrap(await anna.storage.get({ key })))));
      return rows.filter((r) => r.exists && r.value && typeof r.value === "object").map((r) => r.value);
    },
    async remove(id) {
      unwrap(await anna.storage.delete({ key: PREFIX + id }));
    },
    async getPrefs() {
      const r = readValue(unwrap(await anna.storage.get({ key: PREFS_KEY })));
      return r.exists && r.value && typeof r.value === "object" ? r.value : {};
    },
    async setPrefs(prefs) {
      unwrap(await anna.storage.set({ key: PREFS_KEY, value: prefs }));
    },
  };
}
