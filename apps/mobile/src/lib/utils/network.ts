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
