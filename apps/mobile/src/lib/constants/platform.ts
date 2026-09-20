import { Platform } from 'react-native';

/** Liquid Glass (glass button styles, glass sheet material) only exists from iOS 26. */
export const SUPPORTS_GLASS =
  Platform.OS === 'ios' && Number.parseInt(String(Platform.Version), 10) >= 26;

/** iOS screens use the native navigation header (large title, `UISearchController`). */
export const USES_NATIVE_HEADER = Platform.OS === 'ios';

/** iOS renders the tab bar with `NativeTabs` (`UITabBarController`); Android keeps the custom bar. */
export const USES_NATIVE_TABS = Platform.OS === 'ios';
