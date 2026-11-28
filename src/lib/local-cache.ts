// Browser-only stale-while-revalidate cache. Safe during SSR (returns null / no-op).
export function readCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeCache(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota full: drop older NQAI caches, then give up silently.
    try {
      for (const k of Object.keys(window.localStorage)) if (k.startsWith("nqai_cached_messages_")) window.localStorage.removeItem(k);
    } catch { /* ignore */ }
  }
}

export function removeCache(key: string): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(key); } catch { /* ignore */ }
}

export function clearPrivateCaches(): void {
  if (typeof window === "undefined") return;
  try {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith("nqai_cached_") || key.startsWith("nqai_voice_cache") || key === "nqai.byok.keys" || key === "nqai.personalProfile") {
        window.localStorage.removeItem(key);
      }
    }
  } catch { /* Private storage can be disabled; never prevent sign-out. */ }
}
