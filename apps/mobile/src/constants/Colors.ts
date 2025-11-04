/**
 * Color constants for the mobile app
 * Based on tailwind.config.js color definitions
 */

export const COLORS = {
    light: {
        primary: '#386641',
        primary_foreground: '#232222',
        secondary: '#6A994E',
        'mid-grey': '#F3F3F3',
        grey: '#90988B',
        grey2: '#90988B', // Alias for consistency
        grey5: '#F9F9F9', // Alias for light-grey
        red: '#EA4335',
        green_grey: '#D1DBCD',
        'light-grey': '#F9F9F9',
        white: '#FFFFFF',
        black: '#232222',
    },
    dark: {
        primary: '#386641',
        primary_foreground: '#ffffff',
        secondary: '#6A994E',
        'mid-grey': '#2a2a2a',
        grey: '#b0b0b0',
        grey2: '#b0b0b0', // Alias for consistency
        grey5: '#1a1a1a', // Alias for light-grey-dark
        red: '#EA4335',
        green_grey: '#D1DBCD',
        'light-grey': '#1a1a1a',
        white: '#0a0a0a',
        black: '#ffffff',
    },
} as const;

export type ColorScheme = keyof typeof COLORS;
export type ColorName = keyof typeof COLORS.light;
