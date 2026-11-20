const memoryStorage = new Map<string, string>();

function getNativeStorage(kind: 'localStorage' | 'sessionStorage'): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    const store = window[kind];
    if (!store) return null;
    const probeKey = '__sada_storage_probe__';
    store.setItem(probeKey, '1');
    store.removeItem(probeKey);
    return store;
  } catch {
    return null;
  }
}

export function safeGetItem(key: string): string | null {
  try {
    const store = getNativeStorage('localStorage');
    if (store) {
      const val = store.getItem(key);
      if (val !== null) return val;
    }
  } catch {
    // ignore native storage error
  }
  return memoryStorage.has(key) ? (memoryStorage.get(key) ?? null) : null;
}

export function safeSetItem(key: string, value: string): void {
  memoryStorage.set(key, value);
  try {
    const store = getNativeStorage('localStorage');
    if (store) {
      store.setItem(key, value);
    }
  } catch {
    // ignore quota / security errors in restricted WebViews
  }
}

export function safeRemoveItem(key: string): void {
  memoryStorage.delete(key);
  try {
    const store = getNativeStorage('localStorage');
    if (store) {
      store.removeItem(key);
    }
  } catch {
    // ignore native storage errors
  }
}

export function safeClearKeysMatching(predicate: (key: string) => boolean): void {
  for (const key of Array.from(memoryStorage.keys())) {
    if (predicate(key)) {
      memoryStorage.delete(key);
    }
  }
  try {
    const store = getNativeStorage('localStorage');
    if (!store) return;
    const toRemove: string[] = [];
    for (let i = 0; i < store.length; i += 1) {
      const k = store.key(i);
      if (k && predicate(k)) {
        toRemove.push(k);
      }
    }
    toRemove.forEach((k) => store.removeItem(k));
  } catch {
    // ignore native storage errors
  }
}

export function safeClearSessionStorage(): void {
  try {
    const store = getNativeStorage('sessionStorage');
    if (store) {
      store.clear();
    }
  } catch {
    // ignore sessionStorage errors
  }
}

export const safeAuthStorage = {
  getItem: (key: string): string | null => safeGetItem(key),
  setItem: (key: string, value: string): void => safeSetItem(key, value),
  removeItem: (key: string): void => safeRemoveItem(key),
};
