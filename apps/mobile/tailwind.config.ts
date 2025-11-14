import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,tsx}'],
  darkMode: 'class',
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#386641',
          light: 'rgba(56, 102, 65, 0.1)',
          foreground: {
            DEFAULT: '#232222',
            dark: '#ffffff',
          },
        },
        secondary: {
          DEFAULT: '#6A994E',
          foreground: {
            DEFAULT: 'rgb(47, 68, 34)',
            dark: 'rgb(228, 236, 223)',
          },
        },
        grey6: {
          DEFAULT: 'rgb(247, 247, 247)',
          dark: 'rgb(27, 28, 27)',
        },
        grey5: {
          DEFAULT: 'rgb(237, 237, 237)',
          dark: 'rgb(45, 47, 46)',
        },
        grey4: {
          DEFAULT: 'rgb(226, 227, 227)',
          dark: 'rgb(58, 60, 58)',
        },
        grey3: {
          DEFAULT: 'rgb(211, 212, 211)',
          dark: 'rgb(78, 80, 78)',
        },
        grey2: {
          DEFAULT: 'rgb(180, 182, 180)',
          dark: 'rgb(121, 124, 121)',
        },
        grey: {
          DEFAULT: 'rgb(159, 162, 160)',
          dark: 'rgb(159, 162, 160)',
        },
        background: {
          DEFAULT: 'rgb(255, 255, 255)',
          dark: 'rgb(2, 4, 2)',
        },
        screen: {
          DEFAULT: 'rgb(255, 255, 255)',
          dark: 'rgb(27, 28, 27)',
        },
        root: {
          DEFAULT: 'rgb(245, 246, 245)',
          dark: 'rgb(2, 4, 2)',
        },
        card: {
          DEFAULT: 'rgb(245, 246, 245)',
          dark: 'rgb(2, 4, 2)',
          foreground: {
            DEFAULT: 'rgb(245, 246, 245)',
            dark: 'rgb(2, 4, 2)',
          },
        },
        muted: {
          DEFAULT: 'rgb(228, 236, 223)',
          green: '#D1DBCD',
          foreground: 'rgb(72, 96, 57)',
        },
        destructive: {
          DEFAULT: 'rgb(255, 56, 43)',
          dark: 'rgb(254, 67, 54)',
        },
        red: '#EA4335',
        blue: '#236BEF',
        white: {
          DEFAULT: '#FFFFFF',
          dark: '#0a0a0a',
        },
        black: {
          DEFAULT: '#232222',
          dark: '#ffffff',
        },
        unified: {
          DEFAULT: '#F5F5F5',
          dark: '#121212',
        },
        tab: {
          border: {
            DEFAULT: '#E0E0E0',
            dark: '#2A2A2A',
          },
        },
        tint: {
          active: {
            DEFAULT: 'black',
            dark: '#E5E5E5',
          },
          inactive: {
            DEFAULT: 'grey',
            dark: '#888888',
          },
        },
        icon: {
          blue: {
            DEFAULT: 'rgb(230, 240, 255)',
            dark: 'rgb(25, 35, 45)',
          },
          green: {
            DEFAULT: 'rgb(230, 255, 235)',
            dark: 'rgb(25, 45, 35)',
          },
          red: {
            DEFAULT: 'rgb(255, 230, 230)',
            dark: 'rgb(45, 25, 25)',
          },
          yellow: {
            DEFAULT: 'rgb(255, 245, 230)',
            dark: 'rgb(45, 40, 25)',
          },
          purple: {
            DEFAULT: 'rgb(240, 230, 255)',
            dark: 'rgb(35, 25, 45)',
          },
          grey: {
            DEFAULT: 'rgb(230, 230, 230)',
            dark: 'rgb(45, 45, 45)',
          },
        },
        orange: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
          950: '#431407',
        },
      },
      fontFamily: {
        'geist-regular': ['Geist_400Regular'],
        'geist-medium': ['Geist_500Medium'],
        'geist-semibold': ['Geist_600SemiBold'],
        'geist-bold': ['Geist_700Bold'],
        'geist-mono': ['GeistMono_400Regular'],
        'geist-mono-medium': ['GeistMono_500Medium'],
        'geist-mono-semibold': ['GeistMono_600SemiBold'],
        'geist-mono-bold': ['GeistMono_700Bold'],
        'figtree-regular': ['Figtree_400Regular'],
        'figtree-medium': ['Figtree_500Medium'],
        'figtree-semibold': ['Figtree_600SemiBold'],
        'figtree-bold': ['Figtree_700Bold'],
        'garamond-regular': ['EBGaramond_400Regular'],
        'garamond-medium': ['EBGaramond_500Medium'],
        'garamond-semibold': ['EBGaramond_600SemiBold'],
        'garamond-bold': ['EBGaramond_700Bold'],
      },
      letterSpacing: {
        heading: '-0.02em',
      },
      borderRadius: {
        none: '0',
        sm: '4px',
        DEFAULT: '8px',
        md: '10px',
        lg: '12px',
        xl: '12px',
        '2xl': '16px',
        '3xl': '20px',
        full: '9999px',
      },
    },
  },
  plugins: [],
};

export default config;
