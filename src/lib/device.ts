const DEVICE_STORAGE_KEY = 'sada_device_uuid_v1';

export function getOrCreateDeviceUuid(): string {
  try {
    let existing = localStorage.getItem(DEVICE_STORAGE_KEY);
    if (!existing) {
      const cookieMatch = document.cookie
        .split('; ')
        .find((row) => row.startsWith(`${DEVICE_STORAGE_KEY}=`));
      if (cookieMatch) {
        existing = cookieMatch.split('=')[1];
      }
    }
    if (existing && existing.length >= 12) {
      localStorage.setItem(DEVICE_STORAGE_KEY, existing);
      return existing;
    }
    const generated =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `sada-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(DEVICE_STORAGE_KEY, generated);
    document.cookie = `${DEVICE_STORAGE_KEY}=${generated}; path=/; max-age=31536000; SameSite=Lax`;
    return generated;
  } catch {
    return 'sada-fallback-device-001';
  }
}
