// Application: UC-2 listHistory, UC-4 deleteEntry.
import { weeklyStreak } from "../domain/entry.js";

export const HISTORY_LIMIT = 20;

/** @param {{store: {list: () => Promise<any[]>}, clock: {now: () => Date}}} deps */
export async function listHistory({ store, clock }) {
  let entries;
  try {
    entries = await store.list();
  } catch {
    return { entries: [], streak: 0, error: true };
  }
  const sorted = [...(entries ?? [])]
    .filter((e) => e && typeof e.createdAt === "string")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, HISTORY_LIMIT);
  return { entries: sorted, streak: weeklyStreak(sorted, clock.now()) };
}

/** @param {string} id @param {{store: {remove: (id: string) => Promise<void>}}} deps */
export async function deleteEntry(id, { store }) {
  await store.remove(id);
}
