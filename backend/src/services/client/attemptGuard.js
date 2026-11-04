// Tiny in-memory brute-force guard for 6-digit codes and password re-checks:
// 5 wrong tries lock that user for 10 minutes. (Resets on server restart; use Redis if you scale out.)
const MAX_FAILS = 5;
const LOCK_MS = 10 * 60 * 1000;
const store = new Map();

export const attempts = {
  /** Seconds the user is still locked for, or 0 */
  blockedFor(key) {
    const e = store.get(String(key));
    if (!e || !e.until) return 0;
    if (e.until <= Date.now()) {
      store.delete(String(key));
      return 0;
    }
    return Math.ceil((e.until - Date.now()) / 1000);
  },
  fail(key) {
    const k = String(key);
    const e = store.get(k) || { count: 0, until: 0 };
    e.count += 1;
    if (e.count >= MAX_FAILS) e.until = Date.now() + LOCK_MS;
    store.set(k, e);
  },
  clear(key) {
    store.delete(String(key));
  },
};
