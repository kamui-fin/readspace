/**
 * Color definitions for Readspace Design System
 * TypeScript definitions that match CSS variables
 */

export const colorTokens = {
  background: 'var(--background)',
  foreground: 'var(--foreground)',
  muted: {
    DEFAULT: 'var(--muted)',
    foreground: 'var(--muted-foreground)',
  },
  popover: {
    DEFAULT: 'var(--popover)',
    foreground: 'var(--popover-foreground)',
  },
  card: {
    DEFAULT: 'var(--card)',
    foreground: 'var(--card-foreground)',
  },
  border: 'var(--border)',
  input: 'var(--input)',
  primary: {
    DEFAULT: 'var(--primary)',
    foreground: 'var(--primary-foreground)',
  },
  secondary: {
    DEFAULT: 'var(--secondary)',
    foreground: 'var(--secondary-foreground)',
  },
  accent: {
    DEFAULT: 'var(--accent)',
    foreground: 'var(--accent-foreground)',
  },
  destructive: {
    DEFAULT: 'var(--destructive)',
    foreground: 'var(--destructive-foreground)',
  },
  ring: 'var(--ring)',
  chart: {
    '1': 'var(--chart-1)',
    '2': 'var(--chart-2)',
    '3': 'var(--chart-3)',
    '4': 'var(--chart-4)',
    '5': 'var(--chart-5)',
  },
  sidebar: {
    DEFAULT: 'var(--sidebar)',
    foreground: 'var(--foreground)',
    primary: 'var(--primary)',
    'primary-foreground': 'var(--primary-foreground)',
    accent: 'var(--accent)',
    'accent-foreground': 'var(--accent-foreground)',
    border: 'var(--border)',
    ring: 'var(--ring)',
  },
} as const;
