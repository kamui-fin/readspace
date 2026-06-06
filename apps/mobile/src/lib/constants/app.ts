import { Dimensions, Platform } from 'react-native';

export const BOTTOM_TABBAR_BASE_HEIGHT = 64;

// Bottom Sheet constants
export const DEVICE_CORNER_RADIUS = Platform.select({
  ios: 39, // iPhone X+ corner radius
  android: 32, // Modern Android device corner radius
  default: 24,
});

// Button border radius based on device corner radius
// For buttons, we use the device corner radius directly for a system-consistent look
export const BUTTON_BORDER_RADIUS = 9999;

export const BOTTOM_SHEET_WIDTH = Dimensions.get('window').width - 32;

// Spacing constants for onboarding screens
export const SPACING = {
  ONBOARDING_CONTENT_PADDING: 28,
  ONBOARDING_SECTION_SPACING: 24,
  ONBOARDING_INPUT_BOTTOM_MARGIN: 32,
  // Dynamic spacing based on screen dimensions
  getOnboardingTopPadding: (screenHeight: number) => {
    // Base on iPhone 16 (852px height) = 400px padding
    const baseHeight = 852;
    const basePadding = 240;
    const heightRatio = screenHeight / baseHeight;
    // Scale with bounds to prevent extreme values
    const scaledPadding = basePadding * heightRatio;
    return Math.max(Math.min(scaledPadding, screenHeight * 0.55), screenHeight * 0.35);
  },
  // Calculate responsive negative margin to reduce excessive top padding for notifications screen
  getNotificationTopMargin: (screenHeight: number) => {
    const topPadding = SPACING.getOnboardingTopPadding(screenHeight);
    const reductionPercentage = 0.8;
    return -(topPadding * reductionPercentage);
  },
} as const;

// Page indicator constants
const PAGE_INDICATOR_BASE_SIZE = 4;

export const PAGE_INDICATOR = {
  BASE_SIZE: PAGE_INDICATOR_BASE_SIZE,
  // Calculate responsive dash size based on screen width and page count
  getDashSize: (
    screenWidth: number,
    pageCount: number,
    baseSize: number = PAGE_INDICATOR_BASE_SIZE
  ) => {
    const effectiveWidth = screenWidth * 0.85; // Use 85% of screen width for indicator
    const availableWidth = effectiveWidth - SPACING.ONBOARDING_CONTENT_PADDING * 2; // Account for padding
    // Calculate optimal dash size to fit all pages with proper spacing
    const optimalDashSize = Math.floor(availableWidth / pageCount);
    // Dynamic bounds based on screen width (iPhone 16 width = 393px)
    const baseWidth = 393;
    const widthRatio = screenWidth / baseWidth;
    // Scale the min/max values proportionally
    const minDashSize = Math.floor(baseSize * 22 * widthRatio); // Base minimum for iPhone 16
    const maxDashSize = Math.floor(baseSize * 32 * widthRatio); // Base maximum for iPhone 16
    return Math.max(Math.min(optimalDashSize, maxDashSize), minDashSize);
  },
} as const;
