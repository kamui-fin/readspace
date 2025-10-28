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
                'mid-grey': {
                    DEFAULT: '#F3F3F3',
                    dark: '#2a2a2a',
                },
                grey: {
                    DEFAULT: '#90988B',
                    dark: '#b0b0b0',
                },
                red: '#EA4335',
                'green-grey': '#D1DBCD',
                'light-grey': {
                    DEFAULT: '#F9F9F9',
                    dark: '#1a1a1a',
                },
                white: {
                    DEFAULT: '#FFFFFF',
                    dark: '#0a0a0a',
                },
                black: {
                    DEFAULT: '#232222',
                    dark: '#ffffff',
                },
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
