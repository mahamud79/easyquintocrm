// Tiny localStorage persistence helper for in-memory stores.
// Bridge solution before moving stores to the cloud database.

const PREFIX = "leadvalue:v1:";

export function loadPersisted<T>(
  key: string,
  fallback: T,
  reviver?: (raw: unknown) => T,
): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return reviver ? reviver(parsed) : (parsed as T);
  } catch {
    return fallback;
  }
}

export function savePersisted<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* quota exceeded or storage disabled — ignore */
  }
}

export function clearPersisted(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}