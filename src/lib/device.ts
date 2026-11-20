import { safeGetItem, safeSetItem } from './safeStorage';

const DEVICE_STORAGE_KEY = 'sada_device_uuid_v1';

export function getOrCreateDeviceUuid(): string {
  try {
    let existing = safeGetItem(DEVICE_STORAGE_KEY);
    if (!existing && typeof document !== 'undefined') {
      const cookieMatch = document.cookie
        .split('; ')
        .find((row) => row.startsWith(`${DEVICE_STORAGE_KEY}=`));
      if (cookieMatch) {
        existing = cookieMatch.split('=')[1];
      }
    }
    if (existing && existing.length >= 12) {
      safeSetItem(DEVICE_STORAGE_KEY, existing);
      return existing;
    }
    const generated =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `sada-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    safeSetItem(DEVICE_STORAGE_KEY, generated);
    if (typeof document !== 'undefined') {
      try {
        document.cookie = `${DEVICE_STORAGE_KEY}=${generated}; path=/; max-age=31536000; SameSite=Lax`;
      } catch {
        // ignore cookie write errors in restricted WebViews
      }
    }
    return generated;
  } catch {
    return 'sada-fallback-device-001';
  }
}
