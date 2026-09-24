// Adapter: in-memory EntryStore (fallback when Anna storage is unavailable).
export function createMemoryStore() {
  const entries = new Map();
  let prefs = {};
  return {
    async save(entry) { entries.set(entry.id, structuredClone(entry)); },
    async list() { return [...entries.values()].map((e) => structuredClone(e)); },
    async remove(id) { entries.delete(id); },
    async getPrefs() { return { ...prefs }; },
    async setPrefs(p) { prefs = { ...p }; },
  };
}
