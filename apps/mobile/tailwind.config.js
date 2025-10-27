/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,tsx}'],
  darkMode: 'class',
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#386641',
        secondary: '#6A994E',
        'mid-grey': '#F3F3F3',
        grey: '#90988B',
        red: '#EA4335',
        'green-grey': '#D1DBCD',
        'light-grey': '#F9F9F9',
        white: '#FFFFFF',
        black: '#232222',
      },
      fontFamily: {
        geist: ['Geist_400Regular'],
        'geist-medium': ['Geist_500Medium'],
        'geist-semibold': ['Geist_600SemiBold'],
        'geist-bold': ['Geist_700Bold'],
        'geist-mono': ['GeistMono_400Regular'],
        'geist-mono-medium': ['GeistMono_500Medium'],
        'geist-mono-semibold': ['GeistMono_600SemiBold'],
        'geist-mono-bold': ['GeistMono_700Bold'],
        figtree: ['Figtree_500Medium'],
        garamond: ['EBGaramond_400Regular'],
        'garamond-medium': ['EBGaramond_500Medium'],
        'garamond-semibold': ['EBGaramond_600SemiBold'],
        'garamond-bold': ['EBGaramond_700Bold'],
      },
      letterSpacing: {
        heading: '-0.02em',
      },
    },
  },
  plugins: [],
};
