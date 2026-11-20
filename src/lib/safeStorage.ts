/**
 * Privacy restrictions must not affect quotes or navigation. Browsers that block
 * site data throw a SecurityError from the `localStorage` getter itself, and
 * Android WebViews with DOM storage off expose `null`, so every access goes
 * through these helpers instead of touching `localStorage` directly.
 */
export function getLocalStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

export function readLocalStorage(key: string): string | null {
  try {
    return getLocalStorage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** Returns false when the browser refused the write (blocked, full, or missing storage). */
export function writeLocalStorage(key: string, value: string): boolean {
  const storage = getLocalStorage();
  if (!storage) return false;
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeLocalStorage(key: string): void {
  try {
    getLocalStorage()?.removeItem(key);
  } catch {
    /* Blocked storage has nothing to remove. */
  }
}

// sessionStorage fails the same ways. It is cleared when the tab closes, for
// values that must not outlive the visit.
function getSessionStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage ?? null;
  } catch {
    return null;
  }
}

export function readSessionStorage(key: string): string | null {
  try {
    return getSessionStorage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeSessionStorage(key: string, value: string): boolean {
  const storage = getSessionStorage();
  if (!storage) return false;
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeSessionStorage(key: string): void {
  try {
    getSessionStorage()?.removeItem(key);
  } catch {
    /* Blocked storage has nothing to remove. */
  }
}
