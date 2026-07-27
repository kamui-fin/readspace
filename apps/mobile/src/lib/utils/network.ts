import { getSettings } from '@stores/settings';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Resolves local hostnames (like 'localhost') for Android devices.
 * For Android Emulators, it maps 'localhost' to '10.0.2.2'.
 * For physical Android devices (which access local services via USB with `adb reverse`),
 * it maps 'localhost' to '127.0.0.1' so the port forwarding is correctly routed.
 */
export const resolveHostname = (url: string): string => {
  try {
    const _url = new URL(url);
    if (_url.hostname === 'localhost' && Platform.OS === 'android') {
      const deviceName = Constants.deviceName?.toLowerCase() || '';
      const isEmulator =
        deviceName.includes('sdk') ||
        deviceName.includes('emulator') ||
        deviceName.includes('gphone') ||
        deviceName.includes('virtual');
      _url.hostname = isEmulator ? '10.0.2.2' : '127.0.0.1';
    }
    return _url.toString().replace(/\/$/, '');
  } catch (e) {
    if (url.includes('localhost') && Platform.OS === 'android') {
      const deviceName = Constants.deviceName?.toLowerCase() || '';
      const isEmulator =
        deviceName.includes('sdk') ||
        deviceName.includes('emulator') ||
        deviceName.includes('gphone') ||
        deviceName.includes('virtual');
      const targetHost = isEmulator ? '10.0.2.2' : '127.0.0.1';
      return url.replace('localhost', targetHost).replace(/\/$/, '');
    }
    return url.replace(/\/$/, '');
  }
};

/**
 * Resolves Supabase storage URLs (especially in self-hosted mode where the backend
 * might return 'localhost:18000' or internal container hostname like 'kong:18000')
 * to the client's configured Supabase URL.
 */
export const resolveSupabaseImageUrl = (url: string | null | undefined): string | undefined => {
  if (!url) return undefined;

  try {
    const settings = getSettings();
    const clientSupabaseUrl = settings?.supabase_url;
    if (!clientSupabaseUrl) return resolveHostname(url);
    const clientOrigin = new URL(clientSupabaseUrl).origin;

    // Check if the URL points to Supabase storage
    if (url.includes('/storage/v1/object/public/')) {
      // Find where the storage path begins
      const storageIndex = url.indexOf('/storage/v1/object/public/');
      if (storageIndex !== -1) {
        let storagePath = url.substring(storageIndex);

        // Defensive check: if the path has duplicated bucket segments
        // e.g. /storage/v1/object/public/favicons/storage/v1/object/public/favicons/...
        const duplicatePattern =
          '/storage/v1/object/public/favicons/storage/v1/object/public/favicons/';
        if (storagePath.includes(duplicatePattern)) {
          storagePath = storagePath.replace(
            duplicatePattern,
            '/storage/v1/object/public/favicons/'
          );
        } else {
          // General check: if it contains /storage/v1/object/public/ multiple times
          const parts = storagePath.split('/storage/v1/object/public/');
          if (parts.length > 2) {
            storagePath = '/storage/v1/object/public/' + parts[parts.length - 1];
          }
        }

        // Return the resolved URL combining client supabase origin and storage path, resolving double slashes
        const resolved = `${clientOrigin}${storagePath}`;
        // Make sure we resolve any local emulator hostnames if needed
        return resolveHostname(resolved);
      }
    }

    // Handle raw relative paths from Meilisearch (e.g. UUID/hash filenames)
    if (
      !url.startsWith('http://') &&
      !url.startsWith('https://') &&
      !url.startsWith('data:') &&
      !url.startsWith('/')
    ) {
      const resolved = `${clientOrigin}/storage/v1/object/public/favicons/${url}`;
      return resolveHostname(resolved);
    }
  } catch (err) {
    console.error('[Network] Error resolving Supabase image URL:', err);
  }

  // Fallback to resolving hostname (e.g. localhost -> emulator IP)
  return resolveHostname(url);
};
