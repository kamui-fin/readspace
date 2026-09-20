import { Platform } from 'react-native';

/** Liquid Glass (glass button styles, glass sheet material) only exists from iOS 26. */
export const SUPPORTS_GLASS =
  Platform.OS === 'ios' && Number.parseInt(String(Platform.Version), 10) >= 26;
